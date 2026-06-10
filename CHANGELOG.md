# Changelog

All notable changes to CareCompanion are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.7.0] — 2026-06-10

A security-hardening and caregiver-intelligence release. Locks down every AI endpoint, fixes six bugs found in an end-to-end audit with a real hospital report, and adds eight features — from AI trigger analysis to a post-visit action-item checklist.

### 🔐 Security

- **All 7 AI routes now require authentication** — `/api/chat`, `/api/health-chat`, `/api/summarize`, `/api/extract-report-data`, `/api/check-interactions`, `/api/suggest-followup`, and `/api/parse-pdf` previously accepted unauthenticated requests, allowing anyone to burn the Groq API quota. A shared guard (`lib/api-guard.ts`) returns **401** without a session
- **Rate limiting** — 20 requests/minute per user on every AI route (sliding window, **429** beyond the limit)
- **Server-side PDF size limit** — the 4 MB cap was client-side only; the parse route now rejects oversized uploads with **413** before reading them
- **Dev auth bypass is production-gated** — `NEXT_PUBLIC_DEV_SKIP_AUTH` now also requires `NODE_ENV !== "production"` on both client and server, so a misconfigured env var can no longer disable auth on a deployed instance
- **Security headers** — Content-Security-Policy (blocks foreign scripts, frames, and connections), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, Referrer-Policy, Permissions-Policy, and `Cache-Control: no-store` on all `/api/*` responses so health data is never cached
- **Prompt input caps** — medication names, doctor/specialty fields, and post-visit notes are length-limited before being interpolated into AI prompts, reducing prompt-injection surface
- **AI processing disclosure** — the Health Assistant disclaimer now states that messages and tracked health data are processed by Groq

### ✨ New Features

#### 🧠 AI Trigger Analysis (Symptoms)
The symptom "Analysis" button is now **"Analyze triggers"** — and it earns the name. The AI is briefed with current medications (including start dates), the last 14 journal entries, and dietary notes alongside the symptom log, then asked for suspected triggers (symptoms starting after a med began, diet/journal correlations), dated patterns, and talking points for the doctor — with an explicit instruction to say so when the data is too sparse rather than speculate.

#### 📍 Symptom Timeline View
A List/Timeline toggle on the Symptoms page. The timeline renders entries newest-first on a vertical line with severity-coloured dots (green ≤2, amber 3, red 4–5), ongoing/resolved duration badges, linked-medication chips, and notes.

#### ✅ Post-Visit Action-Item Checklist
Each line of an appointment's *Action items* note now renders as a checkable item on the appointment card — strike-through when done, persisted per item with no data migration required. The dashboard shows an **"Open action items from past visits"** card listing unchecked items with the doctor and visit date.

#### 🚨 Allergy Extraction → Emergency Info
Reports that explicitly state allergies (e.g. *"Patient is ALLERGIC to Sulfa drugs and Penicillin"*) now auto-fill the Emergency Info allergy list — case-insensitively deduplicated, with a confirmation toast. Intolerances and "advised to avoid" items are deliberately excluded.

#### 📅 Exact Appointment Dates, Times & Venues from Reports
Extraction now returns explicit `dateISO` / `timeHHMM` / `location` when a report states them, so *"25 July 2026, 10:00 AM, Apollo Hospitals, Juhu"* imports as exactly that — instead of a day-offset guess at the current clock time with no venue.

#### 🔥 Adherence Streak
The medications page shows a *"N-day perfect streak"* counter next to the 30-day adherence stat. A day counts when every expected dose was logged; an incomplete today doesn't break the streak.

#### 📄 Doctor-Ready Print Summary Upgrades
The dashboard Print Summary now includes a colour-coded **Adherence (30d)** column on the medications table and a **previous-reading line** under each vital for at-a-glance trend comparison.

#### 📊 Vitals CSV Export
An **Export CSV** button on the Vitals page downloads every reading as `Date,Type,Value,Value2,Unit,Notes` — ready for Excel or a doctor's intake system.

### ♿ Accessibility

