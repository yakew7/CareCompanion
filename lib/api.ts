import { storage } from "@/lib/storage";
import type { Medication, Symptom, Appointment, MedicalRecord, ActivityEntry, Note, VitalEntry, HealthProfile, CustomVitalRange, VitalType, JournalEntry } from "@/lib/storage";

// All data is stored in localStorage per-person. No Supabase writes for medical data.
function pid(): string {
  return storage.persons.getActiveId();
}

async function noop(): Promise<void> {}

export const api = {
  profile: {
    // Legacy — AuthGate now uses PersonContext directly
    get: async () => {
      const persons = storage.persons.getAll();
      return persons.length > 0 ? persons[0] : null;
    },
    save: noop,
    clear: noop,
  },
  medications: {
    getAll: async (): Promise<Medication[]> => storage.medications.getAll(pid()),
    save: async (m: Medication): Promise<void> => { storage.medications.save(m, pid()); },
    delete: async (id: string): Promise<void> => { storage.medications.delete(id, pid()); },
    clearAll: async (): Promise<void> => { storage.medications.clearAll(pid()); },
  },
  symptoms: {
    getAll: async (): Promise<Symptom[]> => storage.symptoms.getAll(pid()),
    save: async (s: Symptom): Promise<void> => { storage.symptoms.save(s, pid()); },
    delete: async (id: string): Promise<void> => { storage.symptoms.delete(id, pid()); },
    clearAll: async (): Promise<void> => { storage.symptoms.clearAll(pid()); },
  },
  appointments: {
    getAll: async (): Promise<Appointment[]> => storage.appointments.getAll(pid()),
    save: async (a: Appointment): Promise<void> => { storage.appointments.save(a, pid()); },
    delete: async (id: string): Promise<void> => { storage.appointments.delete(id, pid()); },
    clearAll: async (): Promise<void> => { storage.appointments.clearAll(pid()); },
  },
  records: {
    getAll: async (): Promise<MedicalRecord[]> => storage.records.getAll(pid()),
    save: async (r: MedicalRecord): Promise<void> => { storage.records.save(r, pid()); },
    delete: async (id: string): Promise<void> => { storage.records.delete(id, pid()); },
    clearAll: async (): Promise<void> => { storage.records.clearAll(pid()); },
  },
  activity: {
    getAll: async (): Promise<ActivityEntry[]> => storage.activity.getAll(pid()),
    push: async (entry: ActivityEntry): Promise<void> => { storage.activity.push(entry, pid()); },
    clearAll: async (): Promise<void> => { storage.activity.clearAll(pid()); },
  },
  dietary: {
    getAll: async (): Promise<Note[]> => storage.dietary.getAll(pid()),
    save: async (n: Note): Promise<void> => { storage.dietary.save(n, pid()); },
    delete: async (id: string): Promise<void> => { storage.dietary.delete(id, pid()); },
    clearAll: async (): Promise<void> => { storage.dietary.clearAll(pid()); },
  },
  other: {
    getAll: async (): Promise<Note[]> => storage.other.getAll(pid()),
    save: async (n: Note): Promise<void> => { storage.other.save(n, pid()); },
    delete: async (id: string): Promise<void> => { storage.other.delete(id, pid()); },
    clearAll: async (): Promise<void> => { storage.other.clearAll(pid()); },
  },
  vitals: {
    getAll: async (): Promise<VitalEntry[]> => storage.vitals.getAll(pid()),
    save: async (v: VitalEntry): Promise<void> => { storage.vitals.save(v, pid()); },
    delete: async (id: string): Promise<void> => { storage.vitals.delete(id, pid()); },
    clearAll: async (): Promise<void> => { storage.vitals.clearAll(pid()); },
  },
  healthProfile: {
    get: async (): Promise<HealthProfile> => storage.healthProfile.get(pid()),
    set: async (p: HealthProfile): Promise<void> => { storage.healthProfile.set(p, pid()); },
  },
  customVitalRanges: {
    get: async (): Promise<Partial<Record<VitalType, CustomVitalRange>>> => storage.customVitalRanges.get(pid()),
    set: async (ranges: Partial<Record<VitalType, CustomVitalRange>>): Promise<void> => { storage.customVitalRanges.set(ranges, pid()); },
  },
  journal: {
    getAll: async (): Promise<JournalEntry[]> => storage.journal.getAll(pid()),
    save: async (e: JournalEntry): Promise<void> => { storage.journal.save(e, pid()); },
    delete: async (id: string): Promise<void> => { storage.journal.delete(id, pid()); },
    clearAll: async (): Promise<void> => { storage.journal.clearAll(pid()); },
  },
};
