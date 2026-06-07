"use client";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import { v4 as uuidv4 } from "uuid";
import { Trash2, Sparkles, Search, TrendingUp, Pencil, X, ChevronUp } from "lucide-react";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import { usePersonContext } from "@/contexts/PersonContext";
import type { Symptom } from "@/lib/storage";
import { nowIST, formatIST } from "@/lib/time";
import { useTimezoneRefresh } from "@/lib/useTimezoneRefresh";

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

// Feature 12: Unified severity vocabulary — Normal / Caution / Critical
function sevStatus(s: number): { cls: string; label: string } {
  if (s <= 2) return { cls: "badge-green", label: "Normal" };
  if (s === 3) return { cls: "badge-yellow", label: "Caution" };
  return { cls: "badge-red", label: "Critical" };
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

// Feature 13: Co-occurrence computation
function computeCoOccurrences(symptoms: Symptom[]): { a: string; b: string; count: number }[] {
  const byDate = new Map<string, Set<string>>();
  for (const s of symptoms) {
    const date = s.loggedAt.split("T")[0];
    if (!byDate.has(date)) byDate.set(date, new Set());
    byDate.get(date)!.add(s.symptom.toLowerCase());
  }
  const pairCounts = new Map<string, number>();
  Array.from(byDate.values()).forEach((syms) => {
    const arr = Array.from(syms);
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const key = [arr[i], arr[j]].sort().join("|||");
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }
  });
  return Array.from(pairCounts.entries())
    .filter(([, c]) => c >= 2)
    .map(([key, count]) => { const [a, b] = key.split("|||"); return { a, b, count }; })
    .sort((x, y) => y.count - x.count)
    .slice(0, 3);
}

