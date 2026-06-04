# Changelog

All notable changes to CareCompanion are documented here.

---

## [Unreleased]

---

## [2.1.0] — 2026-06-04

### Added
- **Activity history feed** — Recent Activity on the dashboard now keeps deleted items in the feed with a strikethrough, red dot, and "Deleted" badge so nothing is silently lost
- **Activity filter toggle** — "All" vs "Active only" toggle on the Recent Activity card
- **Deletion logging** — every individual delete and clear-all action across medications, appointments, symptoms, records, dietary notes, and other notes is now logged as a deleted activity entry
- **Reminders and Web Notifications** — opt-in browser notification system; medication reminders fire at mapped times (Morning 8 am, Afternoon 1 pm, Evening 6 pm, Night 9 pm); daily symptom check-in reminder with a configurable time; falls back to in-app toast if notifications are unavailable or denied
- **PWA support** — service worker (`/sw.js`) and Web App Manifest (`/manifest.json`) added; app can be installed on Android Chrome for home-screen access and better notification support
- **Calendar export (.ics)** — download any individual appointment or all appointments as a `.ics` file; compatible with Apple Calendar (iOS/macOS) and Google Calendar (Android)
- **SECURITY.md** — full security policy: vulnerability reporting process, data handling breakdown, known limitations

### Changed
- Recent Activity display limit raised from 5 to 20 entries
- Privacy footer on dashboard now shows a shield icon and explicitly states that patient name is never sent to any server
- README updated: new features documented, Supabase setup clarified, SECURITY.md linked

### Fixed
- Health assistant chatbot was rendering markdown tables as raw pipe characters; fixed with a `NEVER use markdown tables` system prompt rule and custom `ReactMarkdown` table renderer as a fallback
- Clear-all on medications, appointments, symptoms, records, dietary, and other notes was not logged in Recent Activity

### Security
- Patient nickname is no longer sent to Groq in the health chat context — replaced with `[anonymous]`
- Deleted dead Supabase `user_profiles` route that stored `patient_name` — patient names were never meant to leave the device

---

## [2.0.0] — 2026-06-03

Major overhaul focused on multi-person support, privacy, and UI polish.

### Added
- **Multi-person profiles** — track multiple family members, each with isolated data and a colour-coded avatar
- **7 preset person colours** (teal, purple, blue, orange, rose, emerald, amber) with an unlimited random on-theme colour pool for additional people
- **Dark mode** — toggleable from sidebar (desktop) and top bar (mobile), persisted in localStorage
- **Notes page** (`/notes`) — dedicated Dietary and Other sections; auto-populated from uploaded reports, with manual add support
- **Dietary and Other report sections** — AI summary now splits into Summary, Dietary Notes, and Other Notes
- **Clear all buttons** — per section (medications, symptoms, appointments, records, notes), per active person
- **Day-of-week and weekly/monthly frequency options** in the medication form (e.g. "Friday Morning", "Once weekly")
- **Mobile-responsive records page** — tab-based view (Reports list / Chat) instead of a hidden split panel

### Changed
- All medical data moved to **localStorage only** — nothing is written to Supabase; auth remains via Google OAuth
- `api.ts` now calls `storage.ts` directly, removing all HTTP round-trips for data reads/writes (faster, more private)
- Person setup flow replaces the old "patient name + relation" Supabase profile with a local nickname + colour
- Medication dose toggle uses **optimistic UI** — state updates instantly on tap
- All emojis replaced with Lucide icons throughout the UI
- Modals slide up from the bottom on mobile
- Dark mode toggle broadcasts a custom DOM event so sidebar and top bar stay in sync

### Fixed
- Follow-up appointment date was calculated from today instead of the original appointment date
- Report summary was showing raw JSON when the AI returned structured output
- Dark mode button label and icon were out of sync between sidebar and top bar

---

## [1.3.0] — 2026-05-xx

### Added
- Auto-extract medications, appointments, and symptoms from uploaded reports
- Extracted items confirmation panel with per-item checkboxes

### Fixed
- Strict extraction: no assumed times, correct appointment date offsets

---

## [1.2.0] — 2026-05-xx

### Added
- AI follow-up appointment suggestion from post-visit notes
- Markdown rendering in AI chat and symptom analysis

### Changed
- Report text is never stored in the database — only the AI summary is saved (privacy fix)

---

## [1.1.0] — 2026-05-xx

### Added
- Google OAuth sign-in via NextAuth
- Supabase integration for user profiles and data persistence
- Symptom log with severity slider and AI pattern analysis

---

## [1.0.0] — 2026-05-xx

### Added
- Initial release for V1TROUS 2026 hackathon
- Dashboard with summary stats and recent activity
- Records page with PDF/TXT upload and AI chat
- Medications tracker with daily dose logging
- Appointments manager
- Bottom navigation for mobile
