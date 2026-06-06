# Changelog

All notable changes to CareCompanion are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.2.0] — 2026-06-06

### Added

- **Rename / recolor profiles** — Pencil icon appears on hover next to each person in the sidebar People section; opens an inline form to change nickname and colour. No more being stuck with "Demo".
- **Symptom edit dialog** — Pencil icon on every symptom card opens a modal to change severity, update notes, or correct the entry without deleting and re-adding.
- **Note edit button** — Pencil icon on every note card (Dietary and Other) allows inline editing; replaces the note in-place on save.
- **Timezone on mobile** — Timezone selector now appears in the More sheet of the bottom nav; previously only accessible in the desktop sidebar.
- **Timezone live-update** — Changing timezone immediately re-renders all displayed timestamps on the current page without requiring navigation or a reload.
- **Activity filter persistence** — Selected activity filter (All / Active / Meds / Vitals / Reports / Symptoms) is saved to localStorage and restored on next visit.
- **Re-extract confirmation dialog** — Clicking ↺ on a report now opens a small modal explaining that the user needs to re-select the original PDF, instead of immediately opening a silent file picker. A filename-mismatch warning fires if the selected file differs from the record name.
- **Reports page heading** — "Reports" heading added to the left panel, consistent with all other pages.

### Changed

- **Adherence calendar** — Days before a medication was added now show as grey "No doses scheduled" instead of red "None taken". Each medication records its creation date and the calendar only tracks from that day forward.
- **Home adherence %** — Weekly adherence calculation now excludes days before each medication was added, preventing artificially low percentages for recently added medications.
- **Appointments section boundary** — Upcoming vs Past split now uses start-of-today (midnight) instead of exact current time; same-day appointments always appear in Upcoming regardless of the scheduled hour.
- **Dashboard greeting** — Shows the active profile's nickname ("Good afternoon, Mom") instead of the signed-in Google account's name or the fallback "there". Populates immediately on first render from cached localStorage.
- **AI severity scale** — Health assistant system prompt now includes the full 1–5 severity scale definition so it never asks "what does severity 3 mean?" when discussing symptoms.
- **Dose time format** — Taken-at time on medication dose buttons now displays in 12-hour format ("2:13 PM") consistent with the rest of the app.
- **Vital log defaults** — Blood Pressure fields open pre-filled with 120 / 80; Heart Rate with 72; Temperature with 36.6; SpO₂ with 98; Respiratory Rate with 16; Pain with 3. Submitting without editing uses the pre-filled value.
- **Activity filter pill** — Selected filter pill changed from teal-100/teal-700 (low contrast, ~4.6:1) to solid teal-600 background with white text for clear WCAG AA compliance at small size.
- **Report button touch targets** — Re-extract (↺) and Delete (🗑) buttons now have `p-2.5` padding and `gap-2` separation, meeting the 44×44 px minimum touch target guideline.
- **Notes + Add touch target** — Slightly larger padding (`px-4 py-2`) on the Dietary and Other "+ Add" buttons.
- **Vitals range modal buttons** — When all three buttons (Save Target / Clear / Cancel) are present, each gets `flex-1` so they share space equally instead of Save stretching to fill the row.
- **Sliders icon** — SlidersHorizontal icon on vital cards without a custom range upgraded from `text-gray-300 w-3 h-3` to `text-gray-400 w-3.5 h-3.5` for better discoverability.
- **Onboarding step 1** — Text updated to "On mobile: tap the avatar in the top bar. On desktop: use the People section in the sidebar." — previously only described the mobile flow.
- **Node.js** — CI and local dev now target Node.js 24 (up from 20); aligns with GitHub Actions deprecation timeline and the `pdfjs-dist ≥ 22` engine requirement.

### Fixed

