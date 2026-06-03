# CareCompanion

A health tracking dashboard built for family caregivers. Upload medical reports, track medications, log symptoms, manage appointments, and store dietary and other notes — all in one place, with AI-powered summaries and pattern analysis.

Built for the **V1TROUS 2026** hackathon.

---

## Features

**Multi-person profiles**
- Track up to as many family members as you need, each with their own colour
- Switch between people in the sidebar; all data is fully isolated per person

**Medical reports**
- Upload PDF or TXT reports and get a plain-English AI summary broken into three sections: Summary, Dietary, and Other Notes
- Chat with the report to ask follow-up questions
- Auto-extracts medications, appointments, and symptoms directly from report text

**Medications**
- Track daily, weekly (day-of-week), and monthly medications
- One-tap dose logging with a daily progress bar

**Symptoms**
- Log symptoms with severity (1–5 scale)
- AI pattern analysis across recent entries

**Appointments**
- Track upcoming and past appointments
- AI-suggested follow-up appointments based on post-visit notes

**Notes**
- Dedicated Dietary and Other sections for doctor instructions
- Populated automatically from uploaded reports; also supports manual entries

**Dark mode**
- Toggleable from the sidebar (desktop) or top bar (mobile), persisted across sessions

**Privacy-first**
- All medical and personal data is stored in your browser's localStorage only
- Nothing medical is written to any server or database
- Report text is never stored; only the AI summary is kept

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth | NextAuth v4 (Google OAuth) |
| AI | Groq API (`llama-3.3-70b-versatile`) |
| Storage | localStorage (client-only) |
| Backend DB | Supabase (auth session only — no medical data) |

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

The only table needed in Supabase is for user profiles (tracks whether onboarding is complete):

```sql
create table user_profiles (
  user_id text primary key,
  created_at timestamptz default now()
);
```

No medical data is written here.

---

## Data and privacy

All health data — medications, symptoms, appointments, reports, notes — is stored exclusively in your browser's localStorage. It never leaves your device. Clearing your browser data will erase it.

The only data sent to external services:
- Report text is sent to Groq for AI summarisation (never stored by the app)
- Your Google account identity is used for login via NextAuth

---

## Deploying

```bash
npx vercel
```

Add all `.env.local` variables in the Vercel dashboard under **Settings > Environment Variables**. Set `NEXTAUTH_URL` to your production URL.

---

## License

MIT — see [LICENSE](LICENSE)

## Contributing

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
