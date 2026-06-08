// Returns the app timezone preference stored in localStorage (defaults to IST)
export function getAppTimezone(): string {
  if (typeof window === "undefined") return "Asia/Kolkata";
  return localStorage.getItem("cc_timezone") || "Asia/Kolkata";
}

// Returns tomorrow at 09:00 in the user's preferred timezone — default for new appointments so they land in "Upcoming" rather than "Past"
export function tomorrowMorningIST(): string {
  const tz = getAppTimezone();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(tomorrow);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T09:00`;
}

// Returns current time in user's preferred timezone formatted for datetime-local inputs (YYYY-MM-DDTHH:MM)
export function nowIST(): string {
  const tz = getAppTimezone();
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const h = g("hour") === "24" ? "00" : g("hour"); // normalize midnight
  return `${g("year")}-${g("month")}-${g("day")}T${h}:${g("minute")}`;
}

// Format an ISO timestamp for display in user's preferred timezone
export function formatIST(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: getAppTimezone(),
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Format date only in user's preferred timezone
export function formatDateIST(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: getAppTimezone(),
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
