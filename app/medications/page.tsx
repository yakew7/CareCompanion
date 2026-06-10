"use client";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import { Pencil, Trash2, CheckSquare, Square, Download, MoreVertical, AlertTriangle, Search, Calendar, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import TopBar from "@/components/TopBar";
import IOSPushBanner from "@/components/IOSPushBanner";
import { api } from "@/lib/api";
import { usePersonContext } from "@/contexts/PersonContext";
import type { Medication, Symptom } from "@/lib/storage";
import { downloadMedRemindersICS } from "@/lib/ics";
import { useDialog } from "@/lib/useDialog";
import { storage } from "@/lib/storage";

const TIMES = ["Morning", "Afternoon", "Evening", "Night"];

function format12h(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL: Record<string, string> = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
  Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};

const FREQUENCIES = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "As needed",
  "Once weekly",
  "Twice weekly",
  "Three times weekly",
  "Once monthly",
];

function isWeekly(freq: string) {
  return freq.toLowerCase().includes("weekly");
}
function isMonthly(freq: string) {
  return freq.toLowerCase().includes("monthly");
}

/** Returns true if a dose was logged outside the expected time window for its slot. */
function isLateDose(slot: string, takenAtHHMM: string): boolean {
  const hour = parseInt(takenAtHHMM.split(":")[0], 10);
  if (isNaN(hour)) return false;
  switch (slot.toLowerCase()) {
    case "morning":   return hour >= 12; // after noon
    case "afternoon": return hour >= 17; // after 5 PM
    case "evening":   return hour >= 22; // after 10 PM
    default:          return false;       // Night: no late window
  }
}

const emptyForm = () => ({
  name: "", dosage: "", frequency: "Once daily",
  times: ["Morning"] as string[],
  weeklyDays: [] as string[],
  weeklyTime: "Morning",
  notes: "",
  durationDays: "" as string,
  pillCount: "" as string,
});

// Feature 16: Swipe-to-delete wrapper for mobile
function SwipeCard({ onDelete, children }: { onDelete: () => void; children: React.ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    if (innerRef.current) innerRef.current.style.transition = "none";
  }
  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current;
    if (dx < -8 && innerRef.current) {
      innerRef.current.style.transform = `translateX(${Math.max(dx, -76)}px)`;
    }
  }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - startX.current;
    if (innerRef.current) {
      innerRef.current.style.transition = "transform 0.2s";
      innerRef.current.style.transform = "";
    }
    if (dx < -60) onDelete();
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="absolute inset-y-0 right-0 w-16 flex items-center justify-center bg-red-500">
        <Trash2 className="w-4 h-4 text-white" />
      </div>
      <div ref={innerRef} className="relative w-full" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {children}
      </div>
    </div>
  );
}

