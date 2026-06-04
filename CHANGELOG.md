# Changelog

All notable changes to CareCompanion are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
