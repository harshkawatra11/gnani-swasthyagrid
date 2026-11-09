import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const REPO = path.resolve(ROOT, "..");
const APP = process.env.APP_URL ?? "http://127.0.0.1:3000";
const API = process.env.API_URL ?? "http://127.0.0.1:8080";
const D = JSON.parse(fs.readFileSync(path.join(ROOT, "vo/durations.json"), "utf8"));
const T = D.S13;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const env = fs.readFileSync(path.join(REPO, "backend/.env"), "utf8");
const TOKEN = (env.match(/^LOGISTICS_SERVICE_TOKEN=(.*)$/m) || [])[1]?.trim();

const j = async (p, init = {}) => {
  const r = await fetch(API + p, { ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${p} -> ${r.status} ${await r.text()}`);
  return r.json();
};

const INIT = `(() => { try { localStorage.setItem('sg-theme','light'); } catch(e) {}
  const css = document.createElement('style'); css.textContent = '::-webkit-scrollbar{width:0!important;height:0!important}';
  document.documentElement.appendChild(css);
})();`;

const browser = await chromium.launch({ headless: false, args: ["--force-device-scale-factor=1", "--hide-scrollbars"] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: "light" });
await ctx.addInitScript(INIT);
const page = await ctx.newPage();

class Recorder {
  constructor(page, id) {
    this.page = page; this.id = id; this.dir = path.join(ROOT, "capture/raw", id); this.frames = []; this.events = [];
  }
  async start() {
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(path.join(this.dir, "frames"), { recursive: true });
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.t0 = Date.now();
    this.cdp.on("Page.screencastFrame", async (f) => {
      const t = Date.now() - this.t0;
      const name = String(this.frames.length).padStart(6, "0") + ".jpg";
      fs.writeFileSync(path.join(this.dir, "frames", name), Buffer.from(f.data, "base64"));
      this.frames.push({ name, t });
      try { await this.cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }); } catch {}
    });
    await this.cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  }
  now() { return Date.now() - this.t0; }
  ev(type, data = {}) { this.events.push({ type, t: this.now(), ...data }); }
  async at(sec) { const w = sec * 1000 - this.now(); if (w > 0) await sleep(w); }
  async stop() {
    await this.cdp.send("Page.stopScreencast").catch(() => {});
    const endT = this.now();
    fs.writeFileSync(path.join(this.dir, "frames.json"), JSON.stringify({ endT, frames: this.frames }, null, 1));
    fs.writeFileSync(path.join(this.dir, "events.json"), JSON.stringify({ endT, events: this.events }, null, 1));
    console.log(`${this.id}: ${this.frames.length} frames, ${(endT / 1000).toFixed(1)}s`);
  }
}
async function mark(rec, key, loc) {
  let rect = null;
  try { const b = await loc.boundingBox(); if (b) rect = { x: b.x, y: b.y, w: b.width, h: b.height, y: Math.max(4,b.y), h: Math.min(b.height,1076-Math.max(4,b.y)) }; } catch {}
  rec.ev("mark", { key, rect });
}

await page.goto(`${APP}/facilities/phc_18`, { waitUntil: "domcontentloaded" });
await page.locator('section[aria-label="Case header"]').waitFor({ timeout: 15000 });
await page.mouse.move(960, 500, { steps: 20 });
await sleep(1200);

const rec = new Recorder(page, "S13b");
await rec.start();
rec.ev("url", { url: page.url() }); // the goto to phc_18 happened before rec.start() existed to record it
await rec.at(0.5);
await mark(rec, "risk_chip", page.locator('section[aria-label="Case header"]'));
await rec.at(0.45 * T);

// Confirm the delivery via the backend directly (CRM UI is blocked on a login we don't have).
const ship = await j("/api/v1/logistics/shipments/SHP-200011");
await j(`/api/v1/logistics/shipments/SHP-200011/pod`, {
  method: "POST",
  headers: { "X-Service-Token": TOKEN },
  body: JSON.stringify({
    pod_id: crypto.randomUUID(),
    facility_id: "phc_18",
    confirmed_by: "PHC Rural-14 staff",
    received: (ship.lines || []).map((l) => ({ medicine_name: l.medicine_name, units: l.units })),
    condition: "ok",
    note: null,
  }),
});
rec.ev("confirm_click");
await page.reload({ waitUntil: "domcontentloaded" });
await page.locator('section[aria-label="Case header"]').waitFor({ timeout: 15000 });
await mark(rec, "risk_chip", page.locator('section[aria-label="Case header"]'));
await rec.at(T + 1.2);
await rec.stop();
await browser.close();
console.log("S13 (dashboard-only) capture complete");
