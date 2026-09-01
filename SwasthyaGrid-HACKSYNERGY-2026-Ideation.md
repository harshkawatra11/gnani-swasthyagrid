# SwasthyaGrid for HACKSYNERGY 2026

## AI District Health Operations Center and Citizen Services Network

### One-line vision

SwasthyaGrid is a proposed AI-assisted district health command system that helps public health administrators see operational risk early, understand why it is happening, and approve practical resource actions before a shortage becomes a patient crisis.

---

## 1. Executive Summary

SwasthyaGrid is designed for a simple but serious gap in public healthcare operations: district health systems often discover shortages after citizens have already felt the impact. A Primary Health Centre may run out of ORS during a heatwave. A rural facility may face rising fever cases while the next facility has surplus paracetamol. A maternity ward may approach full occupancy while a nearby CHC has spare capacity. A doctor absence pattern may quietly increase patient waiting time for weeks before a district administrator sees the full picture.

The idea behind SwasthyaGrid is to turn scattered facility-level information into a district-level operating picture. Each facility would report daily operational signals such as medicine stock, bed occupancy, doctor attendance, diagnostics availability, and patient footfall. SwasthyaGrid would combine those signals into forecasts, risk levels, explainable recommendations, and citizen-facing guidance.

The product is not positioned as an autonomous medical decision-maker. It is a decision-support system. The AI proposes, explains, and prioritizes. Human administrators approve, reject, or modify every operational action.

For HACKSYNERGY 2026, SwasthyaGrid should be presented as an ideation blueprint for a feasible, high-impact public health product. The existing codebase already demonstrates the core idea through a full-stack prototype with a Next.js dashboard, FastAPI backend, Gemini-assisted agents, district data services, resource recommendation workflows, and cloud-ready architecture.

### Submission fit

HACKSYNERGY 2026 allows PPT, PDF, and PPTS formats with a maximum of 10 slides and one submission per team. This document is therefore structured as a deep ideation source file first, and a slide-ready story blueprint second. The content is optimized for the stated evaluation criteria: clarity and feasibility.

---

## 2. The Problem Statement

### The visible problem

India's district health systems are the first line of care for millions of citizens, especially in semi-urban and rural areas. PHCs and CHCs manage everyday medical needs, emergency first response, medicine distribution, maternity support, diagnostic availability, and public health surveillance. Yet their operational visibility is often fragmented.

The district office may know that a facility has reported a shortage. It may not know that the shortage was predictable three days earlier. It may know that one PHC is crowded. It may not know that a nearby facility could absorb part of the load. It may receive medicine inventory updates. It may not have a live way to connect those updates with weather, disease trends, patient footfall, and nearby surplus.

### The deeper problem

Most health dashboards answer only one question: what happened?

SwasthyaGrid is built around three more useful questions:

1. What is likely to happen next?
2. Why is it likely to happen?
3. What action should a human administrator review now?

This shift matters because district healthcare is an operations problem as much as a medical problem. A medicine stock-out, doctor absence pattern, diagnostic machine failure, or bed overload can create avoidable delays even when the district technically has enough total resources. The failure is not always absence of resources. Often, it is absence of coordination.

### Problem in one sentence

District health administrators lack a unified, predictive, and explainable operating system for managing facility risk, resource redistribution, and citizen emergency guidance across PHCs and CHCs.

---

## 3. Who Faces This Problem

### District Administrator

The District Administrator needs to monitor multiple PHCs and CHCs at once. Their challenge is not reading one data point. Their challenge is deciding what needs attention first, which facility can help, and which recommendation is safe enough to act on.

SwasthyaGrid supports this role through:

- District overview and KPI strip
- Risk map and heatmap
- Alerts list
- Facility directory
- Facility detail drawer
- AI recommendations
- Approve, reject, and modify workflow
- Performance scorecards
- Ask SwasthyaGrid admin assistant

### PHC and CHC Staff