export default function MedicationsPage() {
  const { activePersonId, activePerson } = usePersonContext();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [showReminderExport, setShowReminderExport] = useState(false);
  const [exportTimes, setExportTimes] = useState(() => storage.notifications.get().reminderTimes);
  const [showOverflow, setShowOverflow] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [search, setSearch] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [calMonthOffset, setCalMonthOffset] = useState(0);
  const today = new Date().toISOString().split("T")[0];
  const medModalRef = useDialog(showModal, () => setShowModal(false));
  const clearConfirmRef = useDialog(showClearConfirm, () => setShowClearConfirm(false));
  // Feature 15: dose time editing — {medId, time, value}
  const [doseTimeEdit, setDoseTimeEdit] = useState<{ medId: string; time: string; value: string } | null>(null);
  const [allSymptoms, setAllSymptoms] = useState<Symptom[]>([]);

  useEffect(() => {
    if (!activePersonId) return;
    api.symptoms.getAll().then(setAllSymptoms);
  }, [activePersonId]);

  useEffect(() => {
    if (!activePersonId) return;
    setLoading(true);
    api.medications.getAll().then(async (data) => {
      const now = new Date();
      const expired = data.filter((m) => m.expiresAt && new Date(m.expiresAt) <= now);
      for (const med of expired) {
        await api.medications.delete(med.id);
        api.activity.push({ type: "medication", label: `Auto-removed: ${med.name} (course completed)`, at: new Date().toISOString(), deleted: true });
      }
      if (expired.length > 0) {
        toast(`${expired.length} medication${expired.length !== 1 ? "s" : ""} auto-removed after completing course`, { icon: "✅" });
      }
      setMeds(expired.length > 0 ? await api.medications.getAll() : data);
      setLoading(false);
    });
  }, [activePersonId]);

  function openAdd() { setShowOverflow(false); setEditing(null); setForm(emptyForm()); setShowModal(true); }

  function openEdit(med: Medication) {
    setShowOverflow(false);
    setEditing(med);
    // Detect weekly/monthly from stored times and reconstruct form state
    const weekly = isWeekly(med.frequency);
    const monthly = isMonthly(med.frequency);
    let weeklyDays: string[] = [];
    let weeklyTime = "Morning";
    let times = med.times;

    if (weekly && med.times.length > 0) {
      // times stored as "Monday Morning", "Friday Evening" etc.
      const parts = med.times[0].split(" ");
      weeklyTime = parts[parts.length - 1];
      weeklyDays = med.times.map((t) => {
        const dayFull = t.split(" ")[0];
        return Object.entries(DAY_FULL).find(([, v]) => v === dayFull)?.[0] || dayFull;
      });
      times = med.times;
    } else if (monthly) {
      weeklyTime = med.times[0] || "Morning";
    }

    const remainingDays = med.expiresAt
      ? Math.max(0, Math.ceil((new Date(med.expiresAt).getTime() - Date.now()) / 86400000))
      : 0;
    setForm({
      name: med.name, dosage: med.dosage, frequency: med.frequency,
      times, weeklyDays, weeklyTime, notes: med.notes,
      durationDays: remainingDays > 0 ? String(remainingDays) : "",
      pillCount: med.pillCount != null ? String(med.pillCount) : "",
    });
    setShowModal(true);
  }

  function buildTimes(): string[] {
    const freq = form.frequency;
    if (isWeekly(freq)) {
      if (form.weeklyDays.length === 0) return [];
      return form.weeklyDays.map((d) => `${DAY_FULL[d]} ${form.weeklyTime}`);
    }
    if (isMonthly(freq)) {
      return [form.weeklyTime];
    }
    return form.times;
  }

  async function save() {
    if (!form.name.trim()) { toast.error("Medication name is required"); return; }
    const times = buildTimes();
    if (!isWeekly(form.frequency) && !isMonthly(form.frequency) && times.length === 0) {
      toast.error("Select at least one time"); return;
    }
    if (isWeekly(form.frequency) && form.weeklyDays.length === 0) {
      toast.error("Select at least one day"); return;
    }
    const days = parseInt(form.durationDays);
    const expiresAt = form.durationDays !== "" && days > 0
      ? new Date(Date.now() + days * 86400000).toISOString()
      : form.durationDays === "" ? editing?.expiresAt : undefined;
    const med: Medication = { id: editing?.id || uuidv4(), name: form.name, dosage: form.dosage, frequency: form.frequency, times, notes: form.notes, log: editing?.log || {}, expiresAt, createdAt: editing?.createdAt || new Date().toISOString().split("T")[0], pillCount: form.pillCount !== "" && parseInt(form.pillCount) > 0 ? parseInt(form.pillCount) : editing?.pillCount };
    await api.medications.save(med);
    if (!editing) api.activity.push({ type: "medication", label: `Added medication: ${med.name}`, at: new Date().toISOString() });
    const refreshed = await api.medications.getAll();
    setMeds(refreshed);
    setShowModal(false);
    toast.success(editing ? "Medication updated" : "Medication added");

    // Interaction check for new medications only
    if (!editing && refreshed.length > 1) {
      const existingNames = refreshed
        .filter((m) => m.id !== med.id)
        .map((m) => `${m.name}${m.dosage ? ` ${m.dosage}` : ""}`);
      try {
        const res = await fetch("/api/check-interactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newMed: `${med.name}${med.dosage ? ` ${med.dosage}` : ""}`, existingMeds: existingNames }),
        });
        const data = await res.json() as { hasInteraction: boolean; message: string; checkFailed?: boolean };
        if (data.checkFailed) {
          toast("Interaction check unavailable right now — verify manually with your pharmacist.", { icon: "⚠️", duration: 8000 });
        } else if (data.hasInteraction && data.message) {
          toast.custom(
            (t) => (
              <div className={`flex items-start gap-3 bg-amber-50 border border-amber-200 dark:bg-amber-900/30 dark:border-amber-700 px-4 py-3 rounded-xl shadow-lg max-w-sm transition-all ${t.visible ? "opacity-100" : "opacity-0"}`}>
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Possible interaction flagged</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">{data.message}</p>
                  <p className="text-xs text-amber-500 dark:text-amber-400 mt-1">Check with your doctor or pharmacist.</p>
                </div>
                <button onClick={() => toast.dismiss(t.id)} className="text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 ml-1 flex-shrink-0 text-lg leading-none">×</button>
              </div>
            ),
            { duration: 12000 }
          );
        }
      } catch {
        toast("Interaction check unavailable right now — verify manually with your pharmacist.", { icon: "⚠️", duration: 8000 });
      }
    }
  }

  function deleteMed(id: string) {
    const med = meds.find((m) => m.id === id);
    if (!med) return;
    const prevMeds = [...meds];
    setMeds((prev) => prev.filter((m) => m.id !== id));
    let undone = false;
    const tid = `undo-med-${id}`;
    toast.custom(
      (t) => (
        <div className={`flex items-center gap-3 bg-gray-900 text-white pl-4 pr-3 py-3 rounded-xl shadow-lg max-w-xs transition-all ${t.visible ? "opacity-100" : "opacity-0"}`}>
          <span className="text-sm flex-1">Medication removed</span>
          <button
            onClick={() => { undone = true; toast.dismiss(tid); setMeds(prevMeds); }}
            className="font-semibold text-teal-300 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors text-sm"
          >
            Undo
          </button>
        </div>
      ),
      { id: tid, duration: 5000 }
    );
    setTimeout(async () => {
      if (!undone) {
        await api.medications.delete(id);
        api.activity.push({ type: "medication", label: `Deleted medication: ${med.name}`, at: new Date().toISOString(), deleted: true });
      }
    }, 5100);
  }

  async function clearAll() {
    const count = meds.length;
    await api.medications.clearAll();
    api.activity.push({ type: "medication", label: `Cleared all medications (${count} item${count !== 1 ? "s" : ""})`, at: new Date().toISOString(), deleted: true });
    setMeds([]);
    setShowClearConfirm(false);
    toast.success("All medications cleared");
  }

  function toggleDose(med: Medication, time: string) {
    const todayLog = med.log[today] || {};
    const nowTaken = !todayLog[time];
    if (nowTaken) {
      // Optimistically mark taken, then open time editor
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const updated: Medication = {
        ...med,
        log: { ...med.log, [today]: { ...todayLog, [time]: true } },
        pillCount: med.pillCount != null && med.pillCount > 0 ? med.pillCount - 1 : med.pillCount,
      };
      setMeds((prev) => prev.map((m) => (m.id === med.id ? updated : m)));
      api.medications.save(updated).catch(() => toast.error("Failed to save dose"));
      setDoseTimeEdit({ medId: med.id, time, value: hhmm });
    } else {
      setDoseTimeEdit(null);
      const updated: Medication = { ...med, log: { ...med.log, [today]: { ...todayLog, [time]: false } } };
      setMeds((prev) => prev.map((m) => (m.id === med.id ? updated : m)));
      api.medications.save(updated).catch(() => toast.error("Failed to save dose"));
    }
  }

  function saveDoseTime(med: Medication, time: string, takenAt: string) {
    const todayLog = med.log[today] || {};
    const value = takenAt.trim() || true;
    const updated: Medication = { ...med, log: { ...med.log, [today]: { ...todayLog, [time]: value } } };
    setMeds((prev) => prev.map((m) => (m.id === med.id ? updated : m)));
    api.medications.save(updated).catch(() => toast.error("Failed to save dose"));
    setDoseTimeEdit(null);
  }

  function toggleTime(time: string) {
    setForm((prev) => ({
      ...prev,
      times: prev.times.includes(time) ? prev.times.filter((t) => t !== time) : [...prev.times, time],
    }));
  }

  function toggleDay(day: string) {
    setForm((prev) => ({
      ...prev,
      weeklyDays: prev.weeklyDays.includes(day)
        ? prev.weeklyDays.filter((d) => d !== day)
        : [...prev.weeklyDays, day],
    }));
  }

  const allDoses = meds.flatMap((m) => m.times);
  const takenDoses = meds.flatMap((m) => m.times.filter((t) => m.log[today]?.[t]));
  const progress = allDoses.length > 0 ? Math.round((takenDoses.length / allDoses.length) * 100) : 0;

  const getDayAdherence = (dateStr: string): { taken: number; expected: number } => {
    const dayName = new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });
    let exp = 0, tak = 0;
    for (const med of meds) {
      const createdDate = med.createdAt?.split("T")[0];
      if (createdDate && dateStr < createdDate) continue;
      if (med.expiresAt && dateStr > med.expiresAt.split("T")[0]) continue;
      if (med.frequency === "As needed") continue;
      if (isWeekly(med.frequency)) {
        for (const time of med.times) {
          if (time.startsWith(dayName)) { exp++; if (med.log[dateStr]?.[time]) tak++; }
        }
      } else if (isMonthly(med.frequency)) {
        // expected on the same day-of-month the med was started, clamped to month end
        const anchorDay = createdDate ? parseInt(createdDate.split("-")[2], 10) : 1;
        const [y, m, d] = dateStr.split("-").map(Number);
        const lastDayOfMonth = new Date(y, m, 0).getDate();
        if (d === Math.min(anchorDay, lastDayOfMonth)) {
          for (const time of med.times) { exp++; if (med.log[dateStr]?.[time]) tak++; }
        }
      } else {
        for (const time of med.times) { exp++; if (med.log[dateStr]?.[time]) tak++; }
      }
    }
    return { expected: exp, taken: tak };
  };

  // 30-day adherence
  const thirtyDayDates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().split("T")[0];
  });
  const thirtyDayStats = thirtyDayDates.reduce<{ taken: number; expected: number }>(
    (acc, day) => {
      const { taken, expected } = getDayAdherence(day);
      return { taken: acc.taken + taken, expected: acc.expected + expected };
    },
    { taken: 0, expected: 0 }
  );
  const thirtyDayPct = thirtyDayStats.expected > 0
    ? Math.round((thirtyDayStats.taken / thirtyDayStats.expected) * 100)
    : null;

  // Most-missed daily slot in last 30 days (as miss-rate %)
  const slotStats: Record<string, { misses: number; total: number }> = {};
  for (const day of thirtyDayDates) {
    for (const med of meds) {
      if (med.frequency === "As needed" || isWeekly(med.frequency) || isMonthly(med.frequency)) continue;
      if (med.createdAt && day < med.createdAt) continue;
      for (const time of med.times) {
        if (!slotStats[time]) slotStats[time] = { misses: 0, total: 0 };
        slotStats[time].total++;
        if (!med.log[day]?.[time]) slotStats[time].misses++;
      }
    }
  }
  // Only surface a slot if it has ≥5 expected doses AND miss rate >30%
  const mostMissedEntry = Object.entries(slotStats)
    .filter(([, s]) => s.total >= 5 && s.misses / s.total > 0.3)
    .sort((a, b) => b[1].misses / b[1].total - a[1].misses / a[1].total)[0];
  const mostMissedPct = mostMissedEntry
    ? Math.round((mostMissedEntry[1].misses / mostMissedEntry[1].total) * 100)
    : null;

  // Perfect-day streak: consecutive past days with every expected dose taken.
  // Today only counts once complete; an incomplete today doesn't break the streak.
  let adherenceStreak = 0;
  for (let i = 0; i <= 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    const { taken, expected } = getDayAdherence(ds);
    if (expected === 0) break;
    if (taken >= expected) adherenceStreak++;
    else if (i === 0) continue;
    else break;
  }

  const filteredMeds = search.trim()
    ? meds.filter((m) => m.name.toLowerCase().includes(search.toLowerCase().trim()))
    : meds;

  const weekly = isWeekly(form.frequency);
  const monthly = isMonthly(form.frequency);
  const asNeeded = form.frequency === "As needed";

  return (
    <>
      <TopBar />
      <main className="p-4 sm:p-6 max-w-3xl space-y-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Medications</h2>
          <div className="flex items-center gap-2">
            <button onClick={openAdd} className="btn-primary">+ Add</button>
            {meds.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowOverflow((v) => !v)}
                  className="relative z-50 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  title="More options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {showOverflow && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowOverflow(false)} />
                    <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 overflow-hidden">
                      <button
                        onClick={() => { setShowOverflow(false); setShowReminderExport((v) => !v); }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Reminders (.ics)
                      </button>
                      <button
                        onClick={() => { setShowOverflow(false); setShowClearConfirm(true); }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Clear all medications
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {meds.length > 3 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              className="input pl-9 text-sm"
              placeholder="Search medications…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        <IOSPushBanner />

        {showReminderExport && (
          <div className="card border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 space-y-3">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              This exports a recurring calendar file (.ics). Open it to add medication alerts to Apple Calendar or Google Calendar.
            </p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">When are each of these times for you?</p>
            <div className="grid grid-cols-2 gap-2">
              {(["Morning", "Afternoon", "Evening", "Night"] as const).map((slot) => (
                <label key={slot} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm">
                  <span className="text-gray-600 dark:text-gray-300 text-xs">{slot}</span>
                  <input
                    type="time"
                    value={exportTimes[slot]}
                    onChange={(e) => {
                      const updated = { ...exportTimes, [slot]: e.target.value };
                      setExportTimes(updated);
                      storage.notifications.set({ ...storage.notifications.get(), reminderTimes: updated });
                    }}
                    className="input text-xs py-0.5 px-1.5 w-24"
                  />
                </label>
              ))}
            </div>
            <button
              onClick={() => { downloadMedRemindersICS(meds, exportTimes); setShowReminderExport(false); }}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Download & add to calendar
            </button>
            <p className="text-xs text-gray-400 dark:text-gray-500">Open the downloaded file on your phone to import into Apple Calendar or Google Calendar.</p>
          </div>
        )}

        {allDoses.length > 0 && (
          <div className="card">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Today&apos;s Doses</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{takenDoses.length} of {allDoses.length} taken</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className="bg-teal-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
              <p className="text-xs text-gray-400 dark:text-gray-500">{progress}% complete today</p>
              {thirtyDayPct !== null && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  30-day: <span className={`font-medium ${thirtyDayPct >= 80 ? "text-green-600 dark:text-green-400" : thirtyDayPct >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>{thirtyDayPct}%</span>
                  {mostMissedEntry && mostMissedPct !== null && (
                    <span className="ml-2 text-amber-500 dark:text-amber-400">· Most missed: {mostMissedEntry[0]} ({mostMissedPct}% skip rate)</span>
                  )}
                </p>
              )}
              {adherenceStreak >= 2 && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  🔥 <span className="font-medium text-teal-600 dark:text-teal-400">{adherenceStreak}-day perfect streak</span>
                </p>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : meds.length === 0 ? (
          <div className="card text-center py-10 text-gray-400 dark:text-gray-500">
            <p className="font-medium">No medications yet</p>
            <p className="text-sm mt-1">Add a medication to start tracking</p>
          </div>
        ) : (
          <>
          {/* Adherence calendar */}
          {meds.length > 0 && (
            <div className="card">
              <button
                onClick={() => setShowCalendar((v) => !v)}
                className="w-full flex items-center justify-between text-sm font-semibold text-gray-700 dark:text-gray-300"
              >
                <span className="flex items-center gap-2"><Calendar className="w-4 h-4 text-teal-500" /> Adherence Calendar</span>
                <span className="text-xs text-gray-400">{showCalendar ? "Hide" : "Show"}</span>
              </button>

              {showCalendar && (() => {
                const now = new Date();
                const displayDate = new Date(now.getFullYear(), now.getMonth() + calMonthOffset, 1);
                const year = displayDate.getFullYear();
                const month = displayDate.getMonth();
                const firstDow = displayDate.getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const todayStr = now.toISOString().split("T")[0];

                const cellColor = (taken: number, expected: number, isFuture: boolean): string => {
                  if (isFuture) return "bg-gray-50 dark:bg-gray-800/40 text-gray-300 dark:text-gray-600";
                  if (expected === 0) return "bg-gray-100 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500";
                  const pct = taken / expected;
                  if (pct >= 1) return "bg-green-400 dark:bg-green-500 text-white";
                  if (pct >= 0.5) return "bg-yellow-300 dark:bg-yellow-400 text-gray-800";
                  if (pct > 0) return "bg-orange-300 dark:bg-orange-400 text-white";
                  return "bg-red-300 dark:bg-red-400 text-white";
                };

                return (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <button onClick={() => setCalMonthOffset((o) => o - 1)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                        {displayDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                      </span>
                      <button onClick={() => setCalMonthOffset((o) => Math.min(0, o + 1))} disabled={calMonthOffset >= 0} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-default">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-gray-400 dark:text-gray-500 mb-1">
                      {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => <div key={d} className="py-0.5">{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-0.5">
                      {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const day = i + 1;
                        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const isFuture = dateStr > todayStr;
                        const isToday = dateStr === todayStr;
                        const { taken, expected } = isFuture ? { taken: 0, expected: 0 } : getDayAdherence(dateStr);
                        return (
                          <div
                            key={day}
                            title={!isFuture && expected > 0 ? `${taken}/${expected} doses` : undefined}
                            className={`h-7 rounded-md flex items-center justify-center text-[11px] font-medium relative group cursor-default transition-colors ${cellColor(taken, expected, isFuture)} ${isToday ? "ring-2 ring-teal-500 ring-offset-1 dark:ring-offset-gray-800" : ""}`}
                          >
                            {day}
                            {!isFuture && expected > 0 && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-900 text-white text-[10px] rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 z-20 pointer-events-none shadow-lg">
                                {taken}/{expected} doses
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
                      {[["bg-green-400","All taken"],["bg-yellow-300","Partial"],["bg-red-300","None taken"],["bg-gray-100 dark:bg-gray-700","No doses"]].map(([cls, lbl]) => (
                        <span key={lbl} className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded ${cls} inline-block`} />{lbl}</span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="space-y-3">
            {(search.trim() && filteredMeds.length === 0) ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No medications match &quot;{search}&quot;</p>
            ) : filteredMeds.map((med) => {
              const todayLog = med.log[today] || {};
              return (
                <SwipeCard key={med.id} onDelete={() => deleteMed(med.id)}>
                  <div className="card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{med.name}</h3>
                          {med.dosage && <span className="badge-gray">{med.dosage}</span>}
                          {med.frequency && <span className="badge-purple">{med.frequency}</span>}
                          {med.expiresAt && (() => {
                            const daysLeft = Math.ceil((new Date(med.expiresAt).getTime() - Date.now()) / 86400000);
                            return daysLeft <= 1
                              ? <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium">{daysLeft <= 0 ? "Expired" : "Last day"}</span>
                              : <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">{daysLeft}d left</span>;
                          })()}
                          {med.pillCount != null && (() => {
                            const dailyDoses = (!isWeekly(med.frequency) && !isMonthly(med.frequency) && med.frequency !== "As needed")
                              ? med.times.length : 1;
                            const daysLeft = Math.floor(med.pillCount / Math.max(dailyDoses, 1));
                            if (med.pillCount <= 0) return (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium">Out of pills</span>
                            );
                            if (daysLeft <= 3) return (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium">{med.pillCount} pills (~{daysLeft}d)</span>
                            );
                            if (daysLeft <= 7) return (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">{med.pillCount} pills (~{daysLeft}d)</span>
                            );
                            return (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{med.pillCount} pills</span>
                            );
                          })()}
                        </div>
                        {med.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{med.notes}</p>}
                      </div>
                      <div className="flex gap-0.5 flex-shrink-0">
                        <button onClick={() => openEdit(med)}
                          className="p-1.5 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/30">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteMed(med.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {med.times.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        {med.times.map((time) => {
                          const rawTaken = todayLog[time];
                          const taken = !!rawTaken;
                          const takenAt = typeof rawTaken === "string" ? rawTaken : null;
                          const isEditing = doseTimeEdit?.medId === med.id && doseTimeEdit?.time === time;
                          return (
                            <div key={time} className="flex flex-col gap-1">
                              <button onClick={() => toggleDose(med, time)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all active:scale-95 select-none ${
                                  taken
                                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-400"
                                    : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-teal-300 dark:hover:border-teal-600"
                                }`}>
                                {taken ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                {time}
                              </button>
                              {takenAt && !isEditing && (
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 pl-0.5 flex items-center gap-1">
                                  Taken {format12h(takenAt)}
                                  {isLateDose(time, takenAt) && (
                                    <span className="inline-block px-1 py-0.5 rounded text-[9px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 leading-none">
                                      Late
                                    </span>
                                  )}
                                </span>
                              )}
                              {/* Feature 15: Inline time editor */}
                              {isEditing && (
                                <div className="flex items-center gap-1.5 pl-1">
                                  <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                  <input
                                    type="time"
                                    value={doseTimeEdit.value}
                                    onChange={(e) => setDoseTimeEdit(prev => prev ? { ...prev, value: e.target.value } : null)}
                                    className="input text-xs py-1 px-2 w-24"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => saveDoseTime(med, time, doseTimeEdit.value)}
                                    className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline"
                                  >Save</button>
                                  <button
                                    onClick={() => setDoseTimeEdit(null)}
                                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                  >Skip</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {(() => {
                      const linked = allSymptoms
                        .filter(s => s.linkedMedication?.toLowerCase() === med.name.toLowerCase())
                        .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())
                        .slice(0, 5);
                      if (linked.length === 0) return null;
                      const daysAfterStart = med.createdAt
                        ? Math.ceil((new Date(linked[linked.length - 1].loggedAt).getTime() - new Date(med.createdAt).getTime()) / 86400000)
                        : null;
                      return (
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                          <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2">
                            Reported side effects ({linked.length})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {linked.map(s => (
                              <span key={s.id} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                {s.symptom} <span className="opacity-60">{s.severity}/5</span>
                              </span>
                            ))}
                          </div>
                          {daysAfterStart !== null && daysAfterStart > 0 && (
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">
                              First reported {daysAfterStart} day{daysAfterStart !== 1 ? "s" : ""} after starting this medication
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </SwipeCard>
              );
            })}
          </div>
          </>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div ref={medModalRef} role="dialog" aria-modal="true" aria-label={editing ? "Edit Medication" : "Add Medication"} className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {editing ? "Edit Medication" : "Add Medication"}
            </h3>

            <div>
              <label className="label">Medication name *</label>
              <input className="input" placeholder="e.g. Metformin" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div>
              <label className="label">Dosage</label>
              <input className="input" placeholder="e.g. 500mg" value={form.dosage}
                onChange={(e) => setForm({ ...form, dosage: e.target.value })} />
            </div>

            <div>
              <label className="label">Frequency</label>
              <select className="input" value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value, weeklyDays: [], times: ["Morning"] })}>
                {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>

            {/* Weekly: pick day(s) + one time of day */}
            {weekly && (
              <>
                <div>
                  <label className="label">Day(s) of the week</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((d) => (
                      <button key={d} type="button" onClick={() => toggleDay(d)}
                        className={`px-3 py-2 rounded-xl text-sm border font-medium transition-colors active:scale-95 ${
                          form.weeklyDays.includes(d)
                            ? "bg-teal-600 border-teal-600 text-white"
                            : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-teal-400"
                        }`}>{d}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Time of day</label>
                  <div className="flex flex-wrap gap-2">
                    {TIMES.map((t) => (
                      <button key={t} type="button" onClick={() => setForm({ ...form, weeklyTime: t })}
                        className={`px-3 py-2 rounded-xl text-sm border font-medium transition-colors active:scale-95 ${
                          form.weeklyTime === t
                            ? "bg-teal-600 border-teal-600 text-white"
                            : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-teal-400"
                        }`}>{t}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Monthly: just time of day */}
            {monthly && (
              <div>
                <label className="label">Time of day</label>
                <div className="flex flex-wrap gap-2">
                  {TIMES.map((t) => (
                    <button key={t} type="button" onClick={() => setForm({ ...form, weeklyTime: t })}
                      className={`px-3 py-2 rounded-xl text-sm border font-medium transition-colors active:scale-95 ${
                        form.weeklyTime === t
                          ? "bg-teal-600 border-teal-600 text-white"
                          : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-teal-400"
                      }`}>{t}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Daily: pick times of day */}
            {!weekly && !monthly && !asNeeded && (
              <div>
                <label className="label">Times of day</label>
                <div className="flex flex-wrap gap-2">
                  {TIMES.map((t) => (
                    <button key={t} type="button" onClick={() => toggleTime(t)}
                      className={`px-3 py-2 rounded-xl text-sm border font-medium transition-colors active:scale-95 ${
                        form.times.includes(t)
                          ? "bg-teal-600 border-teal-600 text-white"
                          : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-teal-400"
                      }`}>{t}</button>
                  ))}
                </div>
                {form.frequency === "Once daily" && form.times.length > 1 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                    ⚠ &quot;Once daily&quot; — select only 1 time slot. Pick the most appropriate one.
                  </p>
                )}
                {form.frequency === "Twice daily" && form.times.length !== 2 && form.times.length > 0 && (
                  <p className="text-xs text-blue-500 dark:text-blue-400 mt-1.5">
                    Tip: &quot;Twice daily&quot; works best with 2 time slots (e.g. Morning + Evening).
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="label">Pills remaining (optional)</label>
              <input
                className="input"
                type="number"
                min="0"
                placeholder="e.g. 30 (leave blank if unknown)"
                value={form.pillCount}
                onChange={(e) => setForm({ ...form, pillCount: e.target.value })}
              />
              {form.pillCount && parseInt(form.pillCount) > 0 && (() => {
                const dailyDoses = (!isWeekly(form.frequency) && !isMonthly(form.frequency) && form.frequency !== "As needed")
                  ? form.times.length
                  : 1;
                const daysLeft = Math.floor(parseInt(form.pillCount) / Math.max(dailyDoses, 1));
                return <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">~{daysLeft} days of doses remaining</p>;
              })()}
            </div>

            <div>
              <label className="label">Course duration (days) — optional</label>
              <input
                className="input"
                type="number"
                min="0"
                placeholder="e.g. 5 (leave blank if ongoing)"
                value={form.durationDays}
                onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
              />
              {form.durationDays && parseInt(form.durationDays) > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Auto-removes on {new Date(Date.now() + parseInt(form.durationDays) * 86400000).toLocaleDateString("en-IN")}
                </p>
              )}
            </div>

            <div>
              <label className="label">Notes (optional)</label>
              <textarea className="input resize-none" rows={2} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={save} className="btn-primary flex-1">
                {editing ? "Save Changes" : "Add Medication"}
              </button>
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div ref={clearConfirmRef} role="dialog" aria-modal="true" aria-label="Confirm delete all medications" className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Delete all medications for {activePerson?.nickname}?
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                This will permanently remove all {meds.length} medication{meds.length !== 1 ? "s" : ""}. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={clearAll} className="btn-danger flex-1">Delete all</button>
              <button onClick={() => setShowClearConfirm(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
