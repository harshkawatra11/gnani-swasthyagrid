import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const REPO = path.resolve(ROOT, "..");
const API = process.env.API_URL ?? "http://127.0.0.1:8080";
const env = fs.readFileSync(path.join(REPO, "backend/.env"), "utf8");
const TOKEN = (env.match(/^LOGISTICS_SERVICE_TOKEN=(.*)$/m) || [])[1]?.trim();
if (!TOKEN) {
  console.error("LOGISTICS_SERVICE_TOKEN missing in backend/.env");
  process.exit(1);
}

const j = async (p, init = {}) => {
  const r = await fetch(API + p, { ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${p} -> ${r.status} ${await r.text()}`);
  return r.json();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const reset = async () => {
  await j("/api/v1/logistics/admin/reset", { method: "POST", body: "{}" });
  await j("/api/v1/logistics/admin/time-scale", { method: "POST", body: JSON.stringify({ scale: 60 }) });
  await sleep(4000);
};

const arrivedToPhc18 = async () => {
  const s = await j("/api/v1/logistics/shipments?status=arrived&facility_id=phc_18&limit=10");
  const it = (s.items || []).find((x) => x.kind === "replenishment") || (s.items || [])[0];
  if (!it) throw new Error("no arrived shipment to phc_18 after reset");
  return it;
};

const risk = async () => (await j("/api/v1/facilities/phc_18/profile")).risk_level;

// 1. rehearsal: does confirming the phc_18 delivery change its risk level?
await reset();
let ship = await arrivedToPhc18();
const detail = await j(`/api/v1/logistics/shipments/${ship.id}`);
const before = await risk();
await j(`/api/v1/logistics/shipments/${ship.id}/pod`, {
  method: "POST",
  headers: { "X-Service-Token": TOKEN },
  body: JSON.stringify({
    pod_id: crypto.randomUUID(),
    facility_id: "phc_18",
    confirmed_by: "rehearsal",
    received: (detail.lines || []).map((l) => ({ medicine_name: l.medicine_name, units: l.units })),
    condition: "ok",
    note: null,
  }),
});
await sleep(3000);
const after = await risk();
const RISK_IMPROVES = before !== after;
console.log(`rehearsal: phc_18 risk ${before} -> ${after}; RISK_IMPROVES=${RISK_IMPROVES}`);

// 2. real state for capture
await reset();
ship = await arrivedToPhc18();
const recs = await j("/api/v1/recommendations?status=pending&district_id=district_kota&type=replenishment");
const list = recs.recommendations || recs.items || recs;
const rank = (r) =>
  (r.priority === "critical" ? 0 : r.priority === "high" ? 1 : 2) +
  (/ARV|Rabies/i.test(r.medicine_name || r.subject || "") ? -0.5 : 0);
const rec = [...list].sort((a, b) => rank(a) - rank(b))[0];
if (!rec) throw new Error("no pending Kota replenishment recommendation");

const state = {
  recId: rec.id,
  recSubject: rec.subject,
  recFacilityId: rec.target_facility_id,
  phc18ShipmentId: ship.id,
  RISK_IMPROVES,
  preparedAt: new Date().toISOString(),
};
fs.mkdirSync(path.join(ROOT, "capture"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "capture/state.json"), JSON.stringify(state, null, 2));
console.log(state);
