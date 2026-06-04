import type { Appointment, Medication } from "./storage";

// ─── Medication reminder .ics ─────────────────────────────────────────────────

const REMINDER_TIME_MAP: Record<string, { h: number; m: number }> = {
  Morning:   { h: 8,  m: 0 },
  Afternoon: { h: 13, m: 0 },
  Evening:   { h: 18, m: 0 },
  Night:     { h: 21, m: 0 },
};

const DAY_BYDAY: Record<string, string> = {
  Sunday: "SU", Monday: "MO", Tuesday: "TU", Wednesday: "WE",
  Thursday: "TH", Friday: "FR", Saturday: "SA",
};

function addMinutes(h: number, m: number, mins: number): { h: number; m: number } {
  const total = h * 60 + m + mins;
  return { h: Math.floor(total / 60) % 24, m: total % 60 };
}

// Floating local time — no Z suffix so calendar uses the device timezone
function floatingDate(h: number, m: number): string {
  const d = new Date();
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

function medTimeToVEvent(med: Medication, timeEntry: string, uid: string): string | null {
  const parts = timeEntry.trim().split(" ");
  let h: number, m: number, rrule: string;

  if (parts.length === 2) {
    // Weekly slot: "Monday Morning"
    const [dayName, timeOfDay] = parts;
    const slot = REMINDER_TIME_MAP[timeOfDay];
    const byDay = DAY_BYDAY[dayName];
    if (!slot || !byDay) return null;
    h = slot.h; m = slot.m;
    rrule = `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`;
  } else {
    // Daily slot: "Morning", "Evening" etc.
    const slot = REMINDER_TIME_MAP[timeEntry];
    if (!slot) return null;
    h = slot.h; m = slot.m;
    rrule = "RRULE:FREQ=DAILY";
  }

  const end = addMinutes(h, m, 10);
  const now = toICSDateTime(new Date().toISOString());
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
    `DTSTART:${floatingDate(h, m)}`,
    `DTEND:${floatingDate(end.h, end.m)}`,
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

export function buildMedRemindersICS(medications: Medication[]): string {
  const events: string[] = [];
  medications.forEach((med) => {
    med.times.forEach((timeEntry, i) => {
      const event = medTimeToVEvent(med, timeEntry, `${med.id}_${i}`);
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

export function downloadMedRemindersICS(medications: Medication[]): void {
  const content = buildMedRemindersICS(medications);
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