Facility staff are responsible for reporting local status, including stock, footfall, beds, doctors, and diagnostics. In the proposed operating model, their daily updates become the input layer for the district system.

The current app includes a role switcher that frames PHC staff as read-only in this prototype, while the larger system vision includes facility-level data intake through the companion SwasthyaGrid Intake CRM.

### State Health Officer

The State Health Officer needs district-wide analytics and oversight rather than direct facility operations. SwasthyaGrid supports this need through performance scorecards, causal analysis, trend visibility, and read-only district-level monitoring.

### Citizen or Patient

Citizens need fast, clear guidance during health uncertainty. They may need first-aid steps, 108 ambulance guidance, or the nearest PHC or hospital. SwasthyaGrid includes a Citizen Services layer that separates public assistance from internal district operations.

---

## 4. Proposed Product

### Product name

SwasthyaGrid

### Product category

AI District Health Operations Center with Citizen Services

### Product concept

SwasthyaGrid is a district-level command system that converts facility data into early warnings, operational forecasts, human-reviewed recommendations, and citizen support. It is built for public health administrators who need practical decisions, not another static reporting dashboard.

### Core product promise

SwasthyaGrid helps a district health team move from reactive reporting to proactive coordination.

Instead of waiting for a PHC to run out of medicine, the system estimates days remaining. Instead of showing only that a facility is crowded, it forecasts bed pressure. Instead of simply flagging a doctor absence, it connects the pattern to patient delay. Instead of presenting unexplained AI output, it gives confidence scores and reasons.

### Product analogy

SwasthyaGrid can be explained as Google Maps for district healthcare operations. It does not route cars. It routes attention, medicines, beds, diagnostics, and staff support across a district health network.

---

## 5. The Big Idea

The innovation is not that the product has a chatbot. The innovation is that it combines four layers into one operating model:

1. Predictive: forecast shortages, footfall, occupancy, and attendance risk before they become crises.
2. Prescriptive: recommend concrete resource actions such as stock transfers, bed redirects, staff transfers, and diagnostic redirects.
3. Explainable: show confidence and reasons with every forecast and recommendation.
4. Human-governed: require an administrator to approve, reject, or modify actions.

This is important for healthcare. Fully autonomous AI is not appropriate for public health operations. SwasthyaGrid keeps human responsibility at the center while using AI and automation to reduce delay, improve visibility, and make decisions easier to justify.

---

## 6. How SwasthyaGrid Works

### Step 1: Facility data enters the system

Each PHC or CHC reports operational information such as:

- Medicine stock
- Average medicine consumption
- Bed occupancy
- Doctor attendance
- Diagnostic or test availability
- Patient footfall

In the codebase, this is represented through district seed data and a Firestore-first repository. The broader ecosystem also includes a SwasthyaGrid Intake CRM that writes facility updates to shared Firestore.

### Step 2: The data layer refreshes safely

The backend repository is designed to read live Firestore data first. If Firestore is unavailable or empty, it falls back to bundled seed JSON. This gives the product a practical reliability pattern: the dashboard should continue to work even when a live data source is temporarily unavailable.

The repository refreshes on a short TTL, so updates from intake systems can flow into forecasts and recommendations without redeploying the backend.

### Step 3: Forecasting estimates operational risk

The ForecastService produces deterministic prototype forecasts:

- Medicine days remaining from stock and average daily consumption
- Footfall forecasts from historical and seasonal signals
- Bed occupancy forecasts from current occupancy and demand pressure
- Doctor attendance risk from absence patterns
- Facility risk levels from the worst current operational risk

Every prediction is paired with a confidence score and factors. This is a core contract of the product.

### Step 4: Recommendation logic searches for practical actions

The RecommendationService turns risk into reviewable actions. For example, if one PHC is at high risk of a medicine stock-out, the engine searches sibling facilities for surplus, ranks candidates by distance and surplus, calculates a transfer quantity, and emits a pending recommendation.

The same pattern supports:

