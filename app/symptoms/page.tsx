"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import type { Symptom } from "@/lib/storage";
import { nowIST, formatIST } from "@/lib/time";

const SEVERITY_EMOJI = ["", "😊", "🙂", "😐", "😟", "😰"];
const SEVERITY_LABELS = ["", "Mild", "Light", "Moderate", "Concerning", "Severe"];
type Filter = "all" | "week" | "month";

function severityClass(s: number) {
  if (s <= 2) return "badge-green";
  if (s === 3) return "badge-yellow";
  return "badge-red";
}

export default function SymptomsPage() {
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [showForm, setShowForm] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [form, setForm] = useState({ symptom: "", severity: 3, notes: "", loggedAt: nowIST() });

  useEffect(() => {
    api.symptoms.getAll().then(data => { setSymptoms(data); setLoading(false); });
  }, []);

  function filtered() {
    const now = new Date();
    if (filter === "week") {
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
      return symptoms.filter(s => new Date(s.loggedAt) >= weekAgo);
    }
    if (filter === "month") {
      const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1);
      return symptoms.filter(s => new Date(s.loggedAt) >= monthAgo);
    }
    return symptoms;
  }

  async function saveSymptom() {
    if (!form.symptom.trim()) { toast.error("Symptom name is required"); return; }
    const s: Symptom = { id: uuidv4(), symptom: form.symptom.trim(), severity: form.severity, notes: form.notes, loggedAt: new Date(form.loggedAt).toISOString() };
    await api.symptoms.save(s);
    await api.activity.push({ type: "symptom", label: `Logged symptom: ${s.symptom} (severity ${s.severity})`, at: s.loggedAt });
    setSymptoms(await api.symptoms.getAll());
    setShowForm(false);
    setForm({ symptom: "", severity: 3, notes: "", loggedAt: nowIST() });
    toast.success("Symptom logged");
  }

  async function deleteSymptom(id: string) {
    await api.symptoms.delete(id);
    setSymptoms(await api.symptoms.getAll());
    toast.success("Entry deleted");
  }

  async function runAnalysis() {
    const recent = symptoms.slice(0, 30);
    if (recent.length === 0) { toast.error("No symptoms to analyze"); return; }
    setAnalyzing(true); setShowAnalysis(true); setAnalysis("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Review these symptom logs for a patient. Identify any patterns, recurring issues, or things a caregiver should bring up with a doctor." }],
          context: `Symptom log (recent 30 entries):\n${JSON.stringify(recent, null, 2)}`,
        }),
      });
      if (!res.body) throw new Error();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setAnalysis(text);
      }
    } catch { toast.error("Analysis failed. Try again."); }
    finally { setAnalyzing(false); }
  }

  const displayed = filtered();

  return (
    <>
      <TopBar />
      <main className="p-6 max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Symptom Log</h2>
          <div className="flex gap-2">
            <button onClick={runAnalysis} className="btn-secondary">🤖 AI Analysis</button>
            <button onClick={() => setShowForm(true)} className="btn-primary">+ Log Symptom</button>
          </div>
        </div>

        <div className="flex gap-2">
          {(["all", "week", "month"] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                filter === f ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-teal-400"
              }`}>
              {f === "all" ? "All" : f === "week" ? "This week" : "This month"}
            </button>
          ))}
          <span className="ml-auto text-sm text-gray-400 self-center">{displayed.length} entries</span>
        </div>

        {showAnalysis && (
          <div className="card border-purple-200 bg-purple-50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-purple-700">🤖 AI Pattern Analysis</h3>
              <button onClick={() => setShowAnalysis(false)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
            </div>
            {analyzing && !analysis ? (
              <div className="flex items-center gap-2 text-sm text-purple-600">
                <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                Analyzing patterns...
              </div>
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {analysis}
                {analyzing && <span className="inline-block w-1 h-4 bg-purple-500 animate-pulse ml-0.5 align-middle" />}
              </p>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : displayed.length === 0 ? (
          <div className="card text-center py-10 text-gray-400">
            <div className="text-4xl mb-3">🌡️</div>
            <p className="font-medium">No symptoms logged</p>
            <p className="text-sm mt-1">Start tracking to spot patterns over time</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map(s => (
              <div key={s.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg">{SEVERITY_EMOJI[s.severity]}</span>
                      <h3 className="font-semibold text-gray-900 capitalize">{s.symptom}</h3>
                      <span className={severityClass(s.severity)}>Severity {s.severity} — {SEVERITY_LABELS[s.severity]}</span>
                    </div>
                    {s.notes && <p className="text-sm text-gray-500 mt-1">{s.notes}</p>}
                    <p className="text-xs text-gray-400 mt-1.5">{formatIST(s.loggedAt)}</p>
                  </div>
                  <button onClick={() => deleteSymptom(s.id)} className="text-gray-300 hover:text-red-400 transition-colors text-sm flex-shrink-0">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Log Symptom</h3>
            <div>
              <label className="label">Symptom *</label>
              <input className="input" placeholder="e.g. headache, fatigue, chest pain" value={form.symptom} onChange={(e) => setForm({ ...form, symptom: e.target.value })} />
            </div>
            <div>
              <label className="label">Severity: {form.severity} — {SEVERITY_EMOJI[form.severity]} {SEVERITY_LABELS[form.severity]}</label>
              <input type="range" min={1} max={5} value={form.severity} onChange={(e) => setForm({ ...form, severity: Number(e.target.value) })} className="w-full accent-teal-600" />
              <div className="flex justify-between text-xs text-gray-400 mt-1"><span>😊 Mild</span><span>😰 Severe</span></div>
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <textarea className="input resize-none" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div>
              <label className="label">Date & time (IST)</label>
              <input type="datetime-local" className="input" value={form.loggedAt} onChange={(e) => setForm({ ...form, loggedAt: e.target.value })} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={saveSymptom} className="btn-primary flex-1">Log Symptom</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
