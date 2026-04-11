# YU RestOS — Deep UI Audit

**App URL:** https://yu-restos-471409463813.us-east1.run.app  
**Website:** https://yu.boston  
**Date:** April 11, 2026  
**Target Aesthetic:** Nike × Oura × Apple — premium fitness technology

---

## Executive Summary

YU has strong bones: a coherent dark color system, real-time biometric data, and genuine product depth. But visually, it reads as a **developer prototype**, not a premium health-tech product. The gap between YU and the Nike/Oura/Apple tier comes down to five systemic issues: no photography or rich media, inconsistent visual identity across pages, text-heavy UI with no visual hierarchy breathing room, a navbar that clashes with the app's dark identity, and missing the polish details (micro-interactions, gradients, depth) that make premium products feel *expensive*.

This audit breaks down every screen, identifies the specific problems, and maps each to a concrete fix inspired by Nike Training Club, Oura Ring app, and Apple Fitness+.

---

## 1. Brand Identity Gaps

### What Nike/Oura/Apple Do

| Brand | Signature Move | How It Feels |
|-------|---------------|-------------|
| **Nike** | Full-bleed athlete photography, bold condensed type (Futura), high-contrast CTAs, motion everywhere | Aspirational, energetic, unapologetically bold |
| **Oura** | Soft gradients on dark canvas, glowing ring visualizations, generous whitespace, muted data density | Calm authority, premium restraint, health as luxury |
| **Apple Fitness+** | Vibrant activity rings, san-francisco-rounded typography, frosted glass cards, hero imagery of real people training | Approachable premium, alive with color, human |

### What YU Does Now

