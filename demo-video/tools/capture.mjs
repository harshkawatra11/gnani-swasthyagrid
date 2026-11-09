import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const APP = process.env.APP_URL ?? "http://127.0.0.1:3000";
const CRM = process.env.CRM_URL ?? "http://127.0.0.1:3001";
const API = process.env.API_URL ?? "http://127.0.0.1:8080";
const DRY = process.argv.includes("--dry");
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const D = JSON.parse(fs.readFileSync(path.join(ROOT, "vo/durations.json"), "utf8"));
const STATE = JSON.parse(fs.readFileSync(path.join(ROOT, "capture/state.json"), "utf8"));
const scenesData = JSON.parse(fs.readFileSync(path.join(ROOT, "script/scenes.json"), "utf8"));
const RAW = path.join(ROOT, "capture/raw");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- silent fake microphone ----------
const SILENCE = path.join(ROOT, "capture/silence.wav");
fs.mkdirSync(path.join(ROOT, "capture"), { recursive: true });
if (!fs.existsSync(SILENCE)) {
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", "60", SILENCE]);
}

// ---------- injected cursor and polish ----------
const INIT = `(() => {
  try { localStorage.setItem('sg-theme','light'); localStorage.removeItem('sg-scope'); localStorage.setItem('sg-sidebar','expanded'); } catch (e) {}
  const css = document.createElement('style');
  css.textContent = '::-webkit-scrollbar{width:0!important;height:0!important} html{scroll-behavior:auto!important}';
  const add = () => {
    if (document.getElementById('demo-cursor')) return;
    document.documentElement.appendChild(css);
    const c = document.createElement('div'); c.id = 'demo-cursor';
    c.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.5 14.8 L11.4 21.5 L14 20.4 L11.1 13.8 L17.5 13.8 Z" fill="#0f172a" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '-100px', top: '-100px', zIndex: '2147483647', pointerEvents: 'none', transform: 'translate(-4px,-3px)', filter: 'drop-shadow(0 2px 5px rgba(15,23,42,.35))' });
    document.documentElement.appendChild(c);
    document.addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    document.addEventListener('mousedown', e => {
      const r = document.createElement('div');
      Object.assign(r.style, { position: 'fixed', left: (e.clientX - 20) + 'px', top: (e.clientY - 20) + 'px', width: '40px', height: '40px', borderRadius: '50%', border: '3px solid #0f9f7a', zIndex: '2147483646', pointerEvents: 'none', opacity: '0.95', transition: 'transform 450ms ease-out, opacity 450ms ease-out' });
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = 'scale(1.9)'; r.style.opacity = '0'; });
      setTimeout(() => r.remove(), 520);
    }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();`;

// ---------- recorder ----------
class Recorder {
  constructor(page, id) {
    this.page = page;
    this.id = id;
    this.dir = path.join(RAW, id);
    this.frames = [];
    this.events = [];
  }
  async start() {
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(path.join(this.dir, "frames"), { recursive: true });
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.t0 = Date.now();
    this.cdp.on("Page.screencastFrame", async (f) => {
      const t = Date.now() - this.t0;
      const name = String(this.frames.length).padStart(6, "0") + ".jpg";
      if (!DRY) fs.writeFileSync(path.join(this.dir, "frames", name), Buffer.from(f.data, "base64"));
      this.frames.push({ name, t });
      try {
        await this.cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId });
      } catch {}
    });
    this.onNav = (fr) => {
      if (fr === this.page.mainFrame()) this.ev("url", { url: fr.url() });
    };
    this.page.on("framenavigated", this.onNav);
    await this.cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
    this.ev("url", { url: this.page.url() });
  }
  now() {
    return Date.now() - this.t0;
  }
  ev(type, data = {}) {
    this.events.push({ type, t: this.now(), ...data });
  }
  async at(sec) {
    const w = sec * 1000 - this.now();
    if (w > 0) await sleep(w);
  }
  async stop() {
    await this.cdp.send("Page.stopScreencast").catch(() => {});
    this.page.off("framenavigated", this.onNav);
    const endT = this.now();
    fs.writeFileSync(path.join(this.dir, "frames.json"), JSON.stringify({ endT, frames: this.frames }, null, 1));
    fs.writeFileSync(path.join(this.dir, "events.json"), JSON.stringify({ endT, events: this.events }, null, 1));
    console.log(`${this.id}: ${this.frames.length} frames, ${(endT / 1000).toFixed(1)}s`);
  }
}

