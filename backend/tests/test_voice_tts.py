"""Gnani Timbre TTS: the streaming adapter against a fake websocket server, the
REST body/retries, and the filler cache. No live calls."""

import asyncio
import base64
import json
import struct

import httpx
import pytest
from websockets.asyncio.server import serve

from app.voice import fillers, gnani_tts
from app.voice.gnani_tts import AudioChunk, GnaniTTSError, TtsStream

PCM = b"\x01\x00" * 480  # even-length PCM


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _wav(rate: int = 24000) -> bytes:
    pcm = b"\x00\x00" * 100
    fmt = struct.pack("<HHIIHH", 1, 1, rate, rate * 2, 2, 16)
    body = b"WAVE" + b"fmt " + struct.pack("<I", len(fmt)) + fmt + b"data" + struct.pack("<I", len(pcm)) + pcm
    return b"RIFF" + struct.pack("<I", len(body)) + body


class FakeServer:
    """Echoes one audio message + complete per text request. Only one request
    may be in flight: `requests_overlap` is set True if a second request body
    arrives before the first one's `complete` has been sent."""

    def __init__(self, fail_after_requests: int | None = None, split_chunk: bool = False):
        self.connections = 0
        self.bodies: list[dict] = []
        self.headers: list[str | None] = []
        self.fail_after_requests = fail_after_requests
        self.split_chunk = split_chunk
        self.requests_overlap = False
        self._busy = False
        self._server = None
        self.url = ""

    async def _handler(self, ws):
        self.connections += 1
        self.headers.append(ws.request.headers.get("X-API-Key-ID"))
        n = 0
        async for raw in ws:
            if self._busy:
                self.requests_overlap = True
            self._busy = True
            msg = json.loads(raw)
            self.bodies.append(msg)
            n += 1
            if self.fail_after_requests is not None and n > self.fail_after_requests:
                await ws.close(code=1011)
                return
            if self.split_chunk:
                await ws.send(PCM[:3])  # odd-length raw binary frame
                await ws.send(json.dumps({"type": "audio", "data": {"audio": base64.b64encode(PCM[3:]).decode(), "is_final": True}}))
            else:
                await ws.send(json.dumps({"type": "audio", "data": {"audio": base64.b64encode(PCM).decode(), "is_final": False}}))
                await ws.send(json.dumps({"type": "complete", "data": {"is_final": True}}))
            self._busy = False

    async def __aenter__(self):
        self._server = await serve(self._handler, "127.0.0.1", 0)
        port = self._server.sockets[0].getsockname()[1]
        self.url = f"ws://127.0.0.1:{port}/api/v1/tts"
        return self

    async def __aexit__(self, *exc):
        self._server.close()
        await self._server.wait_closed()


class Collector:
    def __init__(self):
        self.chunks: list[AudioChunk] = []

    async def __call__(self, chunk: AudioChunk):
        self.chunks.append(chunk)


def _fake_rest(calls: list):
    async def synth(*, api_key, text, voice, model, language, sample_rate=24000, speed=1.0, url=None):
        calls.append((text, language))
        return gnani_tts.WavSynthesis(base64.b64encode(_wav()).decode(), 24000)

    return synth


def _stream(server_url: str, **kw) -> TtsStream:
    kw.setdefault("rest_synthesize", _fake_rest([]))
    voices = kw.pop("voices", {"en-IN": "Kaveri", "hi-IN": "Nalini"})
    return TtsStream(api_key="test-key", model="timbre-v2.5", voices=voices, ws_url=server_url, **kw)


# ------------------------------------------------------------------ pure helpers


def test_tts_language_maps_auto_to_hi():
    assert gnani_tts.tts_language("auto") == "hi-IN"
    assert gnani_tts.tts_language(None) == "hi-IN"
    assert gnani_tts.tts_language("en-IN") == "en-IN"


def test_request_body_shape():
    body = gnani_tts.request_body(text="hi", model="timbre-v2.5", voice="Kaveri", language="en-IN", sample_rate=24000, speed=1.0, container="raw")
    assert body["model"] == "timbre-v2.5"
    assert body["voice"] == "Kaveri"
    assert body["language"] == "en-IN"
    assert body["audio_config"]["container"] == "raw"
    assert body["audio_config"]["encoding"] == "linear_pcm"


