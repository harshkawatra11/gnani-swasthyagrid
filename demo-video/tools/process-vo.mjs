import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const scenes = JSON.parse(fs.readFileSync(path.join(ROOT, "script/scenes.json"), "utf8"));
const rawDir = path.join(ROOT, "vo/raw");
const cleanDir = path.join(ROOT, "vo/clean");
fs.mkdirSync(cleanDir, { recursive: true });

const probe = (f) =>
  parseFloat(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim()
  );

const timings = {};
const problems = [];

const statePath = path.join(ROOT, "capture/state.json");
const RISK_IMPROVES = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")).RISK_IMPROVES : null;
const skipId = RISK_IMPROVES === true ? "S13alt" : RISK_IMPROVES === false ? "S13" : null;

for (const id of Object.keys(scenes.vo)) {
  if (id === skipId) continue;
  const src = fs.readdirSync(rawDir).find((f) => f.replace(/\.[^.]+$/, "") === id && !f.endsWith(".json"));
  if (!src) {
    if ((id === "S13" || id === "S13alt") && skipId === null) continue; // rehearsal not run yet, tolerate either
    problems.push(`missing recording ${id}`);
    continue;
  }
  const out = path.join(cleanDir, `${id}.wav`);
  const af = [
    "highpass=f=80",
    "afftdn=nf=-25",
    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05",
    "areverse",
    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08",
    "areverse",
    "acompressor=threshold=-20dB:ratio=3:attack=10:release=150:makeup=2",
    "loudnorm=I=-16:TP=-1.5:LRA=7",
  ].join(",");
  execFileSync("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-i",
    path.join(rawDir, src),
    "-af",
    af,
    "-ar",
    "48000",
    "-ac",
    "1",
    "-c:a",
    "pcm_s24le",
    out,
  ]);
  let d = probe(out);
  const max = scenes.maxSec[id];
  if (d > max) {
    const ratio = d / max;
    if (ratio <= 1.06) {
      const tmp = out.replace(".wav", ".tmp.wav");
      execFileSync("ffmpeg", ["-y", "-v", "error", "-i", out, "-af", `atempo=${ratio.toFixed(4)}`, "-c:a", "pcm_s24le", tmp]);
      fs.renameSync(tmp, out);
      d = probe(out);
      console.log(`${id}: sped up x${ratio.toFixed(3)} to fit ${max}s`);
    } else {
      problems.push(`${id}: ${d.toFixed(2)}s is over the ${max}s limit by more than 6 percent, re-record faster`);
    }
  }
  timings[id] = +d.toFixed(3);
}

fs.writeFileSync(path.join(ROOT, "vo/timings.json"), JSON.stringify(timings, null, 2));

const lead = scenes.leadSec;
const tail = scenes.tailSec;
const T = (id) => +(lead + (timings[id] ?? scenes.maxSec[id]) + tail).toFixed(3);

const durations = {
  S02: T("S02"),
  S03: T("S03"),
  S04: T("S04"),
  S06: T("S06"),
  S07: T("S07"),
  S08: T("S08"),
  S09: T("S09"),
  S11: 34, // capture length; the edit length is computed later from the voice reply time
  S12: T("S12"),
  S13: +(lead + Math.max(timings.S13 ?? 12.7, timings.S13alt ?? 12.7) + tail + 0.6).toFixed(3),
};
fs.writeFileSync(path.join(ROOT, "vo/durations.json"), JSON.stringify(durations, null, 2));

console.log(JSON.stringify({ timings, durations }, null, 2));
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