- **Profile data isolation** — Switching profiles now correctly re-scopes all API reads. Root cause: `api.ts` read the active person ID from the unscoped `activePerson` localStorage key while `PersonContext` wrote to a user-scoped key (`activePerson__u:email`); the two keys were never in sync. Fixed by syncing the unscoped key whenever the context updates.
- **More sheet stays open after navigation** — Bottom nav More sheet now closes immediately when the pathname changes using a render-time derived state reset (avoids the React "setState during render" warning that the previous `useEffect` approach triggered).
- **Appointments calendar crash** — `WeekView` and `MonthView` inner functions now declare their own `const now = new Date()` rather than relying on the outer-scope variable that was removed during the day-boundary refactor.
- **TypeScript build error in vitals page** — `VITAL_DEFAULTS[type] || {}` produced a type error because `{}` was not assignable to the defaults shape; fixed with an explicit cast.
- **CI dependency-review failure** — Removed `.github/workflows/dependency-review.yml`; the action requires GitHub Advanced Security which is not available on this repository.
- **Dependabot PRs** — Merged all 7 open Dependabot PRs (Next.js 14.2.35, eslint-config-next 14.2.35, groq-sdk 0.37.0, actions/checkout v6, actions/setup-node v6, actions/stale v10, actions/dependency-review-action v5).

---

## [1.1.0] — 2026-06-05

### Added

- **Data export / import** — Export all data for all people as a single JSON backup file; import from a previous backup to restore everything. Backup lives only on the user's device and is never uploaded anywhere.
- **Per-account data scoping** — Each Google account's people list and active-person pointer are namespaced by user email in localStorage. Signing in with a different account no longer shows another user's data. Existing data is migrated to the current user's namespace automatically on first login.
- **7-day backup reminder** — A persistent, dismissible banner appears after 7 days of first use prompting the user to export a backup.
- **Dashboard passive data overlays** — Medication adherence % for the past 7 days shown on the Medications stat card; 7-day symptom severity sparkline on the Symptoms card; a "Vitals needing attention" banner surfaces any Watch or High vital readings directly on the dashboard.
- **Vitals page hierarchy** — Blood Pressure and Blood Glucose pinned at the top as larger featured cards. Weight, Heart Rate, and Temperature in a standard grid. SpO₂ and Respiratory Rate collapsed into an expandable "Additional readings" section.
- **Vital card left-border accent** — When a reading exists, the card shows a green/amber/red left border matching the Normal/Watch/High status.
- **Calibrated symptom severity anchors** — The 1–5 severity slider now shows a coloured description chip that updates in real time: 1 = Barely noticeable, 2 = Mild, 3 = Moderate, 4 = Severe, 5 = Emergency-level.
- **Dynamic Health Assistant prompts** — Suggested prompt chips are generated from the patient's actual data (medications, recent high-severity symptoms, HbA1c, BP, glucose readings) instead of static generic questions.
- **Records page 25/75 layout** — Left panel (upload + list) reduced to 25%; right panel (summary + chat) expanded to 75% with an improved empty state.
- **Appointments single empty state** — When no appointments exist, a single empty state with a clear call-to-action is shown instead of the previous two stacked empty cards.
- **Mobile bottom nav with More overflow** — Primary nav: Home, Meds, Symptoms, Ask AI, More. More sheet: Reports, Vitals, Appointments, Notes. Ask AI is directly accessible from the primary bar.
- **Top bar shows active person** — The top bar on every page shows the active person's avatar and nickname instead of a repeated page title.
- **Clear activity log** — A "Clear" button on the Recent Activity section wipes the log without navigating away.
- **Export data / Import backup in sidebar** — One-click export and file-picker import available in the desktop sidebar for all users.
- **ICS inline help** — The calendar import instructions now appear inline inside the `.ics` export panel on the Medications page, not buried in the dashboard Quick Help.
- **Dark mode `aria-label`** — The dark mode toggle in the top bar now has an accessible `aria-label` and a smooth icon transition animation.

### Changed

- Renamed **"Records & Chat"** to **"Reports"** everywhere (sidebar, top bar, bottom nav, page metadata).
- Dashboard stat cards now use a single neutral colour by default; the Symptoms card turns orange (severity ≥ 4) or red (severity 5).
- Medications **"Clear all"** moved from the main action row (adjacent to "+ Add") into a three-dot overflow menu with a named confirmation dialog ("Delete all medications for [Name]?").
- Section label casing standardised — all section dividers now use the same `uppercase tracking-wide text-xs` style throughout the app.
- **"Today's doses"** label in Medications now uses the same small muted uppercase style as other section labels.

### Fixed

- Two empty states stacking on the Appointments page when no appointments exist.
- No mobile navigation on inner pages — the bottom nav is now rendered globally via the app shell.

---

## [1.0.0] — 2026-06-04

First public stable release.

### Added