// ---------- helpers ----------
const box = async (loc) => {
  const b = await loc.boundingBox();
  if (!b) throw new Error("no bounding box");
  return b;
};
async function moveTo(page, loc, steps = 26) {
  const b = await box(loc);
  await page.mouse.move(b.x + b.width / 2, b.y + Math.min(b.height / 2, 40), { steps });
}
async function glide(page, x, y, ms) {
  await page.mouse.move(x, y, { steps: Math.max(8, Math.round(ms / 16)) });
}
async function click(page, rec, loc, { important = false, label = "" } = {}) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const b = await box(loc);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 24 });
  await sleep(160);
  rec.ev("click", { important, label });
  await page.mouse.down();
  await sleep(60);
  await page.mouse.up();
}
async function scrollWindowTo(page, y, ms) {
  await page.evaluate(
    async ({ y, ms }) => {
      const s = window.scrollY,
        max = document.documentElement.scrollHeight - innerHeight,
        tgt = Math.max(0, Math.min(max, y)),
        t0 = performance.now();
      const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      await new Promise((res) => {
        const step = (now) => {
          const p = Math.min(1, (now - t0) / ms);
          window.scrollTo(0, s + (tgt - s) * ease(p));
          p < 1 ? requestAnimationFrame(step) : res();
        };
        requestAnimationFrame(step);
      });
    },
    { y, ms }
  );
}
async function scrollToLoc(page, loc, ms = 1000) {
  const y = await loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const h = Math.min(r.height, innerHeight - 140);
    return window.scrollY + r.top - Math.max(90, (innerHeight - h) / 2);
  });
  await scrollWindowTo(page, y, ms);
}
async function scrollToBottom(page, ms) {
  await scrollWindowTo(page, 1e7, Math.max(400, ms));
}
async function scrollInto(loc, ms = 800) {
  await loc.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" }));
  await sleep(ms);
}
async function cardRect(page, text) {
  return page.evaluate((text) => {
    const els = [...document.querySelectorAll("p,span,h1,h2,h3,h4,div,dt,label")].filter(
      (e) => e.childElementCount === 0 && e.textContent.trim() === text && e.getBoundingClientRect().height > 0
    );
    const e = els[0];
    if (!e) return null;
    let n = e;
    while (n && n !== document.body) {
      const cs = getComputedStyle(n),
        r = n.getBoundingClientRect();
      if (parseFloat(cs.borderTopWidth) > 0 && parseFloat(cs.borderTopLeftRadius) >= 6 && r.height > 120) {
        return { x: r.x, y: r.y, w: r.width, h: r.height, top: r.top + scrollY };
      }
      n = n.parentElement;
    }
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, top: r.top + scrollY };
  }, text);
}
async function scrollToCard(page, text, ms = 1000) {
  const r = await cardRect(page, text);
  if (!r) return null;
  await scrollWindowTo(page, r.top - Math.max(90, (1080 - Math.min(r.h, 940)) / 2), ms);
  return cardRect(page, text);
}
async function mark(rec, key, locOrRect) {
  let rect = null;
  try {
    if (locOrRect && typeof locOrRect.boundingBox === "function") {
      const b = await locOrRect.boundingBox();
      if (b) rect = { x: b.x, y: b.y, w: b.width, h: b.height };
    } else if (locOrRect) {
      rect = { x: locOrRect.x, y: locOrRect.y, w: locOrRect.w, h: locOrRect.h };
    }
  } catch {}
  if (rect) {
    rect.y = Math.max(4, rect.y);
    rect.h = Math.min(rect.h, 1076 - rect.y);
  }
  rec.ev("mark", { key, rect });
  if (!rect) console.warn(`mark ${key}: element not found`);
}
const nav = (page) => page.locator('nav[aria-label="Primary"]');
async function navTo(page, rec, label, urlRe, readyLoc) {
  await click(page, rec, nav(page).getByRole("link", { name: new RegExp("^" + label) }).first(), { label });
  await page.waitForURL(urlRe, { timeout: 15000 });
  await readyLoc.first().waitFor({ state: "visible", timeout: 20000 });
  await sleep(500);
}
const tid = (page, id) => page.getByTestId(id);
async function palette(page, rec, query, urlRe) {
  rec.ev("click", { important: false, label: "ctrl+k" });
  await page.keyboard.press("Control+K");
  const input = page.getByRole("combobox", { name: "Search pages, districts, facilities, shipments" });
  await input.waitFor({ state: "visible", timeout: 5000 });
  await input.pressSequentially(query, { delay: 70 });
  await sleep(450);
  await mark(rec, "palette", page.locator('[role="dialog"]').last());
  await sleep(700);
  await page.keyboard.press("Enter");
  await page.waitForURL(urlRe, { timeout: 10000 });
  await sleep(500);
}