- Stock transfer
- Bed redirect
- Staff transfer
- Diagnostic redirect

### Step 5: Gemini explains and answers, but does not invent the numbers

Gemini is used through the `google-genai` SDK as an explanation and question-answering layer. The admin HealthAgent can call district tools such as:

- `get_district_overview`
- `get_facility_detail`
- `get_medicine_stock`
- `get_footfall_forecast`
- `get_recommendations`
- `get_causal_chain`
- `get_performance_scores`

This design keeps forecasts and recommendations grounded in backend services. Gemini does not generate stock-out numbers from imagination. It explains the structured outputs already produced by the system.

### Step 6: A human administrator decides

Every recommendation starts as pending. The administrator can:

- Approve
- Reject
- Modify and approve

After a recommendation is resolved in the prototype UI, the interface updates the relevant facility risk display and records the action in the resource transfers log.

### Step 7: Citizens receive a separate support experience

The Citizen Services layer uses a separate PublicAgent with different tools. It can provide emergency first-aid guidance and help find nearby PHCs or hospitals through Google Maps Places API when configured, with mock fallback data for demos.

This separation matters. Citizens should not have access to internal district operations data. The system keeps public-facing guidance separate from administrator decision support.

---

## 7. Core Features From the App

### District Overview

The overview page acts as the district command center. It combines KPIs, the mini district map, risk distribution, top alerts, and the top pending recommendations. It is designed to help an administrator answer one question quickly: where should attention go first?

Key elements:

- KPI strip for district health signals
- District risk map
- Risk donut
- Top alerts
- Pending recommendation preview
- Links into deeper workflows

### Risk Map and Heatmap

The district map shows facilities by location and risk level. The heatmap gives a compact visual summary of how risk is distributed across the district. The map is not decorative. It is an operational view of geography, proximity, and urgency.

Risk levels include:

- Healthy
- Monitor
- Resource Stress
- Critical

The map supports facility selection and opens a detail drawer for deeper inspection.

### Facility Directory and Facility Drawer

The facility directory lets administrators sort facilities by risk, name, or score. Clicking a facility opens the facility drawer, which shows facility-level details such as risk, medicine stock, bed forecast, doctor data, diagnostics, and performance context.

This matters because a district officer should be able to move from macro view to facility evidence without leaving the workflow.

### Inventory Intelligence

The inventory page displays medicine stock forecasts across facilities. It shows:

- Facility ID
- Medicine name
- Units remaining
- Days remaining
- Risk
- Confidence

It also surfaces stock transfer recommendations. This is one of the strongest use cases because medicine stock-outs are measurable, urgent, and operationally solvable through redistribution.

### Footfall Forecast

The footfall page shows a seven-day patient demand forecast and demographic breakdown for tomorrow. It also shows confidence factors such as seasonality, historical footfall trend, nearby disease cluster signals, and weather forecast.

This helps the district anticipate pressure before queues and delays become visible.

### Bed Occupancy Forecast

The beds page shows current occupancy, tomorrow's forecast, next week's forecast, and confidence. It also links to bed redirect recommendations when a facility is likely to breach safe capacity.

### Doctor Attendance Risk

The doctors page identifies attendance risk, absence patterns, specialty, facility, and projected patient delay. This turns staffing visibility into operational risk management.

### Diagnostics Availability

The diagnostics page tracks test and equipment availability. When a test is unavailable or a machine has failed, the system can show nearest alternatives and diagnostic redirect recommendations.

### AI Recommendations

The recommendations page is the action workspace. It supports filtering by:

- Stock transfer
- Bed redirect
- Staff transfer
- Diagnostic redirect

Each recommendation includes:

- Source facility
- Target facility
- Subject
- Quantity or action detail
- Confidence
- Reasons
- Status

The key design choice is that recommendations are not silently executed. They are reviewed by a human.

### Resource Transfers Log

Approved actions appear in the Resource Transfers log. This gives the administrator a visible trail of what was acted upon. For a real deployment, this could become an audit record for operational accountability.

