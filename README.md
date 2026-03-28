# YU RestOS

**Structure for the unstructured. One tap. Your whole week, planned.**

YU is an AI-powered daily planner that reads your wearable data, your calendar, and your sleep environment to build a personalized plan you can actually follow. Built for people who push hard and forget to stop.

[![Resolution Hackathon @ Harvard](https://img.shields.io/badge/Resolution%20Hackathon-Harvard%202026-crimson?style=for-the-badge)](https://github.com)
[![Built at MIT Sloan](https://img.shields.io/badge/Built%20at-MIT%20Sloan-red?style=for-the-badge)](https://mitsloan.mit.edu)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

---

## The Problem

Wearables collect thousands of data points every day. Sleep stages, heart rate variability, stress levels, readiness scores. But what do you actually **do** with all that data?

Most health apps show you charts. YU tells you what to do.

**The accountability gap**: You know you should work out. You know you should sleep better. You know you're stressed. But knowing isn't doing. The gap between insight and action is where burnout lives.

YU closes that gap.

---

## What YU Does

**One tap. Your entire week is planned.**

YU connects to your data sources, analyzes everything with Gemini AI, and builds a personalized plan:

| Source | What it reads | What it does with it |
|--------|--------------|---------------------|
| **Oura Ring** | Sleep score, HRV, readiness, stress, heart rate, 170+ days of history | Determines your capacity and recovery state |
| **iCloud Calendar** | All events, meetings, classes, appointments | Maps your obligations and finds gaps |
| **Eight Sleep Pod 5 Ultra** | Temperature control, GentleRise alarm, snoring mitigation | Programs your bed for optimal recovery |
| **Google Gemini 2.5 Pro** | All of the above, combined | Builds your plan, answers your questions, keeps you accountable |

---

## How It Works

### 1. Connect
Your Oura Ring, iCloud Calendar, and Eight Sleep Pod connect automatically. Zero setup.

### 2. Choose your vibe
- **Crush my week** -- peak performance mode
- **Stay balanced** -- productive but sustainable
- **Recover hard** -- you're running on empty

### 3. Get your plan
YU builds your next 7 days:
- **Movement** -- the right workout for your recovery state (CrossFit, yoga, or active rest), programmed by Gemini AI
- **Schedule** -- your calendar with AI commentary on what to protect, what to skip, and where to fit recovery
- **Sleep** -- Eight Sleep Pod temperature protocol sent directly to your bed (adaptive cooling, GentleRise alarm, snoring mitigation)
- **Ask YU** -- interactive AI copilot that knows your calendar, biometrics, and goal. Ask it anything.

---

## Key Features

### Readiness Ring
Your photo at the center, wrapped in a real-time readiness ring that fills based on your Oura data. Green = go hard. Amber = moderate. Red = rest day.

### Scanning Animation
Click "Plan my day" and watch YU connect to each data source in real-time. Oura Ring, iCloud Calendar, Eight Sleep Pod, workout history, and Gemini AI -- each one orbits around you and connects with a visual data flow.

### Ask YU (AI Copilot)
An interactive chat powered by Gemini 2.5 Pro that knows your schedule, your biometrics, and your goal. It will tell you what to cancel, when to work out, how to protect your sleep, and how to stay accountable. It references your actual events by name.

### Eight Sleep Pod Integration
One-tap activation sends your entire sleep protocol to the Pod 5 Ultra:
- Adaptive temperature curve (68F > 64F > 62F > 68F > 78F)
- GentleRise alarm with thermal warming + vibration + sunrise sound
- Snoring mitigation with auto-elevation
- Pre-cooling starts immediately

### AI Workout Builder
Gemini programs your exact workout based on recovery state:
- **Home CrossFit** -- intensity matched to readiness
- **Hot Yoga** -- classes at Down Under Yoga, Kendall Square, matched to your schedule
- **Active Rest** -- strategic micro-interventions throughout the day

### 7-Day Navigator
Click through each day of the week. See events, get AI tips, and plan ahead. YU adapts its recommendations based on how packed each day is.

### Real Oura Ring Data
170+ days of real biometric data from a real Oura Ring via OAuth2. Sleep scores, HRV trends, stress/recovery charts, heart rate -- all real, all live. 28 API endpoints across 11 Oura scopes.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Recharts, shadcn/ui |
| **Backend** | FastAPI (Python), 8 API modules, 30+ endpoints |
| **AI** | Google Gemini 2.5 Pro (chat, workout generation, calendar analysis) |
| **Biometrics** | Oura Ring API v2 (OAuth2, 11 scopes, 170+ days) |
| **Calendar** | iCloud CalDAV (caldav library, real-time sync) |
| **Sleep** | Eight Sleep Pod 5 Ultra (simulated API integration) |
| **Animation** | Framer Motion (orbital scanning, spring physics, stagger animations) |
| **Scroll** | Lenis (smooth scroll) |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Oura developer account
- Apple ID (for iCloud Calendar)
- Gemini API key

### Backend
```bash
cd YU-RestOS
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Environment (.env)
```
OURA_ACCESS_TOKEN=your_oura_token
OURA_REFRESH_TOKEN=your_refresh_token
GEMINI_API_KEY=your_gemini_key
APPLE_ID=your@email.com
APPLE_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

Frontend: `http://localhost:8080` | Backend: `http://localhost:8000`

---

## API Reference

**30+ endpoints** across 8 modules:

### Oura (`/api/oura`)
| Endpoint | Description |
|----------|-------------|
| `GET /sleep-history` | Full sleep history with all metrics |
| `GET /stats` | Aggregate stats across 170+ days |
| `GET /today` | Today's live scores (with live API + override) |
| `GET /contributors` | Sleep, readiness, activity contributor breakdowns |
| `GET /stress-detail` | Daily stress/recovery analysis |
| `GET /heart-rate-detail` | Heart rate trends |
| `GET /cardiovascular-age` | Vascular age history |
| `GET /workout` | AI-generated workout based on biometrics |
| `GET /insights` | Gemini-powered biometric analysis |
| `GET /refresh` | Live refresh from Oura API |
| `POST /today/override` | Manual score override |
| `POST /webhook` | Oura webhook receiver |

### Calendar (`/api/calendar`)
| Endpoint | Description |
|----------|-------------|
| `GET /events` | Events for next N days from iCloud |
| `GET /today` | Today's events |
| `GET /week` | This week's events |
| `GET /analyze` | Gemini-powered week analysis |
| `POST /chat` | Interactive AI chat about schedule |
| `GET /calendars` | List available calendars |
| `GET /status` | Connection status |

### Additional modules
- **Sleep** (`/api/sleep`) -- Eight Sleep mock data
- **Check-In** (`/api/checkin`) -- Behavioral self-reports
- **Drift** (`/api/drift`) -- Burnout detection algorithm
- **Coaching** (`/api/coaching`) -- AI coaching
- **Actions** (`/api/actions`) -- Recovery plan execution
- **Feedback** (`/api/feedback`) -- Recovery effectiveness tracking

---

## Architecture

```
                    ┌─────────────────────┐
                    │      YOU            │
                    │   (Center of        │
                    │    everything)      │
                    └──────┬──────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐     ┌──────▼──────┐   ┌─────▼─────┐
    │  Oura   │     │   iCloud    │   │   Eight   │
    │  Ring   │     │  Calendar   │   │   Sleep   │
    │  API    │     │   CalDAV    │   │  Pod 5    │
    └────┬────┘     └──────┬──────┘   └─────┬─────┘
         │                 │                 │
         └────────┬────────┴────────┬────────┘
                  │                 │
           ┌──────▼──────┐  ┌──────▼──────┐
           │   FastAPI   │  │   Gemini    │
           │   Backend   │  │   2.5 Pro   │
           └──────┬──────┘  └──────┬──────┘
                  │                │
                  └───────┬────────┘
                          │
                   ┌──────▼──────┐
                   │    React    │
                   │  Frontend   │
                   │  (Your Plan)│
                   └─────────────┘
```

---

## Resolution Hackathon @ Harvard

**March 28, 2026 | Sever Hall 213 | $1,500 Prize**

Built in partnership with:
- **Eight Sleep** -- Sleep technology sponsor
- **swsh** -- Community partner
- **Duckbill** -- Concierge services
- **Fragile** -- Wellness partner
- **Clair** -- Financial wellness
- **Wayfair** -- Home & recovery products

---

## Builder

**Omar Dominguez** | MIT Sloan MBA 2027

Builder, not a talker. Lost 80 lbs starting with 7 minutes a day. Boston Marathon finisher. Ironman 70.3. Building YU to solve the problem he lived: having all the data in the world and still burning out.

[GitHub](https://github.com/odominguez7) | MIT Sloan

---

## Why YU Wins

1. **Real data, not mockups.** 170+ days of actual Oura Ring biometrics via OAuth2. Live iCloud Calendar sync. Real Eight Sleep Pod integration.

2. **AI that acts, not just displays.** Gemini 2.5 Pro doesn't just summarize your data. It tells you what to cancel, when to work out, and programs your bed for recovery.

3. **Closes the accountability gap.** Wearables are data collectors. YU is an action planner. One tap and your whole week is structured around what your body actually needs.

4. **Built for the unstructured.** For people with ADHD, for founders, for anyone who pushes hard and forgets to stop. YU says "I got you" and means it.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
