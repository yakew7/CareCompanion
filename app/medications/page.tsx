"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import type { Medication } from "@/lib/storage";

const TIMES = ["Morning", "Afternoon", "Evening", "Night"];
const FREQUENCIES = ["Once daily", "Twice daily", "Three times daily", "As needed"];
const emptyForm = () => ({ name: "", dosage: "", frequency: "Once daily", times: ["Morning"], notes: "" });

export default function MedicationsPage() {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [form, setForm] = useState(emptyForm());
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    api.medications.getAll().then(data => { setMeds(data); setLoading(false); });
  }, []);

  function openAdd() { setEditing(null); setForm(emptyForm()); setShowModal(true); }
  function openEdit(med: Medication) {
    setEditing(med);
    setForm({ name: med.name, dosage: med.dosage, frequency: med.frequency, times: med.times, notes: med.notes });
    setShowModal(true);
  }

  async function save() {
    if (!form.name.trim()) { toast.error("Medication name is required"); return; }
    if (form.times.length === 0) { toast.error("Select at least one time"); return; }
    const med: Medication = { id: editing?.id || uuidv4(), ...form, log: editing?.log || {} };
    await api.medications.save(med);
    if (!editing) api.activity.push({ type: "medication", label: `Added medication: ${med.name}`, at: new Date().toISOString() });
    const updated = await api.medications.getAll();
    setMeds(updated);
    setShowModal(false);
    toast.success(editing ? "Medication updated" : "Medication added");
  }

  async function deleteMed(id: string) {
    await api.medications.delete(id);
    setMeds(await api.medications.getAll());
    toast.success("Medication removed");
  }

  async function toggleDose(med: Medication, time: string) {
    const todayLog = med.log[today] || {};
    const updated: Medication = { ...med, log: { ...med.log, [today]: { ...todayLog, [time]: !todayLog[time] } } };
    await api.medications.save(updated);
    setMeds(await api.medications.getAll());
  }

  function toggleTime(time: string) {
    setForm(prev => ({
      ...prev,
      times: prev.times.includes(time) ? prev.times.filter(t => t !== time) : [...prev.times, time],
    }));
  }

  const allDoses = meds.flatMap(m => m.times);
  const takenDoses = meds.flatMap(m => m.times.filter(t => m.log[today]?.[t]));
  const progress = allDoses.length > 0 ? Math.round((takenDoses.length / allDoses.length) * 100) : 0;

  return (
    <>
      <TopBar />
      <main className="p-6 max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Medications</h2>
          <button onClick={openAdd} className="btn-primary">+ Add Medication</button>
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Today&apos;s doses</span>
            <span className="text-sm text-gray-500">{takenDoses.length} of {allDoses.length} taken</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-teal-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">{progress}% complete</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : meds.length === 0 ? (
          <div className="card text-center py-10 text-gray-400">
            <div className="text-4xl mb-3">💊</div>
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
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{med.name}</h3>
                        <span className="badge-gray">{med.dosage}</span>
                        <span className="badge-purple">{med.frequency}</span>
                      </div>
                      {med.notes && <p className="text-xs text-gray-500 mt-1">{med.notes}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(med)} className="text-sm text-gray-400 hover:text-teal-600 transition-colors">✏️</button>
                      <button onClick={() => deleteMed(med.id)} className="text-sm text-gray-400 hover:text-red-500 transition-colors">🗑️</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                    {med.times.map((time) => {
                      const taken = todayLog[time];
                      return (
                        <button key={time} onClick={() => toggleDose(med, time)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                            taken ? "bg-green-50 border-green-200 text-green-700" : "bg-gray-50 border-gray-200 text-gray-500 hover:border-teal-300"
                          }`}>
                          <span>{taken ? "✅" : "⬜"}</span>{time}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">{editing ? "Edit Medication" : "Add Medication"}</h3>
            <div>
              <label className="label">Medication name *</label>
              <input className="input" placeholder="e.g. Metformin" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Dosage</label>
              <input className="input" placeholder="e.g. 500mg" value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} />
            </div>
            <div>
              <label className="label">Frequency</label>
              <select className="input" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Times of day</label>
              <div className="flex flex-wrap gap-2">
                {TIMES.map(t => (
                  <button key={t} type="button" onClick={() => toggleTime(t)}
                    className={`px-3 py-1.5 rounded-xl text-sm border font-medium transition-colors ${
                      form.times.includes(t) ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-gray-300 text-gray-600 hover:border-teal-400"
                    }`}>{t}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <textarea className="input resize-none" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={save} className="btn-primary flex-1">{editing ? "Save Changes" : "Add Medication"}</button>
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
