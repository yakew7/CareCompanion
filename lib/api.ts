import type { Medication, Symptom, Appointment, MedicalRecord, UserProfile, ActivityEntry } from "@/lib/storage";

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

function post(url: string, body: unknown) {
  return req(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const api = {
  profile: {
    get: () => req<UserProfile | null>("/api/db/profile"),
    save: (p: UserProfile) => post("/api/db/profile", p),
    clear: () => req("/api/db/profile", { method: "DELETE" }),
  },
  medications: {
    getAll: () => req<Medication[]>("/api/db/medications"),
    save: (m: Medication) => post("/api/db/medications", m),
    delete: (id: string) => req(`/api/db/medications/${id}`, { method: "DELETE" }),
  },
  symptoms: {
    getAll: () => req<Symptom[]>("/api/db/symptoms"),
    save: (s: Symptom) => post("/api/db/symptoms", s),
    delete: (id: string) => req(`/api/db/symptoms/${id}`, { method: "DELETE" }),
  },
  appointments: {
    getAll: () => req<Appointment[]>("/api/db/appointments"),
    save: (a: Appointment) => post("/api/db/appointments", a),
    delete: (id: string) => req(`/api/db/appointments/${id}`, { method: "DELETE" }),
  },
  records: {
    getAll: () => req<MedicalRecord[]>("/api/db/records"),
    save: (r: MedicalRecord) => post("/api/db/records", r),
    delete: (id: string) => req(`/api/db/records/${id}`, { method: "DELETE" }),
  },
  activity: {
    getAll: () => req<ActivityEntry[]>("/api/db/activity"),
    push: (entry: ActivityEntry) => post("/api/db/activity", entry),
  },
};