- New `useDialog` hook (`lib/useDialog.ts`): Escape closes, Tab is trapped inside, focus moves into the dialog on open and returns to the trigger on close
- Applied with `role="dialog"` / `aria-modal="true"` / `aria-label` to the medication add/edit and clear-confirm modals, the appointment form modal, and the dashboard print summary

### 🐛 Bug Fixes

- **Lab results lost on import** — the extraction response was capped at 4,000 tokens with no truncation detection; dense reports lost whatever came last in the JSON (usually the lab panel). Token budget doubled and the route now retries once on truncation or unparseable JSON. A full hospital report now imports all 30 readings — CBC, LFT, RFT, TFT, electrolytes, and iron studies included
- **Appointment dates off by one day** — the extraction prompt contained a hardcoded "TODAY" date that went stale; it is now injected dynamically per request
- **Interaction-warning toast spam** — importing several medications fired one 12-second toast per drug, flooding the screen. All findings are now collected into a single compact notice with a scrollable list and dismiss button; each interacting pair is checked once instead of from both directions
- **Monthly medications excluded from adherence** — the day-adherence calculation skipped monthly meds entirely, inflating the percentage; they are now expected on the day-of-month the course started (clamped to month end)
- **Imported medications bypassed interaction checking** — medications saved via report extraction now run the same drug-interaction check as the manual form
- **Streaming AI fetches never checked `res.ok`** — a 500/429 from the API left the chat, records Q&A, and visit-prep modals spinning; all streaming and extraction fetches now fail fast into their error handlers
- **Symptom co-occurrence recomputed on every render** — now memoised and capped to the 500 most recent entries
- **Imported appointments with no doctor name** — fall back to the specialty (or "Doctor") instead of importing blank

### 🔧 Changed

- `lib/api-guard.ts` (new): shared auth + rate-limit guard for AI routes
- `lib/useDialog.ts` (new): accessible dialog behaviour hook
- `lib/storage.ts`: `actionItemsDone?: Record<string, boolean>` added to `Appointment`; new `actionItemLines()` helper
- `app/api/extract-report-data`: dynamic current date, `allergies` array, appointment `dateISO`/`timeHHMM`/`location`, `max_tokens` 4000 → 8000 with truncation retry
- `next.config.js`: security headers (CSP, frame, sniff, referrer, permissions) and `no-store` on `/api/*`
- `.claude/launch.json`: `autoPort` enabled so preview servers don't collide with a running dev server

---

## [1.6.0] — 2026-06-09

Four new caregiver-utility features plus three bug fixes.

### ✨ New Features

#### 📔 Daily Caregiver Journal
A new `/journal` page for free-form daily observations — things that don't fit neatly into medications, vitals, or symptoms. Accessible from the sidebar and bottom-nav "More" sheet.

- Date-grouped entries with timestamps
- Optional **mood marker** per entry: Good day / Neutral / Tough day — colour-coded chip
- Full add / edit / delete with a modal form
- Descriptive empty state that explains the page's purpose
- Data scoped per person, stored in `localStorage` under `journal__<personId>`

#### 💊 Pill Count / Inventory Tracking
Medications now have an optional **"Pills remaining"** field.

- Entering a count shows an inline *"~N days of doses remaining"* hint in the form
- Every logged dose **automatically decrements** the count by 1
- Card badges: grey (≥8 days), amber (≤7 days), red (≤3 days), red "Out of pills" at 0
- Low pill count medications surface in the **dashboard refill reminders card** alongside expiry-date alerts — deduplicated by name, sorted by urgency

#### 🔔 Appointment Reminders
Appointments now have a **"Reminder"** select in the add/edit form: None, 1h, 2h, 12h, 24h, or 48h before.

- On page load, checks every upcoming appointment with `reminderHours` set
- If the reminder window has been reached, fires a **browser notification** (requires notification permission)
- Fires once per appointment per device — stamped in `localStorage` as `cc_appt_rem_<id>` to prevent duplicates
- A 🔔 chip on the appointment card shows the configured reminder time

#### 📊 Vital Targets — % In-Range Stat
Every vital card with at least 3 readings in the last 90 days now shows a **% readings in target** line.

