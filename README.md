# CareCompanion

[![Version](https://img.shields.io/badge/version-1.0.0-blue)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A health tracking app built for family caregivers. Upload medical reports, track medications, log symptoms, manage appointments, and store dietary and other notes — all in one place, with AI-powered summaries and pattern analysis.

---

## Features

**Multi-person profiles**
- Track up to as many family members as you need, each with their own colour
- Switch between people in the sidebar; all data is fully isolated per person

**Medical reports**
- Upload PDF or TXT reports and get a plain-English AI summary broken into three sections: Summary, Dietary, and Other Notes
- Chat with the report to ask follow-up questions
- Auto-extracts medications, appointments, symptoms, vitals, and patient profile directly from report text

**Medications**
- Track daily, weekly (day-of-week), and monthly medications
- One-tap dose logging with a daily progress bar
- Optional course duration — auto-removes the medication after N days
- Understands Indian prescription notation (1-0-1, 0-0-1, 1-1-1 etc.) when extracted from reports
- Export recurring calendar reminders as `.ics` — imports into Apple Calendar or Google Calendar with native alerts

**Symptoms**
- Log symptoms with severity (1–5 scale)
- AI pattern analysis across recent entries

**Appointments**
- Track upcoming and past appointments
- AI-suggested follow-up appointments based on post-visit notes

**Notes**
- Dedicated Dietary and Other sections for doctor instructions
- Populated automatically from uploaded reports; also supports manual entries

**Vitals tracking**
- Three sections: Basic Info (age, height, gender, blood type), At-Home Readings, and Lab Results
- Basic Info auto-calculates BMI from height and latest weight with a Normal / Overweight / Obese badge
- At-Home Readings: Blood Pressure, Blood Glucose, Weight, Heart Rate, SpO₂, Temperature, Respiratory Rate
- Lab Results: HbA1c, Total Cholesterol (with LDL/HDL/Triglycerides breakdown), Hemoglobin, Creatinine
- Sparkline trend per vital, Normal/Watch/High status badge per reading
- Auto-filled from uploaded reports — vitals and patient profile are extracted and inserted silently
- Latest vitals passed to the AI health assistant for context-aware answers

**Reminders and notifications**
- Opt-in browser notifications for medication times (Morning 8 am, Afternoon 1 pm, Evening 6 pm, Night 9 pm) and a configurable daily symptom check-in
- Falls back to in-app toast alerts if notifications are not available
- Works as a PWA — install on Android Chrome for background-style alerts

**Calendar export**
- Export any appointment or all appointments as a `.ics` file — opens in Apple Calendar, Google Calendar, and any standard calendar app on iOS and Android

**Activity history**
- Every add, delete, and clear-all action is logged in Recent Activity on the dashboard
- Deleted items remain in the feed with a strikethrough and red "Deleted" badge
- Filter toggle to show all activity or active items only

**Dark mode**
- Toggleable from the sidebar (desktop) or top bar (mobile), persisted across sessions

**Privacy-first**
- All medical and personal data is stored in your browser's localStorage only
- Nothing medical is written to any server or database
- Report text is never stored; only the AI summary is kept
- Patient name is never sent to Groq or any external service — identified as `[anonymous]` in all AI contexts
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
| Storage | localStorage (client-only) |
| Backend DB | Supabase (auth session only — no medical data) |
| PWA | Service Worker + Web App Manifest |
| Notifications | Web Notifications API |

---

## Getting started

### Prerequisites

- Node.js 18+
- A [Groq API key](https://console.groq.com) (free tier is enough)
- A Google OAuth client (via [Google Cloud Console](https://console.cloud.google.com))
- A [Supabase](https://supabase.com) project (for auth only)

### Setup

```bash
git clone https://github.com/your-username/CareCompanion.git
cd CareCompanion
npm install
```

Create a `.env.local` file:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

GROQ_API_KEY=your-groq-api-key

NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Supabase setup

The only table needed in Supabase is for auth session tracking:

```sql
create table user_profiles (
  user_id text primary key,
  created_at timestamptz default now()
);
```

No medical data, patient names, or health records are written here.

---

## Data and privacy

All health data — medications, symptoms, appointments, reports, notes, vitals, and basic profile — is stored exclusively in your browser's localStorage. It never leaves your device. Clearing your browser data will erase it.

The only data sent to external services:
- Report text and chat messages are sent to Groq for AI processing (never stored by the app)
- Patient name is **never** sent to Groq — the AI context identifies the patient as `[anonymous]` only
- Your Google account identity is used for login via NextAuth

See [SECURITY.md](SECURITY.md) for a full breakdown of what leaves your device and what doesn't.

---

## Deploying

```bash
npx vercel
```

Add all `.env.local` variables in the Vercel dashboard under **Settings > Environment Variables**. Set `NEXTAUTH_URL` to your production URL.

---

## License

MIT — see [LICENSE](LICENSE)

## Security

See [SECURITY.md](SECURITY.md) for the vulnerability reporting policy and full data handling breakdown.

## Contributing

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
