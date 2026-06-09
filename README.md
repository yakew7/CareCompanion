<div align="center">

# 🫀 CareCompanion

**The private health dashboard built for family caregivers**

[![Version](https://img.shields.io/badge/version-1.5.0-0d9488?style=for-the-badge)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-22c55e?style=for-the-badge)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)

[![Groq AI](https://img.shields.io/badge/AI-Groq%20LLaMA%203.3-f97316?style=for-the-badge)](https://console.groq.com)
[![Data Privacy](https://img.shields.io/badge/data-100%25%20local-8b5cf6?style=for-the-badge&logo=shield&logoColor=white)](SECURITY.md)
[![PWA Ready](https://img.shields.io/badge/PWA-ready-0ea5e9?style=for-the-badge&logo=pwa&logoColor=white)](public/manifest.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-34d399?style=for-the-badge)](CONTRIBUTING.md)

<br/>

> Manage medications, track vitals, log symptoms, prep for doctor visits, and chat with an AI that knows your patient's full history — all without a single byte of health data leaving your device.

<br/>

[Features](#-features) · [Quick Start](#-quick-start) · [Tech Stack](#-tech-stack) · [Privacy](#-privacy--data-handling) · [Deploy](#-deploying) · [Contributing](#-contributing)

</div>

---

## Why CareCompanion?

Caring for an aging parent or family member means juggling dozens of medications, lab reports, specialist appointments, and symptom patterns — across multiple devices, family members, and medical providers. Most health apps either require you to trust a cloud service with sensitive data, or are too generic for the complexity of ongoing caregiving.

CareCompanion is built around one constraint: **your health data never leaves your device.** All records — medications, vitals, symptoms, appointments, notes — live exclusively in your browser's `localStorage`. The only external call is to an AI API for in-flight processing, and even then, patient names and health records are never transmitted.

---

## ✨ Features

### 🛡️ Emergency Info Card
Instant access to everything a first responder or ER needs. Tap-to-call contacts, blood type, allergies, and primary doctor — all on one screen, no login required once the PWA is installed.

<details>
<summary>What's included</summary>
<br/>

- **Blood type** displayed as a large red chip — A+, B−, AB+, O+, etc. with preset buttons in edit mode
- **Allergy chips** — add/remove individual allergens
- **Emergency contacts** with name, phone, and relation; tap the phone number to call directly
- **Primary doctor** name and phone
- **Free-text notes** for anything else (pacemaker, implants, DNR status, etc.)
- Accessible from the sidebar and the bottom-nav "More" sheet — always one tap away

</details>

---

### 📄 Medical Reports
Upload a PDF or TXT report and get an AI-generated plain-English summary in seconds.

<details>
<summary>What's included</summary>
<br/>

- **Plain-English AI summary** split into three sections: Summary, Dietary Notes, and Other Notes
- **Auto-extraction** — medications, appointments, symptoms, vitals, dietary notes, and patient profile are identified from the report text and staged for review
- **Per-item confirmation panel** — checkboxes let you choose exactly what gets saved; nothing is applied without your explicit approval
- **Extraction toast** tells you precisely what was saved: *"Saved from report: 2 medications, 1 appointment, 3 notes"* — no guesswork
- **Chat with any report** via the built-in Health Assistant — ask follow-up questions in plain language
- **Report text is never stored** — only the AI-generated summary is kept in your browser
- **Specific error messages** for image-only PDFs, password-protected files, and corrupted uploads — each with a **Retry** button

</details>

---

### 💊 Medications
A full medication management system — from daily tracking to refill alerts and calendar integration.

<details>
<summary>What's included</summary>
<br/>

- **Flexible schedules** — daily, weekly (specific days of the week), and monthly medications
- **Time slots** — Morning, Afternoon, Evening, Night (multiple slots per medication)
- **One-tap dose logging** with a daily progress ring and 7-day adherence percentage
- **Adherence calendar** that only counts days from when the medication was first added — no false "missed dose" marks for days before it existed
- **"Late" badge** — if a morning dose is logged at 2 PM, an amber *Late* chip appears on the dose record
- **Course duration** — set an end date and the medication auto-removes itself when the course finishes
- **Indian prescription notation** — understands `1-0-1`, `0-0-1`, `1-1-1` when extracted from reports
- **Refill countdown** — when an expiry date is within 7 days, an amber warning card appears on the dashboard
- **`.ics` calendar reminders** with VALARM alerts — import into Apple Calendar or Google Calendar for native pop-up notifications
- **Drug interaction check** powered by Groq — clearly flags when the check is unavailable instead of returning a silent result
- **Side effect tracking** — symptoms linked to a medication appear as amber pills on the medication card, with *"First reported N days after starting"* calculations
- Destructive "Clear all" is behind a three-dot menu with a named confirmation dialog

</details>

---

### 📊 Vitals & Lab Results
27 readings across 7 groups — from daily blood pressure to quarterly thyroid panels.

<details>
<summary>What's included</summary>
<br/>

**All tracked readings:**

| Group | Tests |
|---|---|
| **At-Home** | Blood Pressure, Blood Glucose, Weight, Heart Rate, Temperature, SpO₂, Respiratory Rate, Pain Level |
| **Metabolic** | HbA1c, Total Cholesterol |
| **Blood Panel (CBC)** | Hemoglobin, WBC, RBC, Platelets |
| **Liver (LFT)** | ALT/SGPT, AST/SGOT, ALP, Bilirubin, Albumin |
| **Kidney / Renal** | Creatinine, BUN/Urea, Uric Acid, eGFR |
| **Thyroid** | TSH, T3, T4 |
| **Electrolytes** | Sodium, Potassium, Calcium |
| **Iron Studies** | Serum Iron, Ferritin |

**Features:**
- **Sparkline trend chart** per vital with a green normal-range band overlay
- **Normal / Watch / High** status badge with a colour-coded left-border accent on each card
- **Doctor's custom target range** — override the standard range for any test; the standard range is shown as a hint so you know what you're replacing
- **BMI** auto-calculated from latest weight and height with Normal / Overweight / Obese badge
- **Auto-filled from reports** — handles Indian lab notation (Lakh/µL for platelets, mmol/L → mg/dL for glucose, °F → °C for temperature)
- **+ Log first reading** button on empty vital cards — no hunting for a separate log button

</details>

---

### 🩺 Symptoms
Structured symptom logging with severity tracking, duration monitoring, and AI pattern analysis.

<details>
<summary>What's included</summary>
<br/>

**Calibrated 1–5 severity scale** — the colour chip updates live as you move the slider:

| Score | Label | Colour | Meaning |
|:---:|---|:---:|---|
| 1 | Barely noticeable | 🟢 Green | No impact on daily activity |
| 2 | Mild | 🟡 Yellow | Slightly uncomfortable |
| 3 | Moderate | 🟠 Orange | Disrupting normal routine |
| 4 | Severe | 🔴 Red | Significant distress |
| 5 | Emergency-level | 🔴 Dark Red | Seek medical attention immediately |

**More features:**
- **Link to a medication** — associate a symptom with any tracked medication as a potential side effect
- **Ongoing tracking** — mark a symptom as "Still ongoing" at log time; an amber *Ongoing* badge shows a live day count; a "Mark resolved" button stamps the resolution timestamp
- **Week-over-week trend card** — automatic ▲/▼ severity comparison with colour coding
- **AI pattern analysis** — the model is briefed on the full scale so analysis is clinically meaningful
- **Edit any entry** — update severity, notes, or medication link without deleting the record
- **Filter by time period** — All / This week

</details>

---

### 📅 Appointments
Track upcoming and past appointments with AI-assisted visit prep and structured post-visit notes.

<details>
<summary>What's included</summary>
<br/>

**Visit Prep modal (pre-visit):**
- Current medications list
- Recent symptoms summary (last 10 days)
- Latest vitals snapshot
- **AI-generated questions** tailored to the doctor's specialty and the patient's health data — streamed in real time via Groq
- One-click copy of all questions to clipboard

**Post-visit structured notes (4 fields):**
- 💬 *What the doctor said* — key takeaways and diagnoses
- 💊 *Medication changes* — new prescriptions, dose adjustments, discontinuations
- ✅ *Action items* — tests to book, referrals, follow-ups
- 📋 *Outcome summary* — free-form overall notes

Post-visit notes are colour-coded on the appointment card (teal / purple / amber) and included in the Health Assistant's patient context.

**More features:**
- Upcoming vs Past split uses start-of-today — same-day appointments always appear in Upcoming
- **AI follow-up suggestion** after post-visit notes — opens a pre-filled editable modal before saving
- **Past-date warning** shown in amber when scheduling with a historical date
- **`.ics` export** — single appointment or full calendar, compatible with Apple Calendar and Google Calendar

</details>

---

### 📝 Notes
Dietary restrictions and care notes — manually written or auto-extracted from reports.

<details>
<summary>What's included</summary>
<br/>

- **Two sections** — Dietary (food restrictions, meal guidelines) and Other (care instructions, allergies, general info)
- **Auto-populated from reports** — extracted dietary and other notes appear immediately after report processing
- **Inline editing** — pencil icon on every card for quick updates
- **Tags** — add custom tags to any note (press Enter or `,` to add); tags render as chips on the card
- **Tag filtering** — click any tag chip to filter both sections to matching notes; an active-filter banner shows what's applied and clears with one tap

</details>

---

### 🤖 Health Assistant
A conversational AI that knows your patient's full medical context — without ever learning their name.

<details>
<summary>What's included</summary>
<br/>

The assistant is briefed with:
- Active medications (name, dose, frequency)
- Recent symptoms and severity levels
- Latest vitals and lab results
- Dietary notes and other care notes
- Post-visit appointment notes

**Smart prompt suggestions** generated from actual patient data:
- Drug interaction questions for the specific medications being tracked
- Cause-analysis for the most recently logged high-severity symptom
- Contextual questions for HbA1c, blood pressure, or glucose readings
- Falls back to general prompts when no data has been entered yet

**Privacy:**
- Patient name is **never** sent to the AI — identified as `[anonymous]` in all prompts
- Chat history is persisted per person in `localStorage` (capped at 50 messages) and resumes on the next visit
- Medical disclaimer shown at the start of every session

</details>

---

### 📡 Proactive Insights
The dashboard automatically surfaces health patterns — no manual analysis needed.

<details>
<summary>What's included</summary>
<br/>

Up to 4 insights shown at a time, each linking to the relevant page:

| Pattern | Example |
|---|---|
| Vital consecutive trend | *"HbA1c has trended up 4 readings in a row"* |
| Day-of-week severity spike | *"Headache severity tends to be higher on Mondays"* |
| Symptom frequency surge | *"Fatigue logged 4× this week — up from 1× last week"* |

Detection runs entirely client-side — no API call, no latency. Insights disappear automatically when the underlying data changes.

</details>

---

### 🔍 Global Search
Search everything — from anywhere — in real time.

- `⌘K` (or the search icon in the top bar) opens a full-screen overlay
- Searches across **medications**, **symptoms**, **appointments**, and **notes** simultaneously
- Fully keyboard-navigable: `↑↓` to move, `Enter` to jump to the result's page, `Escape` to close

---

### 💾 Backup & Data Safety
Your data, your device, your backup.

<details>
<summary>What's included</summary>
<br/>

- **Export** — one click downloads a complete JSON backup of all people and all health records
- **Two-phase import** — a preview step shows person count and record count before committing; `commitBackup()` snapshots current data and rolls back on any failure
- **Validation** — structure, version compatibility, data key patterns, and person format are all verified before a single byte is written
- **localStorage quota monitoring** — if storage fills up, a persistent toast offers an immediate "Export backup & free space" action
- **Concurrent-tab conflict detection** — if two tabs write to the same data key simultaneously, a conflict toast with a Reload option appears
- The backup JSON **never touches any server**

</details>

---

### 👥 Multi-person Profiles
Manage care for multiple family members from a single account.

- Each person has an isolated data namespace — no data ever bleeds between profiles
- Colour-coded avatars with customisable nicknames
- Rename, recolour, or delete a profile at any time
- Switching profiles re-scopes all pages and the Health Assistant instantly

---

### 🔔 Reminders & PWA
- **Browser notifications** for medication times and daily symptom check-ins (opt-in)
- **`.ics` calendar reminders** with VALARM alerts for Apple Calendar and Google Calendar
- **PWA support** — Service Worker + Web App Manifest for full offline access and home screen installation
- **iOS push banner** — detects when running in iOS Safari (non-standalone) and explains how to install as a PWA to get reliable background notifications

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Notes |
|---|---|
| **Node.js 24+** | Required |
| **[Groq API key](https://console.groq.com)** | Free tier sufficient for all AI features |
| **[Google OAuth client](https://console.cloud.google.com)** | For sign-in |
| **[Supabase project](https://supabase.com)** | Auth session storage only — no medical data ever written here |

### 1 · Clone and install

```bash
git clone https://github.com/yakew7/CareCompanion.git
cd CareCompanion
npm install
```

### 2 · Configure environment

Create `.env.local` in the project root:

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=                    # openssl rand -base64 32

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# AI
GROQ_API_KEY=

# Supabase (auth sessions only — no health data stored here)
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

### 3 · Set up Supabase

The only table required is a thin auth session tracker:

```sql
create table user_profiles (
  user_id    text primary key,
  created_at timestamptz default now()
);
```

### 4 · Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Skip auth in development** — set `NEXT_PUBLIC_DEV_SKIP_AUTH=true` in `.env.local` to bypass Google login. The app auto-creates a "Demo" profile using a fixed local namespace.

> **AI features** — report upload, health chat, symptom analysis, visit prep questions, and drug interaction checks all require a valid Groq key. Every other feature works without one.

---

## 🛠 Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Framework** | [Next.js 14](https://nextjs.org) (App Router) | File-based routing, Server Actions, streaming |
| **Language** | TypeScript — strict mode | Type safety across all 15+ data types |
| **Styling** | [Tailwind CSS](https://tailwindcss.com) | Utility-first, dark mode, responsive |
| **Auth** | [NextAuth v4](https://next-auth.js.org) + Google OAuth | Zero-friction sign-in |
| **AI** | [Groq API](https://console.groq.com) — `llama-3.3-70b-versatile` | Fast inference for streaming responses |
| **PDF parsing** | [unpdf](https://github.com/unjs/unpdf) | Edge-compatible, no native binaries |
| **Storage** | `localStorage` — per-account namespaced | 100% client-side, zero server writes |
| **Auth session DB** | [Supabase](https://supabase.com) | Auth only — no medical data |
| **Icons** | [Lucide React](https://lucide.dev) | Consistent, accessible icon set |
| **Notifications** | Web Notifications API + Service Worker | Native OS alerts |
| **PWA** | Service Worker + Web App Manifest | Offline, installable on any device |

---

## 🔒 Privacy & Data Handling

Health data is stored exclusively in your browser's `localStorage`. Nothing health-related is written to any server or database.

| Data | Where it goes | Why | Retained by service? |
|---|---|---|:---:|
| Report text | Groq API | AI summarisation | ❌ In-flight only |
| Chat messages | Groq API | Health assistant responses | ❌ In-flight only |
| Visit prep prompt | Groq API | Question generation | ❌ In-flight only |
| Google account (email, name) | NextAuth / Google | Login | Session token only |
| **Medications** | Your browser only | — | N/A |
| **Symptoms** | Your browser only | — | N/A |
| **Vitals** | Your browser only | — | N/A |
| **Appointments** | Your browser only | — | N/A |
| **Notes** | Your browser only | — | N/A |
| **Emergency info** | Your browser only | — | N/A |

**The patient's name is never sent to any AI.** It is replaced with `[anonymous]` in every prompt.

See [SECURITY.md](SECURITY.md) for the full data handling policy and vulnerability reporting process.

---

## 🌐 Deploying

```bash
npx vercel
```

Add all `.env.local` variables under **Settings → Environment Variables** in the Vercel dashboard. Set `NEXTAUTH_URL` to your production domain.

For other platforms, this is a standard Next.js app — any provider that supports Node.js 24 will work.

---

## 📋 Roadmap

See [CHANGELOG.md](CHANGELOG.md) for the full release history.

Planned / community ideas:
- [ ] Multi-device sync via an optional encrypted backend
- [ ] PDF report annotation and highlighting
- [ ] Caregiver sharing mode — read-only access for other family members
- [ ] Medication barcode scanner
- [ ] Lab result trend forecasting

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, coding conventions, and the privacy constraints every contribution must uphold.

Key rules:
- **No health data to any server** — the localStorage-only constraint is non-negotiable
- **No patient identifiers in AI prompts** — always anonymise before sending
- TypeScript strict mode — PRs that break `npx tsc --noEmit` will not be merged

---

## 📄 License

MIT — see [LICENSE](LICENSE)

---

## 🔐 Security

Report vulnerabilities privately. See [SECURITY.md](SECURITY.md) for the reporting process, responsible disclosure timeline, and the full data handling policy.

---

<div align="center">

Built for caregivers, by caregivers. &nbsp;·&nbsp; V1TROUS Hackathon 2026

</div>
