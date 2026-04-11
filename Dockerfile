FROM node:18-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install --force
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

# Install Python deps
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt caldav vobject httpx

# Copy backend
COPY backend/ ./backend/
COPY scripts/ ./scripts/
# Secrets are mounted via Cloud Run --set-secrets, not baked into the image.
# Local dev still uses .env files; the code reads os.getenv() first.

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Install a simple static file server middleware
RUN pip install --no-cache-dir aiofiles

# Copy the main_cloud entry point
COPY main_cloud.py ./

# Workout brain assets: catalog (mandatory) + any seeded logs (optional)
COPY ["CF Movements.md", "./CF Movements.md"]

EXPOSE 8080

CMD ["uvicorn", "main_cloud:app", "--host", "0.0.0.0", "--port", "8080"]
