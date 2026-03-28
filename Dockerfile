FROM node:18-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt caldav vobject httpx aiofiles

COPY backend/ ./backend/
COPY scripts/ ./scripts/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

COPY main_cloud.py ./main_cloud.py

EXPOSE 8080
CMD ["uvicorn", "main_cloud:app", "--host", "0.0.0.0", "--port", "8080"]
