import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = path.join(ROOT, "capture/raw");
const OUT = path.join(ROOT, "capture/clips");
fs.mkdirSync(OUT, { recursive: true });

for (const id of fs.readdirSync(RAW)) {
  const fj = path.join(RAW, id, "frames.json");
  if (!fs.existsSync(fj)) continue;
  const { endT, frames } = JSON.parse(fs.readFileSync(fj, "utf8"));
  if (!frames.length) {
    console.warn(`${id}: no frames`);
    continue;
  }
  const lines = [];
  for (let i = 0; i < frames.length; i++) {
    const start = i === 0 ? 0 : frames[i].t;
    const end = i + 1 < frames.length ? frames[i + 1].t : endT;
    lines.push(`file 'frames/${frames[i].name}'`, `duration ${Math.max(0.001, (end - start) / 1000).toFixed(4)}`);
  }
  lines.push(`file 'frames/${frames[frames.length - 1].name}'`);
  fs.writeFileSync(path.join(RAW, id, "list.txt"), lines.join("\n"));
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-v",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      "list.txt",
      "-vf",
      "scale=1920:1080:flags=lanczos,fps=30,format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "14",
      "-movflags",
      "+faststart",
      path.join(OUT, `${id}.mp4`),
    ],
    { cwd: path.join(RAW, id), stdio: "inherit" }
  );
  console.log(`${id}.mp4 ready`);
}
