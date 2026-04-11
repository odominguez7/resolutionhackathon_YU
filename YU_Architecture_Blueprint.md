# YU — Architecture & UX Redesign Blueprint
### Research-Driven Premium Rebuild | April 2026

---

## 1. Executive Summary

This document synthesizes findings from 22 research files covering behavioral science, wearable UX, micro-copy design, retention psychology, visual design for high-trust audiences, and competitive teardowns (WHOOP, Oura, Levels, Apple Health). It maps every recommendation against the current YU implementation, identifies critical gaps, and proposes a page-by-page architecture that transforms YU from a developer prototype into a premium product evoking Apple's restraint, Nike Training Club's performance identity, and Alo Yoga's aspirational calm.

**Core thesis**: YU's backend intelligence (drift detection, LangGraph agent loop, SPC baselines, Gemini coaching) is best-in-class. The frontend doesn't yet surface that intelligence with the confidence, pacing, and visual authority the engine deserves.

---

## 2. Research Gap Analysis — What the 22 Files Say vs. What Exists

### 2.1 Critical Gaps (High Impact, Not Yet Implemented)

| # | Research Recommendation | Current State | Gap Severity |
|---|------------------------|---------------|-------------|
| 1 | **Micro-curiosity gap**: Don't show score on app open. Create anticipation → reveal mechanic (File 9: Variable Reward Mechanics) | Today page shows biometrics immediately in Phase 3 after check-in. Phase 2 blur-reveal exists but only during initial load, not as a persistent daily ritual | HIGH |
| 2 | **Single-card morning ritual**: One card, one state, one action. 40-55 seconds, 2 taps, 1 decision (Files 4, 7, 8, 11) | Today page has 6+ cards stacked vertically (Body Context, Anomaly, Fuel, HRV Strategy, Workout). Cognitive overload for morning use | CRITICAL |
| 3 | **Z-pattern layout**: Score top-left, insight top-right, action CTA bottom-right (File 8) | Current layout is linear vertical scroll. No spatial hierarchy guiding the eye through a decision flow | HIGH |
| 4 | **Behavior-triggered notifications >> scheduled** (Files 5, 14, 20): 8x more effective when triggered by anomaly | No notification architecture in frontend. Telegram nudges exist but aren't surfaced in-app with proper timing | MEDIUM |
| 5 | **Identity framing**: "You recover like an athlete" activates self-concept (File 10, r=0.55 identity-habit correlation) | Some performance language ("Body confirms", "Adaptation signal") but no persistent identity reinforcement throughout the experience | HIGH |
| 6 | **Streaks never break — they pause** (File 10): Avoid streak punishment, use pause framing | History page shows "consistency" streak as a number that can drop. No pause mechanic | MEDIUM |
| 7 | **Phase AI recommendations**: Observation-only (14 days) → calibrated suggestions → agentic actions (File 15) | Agent goes straight to full recommendations from day 1. No trust-building phased rollout | HIGH |
| 8 | **Dark navy trust palette** (File 13): #0A1628 to #1A3A6A range. Blue stimulates trust neurochemically across 5 independent labs | Current palette is pure black (#0a0b0d) with orange accents. Looks technical/developer, not premium/trustworthy | HIGH |
| 9 | **Score-dependent anxiety guardrails** (File 10): Normalize variability, show user's standard deviation, cap insight refresh to once/day | No variability normalization. Users can refresh data repeatedly. No "this is normal" framing for fluctuations | MEDIUM |
| 10 | **Card-based progressive disclosure** (File 8): Aggregate first → clickable drill-down. 73-76% of dashboard time is mental processing | OuraProfile/Data page dumps all metrics at once. No progressive layering | HIGH |

### 2.2 Partially Implemented (Needs Refinement)

