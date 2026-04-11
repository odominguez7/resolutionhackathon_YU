# YU RestOS — UX, Navigation & Workflow Audit

**Date:** April 11, 2026
**Goal:** Polish every tab to match the new Landing page visual standard (dark & powerful, Nike × Oura × Apple). Identify UX issues, navigation logic problems, and workflow improvements.

---

## Current Architecture

### Routes & Navigation

| Route | Tab | Purpose | Theme | Protected |
|-------|-----|---------|-------|-----------|
| `/` | — | Landing | Dark | No |
| `/onboarding` | — | Auth + Setup | Dark | No |
| `/today` | Today | Morning check-in → Workout | Dark (#0a0b0d) | Yes |
| `/agent` | Agent | Intelligence dashboard | **WHITE (#FFFFFF)** | Yes |
| `/oura` | — | Biometric deep-dive | Dark blue (#0a0e27) | Yes |
| `/history` | History | Training log + trends | Dark (#0a0b0d) | Yes |
| `/settings` | Settings | Profile + equipment + wearables | Dark (#0a0b0d) | Yes |

### NavBar Links

Currently: **Today · Agent · History · Settings**

The `/oura` page has NO nav link. Users can only reach it through the navbar's "YU" logo or direct URL. This is a hidden page with some of the richest data in the app.

---

## Critical Issue #1: Split Identity (Light vs Dark)

The Agent page uses a completely different visual language from every other page:

| Property | Agent Page | Every Other Page |
|----------|-----------|-----------------|
| Background | #FFFFFF (white) | #0a0b0d (near-black) |
| Text color | #1C2B3A (dark ink) | #FFFFFF (white) |
| Card style | White cards with light borders | Dark glass cards with subtle borders |
| Font display | Space Grotesk (light mode) | Space Grotesk / Inter (dark mode) |
| Button style | Colored fills on white | Colored fills on dark |
| State indicators | Oura-style circles on white | — |

**Impact:** Navigating from Today → Agent feels like switching to a completely different app. This destroys brand trust and makes the product feel unfinished.

**Recommendation:** Convert Agent to dark theme matching the new Landing page. Keep the excellent data architecture, rebuild the visual layer.

---

## Critical Issue #2: Navigation Structure

### Current nav: Today · Agent · History · Settings

**Problems:**

1. **Oura Profile has no nav entry.** It's the richest data page in the app (170+ days of biometrics, 8 chart types, ring gauges) but it's completely hidden. Users who care about their data — your core audience — can't find it.

2. **"Agent" is a confusing label.** Non-technical users don't know what "Agent" means. The page is actually an intelligence/insight dashboard that shows your state (Locked/Loaded/Steady/Compressed/Depleted) and lets you interact with specialist AI agents. A better name would be "Insights" or "Intelligence" or "State."

3. **No visual hierarchy in nav.** All four items look identical. But Today is the daily driver — it should feel primary. History and Settings are secondary.

4. **Missing bottom tab bar for mobile.** The current mobile UX uses a hamburger menu at the top. For a daily-use fitness app, a bottom tab bar (like Oura, Apple Fitness, Nike TC) would be dramatically better — thumb-accessible, always visible, shows active state.

### Recommended Navigation Restructure

**Desktop (top bar):**
Today · Insights · Data · History · Settings

**Mobile (bottom tab bar):**
Today · Insights · Data · History · Settings (with icons)

Where:
- **Today** = Current Today page (daily hub)
- **Insights** = Current Agent page (renamed for clarity)
- **Data** = Current Oura Profile page (biometric deep-dive — promoted to main nav)
- **History** = Current History page (training log)
- **Settings** = Current Settings page (profile, equipment, wearables)

---

## Page-by-Page UX Audit

### 1. TODAY (`/today`) — The Daily Hub

**User Flow:**
```
Load → Phase 1: Check-in (energy 1-5) → Phase 2: Curiosity reveal →
Phase 3: Biometrics + Action + Workout → Session Mode (optional) → Feedback
```

**What works well:**
- The 3-phase approach (self-report → reveal → action) is psychologically smart — it creates anticipation
- Session mode with per-movement set logging, RPE, and rest timer is genuinely useful
- Fuel prompt ("Did you eat enough to push today?") is a nice behavioral touch
- HRV strategy card with trend direction is excellent data

**UX Problems:**

| # | Problem | Severity | Fix |
|---|---------|----------|-----|
| T1 | **Check-in screen is bare.** Just numbers 1-5 with text labels. No visual richness, no emotional resonance. Compare to Apple Watch mood check. | High | Add gradient color transitions, larger touch targets (48px+), animated color swell on selection, emoji or illustration per state |
| T2 | **Phase 2 (reveal) adds friction without value.** If biometrics are normal, user clicks "See today's plan" — one extra tap with no payoff. Only anomalies justify this step. | Medium | Auto-skip Phase 2 when no anomaly detected. Go straight from check-in to action. Keep the curiosity gap only when something is actually interesting. |
| T3 | **Biometric cards are too small.** 4 tiny cards (p-2.5) in a row. HRV is the most important number and it's 20px text. | High | Make HRV the hero element (large ring gauge, 48px+ score). Stack the other metrics below in a 2×2 grid with more breathing room. |
| T4 | **Workout blocks are text dumps.** Warmup, strength, metcon, cooldown — each is just a list of text. No visual structure, no exercise imagery, no movement icons. | High | Add block-level color coding (warm = amber, strength = red, metcon = orange, cool = blue). Add movement category icons. Increase spacing between blocks. |
| T5 | **Session mode is purely functional.** Full-screen with movement name, RPE slider, log button. No progress visualization, no timer animation, no motivational elements. | High | Add circular progress ring (X of Y movements), large animated timer with color transitions (green→amber→red), movement counter. |
| T6 | **No "summary" after workout.** Session ends → feedback buttons appear → done. No celebration, no recap, no "here's what you did." | Medium | Add a post-workout summary card: total movements, sets logged, avg RPE, duration. Celebrate with animation. |
| T7 | **Override flow is confusing.** If the system says "rest" but user wants to train, the override path is unclear. | Low | Add a clear "Override: I want to train anyway" button with a confirmation step explaining the tradeoff. |

**Visual Consistency Fixes:**
- Add noise-overlay texture (matching new Landing)
- Use card-dark-hover for interactive cards
- Apply Space Grotesk for scores and headlines
- Add subtle glow behind the action card

---

### 2. AGENT (`/agent`) — Intelligence Dashboard

**User Flow:**
```
Load → See 4 specialist cards (Heart/Readiness/Sleep/Stress) → See mystery prompt →
Rate mood (1-10) → Reveal specialist insight card → Read narrative → Approve action →
See closed state → Log goal adherence → Daily done
```

**What works well:**
- The specialist architecture (Heart, Readiness, Sleep, Stress agents) is unique and powerful
- The mystery/reveal pattern creates genuine curiosity
- State system (Locked/Loaded/Steady/Compressed/Depleted) is a brilliant abstraction
- Baseline trend chart with the circular Shazam-style visualization is striking
- Shareable state messages are great for virality
- Goal/hypothesis tracking with day-by-day adherence is sophisticated

**UX Problems:**

| # | Problem | Severity | Fix |
|---|---------|----------|-----|
| A1 | **WHITE BACKGROUND.** The entire page is on #FFFFFF while every other page is dark. This is the #1 visual problem in the app. | Critical | Convert to dark theme (#0a0b0d). Rebuild all cards, text, and borders for dark mode. |
| A2 | **Mood scale is 1-10 (10 buttons in a row).** Today page uses 1-5. Two different scales for the same concept (how do you feel?) on two different pages. Confusing. | High | Unify to a single scale. Either 1-5 everywhere (simpler, faster) or 1-10 everywhere (more granular). Recommend 1-5 for speed. |
| A3 | **"your tests" link in top-right is cryptic.** Opens the goal edit sheet, but "tests" isn't clear language. | Medium | Rename to "Edit goal" or "Hypothesis" with an edit icon. |
| A4 | **Specialist cards are small clickable pills on white.** On dark theme, these need to become the hero element — large, glowing, animated. | High | Redesign as 4 large cards in a 2×2 grid (on dark), each with: specialist icon, today's value (large), trend arrow, state glyph, sparkline. Active card gets a glow border. |
| A5 | **Goal banner is visually separate from the agent cards.** The goal tracker (day dots) and the specialist insights feel disconnected. | Medium | Integrate the goal into the page header. Show "Day X of Y" inline with the specialist cards. |
| A6 | **"Send to Telegram" as the default CTA.** The approve button says "Send to Telegram" which is very specific. If user doesn't use Telegram, this CTA is meaningless. | Medium | Make the CTA contextual: "Take action" or "Apply recommendation" with the delivery method as a secondary choice. |
| A7 | **localStorage/sessionStorage used directly.** These don't work reliably in all contexts and create bugs. | Low | Abstract into a storage utility with fallbacks. |

**Visual Consistency Fixes:**
- Dark background (#0a0b0d) with noise-overlay
- Glass cards (card-dark) for specialist panels
- Gradient text for state labels (text-glow-pulse, text-glow-recovery)
- Glow effects behind the active specialist
- Space Grotesk for all scores and headlines
- Animated state indicators (breathing glow per state)

---

### 3. OURA PROFILE (`/oura`) — Biometric Deep-Dive

**User Flow:**
```
Load (auto-refresh from Oura API) → See ring gauges (Sleep/Readiness/HRV) →
Scroll through charts (sleep stages, HRV, heart rate, activity, stress, bedtime, cardio age) →
Switch interval (7D/14D/30D/ALL)
```

**What works well:**
- Ring gauges with SVG animation are beautiful
- Glassmorphism cards with blur are premium
- Sparklines on stat cards are a nice touch
- Interval selector is functional and well-placed
- Comprehensive data coverage (sleep, activity, readiness, HRV, stress, cardio age)
- Custom chart tooltips are well-styled

**UX Problems:**

| # | Problem | Severity | Fix |
|---|---------|----------|-----|
| O1 | **Page is not in the navigation.** Users can't find it. This is a major gap. | Critical | Add to main nav as "Data" tab. |
| O2 | **Endlessly long scroll.** 8+ chart sections with no organization. On mobile, this is a 20+ screen scroll. | High | Add tabbed sub-navigation: Sleep / Activity / Readiness / Vitals. Only show one section at a time. |
| O3 | **Different background color.** Uses dark-blue (#0a0e27) instead of #0a0b0d. Subtle but inconsistent. | Medium | Standardize to #0a0b0d or accept the blue tint as the "data" theme and apply consistently. |
| O4 | **Ring gauges are 140px.** Oura makes their rings 300px+ hero elements. These are too small. | Medium | Make the top 3 ring gauges (Sleep, Readiness, HRV) hero-sized (240px+) in a centered row. |
| O5 | **No "today's snapshot" at the top.** The page dives straight into all-time history. Users want to see "how am I doing RIGHT NOW" first. | High | Add a hero section at the top: large readiness ring, today's key metrics, delta from baseline. Then charts below. |
| O6 | **PlanOrbit component imported but usage unclear.** The import exists in the file but it's used conditionally. | Low | Clean up — either integrate it as the hero visualization or remove the import. |

**Visual Consistency Fixes:**
- Standardize background to match app (#0a0b0d)
- Use noise-overlay
- Apply Space Grotesk for ring score numbers
- Add animated ring drawing on scroll-into-view (already partially there)

---

### 4. HISTORY (`/history`) — Training Log

**User Flow:**
```
Load → See weekly summary card → See progressive overload cards →
See HRV trend chart → Select time range (7/14/30d) → Browse workout entries (expandable)
```

**What works well:**
- Weekly summary with completion rate and streak is motivating
- Progressive overload tracking with "BUMP" indicators is unique and valuable
- HRV trend chart with direction badge is great feedback
- Expandable workout entries keep the timeline clean

**UX Problems:**

| # | Problem | Severity | Fix |
|---|---------|----------|-----|
| H1 | **Everything is the same visual weight.** Summary, progress, chart, entries — all same-size cards with same borders. No hero element. | High | Make the weekly summary a large hero card (full-width, larger text, streak visualization). Make "BUMP" moments celebrate. |
| H2 | **"BUMP" is a 9px text label.** This is the app's victory moment — proof the user is getting stronger — and it's rendered as barely-visible micro-text. | High | Celebrate bumps: animated glow, larger text, maybe a subtle confetti effect. Make it feel like an achievement. |
| H3 | **Range selector is below the charts.** User has to scroll past content to change the time range. | Medium | Move range selector to the top, below the page title. Make it sticky or prominent. |
| H4 | **No visual distinction between workout types.** Workout, walk, stretch, rest entries all look identical in the timeline. | Medium | Add color-coded left borders or type icons to instantly differentiate. |
| H5 | **Expanded workout detail is plain text.** Movement lists are just indented text strings. | Low | Apply the same visual structure as Today page workout blocks (block headers, movement cards, load highlighting). |

**Visual Consistency Fixes:**
- Noise-overlay
- Card-dark-hover for interactive entries
- Space Grotesk for stat numbers
- Glow effects on the HRV chart card

---

### 5. SETTINGS (`/settings`) — Profile & Configuration

**User Flow:**
```
Load → See account info → Edit equipment grid → Edit goals →
Edit body weight + 1RM baselines → Save → Manage wearable connections →
Manage injury flags → Sign out
```

**What works well:**
- Equipment and goals use the same toggle grid as onboarding (consistency)
- Injury flag body-part selector is a useful feature
- Wearable connect shows clear status per device
- Save confirmation with green flash is satisfying

**UX Problems:**

| # | Problem | Severity | Fix |
|---|---------|----------|-----|
| S1 | **Looks like an admin panel.** No visual polish, no section imagery, no branded elements. Just stacked cards with toggles. | Medium | Add section icons/headers, use the premium card styling, add subtle section dividers. |
| S2 | **Wearable connection is buried.** It's the 6th section on the page. For new users, connecting their ring is the most important action. | Medium | Move wearable connection to the top. Add a prominent "Connected" status with device icon. |
| S3 | **No profile visualization.** No avatar, no readiness ring, no visual identity. Just name + email in text. | Medium | Add user avatar (from Firebase), their current readiness score, their streak count. Make it feel personal. |
| S4 | **Equipment icons are text-only.** The onboarding page at least uses lucide icons. Settings uses plain text labels. | Low | Restore equipment icons. Use the same component from Onboarding. |
| S5 | **Injury flags have no visual explanation.** Users see 6 body parts (shoulder, knee, etc.) but no diagram of what "blocking" means for their workouts. | Low | Add a brief explainer: "Flagged areas will block movements that stress that joint." |

**Visual Consistency Fixes:**
- Use card-dark-hover for all section cards
- Add section headers with icons
- Match spacing to new Landing page standards

---

### 6. ONBOARDING (`/onboarding`) — First-Time Setup

**User Flow:**
```
Step 0: Auth (Google/Apple) → Step 1: Equipment selection →
Step 2: Fitness level → Step 3: Goals → Step 3.5: Calibration (optional) →
Step 4: Confirmation → Redirect to /today
```

**What works well:**
- Progressive disclosure (one thing per step) is the right pattern
- "Skip" option on calibration respects user time
- Confirmation animation with spring bounce is satisfying

**UX Problems:**

| # | Problem | Severity | Fix |
|---|---------|----------|-----|
| B1 | **No progress indicator.** 5 steps with no stepper, no dots, no "step 2 of 5." Users don't know how long this will take. | High | Add a thin progress bar at the top (or step dots) showing current position. |
| B2 | **Step 0 (auth) has no visual.** Just "YU" + text + two buttons. This is the first impression for new users. | High | Add a hero visual — the readiness ring, an athlete image, or an animated brand mark. |
| B3 | **Equipment icons are wrong.** Pull-up bar, bench, box, rower all use the same Target icon. This is confusing. | Medium | Create distinct icons for each equipment type (or use text-only with better visual differentiation). |
| B4 | **Calibration step looks identical to other steps.** This is the most important step for workout accuracy — it should feel different (more scientific, more "calibration room"). | Low | Add a monospace font for the number inputs, a subtle grid pattern background, "calibrating..." language. |
| B5 | **Confirmation is minimal.** Green check + "You're in." → button. No preview of what's coming, no excitement. | Medium | Show a preview of their first workout, their initial readiness ring, or a visual summary of their profile. |

---

## Cross-Cutting Recommendations

### 1. Unified Theme

Convert the entire app to the new dark visual language from the Landing page:

| Element | Standard |
|---------|----------|
| Background | #0a0b0d |
| Surface | rgba(255,255,255,0.02) with 1px rgba(255,255,255,0.06) border |
| Card hover | translateY(-2px) + glow shadow + brighter border |
| Primary accent | linear-gradient(135deg, #FF5C35, #FF7A54) |
| Display font | Space Grotesk 700-900 |
| Body font | Inter 400-600 |
| Metric font | Space Grotesk or JetBrains Mono tabular-nums |
| Texture | noise-overlay on every page |
| Glow system | Radial gradients behind hero elements |

### 2. Mobile Bottom Tab Bar

Replace the hamburger menu with a fixed bottom tab bar:

```
[ Today ] [ Insights ] [ Data ] [ History ] [ Settings ]
   ⚡         🧠         📊       📅         ⚙️
```

- Active tab: white icon + #FF5C35 indicator dot below
- Inactive: rgba(255,255,255,0.3) icon
- Bar: rgba(10,11,13,0.9) + blur(24px)
- Height: 56px + safe area

### 3. Loading States

Replace all "pulsing orange dot" loaders with a branded loading animation:

- Skeleton shimmer cards (already exists as WorkoutSkeleton — generalize it)
- Animated YU logo mark (rotating ring + pulse) for full-page loads
- Inline shimmer for data values updating

### 4. Page Transitions

Current: fade + slide-up (0.35s). This is good. Keep it. Add:

- Scroll-triggered section reveals on data-heavy pages (OuraProfile, History)
- Spring physics for interactive elements (buttons, cards)
- Animated number transitions when data values change

### 5. Celebration Moments

The app tracks real achievements but never celebrates them:

| Moment | Current | Should Be |
|--------|---------|-----------|
| Workout complete | Text "Done" badge | Confetti/ring fill animation + summary card |
| Progressive overload BUMP | "BUMP" in 9px green text | Glow animation + prominent badge + sound |
| Goal streak continued | Silent day-dot fill | Brief celebration + streak counter animation |
| 30-day milestone | Nothing | Full-screen achievement card |

---

## Execution Priority

### Phase 1: Unify Theme (highest impact)

1. Convert Agent page to dark theme
2. Add bottom tab bar (mobile) + update desktop nav (rename Agent → Insights, add Data tab)
3. Standardize OuraProfile background to #0a0b0d
4. Add noise-overlay and Space Grotesk to all pages

### Phase 2: Today Page Polish

5. Redesign check-in with visual energy scale
6. Enlarge biometric cards (HRV as hero ring gauge)
7. Add color-coded workout blocks with more spacing
8. Build post-workout summary card

### Phase 3: Agent Page Rebuild

9. Rebuild specialist cards for dark theme (2×2 glowing grid)
10. Unify mood scale (1-5 matching Today)
11. Add animated state indicators
12. Build shareable card image generator

### Phase 4: Data & History Polish

13. Add tabbed sub-nav to OuraProfile (Sleep/Activity/Readiness/Vitals)
14. Enlarge ring gauges and add today-snapshot hero
15. Redesign History with visual hierarchy and BUMP celebrations
16. Move range selector to top of History page

### Phase 5: Settings & Onboarding

17. Add profile visualization to Settings header
18. Move wearable connection to top of Settings
19. Add progress indicator to Onboarding
20. Add hero visual to Onboarding Step 0

---

## Figma Integration

Figma is connected (Omar Dominguez, Pro plan, omar7@mit.edu). We can use it for:

- **Exporting design tokens** to ensure consistency
- **Generating component screenshots** for reference during development
- **Creating a design system** from the new Landing page components
- **Building shareable cards** and marketing assets

---

## Summary

The product architecture is exceptional — the closed-loop biometric system, multi-agent intelligence, progressive overload tracking, and hypothesis testing are genuinely unique. The new Landing page proves the visual bar YU should hit.

The main work is bringing every other page up to that bar. The highest-impact changes are: (1) unify everything to dark theme, (2) fix the navigation, (3) make data the hero on every page, and (4) celebrate user achievements. All the data and functionality already exists — it just needs the premium visual treatment.
