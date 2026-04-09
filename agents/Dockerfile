FROM python:3.11-slim

WORKDIR /app

# Shared deps
COPY agents/requirements.txt ./agents/requirements.txt
RUN pip install --no-cache-dir -r agents/requirements.txt

# Bake the Oura sample data into the image so each agent can read it standalone
COPY scripts/oura_data /app/oura_data

# Copy ALL agent code (one image, picks the right module via AGENT_MODULE)
COPY agents/ /app/agents/

ENV PORT=8080
ENV AGENT_MODULE=agents.council.main:app
ENV OURA_DATA_DIR=/app/oura_data

# Cloud Run sends traffic to $PORT
EXPOSE 8080

# Use sh -c so $AGENT_MODULE expands at runtime
CMD exec uvicorn $AGENT_MODULE --host 0.0.0.0 --port $PORT