| # | Research Recommendation | Current State | What's Missing |
|---|------------------------|---------------|---------------|
| 11 | Subjective-first protocol: felt state BEFORE biometric scores (Files 5, 7, 10) | Today Phase 1 check-in exists before reveal | Check-in question is good but needs stronger "performance readiness" framing, not emoji scale |
| 12 | Narrative + data hybrid (File 15): Text drives action, data anchors credibility, mechanism implies expertise | Workout card has reasoning text. Agent has specialist cards | Inconsistent. Some cards are data-only, others narrative-only. Need consistent hybrid format everywhere |
| 13 | EWMA/SPC individual baselines (Files 2, 3, 5, 15) | Baseline bars exist on HRV card in Today page | Only on HRV, not on all 4 metrics. Baseline context should be the default framing for every number shown |
| 14 | If-then implementation intentions (File 15): "Walk before 2pm meeting" is 40-60% more effective than "consider a break" | Some specific actions in workout. Agent nudges via Telegram are specific | In-app CTAs are still generic ("See today's plan"). Need time-anchored, specific if-then actions |
| 15 | Privacy-first defaults with visible governance (Files 3, 4, 12) | Settings page has Privacy & Data Governance card | Good start but needs to be more prominent — first onboarding screen should surface privacy commitment |

### 2.3 Well Implemented (Maintain)

| # | Recommendation | Implementation |
|---|---------------|----------------|
| 16 | Performance framing over wellness (Files 3, 6, 10) | "Readiness to perform", "Training log", "Output rate" — well done |
| 17 | Morning check-in before data (Files 5, 7) | Phase 1 subjective check-in exists |
| 18 | Prediction-confirmation mechanic (File 9: variable reward) | "Body confirms" / "Mismatch detected" comparison |
| 19 | Closed-loop visualization (unique to YU) | Landing page 7-step orbit diagram |
| 20 | Alert threshold controls (File 12: user agency) | Settings page toggles for HRV/sleep/readiness/overtraining |

---

## 3. Brand North Star — Apple × Nike × Alo Yoga

### Visual DNA

**Apple**: Restraint as authority. Massive whitespace (or dark-space). One hero element per viewport. Typography does the heavy lifting. No decoration that doesn't earn its space.

**Nike Training Club**: Performance identity activation. Dark backgrounds, high-contrast action photography, athlete-first language. Every screen makes you feel like an elite performer, not a patient.

**Alo Yoga**: Aspirational calm. Soft gradients, breathable layouts, organic transitions. The product feels like it's taking care of you, not surveilling you.

### Synthesis for YU

