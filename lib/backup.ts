// All localStorage keys that make up a full backup
const DATA_KEYS = ["medications", "symptoms", "appointments", "records", "activity", "dietary", "other", "vitals", "healthProfile"] as const;

export interface BackupFile {
  version: 1;
  exportedAt: string;
  persons: unknown[];
  activePerson: string;
  data: Record<string, unknown>;
}

export interface BackupPreview {
  isValid: boolean;
  error?: string;
  personsCount: number;
  recordsCount: number;
  backup?: BackupFile;
}

const VALID_DATA_KEY = /^(medications|symptoms|appointments|records|activity|dietary|other|vitals|healthProfile|customVitalRanges|notes)__[a-z0-9-]+$|^notificationSettings$/;

function validateSchema(data: unknown): string | null {
  if (!data || typeof data !== "object") return "Not a valid JSON object";
  const b = data as Record<string, unknown>;
  if (b.version !== 1) return `Unsupported backup version (got ${b.version})`;
  if (!Array.isArray(b.persons)) return "Missing persons list";
  if (typeof b.activePerson !== "string") return "Missing activePerson field";
  if (!b.data || typeof b.data !== "object" || Array.isArray(b.data)) return "Missing data object";
  for (const p of b.persons) {
    if (!p || typeof p !== "object") return "Person entry is not an object";
    const person = p as Record<string, unknown>;
    if (typeof person.id !== "string" || !person.id) return "Person missing id";
    if (typeof person.nickname !== "string" || !person.nickname) return "Person missing nickname";
  }
  for (const key of Object.keys(b.data as object)) {
    if (!VALID_DATA_KEY.test(key)) return `Unexpected data key: "${key}"`;
  }
  return null;
}

export function previewBackup(file: File): Promise<BackupPreview> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        const err = validateSchema(parsed);
        if (err) { resolve({ isValid: false, error: err, personsCount: 0, recordsCount: 0 }); return; }
        const backup = parsed as BackupFile;
        const recordsCount = Object.values(backup.data).reduce<number>(
          (sum, v) => sum + (Array.isArray(v) ? (v as unknown[]).length : 1), 0
        );
        resolve({ isValid: true, personsCount: backup.persons.length, recordsCount, backup });
      } catch {
        resolve({ isValid: false, error: "Could not parse backup file", personsCount: 0, recordsCount: 0 });
      }
    };
    reader.onerror = () => resolve({ isValid: false, error: "Could not read file", personsCount: 0, recordsCount: 0 });
    reader.readAsText(file);
  });
}

export function commitBackup(backup: BackupFile): { personsRestored: number } {
  // Snapshot current data so we can roll back if a write fails mid-import.
  const snapshot: Record<string, string | null> = {
    persons: localStorage.getItem("persons"),
    activePerson: localStorage.getItem("activePerson"),
  };
  for (const key of Object.keys(backup.data)) snapshot[key] = localStorage.getItem(key);

  try {
    localStorage.setItem("persons", JSON.stringify(backup.persons));
    localStorage.setItem("activePerson", backup.activePerson);
    for (const [key, value] of Object.entries(backup.data)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
    return { personsRestored: backup.persons.length };
  } catch (err) {
    for (const [key, val] of Object.entries(snapshot)) {
      if (val === null) localStorage.removeItem(key);
      else localStorage.setItem(key, val);
    }
    throw err;
  }
}

export function exportAllData(): void {
  if (typeof window === "undefined") return;

  const persons: unknown[] = JSON.parse(localStorage.getItem("persons") || "[]");
  const activePerson = localStorage.getItem("activePerson") || "";
  const data: Record<string, unknown> = {};

  // Capture all person-scoped keys
  for (const person of persons as Array<{ id: string }>) {
    for (const key of DATA_KEYS) {
      const storageKey = `${key}__${person.id}`;
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) data[storageKey] = JSON.parse(raw);
    }
  }

  // Capture global keys
  const notifRaw = localStorage.getItem("notificationSettings");
  if (notifRaw) data["notificationSettings"] = JSON.parse(notifRaw);

  const backup: BackupFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    persons,
    activePerson,
    data,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `carecompanion-backup-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importBackup(file: File): Promise<{ personsRestored: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backup = JSON.parse(e.target?.result as string) as BackupFile;
        if (backup.version !== 1) throw new Error("Unsupported backup version");

        localStorage.setItem("persons", JSON.stringify(backup.persons));
        localStorage.setItem("activePerson", backup.activePerson);

        for (const [key, value] of Object.entries(backup.data)) {
          localStorage.setItem(key, JSON.stringify(value));
        }

        resolve({ personsRestored: (backup.persons as unknown[]).length });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsText(file);
  });
}

// Track first use to drive the backup reminder
export function markFirstUseIfNeeded(): void {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem("cc_first_use")) {
    localStorage.setItem("cc_first_use", new Date().toISOString());
  }
}

export function daysSinceFirstUse(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem("cc_first_use");
  if (!raw) return 0;
  return Math.floor((Date.now() - new Date(raw).getTime()) / 86_400_000);
}

export function dismissBackupReminder(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("cc_backup_dismissed", new Date().toISOString());
}

export function isBackupReminderDismissed(): boolean {
  if (typeof window === "undefined") return true;
  return !!localStorage.getItem("cc_backup_dismissed");
}
