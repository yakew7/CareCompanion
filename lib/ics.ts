import type { Appointment } from "./storage";

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