def test_voice_for_falls_back_to_hi_in_then_any():
    stream = TtsStream(api_key="k", model="timbre-v2.5", voices={"en-IN": "Kaveri", "hi-IN": "Nalini"})
    assert stream.voice_for("en-IN") == "Kaveri"
    assert stream.voice_for("auto") == "Nalini"
    assert stream.voice_for("ta-IN") == "Nalini"  # falls back to hi-IN
    stream2 = TtsStream(api_key="k", model="timbre-v2.5", voices={"ta-IN": "Asmita"})
    assert stream2.voice_for("en-IN") == "Asmita"  # falls back to any voice


# ------------------------------------------------------------------ streaming


@pytest.mark.anyio
async def test_ws_turn_streams_pcm_chunks_one_request_at_a_time():
    async with FakeServer() as srv:
        tts = _stream(srv.url)
        out = Collector()
        await tts.begin_turn("en-IN", out)
        await tts.say("Kota has two critical facilities.")
        await tts.say("PHC Kota-4 is worst.")
        await tts.end_turn()
        await tts.close()
    assert [c.seq for c in out.chunks] == [0, 1]
    assert all(c.encoding == "pcm_s16le" and c.sample_rate_hz == 24000 for c in out.chunks)
    assert base64.b64decode(out.chunks[0].b64) == PCM
    assert not srv.requests_overlap
    assert [b["text"] for b in srv.bodies] == ["Kota has two critical facilities.", "PHC Kota-4 is worst."]
    assert srv.bodies[0]["voice"] == "Kaveri"
    assert srv.headers == ["test-key"]


@pytest.mark.anyio
async def test_odd_length_chunk_carries_remainder_across_messages():
    async with FakeServer(split_chunk=True) as srv:
        tts = _stream(srv.url)
        out = Collector()
        await tts.begin_turn("en-IN", out)
        await tts.say("One sentence.")
        await tts.end_turn()
        await tts.close()
    assert b"".join(base64.b64decode(c.b64) for c in out.chunks) == PCM[:3] + PCM[3:]


@pytest.mark.anyio
async def test_cancel_turn_closes_socket_and_next_turn_reconnects():
    async with FakeServer() as srv:
        tts = _stream(srv.url)
        out = Collector()
        await tts.begin_turn("en-IN", out)
        await tts.say("First sentence.")
        await asyncio.sleep(0.05)
        await tts.cancel_turn()
        assert tts._conn is None
        out2 = Collector()
        await tts.begin_turn("en-IN", out2)
        await tts.say("Second.")
        await tts.end_turn()
        await tts.close()
    assert len(out2.chunks) == 1


@pytest.mark.anyio
async def test_socket_error_mid_turn_falls_back_to_rest_and_sticks_for_cooldown():
    now = [1000.0]
    rest_calls: list = []
    async with FakeServer(fail_after_requests=1) as srv:
        tts = _stream(srv.url, clock=lambda: now[0], rest_synthesize=_fake_rest(rest_calls))
        out = Collector()
        await tts.begin_turn("en-IN", out)
        await tts.say("First sentence goes out fine.")
        await tts.say("Second sentence kills the socket.")
        await tts.say("Third is already REST.")
        await tts.end_turn()
        assert tts.mode == "rest"
        encodings = [c.encoding for c in out.chunks]
        assert encodings[0] == "pcm_s16le"
        assert "wav" in encodings
        assert rest_calls and rest_calls[-1][0] == "Third is already REST."

        out2 = Collector()
        await tts.begin_turn("en-IN", out2)
        await tts.say("Later turn.")
        await tts.end_turn()
        assert [c.encoding for c in out2.chunks] == ["wav"]

        now[0] += 301  # past the cooldown
        assert tts.mode == "ws"
        await tts.close()