- **Multi-person profiles** — track multiple family members, each with isolated data and a colour-coded avatar; 7 preset colours with an unlimited on-theme random pool
- **Medical report upload** — upload PDF or TXT reports and get a plain-English AI summary split into Summary, Dietary Notes, and Other Notes sections
- **AI health chat** — ask questions about any uploaded report in plain language; report text is never stored, only the summary
- **Auto-extraction from reports** — medications, appointments, symptoms, vitals, dietary notes, and patient profile are extracted and saved automatically on upload; extracted medications and appointments shown in a confirmation panel with per-item checkboxes
- **Medications tracker** — daily, weekly (day-of-week), and monthly frequencies; one-tap dose logging with a daily progress bar; optional course duration with auto-removal; understands Indian prescription notation (1-0-1, 0-0-1, 1-1-1 etc.)
- **Medication `.ics` reminders** — export recurring calendar events with VALARM alerts to Apple Calendar or Google Calendar; time-of-day pickers appear inline at export time
- **Vitals tracking** — three sections: Basic Info (age, height, gender, blood type with BMI auto-calculated), At-Home Readings (BP, glucose, weight, heart rate, SpO₂, temperature, respiratory rate), and Lab Results (HbA1c, cholesterol with LDL/HDL/TG breakdown, hemoglobin, creatinine); sparkline trend per vital; Normal/Watch/High status badge per reading; auto-filled from uploaded reports
- **Latest vitals in AI context** — health assistant receives the latest reading per vital type for context-aware answers
- **Appointments** — track upcoming and past appointments; AI-suggested follow-up questions from post-visit notes; export as `.ics`
- **Symptoms log** — record symptoms with severity (1–5); AI pattern analysis across recent entries
- **Notes page** — dedicated Dietary and Other sections; auto-populated from uploaded reports; manual add supported
- **Activity history** — every add, delete, and clear-all is logged in Recent Activity with deleted items shown as strikethrough; filter toggle between All and Active Only
- **Web Notifications** — opt-in browser notifications for medication times (Morning 8 am, Afternoon 1 pm, Evening 6 pm, Night 9 pm) and a configurable daily symptom check-in; falls back to in-app toast if unavailable
- **PWA support** — service worker and Web App Manifest; installable on Android Chrome for home-screen access
- **Dark mode** — toggleable from sidebar (desktop) or top bar (mobile), persisted across sessions
- **Privacy-first design** — all health data stored in localStorage only; patient name is never sent to any AI service; report text processed in-flight and never stored

### Fixed

- PDF upload failing with a misleading "only TXT" error — replaced outdated `pdf-parse` (pdfjs 2018) with `unpdf`, which handles all modern PDF formats
- Vitals and health profile not saved after report upload — the extract API was silently dropping those fields from its response
- Duplicate dietary entries after report upload — the combined summary blob was being saved alongside individually extracted points
- `.ics` export producing invalid calendar events when generated near midnight — DTSTART and DTEND now share a single date snapshot
- Medication reminders set to midnight (`00:xx`) incorrectly parsed as `00:00` due to a falsy-zero check
- Vitals history page crashing when a stored entry contains a type no longer in the current definitions
- Dose-toggle save errors silently swallowed on the Medications page
- Health assistant chat rendering markdown tables as raw pipe characters
- Follow-up appointment date calculated from today instead of the original appointment date
- Report summary showing raw JSON when the AI returned structured output
- Clear-all actions not logged in Recent Activity
- Dietary and other note deletions not logged in Recent Activity
- Patient nickname being sent to Groq — replaced with `[anonymous]` in all AI contexts

---

## Prior development history

Internal development versions (not publicly released):

- **2.2.0** — Vitals tracking, sparklines, status badges, medication course duration, 1-0-1 notation, `.ics` medication reminders
- **2.1.0** — Activity history feed with deletion tracking, Web Notifications, PWA support, `.ics` appointment export, SECURITY.md
- **2.0.0** — Multi-person profiles, dark mode, Notes page, localStorage-only data model, mobile-responsive records page
- **1.3.0** — Auto-extraction of medications/appointments/symptoms from reports with confirmation panel
- **1.2.0** — AI follow-up suggestions, markdown rendering in chat
- **1.1.0** — Google OAuth via NextAuth, Supabase integration, symptom log with AI analysis
- **1.0.0-dev** — Initial hackathon prototype: dashboard, report upload with AI chat, medications tracker, appointments manager
