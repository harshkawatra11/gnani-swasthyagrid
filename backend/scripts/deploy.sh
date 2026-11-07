#!/usr/bin/env bash
# Build and deploy the Gnani SwasthyaGrid backend to Cloud Run on the Always Free tier.
# Free tier region requirement: us-central1, us-east1 or us-west1 only; asia-south1
# (Mumbai) is used by default instead because it sits next to Gnani's API
# (api.vachana.ai) and this project's users, at a small cost above the free tier.
# Scale to zero (min-instances 0) and CPU throttling stay on so idle time never bills
# much. Trade-off: the in-memory logistics simulator resets whenever Cloud Run
# cold-starts a fresh instance, and a long-lived SSE or WebSocket connection is cut if
# the instance scales down under it. See docs/09-gcp-deployment.md.
set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID before running this script}"
REGION="${GCP_REGION:-asia-south1}"
SERVICE="${SERVICE:-gnani-swasthyagrid-api}"
IMAGE="${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/swasthyagrid/${SERVICE}"
ENV_FILE="${ENV_FILE:-deploy.env.yaml}"

echo "Building image ${IMAGE}..."
gcloud builds submit --tag "${IMAGE}" .

echo "Deploying to Cloud Run (${REGION})..."
gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 3600 \
  --env-vars-file "${ENV_FILE}" \
  --set-secrets "GEMINI_API_KEY=gemini-api-key:latest,GNANI_API_KEY=gnani-api-key:latest,LOGISTICS_SERVICE_TOKEN=logistics-service-token:latest"

echo "Deployed. Fetch the URL with: gcloud run services describe ${SERVICE} --region ${REGION} --format='value(status.url)'"
