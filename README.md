# CareCompanion

[![Version](https://img.shields.io/badge/version-1.3.0-blue)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A health tracking app built for family caregivers. Upload medical reports, track medications, log symptoms, manage appointments, and store dietary and other notes — all in one place, with AI-powered summaries, pattern analysis, and a health assistant that knows the patient's full context.

---

## Features

### Multi-person profiles
- Track as many family members as you need, each with a colour-coded avatar
- Switch between people in the sidebar (desktop) or top-bar dropdown (mobile) — all data is fully isolated per person **and per Google account**
- **Rename or recolor** any profile at any time via the pencil icon in the sidebar People section
- Each signed-in Google account sees only its own people and data; two accounts on the same browser never share records
- Dashboard greeting uses the active profile's nickname ("Good morning, Mom") — updates instantly when you switch

### Medical reports
- Upload PDF or TXT reports and get a plain-English AI summary split into three sections: **Summary**, **Dietary Notes**, and **Other Notes**
- Chat with the report using the built-in health assistant — ask follow-up questions in plain language
- Auto-extracts medications, appointments, symptoms, vitals, dietary notes, and patient profile directly from the report text; a confirmation panel lets you select exactly what to save
- Report text is **never stored** — only the AI-generated summary is kept in your browser

### Medications
- Track daily, weekly (specific days of week), and monthly medications with customisable times (Morning / Afternoon / Evening / Night)
- One-tap dose logging with a daily progress bar and adherence percentage
- Dose log shows taken time in 12-hour format (e.g. "2:13 PM")
- Adherence calendar and home % only count days from when the medication was first added — no false "missed dose" red marks for days before the med existed
- Optional course duration — medication auto-removes itself after N days
- Understands Indian prescription notation (1-0-1, 0-0-1, 1-1-1 etc.) when extracted from reports
- Export recurring `.ics` calendar reminders with VALARM alerts — imports into Apple Calendar or Google Calendar with native pop-up alerts
- Destructive "Clear all" is behind a three-dot overflow menu with a confirmation dialog that names the patient

### Symptoms
- Log symptoms with a severity scale of 1–5, with calibrated anchors:
  - **1** — Barely noticeable, no impact on daily activity
  - **2** — Mild, slightly uncomfortable
  - **3** — Moderate, disrupting normal routine
  - **4** — Severe, significant distress
  - **5** — Emergency-level, seek medical attention
- AI pattern analysis across recent entries to surface trends — AI is briefed on the 1–5 scale so it never asks "what does severity 3 mean?"
- Colour-coded severity indicator updates in real time as you set the slider
- **Edit any logged symptom** via the pencil icon — change severity, update notes, or correct the entry without deleting and re-adding

### Appointments
- Track upcoming and past/cancelled appointments; section boundary is start-of-today so same-day appointments always show as Upcoming, not Past
- AI-suggested follow-up appointments generated from post-visit notes
- Export any appointment or all appointments as `.ics` — opens in Apple Calendar, Google Calendar, and any standard calendar app

### Notes
- Dedicated **Dietary** and **Other** sections for doctor instructions and care notes
- Auto-populated from uploaded reports; manual add supported
- **Edit any note** via the pencil icon to fix typos or update instructions without deleting and re-adding
- Notes from multiple reports accumulate over time

### Vitals
- Three sections:
  - **Basic Info** — age, height, gender, blood type; BMI auto-calculated from latest weight with Normal / Overweight / Obese badge
  - **At-Home Readings** — Blood Pressure and Blood Glucose pinned at top as featured cards; Weight, Heart Rate, Temperature in a regular grid; SpO₂ and Respiratory Rate in a collapsible "Additional readings" section
  - **Lab Results** — 20 tests organised into seven groups:
    - **Metabolic** — HbA1c, Total Cholesterol (with LDL/HDL/Triglycerides breakdown)
    - **Blood Panel (CBC)** — Hemoglobin, WBC, RBC, Platelets
    - **Liver (LFT)** — ALT/SGPT, AST/SGOT, ALP, Bilirubin, Albumin
    - **Kidney / Renal** — Creatinine, BUN/Urea, Uric Acid, eGFR
    - **Thyroid** — TSH, T3, T4
    - **Electrolytes** — Sodium, Potassium, Calcium
    - **Iron Studies** — Serum Iron, Ferritin
- Sparkline trend graph per vital with normal-range band on the chart
- Normal / Caution / Critical status badge per reading, shown as a coloured left-border accent on the card
- Doctor's custom target range — overrides the standard range for any test
- Auto-filled from uploaded reports — all 27 vital and lab types are extracted and inserted silently; handles Indian lab notation (Lakh/µL for platelets, mmol/L for glucose, °F for temperature)
- Latest vitals passed to the AI health assistant for context-aware answers

### Health Assistant (Ask AI)
- Ask anything health-related in a conversational chat interface
- Has full context of the patient's medications, symptoms, vitals, dietary notes, post-visit appointment notes, and other instructions — updated on every session
- Suggested prompt chips are generated dynamically from the patient's actual data:
  - If medications are tracked: drug interaction questions for those specific medications
  - If a recent high-severity symptom exists: a cause-analysis question for that symptom
  - If HbA1c, blood pressure, or glucose readings are logged: contextual questions about those results
  - Falls back to general health prompts if no data is entered yet
- Disclaimer shown on every session: responses are informational only, not a substitute for medical advice
- Patient name is **never** sent to the AI — identified as `[anonymous]` in all contexts

### Dashboard
- Four stat cards: Medications tracked, Symptoms this week, Upcoming appointments, Reports uploaded
- **Passive data overlays** on stat cards:
  - Medication adherence % for the past 7 days shown directly on the Medications card
  - 7-day symptom severity sparkline on the Symptoms card (when data exists)
  - Flagged vitals banner below the cards whenever any reading is in Watch or High range — links directly to the Vitals page
- Cards are semantically coloured: neutral when everything is normal; orange if any recent symptom reaches severity ≥ 4; red if severity 5
- Recent Activity log with filter toggle (All / Active / Meds / Vitals / Reports / Symptoms); selected filter persists across reloads; type filters hide deleted entries
- Quick Actions: Upload Report, Log Symptom, Add Medication, Add Appointment

### Data backup and restore
- **Export data** button in the sidebar — downloads a complete JSON backup of all people and health records to your device
- **Import backup** button in the sidebar — restores from a previously exported file; reloads the app automatically
- After 7 days of first use, a persistent (dismissible) reminder banner prompts you to back up your data
- The backup JSON never touches any server — it lives only on your device

### Reminders and notifications
- Opt-in browser notifications for medication times (Morning 8 am, Afternoon 1 pm, Evening 6 pm, Night 9 pm) with per-user time customisation
- Configurable daily symptom check-in reminder
- Falls back to in-app toast alerts if browser notifications are not available

### PWA support
- Service Worker + Web App Manifest — installable on Android Chrome for home-screen access and near-native notifications

### Timezone
- User-selectable timezone (11 options covering IST, Gulf, Singapore, Tokyo, Sydney, London, Europe, US East/Central/West, Auckland)
- Accessible on **both mobile** (More sheet in bottom nav) and desktop (sidebar)
- Changing timezone live-updates all displayed timestamps on the current page without requiring a reload

### Dark mode
- Toggleable from the sidebar (desktop) or the top bar (mobile/all pages), persisted across sessions
- Dark class applied before first paint to eliminate flash

### Privacy-first design
- All medical data stored in the browser's `localStorage` only — nothing is written to any server or database
- Report text processed in-flight by Groq; never stored by the app
- Patient name never sent to any AI service — identified as `[anonymous]` in all AI contexts
- Each Google account's data is namespaced separately in localStorage — switching accounts shows only that account's people and data
- See [SECURITY.md](SECURITY.md) for the full data handling breakdown

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth | NextAuth v4 (Google OAuth) |
| AI | Groq API (`llama-3.3-70b-versatile`) |
| PDF parsing | unpdf |
| Storage | localStorage (client-only, per-account namespaced) |
| Backend DB | Supabase (auth session only — no medical data) |
| PWA | Service Worker + Web App Manifest |
| Notifications | Web Notifications API |
| Icons | Lucide React |

---

## Getting started

### Prerequisites

- Node.js 24+
- A [Groq API key](https://console.groq.com) (free tier is sufficient)
- A Google OAuth client (via [Google Cloud Console](https://console.cloud.google.com))
- A [Supabase](https://supabase.com) project (used for auth session storage only)

### Setup

```bash
git clone https://github.com/yakew7/CareCompanion.git
cd CareCompanion
npm install
```

Create a `.env.local` file in the project root:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

GROQ_API_KEY=your-groq-api-key

NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> AI features (report upload, health chat, symptom analysis) require a valid Groq key. All other features work without one.

### Supabase setup

The only table needed in Supabase is for auth session tracking. No medical data is ever written here.

```sql
create table user_profiles (
  user_id text primary key,
  created_at timestamptz default now()
);
```

### Skip auth for local development

Set `NEXT_PUBLIC_DEV_SKIP_AUTH=true` in `.env.local` to bypass Google login entirely. The app will auto-create a "Demo" person and use a fixed local namespace.

---

## Data and privacy

All health data — medications, symptoms, appointments, reports, notes, vitals, and profile information — is stored exclusively in your browser's `localStorage`. It never leaves your device unless you explicitly export it.

**What is sent to external services:**

| Data | Service | Purpose | Stored? |
|---|---|---|---|
| Report text | Groq API | AI summarisation | No — processed in-flight only |
| Chat messages | Groq API | Health assistant responses | No — processed in-flight only |
| Google account (email, name) | NextAuth / Google OAuth | Login only | Session token only |

**What is never sent anywhere:** patient nicknames, medications, symptoms, appointments, vitals, notes, or any other health record.

The backup export (Export data) downloads a JSON file directly to your device. It is never uploaded to any server.

See [SECURITY.md](SECURITY.md) for the complete breakdown.

---

## Deploying

```bash
npx vercel
```

Add all `.env.local` variables in the Vercel dashboard under **Settings → Environment Variables**. Set `NEXTAUTH_URL` to your production URL.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, coding conventions, and the privacy constraints that all contributions must uphold.

## License

MIT — see [LICENSE](LICENSE)

## Security

Report vulnerabilities privately — see [SECURITY.md](SECURITY.md) for the reporting process and full data handling policy.
