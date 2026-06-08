<div align="center">

# 🫀 CareCompanion

**A private, AI-powered health management platform for family caregivers**

[![Version](https://img.shields.io/badge/version-2.0.0-0d9488?style=flat-square)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Groq](https://img.shields.io/badge/AI-Groq%20LLaMA%203.3-f97316?style=flat-square)](https://console.groq.com)
[![Privacy](https://img.shields.io/badge/data-local%20only-8b5cf6?style=flat-square&logo=shield&logoColor=white)](SECURITY.md)

<br/>

Upload medical reports &nbsp;·&nbsp; Track medications &nbsp;·&nbsp; Log vitals & symptoms  
Manage appointments &nbsp;·&nbsp; Ask AI anything &nbsp;·&nbsp; 100% on your device

<br/>

</div>

---

## Overview

CareCompanion is a browser-based health dashboard designed for people caring for aging parents, family members, or anyone managing complex medical needs. It brings everything into one place — reports, medications, vitals, symptoms, appointments, and notes — with AI to help make sense of it all.

**Your data never leaves your device.** All health records are stored exclusively in your browser's `localStorage`. The only external calls are to an AI API for in-flight processing — and even then, no patient names or health records are transmitted.

---

## Feature Overview

| | Feature | What it does |
|:---:|---|---|
| 📄 | **Medical Reports** | Upload PDFs, get plain-English summaries, auto-extract medications & appointments |
| 💊 | **Medications** | Daily/weekly/monthly tracking, one-tap dose logging, `.ics` calendar reminders |
| 📊 | **Vitals & Labs** | 27 vitals and lab tests across 7 groups, trend charts, normal-range indicators |
| 🩺 | **Symptoms** | 1–5 severity logging, AI pattern analysis, week-over-week trend cards |
| 📅 | **Appointments** | Full history, AI-suggested follow-ups (editable), `.ics` export |
| 📝 | **Notes** | Dietary and care notes; auto-populated from reports, manually editable |
| 🤖 | **Health Assistant** | Contextual AI chat with full patient context; patient name never transmitted |
| 📡 | **Proactive Insights** | Auto-detected patterns: vital trends, symptom spikes, frequency surges |
| 🔍 | **Global Search** | `⌘K` search across all data types from anywhere in the app |
| 👥 | **Multi-person profiles** | Isolated data per family member, per Google account |
| 🔔 | **Reminders** | Browser notifications for medications and daily symptom check-ins |
| 💾 | **Backup & Restore** | Full JSON export/import — two-phase validation, never leaves your device |

---

## Quick Start

### Prerequisites

- Node.js 24+
- [Groq API key](https://console.groq.com) — free tier is sufficient
- [Google OAuth client](https://console.cloud.google.com) — for user login
- [Supabase project](https://supabase.com) — for auth session storage only; no medical data is ever written here

### 1. Clone and install

```bash
git clone https://github.com/yakew7/CareCompanion.git
cd CareCompanion
npm install
```

### 2. Configure environment

Create `.env.local` in the project root:

```env
# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=                          # openssl rand -base64 32

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# AI
GROQ_API_KEY=

# Supabase (auth sessions only)
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

### 3. Set up Supabase

The only table required is a thin auth session tracker. No medical data is ever written here.

```sql
create table user_profiles (
  user_id    text primary key,
  created_at timestamptz default now()
);
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Skip auth in development** — set `NEXT_PUBLIC_DEV_SKIP_AUTH=true` in `.env.local` to bypass Google login. The app auto-creates a "Demo" profile and uses a fixed local namespace.

> **AI features** (report upload, health chat, symptom analysis, drug interaction checks) require a valid Groq key. All other features work without one.

---

## Features

<details>
<summary><strong>📄 Medical Reports</strong></summary>
<br/>

- Upload **PDF or TXT** files and receive a plain-English AI summary split into three sections: **Summary**, **Dietary Notes**, and **Other Notes**
- **Auto-extraction** — medications, appointments, symptoms, vitals, dietary notes, and patient profile are identified and prepared for saving; a confirmation panel with per-item checkboxes gives you full control over what gets saved
- A toast breakdown tells you exactly what was saved: *"Saved from report: 2 medications, 1 appointment, 3 notes"*
- **Chat with any report** via the built-in health assistant — ask follow-up questions in plain language
- Report text is **never stored** — only the AI-generated summary is kept in your browser
- Clear, specific error messages: image-only PDFs, password-protected files, and corrupted uploads each produce a distinct, actionable message with a **Retry** button

</details>

<details>
<summary><strong>💊 Medications</strong></summary>
<br/>

- Track **daily**, **weekly** (specific days of week), and **monthly** medications with customisable time slots (Morning / Afternoon / Evening / Night)
- **One-tap dose logging** with a daily progress bar and 7-day adherence percentage
- Adherence calendar starts from the day the medication was first added — no false "missed dose" marks for days before it existed
- Optional **course duration** — medication auto-removes itself after N days
- Understands Indian prescription notation (`1-0-1`, `0-0-1`, `1-1-1`) when auto-extracted from reports
- Export recurring **`.ics` calendar reminders** with VALARM alerts — imports into Apple Calendar or Google Calendar with native pop-up notifications
- **Drug interaction check** powered by Groq; if the check is unavailable, a clear advisory appears instead of a silent result
- Destructive "Clear all" is behind a three-dot overflow menu with a named confirmation dialog

</details>

<details>
<summary><strong>📊 Vitals & Lab Results</strong></summary>
<br/>

**27 readings across 7 groups:**

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

- **Sparkline trend chart** per vital with a green normal-range band on the chart
- **Normal / Watch / High** status badge with a coloured left-border accent on each card
- **Doctor's custom target range** overrides the standard range for any test; the standard range is shown as a hint inside the modal
- **BMI** auto-calculated from latest weight and height with Normal / Overweight / Obese badge
- Auto-filled from uploaded reports; handles Indian lab notation (Lakh/µL for platelets, mmol/L → mg/dL for glucose, °F → °C for temperature)

</details>

<details>
<summary><strong>🩺 Symptoms</strong></summary>
<br/>

- Log with a calibrated **1–5 severity scale** — colour-coded chip updates in real time as you set the slider:

  | Score | Label | Meaning |
  |:---:|---|---|
  | 1 | Barely noticeable | No impact on daily activity |
  | 2 | Mild | Slightly uncomfortable |
  | 3 | Moderate | Disrupting normal routine |
  | 4 | Severe | Significant distress |
  | 5 | Emergency-level | Seek medical attention |

- **AI pattern analysis** across recent entries — the model is briefed on the full scale so it never asks "what does severity 3 mean?"
- **Week-over-week severity trend** insight card surfaces automatically (▲/▼ with colour coding)
- Edit any logged symptom via the pencil icon — update severity, notes, or correct the entry without deleting it

</details>

<details>
<summary><strong>📅 Appointments</strong></summary>
<br/>

- Track **upcoming and past** appointments; the boundary is start-of-today so same-day appointments always appear in Upcoming
- Post-visit notes trigger an **AI follow-up suggestion** — a card with the suggested doctor, date, and reason; clicking **"Review & Save"** opens an editable modal so you can adjust everything before creating the appointment
- **Past-date warning** shown in amber when scheduling with a historical date
- Export any single appointment or all appointments as **`.ics`** — compatible with Apple Calendar, Google Calendar, and any standard calendar app

</details>

<details>
<summary><strong>🤖 Health Assistant</strong></summary>
<br/>

- Conversational AI chat with full patient context: medications, symptoms, vitals, dietary notes, post-visit appointment notes, and other instructions
- **Suggested prompt chips** are generated from actual patient data:
  - Drug interaction questions for the specific medications being tracked
  - Cause-analysis questions for the most recently logged high-severity symptom
  - Contextual questions for HbA1c, blood pressure, or glucose readings
  - Falls back to general health prompts when no data is entered yet
- **Conversation history persisted** per person (localStorage, capped at 50 messages) — resumes where you left off on every visit
- Patient name is **never** sent to the AI — identified as `[anonymous]` in all contexts
- Medical disclaimer shown on every session

</details>

<details>
<summary><strong>📡 Proactive Insights</strong></summary>
<br/>

Patterns are detected automatically from stored data — no manual analysis required. Up to 4 insights are surfaced on the dashboard at a time, each linking to the relevant page.

**What gets detected:**

| Pattern | Example |
|---|---|
| Vital consecutive trend | *"HbA1c has trended up 4 readings in a row"* |
| Day-of-week severity spike | *"Headache severity tends to be higher on Mondays"* |
| Symptom frequency surge | *"Fatigue logged 4× this week — up from 1× last week"* |

Detection runs entirely client-side — no API call needed. Insights disappear automatically when the underlying data pattern changes.

</details>

<details>
<summary><strong>💾 Backup & Data Safety</strong></summary>
<br/>

- **Export** — one click downloads a complete JSON backup of all people and health records to your device
- **Import** — two-phase restore: a preview step shows person count and record count before committing; `commitBackup()` snapshots current data and rolls back on any failure
- Backup files are validated before import: structure, version compatibility, data key patterns, and person format are all checked
- The backup JSON **never touches any server** — it lives only on your device
- **localStorage quota monitoring** — if storage fills up, a persistent toast offers an immediate "Export backup & free space" action
- **Concurrent-tab conflict detection** — if two tabs write to the same data simultaneously, a conflict toast with a reload option appears

</details>

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript — strict mode |
| Styling | Tailwind CSS |
| Auth | NextAuth v4 — Google OAuth |
| AI | Groq API — `llama-3.3-70b-versatile` |
| PDF parsing | unpdf |
| Storage | `localStorage` — client-only, per-account namespaced |
| Auth session DB | Supabase — auth only, no medical data stored |
| PWA | Service Worker + Web App Manifest |
| Notifications | Web Notifications API |
| Icons | Lucide React |

---

## Privacy & Data Handling

All health data is stored exclusively in your browser's `localStorage`. Nothing health-related is written to any server or database.

| Data | Sent to | Purpose | Stored by service? |
|---|---|---|:---:|
| Report text | Groq API | AI summarisation | ❌ In-flight only |
| Chat messages | Groq API | Health assistant responses | ❌ In-flight only |
| Google account (email, name) | NextAuth / Google OAuth | Login | Session token only |

**Never sent anywhere:** patient names, medications, symptoms, appointments, vitals, notes, or any other health record.

See [SECURITY.md](SECURITY.md) for the full data handling breakdown and vulnerability reporting process.

---

## Deploying

```bash
npx vercel
```

Add all `.env.local` variables under **Settings → Environment Variables** in the Vercel dashboard. Set `NEXTAUTH_URL` to your production URL.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, coding conventions, and the privacy constraints all contributions must uphold.

## License

MIT — see [LICENSE](LICENSE)

## Security

Report vulnerabilities privately — see [SECURITY.md](SECURITY.md) for the reporting process and full data handling policy.
