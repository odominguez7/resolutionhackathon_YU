# YU — Website Brief for Web Development Agent

> **URL:** [yu.boston](https://yu.boston)
> **Primary contact:** omar@yu.boston · omar7@mit.edu
> **LinkedIn:** [linkedin.com/in/odominguez7](https://www.linkedin.com/in/odominguez7/)
> **Version:** April 2026 · Based on the Underscore VC / GSD Pitch Deck

---

## 1. What YU Is

YU is an AI-powered personal health intelligence layer that connects to the wearable device a user already owns, learns their individual physiological baseline, and delivers a daily personalized game plan — not a generic score.

**The one-sentence pitch:**
> "Your wearable gives you a number. YU gives you a personalized game plan."

**The core problem YU solves:**
Every day, 50 million Americans check a wearable. Every one of them is left to figure out what the data means. No existing product turns that data into a concrete, personal, actionable plan. YU is that product.

**The core promise:**
YU learns how *your* body actually works — not the average of a million strangers — and every morning delivers a plan that knows you by name.

---

## 2. Design System

The website must feel like a direct extension of the pitch deck. Every design decision should reinforce the same visual language.

### Colors

| Role | Hex |
|---|---|
| Background (primary) | `#FFFFFF` |
| Dark text / headings | `#1C2B3A` |
| Body text | `#374151` |
| Muted / secondary text | `#6B7280` |
| Placeholder / labels | `#9CA3AF` |
| Borders / dividers | `#E5E7EB` |
| Accent (teal — primary brand) | `#00BFA6` |
| Accent light backgrounds | `#F8FAFC` |
| Amber (cognitive insight) | `#F59E0B` / `#D97706` |
| Indigo (sleep insight) | `#6366F1` / `#A5B4FC` |

### Typography

| Use | Font | Weight | Size guidance |
|---|---|---|---|
| Headlines / hero | Space Grotesk | 700 | 48–72px |
| Section titles | Space Grotesk | 700 | 32–44px |
| Body / beats | Inter | 400–600 | 18–28px |
| Labels / caps | Inter | 600 | 11–13px, uppercase, letter-spacing 2px |
| Captions / footer | Inter | 400 | 12–14px |

### Aesthetic Rules

- **White backgrounds only.** No gradients, no dark sections (except optional dark footer strip).
- **Generous whitespace.** The deck breathes. The website must too.
- **No stock photos.** Use team photos, phone mockups, or abstract data visuals only.
- **No rounded card borders with left/right accents.** Flat, minimal surfaces.
- **Thin dividers** (`1px`, `#E5E7EB`) are the primary structural element.
- **Teal** is used sparingly — for the most important word or number on any given section.
- **No periods in headlines.** Titles end clean.

### Logo

The YU logo is a black square with bold white "YU" text in a heavy sans-serif. It is always used at 48–56px in navigation and slide headers. On dark backgrounds, invert to white square with black text.

---

## 3. Messaging Architecture (by Section)

The website should tell the same three-act story as the first three slides of the deck.

### Act 1 — Hero Section (Slide 1 content)

**Headline (H1):**
> Your wearable gives you a number
> **YU** gives you a personalized game plan

"YU" should be in teal (`#00BFA6`).

**Subheadline:**
> Works with Oura, Whoop, Garmin, Fitbit and 400 more.

**Footer line / tagline:**
> One integration. 400+ wearables. One AI that only learns you.

**CTA button:** "Get early access" or "Join the waitlist" — teal background, white text.

---

### Act 2 — The Problem (Slide 2 content)

**Section headline:**
> The data is already on your wrist
> The plan is not

**Three body beats (large type, stacked, generous whitespace):**
1. Every day, **50 million Americans** check a wearable.
2. Every one of them is left to figure out **what it means.**
3. So who is going to give them **the plan?**

**Section footer (small, muted):**
> That is the market. It has been sitting on 50 million wrists, waiting for someone to read it back.

**Visual element:** A realistic phone mockup showing a wearable readiness score screen. White phone shell, light screen background. Shows:
- A conic-gradient readiness ring: score **72 / 100** in teal
- Three stat cards in a horizontal row: **HRV 42ms · Sleep 6h 12m · Steps 4.8k**
- App header: "Today · Monday, April 7"

---

### Act 3 — The Answer / Value Proposition (Slide 3 content)

**Section headline:**
> **YU is the game plan** built from your own baseline
> not the average of a million strangers

**Three body beats:**
1. Connect the wearable **you already wear.**
2. YU learns **how your body actually works.**
3. Every morning, you get a plan that **knows you by name.**

**Section footer:**
> That is the answer. It has been waiting on your wrist the whole time.

**Visual element:** A phone mockup showing Gabby's personalized game plan. Three cards stacked vertically:

| Card | Color | Icon | Title | Sub-text |
|---|---|---|---|---|
| 1 | Amber | ⚡ | Your brain peaks at 10am. Protect it. | HRV dips 18% after 2pm on your last 12 workdays. Book the hard call before noon. |
| 2 | Teal | ◉ | Your body is ready for that 18K. Go. | Readiness 84. HRV up 3 days straight. Resting HR at your personal low. This is your window. |
| 3 | Indigo | ◐ | You sleep 22% deeper when you stop screens by 9:30pm | 14 nights of data. The pattern is clear. Tonight is a good night to test it. |

Footer inside phone: "Based on your last 14 days"

---

## 4. How It Works (Slide 4 — MVP Architecture)

**Section headline:** How it works

Four stages in a horizontal pipeline, separated by thin vertical dividers. Each stage has a number, a bold word, and tag pills below.

| # | Stage Word | Key message | Tag pills |
|---|---|---|---|
| 01 | **CONNECT** | Works with 400+ wearables — Oura, Whoop, Garmin, Fitbit and every device your user already owns. If Whoop ships something new tomorrow, YU already speaks its language. | Oura · Whoop · Garmin · Fitbit · +400 devices |
| 02 | **LEARN** | Builds your personal baseline using Python-powered data science. Not global benchmarks — your HRV patterns, your sleep cycles, your 14-day rolling window. | Your baseline · HRV patterns · 14-day window · Not averages |
| 03 | **CALL TO ACTION** | The LLM layer (OpenAI, Anthropic, Gemini, Perplexity) transforms your data into a concrete, named, on-demand game plan. This actually solves: "What do I do with all this information?" | Personalized · On demand · Actionable · Knows you by name |
| 04 | **SHARE** | You decide who sees your data. Share a clinical-quality summary with your MD, training coach, therapist, or keep it just for yourself. | MD · Coach · Therapist · Just me |

**Footer line:**
> Built on Terra API · Powered by your personal baseline · Not population averages

---

## 5. Unit Economics (Slide 6 content)

**Section headline:** The unit economics work both ways

Two columns — B2C Consumer and B2B Enterprise.

### B2C Consumer (Gabby)

| Metric | Value |
|---|---|
| Price | $20 / month |
| LTV | $300 |
| CAC | $60 |
| **LTV:CAC** | **1:5** |
| Payback period | 3 months |
| Lifetime | 15 months |
| Gross margin | 80% |

### B2B Enterprise (Her firm)

| Metric | Value |
|---|---|
| Price | $60,000 / year pilot |
| LTV | $300,000 |
| CAC | $60,000 |
| **LTV:CAC** | **1:5** |
| Payback period | 4 months |
| Lifetime | 5 years |
| Gross margin | 85% |

**Go-to-market timeline:**
- **Now to Month 12 — Consumer led:** $20/month direct to Gabby. 1,000 users = $20K MRR. Ships in 7 days.
- **Month 12 to Month 36 — Enterprise follow-on:** $60K pilots in the firms where the Gabbys work. Consumer data as proof.

---

## 6. Market Size (Slide 7 content)

**Section headline:** Market Size and How We Tackle It
**Sub-headline:** One cell now. The full matrix by Year 3.

**Total addressable surface:** $5B

**Stage rollout matrix (rows = products, columns = segments):**

| Product | Endurance & QS | Boutique & Longevity | Knowledge Workers | Sports Teams | High-Stakes Pros | General Wearable |
|---|---|---|---|---|---|---|
| YU Personal ($2B · $20/mo) | **Stage 1 (Start here)** | Stage 2 | Stage 2 | Stage 3 | Stage 3 | Not yet |
| YU Teams ($0.5B · $1,200/seat/yr) | Stage 2 | Stage 2 | Stage 2 | Stage 2 | Stage 3 | Not yet |
| YU Enterprise ($1B · $60K–$400K ACV) | Stage 3 | Stage 3 | Stage 3 | Stage 3 | Stage 3 | Not yet |

**Adjacent opportunity:** $1.5B — international expansion, partner channels, white-label longevity/clinical.

---

## 7. Competitive Landscape (Slide 8 content)

**Section headline:** The interpretation layer is missing
**Sub-headline:** YU is the only one in all three columns

Three capability columns:

| Column | Competitors present | YU |
|---|---|---|
| Personalized to your own baseline | Baseline NC, **YU** | ✓ |
| Conversational AI agent, not just a score | Whoop Coach, Oura Advisor, ChatGPT Plus, **YU** | ✓ |
| Works with 400+ wearables you already own | **YU only** | ✓ |

**Key proof points:**
- Whoop Coach is locked to Whoop hardware
- Oura Advisor is locked to Oura rings
- ChatGPT Plus has no memory of your baseline

**Bold statement:** YU is the only name in all three columns.

---

## 8. The Team (Slide 5 content)

**Section headline:** The people who built it

All three founders are active wearable users who live the problem every day.

### Omar Dominguez — Co-Founder and CRO

- MIT Sloan Fellows MBA '26
- 11+ years as principal of a manufacturing plant in Mexico
- Built YU MVP in MIT AI Studio
- Boston Marathon finisher
- **IRONMAN 70.3 Triathlete**
- Living the problem every day

### Aline Zimerman — Co-Founder and CPO

- PhD Candidate in Psychiatry and Digital Mental Health
- USP / UFRGS / UNIFESP
- Boston Children's Hospital (Harvard affiliated)
- Licensed clinical psychologist
- Behavioral change detection and digital phenotyping
- Wearable user

### Miguel Helu — Co-Founder and CFO

- 2x Founder in Global Finance and Operations
- Scaled a CPG brand to 40+ countries
- Built YU's financial model and unit economics
- Ultra Marathoner
- Avid fan of wearables for performance
- Living the problem every day

### Institutional Affiliations (logos to display)

Display in a horizontal logo strip at the bottom of the team section, on a light gray (`#F8F9FA`) background:

1. **MIT Sloan School of Management** (central, largest)
2. **Martin Trust Center for MIT Entrepreneurship**
3. **MIT** (mark)
4. **MIT AI Studio**
5. **MIT Sandbox Innovation Fund Program**

---

## 9. Contact and Closing (Slides 10 and 11)

### Closing CTA

**Headline:**
> Thank you
> **Let's build it**

"Let's build it" in teal.

**Sub-line:**
> YU is the plan your wearable never gave you. Built from your baseline. Ready every morning.

**QR code:** Links to [yu.boston](https://yu.boston)

**Contact:**
- founders@yu.boston
- yu.boston

### Omar Dominguez — Personal Contact Card

- **Photo:** Conference photo from MIT "Imagination in Action" event (April 9 and 10, 2026)
- **Role:** Co-Founder and CRO, YU
- **LinkedIn QR:** [linkedin.com/in/odominguez7](https://www.linkedin.com/in/odominguez7/)
- **Email:** omar@yu.boston · omar7@mit.edu
- **Website:** yu.boston

---

## 10. Narrative Arc (for copywriting reference)

The deck — and therefore the website — tells one continuous story across three acts:

| Act | Slide | Core sentence |
|---|---|---|
| 1. The product | Slide 1 | Your wearable gives you a number. YU gives you a personalized game plan. |
| 2. The problem | Slide 2 | The data is already on your wrist. The plan is not. |
| 3. The answer | Slide 3 | YU is the game plan built from your own baseline, not the average of a million strangers. |

Every word on the website should echo one of these three sentences. The three acts are one sentence stretched across the opening of the pitch.

---

## 11. Key Brand Rules for the Web Agent

1. **Never use periods in headlines.** Titles end clean.
2. **Never use em-dashes** (`—`) in body copy or titles.
3. **"YU" is always uppercase** when referring to the product.
4. **"game plan" is two words**, lowercase, never "gameplan."
5. **Teal is used for the most important word or number** on any given section — not as a background fill.
6. **Whitespace is content.** Do not fill empty space with decorative elements.
7. **The founders are the heroes.** Use real photos, not illustrations.
8. **The phone mockup is the product demo.** It must look realistic and warm, not clinical.
9. **400+ wearables** is a key proof point and should appear in the hero section.
10. **"Not population averages"** is a key differentiator and should appear near any mention of personalization.

---

*Brief compiled from the YU Underscore VC / GSD Pitch Deck — April 2026*