| Element | Direction |
|---------|-----------|
| **Background** | Deep navy (#0B1120) not pure black. Subtle radial gradient wash, not flat |
| **Primary accent** | Keep coral/orange (#FF5C35) for CTAs but use sparingly — max 2 instances per viewport |
| **Trust color** | Introduce deep blue (#1A3A6A → #2563EB) for data surfaces, metric cards, trust signals |
| **Typography** | Space Grotesk stays for headings. Increase weight contrast: 700 for headlines, 300 for body. Larger sizes (48-64px hero numbers) |
| **Photography** | Full-bleed athlete imagery on Landing, Onboarding. Not stock — shot with intention. Dark, desaturated, cinematic grain |
| **Spacing** | 2x current padding. Cards breathe. Every element has negative space proportional to its importance |
| **Motion** | Slower, more intentional. Spring physics (not linear). 0.6-0.8s transitions. Everything feels weighted, not snappy |
| **Glass effects** | Subtle backdrop-blur(24px) on cards. rgba(255,255,255,0.04) surfaces, not 0.08. Less glass, more depth |
| **Icons** | Thinner stroke weight (1.5px not 2px). Fewer icons. Let text communicate |

---

## 4. Page-by-Page Architecture

### 4.1 TODAY — The Morning Ritual (Complete Redesign)

**Research mandate**: Single-card, 40-55 seconds, 2 taps, 1 decision. Micro-curiosity gap. Z-pattern.

#### Current Problems
- 6+ cards visible simultaneously (cognitive overload)
- No pacing — all information available at once
- Workout details dominate the viewport (implementation detail, not strategic insight)
- Anomaly alert competes with workout card for attention

#### New Architecture: 3-Act Morning Ritual

**Act 1 — The Question** (5 seconds)
- Full viewport. Deep navy background with subtle breathing ambient glow
- Single question: "How ready are you to perform today?"
- 4-option horizontal selector (not 5 emojis): `Depleted` / `Low` / `Steady` / `Sharp`
- Each option is a pill with subtle color coding
- No other UI elements. No nav bar. No metrics. Just the question
- Tap = immediate transition to Act 2

**Act 2 — The Reveal** (15 seconds)
- Micro-curiosity gap: "Something shifted in your recovery last night..."
- 1.5s pause. Then: single readiness number animates in (82) with circular ring
- Below: one-line narrative insight: "HRV recovered +1.7ms. Your nervous system absorbed yesterday's load."
- If anomaly: the narrative changes tone. Orange glow. "HRV deviated 22% from your baseline. The system is pulling back intensity."
- Prediction-confirmation pill: "Body confirms your read" or "Mismatch — your body says different"
- Single CTA at bottom: "See your session" (gain-framed, time-bounded)

**Act 3 — The Session** (30 seconds to decide, then training)
- One card. The workout. Hero treatment
- Title, duration, intensity as color-coded badge
- One-line "why this session" reasoning
- Two buttons: `Start Session` (primary) / `Show me another` (ghost)
- Expandable detail (chevron) for movement list — hidden by default
- Session mode activates on start: full-screen immersive timer

**Key changes**:
- Kill the 4-metric grid on initial view. Those belong in Data page
- Kill the Fuel Prompt card. Move to a contextual nudge inside Act 2 narrative
- Kill the HRV Strategy card. Fold into Act 2 narrative
- Session mode stays as-is (circular timer is good)

#### Layout Pattern
```
┌─────────────────────────────┐
│                             │
│   How ready are you         │  ← Act 1: Full viewport
│   to perform today?         │
│                             │
│   [Depleted] [Low] [Steady] [Sharp]
│                             │
└─────────────────────────────┘
         ↓ tap ↓
┌─────────────────────────────┐
│  Something shifted...       │  ← Act 2: Reveal
│                             │
│        ┌───────┐            │
│        │  82   │  ← Readiness ring
│        └───────┘            │
│                             │
│  "HRV recovered +1.7ms.    │
│   Body absorbed the load."  │
│                             │
│  [Body confirms ✓]          │  ← Prediction pill
│                             │
│  [ See your session → ]     │  ← Single CTA
└─────────────────────────────┘
         ↓ tap ↓
┌─────────────────────────────┐
│  EMOM Grind                 │  ← Act 3: Session card
│  ■ MODERATE · 40min         │
│                             │
│  "Readiness supports push.  │
│   Shortened 15min — sleep   │
│   impact after 5pm."        │
│                             │
│  [ START SESSION ]          │  ← Primary CTA
│  [ show movements ∨ ]       │  ← Expandable
└─────────────────────────────┘
```

---

### 4.2 INSIGHTS — The Agent Dashboard (Redesign)

**Research mandate**: Phase AI trust. Identity framing. Card-based progressive disclosure. Single CTA per card.

#### Current Problems
- Specialist grid (4 columns) is too dense for mobile
- Goal progress banner competes with specialist cards
- Mystery card → reveal → approval is three states that aren't clearly differentiated
- No clear "what should I do right now" hierarchy

#### New Architecture: The Daily Brief

**Hero Section — Today's Spokesperson**
- One specialist gets the stage each day (council picks)
- Full-width card with specialist avatar/icon, state label, and the daily insight
- Identity-framed: "Your HRV profile matches elite recovery patterns today"
- Single action CTA: specific, time-anchored ("5-min box breathing before your 9am block")
- Share button (generates Instagram story card)

**Active Experiment Card**
- Current hypothesis in progress
- Minimal: behavior statement + day counter + micro progress visualization
- Tap to expand: full adherence timeline, baseline trend, prediction accuracy

**Specialist Bench** (below fold)
- 4 specialist cards in 2x2 grid (not 4-column)
- Each shows: metric value, state glyph, one-line status
- Tap any card → full specialist view with detailed analysis
- Locked state for specialists that haven't earned trust yet (phased AI)

**Chat Interface** (bottom sheet)
- Persistent bottom tab: "Ask YU anything"
- Pulls up Gemini-powered conversational interface with full biometric context
- This is where the "agentic" nature of the app becomes most visible

---

### 4.3 DATA — Biometric Intelligence (Redesign)

**Research mandate**: Progressive disclosure. Aggregate first → drill-down. Bar charts > other formats. Dark mode confirmed superior.

#### Current Problems
- 3-tab system (Summary/Trends/Details) is good structure but content is flat
- Summary tab is just the orbit visualization — not useful as daily data view
- Trends tab dumps all stats simultaneously

#### New Architecture: Signal Hierarchy

**Primary View — The Signal**
- One hero card: the most anomalous metric today, with SPC context
- "Your HRV is 22% below your 30-day baseline. This is the 2nd consecutive suppressed night."
- Variability normalization: "Normal range for you: 28-36ms" (show user's SD)
- Below: 4 metric tiles in 2x2 grid, each showing value + mini sparkline + vs-baseline delta
- Tap any tile → full drill-down

**Drill-Down View**
- 7/14/30/ALL time range selector
- Area chart (single metric over time) with baseline band overlay
- Contributing factors (for readiness: HRV weight, sleep weight, activity weight)
- Historical context: "Your lowest was 18ms on March 2. You recovered in 2 nights."

**Weekly Report** (bottom)
- Generated once per week
- Key patterns, anomalies, and trend directions
- Shareable as image

---

### 4.4 LANDING — The First Impression (Major Redesign)

**Research mandate**: Identity activation. Performance framing. Minimalism as proxy for competence. First 72 hours are critical.

#### Current Problems
- Hero copy is good but the page feels like a SaaS landing page, not a premium product
- Stats section (183+ days, 8 auto-progressed, 3 ML models) is internal — users don't care about ML model count
- "See how it works" CTA leads to... what? The closed-loop diagram isn't a product demo
- Missing: social proof, aspirational imagery, clear value proposition hierarchy

#### New Architecture: The Athlete's OS

**Hero Section**
- Full-bleed cinematic athlete image (dark, desaturated, moody)
- Overlaid: "Your body already knows. YU listens." (keep — it's strong)
- Subtitle: "The training OS that reads your biology and writes your program."
- Single CTA: "Start training" (coral button, no second button competing)
- Floating readiness ring positioned as if embedded in the athlete's world

**Social Proof Bar**
- "Trusted by 50+ athletes" or "Built on 183 days of real biometric data" (reframe stats as credibility)
- Logos if available (Oura, Google Cloud, Gemini)

**The Loop — Simplified**
- 3 panels (not 7 steps): "Read → Plan → Adapt"
- Each panel: short headline, one sentence, subtle product screenshot
- No orbit diagram — too complex for first impression

**The Difference**
- Side-by-side: "Other apps tell you a number. YU tells you what to do with it."
- Single example: readiness score → today's session was shortened 15 minutes → next-day HRV recovered → system learned

**Bottom CTA**
- "Ready to train smarter?" with email capture or direct sign-in
- No secondary options. One path in.

---

### 4.5 ONBOARDING — Trust Building (Refine)

**Research mandate**: 5-10 steps, >70% completion, first 72 hours critical, privacy-first.

#### Current State: Mostly Good
The current onboarding flow (auth → equipment → fitness → goals → calibration → reveal) is well-structured. Refinements:

- **Step 0**: Add privacy commitment before auth: "Your data stays yours. We never share, sell, or expose your biometrics." One line, visible before the Google/Apple buttons
- **Step 2 (fitness level)**: Add identity activation: "Most YU users are intermediate-to-advanced athletes optimizing recovery" (social proof + identity framing)
- **Step 4 (reveal)**: Show the first Act 1 → Act 2 morning ritual immediately. Don't make them wait until tomorrow. "Here's what tomorrow morning looks like" with a simulated reveal using their calibration data
- **New Step**: During 14-day baseline, show progress: "Day 3 of 14: Your baseline is building. The more data YU sees, the sharper your insights."

---

### 4.6 HISTORY — Performance Ledger (Refine)

**Research mandate**: Streaks pause, don't break. Progressive overload visibility. Identity reinforcement.

#### Refinements
- Rename "consistency" streak to "training momentum" — and when broken, show "paused" not "reset"
- Progressive overload card is strong — make it hero. This is the clearest evidence YU is working
- Add "personal records" section: movement PRs with date achieved
- Weekly summary should lead with identity framing: "Week of April 7: You trained like a competitor. 4 sessions, all prescribed loads hit."

---

### 4.7 SETTINGS — Trust & Control (Refine)

Minor refinements only. The Privacy & Data Governance card and Alert Thresholds are well-implemented.

- Move "Privacy & Data Governance" above equipment/goals (trust before preferences)
- Add "Export my data" button (CSV download — signals user ownership)
- Add "AI transparency" section: "How YU decides your session" with simplified decision tree

---

## 5. Demonstrating Agentic Intelligence

The biggest gap: **users can't see the agent working**. The LangGraph loop, drift detection, and specialist council are invisible. The app feels like a static dashboard, not an intelligent system.

### Make the Agent Visible

1. **Agent Status Indicator** (persistent, all pages)
   - Subtle pulse dot in nav bar: "YU is analyzing" / "YU has an insight" / "YU is learning"
   - Not intrusive — just ambient awareness that intelligence is running

2. **Decision Provenance** (every recommendation)
   - Every workout, every nudge, every insight should have a tappable "Why this?" link
   - Reveals: "Based on 3 consecutive low-HRV nights + your RPE 8 from yesterday + your goal of getting stronger, I shortened today's session and replaced barbell work with dumbbells."
   - This is the killer differentiator vs. WHOOP/Oura

3. **Learning Confirmation** (post-session)
   - After logging RPE: "Got it. I'm updating your load tolerance model. Tomorrow's session will reflect today."
   - After anomaly resolves: "Your HRV recovered in 2 nights. I'm recalibrating your baseline."
   - These micro-confirmations make the agent tangible

4. **Weekly Agent Report**
   - "This week, YU made 12 decisions on your behalf: 3 session modifications, 2 load progressions, 4 recovery nudges, 3 schedule adjustments."
   - Shows the invisible work made visible

5. **Phased Trust Model** (File 15 recommendation)
   - Days 1-14: Observation mode. "I'm learning your patterns. No recommendations yet."
   - Days 15-30: Suggestions mode. "Based on your data, I'd suggest..." (user must confirm)
   - Days 31+: Agentic mode. "I've adjusted today's session." (auto-applied, user can override)
   - Each phase transition is celebrated: "YU has graduated to personalized mode. Your baseline is set."

---

## 6. Figma Integration Strategy

### What Figma Should Own

| Layer | What to Design in Figma | Why |
|-------|------------------------|-----|
| **Design tokens** | Color palette (navy system), typography scale, spacing grid, border radii, shadow system | Single source of truth for the entire visual language |
| **Component library** | Metric card, insight card, CTA button, state pill, progress ring, sparkline, specialist avatar | Reusable across all pages with consistent visual weight |
| **Page compositions** | Full-page layouts for each of the 7 pages at mobile (390px) and tablet (768px) | See the full experience before coding — catch layout issues early |
| **Interaction prototypes** | Act 1→2→3 morning ritual flow, session mode transitions, card reveal animations | Validate timing, pacing, and emotional beats |
| **Brand assets** | Hero athlete photography treatment, noise/grain textures, gradient definitions, share card templates | Premium visual layer that code can't easily iterate on |
| **Icon set** | Custom icon family (thinner, more distinctive than Lucide defaults) | Distinctive brand identity |

### Design System Structure in Figma

```
YU Design System/
├── Foundations/
│   ├── Colors (Navy scale, Accent scale, Semantic)
│   ├── Typography (Space Grotesk scale, Inter scale)
│   ├── Spacing (4px base grid, 8/16/24/32/48/64)
│   ├── Shadows & Elevation
│   └── Motion (spring configs, duration tokens)
├── Components/
│   ├── Atoms (Button, Pill, Badge, Icon, Input)
│   ├── Molecules (MetricCard, InsightCard, ProgressRing, Sparkline)
│   └── Organisms (SessionCard, SpecialistPanel, RevealSequence)
├── Pages/
│   ├── Landing (mobile + tablet)
│   ├── Onboarding (5 steps)
│   ├── Today (3 acts)
│   ├── Insights (daily brief)
│   ├── Data (signal hierarchy)
│   ├── History (performance ledger)
│   └── Settings (trust & control)
└── Prototypes/
    ├── Morning Ritual Flow
    ├── Session Mode
    └── Agent Reveal Sequence
```

### Figma → Code Pipeline

1. Design tokens export as JSON → Tailwind config
2. Component specs export as props/variants → React component API
3. Motion specs define spring/duration values → Framer Motion config
4. Asset exports (optimized SVG, WebP photography) → /public/assets/

---

## 7. Premium Visual Elements

### Photography Direction
- Style: Dark, cinematic, desaturated with selective warm light
- Subjects: Solo athletes mid-movement (not posed). Training environments, not studios
- Treatment: Grain overlay (0.3 opacity), slight vignette, color grade toward deep navy shadows
- Usage: Landing hero (full-bleed), Onboarding backgrounds (40% opacity overlay), Share cards

### Texture & Depth
- Subtle noise texture on card backgrounds (feTurbulence SVG filter, 0.02 opacity)
- Layered depth: background plane → card plane → content plane (3 distinct z-levels)
- Edge glow on hero elements (radialGradient, coral to transparent)
- No hard borders on cards — use subtle shadow + backdrop-blur differentiation

### Button Hierarchy
- Primary: Solid coral (#FF5C35), rounded-full, 48px height, Space Grotesk 600
- Secondary: Ghost with 1px coral border, transparent fill
- Tertiary: Text-only with underline on hover
- Maximum 1 primary CTA per viewport (Apple rule)

### Animation Philosophy
- Enter: `spring({ damping: 25, stiffness: 120 })` — weighted, not bouncy
- Exit: `ease-out, 0.3s` — quick departure, no lingering
- Data reveals: `blur(16px) → blur(0px)` over 0.8s with scale 0.95 → 1.0
- Numbers: Count-up animation, 1.2s, ease-out
- Nothing should animate for the sake of animating. Every motion communicates state change.

---

## 8. Implementation Priority

### Phase 1 — Foundation (Week 1-2)
1. Color system migration: #0a0b0d → deep navy (#0B1120)
2. Typography scale update: larger numbers, thinner body, more weight contrast
3. Spacing overhaul: 2x padding on all cards and sections
4. Today page 3-act restructure (biggest UX impact)

### Phase 2 — Intelligence Layer (Week 3-4)
5. Agent status indicator (persistent pulse dot)
6. Decision provenance ("Why this?") on all recommendations
7. Learning confirmations post-session
8. Phased trust model (observation → suggestion → agentic)

### Phase 3 — Premium Polish (Week 5-6)
9. Landing page redesign with photography
10. Figma design system build
11. Share card elevation (Instagram story optimization)
12. Weekly agent report
13. Data page signal hierarchy redesign

### Phase 4 — Retention & Growth (Week 7-8)
14. Onboarding refinements (privacy-first, identity activation, simulated first morning)
15. Streak pause mechanic
16. Personal records section
17. Export my data feature
18. AI transparency section

---

## 9. Success Metrics

| Metric | Current (Estimated) | Target | How to Measure |
|--------|-------------------|--------|----------------|
| Morning ritual completion | ~40% of opens | >75% | Check-in → reveal → session start |
| Time to first action | ~90 seconds | <45 seconds | App open → session start tap |
| Day 7 retention | Unknown | >60% | Firebase analytics |
| Day 30 retention | Unknown | >35% | Firebase analytics |
| Session mode completion | Unknown | >80% | RPE logged / sessions started |
| Agent trust score | N/A | >4.0/5.0 | Post-session micro-survey (monthly) |

---

*This blueprint is a living document. Each section maps directly to research citations from the 22 source files and should be revisited as user data validates or invalidates assumptions.*
