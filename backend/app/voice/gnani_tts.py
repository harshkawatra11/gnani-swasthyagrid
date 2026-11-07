"""Gnani Timbre TTS: REST synthesis and a streaming WebSocket session.

`timbre-v2.5`. REST returns raw audio bytes (not JSON); the streaming WebSocket
accepts base64 JSON `audio` chunks and allows only one request in flight at a time
per connection, so the stream worker below sends one sentence, waits for `complete`,
then sends the next.

Ported from `app.voice.sarvam_tts` / `sarvam_tts_ws` (now removed), restructured for
Gnani's Vachana API documented at docs.gnani.ai/api/TTS.
"""

import asyncio
import base64
import contextlib
import json
import logging
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

import httpx
import websockets

from app.voice.wav import parse_wav_header

logger = logging.getLogger("swasthyagrid.voice")

GNANI_TTS_REST_URL = "https://api.vachana.ai/api/v1/tts/inference"
GNANI_TTS_WS_URL = "wss://api.vachana.ai/api/v1/tts"
RETRY_STATUSES = frozenset({429, 500, 503, 504})
RETRY_DELAYS_S = (0.5, 1.0)
SENTENCE_TIMEOUT_S = 10.0
REST_COOLDOWN_S = 300.0


@dataclass
class WavSynthesis:
    wav_base64: str
    sample_rate_hz: int


class GnaniTTSError(RuntimeError):
    def __init__(self, status_code: int, message: str):
        super().__init__(f"Gnani TTS failed ({status_code}): {message[:300]}")
        self.status_code = status_code


def tts_language(language: str | None) -> str:
    return "hi-IN" if language in (None, "", "auto") else language


def request_body(
    *, text: str, model: str, voice: str, language: str | None, sample_rate: int, speed: float, container: str
) -> dict[str, Any]:
    return {
        "text": text,
        "model": model,
        "voice": voice,
        "language": tts_language(language),
        "speed": speed,
        "audio_config": {
            "sample_rate": sample_rate,
            "num_channels": 1,
            "sample_width": 2,
            "encoding": "linear_pcm",
            "container": container,
        },
    }


async def synthesize(
    *,
    api_key: str,
    text: str,
    voice: str,
    model: str,
    language: str | None,
    sample_rate: int = 24000,
    speed: float = 1.0,
    url: str = GNANI_TTS_REST_URL,
    client: httpx.AsyncClient | None = None,
    attempts: int = 3,
) -> WavSynthesis:
    body = request_body(text=text, model=model, voice=voice, language=language, sample_rate=sample_rate, speed=speed, container="wav")
    headers = {"X-API-Key-ID": api_key, "content-type": "application/json"}
    own = client is None
    http = client or httpx.AsyncClient(timeout=10.0)
    try:
        for attempt in range(attempts):
            res = await http.post(url, headers=headers, json=body)
            if res.status_code == 200:
                wav = res.content
                parsed = parse_wav_header(wav)
                return WavSynthesis(wav_base64=base64.b64encode(wav).decode(), sample_rate_hz=parsed.sample_rate_hz)
            if res.status_code in RETRY_STATUSES and attempt < attempts - 1:
                await asyncio.sleep(RETRY_DELAYS_S[min(attempt, len(RETRY_DELAYS_S) - 1)])
                continue
            raise GnaniTTSError(res.status_code, res.text)
    finally:
        if own:
            await http.aclose()
    raise RuntimeError("unreachable")  # pragma: no cover


@dataclass
class AudioChunk:
    b64: str
    encoding: str  # "pcm_s16le" | "wav"
    sample_rate_hz: int
    seq: int


OnAudio = Callable[[AudioChunk], Awaitable[None]]
RestSynth = Callable[..., Awaitable[WavSynthesis]]


@dataclass
class _Turn:
    language: str
    on_audio: OnAudio
    queue: "asyncio.Queue[str | None]" = field(default_factory=asyncio.Queue)
    seq: int = 0
    carry: bytes = b""
    task: "asyncio.Task | None" = None


