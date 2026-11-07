"""STT additions against a fake Gnani Prisma websocket server (no live calls)."""

import asyncio
import base64
import json

import pytest
from websockets.asyncio.server import serve

from app.voice import gnani_stt

PCM_1024 = b"\x01\x00" * 512  # exactly one 1024-byte frame


@pytest.fixture
def anyio_backend():
    return "asyncio"


class FakeStt:
    """Records client messages per connection (binary frames and JSON text
    messages). `drop_first_after` closes the first connection after that many
    binary frames."""

    def __init__(self, replay_events: list[dict] | None = None, drop_first_after: int | None = None):
        self.connections: list[list] = []
        self.headers: list[dict] = []
        self.replay = replay_events or []
        self.drop_first_after = drop_first_after
        self._server = None
        self.url = ""

    async def _handler(self, ws):
        msgs: list = []
        idx = len(self.connections)
        self.connections.append(msgs)
        self.headers.append(dict(ws.request.headers))
        frame_count = 0
        async for raw in ws:
            if isinstance(raw, bytes):
                msgs.append(("frame", raw))
                frame_count += 1
            else:
                msg = json.loads(raw)
                msgs.append(("text", msg))
                if msg.get("type") == "commit":
                    for ev in self.replay:
                        await ws.send(json.dumps(ev))
            if idx == 0 and self.drop_first_after is not None and frame_count >= self.drop_first_after:
                await ws.close(code=1011)
                return

    async def __aenter__(self):
        self._server = await serve(self._handler, "127.0.0.1", 0)
        self.url = f"ws://127.0.0.1:{self._server.sockets[0].getsockname()[1]}/stt/v3/stream"
        return self

    async def __aexit__(self, *exc):
        self._server.close()
        await self._server.wait_closed()


def _fixture_events() -> list[dict]:
    return [
        {"type": "connected", "message": "ready"},
        {"type": "speech_start"},
        {"type": "processing"},
        {
            "type": "transcript",
            "text": "Kota mein kitni facilities critical hain?",
            "detected_language_code": "en-IN",
            "segment_index": 1,
            "is_final": True,
        },
    ]


# ------------------------------------------------------------------ pure helpers


def test_stt_language_maps_auto_to_hi_for_v2_5():
    assert gnani_stt.stt_language("auto", "prisma-v2.5") == "hi-IN"
    assert gnani_stt.stt_language("en-IN", "prisma-v2.5") == "en-IN"
    assert gnani_stt.stt_language("hi-IN", "prisma-v2.5") == "hi-IN"


def test_stt_language_auto_for_v3_gives_candidate_list():
    assert gnani_stt.stt_language("auto", "prisma-v3.0") == "en-IN,hi-IN"


def test_stt_headers_contain_required_fields():
    headers = gnani_stt.stt_headers(api_key="k", language="hi-IN", model="prisma-v2.5", fmt="transcribe")
    assert headers["x-api-key-id"] == "k"
    assert headers["language_code"] == "hi-IN"
    assert headers["model"] == "prisma-v2.5"
    assert headers["format"] == "transcribe"
    assert headers["x-sample-rate"] == "16000"


def test_frame_splitter_splits_exact_1024_byte_frames():
    splitter = gnani_stt.FrameSplitter()
    frames = splitter.feed(PCM_1024 * 3)
    assert len(frames) == 3
    assert all(len(f) == 1024 for f in frames)
    assert splitter.pad_flush() is None


def test_frame_splitter_carries_remainder_across_calls():
    splitter = gnani_stt.FrameSplitter()
    # 3200 bytes (a 100ms browser chunk at 16kHz/16-bit) is 3 frames + 128 bytes.
    chunk = b"\x02\x00" * 1600
    assert len(chunk) == 3200
    frames = splitter.feed(chunk)
    assert len(frames) == 3
    remainder = splitter.pad_flush()
    assert remainder is not None
    assert len(remainder) == 1024
    assert remainder[:128] == chunk[3072:]
    assert remainder[128:] == b"\x00" * (1024 - 128)


def test_parse_stt_event_kinds():
    events = [gnani_stt.parse_stt_event(e) for e in _fixture_events()]
    kinds = [e.kind for e in events]
    assert kinds == ["session_begin", "vad_start", "vad_end", "final"]
    final = events[-1]
    assert final.text == "Kota mein kitni facilities critical hain?"
    assert final.language == "en-IN"


