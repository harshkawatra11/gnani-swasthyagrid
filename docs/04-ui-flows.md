# 04 — UI Flows

> **2026-11 note:** `/facilities` (the directory), `/map`, `/supply/warehouses` and `/supply/planning` were removed as standalone pages; those routes now redirect to the page that carries the same information, and the Facility Profile drill-down (`/facilities/[id]`) stays. Beds, Doctors and Diagnostics were removed and later restored as one-screen, no-page-scroll pages. See the README's Feature tour for the current 13-tab sidebar. The flows below describing the still-removed pages are kept as build history.

## App Shell (routed dashboard, not a single scroll page)
SwasthyaGrid is a real dashboard application: a persistent left **Sidebar** (nav rail, grouped Command / Operations / District) and a **Topbar** (district label, search/⌘K trigger, role switcher) wrap every routed page. `AskPanel` stays globally mounted bottom-right across all routes. Route changes animate via `PageTransition` (Framer Motion fade/slide, 180ms).

### Routes
| Route | Purpose |
|---|---|
| `/overview` | Command-center: KPI strip, mini district map, risk donut, top alerts, top 2 pending recommendations |
| `/recommendations` | Full Approve/Reject/Modify workspace, filterable by type, + Resource Transfers log |
| `/inventory` | Medicine stock table (days-remaining, risk, confidence) + stock-transfer recommendations |
| `/footfall` | 7-day footfall forecast chart, tomorrow's demographic breakdown, confidence factors |
| `/beds` | Per-facility occupancy today/tomorrow/next-week + bed-redirect recommendations |
| `/doctors` | Attendance risk table, absence patterns, patient-delay % + staff-transfer recommendations |
| `/diagnostics` | Test/equipment availability + nearest-alternative redirects + diagnostic-redirect recommendations |
| `/map` | Full-height district map + risk heatmap + legend; click a facility pin to open its detail drawer |
| `/facilities` | Sortable (risk / name / score) facility directory; row click opens detail drawer |
| `/analytics` | Causal "why" chain, AI timeline, performance scorecards |

`/` redirects to `/overview`.

## Role Switcher (no real auth, persona-scoped UI)
The Topbar's **Viewing as** control toggles between:
- **District Administrator** (default) — can Approve/Reject/Modify every recommendation.
- **PHC Staff** — recommendations render read-only ("Pending district administrator review"); framing is for facility-level data entry (not built out this pass).
- **State Health Officer** — read-only, district-wide analytics framing.

Gating lives in `frontend/src/lib/roleContext.tsx` (`roleCapabilities`) and is read by `RecommendationsPanel`.

## Command Palette (⌘K / Ctrl+K)
Global keyboard shortcut opens a searchable overlay (`CommandPalette.tsx`) that fuzzy-matches page names and facility names, with arrow-key navigation and Enter-to-jump.

## Primary User Flow — Approve a Recommendation
1. Admin lands on `/overview` → sees a 🔴 critical facility on the mini map / donut.
2. Navigates to `/map` or `/facilities`, clicks the facility → `FacilityDrawer` slides in with performance scorecard and (when the backend is reachable) live medicine/bed/doctor/diagnostic detail.
3. Navigates to `/recommendations` (or approves directly from the `/overview` pending list) → reviews the stock-transfer card with confidence and reasons.
4. Clicks **Modify** to adjust quantity, or **Approve** directly.
5. On approve: a toast confirms the action, the recommendation moves out of "pending" everywhere it's rendered (state is lifted into `RecommendationsProvider`, not per-component), the affected facility's risk level downgrades one step on `/overview` and `/map` (`useLiveFacilities`), and the transfer appears in the Resource Transfers log on `/recommendations`.

## Secondary Flow — Ask a Question
1. Admin opens the persistent "Ask SwasthyaGrid" panel (any page).
2. Types: "Which PHCs are at risk of an ORS stock-out this week?"
3. Gemini (via backend `/ask`, tool-calling into the same services) returns a grounded natural-language answer with a confidence indicator, or a graceful fallback message if no key/backend is configured.

## Interaction Principles
- **Nothing executes silently.** Every AI-suggested action requires an explicit click, gated by role.
- **Every number has a "why."** Predictions render alongside their confidence and factors.
- **Color is signal, not decoration** — reserved for risk states (see [08-design-system.md](08-design-system.md)); the rest of the UI stays in warm neutrals.
- **Motion is restrained** — Framer Motion used for page transitions, card approve/dismiss, the command palette, and drawers; never decorative.
- **Graceful degradation** — every page fetches from the FastAPI backend with a local-mock fallback (`frontend/src/lib/api.ts`); the dashboard never crashes or blanks out if the backend is down.

## Responsive Behavior
Desktop-first (this is an ops console used by administrators at a desk). The sidebar hides below `md` (768px); pages reflow to a single column.
