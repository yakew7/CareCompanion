"use client";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import toast from "react-hot-toast";
import { HeartPulse, Droplets, Scale, Heart, Gauge, Thermometer, Plus, Trash2 } from "lucide-react";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import { usePersonContext } from "@/contexts/PersonContext";
import type { VitalEntry, VitalType } from "@/lib/storage";

// ─── Vital definitions ────────────────────────────────────────────────────────

const VITAL_DEFS = [
  { type: "bp"          as VitalType, label: "Blood Pressure",  unit: "mmHg", icon: HeartPulse,  hasDual: true,  normalRange: "90–120 / 60–80 mmHg" },
  { type: "glucose"     as VitalType, label: "Blood Glucose",   unit: "mg/dL",icon: Droplets,    hasDual: false, normalRange: "70–140 mg/dL" },
  { type: "weight"      as VitalType, label: "Weight",          unit: "kg",   icon: Scale,       hasDual: false, normalRange: null },
  { type: "heart_rate"  as VitalType, label: "Heart Rate",      unit: "bpm",  icon: Heart,       hasDual: false, normalRange: "60–100 bpm" },
  { type: "spo2"        as VitalType, label: "Oxygen (SpO₂)",   unit: "%",    icon: Gauge,       hasDual: false, normalRange: "≥ 95%" },
  { type: "temperature" as VitalType, label: "Temperature",     unit: "°C",   icon: Thermometer, hasDual: false, normalRange: "36.1–37.2 °C" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatus(type: VitalType, value: number, value2?: number): "normal" | "warning" | "danger" {
  switch (type) {
    case "bp":
      if (value <= 120 && (value2 ?? 0) <= 80) return "normal";
      if (value <= 140 && (value2 ?? 0) <= 90) return "warning";
      return "danger";
    case "glucose":
      if (value >= 70 && value <= 140) return "normal";
      if (value <= 200) return "warning";
      return "danger";
    case "spo2":
      if (value >= 95) return "normal";
      if (value >= 90) return "warning";
      return "danger";
    case "heart_rate":
      if (value >= 60 && value <= 100) return "normal";
      if (value >= 40 && value <= 120) return "warning";
      return "danger";
    case "temperature":
      if (value >= 36.1 && value <= 37.2) return "normal";
      if (value <= 38.0) return "warning";
      return "danger";
    default:
      return "normal";
  }
}

const STATUS_STYLE = {
  normal:  "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  warning: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  danger:  "bg-red-100  dark:bg-red-900/30  text-red-600  dark:text-red-400",
};
const STATUS_LABEL = { normal: "Normal", warning: "Watch", danger: "High" };

function formatValue(entry: VitalEntry): string {
  return entry.value2 != null
    ? `${entry.value}/${entry.value2} ${entry.unit}`
    : `${entry.value} ${entry.unit}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const W = 56, H = 20, P = 2;
  const pts = values.map((v, i) => [
    P + (i / (values.length - 1)) * (W - P * 2),
    P + (1 - (v - min) / range) * (H - P * 2),
  ]);
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg width={W} height={H} className="text-teal-400 flex-shrink-0">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VitalsPage() {
  const { activePersonId } = usePersonContext();
  const [entries, setEntries] = useState<VitalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [logType, setLogType] = useState<VitalType | null>(null);
  const [form, setForm] = useState({ value: "", value2: "", notes: "" });

  useEffect(() => {
    if (!activePersonId) return;
    api.vitals.getAll().then((data) => { setEntries(data); setLoading(false); });
  }, [activePersonId]);

  function openLog(type: VitalType) {
    setLogType(type);
    setForm({ value: "", value2: "", notes: "" });
  }

  async function save() {
    if (!logType) return;
    const def = VITAL_DEFS.find((d) => d.type === logType)!;
    const v = parseFloat(form.value);
    if (isNaN(v)) { toast.error("Enter a valid number"); return; }
    if (def.hasDual && isNaN(parseFloat(form.value2))) { toast.error("Enter both values"); return; }

    const entry: VitalEntry = {
      id: uuidv4(),
      type: logType,
      value: v,
      value2: def.hasDual ? parseFloat(form.value2) : undefined,
      unit: def.unit,
      notes: form.notes,
      loggedAt: new Date().toISOString(),
    };
    await api.vitals.save(entry);
    api.activity.push({ type: "vital", label: `Logged ${def.label}: ${formatValue(entry)}`, at: entry.loggedAt });
    setEntries(await api.vitals.getAll());
    setLogType(null);
    toast.success(`${def.label} logged`);
  }

  async function deleteEntry(id: string) {
    const entry = entries.find((e) => e.id === id);
    await api.vitals.delete(id);
    if (entry) {
      const def = VITAL_DEFS.find((d) => d.type === entry.type);
      api.activity.push({ type: "vital", label: `Deleted ${def?.label ?? "vital"}: ${formatValue(entry)}`, at: new Date().toISOString(), deleted: true });
    }
    setEntries(await api.vitals.getAll());
  }

  const byType = (type: VitalType) =>
    entries.filter((e) => e.type === type).sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());

  const history = [...entries]
    .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())
    .slice(0, 30);

  const logDef = logType ? VITAL_DEFS.find((d) => d.type === logType)! : null;

  return (
    <>
      <TopBar />
      <main className="p-4 sm:p-6 max-w-3xl space-y-5">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Vitals</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {VITAL_DEFS.map((def) => {
              const list = byType(def.type);
              const latest = list[0];
              const spark = list.slice(0, 10).reverse().map((e) => e.value);
              const status = latest ? getStatus(def.type, latest.value, latest.value2) : null;
              const Icon = def.icon;
              return (
                <div key={def.type} className="card flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Icon className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{def.label}</span>
                    </div>
                    <button
                      onClick={() => openLog(def.type)}
                      className="p-1 rounded-lg text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors flex-shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {latest ? (
                    <>
                      <p className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight mt-0.5">
                        {formatValue(latest)}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{timeAgo(latest.loggedAt)}</p>
                      <div className="flex items-center justify-between mt-1">
                        <Sparkline values={spark} />
                        {status && def.type !== "weight" && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_STYLE[status]}`}>
                            {STATUS_LABEL[status]}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No readings yet</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {history.length > 0 && (
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">History</h3>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {history.map((entry) => {
                const def = VITAL_DEFS.find((d) => d.type === entry.type)!;
                const Icon = def.icon;
                const status = def.type !== "weight" ? getStatus(entry.type, entry.value, entry.value2) : null;
                return (
                  <li key={entry.id} className="py-2.5 flex items-center gap-3 text-sm">
                    <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="flex-1 text-gray-700 dark:text-gray-300">
                      <span className="font-medium">{formatValue(entry)}</span>
                      <span className="text-gray-400 dark:text-gray-500 text-xs ml-1.5">{def.label}</span>
                      {entry.notes && <span className="text-gray-400 dark:text-gray-500 text-xs ml-1.5">· {entry.notes}</span>}
                    </span>
                    {status && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${STATUS_STYLE[status]}`}>
                        {STATUS_LABEL[status]}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{timeAgo(entry.loggedAt)}</span>
                    <button onClick={() => deleteEntry(entry.id)}
                      className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors rounded flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>

      {/* Log modal */}
      {logDef && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setLogType(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <logDef.icon className="w-5 h-5 text-teal-500" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Log {logDef.label}</h3>
            </div>

            {logDef.hasDual ? (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="label">Systolic</label>
                  <input className="input" type="number" placeholder="120" value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })} autoFocus />
                </div>
                <div className="flex-1">
                  <label className="label">Diastolic</label>
                  <input className="input" type="number" placeholder="80" value={form.value2}
                    onChange={(e) => setForm({ ...form, value2: e.target.value })} />
                </div>
              </div>
            ) : (
              <div>
                <label className="label">{logDef.label} ({logDef.unit})</label>
                <input
                  className="input" type="number" step="0.1"
                  placeholder={logDef.type === "temperature" ? "36.6" : logDef.type === "spo2" ? "98" : logDef.type === "glucose" ? "110" : "72"}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  autoFocus
                />
                {logDef.normalRange && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Normal: {logDef.normalRange}</p>
                )}
              </div>
            )}

            <div>
              <label className="label">Notes (optional)</label>
              <input className="input" placeholder="e.g. after meal, fasting…" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && save()} />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={save} className="btn-primary flex-1">Save</button>
              <button onClick={() => setLogType(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
