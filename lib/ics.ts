import type { Appointment, Medication } from "./storage";

// ─── Medication reminder .ics ─────────────────────────────────────────────────

const DEFAULT_REMINDER_TIMES: Record<string, string> = {
  Morning: "08:00", Afternoon: "13:00", Evening: "18:00", Night: "21:00",
};

function parseHHMM(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(":").map(Number);
  return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
}

const DAY_BYDAY: Record<string, string> = {
  Sunday: "SU", Monday: "MO", Tuesday: "TU", Wednesday: "WE",
  Thursday: "TH", Friday: "FR", Saturday: "SA",
};

function addMinutes(h: number, m: number, mins: number): { h: number; m: number } {
  const total = h * 60 + m + mins;
  return { h: Math.floor(total / 60) % 24, m: total % 60 };
}

// Floating local time — no Z suffix so calendar uses the device timezone
function floatingDate(h: number, m: number, d = new Date()): string {
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "T" +
    pad(h) +
    pad(m) +
    "00"
  );
}

function medTimeToVEvent(med: Medication, timeEntry: string, uid: string, customTimes: Record<string, string>): string | null {
  const parts = timeEntry.trim().split(" ");
  let h: number, m: number, rrule: string;

  if (parts.length === 2) {
    // Weekly slot: "Monday Morning"
    const [dayName, timeOfDay] = parts;
    const byDay = DAY_BYDAY[dayName];
    const raw = customTimes[timeOfDay] ?? DEFAULT_REMINDER_TIMES[timeOfDay];
    if (!byDay || !raw) return null;
    ({ h, m } = parseHHMM(raw));
    rrule = `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`;
  } else {
    // Daily slot: "Morning", "Evening" etc.
    const raw = customTimes[timeEntry] ?? DEFAULT_REMINDER_TIMES[timeEntry];
    if (!raw) return null;
    ({ h, m } = parseHHMM(raw));
    rrule = "RRULE:FREQ=DAILY";
  }

  const end = addMinutes(h, m, 10);
  const today = new Date();
  const now = toICSDateTime(today.toISOString());
  const label = `${med.name}${med.dosage ? ` (${med.dosage})` : ""}`;
  const descParts = [
    `Medication: ${med.name}`,
    med.dosage   && `Dosage: ${med.dosage}`,
    med.frequency && `Frequency: ${med.frequency}`,
    med.notes    && `Notes: ${med.notes}`,
  ].filter(Boolean) as string[];

  return [
    "BEGIN:VEVENT",
    `UID:${uid}@carecompanion`,
    `DTSTAMP:${now}`,
    `DTSTART:${floatingDate(h, m, today)}`,
    `DTEND:${floatingDate(end.h, end.m, today)}`,
    rrule,
    `SUMMARY:${icsEscape(`Take ${label}`)}`,
    `DESCRIPTION:${icsEscape(descParts.join("\\n"))}`,
    "BEGIN:VALARM",
    "TRIGGER:PT0S",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(`Time to take ${label}`)}`,
    "END:VALARM",
    "END:VEVENT",
  ].join("\r\n");
}

export function buildMedRemindersICS(medications: Medication[], customTimes: Record<string, string> = {}): string {
  const times = { ...DEFAULT_REMINDER_TIMES, ...customTimes };
  const events: string[] = [];
  medications.forEach((med) => {
    med.times.forEach((timeEntry, i) => {
      const event = medTimeToVEvent(med, timeEntry, `${med.id}_${i}`, times);
      if (event) events.push(event);
    });
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CareCompanion//Medication Reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadMedRemindersICS(medications: Medication[], customTimes: Record<string, string> = {}): void {
  const content = buildMedRemindersICS(medications, customTimes);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "medication_reminders.ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Appointment .ics ─────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toICSDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function icsEscape(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function appointmentToVEvent(appt: Appointment): string {
  const dtStart = toICSDateTime(appt.datetime);
  const dtEnd = toICSDateTime(
    new Date(new Date(appt.datetime).getTime() + 60 * 60 * 1000).toISOString()
  );
  const now = toICSDateTime(new Date().toISOString());
  const summary = appt.specialty
    ? `${appt.doctor} — ${appt.specialty}`
    : appt.doctor;

  const descParts: string[] = [];
  if (appt.specialty) descParts.push(`Specialty: ${appt.specialty}`);
  if (appt.notes) descParts.push(appt.notes);
  if (appt.postVisitNotes) descParts.push(`Visit notes: ${appt.postVisitNotes}`);

  const lines = [
    "BEGIN:VEVENT",
    `UID:${appt.id}@carecompanion`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${icsEscape(summary)}`,
  ];
  if (appt.location) lines.push(`LOCATION:${icsEscape(appt.location)}`);
  if (descParts.length) lines.push(`DESCRIPTION:${icsEscape(descParts.join("\n"))}`);
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

export function buildICS(appointments: Appointment[]): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CareCompanion//Health Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...appointments.map(appointmentToVEvent),
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadICS(appointments: Appointment[], filename = "appointments.ics"): void {
  const content = buildICS(appointments);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
