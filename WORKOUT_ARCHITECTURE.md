# YU Workout Architecture

Snapshot of how the YU workout pipeline works end to end — UI, API, prompt
assembly, Gemini call, structured response, persistence, memory, pattern
balancer, closed-loop verdicts, regeneration, feedback, and rendering rules.

Last updated: 2026-04-09 · revision `yu-restos-00093-fj7` · commit `0ab0c29`.

---

## 1. High-level diagram

```
                    ┌──────────────────────────┐
                    │     PlanOrbit.tsx        │
                    │  (the "my health" UI)    │
                    └────────────┬─────────────┘
                                 │
       ┌─────────────────────────┼──────────────────────────┐
       │                         │                          │
       ▼                         ▼                          ▼
GET /workout/today      GET /workout?session_type=…   POST /workout/regenerate
(restore on mount)      (generate fresh)              (try-another-combo)
       │                         │                          │
       └─────────────────────────┴──────────────────────────┘
                                 │
                                 ▼
              ┌──────────────────────────────────────┐
              │   backend/oura/routes.py (FastAPI)   │
              │   /api/oura/workout*                 │
              └────────────┬─────────────────────────┘
                           │
                           ▼
       ┌────────────────────────────────────────────────┐
       │      backend/oura/workout_ai.py                │
       │      generate_workout(session_type,            │
       │                       biometrics,              │
       │                       lock_patterns,           │
       │                       avoid_movements)         │
       └─────────┬──────────────────┬───────────────────┘
                 │                  │
                 ▼                  ▼
   ┌─────────────────────┐   ┌────────────────────────┐
   │  workout_brain.py   │   │  Gemini 2.5 Flash      │
   │  build_memory_block │   │  via httpx (raw JSON)  │
   │                     │   │  outputs structured    │
   │  ┌───────────────┐  │   │  blocks:               │
   │  │ CF Movements  │  │   │   - strength {}        │
   │  │ .md (catalog) │  │   │   - metcon {}          │
   │  └───────────────┘  │   │   - workout {}         │
   │  ┌───────────────┐  │   │  every movement is     │
   │  │ recent_log()  │  │   │  {reps, name, load}    │
   │  │ last 7 days   │  │   └────────┬───────────────┘
   │  └───────────────┘  │            │
   │  ┌───────────────┐  │            │
   │  │ pattern       │  │            │
   │  │ balancer      │  │            │
   │  │ avoid/include │  │            │
   │  └───────────────┘  │            │
   │  ┌───────────────┐  │            │
   │  │ closed_loop_  │  │            │
   │  │ review        │  │            │
   │  │ verdict tags  │  │            │
   │  └───────────────┘  │            │
   └──────────┬──────────┘            │
              │                       │
              └───────────┬───────────┘
                          ▼
              ┌──────────────────────┐
              │   log_workout()      │
              │   persist + return   │
              └──────────┬───────────┘
                         │
              ┌──────────┴───────────┐
              ▼                      ▼
      ┌──────────────┐      ┌─────────────────────┐
      │  Firestore   │      │  yu_workout_log.json│
      │ workout_log  │      │  (local fallback)   │
      │ collection   │      │                     │
      └──────────────┘      └─────────────────────┘
```

---

## 2. End-to-end flow

### 2.1 User lands on `/my-health` (PlanOrbit.tsx)

On mount, the component does two things in parallel:

1. `GET /api/oura/workout/today` — if a non-rejected workout exists for
   today, hydrate the card from the stored `full_workout` JSON. No Gemini
   call needed. The workout survives page exits and refreshes.
2. `GET /api/oura/workout/log?days=7` — populate the collapsible
   **Workout History** backlog at the bottom of the section.

### 2.2 User taps Home Workout / Hot Yoga / Active Rest

Frontend calls `loadWorkout("crossfit" | "yoga" | "rest")` which fires
`GET /api/oura/workout?session_type=…`.

The backend `routes.py::get_workout()` builds a **biometrics snapshot**
from the in-memory Oura caches:

- Today's HRV, readiness, sleep score, RHR, stress minutes
- Deep sleep, total sleep
- Last 3 days trend
- 30-day baselines for HRV and RHR
- A `recovery_context` string ("Fully recovered. Push hard." / "Decent
  recovery." / "Under-recovered." / "Low recovery.")

It then calls `generate_workout(session_type, biometrics)`.

### 2.3 `generate_workout()` (workout_ai.py) — orchestration

This is the heart of the pipeline. It does:

1. Calls `workout_brain.build_memory_block(biometrics)` which returns a
   plain-text block injected into the prompt. The block has 4 parts:
   - **ALLOWED MOVEMENT CATALOG** — full `CF Movements.md` (~12k chars).
     Hard rule: every movement output must come from this list.
   - **RECENT TRAINING HISTORY** — last 7 logged workouts with day,
     intensity, patterns, and closed-loop verdict.
   - **PROGRAMMING CONSTRAINTS FOR TODAY**:
     - `MUST include movement patterns:` (lowest weekly count, not done
       in 2 days)
     - `AVOID (worked yesterday):` (yesterday's patterns)
     - Weekly pattern counts so far
     - Hard rules: catalog enforcement, intensity adjustment based on
       yesterday's verdict
   - **REGENERATION REQUEST** (only when called via /regenerate) —
     locks patterns, lists movements to avoid, asks for a new format.
2. Concatenates: `WORKOUT_PROMPT` (with HARD BAN list and CRITICAL
   RENDER RULE) + `bio_context` + `memory_block` + optional `regen_block`.
3. Posts to Gemini 2.5 Flash via httpx with:
   - `responseMimeType: application/json`
   - `temperature: 0.7`
   - `maxOutputTokens: 2048`
   - `thinkingConfig: {thinkingBudget: 0}`
4. Goes through `assert_egress_allowed()` (egress allowlist).
5. Parses JSON, strips any markdown fences (defensive).
6. Calls `log_workout(workout, biometrics, session_type)`.
7. Returns the workout JSON, augmented with `log_id`, `patterns`, and
   `biometrics_used`.

### 2.4 `log_workout()` (workout_brain.py) — persistence

Builds the entry:

```python
{
  "id": "w_<unix-timestamp>",
  "generated_at": "<isoformat ET>",
  "day": "YYYY-MM-DD",
  "session_type": "crossfit" | "yoga" | "rest",
  "title": str,
  "format": str,                      # AMRAP / For Time / EMOM / Strength + Metcon
  "intensity": str,                   # push / work / easy / recovery
  "duration_min": int,
  "movements": [str, ...],            # flat list, used for pattern tagging
  "patterns": [str, ...],             # squat / hinge / push_h / push_v / pull_v / pull_h / olympic / core / cardio / plyo
  "full_workout": <raw JSON>,         # so the UI can restore later
  "biometrics_pre": {readiness, hrv, hrv_baseline, sleep_score},
  "biometrics_next_morning": null,    # filled by closed_loop_review tomorrow
  "load_verdict": null,               # filled by closed_loop_review tomorrow
  "user_feedback": null               # filled when user taps Yes / Partial / Skipped
}
```

Persistence is **dual-track**:

- **Firestore `workout_log` collection** — primary store, per-entry
  upsert by `id`. Survives Cloud Run instance recycles.
- **Local `yu_workout_log.json`** — fallback if Firestore is unreachable.

### 2.5 User taps "Try another combo"

Frontend: `POST /api/oura/workout/regenerate {log_id, session_type}`.

Backend:

1. `reject_entry(log_id)` marks the rejected entry with `rejected: true`,
   `rejected_reason`, `rejected_at`. Rejected entries are excluded from
   `recent_log`, `closed_loop_review`, and the pattern balancer.
2. Rebuilds the biometrics snapshot from current Oura data.
3. Calls `generate_workout` with:
   - `lock_patterns = rejected.patterns`
   - `avoid_movements = rejected.movements`
4. The prompt gets a **REGENERATION REQUEST** block telling Gemini to:
   - Hit the same training intent (same patterns)
   - Not reuse the listed movements
   - Vary the format (AMRAP → For Time, etc.)

### 2.6 User taps "Refresh from current data"

Same as a fresh `loadWorkout()` — pulls a new biometric snapshot, runs
generation, logs a new entry. The previous one stays in the log but is
naturally superseded by the new `workout/today` query.

The button turns yellow and copy flips to *"⚠ Refresh — your data has
changed since this was made"* if the current workout is **>2 hours old**.

### 2.7 User taps "Yes / Partial / Skipped"

`POST /api/oura/workout/feedback {log_id, completed}`.

Backend writes:

```python
entry["user_feedback"] = {
  "completed": "yes" | "partial" | "no",
  "felt": int | null,
  "soreness": str | null,
  "notes": str,
  "recorded_at": "<isoformat ET>",
}
```

Upserted to Firestore.

### 2.8 Tomorrow morning — closed-loop review

On the next workout call (any session type), `build_memory_block` first
calls `closed_loop_review(today_biometrics)`. It walks the log for
unreviewed entries from yesterday and tags them:

| Verdict        | Trigger                                                                       |
|----------------|--------------------------------------------------------------------------------|
| `too_much`     | HRV dropped ≥8 ms vs pre-workout, OR fell below baseline by ≥5 ms              |
| `undertrained` | Today's readiness ≥85 AND yesterday's intensity was `easy`/`recovery`           |
| `ok`           | Otherwise                                                                       |

The verdict goes into the next prompt with hard rules:

- *"If yesterday's verdict was `too_much`, drop intensity one tier."*
- *"If yesterday's verdict was `undertrained` two days in a row, push harder."*

This is the personal-tolerance learning loop. Over weeks the agent
learns Omar's specific load tolerance instead of population rules.

---

## 3. Gemini response shape (the strict schema)

The prompt forbids paragraph-style descriptions. Every block is
structured. The UI parses these fields and renders them separately.

```jsonc
{
  "session_type": "crossfit",
  "title": "The Iron Will Gauntlet",
  "format": "Strength + Metcon",
  "duration_min": 60,
  "intensity": "push",
  "warmup": {
    "duration_min": 10,
    "movements": ["movement 1 - reps/duration", "..."]
  },
  "strength": {
    "block_type": "Strength",
    "sets": 5,
    "for_time": false,
    "movements": [
      {"reps": "5", "movement_name": "Double DB Front Squat", "load": "2x50lb", "notes": "build to a heavy 5"}
    ],
    "rest": "90-120 sec between sets"
  },
  "metcon": {
    "block_type": "Metcon",
    "name": "The Dark Place",
    "rounds": 3,
    "time_cap": 20,
    "movements": [
      {"reps": "21", "movement_name": "DB Thruster", "load": "2x50lb"},
      {"reps": "15", "movement_name": "Chest-to-Bar Pull-up", "load": "BW"},
      {"reps": "9",  "movement_name": "Burpee Over DB", "load": null}
    ]
  },
  "workout": {
    "block_type": "Main",
    "rounds": null,
    "time_cap": null,
    "movements": [{"reps": "...", "movement_name": "...", "load": "..."}],
    "notes": "Pacing strategy"
  },
  "cooldown": {
    "duration_min": 7,
    "movements": ["stretch 1", "stretch 2"]
  },
  "why_this_workout": "2-3 sentences referencing actual numbers",
  "mental_challenge": "Where you'll want to quit and why pushing through matters",
  "target_zones": {"zone2_min": int, "zone3_min": int, "zone4_min": int},
  "estimated_calories": int
}
```

**Hard rules baked into the prompt:**

- `block_type` MUST be present on `strength`, `metcon`, `workout`
- Movements MUST be objects, NEVER strings
- `reps` stays a string so distances ("400m") and times ("60 sec") work
- `load` is `null` for bodyweight
- When `format == "Strength + Metcon"`, BOTH `strength` AND `metcon` must
  be emitted as separate fields. Never merge.
- NEVER emit a `description` field — the UI will not render it.

---

## 4. Frontend rendering rules (PlanOrbit.tsx)

Every block is rendered via a strict `SectionBlock` component:

| Rule                | Implementation                                              |
|---------------------|-------------------------------------------------------------|
| Section header      | UPPERCASE `block_type` + meta (sets/rounds/name) in parens |
| Movements           | Bulleted `<ul>` — one `<li>` per movement, never inline    |
| Movement format     | `{reps} {movement_name} ({load})` — load hidden if null    |
| Movement notes      | Italic suffix `— {notes}` on the same bullet                |
| `rest`              | Own labeled line: **Rest:** ...                             |
| `time_cap`          | Own labeled line: **Time Cap:** N min                       |
| Coach's note        | Italic `Coach's Note: ...` only on `main.notes`             |
| `description` field | NEVER rendered. Stripped silently if present.               |

Header builders:

```
strengthHeader(b) → STRENGTH — {b.sets} SETS, NOT FOR TIME
metconHeader(b)   → METCON — "{b.name?.toUpperCase()}" — {b.rounds} ROUNDS FOR TIME
mainHeader()      → {format.toUpperCase()} — {main.rounds} ROUNDS
```

The renderer also has a **legacy fallback**: if a movement is a plain
string (from older log entries before the structured schema was
introduced), it's rendered as a single bullet without parsing.

### Other UI affordances on the workout card

- **Title bar**: title + `intensity` badge + `duration_min` badge
- **Why this session** block: contextual frame referencing actual numbers
- **The hard part** block: italic Coach's Note for `mental_challenge`
- **Refresh from current data** button (yellow if >2h old)
- **Did you do this workout?** card with Yes / Partial / Skipped buttons
- **Try another combo** button (reuses log_id, locks patterns)
- **Change type** button (resets state)
- **Copy for Sage** button (text export)
- **Workout history backlog** (collapsible, last 7 days, with completion
  badges and closed-loop verdict colors)

---

## 5. The pattern balancer (deterministic, not LLM)

`workout_brain.py::balance_instructions(history)` runs before every
generation to give Gemini structured guidance instead of trusting it to
remember what it already prescribed.

### Pattern keywords

```python
PATTERN_KEYWORDS = {
    "squat":   ["squat", "goblet", "front squat", "back squat", "wall sit", "pistol"],
    "hinge":   ["deadlift", "rdl", "romanian", "hip thrust", "glute bridge", "good morning", "swing"],
    "lunge":   ["lunge", "split squat", "step-up"],
    "push_h":  ["push-up", "pushup", "floor press", "bench"],
    "push_v":  ["press", "jerk", "push press", "strict press", "arnold", "z-press", "lateral raise"],
    "pull_v":  ["pull-up", "pullup", "chin-up", "chinup", "muscle-up"],
    "pull_h":  ["row", "renegade row", "seal row", "bent-over"],
    "olympic": ["clean", "snatch", "man maker", "devil press", "cluster"],
    "core":    ["plank", "hollow", "v-up", "tuck-up", "sit-up", "dead bug", "russian twist", "side plank", "leg raise"],
    "cardio":  ["run", "treadmill", "burpee", "row erg", "bike", "sprint"],
    "plyo":    ["jump", "broad jump", "skater", "tuck jump"],
}

PATTERN_PRIORITY = ["squat", "hinge", "push_h", "push_v", "pull_v", "pull_h", "core", "olympic"]
```

### Balancer logic

Given the recent log:

1. Tag every logged workout's movements into patterns.
2. Compute `week_pattern_counts` (how many times each pattern hit this week).
3. `yesterday_patterns` → goes into `AVOID`.
4. `must_include` → from `PATTERN_PRIORITY`, pick the patterns NOT done
   in the last 2 days, sorted ascending by `week_pattern_counts`. Take
   the top 2.
5. Inject into prompt:
   - `MUST include movement patterns: hinge, pull_h`
   - `AVOID (worked yesterday): squat, olympic`
   - `Weekly pattern counts so far: {squat: 3, hinge: 1, ...}`

This is what prevents back-to-back squat days and unbalanced weeks
without trusting the LLM to track it.

---

## 6. API surface

| Method | Path                                            | Purpose                                                            |
|--------|-------------------------------------------------|--------------------------------------------------------------------|
| GET    | `/api/oura/workout?session_type=…`              | Generate fresh workout (uses live biometrics + memory + balancer)  |
| GET    | `/api/oura/workout/today`                       | Restore today's latest non-rejected workout for the UI on mount    |
| GET    | `/api/oura/workout/log?days=7`                  | Backlog: last N days of entries (with patterns, verdicts, feedback)|
| POST   | `/api/oura/workout/regenerate`                  | Reject current and produce a different combo with locked patterns  |
| POST   | `/api/oura/workout/feedback`                    | Save user's completion status (yes / partial / no)                 |

---

## 7. Storage layout

### Firestore collections

| Collection      | Doc id                        | What it holds                                                |
|-----------------|-------------------------------|--------------------------------------------------------------|
| `workout_log`   | `w_<unix-timestamp>`          | One document per generated workout, full schema above        |
| `agent_state`   | `yu_cortex_state` (parent)    | Cortex baseline, summary, counters (NOT workouts)            |
| `agent_state/yu_cortex_state/ticks/{tick_number}`        | YU Cortex 24h tick log entries (separate system)            |
| `agent_state/yu_cortex_state/drift/{timestamp}`          | YU Cortex drift detections (separate system)                |
| `agent_state/yu_cortex_state/interventions/{id}`         | YU Cortex intervention log (separate system)                |
| `rag_knowledge` | `<chunk_id>`                  | Drift research RAG chunks (1536-dim embeddings, separate)    |

### Local files

| File                  | Role                                                            |
|-----------------------|-----------------------------------------------------------------|
| `CF Movements.md`     | Source of truth for the allowed catalog. Copied into the cloud container by `Dockerfile.cloud`. |
| `yu_workout_log.json` | JSON fallback for the workout log when Firestore is unreachable.|

---

## 8. Files at a glance

| File                                              | Role                                                                |
|---------------------------------------------------|---------------------------------------------------------------------|
| `frontend/src/components/PlanOrbit.tsx`           | UI: rendering, persistence, regen, feedback, backlog                |
| `backend/oura/routes.py`                          | HTTP layer for `/workout*` endpoints                                |
| `backend/oura/workout_ai.py`                      | Prompt assembly + Gemini call + parsing                             |
| `backend/oura/workout_brain.py`                   | Catalog loader, log read/write, pattern tagger, balancer, closed-loop |
| `backend/optimize/workout.py`                     | Separate deterministic workout-builder (legacy code path)           |
| `CF Movements.md`                                 | Allowed movement catalog                                            |
| `Dockerfile.cloud`                                | Copies `CF Movements.md` into the container                         |

---

## 9. Three guardrails any new movement edit MUST touch

When removing or adding a movement, three places must agree or the
movement will leak back in:

1. **`CF Movements.md`** — the catalog file
2. **`backend/oura/workout_ai.py`** — the `WORKOUT_PROMPT` constant.
   Has hardcoded movement-catalog snippets and a HARD BAN section that
   list forbidden movements explicitly.
3. **`backend/optimize/workout.py`** — the `MOVEMENTS` dict used by the
   deterministic optimize-engine pool. Separate code path, separate
   source of truth.

This was the lesson from the carry-removal cleanup: deleting from one
place isn't enough.

---

## 10. Security + observability

- Every Gemini and Firestore call from the workout layer goes through
  `backend/agent/security.py::assert_egress_allowed()` — only domains in
  `EGRESS_ALLOWLIST` (Gemini, Firestore, Oura, Telegram) are reachable.
- Cloud Run service account has `roles/datastore.user` and
  `roles/datastore.owner` on `resolution-hack`.
- `google-cloud-firestore` is in `backend/requirements.txt` (this was
  a previously missing dep that broke all Firestore writes silently).
- Every workout entry carries provenance: `generated_at`, `biometrics_pre`,
  `patterns` (deterministic), and the full Gemini JSON in `full_workout`.
- The 24h YU Cortex auto-loop is now triggered by Cloud Scheduler
  (`yu-cortex-daily-tick` at 7am ET) since Cloud Run scales to zero and
  the in-process scheduler can't survive instance recycles.

---

## 11. Known gaps / next-iteration ideas

- **No progressive overload tracker.** DB weights aren't tracked across
  sessions per movement. Hitting "5 reps clean" twice in a row should
  bump the prescribed load — currently doesn't.
- **No two-pass validation subagent.** Gemini's output isn't checked
  against the catalog programmatically; we trust the HARD BAN line and
  the catalog injection. A small validator could re-check every
  movement against the catalog after generation and re-prompt on a miss.
- **`user_feedback.felt` and `user_feedback.soreness` are stored but
  not used yet** by the prompt or closed-loop reviewer. Easy upgrade.
- **Separate optimize/workout.py code path** still exists and is used
  by some other YU surfaces. Eventually it should be deleted or
  unified with `workout_ai.py`.
- **No vector index on workout history yet** — backlog UI does a simple
  recent_log call. If the log grows large, switch to Firestore native
  queries on `(day, rejected)` or add a vector retriever for "find a
  similar past workout that worked well."