- Uses the doctor's custom range if set, otherwise the standard clinical normal range
- Colour-coded: green ≥80%, amber ≥50%, red <50%
- Shown on both at-home vitals and lab result cards
- Weight excluded (no clinically universal target range)

### 🐛 Bug Fixes

- **Emergency page**: Removed nonsensical "custom blood type" free-text input — only the 8 standard ABO/Rh blood types + "Unknown" are valid
- **Bottom nav z-index**: The More sheet backdrop (`z-40`) was sitting on top of the primary nav bar (`z-30`), making Home / Reports / Meds / Symptoms / Vitals untappable while the sheet was open. Nav raised to `z-50`; primary links now also call `setOpen(false)` to dismiss the sheet on navigate
- **More button label**: The More button was replacing its icon and label with the active overflow page (e.g. showing "Appts" as a 6th primary tab). It now always shows the MoreHorizontal icon and "More" label — highlighted teal when on an overflow page

### 🔧 Changed

- `lib/storage.ts`: Added `reminderHours?: number` to `Appointment`; `pillCount?: number` to `Medication`; new `JournalEntry` interface; `"journal"` added to `DATA_KEYS`; `storage.journal` CRUD methods added
- `lib/api.ts`: `api.journal` accessor added

---

## [1.5.0] — 2026-06-09

A comprehensive caregiver-intelligence release. Adds four P1 safety & prep features, two P2 workflow improvements, three P3 depth features, and resolves nine UX bugs found during audit.

### ✨ New Features

#### 🛡️ Emergency Info Card
A dedicated `/emergency` page accessible from the sidebar and the "More" bottom-nav sheet. Displays blood type (large red chip), allergy chips, tap-to-call emergency contacts, and primary doctor info — everything a first responder or ER needs at a glance.

Edit mode includes:
- Nine blood type preset buttons: A+, A−, B+, B−, AB+, AB−, O+, O−, Unknown — tap to select, tap again to deselect
- Add/remove allergies
- Add/remove emergency contacts (name, phone, relation) with tap-to-call on the view screen
- Primary doctor name and phone
- General medical notes textarea

Data stored under `emergencyInfo` key in `localStorage`, scoped per person.

#### 💊 Medication Refill Countdown
Medications with an `expiresAt` date set now surface an amber warning card on the dashboard when expiry is 1–7 days away. Shows medication name, days remaining, and links directly to the Medications page. Card disappears automatically once the medication is removed or the date passes.

#### 🏥 Doctor Visit Prep Modal
A full-screen pre- and post-visit workflow accessible from any upcoming appointment card via a clipboard icon.

**Pre-visit panel:**
- Current medications list (extracted from active meds)
- Recent symptoms summary (last 10 days)
- Latest vitals snapshot (last reading per vital type)
- AI-generated question suggestions (Groq streaming) — tailored to the specific appointment's doctor specialty and the patient's data profile
- One-click clipboard copy of all questions

**Post-visit structured notes (4 fields):**
- What the doctor said
- Medication changes
- Action items / follow-ups
- Appointment outcome summary

Post-visit notes are saved back to the appointment record and displayed on the appointment card with colour-coded labels (teal = doctor said, purple = med changes, amber = action items).

#### 🔗 Symptom–Medication Linking
A "Related medication" dropdown in the symptom log and edit forms lets caregivers associate a symptom with any tracked medication. On each medication card, a "Reported side effects" section lists linked symptoms as amber pills with a *"First reported N days after starting"* calculation — helping doctors identify adverse reactions during visits.

#### 📊 Symptom Duration Tracking *(P3)*
Each symptom can be marked "Still ongoing" at log time. Ongoing symptoms show an amber "Ongoing" badge on their card with a running day count (e.g. *"Day 4"*). A "Mark resolved" button sets `resolvedAt` to the current timestamp. Duration data is preserved in the edit form.

#### 🏷️ Notes Tagging & Filtering *(P3)*
An inline tag input (press Enter or `,` to add a tag) appears on the Dietary and Other note forms. Tags render as small chips on each note card. An active tag filter banner appears when a tag chip is clicked, showing only matching notes across both sections. Clicking the banner clears the filter. Tags are stored as `string[]` on the `Note` interface.