### Ask SwasthyaGrid

Ask SwasthyaGrid is the admin assistant. It lets an administrator ask operational questions in natural language. The assistant uses backend tools to answer from district services rather than relying on ungrounded model output.

Example questions:

- Which PHCs are at risk of an ORS stock-out this week?
- Why is PHC Rural-14 critical?
- Which facilities have the lowest performance scores?
- What recommendations are pending?

### Citizen Services

Citizen Services gives public-facing support for emergency guidance and nearby facility discovery. It uses a separate agent and tool set so that citizens can receive help without accessing internal admin data.

Capabilities include:

- Emergency guidance for symptoms such as chest pain, breathing difficulty, snake bite, fever, dehydration, and road accidents
- Strong direction to call 108 or emergency services for life-threatening cases
- Nearby PHC or hospital search using Google Maps Places API when configured
- Demo fallback data when the Maps key is unavailable

### Role Switcher

The app includes persona-scoped UI roles:

- District Administrator
- PHC Staff
- State Health Officer

Role capabilities guide whether recommendations are interactive or read-only. This communicates that the system is aware of decision authority.

### Command Palette

The command palette allows fast navigation through pages and facilities. This is useful for an operations console because administrators need speed, not just visual polish.

### Fallback States and Graceful Degradation

The frontend safely falls back to local mock data when the backend cannot be reached. The backend falls back to seed JSON when Firestore cannot be read. The AI assistants return graceful fallback messages if Gemini is not configured or unavailable.

This is a feasibility strength. The system is designed to demo reliably and degrade safely.

---

## 8. Technology Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Framer Motion for restrained route and UI transitions
- Recharts for charts and risk visualization
- Leaflet and React Leaflet for district mapping
- lucide-react for the icon system
- Next.js App Router for routed dashboard pages

### Backend

- Python 3.12
- FastAPI
- Uvicorn
- Pydantic and Pydantic Settings
- `google-genai` for Gemini integration
- `google-cloud-firestore` for Firestore access
- `httpx` for HTTP requests
- `tenacity` for retry handling
- Pytest for backend tests
- Ruff for linting

### Cloud, APIs, and deployment

- Vercel for frontend hosting
- Google Cloud Run for the FastAPI backend
- Firestore as the live shared data store
- Google Secret Manager for API keys
- Google Maps Places API for nearby facility search
- Gemini through `google-genai` for agentic explanation and natural-language support
- Docker for backend containerization
- GitHub Actions for CI checks

### Data architecture

- Firestore-first repository pattern
- Seed JSON fallback for reliability
- REST API between frontend and backend
- Shared service layer used by both REST endpoints and AI tools
- In-memory recommendation status for prototype workflow

---

## 9. Backend Architecture

### Clean service structure

The backend is organized into clear layers:

- API routers expose REST endpoints
- Services implement district logic, forecasting, and recommendations
- Repositories read district data from Firestore or seed JSON
- Tools wrap services for Gemini function calling
- Agents orchestrate admin and citizen AI interactions
- Schemas define request and response contracts
- Core config handles settings, logging, and exceptions

This structure is important because it avoids mixing AI prompts with business logic. The same forecast and recommendation rules are used whether a user opens a dashboard page or asks a question through the assistant.

### Key REST endpoints

The API supports:

- `GET /health`
- `GET /ready`
- `GET /api/v1/district`
- `GET /api/v1/facilities`
- `GET /api/v1/facilities/{facility_id}`
- `GET /api/v1/medicines`
- `GET /api/v1/footfall/forecast`
- `GET /api/v1/beds/forecast`
- `GET /api/v1/doctors/attendance`
- `GET /api/v1/diagnostics`
- `GET /api/v1/recommendations`
- `POST /api/v1/recommendations/{rec_id}/approve`
- `POST /api/v1/recommendations/{rec_id}/reject`
- `POST /api/v1/recommendations/{rec_id}/modify`
- `GET /api/v1/alerts`
- `GET /api/v1/analytics/causal-chain/{facility_id}`
- `GET /api/v1/performance`
- `POST /api/v1/ask`
- `POST /api/v1/public-chat`

