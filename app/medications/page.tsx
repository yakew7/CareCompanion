"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import { Pencil, Trash2, CheckSquare, Square, Download } from "lucide-react";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import { usePersonContext } from "@/contexts/PersonContext";
import type { Medication } from "@/lib/storage";
import { downloadMedRemindersICS } from "@/lib/ics";
import { storage } from "@/lib/storage";

const TIMES = ["Morning", "Afternoon", "Evening", "Night"];
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

const emptyForm = () => ({
  name: "", dosage: "", frequency: "Once daily",
  times: ["Morning"] as string[],
  weeklyDays: [] as string[],
  weeklyTime: "Morning",
  notes: "",
  durationDays: "" as string,
});

export default function MedicationsPage() {
  const { activePersonId } = usePersonContext();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [showReminderExport, setShowReminderExport] = useState(false);
  const [exportTimes, setExportTimes] = useState(() => storage.notifications.get().reminderTimes);
  const today = new Date().toISOString().split("T")[0];

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
        setMeds(await api.medications.getAll());
      } else {
        setMeds(data);
      }
      setLoading(false);
    });
  }, [activePersonId]);

  function openAdd() { setEditing(null); setForm(emptyForm()); setShowModal(true); }

  function openEdit(med: Medication) {
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
    const med: Medication = { id: editing?.id || uuidv4(), name: form.name, dosage: form.dosage, frequency: form.frequency, times, notes: form.notes, log: editing?.log || {}, expiresAt };
    await api.medications.save(med);
    if (!editing) api.activity.push({ type: "medication", label: `Added medication: ${med.name}`, at: new Date().toISOString() });
    setMeds(await api.medications.getAll());
    setShowModal(false);
    toast.success(editing ? "Medication updated" : "Medication added");
  }

  async function deleteMed(id: string) {
    if (!confirm("Remove this medication?")) return;
    const med = meds.find((m) => m.id === id);
    await api.medications.delete(id);
    if (med) api.activity.push({ type: "medication", label: `Deleted medication: ${med.name}`, at: new Date().toISOString(), deleted: true });
    setMeds(await api.medications.getAll());
    toast.success("Medication removed");
  }

  async function clearAll() {
    if (!confirm("Remove all medications for this person? This cannot be undone.")) return;
    const count = meds.length;
    await api.medications.clearAll();
    api.activity.push({ type: "medication", label: `Cleared all medications (${count} item${count !== 1 ? "s" : ""})`, at: new Date().toISOString(), deleted: true });
    setMeds([]);
    toast.success("All medications cleared");
  }

  function toggleDose(med: Medication, time: string) {
    const todayLog = med.log[today] || {};
    const updated: Medication = { ...med, log: { ...med.log, [today]: { ...todayLog, [time]: !todayLog[time] } } };
    setMeds((prev) => prev.map((m) => (m.id === med.id ? updated : m)));
    api.medications.save(updated);
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

  const weekly = isWeekly(form.frequency);
  const monthly = isMonthly(form.frequency);
  const asNeeded = form.frequency === "As needed";

  return (
    <>
      <TopBar />
      <main className="p-4 sm:p-6 max-w-3xl space-y-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Medications</h2>
          <div className="flex gap-2">
            {meds.length > 0 && (
              <>
                <button
                  onClick={() => setShowReminderExport((v) => !v)}
                  className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Reminders (.ics)
                </button>
                <button onClick={clearAll} className="btn-danger text-xs px-3 py-2">Clear all</button>
              </>
            )}
            <button onClick={openAdd} className="btn-primary">+ Add</button>
          </div>
        </div>

        {showReminderExport && (
          <div className="card border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 space-y-3">
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

        <div className="card">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Today&apos;s doses</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">{takenDoses.length} of {allDoses.length} taken</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-teal-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{progress}% complete</p>
        </div>

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
          <div className="space-y-3">
            {meds.map((med) => {
              const todayLog = med.log[today] || {};
              return (
                <div key={med.id} className="card">
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
                        const taken = todayLog[time];
                        return (
                          <button key={time} onClick={() => toggleDose(med, time)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all active:scale-95 select-none ${
                              taken
                                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-400"
                                : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-teal-300 dark:hover:border-teal-600"
                            }`}>
                            {taken ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
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
              </div>
            )}

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
    </>
  );
}