#### 📱 iOS Push Reliability Banner *(P2)*
A one-time, session-dismissible banner on the Medications page detects iOS Safari (non-standalone) and explains that background notifications require the app to be installed as a PWA. Includes expandable step-by-step "Add to Home Screen" instructions. Implemented as a standalone `IOSPushBanner` component using `sessionStorage` for dismissal state.

### 🐛 Bug Fixes

| # | Location | Fix |
|:---:|---|---|
| 1 | Symptoms | "Clear all" now shows a named confirmation modal before deleting |
| 2 | Dashboard | Onboarding screen no longer flashes briefly on first load for returning users (`dataLoaded` gate) |
| 3 | Symptoms / Notes | Edit/notes icon buttons raised from `text-gray-300` to `text-gray-400` for sufficient contrast |
| 4 | Sidebar export | Toast now reads *"Backup saved to Downloads"* (was generic "Exported") |
| 5 | Medications | "Late" amber badge now correctly appears on dose cards when taken significantly after the scheduled time slot |
| 6 | Appointments | New appointment form defaults to today's date instead of tomorrow |
| 7 | Dashboard | Insights placeholder only appears when there is existing data but no patterns detected yet |
| 8 | Symptoms | Clear-all confirmation dialog uses patient-specific wording |
| 9 | General | Verified no pre-existing regressions across all pages after P1–P3 changes |

### 🔧 Changed

- `lib/storage.ts`: Added `linkedMedication?: string`, `ongoing?: boolean`, `resolvedAt?: string` to `Symptom`; `tags?: string[]` to `Note`; `visitDoctorSaid?`, `visitMedsChanged?`, `visitActionItems?` to `Appointment`; new `EmergencyContact` and `EmergencyInfo` interfaces; `"emergencyInfo"` added to `DATA_KEYS`
- Sidebar: Emergency Info link added (ShieldAlert icon)
- Bottom nav More sheet: Emergency added to overflow items

---

## [1.4.0] — 2026-06-08

This is a major reliability, polish, and intelligence release. It lands five data-safety fixes, seven UX improvements, four polish items, and three new headline features.

### ✨ New Features

- **Proactive Insights** — The dashboard now surfaces health patterns automatically, without any user action. Detected patterns include:
  - *Vital consecutive trends* — e.g. "HbA1c has trended up 4 readings in a row"
  - *Day-of-week severity spikes* — e.g. "Headache severity tends to be higher on Mondays"
  - *Symptom frequency surges* — e.g. "Fatigue logged 4× this week — up from 1× last week"
  
  Detection runs entirely client-side (no API call). Up to 4 insights are shown per person; each links to the relevant page and disappears automatically when the underlying data pattern changes.

- **Global Search** — A `⌘K` shortcut and search icon in the top bar open a full-screen overlay that searches across medications, symptoms, appointments, and notes in real time. Fully keyboard-navigable (↑↓ Enter Escape). Available on all pages.

- **Health chat persistence** — Conversation history is saved to `localStorage` per person (capped at 50 messages). Returning to the chat page resumes where you left off. History clears automatically when switching to a different profile.

### 🛡️ Reliability (Tier 1)

- **localStorage quota monitoring** — A new `StorageQuotaMonitor` component catches `QuotaExceededError` via a custom DOM event (`cc:quotaexceeded`) and shows a persistent toast with an "Export backup & free space" action button.

- **Backup schema validation** — `previewBackup()` validates structure, version number, data key patterns, and person format before writing anything. Unsupported backup versions show a specific error ("Unsupported backup version (got 2)") rather than silently failing or corrupting data.

- **Two-phase backup import** — The sidebar now shows a **preview step** (person count, record count) before committing a restore. `commitBackup()` snapshots current data and performs a full rollback if any write fails.

- **AI retry buttons** — Report processing failures and health chat send failures now show a toast with a **Retry** button that re-submits the original request, instead of silently dropping it.

