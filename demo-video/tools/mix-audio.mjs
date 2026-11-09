import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const tl = JSON.parse(fs.readFileSync(path.join(ROOT, "remotion/src/timeline.json"), "utf8"));
const A = tl.audioEvents;
const total = A.totalSec.toFixed(3);

const inputs = [];
const filters = [];
const voLabels = [];
const fxLabels = [];
const add = (f) => {
  inputs.push("-i", path.join(ROOT, f));
  return inputs.filter((x) => x === "-i").length - 1;
};
const ms = (s) => Math.max(0, Math.round(s * 1000));

for (const v of A.vo) {
  const i = add(v.file);
  const l = `v${i}`;
  filters.push(`[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${v.reply ? 0.95 : 1.0},adelay=${ms(v.atSec)}|${ms(v.atSec)}[${l}]`);
  voLabels.push(`[${l}]`);
}
for (const s of A.sfx) {
  const i = add(s.file);
  const l = `s${i}`;
  filters.push(`[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${s.gain},adelay=${ms(s.atSec)}|${ms(s.atSec)}[${l}]`);
  fxLabels.push(`[${l}]`);
}
inputs.push("-stream_loop", "-1", "-i", path.join(ROOT, A.music));
const mi = inputs.filter((x) => x === "-i").length - 1;

filters.push(`${voLabels.join("")}amix=inputs=${voLabels.length}:normalize=0:dropout_transition=0,apad,atrim=0:${total}[vo]`);
filters.push(`[vo]asplit=2[vomix][vokey]`);
filters.push(
  `[${mi}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${total},asetpts=N/SR/TB,volume=0.30,afade=t=in:d=1.2,afade=t=out:st=${(A.totalSec - 3).toFixed(3)}:d=3[mus]`
);
filters.push(`[mus][vokey]sidechaincompress=threshold=0.035:ratio=8:attack=20:release=450:makeup=1[musd]`);
filters.push(`${fxLabels.join("")}amix=inputs=${fxLabels.length}:normalize=0,apad,atrim=0:${total}[fx]`);
filters.push(`[vomix][musd][fx]amix=inputs=3:normalize=0,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=11[out]`);

fs.mkdirSync(path.join(ROOT, "audio"), { recursive: true });
const out = path.join(ROOT, "audio/mix.wav");
execFileSync(
  "ffmpeg",
  ["-y", "-v", "error", ...inputs, "-filter_complex", filters.join(";"), "-map", "[out]", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s24le", "-t", total, out],
  { stdio: "inherit" }
);
fs.mkdirSync(path.join(ROOT, "remotion/public/audio"), { recursive: true });
fs.copyFileSync(out, path.join(ROOT, "remotion/public/audio/mix.wav"));
console.log("mix.wav ready");
