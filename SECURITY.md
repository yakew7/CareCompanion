# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 2.x (current) | ✅ |
| 1.x | ❌ No longer maintained |

---

## Reporting a vulnerability

If you discover a security vulnerability in CareCompanion, **please do not open a public GitHub issue.**

Report it privately by emailing the maintainer or opening a [GitHub Security Advisory](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) on this repository.

Please include:
- A clear description of the vulnerability
- Steps to reproduce or a proof-of-concept
- The potential impact you see

You can expect an acknowledgement within **48 hours** and a resolution or status update within **7 days**.

---

## Data handling and privacy

CareCompanion is designed to minimise data exposure. Here is exactly what leaves your device and what doesn't.

### What stays on your device (localStorage only)

- All health data: medications, symptoms, appointments, dietary notes, other notes, report summaries
- Person profiles (nicknames and colours)
- Reminder and notification preferences
- Theme preference

No health data is written to any server or database, including Supabase.

### What is sent to external services

| Data | Service | Purpose | Retained? |
|---|---|---|---|
| Report text | Groq API | AI summarisation | No — processed in-flight only |
| Chat messages | Groq API | Health assistant responses | No — processed in-flight only |
| Google account (email, name) | NextAuth / Google OAuth | Authentication only | Session token only |

**Patient nickname is never sent to Groq or any other service.** The health context passed to the AI identifies the patient only as `[anonymous]`.

**Report text is never stored by the app** — only the AI-generated summary is saved to localStorage.

### Supabase usage

Supabase is used **only for authentication session management**. The only table in use is:

```sql
create table user_profiles (
  user_id text primary key,
  created_at timestamptz default now()
);
```

No health data, no patient names, no medical records are stored in Supabase.

---

## Known limitations

- **localStorage is not encrypted.** Anyone with physical access to the device and browser dev tools can read stored health data. Do not use this app on a shared or public device without clearing browser data afterward.
- **Web Notifications work while the tab is open** (or when the PWA is installed on Android Chrome). iOS Safari does not support background push for web apps.
- **No data backup.** Clearing browser data permanently deletes all health records. There is no cloud sync or export feature beyond .ics for appointments.
- **AI responses are informational only.** CareCompanion is not a medical device and does not provide medical advice.

---

## Dependency security

Dependencies are managed via npm. To audit for known vulnerabilities:

```bash
npm audit
```

We recommend running `npm audit` before deploying to production and resolving any high or critical findings.
