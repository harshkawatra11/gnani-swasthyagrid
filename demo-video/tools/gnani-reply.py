import asyncio
import base64
import re
import sys
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
DEMO = HERE.parent
BACKEND = DEMO.parent / "backend"
sys.path.insert(0, str(BACKEND))

from app.core.config import get_settings  # noqa: E402
from app.voice.gnani_tts import synthesize  # noqa: E402


async def main() -> None:
    s = get_settings()
    text = (DEMO / "capture/raw/S11/reply.txt").read_text(encoding="utf-8").strip()
    # Drop a leading UI trace label (e.g. "Checking Kota district data") that sometimes
    # gets captured alongside the reply text, and stop before any appended fact card block.
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    lines = [ln for ln in lines if not re.match(r"^(Checking|Looking|Scanning|Comparing|Reviewing|Tracking)\b.*data$", ln)]
    text = " ".join(lines)
    text = re.split(r"\b(DISTRICT SUMMARY|FACILITY|SHORTAGES|RANKING|SHIPMENTS?|FLEET)\b", text)[0].strip()
    parts = [p.strip() for p in re.split(r"(?<=[।.!?])\s+", text) if p.strip()]
    chosen = ""
    for p in parts:
        if len(chosen) + len(p) + 1 > 150:
            break
        chosen = (chosen + " " + p).strip()
    chosen = chosen or text[:150]
    res = await synthesize(
        api_key=s.gnani_api_key,
        text=chosen,
        voice=s.gnani_tts_voice_hi,
        model=s.gnani_tts_model,
        language="hi-IN",
    )
    out = DEMO / "audio/voice"
    out.mkdir(parents=True, exist_ok=True)
    (out / "reply-raw.wav").write_bytes(base64.b64decode(res.wav_base64))
    (out / "reply.txt").write_text(chosen, encoding="utf-8")
    print("synthesized", len(chosen), "chars:", chosen)


asyncio.run(main())