// Feature 16: Swipe-to-delete for mobile
function SwipeCard({ onDelete, children }: { onDelete: () => void; children: React.ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    if (innerRef.current) innerRef.current.style.transition = "none";
  }
  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current;
    if (dx < -8 && innerRef.current) innerRef.current.style.transform = `translateX(${Math.max(dx, -76)}px)`;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - startX.current;
    if (innerRef.current) { innerRef.current.style.transition = "transform 0.2s"; innerRef.current.style.transform = ""; }
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

export default function SymptomsPage() {
  useTimezoneRefresh();
  const { activePersonId } = usePersonContext();
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [showForm, setShowForm] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ symptom: "", severity: 3, notes: "", loggedAt: nowIST() });
  const [editSymptom, setEditSymptom] = useState<Symptom | null>(null);

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

  async function saveEdit() {
    if (!editSymptom) return;
    const updated = { ...editSymptom };
    await api.symptoms.save(updated);
    setSymptoms(await api.symptoms.getAll());
    setEditSymptom(null);
    toast.success("Symptom updated");
  }

  function deleteSymptom(id: string) {
    const sym = symptoms.find((s) => s.id === id);
    if (!sym) return;
    const prevSymptoms = [...symptoms];
    setSymptoms((prev) => prev.filter((s) => s.id !== id));
    let undone = false;
    const tid = `undo-sym-${id}`;
    toast.custom(
      (t) => (
        <div className={`flex items-center gap-3 bg-gray-900 text-white pl-4 pr-3 py-3 rounded-xl shadow-lg max-w-xs transition-all ${t.visible ? "opacity-100" : "opacity-0"}`}>
          <span className="text-sm flex-1">Symptom deleted</span>
          <button
            onClick={() => { undone = true; toast.dismiss(tid); setSymptoms(prevSymptoms); }}
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
        await api.symptoms.delete(id);
        api.activity.push({ type: "symptom", label: `Deleted symptom: ${sym.symptom}`, at: new Date().toISOString(), deleted: true });
      }
    }, 5100);
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

  const displayed = filtered().filter((s) =>
    !search.trim() || s.symptom.toLowerCase().includes(search.toLowerCase().trim())
  );

  // Feature 13: Compute co-occurrence pairs
  const coOccurrences = symptoms.length >= 4 ? computeCoOccurrences(symptoms) : [];

  return (
    <>
      <TopBar />
      <main className="p-4 sm:p-6 pb-24 max-w-3xl space-y-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Symptom Log</h2>
          <div className="flex gap-2">
            <button onClick={runAnalysis} className="btn-secondary flex items-center gap-1.5 text-xs sm:text-sm">
              <Sparkles className="w-3.5 h-3.5" /> Analysis
            </button>
            <button onClick={() => setShowForm(true)} className="btn-primary">+ Log</button>
          </div>
        </div>

        {symptoms.length > 4 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              className="input pl-9 text-sm"
              placeholder="Search symptoms…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

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

        {/* Feature 13: Co-occurrence insight card */}
        {coOccurrences.length > 0 && (
          <div className="card border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Symptom Co-occurrence</h3>
            </div>
            <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mb-3">These symptoms tend to appear on the same day:</p>
            <div className="space-y-2">
              {coOccurrences.map(({ a, b, count }) => (
                <div key={`${a}-${b}`} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-medium capitalize truncate">{a}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">+</span>
                    <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-medium capitalize truncate">{b}</span>
                  </div>
                  <span className="text-xs text-indigo-500 dark:text-indigo-400 flex-shrink-0 font-medium">{count}×</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {showAnalysis && (
          <div className="card border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Pattern Analysis
              </h3>
              <button
                onClick={() => setShowAnalysis(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {analyzing && !analysis ? (
              <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400">
                <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                Analysing patterns...
              </div>
            ) : (
              <>
                <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-strong:font-semibold text-gray-700 dark:text-gray-300 dark:prose-invert max-h-72 overflow-y-auto pr-1">
                  <ReactMarkdown>{analysis}</ReactMarkdown>
                  {analyzing && <span className="inline-block w-1 h-4 bg-purple-500 animate-pulse ml-0.5 align-middle" />}
                </div>
                {!analyzing && (
                  <button
                    onClick={() => setShowAnalysis(false)}
                    className="mt-3 flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 transition-colors"
                  >
                    <ChevronUp className="w-3.5 h-3.5" /> Collapse
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="card text-center py-10 text-gray-400 dark:text-gray-500">
            {search.trim() ? (
              <p className="font-medium">No symptoms match &quot;{search}&quot;</p>
            ) : (
              <>
                <p className="font-medium">No symptoms logged</p>
                <p className="text-sm mt-1">Start tracking to spot patterns over time</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((s) => {
              const { cls, label } = sevStatus(s.severity);
              return (
                <SwipeCard key={s.id} onDelete={() => deleteSymptom(s.id)}>
                  <div className="card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 capitalize">{s.symptom}</h3>
                          <span className={cls}>{label}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{SEVERITY_SHORT[s.severity]}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <SeverityBar value={s.severity} />
                          <span className="text-xs text-gray-400 dark:text-gray-500">{s.severity}/5</span>
                        </div>
                        {s.notes && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{s.notes}</p>}
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">{formatIST(s.loggedAt)}</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => setEditSymptom({ ...s })}
                          className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-teal-500 transition-colors rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/20">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteSymptom(s.id)}
                          className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </SwipeCard>
              );
            })}
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
              <label className="label">Date and time</label>
              <input type="datetime-local" className="input" value={form.loggedAt}
                onChange={(e) => setForm({ ...form, loggedAt: e.target.value })} />
              {form.loggedAt && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {new Date(form.loggedAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}
                </p>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={saveSymptom} className="btn-primary flex-1">Log Symptom</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit symptom modal */}
      {editSymptom && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setEditSymptom(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Edit Symptom</h3>
            <div>
              <label className="label">Symptom</label>
              <input className="input" value={editSymptom.symptom}
                onChange={(e) => setEditSymptom({ ...editSymptom, symptom: e.target.value })} />
            </div>
            <div>
              <label className="label">Severity: {editSymptom.severity}/5 — {SEVERITY_LABELS[editSymptom.severity]}</label>
              <input type="range" min={1} max={5} value={editSymptom.severity}
                onChange={(e) => setEditSymptom({ ...editSymptom, severity: Number(e.target.value) })}
                className="w-full accent-teal-600" />
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <textarea className="input resize-none" rows={2} value={editSymptom.notes}
                onChange={(e) => setEditSymptom({ ...editSymptom, notes: e.target.value })} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={saveEdit} className="btn-primary flex-1">Save</button>
              <button onClick={() => setEditSymptom(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
