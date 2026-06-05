"use client";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import toast from "react-hot-toast";
import { HeartPulse, Droplets, Scale, Heart, Gauge, Thermometer, Wind, TrendingUp, Plus, Trash2, Pencil, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import { usePersonContext } from "@/contexts/PersonContext";
import type { VitalEntry, VitalType, HealthProfile } from "@/lib/storage";

// ─── Vital definitions ────────────────────────────────────────────────────────

const HOME_VITALS = [
  { type: "bp"               as VitalType, label: "Blood Pressure",    unit: "mmHg",        icon: HeartPulse,  hasDual: true,  normalRange: "90–120 / 60–80 mmHg", priority: "featured"   as const },
  { type: "glucose"          as VitalType, label: "Blood Glucose",     unit: "mg/dL",       icon: Droplets,    hasDual: false, normalRange: "70–140 mg/dL",         priority: "featured"   as const },
  { type: "weight"           as VitalType, label: "Weight",            unit: "kg",          icon: Scale,       hasDual: false, normalRange: null,                   priority: "regular"    as const },
  { type: "heart_rate"       as VitalType, label: "Heart Rate",        unit: "bpm",         icon: Heart,       hasDual: false, normalRange: "60–100 bpm",           priority: "regular"    as const },
  { type: "temperature"      as VitalType, label: "Temperature",       unit: "°C",          icon: Thermometer, hasDual: false, normalRange: "36.1–37.2 °C",         priority: "regular"    as const },
  { type: "spo2"             as VitalType, label: "Oxygen (SpO₂)",     unit: "%",           icon: Gauge,       hasDual: false, normalRange: "≥ 95%",                priority: "secondary"  as const },
  { type: "respiratory_rate" as VitalType, label: "Respiratory Rate",  unit: "breaths/min", icon: Wind,        hasDual: false, normalRange: "12–20 breaths/min",    priority: "secondary"  as const },
];

const LAB_VITALS = [
  { type: "hba1c"       as VitalType, label: "HbA1c",              unit: "%",     icon: Droplets,   hasDual: false, normalRange: "< 5.7% (normal) · 5.7–6.4% (pre-diabetic) · ≥ 6.5% (diabetic)" },
  { type: "cholesterol" as VitalType, label: "Total Cholesterol",  unit: "mg/dL", icon: TrendingUp,  hasDual: false, normalRange: "< 200 mg/dL (optimal)" },
  { type: "hemoglobin"  as VitalType, label: "Hemoglobin",         unit: "g/dL",  icon: HeartPulse,  hasDual: false, normalRange: "M: 13.5–17.5 · F: 12–15.5 g/dL" },
  { type: "creatinine"  as VitalType, label: "Creatinine",         unit: "mg/dL", icon: Gauge,       hasDual: false, normalRange: "M: 0.7–1.3 · F: 0.6–1.1 mg/dL" },
];

const ALL_DEFS = [...HOME_VITALS, ...LAB_VITALS];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatus(type: VitalType, value: number, value2?: number): "normal" | "warning" | "danger" {
  switch (type) {
    case "bp":          return value <= 120 && (value2 ?? 0) <= 80 ? "normal" : value <= 140 && (value2 ?? 0) <= 90 ? "warning" : "danger";
    case "glucose":     return value >= 70 && value <= 140 ? "normal" : value <= 200 ? "warning" : "danger";
    case "spo2":        return value >= 95 ? "normal" : value >= 90 ? "warning" : "danger";
    case "heart_rate":  return value >= 60 && value <= 100 ? "normal" : value >= 40 && value <= 120 ? "warning" : "danger";
    case "temperature": return value >= 36.1 && value <= 37.2 ? "normal" : value <= 38.0 ? "warning" : "danger";
    case "respiratory_rate": return value >= 12 && value <= 20 ? "normal" : value <= 25 ? "warning" : "danger";
    case "hba1c":       return value < 5.7 ? "normal" : value < 6.5 ? "warning" : "danger";
    case "cholesterol": return value < 200 ? "normal" : value < 240 ? "warning" : "danger";
    case "hemoglobin":  return value >= 12 && value <= 17.5 ? "normal" : "warning";
    case "creatinine":  return value >= 0.6 && value <= 1.3 ? "normal" : "warning";
    default: return "normal";
  }
}

const STATUS_STYLE = {
  normal:  "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  warning: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  danger:  "bg-red-100  dark:bg-red-900/30  text-red-600  dark:text-red-400",
};
const STATUS_LABEL = { normal: "Normal", warning: "Watch", danger: "High" };

function formatValue(entry: VitalEntry): string {
  return entry.value2 != null ? `${entry.value}/${entry.value2} ${entry.unit}` : `${entry.value} ${entry.unit}`;
}

function timeAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  return `${d}d ago`;
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const W = 56, H = 20, P = 2;
  const pts = values.map((v, i) => [P + (i / (values.length - 1)) * (W - P * 2), P + (1 - (v - min) / range) * (H - P * 2)]);
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg width={W} height={H} className="text-teal-400 flex-shrink-0">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const BMI_STATUS = (bmi: number) =>
  bmi < 18.5 ? { label: "Underweight", style: STATUS_STYLE.warning } :
  bmi < 25   ? { label: "Normal",      style: STATUS_STYLE.normal  } :
  bmi < 30   ? { label: "Overweight",  style: STATUS_STYLE.warning } :
               { label: "Obese",       style: STATUS_STYLE.danger  };

const BLOOD_TYPES = ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VitalsPage() {
  const { activePersonId } = usePersonContext();
  const [entries, setEntries] = useState<VitalEntry[]>([]);
  const [profile, setProfile] = useState<HealthProfile>({});
  const [profileDraft, setProfileDraft] = useState<HealthProfile>({});
  const [editingProfile, setEditingProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logType, setLogType] = useState<VitalType | null>(null);
  const [form, setForm] = useState({ value: "", value2: "", notes: "" });
  const [cholForm, setCholForm] = useState({ total: "", ldl: "", hdl: "", tg: "" });

  useEffect(() => {
    if (!activePersonId) return;
    Promise.all([api.vitals.getAll(), api.healthProfile.get()]).then(([v, p]) => {
      setEntries(v); setProfile(p); setLoading(false);
    });
  }, [activePersonId]);

  function openEditProfile() { setProfileDraft({ ...profile }); setEditingProfile(true); }

  async function saveProfile() {
    await api.healthProfile.set(profileDraft);
    setProfile(profileDraft);
    setEditingProfile(false);
    toast.success("Basic info saved");
  }

  function openLog(type: VitalType) {
    setLogType(type);
    setForm({ value: "", value2: "", notes: "" });
    setCholForm({ total: "", ldl: "", hdl: "", tg: "" });
  }

  async function save() {
    if (!logType) return;
    const def = ALL_DEFS.find((d) => d.type === logType)!;

    let value: number, value2: number | undefined, notes: string;
    if (logType === "cholesterol") {
      value = parseFloat(cholForm.total);
      if (isNaN(value)) { toast.error("Enter total cholesterol"); return; }
      const parts = [cholForm.ldl && `LDL: ${cholForm.ldl}`, cholForm.hdl && `HDL: ${cholForm.hdl}`, cholForm.tg && `TG: ${cholForm.tg}`].filter(Boolean);
      notes = parts.join(" · ");
    } else {
      value = parseFloat(form.value);
      if (isNaN(value)) { toast.error("Enter a valid number"); return; }
      if (def.hasDual && isNaN(parseFloat(form.value2))) { toast.error("Enter both values"); return; }
      value2 = def.hasDual ? parseFloat(form.value2) : undefined;
      notes = form.notes;
    }

    const entry: VitalEntry = { id: uuidv4(), type: logType, value, value2, unit: def.unit, notes, loggedAt: new Date().toISOString() };
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
      const def = ALL_DEFS.find((d) => d.type === entry.type);
      api.activity.push({ type: "vital", label: `Deleted ${def?.label ?? "vital"}: ${formatValue(entry)}`, at: new Date().toISOString(), deleted: true });
    }
    setEntries(await api.vitals.getAll());
  }

  const byType = (type: VitalType) =>
    entries.filter((e) => e.type === type).sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());

  const latestWeight = byType("weight")[0]?.value;
  const bmi = latestWeight && profile.heightCm ? latestWeight / Math.pow(profile.heightCm / 100, 2) : null;

  const history = [...entries].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()).slice(0, 30);

  const logDef = logType ? ALL_DEFS.find((d) => d.type === logType)! : null;

  const STATUS_BORDER = {
    normal:  "border-l-green-400 dark:border-l-green-500",
    warning: "border-l-amber-400 dark:border-l-amber-500",
    danger:  "border-l-red-400 dark:border-l-red-500",
  };

  function VitalCard({ def, featured = false }: { def: typeof ALL_DEFS[0]; featured?: boolean }) {
    const list = byType(def.type);
    const latest = list[0];
    const spark = list.slice(0, 10).reverse().map((e) => e.value);
    const status = latest && def.type !== "weight" ? getStatus(def.type, latest.value, latest.value2) : null;
    const Icon = def.icon;
    const borderClass = status && latest ? `border-l-4 ${STATUS_BORDER[status]}` : "";
    return (
      <div className={`card flex flex-col gap-1 ${borderClass}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <Icon className={`flex-shrink-0 text-teal-500 ${featured ? "w-4 h-4" : "w-3.5 h-3.5"}`} />
            <span className={`font-medium text-gray-500 dark:text-gray-400 truncate ${featured ? "text-sm" : "text-xs"}`}>{def.label}</span>
          </div>
          <button onClick={() => openLog(def.type)} className="p-1 rounded-lg text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors flex-shrink-0">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        {latest ? (
          <>
            <p className={`font-bold text-gray-900 dark:text-gray-100 leading-tight mt-0.5 ${featured ? "text-2xl" : "text-xl"}`}>{formatValue(latest)}</p>
            {latest.notes && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{latest.notes}</p>}
            <p className="text-xs text-gray-400 dark:text-gray-500">{timeAgo(latest.loggedAt)}</p>
            <div className="flex items-center justify-between mt-1">
              <Sparkline values={spark} />
              {status && <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>}
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No readings yet</p>
        )}
      </div>
    );
  }

  function AdditionalReadings({ defs }: { defs: typeof HOME_VITALS }) {
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mb-2"
        >
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {open ? "Hide" : "Show"} additional readings
        </button>
        {open && (
          <div className="grid grid-cols-2 gap-3">
            {defs.map((def) => <VitalCard key={def.type} def={def} />)}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <TopBar />
      <main className="p-4 sm:p-6 max-w-3xl space-y-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Vitals</h2>

        {/* ── Section 1: Basic Info ───────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Basic Info</h3>
            {!editingProfile
              ? <button onClick={openEditProfile} className="flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 hover:underline"><Pencil className="w-3 h-3" /> Edit</button>
              : <div className="flex gap-2">
                  <button onClick={saveProfile} className="flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 hover:underline"><Check className="w-3 h-3" /> Save</button>
                  <button onClick={() => setEditingProfile(false)} className="flex items-center gap-1 text-xs text-gray-400 hover:underline"><X className="w-3 h-3" /> Cancel</button>
                </div>}
          </div>

          <div className="card">
            {editingProfile ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Age (years)</label>
                  <input className="input" type="number" min="0" max="130" placeholder="e.g. 65"
                    value={profileDraft.age ?? ""} onChange={(e) => setProfileDraft({ ...profileDraft, age: e.target.value ? parseInt(e.target.value) : undefined })} />
                </div>
                <div>
                  <label className="label">Height (cm)</label>
                  <input className="input" type="number" min="50" max="250" placeholder="e.g. 165"
                    value={profileDraft.heightCm ?? ""} onChange={(e) => setProfileDraft({ ...profileDraft, heightCm: e.target.value ? parseFloat(e.target.value) : undefined })} />
                </div>
                <div>
                  <label className="label">Gender</label>
                  <select className="input" value={profileDraft.gender ?? ""} onChange={(e) => setProfileDraft({ ...profileDraft, gender: e.target.value as HealthProfile["gender"] || undefined })}>
                    <option value="">Not specified</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="label">Blood Type</label>
                  <select className="input" value={profileDraft.bloodType ?? ""} onChange={(e) => setProfileDraft({ ...profileDraft, bloodType: e.target.value || undefined })}>
                    <option value="">Unknown</option>
                    {BLOOD_TYPES.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Age", value: profile.age ? `${profile.age} yrs` : "—" },
                  { label: "Height", value: profile.heightCm ? `${profile.heightCm} cm` : "—" },
                  { label: "Gender", value: profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : "—" },
                  { label: "Blood Type", value: profile.bloodType ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{value}</p>
                  </div>
                ))}
                {bmi !== null && (
                  <div className="col-span-2 sm:col-span-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-3">
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">BMI</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{bmi.toFixed(1)}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${BMI_STATUS(bmi).style}`}>{BMI_STATUS(bmi).label}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">from latest weight</span>
                  </div>
                )}
                {!profile.age && !profile.heightCm && !profile.gender && (
                  <p className="col-span-2 sm:col-span-4 text-sm text-gray-400 dark:text-gray-500">Tap Edit to add basic info</p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── Section 2: At-Home Readings ─────────────────────────────────── */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">At-Home Readings</h3>
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="space-y-3">
              {/* Featured: BP + Glucose — larger cards */}
              <div className="grid grid-cols-2 gap-3">
                {HOME_VITALS.filter((d) => d.priority === "featured").map((def) => (
                  <VitalCard key={def.type} def={def} featured />
                ))}
              </div>
              {/* Regular vitals */}
              <div className="grid grid-cols-2 gap-3">
                {HOME_VITALS.filter((d) => d.priority === "regular").map((def) => (
                  <VitalCard key={def.type} def={def} />
                ))}
              </div>
              {/* Secondary vitals — collapsible */}
              <AdditionalReadings defs={HOME_VITALS.filter((d) => d.priority === "secondary")} />
            </div>
          )}
        </section>

        {/* ── Section 3: Lab Results ───────────────────────────────────────── */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">Lab Results</h3>
          <div className="grid grid-cols-2 gap-3">
            {LAB_VITALS.map((def) => <VitalCard key={def.type} def={def} />)}
          </div>
        </section>

        {/* ── History ─────────────────────────────────────────────────────── */}
        {history.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">History</h3>
            <div className="card">
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {history.map((entry) => {
                  const def = ALL_DEFS.find((d) => d.type === entry.type);
                  if (!def) return null;
                  const Icon = def.icon;
                  const status = def.type !== "weight" ? getStatus(entry.type, entry.value, entry.value2) : null;
                  return (
                    <li key={entry.id} className="py-2.5 flex items-center gap-3 text-sm">
                      <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="flex-1 min-w-0 text-gray-700 dark:text-gray-300">
                        <span className="font-medium">{formatValue(entry)}</span>
                        <span className="text-gray-400 dark:text-gray-500 text-xs ml-1.5">{def.label}</span>
                        {entry.notes && <span className="text-gray-400 dark:text-gray-500 text-xs ml-1.5">· {entry.notes}</span>}
                      </span>
                      {status && <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>}
                      <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{timeAgo(entry.loggedAt)}</span>
                      <button onClick={() => deleteEntry(entry.id)} className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors rounded flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}
      </main>

      {/* ── Log Modal ────────────────────────────────────────────────────── */}
      {logDef && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setLogType(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <logDef.icon className="w-5 h-5 text-teal-500" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Log {logDef.label}</h3>
            </div>

            {logType === "cholesterol" ? (
              <div className="space-y-3">
                <div>
                  <label className="label">Total Cholesterol (mg/dL) *</label>
                  <input className="input" type="number" placeholder="e.g. 185" value={cholForm.total}
                    onChange={(e) => setCholForm({ ...cholForm, total: e.target.value })} autoFocus />
                  {logDef.normalRange && <p className="text-xs text-gray-400 mt-1">Normal: {logDef.normalRange}</p>}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="label">LDL</label><input className="input" type="number" placeholder="e.g. 110" value={cholForm.ldl} onChange={(e) => setCholForm({ ...cholForm, ldl: e.target.value })} /></div>
                  <div><label className="label">HDL</label><input className="input" type="number" placeholder="e.g. 55" value={cholForm.hdl} onChange={(e) => setCholForm({ ...cholForm, hdl: e.target.value })} /></div>
                  <div><label className="label">TG</label><input className="input" type="number" placeholder="e.g. 150" value={cholForm.tg} onChange={(e) => setCholForm({ ...cholForm, tg: e.target.value })} /></div>
                </div>
              </div>
            ) : logDef.hasDual ? (
              <div className="flex gap-3">
                <div className="flex-1"><label className="label">Systolic</label><input className="input" type="number" placeholder="120" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} autoFocus /></div>
                <div className="flex-1"><label className="label">Diastolic</label><input className="input" type="number" placeholder="80" value={form.value2} onChange={(e) => setForm({ ...form, value2: e.target.value })} /></div>
              </div>
            ) : (
              <div>
                <label className="label">{logDef.label} ({logDef.unit})</label>
                <input className="input" type="number" step="0.1"
                  placeholder={logType === "temperature" ? "36.6" : logType === "spo2" ? "98" : logType === "hba1c" ? "5.4" : logType === "creatinine" ? "0.9" : ""}
                  value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} autoFocus />
                {logDef.normalRange && <p className="text-xs text-gray-400 mt-1">Normal: {logDef.normalRange}</p>}
              </div>
            )}

            {logType !== "cholesterol" && (
              <div>
                <label className="label">Notes (optional)</label>
                <input className="input" placeholder="e.g. fasting, after meal…" value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && save()} />
              </div>
            )}

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
