"""One-off contract probes against the live Gnani Vachana API, and optionally the
configured LLM providers (budget: a handful of calls).

Run from backend/:

    python scripts/probe_gnani.py            # TTS REST + concurrency + TTS WS + STT WS + STT REST
    python scripts/probe_gnani.py --llm       # also probe every configured LLM provider

Output (audio clips, event logs) is written under backend/.runtime/probe/, which is
gitignored. The API key is read from settings and never printed.
"""

import asyncio
import base64
import json
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings
from app.llm.router import build_providers
from app.voice import gnani_stt, gnani_tts
from app.voice.wav import parse_wav_header

OUT = Path(__file__).resolve().parents[1] / ".runtime" / "probe"
GREETING = {
    "en-IN": "Hello. I am Swasthya, the control room voice analyst.",
    "hi-IN": "नमस्ते। मैं SwasthyaGrid control room में आपकी मदद के लिए हूँ।",
}
VOICES = [("Kaveri", "en-IN"), ("Nalini", "hi-IN"), ("Poorvi", "hi-en"), ("Poorvi", "en-IN")]


def _settings():
    s = get_settings()
    if not s.gnani_api_key:
        sys.exit("GNANI_API_KEY is not set (backend/.env)")
    return s


def _write(name: str, data: bytes) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    path.write_bytes(data)
    return path


async def probe_tts_rest() -> None:
    print("\n== TTS REST ==")
    s = _settings()
    for voice, lang in VOICES:
        text = GREETING.get(lang, GREETING["en-IN"])
        t0 = time.monotonic()
        try:
            res = await gnani_tts.synthesize(
                api_key=s.gnani_api_key, text=text, voice=voice, model=s.gnani_tts_model,
                language=lang, sample_rate=24000,
            )
            ms = round((time.monotonic() - t0) * 1000)
            wav = base64.b64decode(res.wav_base64)
            path = _write(f"tts_{voice}_{lang}.wav", wav)
            print(f"  {voice}/{lang}: 200, {ms}ms, {len(wav)} bytes, sample_rate={res.sample_rate_hz} -> {path.name}")
        except Exception as exc:
            print(f"  {voice}/{lang}: FAILED {exc}")

    # Also save 16kHz clips to feed the STT probes below.
    for lang, name in (("hi-IN", "stt_input_hi.wav"), ("en-IN", "stt_input_en.wav")):
        try:
            res = await gnani_tts.synthesize(
                api_key=s.gnani_api_key, text=GREETING[lang], voice="Nalini" if lang == "hi-IN" else "Kaveri",
                model=s.gnani_tts_model, language=lang, sample_rate=16000,
            )
            _write(name, base64.b64decode(res.wav_base64))
            print(f"  saved {name} for the STT probes")
        except Exception as exc:
            print(f"  could not prepare {name}: {exc}")


async def probe_tts_concurrency() -> None:
    print("\n== TTS REST concurrency (two requests at once) ==")
    s = _settings()

    async def one(tag: str):
        try:
            await gnani_tts.synthesize(
                api_key=s.gnani_api_key, text=f"Concurrency probe {tag}.", voice="Kaveri",
                model=s.gnani_tts_model, language="en-IN", attempts=1,
            )
            return f"{tag}: 200"
        except gnani_tts.GnaniTTSError as exc:
            return f"{tag}: {exc.status_code}"
        except Exception as exc:
            return f"{tag}: ERROR {exc}"

    results = await asyncio.gather(one("A"), one("B"))
    for r in results:
        print(f"  {r}")


async def probe_tts_ws() -> None:
    print("\n== TTS WebSocket ==")
    s = _settings()
    chunks: list[tuple[int, bool]] = []
    first_audio_at: list[float] = []
    start = time.monotonic()

    async def on_audio(chunk):
        if not first_audio_at:
            first_audio_at.append(time.monotonic() - start)
        chunks.append((len(base64.b64decode(chunk.b64)), chunk.b64[:4] == "UklG"))  # "UklG" = base64 of "RIFF"

    stream = gnani_tts.TtsStream(
        api_key=s.gnani_api_key, model=s.gnani_tts_model,
        voices={"en-IN": "Kaveri", "hi-IN": "Nalini"}, sample_rate=24000,
    )
    try:
        await stream.begin_turn("en-IN", on_audio)
        await stream.say("First sentence for the websocket probe.")
        await stream.say("Second sentence, sent right after.")
        await stream.end_turn()
        total_bytes = sum(n for n, _ in chunks)
        starts_with_riff = any(is_riff for _, is_riff in chunks)
        print(f"  mode after turn: {stream.mode}")
        print(f"  chunks: {len(chunks)}, total_bytes: {total_bytes}, any RIFF-prefixed: {starts_with_riff}")
        print(f"  time to first audio: {round(first_audio_at[0] * 1000) if first_audio_at else 'n/a'}ms")
        print(f"  all even byte lengths: {all(n % 2 == 0 for n, _ in chunks)}")
    except Exception as exc:
        print(f"  FAILED: {exc}")
    finally:
        await stream.close()


