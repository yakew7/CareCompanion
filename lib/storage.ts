export interface UserProfile {
  name: string;
  patientName: string;
  relation: string;
  createdAt: string;
}

export interface MedicalRecord {
  id: string;
  name: string;
  text: string;
  summary: string;
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

export const storage = {
  records: {
    getAll: () => getList<MedicalRecord>("records"),
    save: (r: MedicalRecord) => upsert("records", r, true),
    delete: (id: string) =>
      setList("records", getList<MedicalRecord>("records").filter((r) => r.id !== id)),
  },
  medications: {
    getAll: () => getList<Medication>("medications"),
    save: (m: Medication) => upsert("medications", m),
    delete: (id: string) =>
      setList("medications", getList<Medication>("medications").filter((m) => m.id !== id)),
  },
  symptoms: {
    getAll: () => getList<Symptom>("symptoms"),
    save: (s: Symptom) => upsert("symptoms", s, true),
    delete: (id: string) =>
      setList("symptoms", getList<Symptom>("symptoms").filter((s) => s.id !== id)),
  },
  appointments: {
    getAll: () => getList<Appointment>("appointments"),
    save: (a: Appointment) => upsert("appointments", a),
    delete: (id: string) =>
      setList("appointments", getList<Appointment>("appointments").filter((a) => a.id !== id)),
  },
  activity: {
    getAll: () => getList<ActivityEntry>("activity"),
    push: (entry: ActivityEntry) => {
      const list = getList<ActivityEntry>("activity");
      list.unshift(entry);
      setList("activity", list.slice(0, 20));
    },
  },
  profile: {
    get: (): UserProfile | null => {
      if (typeof window === "undefined") return null;
      try {
        const raw = localStorage.getItem("userProfile");
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    save: (p: UserProfile) => {
      if (typeof window === "undefined") return;
      localStorage.setItem("userProfile", JSON.stringify(p));
    },
    clear: () => {
      if (typeof window === "undefined") return;
      localStorage.removeItem("userProfile");
    },
  },
};