### Health and security details

The backend includes:

- CORS configuration for frontend access
- Health and readiness endpoints
- Security headers such as `X-Content-Type-Options`, HSTS, `X-Frame-Options`, and XSS protection
- Domain exception handling for facility and recommendation errors

---

## 10. AI Design and Safety

### What AI does

AI helps translate structured operational data into understandable explanations. It supports natural-language questions and helps users navigate complex district data.

### What AI does not do

AI does not independently execute transfers, staff moves, diagnostic redirects, or emergency decisions. The product is not claiming that Gemini replaces administrators, doctors, or emergency services.

### Why this matters

In public healthcare, trust is built through auditability and restraint. SwasthyaGrid makes AI useful by narrowing its job:

- Explain the system's evidence
- Help administrators query information
- Support citizens with general guidance
- Escalate emergencies to real services
- Keep humans responsible for operational decisions

### Dual-agent model

SwasthyaGrid separates admin and public capabilities:

- HealthAgent for district administrators
- PublicAgent for citizens

The HealthAgent can access district operations tools. The PublicAgent can access emergency guidance and nearby facility tools. This separation reduces the risk of exposing operational data to public users.

---

## 11. Forecasting and Recommendation Logic

### Current prototype behavior

The current forecasting approach is deterministic and intentionally auditable:

- Medicine risk is calculated from units remaining and average daily consumption.
- Footfall forecast uses seeded trend and factor data.
- Bed forecast relates occupancy to expected demand.
- Doctor attendance risk uses absence patterns.
- Facility risk is derived from inventory, beds, doctors, and diagnostics.

This is appropriate for a hackathon prototype because it demonstrates the workflow without pretending to have trained a production medical model.

### Current recommendation behavior

The recommendation engine follows a practical sequence:

1. Detect a facility risk.
2. Search nearby or sibling facilities for capacity or surplus.
3. Rank possible support options.
4. Calculate a concrete action.
5. Emit a pending recommendation with confidence and reasons.
6. Wait for a human administrator to resolve it.

### Future production behavior

In a scaled version, forecasting could move to:

- Vertex AI for trained XGBoost or LightGBM models
- BigQuery for historical district analytics
- Cloud Scheduler and Cloud Functions for batch forecast recomputation
- Pub/Sub for real-time facility update events
- Prediction intervals for better confidence scoring

The current architecture already isolates forecasting behind a service interface, so this transition would not require a full rewrite.

---

## 12. Data Model

SwasthyaGrid organizes the district around a small set of operational entities:

### District

Represents the administrative region, its facilities, and overall context.

### Facility

Represents a PHC or CHC with location, type, bed capacity, performance scores, and risk level.

### Medicine stock

Tracks medicine name, units remaining, consumption rate, days remaining, reorder threshold, and risk.

### Footfall forecast

Tracks actual and predicted patient counts, confidence, and demographic breakdown.

### Bed status

Tracks occupied beds, total beds, current occupancy, tomorrow's forecast, and next week's forecast.

### Doctor attendance

Tracks doctor identity, specialty, attendance pattern, risk level, and patient delay impact.

### Diagnostic availability

Tracks tests or equipment, availability status, nearest alternative facility, and distance.

### Recommendation

Tracks recommended action type, source facility, target facility, subject, quantity or action detail, confidence, reasons, and status.

### Alert

Tracks facility risk signals that need administrator attention.

### Causal chain

Explains why a demand spike or operational risk may be happening.

---

## 13. User Journey for the Demo Story

### Scene

PHC Rural-14 uploads its morning operational status. It has low paracetamol stock and low ORS reserves. The district is also facing heat and disease pressure signals.

### What SwasthyaGrid detects

