export type PersonColor = string; // preset name or hex value

export interface Person {
  id: string;
  nickname: string;
  color: PersonColor;
}

export interface MedicalRecord {
  id: string;
  name: string;
  text: string; // client memory only — never written to storage
  summary: string;
  dietary: string;
  other: string;
  uploadedAt: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  times: string[];
  notes: string;
  log: Record<string, Record<string, boolean | string>>; // string = "HH:MM" actual take time
  expiresAt?: string; // ISO date — auto-deleted after this date
  createdAt?: string; // ISO date — first day to track adherence from
  pillCount?: number;     // current pill inventory count; decremented on each dose log
}

export interface Symptom {
  id: string;
  symptom: string;
  severity: number;
  notes: string;
  loggedAt: string;
  linkedMedication?: string;
  ongoing?: boolean;       // true = still happening, not yet resolved
  resolvedAt?: string;     // ISO string — when it was marked resolved
}

export interface Appointment {
  id: string;
  doctor: string;
  specialty: string;
  datetime: string;
  location: string;
  notes: string;
  status: "upcoming" | "completed" | "cancelled";
  postVisitNotes: string;
  reminderHours?: number; // hours before appointment to fire a notification
  // Structured post-visit fields (P2)
  visitDoctorSaid?: string;
  visitMedsChanged?: string;
  visitActionItems?: string;
}

export interface ActivityEntry {
  type: string;
  label: string;
  at: string;
  deleted?: boolean;
}

export interface Note {
  id: string;
  content: string;
  source: string; // "manual" or the report file name
  createdAt: string;
  tags?: string[]; // free-form tags, e.g. ["cardiologist", "diet"]
}

export interface NotificationSettings {
  enabled: boolean;
  medicationReminders: boolean;
  symptomReminder: boolean;
  symptomReminderTime: string; // "HH:MM" 24h
  reminderTimes: {
    Morning: string;
    Afternoon: string;
    Evening: string;
    Night: string;
  };
}

// Kept for legacy API compatibility
export interface UserProfile {
  name: string;
  patientName: string;
  relation: string;
  createdAt: string;
}

// ─── Colour system ────────────────────────────────────────────────────────────

interface PresetColor { id: string; hex: string; label: string; }

export const PRESET_COLORS: PresetColor[] = [
  { id: "teal",    hex: "#0D9488", label: "Teal"    },
  { id: "purple",  hex: "#7C3AED", label: "Purple"  },
  { id: "blue",    hex: "#2563EB", label: "Blue"    },
  { id: "orange",  hex: "#EA580C", label: "Orange"  },
  { id: "rose",    hex: "#E11D48", label: "Rose"    },
  { id: "emerald", hex: "#059669", label: "Emerald" },
  { id: "amber",   hex: "#D97706", label: "Amber"   },
];

// Extra pool used once all 7 presets are taken (all on-theme, look good in dark mode)
const EXTRA_COLOR_POOL: string[] = [
  "#0891B2", // cyan
  "#4F46E5", // indigo
  "#DB2777", // pink
  "#65A30D", // lime
  "#0284C7", // sky
  "#A21CAF", // fuchsia
  "#6D28D9", // violet
  "#B45309", // warm gold
  "#15803D", // forest green
  "#B91C1C", // deep red
  "#0E7490", // dark cyan
  "#9333EA", // grape
];

// All preset color IDs, used in pickers
export const PERSON_COLORS: PersonColor[] = PRESET_COLORS.map((c) => c.id);

/** Resolve a color name or hex string to a CSS hex value */
export function personColorHex(color: PersonColor): string {
  return PRESET_COLORS.find((c) => c.id === color)?.hex ?? color;
}

/** Suggest a default color for the next new person */
export function getNextPersonColor(existingColors: PersonColor[]): PersonColor {
  // Try presets first in order
  for (const preset of PERSON_COLORS) {
    if (!existingColors.includes(preset)) return preset;
  }
  // All presets used — cycle through extra pool
  for (const hex of EXTRA_COLOR_POOL) {
    if (!existingColors.includes(hex)) return hex;
  }
  // Fully exhausted — pick a random extra
  return EXTRA_COLOR_POOL[Math.floor(Math.random() * EXTRA_COLOR_POOL.length)];
}