// ---------- scenes ----------
let SHIP = null;
const shipInfo = async (id) => {
  try {
    return await (await fetch(`${API}/api/v1/logistics/shipments/${id}`)).json();
  } catch {
    return null;
  }
};

const SCENES = {
  async S02(page, rec, T) {
    const kpi = tid(page, "kpi-band");
    const kb = await box(kpi);
    await glide(page, kb.x + 80, kb.y + kb.height / 2, 700);
    await rec.at(0.15 * T);
    await mark(rec, "kpi", kpi);
    await glide(page, kb.x + kb.width - 80, kb.y + kb.height / 2, 0.18 * T * 1000);
    await rec.at(0.4 * T);
    await moveTo(page, tid(page, "card-map"));
    await mark(rec, "map", tid(page, "card-map"));
    await rec.at(0.52 * T);
    await scrollToLoc(page, tid(page, "card-facility-matrix"), 1200);
    await rec.at(0.57 * T);
    await mark(rec, "matrix", tid(page, "card-facility-matrix"));
    await rec.at(0.78 * T);
    await moveTo(page, tid(page, "card-medicine-matrix"));
    await mark(rec, "medicine", tid(page, "card-medicine-matrix"));
    await rec.at(0.9 * T);
    await scrollToBottom(page, 0.1 * T * 1000);
  },
  async S03(page, rec, T) {
    await navTo(page, rec, "District Comparison", /\/districts(\?|$)/, page.locator('section[aria-label="District small multiples"]'));
    await rec.at(0.18 * T);
    const sm = page.locator('section[aria-label="District small multiples"]');
    await scrollToLoc(page, sm, 900);
    await mark(rec, "cards", sm);
    await rec.at(0.42 * T);
    const card = page.getByLabel("Kota district card");
    await click(page, rec, card.locator("a").first().or(card).first(), { label: "Kota" });
    try {
      await page.waitForURL(/\/districts\/district_kota/, { timeout: 3000 });
    } catch {
      await page.goto(`${APP}/districts/district_kota`);
    }
    await page.getByText("District map", { exact: true }).first().waitFor({ timeout: 15000 });
    await rec.at(0.6 * T);
    await mark(rec, "dmap", await cardRect(page, "District map"));
    await rec.at(0.74 * T);
    await mark(rec, "causal", await scrollToCard(page, "Causal chain", 1000));
    await rec.at(0.9 * T);
    await scrollToBottom(page, 0.09 * T * 1000);
  },
  async S04(page, rec, T) {
    // S03 leaves the page on /districts/district_kota. Open the clinic case file via the
    // command palette (no Facilities directory page exists any more).
    try {
      await palette(page, rec, "Kota-4", /\/facilities\/kota_phc_4/);
    } catch {
      await page.keyboard.press("Escape");
      await page.goto(`${APP}/facilities/kota_phc_4`);
    }
    await page.locator('section[aria-label="Case header"]').waitFor({ timeout: 15000 });
    await rec.at(0.55 * T);
    await mark(rec, "cover", await scrollToCard(page, "Medicine cover against 21 days", 900));
    await rec.at(0.8 * T);
    await scrollToCard(page, "Beds: now, tomorrow, next week", 800);
    await rec.at(0.92 * T);
    await scrollToCard(page, "Inbound shipments", 600);
  },
  async S06(page, rec, T) {
    await navTo(page, rec, "Recommendations", /\/recommendations/, tid(page, "decision-board"));
    const id = STATE.recId;
    const card = tid(page, `rec-${id}`);
    await rec.at(0.12 * T);
    await scrollInto(card, 900);
    await moveTo(page, card);
    await rec.at(0.2 * T);
    await mark(rec, "card", card);
    await rec.at(0.38 * T);
    await click(page, rec, card.getByRole("button", { name: "Options considered" }), { label: "Options" });
    await tid(page, `options-${id}`).waitFor({ timeout: 5000 });
    await scrollInto(card, 500);
    await mark(rec, "options", tid(page, `options-${id}`));
    await rec.at(0.62 * T);
    await click(page, rec, tid(page, `approve-${id}`), { label: "Approve" });
    await tid(page, `confirm-approve-${id}`).waitFor({ timeout: 5000 });
    await rec.at(0.72 * T);
    if (DRY) {
      await page.keyboard.press("Escape");
      return;
    }
    await click(page, rec, tid(page, `confirm-approve-${id}`), { important: true, label: "Confirm approve" });
    const toast = page.locator('div[aria-live="polite"]').getByText(/Approved\. Shipment/).first();
    await toast.waitFor({ timeout: 10000 });
    const txt = await toast.innerText();
    SHIP = (txt.match(/SHP-\d+/) || [])[0] || null;
    rec.ev("approve_toast", { ship: SHIP });
    await mark(rec, "toast", toast.locator("xpath=ancestor::div[contains(@class,'rounded')][1]").first());
    fs.writeFileSync(path.join(ROOT, "capture/state.json"), JSON.stringify({ ...STATE, SHIP }, null, 2));
  },
  async S07(page, rec, T) {
    await navTo(page, rec, "Dispatch", /\/supply(\?|$)/, tid(page, "orders-list"));
    await rec.at(0.14 * T);
    await mark(rec, "stats", tid(page, "map-stats"));
    await rec.at(0.34 * T);
    if (SHIP) {
      const q = page.getByLabel("Search shipments by id or destination");
      await click(page, rec, q, { label: "search shipment" });
      await q.fill(SHIP);
      await q.press("Enter");
      await sleep(800);
    }
    const row = SHIP ? page.getByRole("button", { name: `Select ${SHIP} on the map` }) : tid(page, "orders-list").getByRole("button").first();
    const target = (await row.count()) ? row.first() : tid(page, "orders-list").getByRole("button").first();
    await scrollInto(target, 700);
    await click(page, rec, target, { label: "select order" });
    await sleep(600);
    await mark(rec, "order", target);
    await rec.at(0.62 * T);
    await moveTo(page, tid(page, "sim-clock"));
    await rec.at(0.74 * T);
    await mark(rec, "status", tid(page, "status-bar"));
  },
  async S08(page, rec, T) {
    await scrollWindowTo(page, 0, 500);
    const open = SHIP ? page.getByRole("link", { name: `Open tracking for ${SHIP}` }) : page.getByRole("link", { name: /^Open tracking for / });
    const target = (await open.count()) ? open.first() : page.getByRole("link", { name: /^Open tracking for / }).first();
    await scrollInto(target, 500);
    await click(page, rec, target, { label: "open tracking" });
    await page.waitForURL(/\/supply\/shipments\//, { timeout: 10000 });
    await tid(page, "eta-headline").waitFor({ timeout: 15000 });
    await sleep(400);
    await rec.at(0.18 * T);
    await mark(rec, "eta", tid(page, "eta-headline"));
    await rec.at(0.45 * T);
    const reefer = tid(page, "reefer");
    if (await reefer.count()) {
      await scrollToLoc(page, reefer, 900);
      await mark(rec, "reefer", reefer);
    } else {
      await mark(rec, "reefer", await scrollToCard(page, "Vehicle", 900));
    }
    await rec.at(0.72 * T);
    await scrollToLoc(page, tid(page, "event-log"), 900);
    await mark(rec, "events", tid(page, "event-log"));
  },
  async S09(page, rec, T) {
    const info = SHIP ? await shipInfo(SHIP) : null;
    await navTo(page, rec, "Fleet", /\/supply\/fleet/, page.getByRole("listbox", { name: "Vehicles" }));
    if (info?.vehicle?.registration) {
      const s = page.getByLabel("Search vehicles");
      await click(page, rec, s);
      await s.pressSequentially(info.vehicle.registration.slice(0, 7), { delay: 60 });
      await sleep(300);
    }
    await click(page, rec, page.getByRole("listbox", { name: "Vehicles" }).getByRole("option").first(), { label: "vehicle" });
    await sleep(700);
    await rec.at(0.24 * T);
    const cargo = page.locator('svg[viewBox="0 0 640 220"]').first();
    if (await cargo.count()) {
      await scrollToLoc(page, cargo, 700);
      await mark(rec, "cargo", cargo);
    } else await mark(rec, "cargo", null);
    await rec.at(0.5 * T);
    await navTo(page, rec, "Drivers", /\/supply\/drivers/, page.getByRole("listbox", { name: "Drivers" }));
    if (info?.driver?.name) {
      const s = page.getByLabel("Search drivers");
      await click(page, rec, s);
      await s.pressSequentially(info.driver.name.split(" ")[0], { delay: 60 });
      await sleep(300);
    }
    await click(page, rec, page.getByRole("listbox", { name: "Drivers" }).getByRole("option").first(), { label: "driver" });
    await sleep(700);
    await rec.at(0.74 * T);
    const hours = page.locator('section[aria-label="Hours today"]');
    if (await hours.count()) await mark(rec, "hours", hours);
    else await mark(rec, "hours", null);
  },
  async S11(page, rec, T) {
    await navTo(page, rec, "Voice Control Room", /\/voice/, page.getByRole("group", { name: "Suggested prompts" }));
    await rec.at(3.6);
    if (DRY) return;
    const chip = page.getByRole("group", { name: "Suggested prompts" }).getByRole("button", { name: "कोटा में अभी क्या हाल है?" });
    await click(page, rec, chip, { important: true, label: "Hindi question" });
    const reply = page.locator('li[data-speaker]:not([data-speaker="officer"])').last();
    await page.waitForFunction(
      () => {
        const l = [...document.querySelectorAll('li[data-speaker]:not([data-speaker="officer"])')].pop();
        return l && l.innerText.replace(/\.\.\./g, "").trim().length > 12;
      },
      null,
      { timeout: 30000 }
    );
    rec.ev("reply_start");
    const trace = page.locator('ul[aria-label="Data checked"]').last();
    try {
      await trace.waitFor({ timeout: 8000 });
      await mark(rec, "trace", trace);
    } catch {}
    const fact = page.getByTestId("fact-card").last();
    try {
      await fact.waitFor({ timeout: 20000 });
      await scrollInto(fact, 600);
      await mark(rec, "fact", fact);
    } catch {}
    let last = "",
      stable = 0;
    while (stable < 3 && rec.now() < (T - 2) * 1000) {
      await sleep(500);
      const cur = await reply.innerText();
      stable = cur === last ? stable + 1 : 0;
      last = cur;
    }
    fs.mkdirSync(path.join(RAW, "S11"), { recursive: true });
    fs.writeFileSync(path.join(RAW, "S11", "reply.txt"), last, "utf8");
  },
  async S12(page, rec, T) {
    // Inventory and Analyst Workbench still scroll the window; Footfall, Bed Occupancy,
    // Doctors and Diagnostics are one-screen pages, so a window scroll is a no-op there.
    const pages = [
      ["Inventory", /\/inventory/, "Stock cover heatmap", true],
      ["Footfall", /\/footfall/, "Footfall forecast studio", false],
      ["Bed Occupancy", /\/beds/, "Bed capacity board", false],
      ["Doctors", /\/doctors/, "Roster and attendance", false],
      ["Diagnostics", /\/diagnostics/, "Test availability matrix", false],
      ["Analyst Workbench", /\/analytics/, null, true],
    ];
    const seg = T / pages.length;
    for (let i = 0; i < pages.length; i++) {
      const [label, re, h1, scrolls] = pages[i];
      await rec.at(i * seg);
      const ready = h1 ? page.getByRole("heading", { name: h1 }) : page.locator("main h1");
      await navTo(page, rec, label, re, ready);
      rec.ev("montage", { label });
      if (i === 4) {
        await click(page, rec, page.getByRole("combobox", { name: "District scope" }).first(), { label: "scope" });
        await click(page, rec, page.getByRole("option", { name: "Kota" }), { label: "Kota" });
        await sleep(500);
      }
      const remainMs = (seg - 1.1) * 1000 - (i === 4 ? 1600 : 0);
      if (scrolls) {
        await scrollToBottom(page, remainMs);
      } else {
        if (i === 2) {
          const next = page.getByRole("button", { name: "Next page" }).first();
          if (await next.count()) await click(page, rec, next, { label: "next page" });
        }
        await glide(page, 520, 380, Math.min(1600, Math.max(400, remainMs * 0.4)));
        await glide(page, 1640, 760, Math.min(1600, Math.max(400, remainMs * 0.4)));
        await sleep(Math.max(0, remainMs - 3200));
      }
    }
  },
};

// ---------- S13: CRM confirm, then the dashboard reacts ----------
async function S13(page, crm, T) {
  await palette(page, { ev() {} }, "Rural-14", /\/facilities\/phc_18/).catch(async () => {
    await page.goto(`${APP}/facilities/phc_18`);
  });
  await page.locator('section[aria-label="Case header"]').waitFor({ timeout: 15000 });
  await crm.bringToFront();
  await crm.goto(`${CRM}/dashboard`);
  await crm.getByText("Incoming Deliveries").first().waitFor({ timeout: 20000 });
  await crm.getByRole("button", { name: "Confirm receipt" }).first().waitFor({ timeout: 20000 });
  await crm.evaluate(() => window.scrollTo(0, 0));
  const A = new Recorder(crm, "S13a");
  await A.start();
  await A.at(0.5);
  await mark(A, "incoming", await cardRect(crm, "Incoming Deliveries"));
  await A.at(0.1 * T);
  const btn = crm.getByRole("button", { name: "Confirm receipt" }).first();
  await scrollInto(btn, 600);
  await click(crm, A, btn, { label: "Confirm receipt" });
  await A.at(0.2 * T);
  await mark(A, "form", btn.locator("xpath=ancestor::*[.//button[normalize-space()='Confirm']][1]"));
  await A.at(0.34 * T);
  if (!DRY) {
    await click(crm, A, crm.getByRole("button", { name: "Confirm", exact: true }), { important: true, label: "Confirm" });
    A.ev("confirm_click");
    await crm.getByText("Receipt confirmed, stock updated.").waitFor({ timeout: 15000 });
    await mark(A, "crm_toast", crm.getByText("Receipt confirmed, stock updated."));
  }
  await sleep(1100);
  await A.stop();
  await page.bringToFront();
  const B = new Recorder(page, "S13b");
  await B.start();
  const toast = page.locator('div[aria-live="polite"]').getByText(/improved from/).first();
  let found = false;
  try {
    await toast.waitFor({ timeout: 3500 });
    found = true;
  } catch {}
  B.ev("risk_toast_found", { found });
  if (found) await mark(B, "risk_toast", toast.locator("xpath=ancestor::div[contains(@class,'rounded')][1]").first());
  else await mark(B, "risk_chip", page.locator('section[aria-label="Case header"]'));
  const remain = T - A.endT / 1000;
  await B.at(Math.max(4, remain) + 1.2);
  await B.stop();
}

// ---------- main ----------
const browser = await chromium.launch({
  headless: false,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-audio-capture=${SILENCE}`,
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-background-timer-throttling",
    "--force-device-scale-factor=1",
    "--hide-scrollbars",
  ],
});
const ctxOpts = { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: "light" };
const NEED_CRM = !ONLY.length || ONLY.includes("S13");
const ctx = await browser.newContext({ ...ctxOpts, permissions: ["microphone"] });
await ctx.addInitScript(INIT);
const page = await ctx.newPage();
let crm = null;
if (NEED_CRM) {
  const crmCtx = await browser.newContext(ctxOpts);
  await crmCtx.addInitScript(INIT);
  crm = await crmCtx.newPage();
  await crm.goto(`${CRM}/login`);
  if (process.env.CRM_DEMO_PASSWORD) {
    await crm.locator('input[autocomplete="username"]').fill("phc-rural-14");
    await crm.locator('input[type="password"]').fill(process.env.CRM_DEMO_PASSWORD);
    await crm.getByRole("button", { name: "Sign in" }).click();
  } else {
    console.log("Log in to the CRM window as phc-rural-14 (up to 3 minutes)...");
  }
  await crm.waitForURL(/\/dashboard/, { timeout: 180000 });
}

await page.goto(`${APP}/command`);
await tid(page, "kpi-band").waitFor({ timeout: 30000 });
for (const [label, re] of [
  ["Voice Control Room", /\/voice/],
  ["Recommendations", /\/recommendations/],
  ["District Comparison", /\/districts/],
  ["Dispatch", /\/supply(\?|$)/],
  ["Fleet", /fleet/],
  ["Drivers", /drivers/],
  ["Inventory", /inventory/],
  ["Footfall", /footfall/],
  ["Bed Occupancy", /beds/],
  ["Doctors", /doctors/],
  ["Diagnostics", /diagnostics/],
  ["Analyst Workbench", /analytics/],
  ["Command Centre", /\/command/],
]) {
  await nav(page).getByRole("link", { name: new RegExp("^" + label) }).first().click();
  await page.waitForURL(re, { timeout: 15000 });
  await sleep(900);
}
await scrollWindowTo(page, 0, 10);
await page.mouse.move(1500, 700);
await sleep(1500);

for (const id of ["S02", "S03", "S04", "S06", "S07", "S08", "S09", "S11", "S12"]) {
  if (ONLY.length && !ONLY.includes(id)) continue;
  const T = D[id];
  const rec = new Recorder(page, id);
  await rec.start();
  try {
    await SCENES[id](page, rec, T);
  } catch (e) {
    console.error(`${id} failed: ${e.message}`);
    rec.ev("error", { message: e.message });
  }
  await rec.at(T + 1.2);
  await rec.stop();
}
if (NEED_CRM) await S13(page, crm, D.S13);
await browser.close();
console.log("capture complete");
