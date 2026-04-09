#!/usr/bin/env bash
# HW7 — deploy 7 YU agent services to Cloud Run.
# Usage: ./scripts/hw7_deploy.sh
#
# Builds the agents/Dockerfile once via gcloud builds, then deploys 7 services
# from the same image, each with its own AGENT_MODULE / AGENT_ID env var.

set -euo pipefail

PROJECT="${PROJECT:-resolution-hack}"
REGION="${REGION:-us-east1}"
IMAGE="us-east1-docker.pkg.dev/${PROJECT}/yu-agents/yu-agents:hw7"

# Read the same secrets the main yu-restos service uses
GEMINI_KEY="$(grep '^GEMINI_API_KEY=' .env | cut -d= -f2-)"
TG_TOKEN="$(grep '^TELEGRAM_BOT_TOKEN=' .env | cut -d= -f2-)"
TG_CHAT="$(grep '^TELEGRAM_CHAT_ID=' .env | cut -d= -f2-)"

if [ -z "$GEMINI_KEY" ]; then
  echo "❌ no GEMINI_API_KEY in .env"
  exit 1
fi

echo "📦 Building image $IMAGE (using cloudbuild.yaml)"
cat > /tmp/yu-agents-cloudbuild.yaml <<EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', '$IMAGE', '-f', 'agents/Dockerfile', '.']
images: ['$IMAGE']
EOF
gcloud builds submit \
  --project="$PROJECT" \
  --config=/tmp/yu-agents-cloudbuild.yaml \
  .

echo
echo "🚀 Deploying 4 specialist agents"
for AGENT in heart readiness sleep stress; do
  gcloud run deploy "yu-${AGENT}-agent" \
    --image="$IMAGE" \
    --project="$PROJECT" \
    --region="$REGION" \
    --allow-unauthenticated \
    --memory=512Mi \
    --cpu=1 \
    --max-instances=4 \
    --quiet \
    --set-env-vars="AGENT_MODULE=agents.specialist.main:app,AGENT_ID=${AGENT},GEMINI_API_KEY=${GEMINI_KEY},YU_CACHE=memory,OURA_DATA_DIR=/app/oura_data"
done

echo
echo "🚀 Deploying hypothesis agent"
gcloud run deploy "yu-hypothesis-agent" \
  --image="$IMAGE" \
  --project="$PROJECT" \
  --region="$REGION" \
  --allow-unauthenticated \
  --memory=512Mi --cpu=1 --max-instances=4 --quiet \
  --set-env-vars="AGENT_MODULE=agents.hypothesis.main:app,GEMINI_API_KEY=${GEMINI_KEY}"

echo
echo "🚀 Deploying notifier agent"
gcloud run deploy "yu-notifier-agent" \
  --image="$IMAGE" \
  --project="$PROJECT" \
  --region="$REGION" \
  --allow-unauthenticated \
  --memory=256Mi --cpu=1 --max-instances=4 --quiet \
  --set-env-vars="AGENT_MODULE=agents.notifier.main:app,TELEGRAM_BOT_TOKEN=${TG_TOKEN},TELEGRAM_CHAT_ID=${TG_CHAT}"

echo
echo "🔗 Discovering URLs"
HEART_URL=$(gcloud run services describe yu-heart-agent --project="$PROJECT" --region="$REGION" --format='value(status.url)')
READINESS_URL=$(gcloud run services describe yu-readiness-agent --project="$PROJECT" --region="$REGION" --format='value(status.url)')
SLEEP_URL=$(gcloud run services describe yu-sleep-agent --project="$PROJECT" --region="$REGION" --format='value(status.url)')
STRESS_URL=$(gcloud run services describe yu-stress-agent --project="$PROJECT" --region="$REGION" --format='value(status.url)')
HYPOTHESIS_URL=$(gcloud run services describe yu-hypothesis-agent --project="$PROJECT" --region="$REGION" --format='value(status.url)')
NOTIFIER_URL=$(gcloud run services describe yu-notifier-agent --project="$PROJECT" --region="$REGION" --format='value(status.url)')

echo "  HEART_URL=$HEART_URL"
echo "  READINESS_URL=$READINESS_URL"
echo "  SLEEP_URL=$SLEEP_URL"
echo "  STRESS_URL=$STRESS_URL"
echo "  HYPOTHESIS_URL=$HYPOTHESIS_URL"
echo "  NOTIFIER_URL=$NOTIFIER_URL"

echo
echo "🚀 Deploying council orchestrator with worker URLs"
gcloud run deploy "yu-council" \
  --image="$IMAGE" \
  --project="$PROJECT" \
  --region="$REGION" \
  --allow-unauthenticated \
  --memory=512Mi --cpu=1 --max-instances=4 --quiet \
  --set-env-vars="AGENT_MODULE=agents.council.main:app,HEART_URL=${HEART_URL},READINESS_URL=${READINESS_URL},SLEEP_URL=${SLEEP_URL},STRESS_URL=${STRESS_URL},HYPOTHESIS_URL=${HYPOTHESIS_URL},NOTIFIER_URL=${NOTIFIER_URL}"

COUNCIL_URL=$(gcloud run services describe yu-council --project="$PROJECT" --region="$REGION" --format='value(status.url)')
echo
echo "✅ All 7 services deployed."
echo "   COUNCIL_URL=$COUNCIL_URL"
echo
echo "Save COUNCIL_URL into .env then run:"
echo "  ./venv/bin/python scripts/hw7_experiments.py --council \"$COUNCIL_URL\""