YU currently sits in a **generic dark SaaS** aesthetic. The dark canvas (#0a0b0d) is correct — that matches Oura. But everything on top of it is flat, text-dense, and icon-reliant. There's no *emotional pull*.

**Critical brand gaps:**

- **Zero photography.** No hero images, no workout imagery, no athlete shots, no lifestyle photos. The entire app is text + lucide icons + small data numbers. Nike and Apple never ship a fitness screen without a human in it.
- **No brand illustration or 3D.** Oura uses glowing ring renders and soft gradient orbs. Apple uses activity ring animations. YU has nothing equivalent — the "readiness ring" concept exists in the README but isn't visually realized as a hero element.
- **Wordmark only, no brand mark.** "YU" in Space Grotesk is clean but has no icon, no symbol, no visual anchor. Nike has the swoosh. Oura has the ring. Apple has the rings. YU needs a mark.
- **No gradient or glow language.** Oura's entire palette is built on soft radial glows. Apple uses vivid ring gradients. YU uses flat hex colors with no depth, no bloom, no luminosity.

---

## 2. Page-by-Page Breakdown

### 2.1 Landing Page (`Landing.tsx`)

**Current state:** Dark canvas, animated stats counter, 6 feature cards in a 2-column grid, "closed loop" step diagram, bottom CTA. All text. No images.

**Problems:**

1. **No hero image or visual.** The hero is just a headline + subtext + two buttons. Compare to Nike Training Club's landing which always leads with a full-bleed athlete photo or video. The absence of any visual makes YU feel like a developer docs page.

2. **Feature cards are icon + text walls.** Six cards, each with a 20×20 lucide icon and a paragraph. This is a SaaS feature grid, not a fitness product. Nike would use full-bleed photography for each feature. Oura would use a glowing visualization.

3. **"The closed loop" section is a row of tiny pills.** Seven steps in text pills with 3px arrows. This is the most powerful concept in YU — and it's rendered as barely-visible micro-text. This should be an animated circular diagram, an orbital visualization, or at minimum a striking infographic.

4. **Stats counter (183+ days, 8 movements, 3 ML models)** has good animation but tiny presentation. These numbers should be hero-sized, with supporting context.

5. **Footer is nearly invisible.** "Oura Ring · Apple Watch · Gemini 2.5 Flash · XGBoost · LangGraph" at 10px opacity 10% — this is actually credibility content that should be presented as a proper partner/technology bar.

**Fixes:**

- Add a full-bleed hero image or video (athlete training with Oura ring visible)
- Replace feature card icons with either photography, 3D renders, or large illustrative graphics
- Redesign "closed loop" as an animated circular/orbital diagram (you already have `PlanOrbit.tsx` — adapt it)
- Make the stats section a full-width band with 48px+ numbers
- Convert footer tech logos into a proper "Powered by" strip with actual logos at reasonable opacity

---

### 2.2 Onboarding (`Onboarding.tsx`)

**Current state:** 5-step wizard (Auth → Equipment → Fitness Level → Goals → Calibration → Confirmation). All text, toggle buttons, and inputs on #0a0b0d.

**Problems:**

1. **No welcome imagery.** Step 0 is "YU" in white + "Your body has data" + two auth buttons. This is the first thing a new user sees. Apple's onboarding always leads with a hero visual. Nike shows athletes.

2. **Equipment selector uses generic Target icons for everything.** Pull-up bar, bench, box, rower — they all get the same Target icon. This is confusing and looks unfinished.

3. **No progress indicator.** 5 steps with no stepper, no progress bar, no "step 2 of 5." Users have no idea how long this will take.

4. **Calibration step (3.5) is visually identical to every other step.** This is the most important step — it determines workout accuracy. It should feel different, more premium, more "science."

5. **Confirmation step is bare.** Green checkmark + "You're in." + one button. No celebration, no preview of what's coming, no animation beyond a spring bounce.

**Fixes:**

- Add a welcome hero image or animation on Step 0
- Use distinct, recognizable equipment illustrations (silhouettes of actual equipment, not generic icons)
- Add a subtle progress bar or step dots at the top
- Style the calibration step with a "lab/science" aesthetic — subtle grid background, monospace numbers, precision feel
- Make confirmation step feel like an achievement — confetti, a preview card of their first workout, or a readiness ring visualization

---

### 2.3 Today Page (`Today.tsx`)

**Current state:** Three phases: (1) Morning check-in (energy 1-5), (2) Curiosity gap reveal, (3) Main action view with biometrics, workout blocks, session mode. All text and tiny data cards.

**Problems:**

1. **Check-in screen is bare.** "How are you showing up today?" with 5 numbered buttons (1-5). Compare to Apple Watch's mood check or Oura's morning readiness — they use rich color, animation, and illustration. This feels like a survey form.

2. **Biometrics grid (HRV, Ready, Sleep, Stress) is tiny.** Four 2.5-padding cards in a row with 8px labels. This is the *core value prop* — your body data — and it's rendered at the smallest possible size. Oura makes these the hero element with large ring gauges and gradients.

3. **Workout block rendering is a text dump.** Warmup/Strength/Metcon/Cooldown blocks are rendered as plain text lists with 9px block headers. Nike Training Club shows each exercise as a card with demonstration images. Even without images, the current rendering lacks visual hierarchy, spacing, and structure.

4. **Session mode (active workout tracking) is purely functional.** Full-screen with movement name, reps, an RPE slider, and a "Log Set + Rest 90s" button. No timer animation, no progress visualization, no motivational elements. Apple Fitness+ has animated rings filling up. Nike has large timer displays with color transitions.

5. **No imagery anywhere.** The Today page has zero visuals — no exercise illustrations, no motivational imagery, no data visualizations beyond text numbers.

**Fixes:**

- Redesign check-in as a visual scale with animated color transitions (gradient from red → green as you move across options), larger touch targets, possibly illustrated faces or energy indicators
- Make biometric cards the hero element: large ring gauges (reuse OuraProfile's `RingGauge` component), gradient backgrounds, prominent delta indicators
- Add exercise illustration placeholders or silhouettes to workout blocks
- Redesign session mode with a circular progress ring, large timer with color-coded countdown, and movement-specific imagery
- Add a "readiness ring" as the page hero element — this is the core visual promise of YU

---

### 2.4 Agent Page (`Agent.tsx`)

**Current state:** Intelligence dashboard with state visualization (Locked/Loaded/Steady/Compressed/Depleted), specialist cards (Heart, Readiness, Sleep, Stress), goal tracking, baseline trends, share functionality. This is the deepest page — 74kb of code.

**Problems:**

1. **White background navbar on dark content pages.** The Agent page uses a white/light color palette (YU.bg: "#FFFFFF", YU.bgSoft: "#F8FAFC") while the navbar is also white — but other pages (Today, History, Landing) are dark (#0a0b0d). This creates a jarring identity split. Is YU a dark app or a light app? It can't be both without careful theming.

2. **State visualization is text-only.** The states (Locked ◆, Loaded ▲, Steady ●, Compressed ▼, Depleted ◉) use unicode glyphs. These are the app's most distinctive concept — and they're rendered as plain text characters. These should be rich visual states with color, animation, and possibly illustration.

3. **Specialist cards are data-dense but visually flat.** Heart, Readiness, Sleep, Stress — each shows today's value, baseline mean, delta %, z-score, and a history sparkline. The data is excellent, but the presentation is clinical. Oura makes similar data feel luxurious through generous spacing, subtle gradients, and animated reveals.

4. **Goal tracking is a basic day-grid.** Calendar dots for completed/partial/skipped days. This is functional but generic — it looks like every habit tracker app. Apple uses animated ring fills. Nike uses streak visualizations.

5. **Share functionality text is compelling but has no visual preview.** The F7 shareable lines ("Locked. Body absorbed the week. Big calls before noon.") are great copy — but sharing just generates text. A Nike/Apple-grade product would generate a shareable card image.

**Fixes:**

- Unify the color scheme. The Agent page should use the same dark canvas as the rest of the app, or the entire app should move to a unified light theme. Pick one.
- Design rich state indicators: animated glyphs, color-coded glow effects, perhaps a circular gauge that changes form per state
- Add depth to specialist cards: subtle gradient backgrounds matching each specialist's color, larger sparklines, animated value reveals
- Redesign goal tracker with a more visual approach — ring fills, streak flames, or progress bars with milestones
- Build a shareable card generator that creates a branded image (dark background, YU logo, state, metrics)

---

### 2.5 Oura Profile (`OuraProfile.tsx`)

**Current state:** The most visually polished page. Ring gauges (SVG), glassmorphism cards, area/bar/composed charts, interval selectors (7D/14D/30D/ALL), sparklines. Dark blue-tinted background.

**Problems:**

1. **Different background color than the rest of the app.** This page uses `rgba(15,22,56,0.55)` (dark blue) for glass cards, while the rest of the app uses `#0a0b0d` (near-black). The blue tint is beautiful but inconsistent.

2. **The page is extremely long.** Sleep, Activity, Readiness, HRV, Stress, Cardio Age — each with multiple chart types. There's no navigation within the page, no collapse/expand, no tab-based organization. On mobile, this is an endless scroll.

3. **Charts lack polish details.** The Recharts components use basic styling. Compare to Oura's app which uses custom-drawn charts with gradient fills, rounded corners, and smooth animations. The current charts feel generic.

4. **Ring gauges are good but not hero-sized.** They're 140×140px. Oura makes the ring the literal hero of the screen — 300px+ with your score in massive type inside.

**Fixes:**

- Standardize background treatment across all pages
- Add tab-based navigation (Sleep | Activity | Readiness | Vitals) to organize the data
- Upgrade chart styling: gradient fills, animated draws, custom dot styles, better grid styling
- Make the main readiness ring a hero element — 300px+, centered, with animation on load

---

### 2.6 History Page (`History.tsx`)

**Current state:** Weekly summary card, progressive overload cards, HRV trend chart, workout timeline with expandable entries. #0a0b0d background.

**Problems:**

1. **Everything is the same visual weight.** Summary card, progress cards, chart, timeline entries — they all use the same size, same padding, same border treatment. Nothing jumps out. There's no visual hierarchy.

2. **Workout entries are extremely compact.** Title, feedback badge, verdict badge, date — all crammed into one row. Expanding shows plain text workout details. There's no visual differentiation between workout types.

3. **No visual distinction for achievement moments.** "BUMP" (progressive overload) is the app's victory moment — proof you're getting stronger. It's rendered as a 9px green text label. This should be celebrated with animation, color, and visual prominence.

**Fixes:**

- Create clear visual hierarchy: make the weekly summary a large hero card, make progress the secondary feature, make timeline the detail layer
- Add workout type icons/colors to timeline entries for quick scanning
- Celebrate "BUMP" moments with animation, a glow effect, and prominent placement

---

### 2.7 Settings Page (`Settings.tsx`)

**Current state:** Basic form: account info, equipment grid, goals grid, body weight input, 1RM inputs, wearable connect, injury flags, sign out. All on #0a0b0d.

**Problems:**

1. **Looks like an admin panel.** No visual polish, no section imagery, no branded elements. Just stacked cards with toggles and inputs.

2. **Equipment and goals grids are identical to onboarding** — no visual improvement for returning users who are already invested in the product.

3. **Wearable connect section is buried.** Connecting Oura is the core setup action, but it's just another card in a stack.

**Fixes:**

- Add section headers with subtle illustrations or icons
- Feature the wearable connection prominently at the top with device imagery
- Add a profile section with the user's avatar/readiness ring as a hero element

---

### 2.8 NavBar (`NavBar.tsx`)

**Current state:** Fixed-top, white/translucent background, "YU" in teal Space Grotesk, four nav links (Today/Agent/History/Settings) with uppercase 11px labels, mobile hamburger.

**Problems:**

1. **White navbar on dark pages.** This is the single most jarring visual issue. The nav is white (rgba(255,255,255,0.92)) with a light border, but Landing, Today, History, Settings, and Onboarding are all on #0a0b0d. The contrast break is severe.

2. **Teal "YU" wordmark feels disconnected.** The primary brand color everywhere else is #FF5C35 (pulse/orange). The teal (#00BFA6) only appears on the navbar. This creates a split identity.

3. **No app icon/mark in the nav.** Just text. Premium apps always have a mark.

4. **Active state is subtle.** Active link gets a barely-visible teal background tint. Compare to Apple's tab bars which use bold, unmistakable active states.

**Fixes:**

- Switch navbar to dark/transparent background matching the app canvas
- Use the primary brand color (#FF5C35) or white for the wordmark
- Add a brand icon/mark next to "YU"
- Make active states more prominent — underline, color fill, or bold weight change

---

## 3. Design System Fixes

### 3.1 Typography

**Current:** Inter 300-900 (body), Bricolage Grotesque 700-800 (headlines), JetBrains Mono (metrics). Three fonts is correct.

**Problem:** Bricolage Grotesque is barely used — most headlines use `font-black` Inter. The display font should be more prominent and more distinctive. Nike uses a custom condensed face. Apple uses SF Pro Display rounded.

**Fix:** Use Bricolage Grotesque (or upgrade to a more premium display font like General Sans or Clash Display) for ALL headlines. Reserve Inter for body text only. Use JetBrains Mono more prominently for all metric/number displays.

### 3.2 Color System

**Current palette is good but underutilized:**

| Token | Hex | Usage |
|-------|-----|-------|
| `yu.bg` | #0a0b0d | Canvas |
| `yu.surface` | #1a1d24 | Cards |
| `yu.pulse` | #FF5C35 | CTA/Accent |
| `yu.recovery` | #6EE7FF | Recovery |
| `yu.go` | #C2FF4A | Success |
| `yu.warn` | #FFC36B | Warning |
| `yu.stop` | #FF5D6C | Error |

**Problem:** Colors are only used as flat fills. No gradients, no glows, no bloom effects. Oura's signature is soft radial glows behind data elements. Apple uses gradient rings. Nike uses gradient overlays on photography.

**Fix:** Define gradient pairs for each color. Add glow/bloom utility classes. Example:

```
--pulse-glow: radial-gradient(circle, rgba(255,92,53,0.15) 0%, transparent 70%)
--recovery-glow: radial-gradient(circle, rgba(110,231,255,0.12) 0%, transparent 70%)
--go-glow: radial-gradient(circle, rgba(194,255,74,0.10) 0%, transparent 70%)
```

### 3.3 Spacing & Layout

**Problem:** Inconsistent padding — p-2.5, p-3, p-3.5, p-4, p-5, p-6, p-8 used without system. Card borders are all 1px rgba with slight color tints.

**Fix:** Define a card hierarchy:

| Level | Padding | Border | Use |
|-------|---------|--------|-----|
| Hero | p-8 md:p-10 | 1.5px + glow shadow | Main feature (readiness ring, today's action) |
| Feature | p-6 | 1px + subtle gradient border | Data cards, workout blocks |
| Compact | p-4 | 1px solid border | List items, settings rows |
| Inline | p-2 | none | Tags, badges, inline elements |

### 3.4 Images & Media

**Current state:** The entire app has exactly ONE image in the UI flow — `me.png` (user avatar, used only in OuraProfile). Everything else is lucide-react icons.

**This is the #1 thing holding YU back from looking premium.**

**Required imagery (prioritized):**

1. **Hero imagery** — Landing page hero shot. An athlete training, ideally with an Oura ring visible. Full-bleed, with dark overlay gradient for text readability.

2. **Exercise illustrations** — Silhouette or line-art illustrations for major movement categories (squat, press, pull, carry, cardio, stretch). These fill the workout blocks with visual interest.

3. **Equipment icons** — Custom illustrated icons for each equipment type (dumbbells, barbell, kettlebell, pull-up bar, rower, etc.) to replace the generic lucide icons in Onboarding and Settings.

4. **State illustrations** — Visual representations for each agent state (Locked, Loaded, Steady, Compressed, Depleted). Abstract or metaphorical.

5. **Partner logos** — Properly sized and styled versions of Oura, Apple Watch, Gemini logos for the tech strip.

6. **Background textures** — Subtle noise, grid, or geometric patterns for visual depth (see Apple's dark mode backgrounds — they're never pure flat black).

---

## 4. Interaction & Animation Gaps

### What exists:

- Framer Motion page transitions (fade + slide up)
- Counter animation on landing stats
- whileHover scale(1.03) on buttons
- Ring gauge SVG animation on OuraProfile
- Skeleton pulse loading states

### What's missing:

| Missing Interaction | Where | Reference |
|---|---|---|
| **Scroll-triggered section reveals** | All pages | Apple product pages — elements animate in as you scroll |
| **Data value count-up** | Today biometrics, Agent metrics | Oura — scores animate from 0 to value on load |
| **Card hover depth** | Feature cards, workout blocks | Nike — cards lift with shadow and subtle scale |
| **Loading shimmer** (not just pulse) | Workout generation, data fetches | Apple — shimmer sweep animation for loading states |
| **Haptic-feel button press** | All CTAs | Spring physics on tap, not just scale |
| **Chart draw animations** | History charts, OuraProfile charts | Oura — charts draw in from left to right |
| **Confetti/celebration** | Workout complete, BUMP moments, goal streaks | Apple rings — celebration animation on completion |
| **Smooth number transitions** | Any value that changes | Animated number transitions when data updates |
| **Pull-to-refresh** | Mobile, all data pages | Standard mobile pattern, feels alive |
| **Parallax/depth** | Landing hero | Subtle depth layers as you scroll |

---

## 5. Priority Roadmap

### Phase 1: Visual Foundation (1-2 days)

These changes have the highest visual impact for the least code:

1. **Dark navbar.** Change NavBar background from white to dark/transparent. Use white or #FF5C35 for wordmark. This single change unifies the entire app instantly.
2. **Add background glow effects.** Radial gradients behind hero elements on every page. Costs nothing, adds depth everywhere.
3. **Increase spacing.** Bump all card padding up one level. Add more vertical space between sections. The app feels cramped.
4. **Enlarge biometric displays.** Make the Today page metrics and OuraProfile ring gauges 2× larger. The data is the product.
5. **Unify Agent page to dark theme.** Switch from white bg to #0a0b0d.

### Phase 2: Imagery & Media (3-5 days)

6. **Add hero photography** to Landing page. Source or generate an athlete training image.
7. **Design exercise silhouettes/illustrations** for workout blocks (SVG).
8. **Create custom equipment icons** for Onboarding/Settings (SVG).
9. **Build a readiness ring hero component** — large, animated, glowing — for the Today page.
10. **Design state visualizations** for the Agent page's 5 states.

### Phase 3: Interaction Polish (3-5 days)

11. **Add scroll-triggered reveals** across all pages.
12. **Animate data values** (count-up on load, smooth transitions on change).
13. **Add chart draw animations** to all Recharts components.
14. **Build a workout completion celebration** (confetti, ring fill, or equivalent).
15. **Add card hover depth effects** (shadow + scale + glow).

### Phase 4: Structural Redesign (5-7 days)

16. **Redesign Landing page** with hero image, visual feature sections, animated loop diagram.
17. **Redesign Today page** with readiness ring hero, visual workout blocks, enhanced session mode.
18. **Redesign Agent page** with rich state visualizations, enhanced specialist cards, shareable card generator.
19. **Add tab navigation** to OuraProfile for mobile usability.
20. **Add onboarding progress indicator** and visual polish to each step.

---

## 6. Technical Debt Notes

While auditing for design, these code issues surfaced:

- **9 unused page files** in `/src/pages/`: ActionStatus, AskYU, CheckIn, Dashboard, Debrief, Drift, Employer, Recovery, XRay, Optimize. Delete these.
- **Today.tsx is 33kb, Agent.tsx is 74kb, OuraProfile.tsx is 82kb.** These need component extraction — each should be broken into 5-10 sub-components.
- **Agent page defines its own color tokens** (YU object with #FFFFFF bg) separate from the app's design system. These should use the shared tailwind tokens.
- **NavBar defines its own color tokens** (separate YU object). Same fix.
- **Inline `style={{}}` used extensively** instead of Tailwind classes. This makes theming impossible and creates inconsistency.
- **Many `any` types** in TypeScript — Today and Agent pages especially.
- **`sessionStorage` and `localStorage` used directly** in Agent.tsx — should be abstracted.

---

## Summary

YU's product logic is genuinely impressive — the closed-loop biometric system, the agent architecture, the progressive overload tracking. The backend and data layer are sophisticated.

The UI needs to match that sophistication. Right now, it's a **wireframe wearing production clothes**. The path to Nike/Oura/Apple quality requires three things: imagery (the app has none), depth (gradients, glows, shadows instead of flat colors), and breathing room (more space, larger elements, less density).

The good news: the design system tokens are solid, the component library (shadcn/Radix) is excellent, and the animation infrastructure (Framer Motion) is already in place. This is a polish and content problem, not an architecture problem.
