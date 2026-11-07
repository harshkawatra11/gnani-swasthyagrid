"""Gnani Prisma realtime STT over WebSocket.

`prisma-v2.5`, linear16 mono, binary frames of exactly 1024 bytes (512 samples, 32 ms
at 16 kHz). All session config (language, model, format, VAD tuning) is sent as
handshake headers, not a query string. Gnani emits no partial transcripts: every
`transcript` message is final, so the voice session treats a final transcript as the
signal that confirms an armed barge-in (see `app.voice.turns`).

Ported from `app.voice.sarvam_stt` (now removed), restructured for Gnani's wire
contract documented at docs.gnani.ai/api/STT/stt-websocket.

- `parse_stt_event` turns raw events (discriminator key `type`) into typed `SttEvent`s.
- `FrameSplitter` buffers arbitrary-length b64 PCM into exact 1024-byte binary frames,
  carrying a remainder across `send_audio` calls (the browser sends 100 ms chunks,
  which is 3200 bytes at 16 kHz / 16-bit, not a multiple of 1024).
- `SttHandle.flush()` pads and sends any partial frame, then `{"type":"commit"}` for
  push-to-talk release.
- If the socket drops, the handle reconnects (a few attempts) and keeps about a second
  of frames so speech spoken during the reconnect is not lost.
"""

import asyncio
import base64
import contextlib
import json
import logging
from collections import deque
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

import websockets
from websockets.asyncio.client import ClientConnection

logger = logging.getLogger("swasthyagrid.voice")

GNANI_STT_WS_URL = "wss://api.vachana.ai/stt/v3/stream"

FRAME_BYTES = 1024  # exactly 512 samples of 16-bit mono PCM, 32 ms at 16 kHz
PREROLL_FRAMES = 32  # about 1 s at 1024 bytes / 32 ms per frame
MAX_RECONNECTS = 3
RECONNECT_DELAY_S = 0.3

OnEvent = Callable[[dict[str, Any]], Awaitable[None]]
Connect = Callable[[str, dict[str, str]], Awaitable[ClientConnection]]


@dataclass
class SttEvent:
    """kind: session_begin | vad_start | vad_end | final | error | other

    Gnani never sends partial transcripts; `final` is the only transcript kind."""

    kind: str
    text: str = ""
    language: str | None = None
    fatal: bool = False
    message: str | None = None
    raw: dict[str, Any] = field(default_factory=dict, repr=False)


_KINDS = {
    "connected": "session_begin",
    "speech_start": "vad_start",
    "processing": "vad_end",
    "transcript": "final",
    "error": "error",
}


def parse_stt_event(event: dict[str, Any]) -> SttEvent:
    kind = _KINDS.get(str(event.get("type")), "other")
    return SttEvent(
        kind=kind,
        text=str(event.get("text") or ""),
        language=event.get("detected_language_code"),
        fatal=False,  # Gnani's error frames carry no is_fatal flag; reconnect handles drops
        message=event.get("message"),
        raw=event,
    )


def stt_language(pref: str, model: str) -> str:
    """Gnani v2.5 takes exactly one language code; it has no "auto" language. hi-IN
    handles Hinglish code-switching well enough for a district officer's mixed speech.
    v3.0 (not the default here) accepts a comma-separated language_candidates list."""
    if pref in ("en-IN", "hi-IN"):
        return pref
    return "en-IN,hi-IN" if model == "prisma-v3.0" else "hi-IN"


def stt_headers(*, api_key: str, language: str, model: str, fmt: str, sample_rate: int = 16000) -> dict[str, str]:
    return {
        "x-api-key-id": api_key,
        "language_code": language,
        "model": model,
        "format": fmt,
        "x-sample-rate": str(sample_rate),
        "x-idle-timeout-sec": "900",
        "x-min-silence-ms": "500",
        "x-vad-threshold": "0.5",
    }


class FrameSplitter:
    """Buffers PCM bytes into exact `FRAME_BYTES`-sized frames, carrying any
    remainder across calls."""

    def __init__(self, frame_bytes: int = FRAME_BYTES):
        self._frame_bytes = frame_bytes
        self._carry = b""

    def feed(self, pcm: bytes) -> list[bytes]:
        buf = self._carry + pcm
        frames = []
        n = self._frame_bytes
        i = 0
        while i + n <= len(buf):
            frames.append(buf[i : i + n])
            i += n
        self._carry = buf[i:]
        return frames

    def pad_flush(self) -> bytes | None:
        """Zero-pad the remainder to one full frame and clear it. Returns None if
        there is no remainder."""
        if not self._carry:
            return None
        frame = self._carry + b"\x00" * (self._frame_bytes - len(self._carry))
        self._carry = b""
        return frame


async def _default_connect(url: str, headers: dict[str, str]) -> ClientConnection:
    return await websockets.connect(url, additional_headers=headers, max_size=None)