- **Drug interaction transparency** — When Groq is unavailable during an interaction check, the response now explicitly says "Interaction check unavailable — verify manually with your pharmacist" instead of returning a silent "no interaction found" result.

- **Concurrent-tab write detection** — `lib/storage.ts` tracks the last-seen serialised value per key using a module-level `Map`. When a write is attempted and another tab has modified the same key in the meantime, a conflict toast appears with a **Reload** button.

### 🎯 UX Improvements (Tier 2)

- **Post-save report summary** — After confirming extracted items, a toast summarises exactly what was saved: *"Saved from report: 2 medications, 1 appointment, 3 notes"* — no more guessing what was applied.

- **Activity log cap label** — When the activity log reaches its 50-entry cap, a "Showing last 50 entries" label appears at the bottom of the list. (Cap also raised from 20 to 50.)

- **Symptom severity trend card** — The Symptoms page shows a week-over-week severity comparison card for each symptom with directional arrows (▲/▼) and colour coding.

- **Vitals empty state CTAs** — Each vital card with no readings now shows a "+ Log first reading" button that opens the relevant log modal directly, rather than leaving the card blank.

- **Medication reminder persistence** — Notification fired-state is persisted to `localStorage` with a daily key (`cc_rem_YYYY-MM-DD`). Reminders fire within a 5-minute window after the scheduled time, so page reloads no longer cause missed reminders.

- **PDF error messages** — Distinct, actionable errors for three failure modes: image-only PDF (422), password-protected file (422), and corrupted/invalid PDF (500). All include a **Retry** button that re-submits the original file.

- **Global search** — Described in New Features above.

### ✏️ Polish (Tier 3)

- **Past-date appointment warning** — When a user picks a historical date in the appointment form, an amber "⚠ This date is in the past" message appears inline below the date picker. Saving is still allowed.

- **Custom vital range hints** — The Doctor's Target modal now shows the standard reference range (e.g. *"Standard: 70–140 mg/dL"*) as a reference hint above the input fields, so users know what they are overriding.

- **Editable follow-up suggestions** — The AI follow-up appointment card now opens a "Review Follow-up" modal pre-filled with the suggested doctor, date, specialty, and notes. All fields are editable before saving. The card previously created the appointment immediately on acceptance.

- **Chat persistence** — Described in New Features above.

### 🔧 Changed

- Activity log cap raised from 20 → 50 entries.
- Notification matching changed from exact-minute to a 5-minute window (`diff >= 0 && diff <= 4`) to survive page reloads near the scheduled time.
- `lib/storage.ts` `setList` now uses a module-level `lastSeen` Map for concurrent-write detection; no change to the public API.

### 🐛 Fixed

- `lib/backup.ts` `reduce` callback TypeScript error (`'sum' is of type 'unknown'`) — resolved with an explicit `reduce<number>` generic.
- `app/symptoms/page.tsx` Map-iteration TypeScript errors — replaced `Map<string, Symptom[]>` with `Record<string, Symptom[]>` and added explicit type annotations on reduce callbacks.

---

## [1.3.0] — 2026-06-08

### Added

- **Comprehensive lab results** — Lab Results section expanded from 4 tests to 20 across seven groups:
  - **Metabolic** — HbA1c, Total Cholesterol (unchanged)
  - **Blood Panel (CBC)** — WBC, RBC, Platelets (joined existing Hemoglobin)
  - **Liver (LFT)** — ALT/SGPT, AST/SGOT, ALP, Total Bilirubin, Albumin
  - **Kidney / Renal** — Creatinine (existing), BUN/Urea, Uric Acid, eGFR
  - **Thyroid (TFT)** — TSH, T3, T4
  - **Electrolytes** — Sodium, Potassium, Calcium
  - **Iron Studies** — Serum Iron, Ferritin
- **Grouped Lab Results UI** — tests are displayed under labelled sub-headers within the collapsible Lab Results section; section stays collapsed by default until data exists in any group
- **Trend chart normal bands** — all 27 vital and lab types now carry numeric normal ranges for the green band on the trend chart (previously only 9 core vitals had bands)
- **Log modal placeholders** — input placeholder values shown for all new lab types so users know the typical order of magnitude

