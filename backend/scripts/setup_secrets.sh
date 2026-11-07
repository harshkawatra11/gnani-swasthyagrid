#!/usr/bin/env bash
# One-time GCP project setup for the Gnani SwasthyaGrid backend.
# Run only after confirming billing/credits per docs/09-gcp-deployment.md.
set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID before running this script}"
: "${GEMINI_API_KEY:?Set GEMINI_API_KEY before running this script}"
: "${GNANI_API_KEY:?Set GNANI_API_KEY before running this script}"

echo "Using project: ${GCP_PROJECT_ID}"
gcloud config set project "${GCP_PROJECT_ID}"

echo "Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com

echo "Storing Gemini API key in Secret Manager..."
printf '%s' "${GEMINI_API_KEY}" | gcloud secrets create gemini-api-key \
  --data-file=- --replication-policy=automatic 2>/dev/null || \
printf '%s' "${GEMINI_API_KEY}" | gcloud secrets versions add gemini-api-key --data-file=-

echo "Storing Gnani API key (Prisma STT + Timbre TTS) in Secret Manager..."
printf '%s' "${GNANI_API_KEY}" | gcloud secrets create gnani-api-key \
  --data-file=- --replication-policy=automatic 2>/dev/null || \
printf '%s' "${GNANI_API_KEY}" | gcloud secrets versions add gnani-api-key --data-file=-

echo "Done. Service account/IAM bindings should be reviewed manually before deploy."