// ─── Storage helpers ─────────────────────────────────────────────────────────

// Tracks the last-read serialised value per key so we can detect concurrent writes
// from another tab that occurred between our read and write.
const lastSeen = new Map<string, string>();

function getList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key) || "[]";
    lastSeen.set(key, raw);
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function setList<T>(key: string, data: T[]): void {
  if (typeof window === "undefined") return;

  // If the current storage value differs from what we last read, another tab
  // wrote to this key in the meantime — the user's change will overwrite it.
  const current = localStorage.getItem(key);
  const seen = lastSeen.get(key);
  if (seen !== undefined && current !== null && current !== seen) {
    window.dispatchEvent(new CustomEvent("cc:writeconflict", { detail: { key } }));
  }

  const serialised = JSON.stringify(data);
  try {
    localStorage.setItem(key, serialised);
    lastSeen.set(key, serialised);
  } catch (err) {
    if (err instanceof DOMException && (err.name === "QuotaExceededError" || err.code === 22)) {
      window.dispatchEvent(new CustomEvent("cc:quotaexceeded"));
      // Don't re-throw — the dispatched event surfaces a toast; a thrown error
      // would otherwise go unhandled in components that don't wrap saves.
    }
  }
}

function upsert<T extends { id: string }>(key: string, item: T, prepend = false): void {
  const list = getList<T>(key);
  const idx = list.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    list[idx] = item;
  } else if (prepend) {
    list.unshift(item);
  } else {
    list.push(item);
  }
  setList(key, list);
}

function pk(base: string, personId: string) {
  return `${base}__${personId}`;
}

export type VitalType =
  | "bp" | "glucose" | "weight" | "heart_rate" | "spo2" | "temperature" | "respiratory_rate" | "pain"
  | "hba1c" | "cholesterol" | "hemoglobin" | "creatinine"
  | "alt" | "ast" | "alp" | "bilirubin" | "albumin"
  | "tsh" | "t3" | "t4"
  | "wbc" | "rbc" | "platelets"
  | "bun" | "uric_acid" | "egfr"
  | "sodium" | "potassium" | "calcium"
  | "serum_iron" | "ferritin";

export interface HealthProfile {
  age?: number;
  heightCm?: number;
  gender?: "male" | "female" | "other";
  bloodType?: string;
}

export interface CustomVitalRange {
  low?: number;
  high?: number;
  low2?: number;  // second value (diastolic for BP)
  high2?: number;
}

export interface VitalEntry {
  id: string;
  type: VitalType;
  value: number;
  value2?: number; // diastolic for BP
  unit: string;
  notes: string;
  loggedAt: string;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relation: string;
}

export interface EmergencyInfo {
  bloodType?: string;
  allergies: string[];
  emergencyContacts: EmergencyContact[];
  primaryDoctor?: string;
  primaryDoctorPhone?: string;
  notes?: string;
}

export interface JournalEntry {
  id: string;
  content: string;
  mood?: "good" | "neutral" | "tough"; // optional daily mood marker
  loggedAt: string; // ISO string
}

const DATA_KEYS = ["medications", "symptoms", "appointments", "records", "activity", "dietary", "other", "vitals", "healthProfile", "emergencyInfo", "journal"] as const;

// Returns a persons accessor scoped to a specific user key (e.g. their email).
// All per-person data keys (medications__<id>, etc.) are already scoped by person UUID,
// so only the persons list and activePerson pointer need user-level scoping.
export function scopedPersons(userKey: string) {
  const listKey   = userKey ? `persons__u:${userKey}` : "persons";
  const activeKey = userKey ? `activePerson__u:${userKey}` : "activePerson";

  // One-time migration: copy legacy unscoped data into this user's namespace
  if (typeof window !== "undefined" && userKey) {
    if (!localStorage.getItem(listKey) && localStorage.getItem("persons")) {
      localStorage.setItem(listKey, localStorage.getItem("persons")!);
      const legacyActive = localStorage.getItem("activePerson");
      if (legacyActive) localStorage.setItem(activeKey, legacyActive);
    }
  }

  return {
    getAll: (): Person[] => getList<Person>(listKey),
    save: (p: Person) => upsert(listKey, p),
    delete: (id: string) => {
      setList(listKey, getList<Person>(listKey).filter((p) => p.id !== id));
      if (typeof window !== "undefined") {
        DATA_KEYS.forEach((k) => localStorage.removeItem(pk(k, id)));
      }
    },
    getActiveId: (): string => {
      if (typeof window === "undefined") return "";
      return localStorage.getItem(activeKey) || "";
    },
    setActiveId: (id: string): void => {
      if (typeof window === "undefined") return;
      localStorage.setItem(activeKey, id);
    },
  };
}