### Changed

- **Lab extraction from reports** — AI prompt expanded to cover all new types; handles common aliases (SGPT/ALT, SGOT/AST, TLC/WBC, Blood Urea/BUN) and unit conversions (Lakh/µL → ×10³/µL for platelets, mmol/L → mg/dL for glucose)
- **Extraction `max_tokens`** raised from 1800 → 2400 to accommodate richer vitals output
- **`VitalType` union** extended with 16 new literal types; existing localStorage data is unaffected

---

## [1.2.0] — 2026-06-06

### Added

- **Rename / recolor profiles** — Pencil icon on hover next to each person in the sidebar; opens an inline form to change nickname and colour
- **Symptom edit dialog** — Pencil icon on every symptom card; opens a modal to change severity, update notes, or correct the entry
- **Note edit button** — Pencil icon on every note card (Dietary and Other) for inline editing
- **Timezone on mobile** — Timezone selector now available in the More sheet of the bottom nav
- **Timezone live-update** — Changing timezone immediately re-renders all timestamps on the current page without a reload
- **Activity filter persistence** — Selected filter (All / Active / Meds / Vitals / Reports / Symptoms) saved to localStorage and restored on next visit
- **Re-extract confirmation dialog** — Clicking ↺ on a report now explains that the user needs to re-select the original PDF; a filename-mismatch warning fires if the file differs from the record name
- **Reports page heading** — "Reports" heading added to the left panel, consistent with all other pages

### Changed

- **Adherence calendar** — Days before a medication was added now show as grey "No doses scheduled" instead of red "None taken"
- **Home adherence %** — Weekly calculation excludes pre-creation days, preventing low percentages for recently added medications
- **Appointments section boundary** — Upcoming vs Past split uses start-of-today (midnight) instead of exact current time
- **Dashboard greeting** — Shows the active profile's nickname instead of the Google account name
- **AI severity scale** — System prompt now includes the full 1–5 scale definition
- **Dose time format** — Taken-at time displayed in 12-hour format ("2:13 PM")
- **Vital log defaults** — Pre-filled with clinically typical values (BP: 120/80, HR: 72, Temp: 36.6, etc.)
- **Activity filter pill** — Changed to solid `teal-600` + white text for WCAG AA compliance at small size
- **Report button touch targets** — ↺ and 🗑 buttons meet the 44×44 px minimum touch target
- **Node.js** — CI and local dev target Node.js 24 (up from 20)

### Fixed

- **Profile data isolation** — Switching profiles now correctly re-scopes all API reads (root cause: `api.ts` read from unscoped `activePerson` key while `PersonContext` wrote to a scoped `activePerson__u:email` key)
- **More sheet stays open after navigation** — Uses render-time derived state reset instead of a `useEffect`, avoiding the "setState during render" warning
- **Appointments calendar crash** — `WeekView` and `MonthView` now declare their own `const now` rather than relying on the outer-scope variable removed during refactor
- **TypeScript build error in vitals page** — `VITAL_DEFAULTS[type] || {}` resolved with an explicit cast
- **CI dependency-review failure** — Removed `.github/workflows/dependency-review.yml` (requires GitHub Advanced Security, unavailable on this repo)
- **Dependabot PRs** — Merged all 7 open PRs (Next.js 14.2.35, eslint-config-next, groq-sdk, GitHub Actions v6)

---

## [1.1.0] — 2026-06-05

### Added