@pytest.mark.anyio
async def test_tts_error_message_falls_back_to_rest():
    rest_calls: list = []

    async def handler(ws):
        async for raw in ws:
            await ws.send(json.dumps({"type": "error", "message": "Invalid text or audio configuration."}))
            return

    server = await serve(handler, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    url = f"ws://127.0.0.1:{port}/api/v1/tts"
    try:
        tts = TtsStream(api_key="k", model="timbre-v2.5", voices={"en-IN": "Kaveri"}, ws_url=url, rest_synthesize=_fake_rest(rest_calls))
        out = Collector()
        await tts.begin_turn("en-IN", out)
        await tts.say("Bad request.")
        await tts.end_turn()
        await tts.close()
    finally:
        server.close()
        await server.wait_closed()
    assert tts.mode == "rest"
    # The sentence that triggered the error is retried over REST so the officer still hears it.
    assert rest_calls == [("Bad request.", "en-IN")]


@pytest.mark.anyio
async def test_connect_failure_uses_rest():
    rest_calls: list = []
    tts = TtsStream(
        api_key="k", model="timbre-v2.5", voices={"hi-IN": "Nalini"}, ws_url="ws://127.0.0.1:1/x",
        rest_synthesize=_fake_rest(rest_calls),
    )
    out = Collector()
    await tts.begin_turn("hi-IN", out)
    await tts.say("नमस्ते।")
    await tts.end_turn()
    assert tts.mode == "rest"
    assert rest_calls == [("नमस्ते।", "hi-IN")]
    assert [c.encoding for c in out.chunks] == ["wav"]


@pytest.mark.anyio
async def test_configured_rest_mode_never_opens_a_socket():
    rest_calls: list = []
    tts = TtsStream(
        api_key="k", model="timbre-v2.5", voices={"hi-IN": "Nalini"}, mode="rest", ws_url="ws://127.0.0.1:1/x",
        rest_synthesize=_fake_rest(rest_calls),
    )
    out = Collector()
    await tts.begin_turn("auto", out)
    await tts.say("One.")
    await tts.say("Two.")
    await tts.end_turn()
    assert [c[0] for c in rest_calls] == ["One.", "Two."]
    assert rest_calls[0][1] == "hi-IN"  # begin_turn normalizes "auto" once, up front
    assert [c.seq for c in out.chunks] == [0, 1]


# ------------------------------------------------------------------ REST


@pytest.mark.anyio
async def test_rest_returns_raw_bytes_and_parses_sample_rate():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=_wav(24000), headers={"content-type": "audio/wav"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        res = await gnani_tts.synthesize(api_key="k", text="Hello", voice="Kaveri", model="timbre-v2.5", language="en-IN", client=client)
    assert res.sample_rate_hz == 24000


@pytest.mark.anyio
async def test_rest_retries_429_then_succeeds():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(429, text="rate limited")
        return httpx.Response(200, content=_wav(24000))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        res = await gnani_tts.synthesize(
            api_key="k", text="Hello", voice="Kaveri", model="timbre-v2.5", language="en-IN", client=client,
        )
    assert calls["n"] == 2
    assert res.sample_rate_hz == 24000


@pytest.mark.anyio
async def test_rest_raises_on_non_retryable_error():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, text='{"success":false,"message":"bad voice"}')

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(GnaniTTSError) as exc_info:
            await gnani_tts.synthesize(api_key="k", text="Hello", voice="Bad", model="timbre-v2.5", language="en-IN", client=client)
    assert exc_info.value.status_code == 400


# ------------------------------------------------------------------ fillers


@pytest.mark.anyio
async def test_fillers_are_synthesized_once_per_voice_and_language(monkeypatch):
    fillers.clear_cache()
    calls: list = []

    async def fake(*, api_key, text, voice, model, language):
        calls.append((text, voice, language))
        return gnani_tts.WavSynthesis("AAAA", 24000)

    monkeypatch.setattr(gnani_tts, "synthesize", fake)
    kw = {"api_key": "k", "voice": "Kaveri", "model": "timbre-v2.5"}
    a, b, _ = await asyncio.gather(
        fillers.get_filler(language="en-IN", **kw),
        fillers.get_filler(language="en-IN", **kw),
        fillers.get_filler(language="hi-IN", **kw),
    )
    await fillers.get_filler(language="en-IN", **kw)
    assert a is b
    assert len(calls) == 2
    assert calls[0][0] == "One moment, checking the data."
    assert ("एक सेकंड, data देख रही हूँ।", "Kaveri", "hi-IN") in calls
    fillers.clear_cache()
