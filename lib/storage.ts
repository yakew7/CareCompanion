export type PersonColor = "teal" | "purple" | "blue" | "orange" | "rose";

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
  log: Record<string, Record<string, boolean>>;
}

export interface Symptom {
  id: string;
  symptom: string;
  severity: number;
  notes: string;
  loggedAt: string;
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
}

export interface ActivityEntry {
  type: string;
  label: string;
  at: string;
}

// Kept for legacy API compatibility — no longer written to Supabase
export interface UserProfile {
  name: string;
  patientName: string;
  relation: string;
  createdAt: string;
}

export const PERSON_COLORS: PersonColor[] = ["teal", "purple", "blue", "orange", "rose"];

export function personColorClasses(color: PersonColor) {
  const map: Record<PersonColor, { bg: string; text: string; light: string; border: string; ring: string }> = {
    teal:   { bg: "bg-teal-500",   text: "text-teal-600",   light: "bg-teal-50 dark:bg-teal-900/30",   border: "border-teal-200 dark:border-teal-700",   ring: "ring-teal-400"   },
    purple: { bg: "bg-purple-500", text: "text-purple-600", light: "bg-purple-50 dark:bg-purple-900/30", border: "border-purple-200 dark:border-purple-700", ring: "ring-purple-400" },
    blue:   { bg: "bg-blue-500",   text: "text-blue-600",   light: "bg-blue-50 dark:bg-blue-900/30",   border: "border-blue-200 dark:border-blue-700",   ring: "ring-blue-400"   },
    orange: { bg: "bg-orange-500", text: "text-orange-600", light: "bg-orange-50 dark:bg-orange-900/30", border: "border-orange-200 dark:border-orange-700", ring: "ring-orange-400" },
    rose:   { bg: "bg-rose-500",   text: "text-rose-600",   light: "bg-rose-50 dark:bg-rose-900/30",   border: "border-rose-200 dark:border-rose-700",   ring: "ring-rose-400"   },
  };
  return map[color] || map.teal;
}

function getList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function setList<T>(key: string, data: T[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
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

const DATA_KEYS = ["medications", "symptoms", "appointments", "records", "activity"] as const;

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
      // Strip text before persisting — text is never written to storage
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      setList(pk("activity", personId), list.slice(0, 20));
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
};