export const storage = {
  persons: {
    getAll: (): Person[] => getList<Person>("persons"),
    save: (p: Person) => upsert("persons", p),
    delete: (id: string) => {
      setList("persons", getList<Person>("persons").filter((p) => p.id !== id));
      if (typeof window !== "undefined") {
        DATA_KEYS.forEach((k) => localStorage.removeItem(pk(k, id)));
      }
    },
    getActiveId: (): string => {
      if (typeof window === "undefined") return "";
      return localStorage.getItem("activePerson") || "";
    },
    setActiveId: (id: string): void => {
      if (typeof window === "undefined") return;
      localStorage.setItem("activePerson", id);
    },
  },
  records: {
    getAll: (personId: string) => getList<MedicalRecord>(pk("records", personId)),
    save: (r: MedicalRecord, personId: string) => {
      const { text: _t, ...rest } = r;
      upsert(pk("records", personId), { ...rest, text: "" } as MedicalRecord, true);
    },
    delete: (id: string, personId: string) =>
      setList(pk("records", personId), getList<MedicalRecord>(pk("records", personId)).filter((r) => r.id !== id)),
    clearAll: (personId: string) => setList(pk("records", personId), []),
  },
  medications: {
    getAll: (personId: string) => getList<Medication>(pk("medications", personId)),
    save: (m: Medication, personId: string) => upsert(pk("medications", personId), m),
    delete: (id: string, personId: string) =>
      setList(pk("medications", personId), getList<Medication>(pk("medications", personId)).filter((m) => m.id !== id)),
    clearAll: (personId: string) => setList(pk("medications", personId), []),
  },
  symptoms: {
    getAll: (personId: string) => getList<Symptom>(pk("symptoms", personId)),
    save: (s: Symptom, personId: string) => upsert(pk("symptoms", personId), s, true),
    delete: (id: string, personId: string) =>
      setList(pk("symptoms", personId), getList<Symptom>(pk("symptoms", personId)).filter((s) => s.id !== id)),
    clearAll: (personId: string) => setList(pk("symptoms", personId), []),
  },
  appointments: {
    getAll: (personId: string) => getList<Appointment>(pk("appointments", personId)),
    save: (a: Appointment, personId: string) => upsert(pk("appointments", personId), a),
    delete: (id: string, personId: string) =>
      setList(pk("appointments", personId), getList<Appointment>(pk("appointments", personId)).filter((a) => a.id !== id)),
    clearAll: (personId: string) => setList(pk("appointments", personId), []),
  },
  activity: {
    getAll: (personId: string) => getList<ActivityEntry>(pk("activity", personId)),
    push: (entry: ActivityEntry, personId: string) => {
      const list = getList<ActivityEntry>(pk("activity", personId));
      list.unshift(entry);
      setList(pk("activity", personId), list.slice(0, 50));
    },
    clearAll: (personId: string) => setList(pk("activity", personId), []),
  },
  dietary: {
    getAll: (personId: string) => getList<Note>(pk("dietary", personId)),
    save: (n: Note, personId: string) => upsert(pk("dietary", personId), n, true),
    delete: (id: string, personId: string) =>
      setList(pk("dietary", personId), getList<Note>(pk("dietary", personId)).filter((n) => n.id !== id)),
    clearAll: (personId: string) => setList(pk("dietary", personId), []),
  },
  other: {
    getAll: (personId: string) => getList<Note>(pk("other", personId)),
    save: (n: Note, personId: string) => upsert(pk("other", personId), n, true),
    delete: (id: string, personId: string) =>
      setList(pk("other", personId), getList<Note>(pk("other", personId)).filter((n) => n.id !== id)),
    clearAll: (personId: string) => setList(pk("other", personId), []),
  },
  vitals: {
    getAll: (personId: string) => getList<VitalEntry>(pk("vitals", personId)),
    save: (v: VitalEntry, personId: string) => upsert(pk("vitals", personId), v, true),
    delete: (id: string, personId: string) =>
      setList(pk("vitals", personId), getList<VitalEntry>(pk("vitals", personId)).filter((v) => v.id !== id)),
    clearAll: (personId: string) => setList(pk("vitals", personId), []),
  },
  healthProfile: {
    get: (personId: string): HealthProfile => {
      if (typeof window === "undefined") return {};
      try { return JSON.parse(localStorage.getItem(pk("healthProfile", personId)) || "{}"); }
      catch { return {}; }
    },
    set: (profile: HealthProfile, personId: string): void => {
      if (typeof window === "undefined") return;
      localStorage.setItem(pk("healthProfile", personId), JSON.stringify(profile));
    },
  },
  notifications: {
    _default: (): NotificationSettings => ({
      enabled: false,
      medicationReminders: true,
      symptomReminder: false,
      symptomReminderTime: "20:00",
      reminderTimes: { Morning: "08:00", Afternoon: "13:00", Evening: "18:00", Night: "21:00" },
    }),
    get(): NotificationSettings {
      if (typeof window === "undefined") return this._default();
      try {
        const stored = JSON.parse(localStorage.getItem("notificationSettings") || "null");
        if (!stored) return this._default();
        const def = this._default();
        return { ...def, ...stored, reminderTimes: { ...def.reminderTimes, ...stored.reminderTimes } };
      } catch {
        return this._default();
      }
    },
    set(s: NotificationSettings): void {
      if (typeof window === "undefined") return;
      localStorage.setItem("notificationSettings", JSON.stringify(s));
    },
  },
  theme: {
    get: (): "light" | "dark" => {
      if (typeof window === "undefined") return "light";
      return (localStorage.getItem("theme") as "light" | "dark") || "light";
    },
    set: (t: "light" | "dark") => {
      if (typeof window === "undefined") return;
      localStorage.setItem("theme", t);
    },
  },
  timezone: {
    get: (): string => {
      if (typeof window === "undefined") return "Asia/Kolkata";
      return localStorage.getItem("cc_timezone") || "Asia/Kolkata";
    },
    set: (tz: string): void => {
      if (typeof window === "undefined") return;
      localStorage.setItem("cc_timezone", tz);
    },
  },
  customVitalRanges: {
    get: (personId: string): Partial<Record<VitalType, CustomVitalRange>> => {
      if (typeof window === "undefined") return {};
      try { return JSON.parse(localStorage.getItem(pk("customVitalRanges", personId)) || "{}"); }
      catch { return {}; }
    },
    set: (ranges: Partial<Record<VitalType, CustomVitalRange>>, personId: string): void => {
      if (typeof window === "undefined") return;
      localStorage.setItem(pk("customVitalRanges", personId), JSON.stringify(ranges));
    },
  },
  emergencyInfo: {
    get: (personId: string): EmergencyInfo => {
      if (typeof window === "undefined") return { allergies: [], emergencyContacts: [] };
      try { return JSON.parse(localStorage.getItem(pk("emergencyInfo", personId)) || "null") ?? { allergies: [], emergencyContacts: [] }; }
      catch { return { allergies: [], emergencyContacts: [] }; }
    },
    set: (info: EmergencyInfo, personId: string): void => {
      if (typeof window === "undefined") return;
      localStorage.setItem(pk("emergencyInfo", personId), JSON.stringify(info));
    },
  },
  journal: {
    getAll: (personId: string): JournalEntry[] => getList<JournalEntry>(pk("journal", personId)),
    save: (e: JournalEntry, personId: string): void => { upsert(pk("journal", personId), e, true); },
    delete: (id: string, personId: string): void => {
      setList(pk("journal", personId), getList<JournalEntry>(pk("journal", personId)).filter((e) => e.id !== id));
    },
    clearAll: (personId: string): void => { setList(pk("journal", personId), []); },
  },
};
