# Changelog

All notable changes to CareCompanion are documented here.

---

## [Unreleased]

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