class SttHandle:
    def __init__(
        self,
        *,
        url: str,
        headers: dict[str, str],
        on_event: OnEvent,
        connect: Connect = _default_connect,
        on_failed: Callable[[], Awaitable[None]] | None = None,
        max_reconnects: int = MAX_RECONNECTS,
        reconnect_delay: float = RECONNECT_DELAY_S,
        preroll_frames: int = PREROLL_FRAMES,
    ):
        self._url = url
        self._headers = headers
        self._on_event = on_event
        self._connect = connect
        self._on_failed = on_failed
        self._max_reconnects = max_reconnects
        self._reconnect_delay = reconnect_delay
        self._splitter = FrameSplitter()
        self._preroll: deque[bytes] = deque(maxlen=preroll_frames)
        self._conn: ClientConnection | None = None
        self._recv_task: asyncio.Task | None = None
        self._reconnect_task: asyncio.Task | None = None
        self._closed = False
        self.failed = False
        self.reconnects = 0

    async def start(self) -> None:
        self._conn = await self._connect(self._url, self._headers)
        self._recv_task = asyncio.create_task(self._recv_loop(self._conn))

    @property
    def connected(self) -> bool:
        return self._conn is not None

    async def send_audio(self, b64_audio: str) -> None:
        if self.failed:
            raise ConnectionError("Gnani STT socket could not be re-established")
        pcm = base64.b64decode(b64_audio)
        frames = self._splitter.feed(pcm)
        conn = self._conn
        if conn is not None:
            try:
                for frame in frames:
                    await conn.send(frame)
                return
            except Exception:
                logger.debug("STT send failed, reconnecting", exc_info=True)
                self._begin_reconnect(conn)
        for frame in frames:
            self._preroll.append(frame)  # deque(maxlen) drops the oldest frame

    async def flush(self) -> None:
        """End of a hold-to-talk utterance: pad and send any partial frame, then
        ask Prisma to finalise now."""
        conn = self._conn
        if conn is None:
            return
        try:
            frame = self._splitter.pad_flush()
            if frame is not None:
                await conn.send(frame)
            await conn.send(json.dumps({"type": "commit"}))
        except Exception:
            logger.debug("STT flush failed", exc_info=True)

    async def end(self) -> None:
        self._closed = True
        conn, self._conn = self._conn, None
        for task in (self._recv_task, self._reconnect_task):
            if task is not None and task is not asyncio.current_task():
                task.cancel()
        if conn is not None:
            with contextlib.suppress(Exception):
                await conn.close()

    # -------------------------------------------------------------- internals

    async def _recv_loop(self, conn: ClientConnection) -> None:
        try:
            async for raw in conn:
                if isinstance(raw, bytes):
                    continue  # Gnani's STT socket sends only JSON text frames
                try:
                    event = json.loads(raw)
                except (ValueError, TypeError):
                    continue
                await self._on_event(event)
        except websockets.ConnectionClosed:
            pass
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Gnani STT receive loop failed")
        if not self._closed:
            self._begin_reconnect(conn)

    def _begin_reconnect(self, dead: ClientConnection) -> None:
        if self._closed or self.failed:
            return
        if self._conn is dead:
            self._conn = None
        if self._reconnect_task is None or self._reconnect_task.done():
            self._reconnect_task = asyncio.create_task(self._reconnect())

    async def _reconnect(self) -> None:
        for attempt in range(1, self._max_reconnects + 1):
            await asyncio.sleep(self._reconnect_delay * attempt)
            if self._closed:
                return
            try:
                conn = await self._connect(self._url, self._headers)
            except Exception:
                logger.warning("STT reconnect attempt %d failed", attempt, exc_info=True)
                continue
            try:
                while self._preroll:
                    frame = self._preroll.popleft()
                    await conn.send(frame)
            except Exception:
                logger.warning("STT preroll replay failed", exc_info=True)
                with contextlib.suppress(Exception):
                    await conn.close()
                continue
            self._conn = conn
            self._recv_task = asyncio.create_task(self._recv_loop(conn))
            self.reconnects += 1
            return
        self.failed = True
        if self._on_failed is not None:
            await self._on_failed()


async def open_stt_socket(
    *,
    api_key: str,
    language: str,
    model: str,
    fmt: str,
    on_event: OnEvent,
    url: str = GNANI_STT_WS_URL,
    connect: Connect = _default_connect,
    on_failed: Callable[[], Awaitable[None]] | None = None,
    max_reconnects: int = MAX_RECONNECTS,
    reconnect_delay: float = RECONNECT_DELAY_S,
) -> SttHandle:
    headers = stt_headers(api_key=api_key, language=stt_language(language, model), model=model, fmt=fmt)
    handle = SttHandle(
        url=url,
        headers=headers,
        on_event=on_event,
        connect=connect,
        on_failed=on_failed,
        max_reconnects=max_reconnects,
        reconnect_delay=reconnect_delay,
    )
    await handle.start()
    return handle