The system forecasts that medicine stock may run out soon. It classifies the facility as critical and surfaces the issue on the district overview and map.

### What SwasthyaGrid recommends

It searches for a facility with surplus, identifies a practical source facility, calculates a transfer quantity, and creates a pending stock transfer recommendation with confidence and reasons.

### What the administrator sees

The administrator sees:

- The critical facility on the map
- The alert in the overview
- The pending recommendation
- The confidence score
- The reasons behind the action
- The option to approve, reject, or modify

### What happens after approval

The UI records the action in the Resource Transfers log and updates the facility risk view to show operational improvement.

### Why this story works for judges

It is concrete. It shows a before and after. It proves the product is not just visualizing data, but turning data into a reviewable operational action.

---

## 14. Business and Public Value

### Value for administrators

- Faster visibility into facility risk
- Better prioritization across PHCs and CHCs
- More defensible decisions through reasons and confidence
- Reduced manual coordination burden
- Clear action tracking

### Value for facilities

- Earlier support before local shortages become crises
- Better coordination with nearby facilities
- Visibility into how local data influences district action
- Reduced pressure on overburdened staff

### Value for citizens

- Faster emergency guidance
- Clear direction to 108 for life-threatening cases
- Easier discovery of nearby PHCs and hospitals
- Better chance that local facilities are stocked and staffed before demand peaks

### Value for government health systems

- More efficient resource redistribution
- Better district-level preparedness
- Explainable AI adoption pattern
- Upgrade path into analytics, forecasting, and public health surveillance

---

## 15. Feasibility

### Why the idea is feasible

SwasthyaGrid is feasible because it does not depend on unrealistic assumptions. It starts with data that facilities already understand: stock, beds, attendance, diagnostics, and footfall. It uses deterministic forecasting in the prototype, clear heuristics for recommendations, and a human approval layer for decisions.

The architecture also separates concerns well:

- The frontend renders workflows.
- The backend owns business logic.
- The repository abstracts the data source.
- The recommendation engine proposes actions.
- Gemini explains and answers.
- Humans approve operational decisions.

### Why this is stronger than a generic AI dashboard

A generic dashboard shows charts. SwasthyaGrid connects those charts to action. A generic chatbot answers questions. SwasthyaGrid constrains AI to grounded tools. A generic prediction model gives a number. SwasthyaGrid pairs every number with confidence and reasons.

### Risks and mitigation

| Risk | Mitigation |
|---|---|
| Facility data may be incomplete | Use fallback states, required reporting workflows, and confidence scores that reflect data quality |
| AI output may be trusted too much | Keep AI explanatory, require human approval, show evidence and confidence |
| Connectivity may be unreliable | Use seed fallback, cached reads, and graceful UI degradation |
| Recommendations may not consider all real-world constraints | Start with administrator review, then add logistics, inventory policy, and procurement rules |
| Citizens may mistake guidance for medical advice | Always direct emergencies to 108 and clearly position guidance as general first-aid support |

---

## 16. Implementation Roadmap

### Phase 1: Hackathon ideation and prototype demonstration

- Present the product story and 10-slide deck.
- Demonstrate district overview, map, recommendations, and citizen services.
- Show human approval as the central governance mechanism.
- Use current deterministic services and seeded district data.

### Phase 2: Pilot-ready district workflow

- Connect facility intake workflows more tightly with Firestore.
- Add authenticated facility and administrator roles.
- Store recommendation resolution history persistently.
- Add basic audit logs for every approved, rejected, or modified action.
- Improve data validation for facility submissions.

### Phase 3: Production intelligence layer

- Train forecasting models using district historical data.
- Use Vertex AI for model registry and serving.
- Use BigQuery for trend analysis.
- Add Pub/Sub for real-time facility update events.
- Add Cloud Scheduler for periodic forecast refresh.

### Phase 4: Public and government scale

