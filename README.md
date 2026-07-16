<div align="center">

<br/>

# SwasthyaGrid AI

### *An Intelligent District Health Operations Center & Citizen Portal*

**Predictive · Prescriptive · Explainable · Human-Governed · Citizen-Centric**

Built for **GDG BuildWithAI 2025** · India's District Health Crisis, Solved.

<br/>

[![Live App](https://img.shields.io/badge/Live_App-swasthyagrid.vercel.app-3f6b4a?style=for-the-badge&logo=vercel&logoColor=white)](https://swasthyagrid.vercel.app)
[![Cloud Run](https://img.shields.io/badge/Backend-Cloud_Run_asia--south1-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)](https://swasthyagrid-api-616415200021.asia-south1.run.app/docs)
[![Gemini](https://img.shields.io/badge/Gemini_2.5_Flash-AI_Engine-b5502e?style=for-the-badge&logo=google&logoColor=white)](#-ai-engine--gemini-25-flash)

<br/>

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js_15-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Google Maps](https://img.shields.io/badge/Google_Maps_API-4285F4?style=for-the-badge&logo=googlemaps&logoColor=white)](#-powered-by-google-technologies)

<br/>

[Overview](#-overview) · [Live Demo](#-live-deployment) · [Architecture](#-architecture) · [AI Engine](#-ai-engine--gemini-25-flash) · [Quickstart](#-running-locally) · [Deploy](#-deployment)

</div>

---

## 🌐 Live Deployment

> **This is not a mockup.** SwasthyaGrid AI is a fully functional, production-ready prototype deployed end-to-end on Google Cloud — including the facility data portal that feeds it.

| Component | Technology | Status |
| :--- | :--- | :--- |
| **Frontend** | Next.js 15 on **Vercel** | 🟢 [swasthyagrid.vercel.app](https://swasthyagrid.vercel.app) |
| **Backend API** | FastAPI on **Google Cloud Run** (asia-south1) | 🟢 [API Docs](https://swasthyagrid-api-616415200021.asia-south1.run.app/docs) |
| **Data source** | **[SwasthyaGrid Intake](https://swasthyagrid-crm.vercel.app)** — facility CRM ([repo](https://github.com/harshkawatra11/SwasthyaGrid-CRM)) | 🟢 Role-based login, writes to shared **Firestore** |
| **AI Intelligence** | **Gemini 2.5 Flash** (function calling) | 🟢 Live via `google-genai` SDK |
| **Secrets** | **Google Secret Manager** | 🟢 Zero hardcoded secrets |
| **Maps** | **Google Maps Places API** | 🟢 Nearest PHC routing |

### Where does the data come from?

Every PHC/CHC gets a login to **[SwasthyaGrid Intake](https://swasthyagrid-crm.vercel.app)** — a companion app, its own repo, its own Vercel deployment — where staff report medicine stock, bed occupancy, doctor attendance, and patient footfall each morning. Those writes land in a shared **Firestore** database (`swasthyagrid-ai-54886`). This backend's `DistrictRepository` reads that same Firestore on a short TTL (≤20s), so a facility's edit propagates into the forecast engine, the recommendation engine, and the district map here — live, with no redeploy. If Firestore is ever unreachable, the backend falls back to its bundled seed JSON so the console never breaks.

---

## 📖 Overview

Primary Health Centres (PHCs) across India operate in isolation — medicine stock-outs, unmanaged footfall, and bed shortages are tracked manually on paper. By the time a District Medical Officer hears about a crisis, **it has already happened.**

**SwasthyaGrid AI** solves this from two angles:

| Layer | Who it Serves | What it Does |
|:---|:---|:---|
| 🏛️ **Admin Dashboard** | District Officers | Predictive forecasting, prescriptive resource routing, human-governed AI recommendations |
| 🏥 **Citizen Portal** | Patients & Citizens | Real-time emergency guidance (108), GPS-based nearest PHC finder |

> *"Think of SwasthyaGrid as Google Maps for district healthcare — routing medicines, doctors, beds, and citizens before a crisis occurs."*

---

## 🏗️ Architecture

### System Diagram

```
                    ┌─────────────────────────────────┐
                    │       District Officer           │
                    │    (Browser / Mobile Web)        │
                    └──────────────┬──────────────────┘
                                   │ HTTPS
                    ┌──────────────▼──────────────────┐
                    │    Next.js 15  (Vercel Edge)     │
                    │  /overview  /recommendations      │
                    │  /citizen   /api/public-ask       │
                    └──────────────┬──────────────────┘
                                   │ REST (JSON)
                    ┌──────────────▼──────────────────┐
                    │   FastAPI  (Google Cloud Run)    │
                    │         asia-south1              │
                    └───┬──────────┬────────┬─────────┘
                        │          │        │
            ┌───────────▼──┐  ┌────▼────┐  ┌▼──────────────────┐
            │ Forecast      │  │ Recom-  │  │  AI Agents         │
            │ Engine        │  │ mendati │  │  HealthAgent       │
            │ (Deterministic│  │ on      │  │  PublicAgent       │
            │  Haversine)   │  │ Engine  │  │  (Gemini 2.5 Flash)│
            └───────────────┘  └─────────┘  └──────┬────────────┘
                                                    │
                         ┌──────────────────────────┤
                         │                          │
                ┌────────▼───────┐     ┌────────────▼──────┐
                │ Google Secret  │     │  Google Maps       │
                │ Manager        │     │  Places API        │
                │ (API Keys)     │     │  (Nearest PHC)     │
                └────────────────┘     └───────────────────┘
```

### AI Agent Architecture (Gemini Function Calling)

```
User / District Officer
        │
        ▼
  HealthAgent / PublicAgent
        │
        ├──── Gemini 2.5 Flash ◄──── System Prompt (healthcare rules)
        │            │
        │      Tool Call Request?
        │            │
        │     ┌──────▼─────────────────────────────────┐
        │     │           Tool Registry                 │
        │     │  get_district_overview()                │
        │     │  get_facility_detail(facility_id)       │
        │     │  get_medicine_stock()                   │
        │     │  get_footfall_forecast()                │
        │     │  get_recommendations()                  │
        │     │  get_emergency_guidance(condition) ←─── Citizen
        │     │  find_nearby_phc(lat, lon)    ←──────── Citizen
        │     └──────┬──────────────────────────────────┘
        │            │
        │     Tool Result → Feed back to Gemini
        │            │
        └──────► Final Response (structured JSON)
```

### Agentic Chat Flow

```
Client         Next.js          FastAPI          HealthAgent        Gemini
  │               │                 │                 │                │
  │──POST /ask──► │                 │                 │                │
  │               │──POST /api/v1/ask──►              │                │
  │               │                 │────agent.ask()─►│                │
  │               │                 │                 │──generate────► │
  │               │                 │                 │◄─tool_call──── │
  │               │                 │                 │──execute tool  │
  │               │                 │                 │──feed result──►│
  │               │                 │                 │◄──response──── │
  │               │◄──{answer,conf}─│                 │                │
  │◄──JSON────────│                 │                 │                │
```

---

## 📁 Project Structure

```
ai-healthcare-platform/
├── backend/                          # FastAPI Python backend
│   ├── app/
│   │   ├── main.py                   # FastAPI app factory + CORS + error handlers
│   │   ├── api/
│   │   │   ├── deps.py               # Dependency injection (HealthAgent, PublicAgent)
│   │   │   └── v1/
│   │   │       ├── health.py         # GET /health, /ready
│   │   │       ├── chat.py           # POST /api/v1/ask (admin AI)
│   │   │       ├── public_chat.py    # POST /api/v1/public-chat (citizen AI)
│   │   │       └── routes.py         # District data REST endpoints
│   │   ├── agents/
│   │   │   ├── health_agent.py       # Admin AI (district tools only)
│   │   │   └── public_agent.py       # Citizen AI (emergency + maps only)
│   │   ├── core/
│   │   │   ├── config.py             # Pydantic Settings (env vars)
│   │   │   ├── logging.py            # Logging configuration
│   │   │   └── exceptions.py         # Domain exception hierarchy
│   │   ├── tools/
│   │   │   ├── district_tools.py     # Admin: forecast, recommendations, facilities
│   │   │   ├── emergency_tool.py     # Citizen: first-aid guidance, 108 routing
│   │   │   └── maps_tool.py          # Citizen: Google Maps nearest PHC finder
│   │   ├── services/                 # Business logic layer
│   │   ├── repositories/             # Data access layer
│   │   ├── schemas/                  # Pydantic DTOs (AskRequest, AskResponse)
│   │   └── prompts/
│   │       └── system_prompt.py      # Gemini system prompt
│   ├── data/
│   │   └── seed_district.json        # District seed data (50 PHCs)
│   ├── Dockerfile                    # Multi-stage, non-root production image
│   └── requirements.txt
│
├── frontend/                         # Next.js 15 frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── overview/         # Command center KPIs
│   │   │   │   ├── recommendations/  # AI recommendations + approve/reject
│   │   │   │   ├── inventory/        # Medicine stock forecasting
│   │   │   │   ├── beds/             # Bed availability
│   │   │   │   ├── doctors/          # Doctor availability
│   │   │   │   ├── footfall/         # Patient demand forecasting
│   │   │   │   ├── map/              # District spatial map
│   │   │   │   ├── facilities/       # All PHCs table
│   │   │   │   ├── analytics/        # Causal analytics
│   │   │   │   ├── diagnostics/      # Equipment availability
│   │   │   │   └── citizen/          # Citizen portal (emergency + maps)
│   │   │   ├── api/
│   │   │   │   ├── ask/route.ts      # Proxy → backend /api/v1/ask
│   │   │   │   └── public-ask/route.ts # Proxy → backend /api/v1/public-chat
│   │   │   └── globals.css           # Design tokens (parchment palette)
│   │   ├── components/
│   │   │   ├── shell/                # Sidebar, Topbar, layout shell
│   │   │   ├── AskPanel.tsx          # Admin AI chat (floating button)
│   │   │   ├── PublicAskPanel.tsx    # Citizen AI chat (embedded)
│   │   │   └── ...                   # Domain components
│   │   └── data/
│   │       └── district.ts           # Type-safe district data
│   └── package.json
│
├── docs/                             # Engineering documentation
│   ├── 00-vision.md
│   ├── 01-architecture.md
│   ├── 03-api-contract.md
│   ├── 05-ai-engine.md
│   └── 09-gcp-deployment.md
└── pitch-deck.html                   # Self-contained HTML pitch deck
```

---

## ⚡ Powered by Google Technologies

### 🧠 Gemini 2.5 Flash — Dual-Agent Architecture

SwasthyaGrid runs **two isolated Gemini agents**:

| Agent | Audience | Tools Available |
|:---|:---|:---|
| `HealthAgent` | District Officers | `get_district_overview`, `get_facility_detail`, `get_medicine_stock`, `get_footfall_forecast`, `get_recommendations`, `get_causal_chain`, `get_performance_scores` |
| `PublicAgent` | Citizens / Patients | `get_emergency_guidance` (first-aid + 108), `find_nearby_phc` (Maps API) |

Security isolation is enforced by design — citizens cannot access operational district data.

### ☁️ Google Cloud Run (Serverless Backend)

FastAPI backend deployed on **Cloud Run (asia-south1)** with:
- Zero-downtime deployments via Cloud Build
- Automatic HTTPS and load balancing
- Pay-per-request scaling to zero

### 🔐 Google Secret Manager

Zero hardcoded secrets. The `GEMINI_API_KEY` is injected at runtime from Secret Manager into the Cloud Run container.

### 🗺️ Google Maps Places API

The Citizen Portal calls the **Places Nearby API** to locate the nearest functional PHC/hospital based on the user's GPS coordinates, with haversine fallback sorting.

### 🚀 Phase 3: Vertex AI Scale Path

The architecture is designed to scale into **Vertex AI** for XGBoost/LightGBM forecasting models, **BigQuery** for historical trend analysis, and **Pub/Sub** for real-time event streaming.

---

## 🛡️ Core Principle: AI Proposes, Humans Decide

In public healthcare, autonomous AI is a liability. The `HealthAgent` acts strictly as an **Agentic Decision Support System**.

```
┌─────────────────────────────────────────────────────────────┐
│  🚨 STOCK TRANSFER RECOMMENDATION · PHC Sector-12 → Rural-14 │
│                                                              │
│  💊 Paracetamol · Transfer 250 strips             96% ●●●●  │
│                                                   CONFIDENCE │
│                                                              │
│  REASONING:                                                  │
│  — Projected stock depletion at Rural-14 in 3.4 days        │
│  — Impending rain forecast increasing fever cases            │
│  — PHC Sector-12 holds a surplus 650 strips (6 km away)     │
│                                                              │
│       [ ✅ Approve ]    [ ✏️ Modify ]    [ ❌ Reject ]        │
└──────────────────────────────────────────────────────────────┘
```

---

## 🏥 Dashboard Capabilities

| Module | Description |
|:---|:---|
| 📍 **District Map** | Live spatial view of all PHCs colored by risk level (🟢🟡🟠🔴) |
| 📊 **Overview Console** | Command-center KPIs, pending alerts, AI timeline |
| 📦 **Inventory** | Medicine stock forecasting with depletion curves |
| 🛏️ **Beds** | Real-time occupancy by ward type across all facilities |
| 👨‍⚕️ **Doctors** | Staff attendance risk and availability tracking |
| 🔬 **Diagnostics** | Lab equipment availability across the district |
| 📈 **Analytics** | Causal chain analysis explaining demand spikes |
| 🧠 **Recommendations** | AI-generated ranked resource-redistribution actions |
| 🏥 **Citizen Portal** | Emergency first-aid guidance + nearest PHC routing |

---

## 🖥️ Running Locally

### Prerequisites
- Python 3.12+ and Node.js 18+
- A Gemini API key from [Google AI Studio](https://aistudio.google.com)
- (Optional) A Google Maps API key for live PHC routing

### 1. Backend

```bash
cd backend
python -m venv .venv

# Windows
.\.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt

# Create .env file
echo 'GEMINI_API_KEY="your-gemini-key"' > .env
echo 'GOOGLE_MAPS_API_KEY="your-maps-key"' >> .env   # optional

uvicorn app.main:app --reload --port 8080
```

API docs at → **[http://localhost:8080/docs](http://localhost:8080/docs)**

### 2. Frontend

```bash
cd frontend
npm install

# Create .env.local
echo 'GEMINI_API_KEY="your-gemini-key"' > .env.local

npm run dev
```

Open → **[http://localhost:3000](http://localhost:3000)**

> The dashboard runs on mock data out of the box. The **Ask SwasthyaGrid** panel and **Citizen Portal** activate automatically with your Gemini API key.

---

## 🌩️ Deployment

### Backend → Google Cloud Run

```bash
# Authenticate
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Build & push image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/swasthyagrid-api:latest ./backend

# Deploy to Cloud Run
gcloud run deploy swasthyagrid-api \
  --image gcr.io/YOUR_PROJECT_ID/swasthyagrid-api:latest \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars="ENVIRONMENT=production,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID" \
  --set-secrets="GEMINI_API_KEY=gemini-api-key:latest"
```

### Frontend → Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
# Set GEMINI_API_KEY and NEXT_PUBLIC_API_URL in Vercel dashboard
```

### Environment Variables

| Variable | Where | Description |
|:---|:---|:---|
| `GEMINI_API_KEY` | Backend `.env` / Secret Manager | Gemini 2.5 Flash API key |
| `GOOGLE_MAPS_API_KEY` | Backend `.env` / Cloud Run | Maps Places API for PHC routing |
| `GEMINI_API_KEY` | Frontend `.env.local` | For the Ask panel (Next.js route handler) |
| `NEXT_PUBLIC_API_URL` | Frontend `.env.local` / Vercel | Backend base URL (e.g. Cloud Run URL) |

---

## 🤖 AI Engineering Patterns

| Pattern | Implementation |
|:---|:---|
| **Dual-Agent Isolation** | `HealthAgent` (admin) and `PublicAgent` (citizen) are completely separate with different tool sets |
| **Tool Calling** | Gemini function declarations with automatic dispatch loop |
| **Agentic Loop** | Max 5 iterations with graceful fallback to static message |
| **System Prompt** | Carefully crafted healthcare-safety rules per agent |
| **Emergency Detection** | Keyword matching → proactive 108 guidance |
| **Graceful Fallback** | Mock responses when API key unavailable |
| **Security by Design** | Citizens cannot access operational district data |

---

## 📚 Engineering Documentation

Every architectural decision was documented before a single line of code was written:

- [`00-vision.md`](docs/00-vision.md) — Product philosophy & human-in-the-loop design
- [`01-architecture.md`](docs/01-architecture.md) — System architecture & GCP integration
- [`03-api-contract.md`](docs/03-api-contract.md) — REST API documentation
- [`05-ai-engine.md`](docs/05-ai-engine.md) — How Gemini is used safely in healthcare
- [`09-gcp-deployment.md`](docs/09-gcp-deployment.md) — Cloud Run deployment & Vertex AI scale path

---

## 🚀 Roadmap

- [x] Facility data portal with role-based login — **[SwasthyaGrid Intake](https://github.com/harshkawatra11/SwasthyaGrid-CRM)**, writing to a shared Firestore
- [ ] Migrate CRM to Firebase Authentication + client-scoped security rules (currently server-only JWT sessions, since Identity Platform wasn't enabled)
- [ ] Vertex AI for XGBoost stock-out forecasting
- [ ] BigQuery for historical district analytics
- [ ] WhatsApp bot for rural citizens (no smartphone required)
- [ ] Pub/Sub for real-time cross-district event streaming
- [ ] NLP support for Hindi, Tamil, Kannada
- [ ] FHIR-compliant API endpoints
- [ ] Telemedicine video call integration

---

<div align="center">

*SwasthyaGrid AI — Because a district health system should know about a stock-out three days before it happens, not three days after.*

**[swasthyagrid.vercel.app](https://swasthyagrid.vercel.app) · Built for GDG BuildWithAI 2025**

</div>