- **Data export / import** — Export all data for all people as a single JSON backup file; import from a previous backup to restore everything; backup never uploaded anywhere
- **Per-account data scoping** — Each Google account's people list and active-person pointer are namespaced by user email in localStorage; existing data migrated automatically on first login
- **7-day backup reminder** — Persistent, dismissible banner after 7 days of first use prompting a data export
- **Dashboard passive data overlays** — Medication adherence % on the Medications card; 7-day symptom severity sparkline on the Symptoms card; "Vitals needing attention" banner for Watch/High readings
- **Vitals page hierarchy** — Blood Pressure and Blood Glucose pinned as larger featured cards; SpO₂ and Respiratory Rate in a collapsible "Additional readings" section
- **Vital card left-border accent** — Green/amber/red border matching Normal/Watch/High status when a reading exists
- **Calibrated symptom severity anchors** — Live colour chip on the 1–5 slider: 1 = Barely noticeable → 5 = Emergency-level
- **Dynamic Health Assistant prompts** — Suggested chips generated from actual patient data instead of static generic questions
- **Records page 25/75 layout** — Narrower left panel; wider right panel with improved empty state
- **Mobile bottom nav with More overflow** — Primary nav: Home, Meds, Symptoms, Ask AI, More
- **Top bar shows active person** — Avatar and nickname on every page
- **Clear activity log** — "Clear" button wipes the log without navigating away
- **Export data / Import backup in sidebar** — One-click access for desktop users
- **ICS inline help** — Calendar import instructions appear inline on the Medications page

### Changed

- Renamed **"Records & Chat"** → **"Reports"** throughout the app
- Dashboard stat cards use a single neutral colour; Symptoms card turns orange (severity ≥ 4) or red (severity 5)
- Medications "Clear all" moved to a three-dot overflow menu with a named confirmation dialog
- Section label casing standardised to `uppercase tracking-wide text-xs` throughout

### Fixed

- Two empty states stacking on the Appointments page
- No mobile navigation on inner pages — bottom nav now rendered globally via the app shell

---

## [1.0.0] — 2026-06-04

First public stable release.

### Added

- **Multi-person profiles** — Multiple family members with isolated data and colour-coded avatars
- **Medical report upload** — PDF or TXT, plain-English AI summary, never stored
- **AI health chat** — Conversational questions about any uploaded report
- **Auto-extraction from reports** — Medications, appointments, symptoms, vitals, dietary notes, and patient profile extracted with a confirmation panel
- **Medications tracker** — Daily, weekly, and monthly schedules; one-tap logging; course duration with auto-removal; Indian prescription notation
- **Medication `.ics` reminders** — Recurring calendar events with VALARM alerts
- **Vitals tracking** — Basic Info with BMI, At-Home Readings, and Lab Results; sparkline trends; Normal/Watch/High badges; auto-filled from reports
- **Appointments** — Upcoming and past; AI follow-up suggestions; `.ics` export
- **Symptoms log** — 1–5 severity with AI pattern analysis
- **Notes page** — Dietary and Other sections; auto-populated from reports
- **Activity history** — Full add/delete log with filter toggle
- **Web Notifications** — Opt-in medication and symptom reminders
- **PWA support** — Service worker and Web App Manifest
- **Dark mode** — Persisted, flash-free via blocking inline script
- **Privacy-first design** — All data in localStorage; patient name never sent to AI

### Fixed

- PDF upload failing with a misleading "only TXT" error — replaced `pdf-parse` with `unpdf`
- Vitals and health profile not saved after report upload
- Duplicate dietary entries after report upload
- `.ics` export producing invalid events when generated near midnight
- Medication reminders set to midnight incorrectly parsed as `00:00`
- Vitals history crashing when a stored entry contains a type no longer in current definitions
- Health assistant rendering markdown tables as raw pipe characters
- Follow-up appointment date calculated from today instead of the original appointment date
- Patient nickname being sent to Groq — replaced with `[anonymous]`

---

## Prior development history

Internal versions (not publicly released):

| Version | Highlights |
|---|---|
| **2.2.0** | Vitals tracking, sparklines, status badges, medication course duration, `.ics` reminders |
| **2.1.0** | Activity history, Web Notifications, PWA, `.ics` appointment export, SECURITY.md |
| **2.0.0** | Multi-person profiles, dark mode, Notes page, localStorage-only data model |
| **1.3.0** | Auto-extraction with confirmation panel |
| **1.2.0** | AI follow-up suggestions, markdown rendering in chat |
| **1.1.0** | Google OAuth, Supabase, symptom log with AI analysis |
| **1.0.0-dev** | Hackathon prototype: dashboard, report upload, medications, appointments |
