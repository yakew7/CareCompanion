// Returns current time in IST formatted for datetime-local inputs (YYYY-MM-DDTHH:MM)
export function nowIST(): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const istMs = utcMs + (5 * 60 + 30) * 60000;
  const ist = new Date(istMs);
  const y = ist.getFullYear();
  const mo = String(ist.getMonth() + 1).padStart(2, "0");
  const d = String(ist.getDate()).padStart(2, "0");
  const h = String(ist.getHours()).padStart(2, "0");
  const mi = String(ist.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

// Format an ISO timestamp for display in IST
export function formatIST(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Format date only in IST
export function formatDateIST(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
