#!/usr/bin/env bash
# ============================================================
# IMPRINT — Google Cloud Run Deployment Script
# ============================================================
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Prerequisites (must be installed and configured):
#   - gcloud CLI  (https://cloud.google.com/sdk/docs/install)
#   - Docker Desktop (running)
#   - gcloud auth login  &&  gcloud auth configure-docker
# ============================================================

set -euo pipefail

# ── CONFIGURATION ─────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:-}"          # set via env or edit below
REGION="${GCP_REGION:-asia-south1}"       # Mumbai region — closest to target users
SERVICE_NAME="imprint"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
ANTHROPIC_API_KEY_VALUE="${ANTHROPIC_API_KEY:-}"

# ── VALIDATION ────────────────────────────────────────────
if [[ -z "$PROJECT_ID" ]]; then
  echo ""
  echo "❌  GCP_PROJECT_ID is not set."
  echo "    Run:  export GCP_PROJECT_ID=your-project-id"
  echo "    Then re-run this script."
  exit 1
fi

echo ""
echo "🚀  Deploying IMPRINT to Google Cloud Run"
echo "    Project : $PROJECT_ID"
echo "    Region  : $REGION"
echo "    Service : $SERVICE_NAME"
echo "    Image   : $IMAGE_NAME"
echo ""

# ── STEP 1: Enable required GCP APIs ─────────────────────
echo "⚙️   Enabling GCP APIs..."
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  containerregistry.googleapis.com \
  --project="$PROJECT_ID" \
  --quiet

# ── STEP 2: Build & push with Cloud Build (no local Docker needed) ───────────
echo ""
echo "🔨  Building image with Cloud Build..."
gcloud builds submit . \
  --tag="$IMAGE_NAME:latest" \
  --project="$PROJECT_ID" \
  --timeout=15m

# ── STEP 3: Deploy to Cloud Run ───────────────────────────
echo ""
echo "☁️   Deploying to Cloud Run..."

ENV_VARS="NODE_ENV=production"
if [[ -n "$ANTHROPIC_API_KEY_VALUE" ]]; then
  ENV_VARS="${ENV_VARS},ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY_VALUE}"
fi

gcloud run deploy "$SERVICE_NAME" \
  --image="$IMAGE_NAME:latest" \
  --platform=managed \
  --region="$REGION" \
  --allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --cpu=1 \
  --concurrency=80 \
  --timeout=60s \
  --set-env-vars="$ENV_VARS" \
  --project="$PROJECT_ID" \
  --quiet

# ── STEP 4: Fetch the deployed URL and update CORS ───────
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --platform=managed \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format="value(status.url)")

echo ""
echo "🔗  Updating CORS_ORIGIN to match deployed URL..."
gcloud run services update "$SERVICE_NAME" \
  --platform=managed \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --update-env-vars="CORS_ORIGIN=${SERVICE_URL}" \
  --quiet

echo ""
echo "✅  Deployment complete!"
echo ""
echo "    🌍  Live URL: ${SERVICE_URL}"
echo ""
echo "    Login with:  username=pip  password=password123"
echo ""
