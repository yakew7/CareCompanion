# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 1.8.x (current) | ✅ |
| 1.7.x | ✅ |
| < 1.6.0 | ❌ Please upgrade — versions before 1.7.0 do not authenticate AI endpoints |
| Pre-release dev builds | ❌ Not supported |

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
| Report text | Groq API | AI summarisation & extraction | No — processed in-flight only |
| Chat messages | Groq API | Health assistant responses | No — processed in-flight only |
| Medication names | Groq API | Drug interaction checks | No — processed in-flight only |
| Symptom log + meds/journal context | Groq API | Trigger & pattern analysis | No — processed in-flight only |
| Google account (email, name) | NextAuth / Google OAuth | Authentication only | Session token only |
| Search location + facility types (Find Care) | OpenStreetMap Overpass, via the app server | Facility discovery | No — not stored |
| Location string (Find Care manual entry) | OpenStreetMap Nominatim, via the app server | Geocoding | No — not stored |
| Map viewport (Find Care) | OpenStreetMap tile servers (direct browser request) | Base map imagery | No — not stored |

The Health Assistant UI discloses to the user that messages and tracked health data are processed by an AI service (Groq).

### Find Care external services

Find Care is the one section that queries external location services. It never involves any health record or patient identifier — only the search location, the chosen facility types, and (for manual entry) the typed location string.

- **Proxied by design.** All facility (Overpass) and geocoding (Nominatim) requests are made server-side through `app/api/find-care/*`. The browser communicates only with the app's own origin for data, which is why `connect-src` stays limited to `'self'` (plus Supabase). Map tiles are the sole direct third-party request, from `*.tile.openstreetmap.org`.
- **Opt-in location.** GPS is never activated on load; the browser's permission prompt only appears after the user explicitly taps "Use my location". Denial falls back to manual entry, which needs no device location.
- **Nothing persisted.** No location, query, or facility result is written server-side; results live in client component state for the session only.
- **Input validated before any upstream call.** Coordinates, radius, and facility types are validated and clamped server-side; an invalid request returns **400** and never reaches Overpass or Nominatim. Upstream failures return **502**, timeouts **504**.

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

## Application hardening

The following protections are active as of v1.8.0:

### Endpoint protection
- **Authentication required on every AI route** — `/api/chat`, `/api/health-chat`, `/api/summarize`, `/api/extract-report-data`, `/api/check-interactions`, `/api/suggest-followup`, and `/api/parse-pdf` all verify the NextAuth session via a shared guard (`lib/api-guard.ts`) and return **401** for unauthenticated requests
- **Find Care proxy routes** (`/api/find-care/facilities`, `/api/find-care/geocode`) reuse the same shared guard — authenticated session required (**401**), rate-limited, and all inputs validated (**400**) before any external call
- **Rate limiting** — 20 requests per minute per user on all AI and Find Care routes (sliding window); requests beyond the limit receive **429**
- **Database routes** (`/api/db/*`) require a session and scope every query by `user_id` — one account can never read another account's rows

### Input limits
- PDF uploads are capped at 4 MB **server-side** (rejected with 413 before the file is read)
- Report text, chat context, and prompt-bound fields (medication names, doctor/specialty, notes) are length-capped before being interpolated into AI prompts, limiting prompt-injection surface
- Find Care coordinates, radius, and facility types are validated and clamped (radius to 500 m–25 km, results to the 50 nearest) before any upstream request, bounding query cost and abuse

### Transport & browser protections
- **Content-Security-Policy** restricting scripts, frames, and connections to the app's own origin (plus Supabase and Google avatar images). `img-src` also allows `https://*.tile.openstreetmap.org` for Find Care map tiles — the only external image source. `connect-src` remains `'self' https://*.supabase.co`, since all Find Care data is proxied server-side
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a restrictive `Permissions-Policy` (`camera=(), microphone=(), geolocation=(self)` — geolocation is enabled for the app's own origin only, to support Find Care's opt-in GPS)
- `Cache-Control: no-store` on all `/api/*` responses — AI responses containing health context are never cached by the browser or service worker

### Configuration safety
- The development auth bypass (`NEXT_PUBLIC_DEV_SKIP_AUTH`) is **ignored in production builds** (`NODE_ENV` gated on both client and server) — setting it on a deployed instance cannot disable authentication

---

## Known limitations

- **localStorage is not encrypted.** Anyone with physical access to the device and browser dev tools can read stored health data. Do not use this app on a shared or public device without clearing browser data afterward.
- **Web Notifications work while the tab is open** (or when the PWA is installed on Android Chrome). iOS Safari does not support background push for web apps.
- **localStorage can be cleared.** Clearing browser data or switching browsers permanently deletes all health records on that device. Use the **Export data** feature in the sidebar to download a local JSON backup regularly. The backup file lives only on your device and is never uploaded to any server. Use **Import backup** to restore from a saved file.
- **Data is per-browser, not per-device.** Each browser (Chrome, Firefox, Safari) has its own localStorage. To move data to a new device or browser, export from the old one and import on the new one.
- **AI responses are informational only.** CareCompanion is not a medical device and does not provide medical advice.

---

## Dependency security

Dependencies are managed via npm. To audit for known vulnerabilities:

```bash
npm audit
```

We recommend running `npm audit` before deploying to production and resolving any high or critical findings.
