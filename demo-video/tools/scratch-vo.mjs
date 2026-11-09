import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const scenes = JSON.parse(fs.readFileSync(path.join(ROOT, "script/scenes.json"), "utf8"));
const rawDir = path.join(ROOT, "vo/raw");
fs.mkdirSync(rawDir, { recursive: true });

const made = [];
for (const [id, text] of Object.entries(scenes.vo)) {
  const exists = fs.existsSync(rawDir) && fs.readdirSync(rawDir).some((f) => f.replace(/\.[^.]+$/, "") === id);
  if (exists) continue;
  const out = path.join(rawDir, `${id}.wav`).replace(/\//g, "\\");
  const escaped = text.replace(/'/g, "''");
  const ps = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = 1; $s.SetOutputToWaveFile('${out}'); $s.Speak('${escaped}'); $s.Dispose()`;
  execFileSync("powershell", ["-NoProfile", "-Command", ps], { stdio: "inherit" });
  made.push(id);
}
if (made.length) fs.writeFileSync(path.join(rawDir, "SCRATCH.json"), JSON.stringify(made, null, 2));
console.log(made.length ? `scratch VO generated for: ${made.join(", ")}` : "no scratch needed, all recordings present");
