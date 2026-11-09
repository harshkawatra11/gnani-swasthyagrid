import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "out/SwasthyaGrid-demo.mp4");

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] }).toString();
// ffmpeg writes filter output (ebur128, blackdetect, freezedetect) to stderr and usually exits 0,
// so we must read stderr directly rather than rely on a thrown error carrying it.
const runErr = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8" }).stderr || "";

const problems = [];
const info = JSON.parse(run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", OUT]));
const v = info.streams.find((s) => s.codec_type === "video");
const a = info.streams.find((s) => s.codec_type === "audio");
const dur = parseFloat(info.format.duration);

if (dur > 210.5) problems.push(`duration ${dur.toFixed(2)}s over 3:30`);
if (v.width !== 1920 || v.height !== 1080) problems.push(`resolution ${v.width}x${v.height}`);
if (!/^30(\/1)?$/.test(v.r_frame_rate)) problems.push(`fps ${v.r_frame_rate}`);
if (!a) problems.push("no audio stream");

const ebErr = runErr("ffmpeg", ["-hide_banner", "-nostats", "-i", OUT, "-af", "ebur128=peak=true", "-f", "null", "-"]);
const Imatch = (ebErr.match(/I:\s+(-?\d+\.\d) LUFS/g) || []).pop();
const I = Imatch ? parseFloat(Imatch.match(/-?\d+\.\d/)[0]) : null;
if (I === null || !(I >= -16 && I <= -12)) problems.push(`integrated loudness ${I} LUFS, expected -14 +/- 2`);

const bd = runErr("ffmpeg", ["-hide_banner", "-nostats", "-i", OUT, "-vf", "blackdetect=d=0.25:pix_th=0.10", "-an", "-f", "null", "-"]);
if (/black_start/.test(bd)) problems.push("black frames detected:\n" + bd.split("\n").filter((l) => l.includes("black_start")).join("\n"));

const fz = runErr("ffmpeg", ["-hide_banner", "-nostats", "-i", OUT, "-vf", "freezedetect=n=0.001:d=3.5", "-an", "-f", "null", "-"]);
const freezes = fz.split("\n").filter((l) => l.includes("freeze_duration"));
if (freezes.length) console.warn("WARN long static stretches (review, may be intentional holds):\n" + freezes.join("\n"));

const scratch = path.join(ROOT, "vo/raw/SCRATCH.json");
if (fs.existsSync(scratch) && !process.argv.includes("--allow-scratch")) {
  problems.push("scratch voiceover still present: " + fs.readFileSync(scratch, "utf8"));
}

execFileSync("ffmpeg", ["-y", "-v", "error", "-i", OUT, "-vf", "fps=1/6,scale=480:-1,tile=6x6", "-frames:v", "1", path.join(ROOT, "out/contact-sheet.jpg")]);

console.log(`duration ${dur.toFixed(2)}s, ${v.width}x${v.height} @ ${v.r_frame_rate}, loudness ${I} LUFS`);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("QA passed");
