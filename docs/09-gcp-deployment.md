# 09 — GCP Deployment

## Status
**Live.** The backend is deployed and serving production traffic.

| | |
|---|---|
| Project | `swasthyagrid-ai-54886` |
| Region | `asia-south1` |
| Cloud Run service | `swasthyagrid-api` |
| Backend URL | https://swasthyagrid-api-616415200021.asia-south1.run.app |
| Firestore | Native mode, `asia-south1` — **live source of truth**, shared with the SwasthyaGrid Intake CRM. `DistrictRepository` reads it with a ≤20s TTL and falls back to the bundled seed JSON if unreachable. |
| Secret Manager | `gemini-api-key` — the real Gemini key, active |
| Frontend | https://swasthyagrid.vercel.app (Vercel), `NEXT_PUBLIC_API_BASE` points at the Cloud Run URL above — verified via live network requests that the dashboard fetches real backend data in production |
| Data source (CRM) | **[SwasthyaGrid Intake](https://swasthyagrid-crm.vercel.app)** ([repo](https://github.com/harshkawatra11/SwasthyaGrid-CRM)) — separate Next.js app, separate Vercel project, separate GitHub repo. Facility/admin logins write to the same Firestore project via the Firebase Admin SDK from a dedicated `crm-intake` service account (`roles/datastore.user` only). Firestore security rules are deployed **deny-all** for direct client access — every read/write goes through server-side API routes (CRM) or the Admin SDK service account (this backend). |

To activate the live "Ask" feature on the backend, replace the placeholder secret:
```bash
printf '%s' 'your-real-gemini-key' | gcloud secrets versions add gemini-api-key --data-file=- --project=swasthyagrid-ai-54886
```
No redeploy needed — Cloud Run reads `gemini-api-key:latest` on each cold start.

## ⚠️ Credits Discipline
Before running **any** command that provisions or deploys billable GCP resources:
1. Run `gcloud auth list` to confirm the intended account.
2. Run `gcloud billing accounts list` and `gcloud billing projects describe <PROJECT_ID>` to confirm the credits-backed billing account is attached.
3. Prefer **Cloud Run** (scale-to-zero, pay-per-request) over always-on compute to conserve credits.
4. Never enable BigQuery/Vertex AI training jobs or reserved capacity without an explicit human decision — these can burn credits fast.
5. If any step requires a paid subscription **other than** GCP credits or the Gemini 2.5 Flash free/AI-Studio tier, **stop and flag it** rather than proceeding.

## Target Architecture
| GCP Service | Purpose |
|---|---|
| Cloud Run | Hosts the FastAPI backend (serverless, scale-to-zero) |
| Cloud Run (or Vercel) | Hosts the Next.js frontend |
| Firestore | Production data store (replaces mock JSON via the repository abstraction) |
| Secret Manager | Stores `GEMINI_API_KEY`, Maps key, etc. |
| Cloud Storage | Static assets, exported reports |
| BigQuery | Analytics warehouse for district-wide historical trends |
| Vertex AI | Future home for trained XGBoost/LightGBM forecasting models |
| Cloud Scheduler + Cloud Functions | Periodic forecast recomputation batch jobs |
| Pub/Sub | Event bus for facility data-update events (future real-time ingestion) |

## Local Development (works today, no GCP required)
```bash
# Backend
cd backend
uv sync                     # or pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080

# Frontend
cd frontend
npm install
npm run dev
```
`.env` (backend) supports `USE_VERTEX_AI=false` and `USE_SECRET_MANAGER=false` so the app runs entirely on a local `GEMINI_API_KEY` and mock JSON data, with zero GCP dependency for the prototype demo.

## What Was Actually Run
The live deployment above was created directly via `gcloud` CLI (not the `scripts/` helpers, which remain as an alternative documented path):
```bash
gcloud projects create swasthyagrid-ai-54886 --name="SwasthyaGrid AI"
gcloud config set project swasthyagrid-ai-54886
gcloud billing projects link swasthyagrid-ai-54886 --billing-account=<BILLING_ACCOUNT_ID>
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com firestore.googleapis.com
gcloud firestore databases create --location=asia-south1 --type=firestore-native
gcloud secrets create gemini-api-key --data-file=- --replication-policy=automatic   # placeholder value
gcloud run deploy swasthyagrid-api --source backend/ --region asia-south1 \
  --allow-unauthenticated --min-instances 0 --max-instances 3 \
  --set-secrets "GEMINI_API_KEY=gemini-api-key:latest" \
  --env-vars-file backend/.gcp-env-vars.yaml   # ENVIRONMENT, GOOGLE_CLOUD_PROJECT, CORS_ORIGINS
```
`--allow-unauthenticated` is required so the browser-based Vercel frontend can call the API directly; the exposed data is non-sensitive (mock/Firestore district data, no PII or payment info). The Cloud Run service account needed `roles/secretmanager.secretAccessor` granted explicitly on the `gemini-api-key` secret.

`backend/scripts/setup_secrets.sh` / `setup_firestore.py` / `deploy.sh` remain as an alternative, more automated path for redeploying or recreating this setup from scratch.

## CI/CD
`.github/workflows/ci-cd.yml`: on push to `main` → lint (Ruff) → test (Pytest) → build (frontend + backend). The deploy stage remains commented out — Cloud Run deploys are currently done manually via the CLI above, not from CI.