- Add multilingual support for Hindi, Tamil, Kannada, and other regional languages.
- Add WhatsApp access for citizens without full web access.
- Add FHIR-compatible API endpoints for health data interoperability.
- Add state-level dashboards for cross-district benchmarking.
- Add telemedicine integrations where appropriate.

---

## 17. Evaluation Alignment

### Clarity

SwasthyaGrid has a clear problem, user, workflow, and product thesis. It can be explained without technical jargon:

Public health facilities report daily status. The system forecasts risk. It recommends what can be moved where. The administrator reviews the reasoning and approves action.

### Feasibility

The app is technically feasible because the architecture already maps to standard web, API, cloud, and data services. The prototype uses Next.js, FastAPI, Firestore, Google Cloud Run, Vercel, Google Maps, and Gemini through `google-genai`. The system can operate with seeded data for demonstrations and transition to live Firestore data for pilot use.

### Innovation

The product is innovative because it treats healthcare operations as a coordinated district network. It does not stop at analytics. It connects prediction to practical redistribution while keeping humans in control.

### Impact

The impact is measurable through:

- Fewer stock-outs
- Lower patient waiting time
- Better bed utilization
- Faster diagnostic redirects
- Improved district preparedness
- More accountable AI-supported decisions

---

## 18. 10-Slide Presentation Blueprint

### Slide 1: Title and Vision

**Title:** SwasthyaGrid  
**Subtitle:** AI District Health Operations Center and Citizen Services Network  
**Core message:** A district health system should know about a shortage before citizens suffer from it.

Visual idea:

- District map with risk points
- One sentence vision
- Team and HACKSYNERGY 2026 label

Speaker note:

SwasthyaGrid is not another health chatbot. It is an operating layer for district healthcare coordination.

### Slide 2: Problem and Urgency

**Headline:** PHCs do not fail alone. They fail when the district cannot see risk early enough.

Key points:

- Facility data is fragmented.
- Shortages are discovered late.
- Bed, medicine, diagnostic, and doctor risks are connected but tracked separately.
- Administrators need early warning and action options, not only reports.

Speaker note:

The crisis is often not total absence of resources. It is poor visibility and delayed redistribution.

### Slide 3: Stakeholders and Pain Points

**Headline:** One system, four users.

Stakeholders:

- District Administrator: needs prioritization and action.
- PHC and CHC Staff: need simple reporting and support.
- State Health Officer: needs oversight and performance visibility.
- Citizen: needs emergency guidance and nearby care.

Speaker note:

The product is designed around real roles in the public health chain.

### Slide 4: Proposed Solution

**Headline:** From scattered facility updates to a district command center.

Show the four-part value proposition:

- Predictive: what will happen
- Prescriptive: what action is recommended
- Explainable: why it is recommended
- Human-governed: who approves it

Speaker note:

The AI proposes. The human decides.

### Slide 5: How It Works

**Headline:** Data to forecast to recommendation to approved action.

Flow:

1. Facility reports stock, beds, doctors, diagnostics, and footfall.
2. Backend refreshes Firestore or seed data.
3. Forecast engine estimates risk.
4. Recommendation engine finds redistribution options.
5. Gemini explains through grounded tool calls.
6. Administrator approves, rejects, or modifies.
7. Citizen layer gives separate emergency and nearby PHC support.

Speaker note:

This workflow is feasible because each step maps to an existing service boundary.

### Slide 6: AI and Innovation Model

**Headline:** Safe AI for public health operations.

Key points:

- Gemini is used for explanation and natural-language interaction.
- Forecast numbers come from backend services.
- Recommendations are pending by default.
- Admin and citizen agents are separated.
- Every forecast and recommendation carries confidence and reasons.

Speaker note:

This is grounded AI, not black-box automation.

### Slide 7: Product Features

**Headline:** The dashboard turns district risk into action.

Feature grid:

- Overview and KPI strip
- Risk map and heatmap
- Facility directory and drawer
- Inventory, beds, doctors, diagnostics
- Footfall forecast
- AI recommendations
- Resource transfers log
- Ask SwasthyaGrid
- Citizen Services

