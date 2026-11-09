import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { lintText } from "./lib/text.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const sc = J("script/scenes.json");
const vt = J("vo/timings.json");
const D = J("vo/durations.json");
const state = J("capture/state.json");
const fps = sc.fps;
const F = (s) => Math.round(s * fps);
const probe = (f) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
const ev = (id) => {
  const p = path.join(ROOT, `capture/raw/${id}/events.json`);
  return fs.existsSync(p) ? J(`capture/raw/${id}/events.json`) : { endT: 0, events: [] };
};
const APPHOST = "gnani-swasthyagrid.vercel.app";
const urlText = (u) => {
  try {
    const x = new URL(u);
    if (x.port === "3001") return `127.0.0.1:3001${x.pathname}`;
    return APPHOST + x.pathname + (x.search || "");
  } catch {
    return APPHOST;
  }
};

const voQueue = [];
const sfx = [];
const captions = [];
const chapters = [];
const motion = [];

const addVo = (id, atSec) => {
  voQueue.push({ file: `vo/clean/${id}.wav`, atSec });
  captionize(sc.vo[id], atSec, vt[id] ?? sc.maxSec[id]);
};
function captionize(text, at, dur) {
  const chunks = [];
  for (const sent of text.split(/(?<=[.?!:])\s+/)) {
    let cur = "";
    for (const w of sent.split(" ")) {
      if ((cur + " " + w).trim().length > 64 && cur) {
        chunks.push(cur.trim());
        cur = w;
      } else cur = (cur + " " + w).trim();
    }
    if (cur) chunks.push(cur);
  }
  const total = chunks.reduce((a, c) => a + c.length, 0);
  let t = at;
  for (const c of chunks) {
    const d = dur * (c.length / total || 1);
    captions.push({ from: F(t), to: F(t + d) - 1, text: c });
    t += d;
  }
}

// 1. opening (S00 + S01)
const openingDur = probe(path.join(ROOT, "motion/out/opening.mp4"));
motion.push({ id: "opening", src: "motion/opening.mp4", from: 0, duration: F(openingDur), fadeIn: 0, fadeOut: 12 });
addVo("S00", 0.6);
addVo("S01", 15.0);
sfx.push({ file: "audio/sfx/whoosh.wav", atSec: 14.5, gain: 0.5 });

// 2. main span of screen scenes
const spanStart = openingDur - 0.4;
const span = { id: "main", from: F(spanStart), clips: [], urls: [] };
let t = 0;
const S13voice = state.RISK_IMPROVES === true ? "S13" : "S13alt";
const markMap = (events) => Object.fromEntries(events.filter((e) => e.type === "mark" && e.rect).map((e) => [e.key, e]));

function pushClip(id, src, durSec, trimSec, fxId, overlapNext = true) {
  const e = ev(id);
  const marks = markMap(e.events);
  const fx = sc.fx[fxId] || { callouts: [], zooms: [] };
  const rel = (m) => F(m.t / 1000 - trimSec);
  const callouts = fx.callouts
    .filter((c) => marks[c.key] && rel(marks[c.key]) >= 0 && rel(marks[c.key]) < F(durSec))
    .map((c, i) => ({ id: `${id}-${c.key}-${i}`, from: rel(marks[c.key]), duration: F(c.hold), rect: marks[c.key].rect, label: c.label }));
  const zooms = fx.zooms
    .filter((z) => marks[z.key] && rel(marks[z.key]) >= 0)
    .map((z) => {
      const r = marks[z.key].rect;
      return { from: rel(marks[z.key]) + 6, duration: F(z.hold), scale: z.scale, ox: Math.round(r.x + r.w / 2), oy: Math.round(r.y + r.h / 2) };
    });
  const startF = F(t);
  const clipEndF = startF + F(durSec);
  span.clips.push({ id, src, from: startF, duration: F(durSec) + (overlapNext ? 8 : 0), trimStart: F(trimSec), fadeIn: span.clips.length ? 8 : 0, zooms, callouts });
  for (const u of e.events.filter((x) => x.type === "url")) {
    const f = startF + F(u.t / 1000 - trimSec);
    if (f > clipEndF) continue; // discard nav events that happened after this clip's allotted slot (real capture ran long)
    span.urls.push({ from: Math.max(startF, f), text: urlText(u.url) });
  }
  for (const c of e.events.filter((x) => x.type === "click" && x.important)) {
    sfx.push({ file: "audio/sfx/click.wav", atSec: spanStart + t + c.t / 1000 - trimSec, gain: 0.55 });
  }
  return e;
}