def test_parse_stt_event_error_and_unknown():
    err = gnani_stt.parse_stt_event({"type": "error", "message": "boom"})
    assert err.kind == "error" and err.message == "boom"
    assert gnani_stt.parse_stt_event({"type": "settings_updated"}).kind == "other"


# ------------------------------------------------------------------ socket behaviour


@pytest.mark.anyio
async def test_handshake_headers_and_binary_frames_sent():
    received: list[dict] = []

    async def on_event(e):
        received.append(e)

    events = _fixture_events()
    async with FakeStt(replay_events=events) as srv:
        handle = await gnani_stt.open_stt_socket(
            api_key="test-key", language="auto", model="prisma-v2.5", fmt="transcribe",
            on_event=on_event, url=srv.url,
        )  # fmt: skip
        b64 = base64.b64encode(PCM_1024 * 3 + b"\x03\x00" * 64).decode()  # 3 full frames + 128-byte remainder
        await handle.send_audio(b64)
        await handle.flush()
        for _ in range(50):
            if len(received) >= len(events):
                break
            await asyncio.sleep(0.02)
        await handle.end()
        await asyncio.sleep(0.05)

    headers = srv.headers[0]
    assert headers.get("x-api-key-id") == "test-key"
    assert headers.get("language_code") == "hi-IN"  # "auto" maps to hi-IN for prisma-v2.5
    assert headers.get("model") == "prisma-v2.5"
    assert headers.get("format") == "transcribe"
    assert headers.get("x-sample-rate") == "16000"

    msgs = srv.connections[0]
    frame_msgs = [m for kind, m in msgs if kind == "frame"]
    text_msgs = [m for kind, m in msgs if kind == "text"]
    # 3 full frames sent immediately, then a padded remainder frame from flush().
    assert len(frame_msgs) == 4
    assert all(len(f) == 1024 for f in frame_msgs)
    assert text_msgs[0] == {"type": "commit"}
    assert [e["type"] for e in received] == [e["type"] for e in events]


@pytest.mark.anyio
async def test_reconnect_replays_preroll_frames():
    async def on_event(_e):
        pass

    async with FakeStt(drop_first_after=1) as srv:
        handle = await gnani_stt.open_stt_socket(
            api_key="k", language="en-IN", model="prisma-v2.5", fmt="verbatim",
            on_event=on_event, url=srv.url, reconnect_delay=0.1,
        )  # fmt: skip
        first_frame = PCM_1024
        await handle.send_audio(base64.b64encode(first_frame).decode())
        await asyncio.sleep(0.1)  # server drops the socket, client notices
        assert not handle.connected
        second_frame = b"\x05\x00" * 512
        await handle.send_audio(base64.b64encode(second_frame).decode())
        for _ in range(100):
            if handle.connected and len(srv.connections) > 1:
                break
            await asyncio.sleep(0.05)
        await asyncio.sleep(0.1)
        assert handle.reconnects == 1
        await handle.end()

    replayed = [m for kind, m in srv.connections[1] if kind == "frame"]
    assert replayed == [second_frame]


@pytest.mark.anyio
async def test_reconnect_failure_calls_on_failed_and_send_raises():
    failed = asyncio.Event()

    async def on_failed():
        failed.set()

    async def on_event(_e):
        pass

    calls = {"n": 0}
    async with FakeStt(drop_first_after=1) as srv:
        real = gnani_stt._default_connect

        async def flaky(url, headers):
            calls["n"] += 1
            if calls["n"] == 1:
                return await real(url, headers)
            raise OSError("refused")

        handle = await gnani_stt.open_stt_socket(
            api_key="k", language="en-IN", model="prisma-v2.5", fmt="verbatim", on_event=on_event,
            url=srv.url, connect=flaky, on_failed=on_failed, max_reconnects=2, reconnect_delay=0.02,
        )  # fmt: skip
        await handle.send_audio(base64.b64encode(PCM_1024).decode())
        await asyncio.wait_for(failed.wait(), 3)
        assert handle.failed
        with pytest.raises(ConnectionError):
            await handle.send_audio(base64.b64encode(PCM_1024).decode())
        await handle.end()
    assert calls["n"] == 3  # initial connect plus two failed retries