async def probe_stt_ws() -> None:
    print("\n== STT WebSocket ==")
    s = _settings()
    for lang, fname in (("hi-IN", "stt_input_hi.wav"), ("en-IN", "stt_input_en.wav")):
        path = OUT / fname
        if not path.exists():
            print(f"  skipping {lang}: run probe_tts_rest() first to create {fname}")
            continue
        wav = parse_wav_header(path.read_bytes())
        events: list[dict] = []

        async def on_event(e, _events=events):  # bind the per-iteration list explicitly
            _events.append(e)
            print(f"    event: {json.dumps({k: v for k, v in e.items() if k != 'raw'})[:200]}")

        try:
            handle = await gnani_stt.open_stt_socket(
                api_key=s.gnani_api_key, language=lang, model=s.gnani_stt_model,
                fmt=s.gnani_stt_format, on_event=on_event,
            )
            print(f"  {lang}: connected, streaming {len(wav.pcm)} bytes of PCM")
            pcm = wav.pcm
            step = 1024
            for i in range(0, len(pcm), step):
                await handle.send_audio(base64.b64encode(pcm[i : i + step]).decode())
                await asyncio.sleep(0.032)
            for _ in range(47):  # ~1.5s of silence
                await handle.send_audio(base64.b64encode(b"\x00" * step).decode())
                await asyncio.sleep(0.032)
            await handle.flush()
            await asyncio.sleep(5)
            await handle.end()
            print(f"  {lang}: {len(events)} events received")
        except Exception as exc:
            print(f"  {lang}: FAILED {exc}")


async def probe_stt_rest() -> None:
    print("\n== STT REST (sanity) ==")
    s = _settings()
    path = OUT / "stt_input_en.wav"
    if not path.exists():
        print("  skipping: run probe_tts_rest() first to create stt_input_en.wav")
        return
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                "https://api.vachana.ai/stt/v3",
                headers={"X-API-Key-ID": s.gnani_api_key},
                files={"audio_file": ("clip.wav", path.read_bytes(), "audio/wav")},
                data={"language_code": "en-IN"},
            )
        print(f"  status={res.status_code}")
        if res.status_code == 200:
            print(f"  transcript={res.json().get('transcript')!r}")
        else:
            print(f"  body={res.text[:300]}")
    except Exception as exc:
        print(f"  FAILED: {exc}")


async def probe_llm() -> None:
    print("\n== LLM providers ==")
    s = get_settings()
    providers = build_providers(s)
    if not providers:
        print("  no LLM provider configured (set EVON_BASE_URL or GEMINI_API_KEY)")
        return
    from app.llm.client import chat_completion, stream_chat
    from app.tools.schemas import TOOL_SCHEMAS

    for p in providers:
        print(f"  -- {p.label} ({p.model}) --")
        prompt = "What is the stock situation in Kota district? Use a tool."
        try:
            t0 = time.monotonic()
            calls = []
            async for delta in stream_chat(
                provider=p, messages=[{"role": "user", "content": prompt}],
                tools=[TOOL_SCHEMAS[0]], tool_choice="auto",
            ):
                if delta.tool_calls:
                    calls.extend(delta.tool_calls)
            print(f"    tool call after {round((time.monotonic() - t0) * 1000)}ms: {calls}")
            if calls:
                follow_up = [
                    {"role": "user", "content": prompt},
                    {"role": "assistant", "tool_calls": calls},
                    {"role": "tool", "tool_call_id": calls[0].get("id", "call_1"), "content": '{"district": "Kota", "critical": 2}'},
                ]
                t1 = time.monotonic()
                text = ""
                async for delta in stream_chat(provider=p, messages=follow_up, tool_choice="none"):
                    if delta.content:
                        if not text:
                            print(f"    first answer token after {round((time.monotonic() - t1) * 1000)}ms")
                        text += delta.content
                print(f"    answer: {text[:200]!r}")
        except Exception as exc:
            print(f"    FAILED: {exc}")

        if p.name == "gemini":
            print("    trying lower reasoning_effort values for Gemini...")
            for effort in ("none", "minimal", "low"):
                try:
                    from dataclasses import replace

                    p2 = replace(p, extra_body={**p.extra_body, "reasoning_effort": effort})
                    res = await chat_completion(provider=p2, messages=[{"role": "user", "content": "Say OK."}], tools=[])
                    print(f"      reasoning_effort={effort}: 200, content={res.content!r}")
                except Exception as exc:
                    print(f"      reasoning_effort={effort}: FAILED {exc}")


async def main() -> None:
    await probe_tts_rest()
    await probe_tts_concurrency()
    await probe_tts_ws()
    await probe_stt_ws()
    await probe_stt_rest()
    if "--llm" in sys.argv:
        await probe_llm()
    print(f"\nAll probe output saved under {OUT}")


if __name__ == "__main__":
    asyncio.run(main())