for (const id of sc.screenScenes) {
  const ch = sc.chapters[id];
  if (ch) {
    chapters.push({ ...ch, from: F(spanStart + t) + 6, duration: 96 });
    if (t > 0) sfx.push({ file: "audio/sfx/whoosh.wav", atSec: spanStart + t - 0.1, gain: 0.35 });
  }
  if (id === "S11") {
    const e = ev("S11");
    const rs = e.events.find((x) => x.type === "reply_start");
    const replyAt = rs ? rs.t / 1000 : 7.5;
    const replyDur = probe(path.join(ROOT, "audio/voice/reply.wav"));
    const replyAt2 = replyAt + 0.5;
    const bAt = replyAt2 + replyDur + 0.35;
    // S11b is dropped: the only recorded take is the old "built on Sarvam AI" line, which is
    // no longer true, and no replacement take has been recorded. See demo-video/script/vo-script.md.
    const T11 = Math.min(bAt + 0.7, e.endT / 1000 - 0.4);
    addVo("S11a", spanStart + t + 0.4);
    voQueue.push({ file: "audio/voice/reply.wav", atSec: spanStart + t + replyAt2, reply: true });
    const hindi = fs.readFileSync(path.join(ROOT, "audio/voice/reply.txt"), "utf8").trim();
    captions.push({ from: F(spanStart + t + replyAt2), to: F(spanStart + t + replyAt2 + replyDur) - 1, text: `Voice agent, in Hindi: ${hindi}` });
    pushClip("S11", "clips/S11.mp4", T11, 0, "S11");
    t += T11;
    continue;
  }
  if (id === "S13") {
    const T13 = D.S13;
    addVo(S13voice, spanStart + t + 0.4);
    const b = ev("S13b");
    const rt = b.events.find((x) => x.type === "mark" && (x.key === "risk_toast" || x.key === "risk_chip"));
    if (rt) sfx.push({ file: "audio/sfx/chime.wav", atSec: spanStart + t + rt.t / 1000, gain: 0.5 });
    pushClip("S13b", "clips/S13b.mp4", T13, 0, "S13", false);
    t += T13;
    continue;
  }
  let T = D[id];
  if (id === "S12") {
    // The montage's real capture can run slightly longer than budgeted; extend to the
    // actual capture length so the last page isn't cut off, but cap the extension so one
    // slow page doesn't blow the 180s total.
    const capT = Math.min(ev("S12").endT / 1000 - 0.4, D.S12);
    if (capT > T) T = +capT.toFixed(3);
  }
  addVo(id, spanStart + t + sc.leadSec);
  const e = pushClip(id, `clips/${id}.mp4`, T, 0, id);
  if (id === "S06") {
    const at = e.events.find((x) => x.type === "approve_toast");
    if (at) sfx.push({ file: "audio/sfx/chime.wav", atSec: spanStart + t + at.t / 1000, gain: 0.45 });
  }
  t += T;
}
span.duration = F(t);
span.urls.sort((a, b) => a.from - b.from);

// 3. finale and end card
const finaleAt = spanStart + t - 0.4;
const finaleDur = probe(path.join(ROOT, "motion/out/finale.mp4"));
motion.push({ id: "finale", src: "motion/finale.mp4", from: F(finaleAt), duration: F(finaleDur), fadeIn: 12, fadeOut: 10 });
addVo("S14", finaleAt + 1.2);
const endAt = finaleAt + finaleDur - 0.3;
const endDur = probe(path.join(ROOT, "motion/out/endcard.mp4"));
motion.push({ id: "endcard", src: "motion/endcard.mp4", from: F(endAt), duration: F(endDur), fadeIn: 10, fadeOut: 0 });
addVo("S15", endAt + 0.6);
sfx.push({ file: "audio/sfx/whoosh.wav", atSec: endAt - 0.1, gain: 0.4 });
const totalSec = endAt + endDur;

// 4. gates
const problems = [];
if (totalSec > sc.maxTotalSec) problems.push(`total ${totalSec.toFixed(1)}s is over ${sc.maxTotalSec}s`);
for (const [k, v] of Object.entries(sc.vo)) problems.push(...lintText(`vo ${k}`, v));
for (const c of Object.values(sc.chapters)) problems.push(...lintText("chapter", c.name + " " + c.line));
for (const f of Object.values(sc.fx)) for (const c of f.callouts) problems.push(...lintText("callout", c.label));
for (const c of captions) problems.push(...lintText("caption", c.text));

const routes = new Set(span.urls.map((u) => u.text.replace(APPHOST, "").split("?")[0]));
for (const r of [
  "/command",
  "/districts",
  "/districts/district_kota",
  "/facilities/kota_phc_4",
  "/recommendations",
  "/supply",
  "/supply/fleet",
  "/supply/drivers",
  "/voice",
  "/inventory",
  "/footfall",
  "/beds",
  "/doctors",
  "/diagnostics",
  "/analytics",
  "/facilities/phc_18",
]) {
  if (![...routes].some((x) => x === r)) problems.push(`route not captured: ${r}`);
}
if (![...routes].some((x) => x.startsWith("/supply/shipments/"))) problems.push("route not captured: shipment tracking");

// Removed pages must never show up in the recapture, even if a stale capture dir was reused.
for (const bad of [...routes]) {
  if (/^\/map(\?|$)/.test(bad) || /^\/supply\/planning(\?|$)/.test(bad) || /^\/supply\/warehouses(\?|$)/.test(bad) || /^\/facilities(\?|$)?$/.test(bad)) {
    problems.push(`removed route appears in the capture: ${bad}`);
  }
}
for (const c of captions) if (/sarvam/i.test(c.text)) problems.push(`caption still mentions Sarvam: "${c.text}"`);
for (const [k, v] of Object.entries(sc.vo)) if (/sarvam/i.test(v)) problems.push(`vo ${k} still mentions Sarvam`);

const timeline = {
  fps,
  totalFrames: F(totalSec),
  totalSec: +totalSec.toFixed(3),
  motion,
  spans: [span],
  chapters,
  captions,
  audio: "audio/mix.wav",
  audioEvents: { vo: voQueue, sfx, music: "audio/music/bed.wav", totalSec },
};
fs.mkdirSync(path.join(ROOT, "remotion/src"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "remotion/src/timeline.json"), JSON.stringify(timeline, null, 2));

// SRT
const ts = (f) => {
  const s = f / fps,
    h = Math.floor(s / 3600),
    m = Math.floor(s / 60) % 60,
    sec = Math.floor(s) % 60,
    ms = Math.round((s % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
};
fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "out/SwasthyaGrid-demo.srt"),
  captions.map((c, i) => `${i + 1}\n${ts(c.from)} --> ${ts(c.to)}\n${c.text}\n`).join("\n")
);

console.log(`total ${totalSec.toFixed(2)}s, ${captions.length} captions, ${span.clips.length} clips, ${sfx.length} sfx, using ${S13voice} for S13`);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