class TtsStream:
    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        voices: dict[str, str],
        mode: str = "ws",
        sample_rate: int = 24000,
        speed: float = 1.0,
        ws_url: str = GNANI_TTS_WS_URL,
        rest_url: str = GNANI_TTS_REST_URL,
        sentence_timeout: float = SENTENCE_TIMEOUT_S,
        rest_cooldown: float = REST_COOLDOWN_S,
        rest_synthesize: RestSynth | None = None,
        connect: Callable[[], Awaitable[Any]] | None = None,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.api_key = api_key
        self.model = model
        self.voices = voices
        self._configured_mode = mode
        self.sample_rate = sample_rate
        self.speed = speed
        self.ws_url = ws_url
        self.rest_url = rest_url
        self.sentence_timeout = sentence_timeout
        self.rest_cooldown = rest_cooldown
        self._rest_synthesize = rest_synthesize
        self._connect = connect or self._default_connect
        self._clock = clock
        self._rest_until = 0.0
        self._conn: Any = None
        self._turn: _Turn | None = None
        self.closed = False

    async def _default_connect(self) -> Any:
        return await websockets.connect(self.ws_url, additional_headers={"X-API-Key-ID": self.api_key}, max_size=None)

    # ------------------------------------------------------------------ mode

    @property
    def mode(self) -> str:
        if self._configured_mode == "rest" or self._clock() < self._rest_until:
            return "rest"
        return "ws"

    def _enter_rest_mode(self) -> None:
        self._rest_until = self._clock() + self.rest_cooldown

    def voice_for(self, language: str | None) -> str:
        lang = tts_language(language)
        return self.voices.get(lang) or self.voices.get("hi-IN") or next(iter(self.voices.values()))

    # ----------------------------------------------------------------- turns

    async def begin_turn(self, language: str, on_audio: OnAudio) -> None:
        if self._turn is not None:
            await self.cancel_turn()
        turn = _Turn(language=tts_language(language), on_audio=on_audio)
        self._turn = turn
        if self.mode == "ws":
            try:
                await self._ensure_socket()
            except Exception:
                logger.warning("TTS socket could not open, using REST for this turn", exc_info=True)
                self._enter_rest_mode()
                await self._close_socket()
        turn.task = asyncio.get_running_loop().create_task(self._worker(turn))

    async def say(self, sentence: str) -> None:
        turn = self._turn
        sentence = sentence.strip()
        if turn is None or not sentence:
            return
        turn.queue.put_nowait(sentence)

    async def end_turn(self) -> None:
        turn = self._turn
        if turn is None:
            return
        try:
            turn.queue.put_nowait(None)
            if turn.task is not None:
                await turn.task
        finally:
            if self._turn is turn:
                self._turn = None

    async def cancel_turn(self) -> None:
        """Barge-in or stop: drop the turn's audio and close the socket (an
        in-flight request would otherwise leak audio into the next turn)."""
        turn, self._turn = self._turn, None
        if turn is not None and turn.task is not None:
            turn.task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await turn.task
        await self._close_socket()

    async def close(self) -> None:
        self.closed = True
        await self.cancel_turn()

    # ---------------------------------------------------------------- socket

    async def _ensure_socket(self) -> None:
        if self._conn is not None:
            try:
                state = getattr(self._conn, "state", None)
                open_state = getattr(websockets.protocol.State, "OPEN", None)
                if state is None or open_state is None or state == open_state:
                    return
            except Exception:
                return
        await self._close_socket()
        self._conn = await self._connect()

    async def _close_socket(self) -> None:
        conn, self._conn = self._conn, None
        if conn is not None:
            with contextlib.suppress(Exception):
                await conn.close()

    # ----------------------------------------------------------------- work

    async def _worker(self, turn: _Turn) -> None:
        while True:
            sentence = await turn.queue.get()
            if sentence is None:
                return
            if self.mode == "ws":
                try:
                    await self._speak_ws(turn, sentence)
                    continue
                except asyncio.CancelledError:
                    raise
                except Exception:
                    logger.warning("TTS socket failed, finishing on REST", exc_info=True)
                    self._enter_rest_mode()
                    await self._close_socket()
            await self._speak_rest(turn, sentence)

    async def _speak_ws(self, turn: _Turn, sentence: str) -> None:
        await self._ensure_socket()
        conn = self._conn
        if conn is None:
            raise ConnectionError("no TTS socket")
        body = request_body(
            text=sentence, model=self.model, voice=self.voice_for(turn.language), language=turn.language,
            sample_rate=self.sample_rate, speed=self.speed, container="raw",
        )
        await conn.send(json.dumps(body))
        async with asyncio.timeout(self.sentence_timeout):
            while True:
                raw = await conn.recv()
                if isinstance(raw, bytes):
                    await self._emit_pcm(turn, raw)
                    continue
                msg = json.loads(raw)
                kind = msg.get("type")
                data = msg.get("data") or {}
                if kind == "audio" and data.get("audio"):
                    await self._emit_pcm(turn, base64.b64decode(data["audio"]))
                    if data.get("is_final"):
                        break
                elif kind == "complete":
                    break
                elif kind == "error":
                    raise GnaniTTSError(0, str(msg.get("message", "")))
        turn.carry = b""

    async def _emit_pcm(self, turn: _Turn, pcm: bytes) -> None:
        if pcm[:4] == b"RIFF":
            pcm = parse_wav_header(pcm).pcm
        data = turn.carry + pcm
        if len(data) % 2:
            turn.carry = data[-1:]
            data = data[:-1]
        else:
            turn.carry = b""
        if not data:
            return
        chunk = AudioChunk(base64.b64encode(data).decode(), "pcm_s16le", self.sample_rate, turn.seq)
        turn.seq += 1
        await turn.on_audio(chunk)

    async def _speak_rest(self, turn: _Turn, sentence: str) -> None:
        synth = self._rest_synthesize or synthesize
        try:
            result = await synth(
                api_key=self.api_key, text=sentence, voice=self.voice_for(turn.language), model=self.model,
                language=turn.language, sample_rate=self.sample_rate, speed=self.speed, url=self.rest_url,
            )
        except Exception:
            logger.exception("REST TTS failed for a sentence")
            return
        chunk = AudioChunk(result.wav_base64, "wav", result.sample_rate_hz, turn.seq)
        turn.seq += 1
        await turn.on_audio(chunk)
