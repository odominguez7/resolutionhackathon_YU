# YU RestOS

AI-powered sleep recovery engine. Detects burnout from Eight Sleep biometrics + behavioral data, then executes real-world recovery actions. Built with local AI (Granite 3.3), zero data leaves your device.

## Quick Start

### Backend
```bash
cd restos
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
cd backend
uvicorn main:app --port 8000 --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Pre-Demo Check
```bash
./scripts/demo_flow.sh
```

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check |
| `/api/sleep/trends` | GET | 14-day sleep trend data |
| `/api/sleep/history` | GET | Sleep interval data |
| `/api/sleep/summary` | GET | Dashboard summary stats |
| `/api/sleep/current` | GET | Current night live data |
| `/api/checkin/history` | GET | All check-in history |
| `/api/checkin/submit` | POST | Submit daily check-in |
| `/api/drift/analyze` | GET | Run drift detection |
| `/api/drift/timeline` | GET | Drift signals for charts |
| `/api/coaching/generate` | GET | AI coaching (local) |
| `/api/coaching/xray` | GET | Local vs cloud comparison |
| `/api/actions/plan/generate` | GET | Generate recovery plan |
| `/api/actions/plan/{id}` | GET | Get existing plan |
| `/api/actions/plan/{id}/execute/{action_id}` | POST | Execute single action |
| `/api/actions/plan/{id}/execute-all` | POST | Execute all actions |
| `/api/actions/task/{id}` | GET | Check concierge task status |
| `/api/actions/task/{id}/advance` | POST | Advance task (demo) |
| `/api/actions/products/{goal}` | GET | Product recommendations |
| `/api/feedback/submit` | POST | Submit recovery feedback |
| `/api/feedback/{plan_id}` | GET | Get feedback |
| `/api/feedback/{plan_id}/effectiveness` | GET | Effectiveness report |

## Architecture

```
Backend (FastAPI)
├── eight_sleep/   — Mock Eight Sleep data (pyEight V2 format)
├── checkin/       — Behavioral self-report
├── drift/         — Dual-signal burnout detection
├── coaching/      — Local AI (Granite 3.3) + cloud comparison
├── actions/       — Recovery Plan generator + Action Engine
└── feedback/      — Recovery effectiveness tracking

Frontend (React + Vite + Tailwind + Recharts)
├── Landing        — Hero + value prop
├── Dashboard      — Sleep data + check-in visualization
├── Check-In       — 30-second daily behavioral input
├── Drift Alert    — Burnout detection + severity
├── Recovery Plan  — Executable action cards (THE MONEY PAGE)
├── Action Status  — Real-time execution feedback
├── Morning Debrief — Recovery comparison + feedback loop
└── X-Ray Mode     — Local vs cloud privacy comparison
```

## Resolution Hackathon — March 28, 2026
Harvard, Sever Hall 213 | $1,500 Prize

Built by YU (Omar Dominguez)
