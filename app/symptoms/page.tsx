"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import { v4 as uuidv4 } from "uuid";
import { Trash2, Sparkles } from "lucide-react";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import { usePersonContext } from "@/contexts/PersonContext";
import type { Symptom } from "@/lib/storage";
import { nowIST, formatIST } from "@/lib/time";

const SEVERITY_LABELS = [
  "",
  "Barely noticeable, no impact on daily activity",
  "Mild, slightly uncomfortable",
  "Moderate, disrupting normal routine",
  "Severe, significant distress",
  "Emergency-level, seek medical attention",
];
const SEVERITY_SHORT = ["", "Barely noticeable", "Mild", "Moderate", "Severe", "Emergency"];
type Filter = "all" | "week" | "month";

function severityClass(s: number) {
  if (s <= 2) return "badge-green";
  if (s === 3) return "badge-yellow";
  return "badge-red";
}

function SeverityBar({ value }: { value: number }) {
  const colors = ["", "bg-green-400", "bg-green-500", "bg-yellow-400", "bg-orange-400", "bg-red-500"];
  return (
    <div className="flex gap-0.5 items-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={`h-1.5 w-3 rounded-full ${i <= value ? colors[value] : "bg-gray-200 dark:bg-gray-600"}`} />
      ))}
    </div>
  );
}

export default function SymptomsPage() {
  const { activePersonId } = usePersonContext();
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [showForm, setShowForm] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [form, setForm] = useState({ symptom: "", severity: 3, notes: "", loggedAt: nowIST() });

  useEffect(() => {
    if (!activePersonId) return;
    setLoading(true);
    api.symptoms.getAll().then((data) => { setSymptoms(data); setLoading(false); });
  }, [activePersonId]);

  function filtered() {
    const now = new Date();
    if (filter === "week") {
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
      return symptoms.filter((s) => new Date(s.loggedAt) >= weekAgo);
    }
    if (filter === "month") {
      const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1);
      return symptoms.filter((s) => new Date(s.loggedAt) >= monthAgo);
    }
    return symptoms;
  }

  async function saveSymptom() {
    if (!form.symptom.trim()) { toast.error("Symptom name is required"); return; }
    const s: Symptom = {
      id: uuidv4(),
      symptom: form.symptom.trim(),
      severity: form.severity,
      notes: form.notes,
      loggedAt: new Date(form.loggedAt).toISOString(),
    };
    await api.symptoms.save(s);
    await api.activity.push({ type: "symptom", label: `Logged symptom: ${s.symptom} (severity ${s.severity})`, at: s.loggedAt });
    setSymptoms(await api.symptoms.getAll());
    setShowForm(false);
    setForm({ symptom: "", severity: 3, notes: "", loggedAt: nowIST() });
    toast.success("Symptom logged");
  }

  async function deleteSymptom(id: string) {
    const sym = symptoms.find((s) => s.id === id);
    await api.symptoms.delete(id);
    if (sym) api.activity.push({ type: "symptom", label: `Deleted symptom: ${sym.symptom}`, at: new Date().toISOString(), deleted: true });
    setSymptoms(await api.symptoms.getAll());
    toast.success("Entry deleted");
  }

  async function clearAll() {
    if (!confirm("Remove all symptom entries for this person? This cannot be undone.")) return;
    const count = symptoms.length;
    await api.symptoms.clearAll();
    api.activity.push({ type: "symptom", label: `Cleared all symptoms (${count} item${count !== 1 ? "s" : ""})`, at: new Date().toISOString(), deleted: true });
    setSymptoms([]);
    toast.success("All symptoms cleared");
  }

  async function runAnalysis() {
    const recent = symptoms.slice(0, 30);
    if (recent.length === 0) { toast.error("No symptoms to analyse"); return; }
    setAnalyzing(true); setShowAnalysis(true); setAnalysis("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Review these symptom logs. Identify any patterns, recurring issues, or things a caregiver should mention to a doctor." }],
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
      <main className="p-4 sm:p-6 max-w-3xl space-y-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Symptom Log</h2>
          <div className="flex gap-2">
            <button onClick={runAnalysis} className="btn-secondary flex items-center gap-1.5 text-xs sm:text-sm">
              <Sparkles className="w-3.5 h-3.5" /> Analysis
            </button>
            <button onClick={() => setShowForm(true)} className="btn-primary">+ Log</button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "week", "month"] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                filter === f
                  ? "bg-teal-600 border-teal-600 text-white"
                  : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-teal-400"
              }`}>
              {f === "all" ? "All" : f === "week" ? "This week" : "This month"}
            </button>
          ))}
          <span className="ml-auto text-sm text-gray-400 dark:text-gray-500 self-center">{displayed.length} entries</span>
          {symptoms.length > 0 && (
            <button onClick={clearAll} className="btn-danger text-xs px-3 py-1.5">Clear all</button>
          )}
        </div>

        {showAnalysis && (
          <div className="card border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Pattern Analysis
              </h3>
              <button onClick={() => setShowAnalysis(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm">
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>
            {analyzing && !analysis ? (
              <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400">
                <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                Analysing patterns...
              </div>
            ) : (
              <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-strong:font-semibold text-gray-700 dark:text-gray-300 dark:prose-invert">
                <ReactMarkdown>{analysis}</ReactMarkdown>
                {analyzing && <span className="inline-block w-1 h-4 bg-purple-500 animate-pulse ml-0.5 align-middle" />}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="card text-center py-10 text-gray-400 dark:text-gray-500">
            <p className="font-medium">No symptoms logged</p>
            <p className="text-sm mt-1">Start tracking to spot patterns over time</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((s) => (
              <div key={s.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 capitalize">{s.symptom}</h3>
                      <span className={severityClass(s.severity)}>
                        {SEVERITY_LABELS[s.severity]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <SeverityBar value={s.severity} />
                      <span className="text-xs text-gray-400 dark:text-gray-500">{s.severity}/5</span>
                    </div>
                    {s.notes && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{s.notes}</p>}
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">{formatIST(s.loggedAt)}</p>
                  </div>
                  <button
                    onClick={() => deleteSymptom(s.id)}
                    className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Log Symptom</h3>
            <div>
              <label className="label">Symptom *</label>
              <input className="input" placeholder="e.g. headache, fatigue, chest pain"
                value={form.symptom} onChange={(e) => setForm({ ...form, symptom: e.target.value })} />
            </div>
            <div>
              <label className="label">Severity</label>
              <input type="range" min={1} max={5} value={form.severity}
                onChange={(e) => setForm({ ...form, severity: Number(e.target.value) })}
                className="w-full accent-teal-600" />
              <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 mb-2">
                {[1,2,3,4,5].map((n) => <span key={n}>{n}</span>)}
              </div>
              <div className={`rounded-lg px-3 py-2 text-xs font-medium ${
                form.severity <= 2 ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" :
                form.severity === 3 ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" :
                "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
              }`}>
                <span className="font-bold">{form.severity} — {SEVERITY_SHORT[form.severity]}:</span>{" "}
                {SEVERITY_LABELS[form.severity]}
              </div>
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <textarea className="input resize-none" rows={2} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div>
              <label className="label">Date and time (IST)</label>
              <input type="datetime-local" className="input" value={form.loggedAt}
                onChange={(e) => setForm({ ...form, loggedAt: e.target.value })} />
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