Speaker note:

The product is not a single page. It is a full operational workflow.

### Slide 8: Technology Stack and Architecture

**Headline:** Built on practical, deployable technology.

Stack:

- Next.js 16, React 19, TypeScript, Tailwind CSS 4
- FastAPI, Python 3.12, Pydantic, Uvicorn
- Firestore, Cloud Run, Vercel, Secret Manager
- Gemini through `google-genai`
- Google Maps Places API
- Recharts, Leaflet, Framer Motion
- Docker and GitHub Actions

Architecture point:

Frontend talks to REST APIs. APIs call services. Services use repositories. Agents call tools that wrap services.

Speaker note:

The system is designed so prototype logic can later be replaced by production models without rewriting the product.

### Slide 9: Feasibility and Roadmap

**Headline:** Prototype now, production path later.

Roadmap:

- Hackathon: seeded data, deterministic forecasts, heuristic recommendations
- Pilot: live facility intake, persistent approvals, authenticated roles
- Scale: Vertex AI, BigQuery, Pub/Sub, multilingual access
- Public expansion: WhatsApp, FHIR-compatible APIs, state dashboards

Speaker note:

The plan is credible because it starts narrow and expands through clear architecture choices.

### Slide 10: Impact and Closing Pitch

**Headline:** A smarter district health system saves time before it saves lives.

Impact:

- Earlier stock-out prevention
- Better use of existing resources
- Lower waiting time
- Faster emergency guidance
- Transparent AI-supported governance

Closing line:

SwasthyaGrid helps public health teams act before the crisis reaches the patient.

---

## 19. Suggested Submission Abstract

SwasthyaGrid is an AI-assisted district health operations concept for HACKSYNERGY 2026. It helps administrators monitor PHCs and CHCs, forecast operational risk, and review explainable recommendations for medicine transfers, bed redirects, staff support, and diagnostic alternatives. The product combines a district command dashboard with a citizen services layer for emergency guidance and nearby facility search. Its core design principle is human-governed AI: the system proposes and explains, while administrators approve, reject, or modify every action. The architecture uses a Next.js frontend, FastAPI backend, Firestore-ready data layer, Gemini-powered tool-calling agents, and cloud deployment patterns through Vercel and Google Cloud Run. SwasthyaGrid is designed to be practical for a hackathon prototype and extensible into a real public health coordination system.

---

## 20. Judge-Facing Differentiators

### Differentiator 1: It solves an operations problem, not just an information problem

The product does not simply show data. It turns risk into recommended action.

### Differentiator 2: It is human-governed by design

Every recommendation requires explicit review. This makes the system more credible for public health.

### Differentiator 3: It separates admin intelligence from citizen assistance

The admin agent and public agent use different tools. This protects operational boundaries.

### Differentiator 4: It is explainable at the contract level

Confidence and reasons are not presentation polish. They are part of how forecasts and recommendations are structured.

### Differentiator 5: It has a credible path from prototype to deployment

The repo already uses deployable technologies and has a clear path toward Firestore, Cloud Run, Vertex AI, BigQuery, Pub/Sub, and multilingual access.

---

## 21. Final Narrative

SwasthyaGrid begins with a realistic moment: a rural PHC updates its morning stock and attendance. Alone, that update is just a record. In SwasthyaGrid, it becomes a signal.

The system sees that medicine stock is running low. It checks demand pressure. It estimates days remaining. It compares nearby facilities. It finds a practical transfer. It creates a recommendation. It explains the reasons. It waits for a human.

That is the product's central belief: public health AI should not replace judgment. It should bring the right facts to the right person early enough for judgment to matter.

For HACKSYNERGY 2026, SwasthyaGrid should be presented as a feasible, original, and socially meaningful idea: a district health grid that connects facilities, administrators, and citizens through predictive visibility, practical recommendations, and responsible AI governance.
