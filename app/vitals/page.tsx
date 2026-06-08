"use client";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import toast from "react-hot-toast";
import { HeartPulse, Droplets, Scale, Heart, Gauge, Thermometer, Wind, TrendingUp, Plus, Trash2, Pencil, Check, X, ChevronDown, ChevronUp, Zap, BarChart2, SlidersHorizontal, FlaskConical, Microscope, Activity, Filter } from "lucide-react";
import TopBar from "@/components/TopBar";
import { nowIST } from "@/lib/time";
import { api } from "@/lib/api";
import { storage } from "@/lib/storage";
import { usePersonContext } from "@/contexts/PersonContext";
import type { VitalEntry, VitalType, HealthProfile, CustomVitalRange } from "@/lib/storage";

// ─── Vital definitions ────────────────────────────────────────────────────────

const HOME_VITALS = [
  { type: "bp"               as VitalType, label: "Blood Pressure",    unit: "mmHg",        icon: HeartPulse,  hasDual: true,  normalRange: "90–120 / 60–80 mmHg", priority: "featured"   as const },
  { type: "glucose"          as VitalType, label: "Blood Glucose",     unit: "mg/dL",       icon: Droplets,    hasDual: false, normalRange: "70–140 mg/dL",         priority: "featured"   as const },
  { type: "weight"           as VitalType, label: "Weight",            unit: "kg",          icon: Scale,       hasDual: false, normalRange: null,                   priority: "regular"    as const },
  { type: "heart_rate"       as VitalType, label: "Heart Rate",        unit: "bpm",         icon: Heart,       hasDual: false, normalRange: "60–100 bpm",           priority: "regular"    as const },
  { type: "temperature"      as VitalType, label: "Temperature",       unit: "°C",          icon: Thermometer, hasDual: false, normalRange: "36.1–37.2 °C",         priority: "regular"    as const },
  { type: "spo2"             as VitalType, label: "Oxygen (SpO₂)",     unit: "%",           icon: Gauge,       hasDual: false, normalRange: "≥ 95%",                priority: "secondary"  as const },
  { type: "respiratory_rate" as VitalType, label: "Respiratory Rate",  unit: "breaths/min", icon: Wind,        hasDual: false, normalRange: "12–20 breaths/min",    priority: "secondary"  as const },
  { type: "pain"             as VitalType, label: "Pain Level",        unit: "/10",         icon: Zap,         hasDual: false, normalRange: "1–3 mild · 4–6 moderate · 7–10 severe", priority: "secondary" as const },
];

const LAB_GROUPS = [
  { key: "metabolic", title: "Metabolic", defs: [
    { type: "hba1c"       as VitalType, label: "HbA1c",            unit: "%",        icon: Droplets,     hasDual: false, normalRange: "< 5.7% normal · 5.7–6.4% pre-diabetic · ≥ 6.5% diabetic" },
    { type: "cholesterol" as VitalType, label: "Total Cholesterol", unit: "mg/dL",    icon: TrendingUp,   hasDual: false, normalRange: "< 200 mg/dL (optimal)" },
  ]},
  { key: "cbc", title: "Blood Panel (CBC)", defs: [
    { type: "hemoglobin"  as VitalType, label: "Hemoglobin",        unit: "g/dL",     icon: HeartPulse,   hasDual: false, normalRange: "M: 13.5–17.5 · F: 12–15.5 g/dL" },
    { type: "wbc"         as VitalType, label: "WBC",               unit: "×10³/µL",  icon: Microscope,   hasDual: false, normalRange: "4.5–11.0 ×10³/µL" },
    { type: "rbc"         as VitalType, label: "RBC",               unit: "×10⁶/µL", icon: Microscope,   hasDual: false, normalRange: "M: 4.7–6.1 · F: 4.2–5.4 ×10⁶/µL" },
    { type: "platelets"   as VitalType, label: "Platelets",         unit: "×10³/µL",  icon: Microscope,   hasDual: false, normalRange: "150–400 ×10³/µL" },
  ]},
  { key: "lft", title: "Liver (LFT)", defs: [
    { type: "alt"         as VitalType, label: "ALT (SGPT)",        unit: "U/L",      icon: Activity,     hasDual: false, normalRange: "< 56 U/L" },
    { type: "ast"         as VitalType, label: "AST (SGOT)",        unit: "U/L",      icon: Activity,     hasDual: false, normalRange: "< 40 U/L" },
    { type: "alp"         as VitalType, label: "ALP",               unit: "U/L",      icon: Activity,     hasDual: false, normalRange: "44–147 U/L" },
    { type: "bilirubin"   as VitalType, label: "Bilirubin (Total)", unit: "mg/dL",    icon: Activity,     hasDual: false, normalRange: "0.1–1.2 mg/dL" },
    { type: "albumin"     as VitalType, label: "Albumin",           unit: "g/dL",     icon: Activity,     hasDual: false, normalRange: "3.5–5.0 g/dL" },
  ]},
  { key: "kidney", title: "Kidney / Renal", defs: [
    { type: "creatinine"  as VitalType, label: "Creatinine",        unit: "mg/dL",    icon: Filter,       hasDual: false, normalRange: "M: 0.7–1.3 · F: 0.6–1.1 mg/dL" },
    { type: "bun"         as VitalType, label: "BUN / Urea",        unit: "mg/dL",    icon: Filter,       hasDual: false, normalRange: "7–20 mg/dL" },
    { type: "uric_acid"   as VitalType, label: "Uric Acid",         unit: "mg/dL",    icon: Filter,       hasDual: false, normalRange: "M: 3.4–7.0 · F: 2.4–6.0 mg/dL" },
    { type: "egfr"        as VitalType, label: "eGFR",              unit: "mL/min",   icon: Filter,       hasDual: false, normalRange: "≥ 60 mL/min/1.73m²" },
  ]},
  { key: "thyroid", title: "Thyroid", defs: [
    { type: "tsh"         as VitalType, label: "TSH",               unit: "mIU/L",    icon: Activity,     hasDual: false, normalRange: "0.4–4.0 mIU/L" },
    { type: "t3"          as VitalType, label: "T3 (Total)",        unit: "ng/dL",    icon: Activity,     hasDual: false, normalRange: "80–200 ng/dL" },
    { type: "t4"          as VitalType, label: "T4 (Total)",        unit: "µg/dL",    icon: Activity,     hasDual: false, normalRange: "5.1–14.1 µg/dL" },
  ]},
  { key: "electrolytes", title: "Electrolytes", defs: [
    { type: "sodium"      as VitalType, label: "Sodium",            unit: "mEq/L",    icon: Zap,          hasDual: false, normalRange: "136–145 mEq/L" },
    { type: "potassium"   as VitalType, label: "Potassium",         unit: "mEq/L",    icon: Zap,          hasDual: false, normalRange: "3.5–5.1 mEq/L" },
    { type: "calcium"     as VitalType, label: "Calcium",           unit: "mg/dL",    icon: Zap,          hasDual: false, normalRange: "8.5–10.5 mg/dL" },
  ]},
  { key: "iron", title: "Iron Studies", defs: [
    { type: "serum_iron"  as VitalType, label: "Serum Iron",        unit: "µg/dL",    icon: FlaskConical, hasDual: false, normalRange: "60–170 µg/dL" },
    { type: "ferritin"    as VitalType, label: "Ferritin",          unit: "ng/mL",    icon: FlaskConical, hasDual: false, normalRange: "M: 12–300 · F: 12–150 ng/mL" },
  ]},
];

const LAB_ALL_DEFS = LAB_GROUPS.flatMap((g) => g.defs);
const ALL_DEFS = [...HOME_VITALS, ...LAB_ALL_DEFS];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatus(type: VitalType, value: number, value2?: number, custom?: CustomVitalRange): "normal" | "warning" | "danger" {
  if (custom?.low !== undefined && custom?.high !== undefined) {
    const inRange = value >= custom.low && value <= custom.high;
    if (type === "bp" && value2 !== undefined && custom.low2 !== undefined && custom.high2 !== undefined) {
      return inRange && value2 >= custom.low2 && value2 <= custom.high2 ? "normal" : "warning";
    }
    return inRange ? "normal" : "warning";
  }
  switch (type) {
    case "bp":           return value <= 120 && (value2 ?? 0) <= 80 ? "normal" : value <= 140 && (value2 ?? 0) <= 90 ? "warning" : "danger";
    case "glucose":      return value >= 70 && value <= 140 ? "normal" : value <= 200 ? "warning" : "danger";
    case "spo2":         return value >= 95 ? "normal" : value >= 90 ? "warning" : "danger";
    case "heart_rate":   return value >= 60 && value <= 100 ? "normal" : value >= 40 && value <= 120 ? "warning" : "danger";
    case "temperature":  return value >= 36.1 && value <= 37.2 ? "normal" : value <= 38.0 ? "warning" : "danger";
    case "respiratory_rate": return value >= 12 && value <= 20 ? "normal" : value <= 25 ? "warning" : "danger";
    case "hba1c":        return value < 5.7 ? "normal" : value < 6.5 ? "warning" : "danger";
    case "cholesterol":  return value < 200 ? "normal" : value < 240 ? "warning" : "danger";
    case "hemoglobin":   return value >= 12 && value <= 17.5 ? "normal" : "warning";
    case "creatinine":   return value >= 0.6 && value <= 1.3 ? "normal" : "warning";
    case "pain":         return value <= 3 ? "normal" : value <= 6 ? "warning" : "danger";
    // LFT
    case "alt":          return value < 56 ? "normal" : value < 100 ? "warning" : "danger";
    case "ast":          return value < 40 ? "normal" : value < 80 ? "warning" : "danger";
    case "alp":          return value >= 44 && value <= 147 ? "normal" : value <= 200 ? "warning" : "danger";
    case "bilirubin":    return value <= 1.2 ? "normal" : value <= 2.0 ? "warning" : "danger";
    case "albumin":      return value >= 3.5 && value <= 5.0 ? "normal" : value >= 3.0 ? "warning" : "danger";
    // Thyroid
    case "tsh":          return value >= 0.4 && value <= 4.0 ? "normal" : value >= 0.1 && value <= 10 ? "warning" : "danger";
    case "t3":           return value >= 80 && value <= 200 ? "normal" : "warning";
    case "t4":           return value >= 5.1 && value <= 14.1 ? "normal" : "warning";
    // CBC
    case "wbc":          return value >= 4.5 && value <= 11.0 ? "normal" : value >= 3.0 && value <= 15 ? "warning" : "danger";
    case "rbc":          return value >= 4.2 && value <= 6.1 ? "normal" : "warning";
    case "platelets":    return value >= 150 && value <= 400 ? "normal" : value >= 100 && value <= 600 ? "warning" : "danger";
    // Kidney
    case "bun":          return value >= 7 && value <= 20 ? "normal" : value <= 40 ? "warning" : "danger";
    case "uric_acid":    return value >= 2.4 && value <= 7.0 ? "normal" : value <= 9.0 ? "warning" : "danger";
    case "egfr":         return value >= 60 ? "normal" : value >= 30 ? "warning" : "danger";
    // Electrolytes
    case "sodium":       return value >= 136 && value <= 145 ? "normal" : value >= 125 && value <= 155 ? "warning" : "danger";
    case "potassium":    return value >= 3.5 && value <= 5.1 ? "normal" : value >= 3.0 && value <= 6.0 ? "warning" : "danger";
    case "calcium":      return value >= 8.5 && value <= 10.5 ? "normal" : value >= 7.5 && value <= 11.5 ? "warning" : "danger";
    // Iron
    case "serum_iron":   return value >= 50 && value <= 170 ? "normal" : "warning";
    case "ferritin":     return value >= 12 && value <= 300 ? "normal" : "warning";
    default: return "normal";
  }
}

const STATUS_STYLE = {
  normal:  "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  warning: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  danger:  "bg-red-100  dark:bg-red-900/30  text-red-600  dark:text-red-400",
};
const STATUS_LABEL = { normal: "Normal", warning: "Caution", danger: "Critical" };

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

// Numeric normal ranges for trend chart bands [low, high]
const NUMERIC_RANGES: Partial<Record<VitalType, [number, number]>> = {
  bp:               [90, 120],
  glucose:          [70, 140],
  heart_rate:       [60, 100],
  temperature:      [36.1, 37.2],
  spo2:             [95, 100],
  respiratory_rate: [12, 20],
  hba1c:            [0, 5.7],
  cholesterol:      [0, 200],
  pain:             [1, 3],
  hemoglobin:       [12, 17.5],
  wbc:              [4.5, 11.0],
  rbc:              [4.2, 6.1],
  platelets:        [150, 400],
  alt:              [0, 56],
  ast:              [0, 40],
  alp:              [44, 147],
  bilirubin:        [0.1, 1.2],
  albumin:          [3.5, 5.0],
  creatinine:       [0.6, 1.3],
  bun:              [7, 20],
  uric_acid:        [2.4, 7.0],
  egfr:             [60, 120],
  tsh:              [0.4, 4.0],
  t3:               [80, 200],
  t4:               [5.1, 14.1],
  sodium:           [136, 145],
  potassium:        [3.5, 5.1],
  calcium:          [8.5, 10.5],
  serum_iron:       [50, 170],
  ferritin:         [12, 300],
};

// ─── Page ─────────────────────────────────────────────────────────────────────

// Feature 17: Collapsible section with summary stats — defined outside to avoid nested-hook issues
function CollapsibleSection({
  title, summary, defaultOpen = true, children,
}: { title: string; summary?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 mb-3 group"
      >
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 flex-shrink-0">{title}</span>
          {summary && !open && (
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate font-normal">{summary}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
      </button>
      {open && children}
    </div>
  );
}

export default function VitalsPage() {
  const { activePersonId } = usePersonContext();
  const [entries, setEntries] = useState<VitalEntry[]>([]);
  const [profile, setProfile] = useState<HealthProfile>({});
  const [profileDraft, setProfileDraft] = useState<HealthProfile>({});
  const [editingProfile, setEditingProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logType, setLogType] = useState<VitalType | null>(null);
  const [trendType, setTrendType] = useState<VitalType | null>(null);
  const [form, setForm] = useState({ value: "", value2: "", notes: "", loggedAt: "" });
  const [cholForm, setCholForm] = useState({ total: "", ldl: "", hdl: "", tg: "" });
  const [customRanges, setCustomRanges] = useState<Partial<Record<VitalType, CustomVitalRange>>>({});
  const [customRangeType, setCustomRangeType] = useState<VitalType | null>(null);
  const [customRangeForm, setCustomRangeForm] = useState({ low: "", high: "", low2: "", high2: "" });

  useEffect(() => {
    if (!activePersonId) return;
    Promise.all([api.vitals.getAll(), api.healthProfile.get()]).then(([v, p]) => {
      setEntries(v); setProfile(p); setLoading(false);
    });
    setCustomRanges(storage.customVitalRanges.get(activePersonId));
  }, [activePersonId]);

  function openEditProfile() { setProfileDraft({ ...profile }); setEditingProfile(true); }

  async function saveProfile() {
    await api.healthProfile.set(profileDraft);
    setProfile(profileDraft);
    setEditingProfile(false);
    toast.success("Basic info saved");
  }

  function openCustomRange(type: VitalType) {
    const existing = customRanges[type];
    setCustomRangeForm({
      low: existing?.low?.toString() ?? "",
      high: existing?.high?.toString() ?? "",
      low2: existing?.low2?.toString() ?? "",
      high2: existing?.high2?.toString() ?? "",
    });
    setCustomRangeType(type);
  }

  function saveCustomRange() {
    if (!customRangeType) return;
    const low = parseFloat(customRangeForm.low);
    const high = parseFloat(customRangeForm.high);
    if (isNaN(low) || isNaN(high)) { toast.error("Enter valid low and high values"); return; }
    if (low >= high) { toast.error("Low must be less than high"); return; }
    const range: CustomVitalRange = { low, high };
    if (customRangeType === "bp") {
      const low2 = parseFloat(customRangeForm.low2);
      const high2 = parseFloat(customRangeForm.high2);
      if (!isNaN(low2) && !isNaN(high2) && low2 < high2) { range.low2 = low2; range.high2 = high2; }
    }
    const updated = { ...customRanges, [customRangeType]: range };
    storage.customVitalRanges.set(updated, activePersonId);
    setCustomRanges(updated);
    setCustomRangeType(null);
    toast.success("Doctor's target saved");
  }

  function clearCustomRange() {
    if (!customRangeType) return;
    const updated = { ...customRanges };
    delete updated[customRangeType];
    storage.customVitalRanges.set(updated, activePersonId);
    setCustomRanges(updated);
    setCustomRangeType(null);
    toast.success("Custom range cleared");
  }

  const VITAL_PLACEHOLDERS: Partial<Record<VitalType, string>> = {
    temperature: "36.6", spo2: "98", hba1c: "5.4", creatinine: "0.9",
    alt: "25", ast: "20", alp: "90", bilirubin: "0.8", albumin: "4.2",
    tsh: "2.0", t3: "130", t4: "8.0",
    wbc: "7.0", rbc: "5.0", platelets: "250",
    bun: "12", uric_acid: "5.0", egfr: "80",
    sodium: "140", potassium: "4.0", calcium: "9.5",
    serum_iron: "100", ferritin: "80",
  };

  const VITAL_DEFAULTS: Partial<Record<VitalType, { value: string; value2?: string }>> = {
    bp:             { value: "120", value2: "80" },
    heart_rate:     { value: "72" },
    temperature:    { value: "36.6" },
    spo2:           { value: "98" },
    respiratory_rate: { value: "16" },
    pain:           { value: "3" },
  };

  function openLog(type: VitalType) {
    setLogType(type);
    const d = VITAL_DEFAULTS[type] ?? {};
    setForm({ value: (d as { value?: string }).value || "", value2: (d as { value2?: string }).value2 || "", notes: "", loggedAt: nowIST() });
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
      if (logType === "pain" && (value < 1 || value > 10)) { toast.error("Pain level must be between 1 and 10"); return; }
      if (def.hasDual && isNaN(parseFloat(form.value2))) { toast.error("Enter both values"); return; }
      value2 = def.hasDual ? parseFloat(form.value2) : undefined;
      notes = form.notes;
    }

    const entry: VitalEntry = { id: uuidv4(), type: logType, value, value2, unit: def.unit, notes, loggedAt: form.loggedAt ? new Date(form.loggedAt).toISOString() : new Date().toISOString() };
    await api.vitals.save(entry);
    api.activity.push({ type: "vital", label: `Logged ${def.label}: ${formatValue(entry)}`, at: entry.loggedAt });
    setEntries(await api.vitals.getAll());
    setLogType(null);
    toast.success(`${def.label} logged`);
  }

  function deleteEntry(id: string) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    const prevEntries = [...entries];
    setEntries((prev) => prev.filter((e) => e.id !== id));
    let undone = false;
    const tid = `undo-vital-${id}`;
    const def = ALL_DEFS.find((d) => d.type === entry.type);
    toast.custom(
      (t) => (
        <div className={`flex items-center gap-3 bg-gray-900 text-white pl-4 pr-3 py-3 rounded-xl shadow-lg max-w-xs transition-all ${t.visible ? "opacity-100" : "opacity-0"}`}>
          <span className="text-sm flex-1">Reading deleted</span>
          <button
            onClick={() => { undone = true; toast.dismiss(tid); setEntries(prevEntries); }}
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
        await api.vitals.delete(id);
        api.activity.push({ type: "vital", label: `Deleted ${def?.label ?? "vital"}: ${formatValue(entry)}`, at: new Date().toISOString(), deleted: true });
      }
    }, 5100);
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

  // Feature 17: summary text for a section header — must be before nested components
  const sectionSummary = (types: VitalType[], maxItems = 2): string =>
    types
      .map((type) => {
        const latest = byType(type)[0];
        if (!latest) return null;
        const def = ALL_DEFS.find((d) => d.type === type);
        const status = type !== "weight" ? getStatus(type, latest.value, latest.value2, customRanges[type]) : null;
        return `${def?.label ?? type}: ${formatValue(latest)}${status ? ` — ${STATUS_LABEL[status]}` : ""}`;
      })
      .filter((x): x is string => Boolean(x))
      .slice(0, maxItems)
      .join(" · ");

  function VitalCard({ def, featured = false }: { def: typeof ALL_DEFS[0]; featured?: boolean }) {
    const list = byType(def.type);
    const latest = list[0];
    const spark = list.slice(0, 10).reverse().map((e) => e.value);
    const custom = customRanges[def.type];
    const status = latest && def.type !== "weight" ? getStatus(def.type, latest.value, latest.value2, custom) : null;
    const Icon = def.icon;
    const borderClass = status && latest ? `border-l-4 ${STATUS_BORDER[status]}` : "";
    const hasCustomRange = custom?.low !== undefined && custom?.high !== undefined;
    return (
      <div className={`card flex flex-col gap-1 ${borderClass}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <Icon className={`flex-shrink-0 text-teal-500 ${featured ? "w-4 h-4" : "w-3.5 h-3.5"}`} />
            <span className={`font-medium text-gray-500 dark:text-gray-400 truncate ${featured ? "text-sm" : "text-xs"}`}>{def.label}</span>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {def.type !== "weight" && (
              <button
                onClick={() => openCustomRange(def.type)}
                title="Set doctor's target range"
                aria-label={`Set target range for ${def.label}`}
                className={`p-1 rounded-lg transition-colors ${hasCustomRange ? "text-teal-600 dark:text-teal-400" : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-teal-600 dark:hover:text-teal-400"}`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            )}
            {list.length >= 1 && (
              <button onClick={() => setTrendType(def.type)} aria-label={`Show ${def.label} history`} className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
                <BarChart2 className="w-3 h-3" />
              </button>
            )}
            <button onClick={() => openLog(def.type)} aria-label={`Log ${def.label}`} className="p-1 rounded-lg text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
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
            {hasCustomRange ? (
              <p className="text-[10px] text-teal-600 dark:text-teal-400 mt-0.5 leading-tight font-medium">
                {"Doctor's target: "}
                {custom!.low}–{custom!.high}
                {def.type === "bp" && custom!.low2 !== undefined ? ` / ${custom!.low2}–${custom!.high2}` : ""}
                {" "}{def.unit}
              </p>
            ) : (
              "normalRange" in def && def.normalRange && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">Normal: {def.normalRange}</p>
              )
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No readings yet</p>
            {hasCustomRange ? (
              <p className="text-[10px] text-teal-600 dark:text-teal-400 leading-tight font-medium">
                {"Doctor's target: "}
                {custom!.low}–{custom!.high}
                {def.type === "bp" && custom!.low2 !== undefined ? ` / ${custom!.low2}–${custom!.high2}` : ""}
                {" "}{def.unit}
              </p>
            ) : (
              "normalRange" in def && def.normalRange && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">Normal: {def.normalRange}</p>
              )
            )}
          </>
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
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="space-y-4">
              {/* Featured + Regular: collapsible together as "Core Vitals" */}
              <CollapsibleSection
                title="Core Vitals"
                summary={sectionSummary(["bp", "glucose"] as VitalType[])}
                defaultOpen
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {HOME_VITALS.filter((d) => d.priority === "featured").map((def) => (
                      <VitalCard key={def.type} def={def} featured />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {HOME_VITALS.filter((d) => d.priority === "regular").map((def) => (
                      <VitalCard key={def.type} def={def} />
                    ))}
                  </div>
                </div>
              </CollapsibleSection>

              {/* Secondary vitals — collapsed by default */}
              <CollapsibleSection
                title="Additional Readings"
                summary={sectionSummary(["spo2", "pain"] as VitalType[], 1)}
                defaultOpen={false}
              >
                <div className="grid grid-cols-2 gap-3">
                  {HOME_VITALS.filter((d) => d.priority === "secondary").map((def) => (
                    <VitalCard key={def.type} def={def} />
                  ))}
                </div>
              </CollapsibleSection>
            </div>
          )}
        </section>

        {/* ── Section 3: Lab Results ───────────────────────────────────────── */}
        <section>
          <CollapsibleSection
            title="Lab Results"
            summary={sectionSummary(["hba1c", "cholesterol"] as VitalType[], 1)}
            defaultOpen={LAB_ALL_DEFS.some((d) => byType(d.type).length > 0)}
          >
            <div className="space-y-5">
              {LAB_GROUPS.map((group) => (
                <div key={group.key}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2 pl-0.5">{group.title}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {group.defs.map((def) => <VitalCard key={def.type} def={def} />)}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
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
                  const status = def.type !== "weight" ? getStatus(entry.type, entry.value, entry.value2, customRanges[entry.type]) : null;
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

      {/* ── Trend Modal ──────────────────────────────────────────────────── */}
      {trendType && (() => {
        const def = ALL_DEFS.find((d) => d.type === trendType)!;
        const TrendModal = () => {
          const [range, setRange] = useState<30 | 60 | 90>(30);
          const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - range);
          const data = entries
            .filter((e) => e.type === trendType && new Date(e.loggedAt) >= cutoff)
            .sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());

          const W = 420, H = 180;
          const pad = { t: 12, r: 12, b: 32, l: 44 };
          const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;

          const vals1 = data.map((e) => e.value);
          const vals2 = def.hasDual ? data.map((e) => e.value2 ?? e.value) : [];
          const allVals = [...vals1, ...vals2];
          const vMin = allVals.length ? Math.min(...allVals) : 0;
          const vMax = allVals.length ? Math.max(...allVals) : 1;
          const pad5 = (vMax - vMin) * 0.12 || 1;
          const lo = vMin - pad5, hi = vMax + pad5;

          const times = data.map((e) => new Date(e.loggedAt).getTime());
          const tMin = times.length ? Math.min(...times) : 0;
          const tMax = times.length ? Math.max(...times) : 1;

          function xOf(t: number) { return tMin === tMax ? cW / 2 : ((t - tMin) / (tMax - tMin)) * cW; }
          function yOf(v: number) { return cH - ((v - lo) / (hi - lo)) * cH; }

          const line1 = data.map((e, i) => `${i === 0 ? "M" : "L"} ${xOf(new Date(e.loggedAt).getTime()).toFixed(1)} ${yOf(e.value).toFixed(1)}`).join(" ");
          const line2 = def.hasDual ? data.map((e, i) => `${i === 0 ? "M" : "L"} ${xOf(new Date(e.loggedAt).getTime()).toFixed(1)} ${yOf(e.value2 ?? e.value).toFixed(1)}`).join(" ") : "";

          // Normal range band — use doctor's custom range if set
          const customNr = customRanges[trendType as VitalType];
          const nr = (customNr?.low !== undefined && customNr?.high !== undefined)
            ? [customNr.low, customNr.high] as [number, number]
            : NUMERIC_RANGES[trendType as VitalType];
          const bandTop = nr ? Math.max(0, yOf(nr[1])) : null;
          const bandBot = nr ? Math.min(cH, yOf(nr[0])) : null;

          // X-axis tick labels — up to 5 evenly spaced
          const tickCount = Math.min(data.length, 5);
          const tickIdxs = tickCount <= 1 ? [0] : Array.from({ length: tickCount }, (_, i) => Math.round((i / (tickCount - 1)) * (data.length - 1)));
          const xTicks = tickIdxs.map((idx) => ({
            x: xOf(new Date(data[idx].loggedAt).getTime()),
            label: new Date(data[idx].loggedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
          }));

          // Y-axis ticks
          const yTickVals = [lo, (lo + hi) / 2, hi];
          const avg1 = vals1.length ? vals1.reduce((a, b) => a + b, 0) / vals1.length : 0;
          const minVal = vals1.length ? Math.min(...vals1) : 0;
          const maxVal = vals1.length ? Math.max(...vals1) : 0;

          const dot1Color = (e: VitalEntry) => {
            if (def.type === "weight") return "#0D9488";
            const s = getStatus(def.type, e.value, e.value2, customRanges[def.type]);
            return s === "normal" ? "#0D9488" : s === "warning" ? "#F59E0B" : "#EF4444";
          };

          return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setTrendType(null)}>
              <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <def.icon className="w-5 h-5 text-teal-500" />
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{def.label} — Trend</h3>
                  </div>
                  <button onClick={() => setTrendType(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex gap-2">
                  {([30, 60, 90] as const).map((r) => (
                    <button key={r} onClick={() => setRange(r)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${range === r ? "bg-teal-600 border-teal-600 text-white" : "border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-teal-400"}`}>
                      {r}d
                    </button>
                  ))}
                  <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 self-center">{data.length} reading{data.length !== 1 ? "s" : ""}</span>
                </div>

                {data.length < 2 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">Not enough data for this period — add more readings to see a trend.</p>
                ) : (
                  <>
                    <div className="overflow-x-auto -mx-1">
                      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                        <g transform={`translate(${pad.l},${pad.t})`}>
                          {/* Grid */}
                          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                            <line key={f} x1={0} y1={f * cH} x2={cW} y2={f * cH} stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} className="text-gray-500 dark:text-gray-300" />
                          ))}
                          {/* Normal range band */}
                          {bandTop !== null && bandBot !== null && bandTop < bandBot && (
                            <rect x={0} y={bandTop} width={cW} height={bandBot - bandTop} fill="#0D9488" fillOpacity={0.08} />
                          )}
                          {/* Lines */}
                          <path d={line1} fill="none" stroke="#0D9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          {def.hasDual && line2 && (
                            <path d={line2} fill="none" stroke="#6366F1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          )}
                          {/* Dots */}
                          {data.map((e, i) => (
                            <circle key={i} cx={xOf(new Date(e.loggedAt).getTime())} cy={yOf(e.value)} r={3} fill={dot1Color(e)} />
                          ))}
                          {def.hasDual && data.map((e, i) => (
                            <circle key={`d2-${i}`} cx={xOf(new Date(e.loggedAt).getTime())} cy={yOf(e.value2 ?? e.value)} r={3} fill="#6366F1" />
                          ))}
                          {/* Y-axis labels */}
                          {yTickVals.map((v, i) => (
                            <text key={i} x={-6} y={yOf(v) + 4} textAnchor="end" fontSize={9} fill="currentColor" className="text-gray-400 dark:text-gray-500">
                              {v.toFixed(v < 10 ? 1 : 0)}
                            </text>
                          ))}
                          {/* X-axis labels */}
                          {xTicks.map((tick, i) => (
                            <text key={i} x={tick.x} y={cH + 20} textAnchor="middle" fontSize={9} fill="currentColor" className="text-gray-400 dark:text-gray-500">
                              {tick.label}
                            </text>
                          ))}
                        </g>
                      </svg>
                    </div>
                    {/* Legend for BP */}
                    {def.hasDual && (
                      <div className="flex gap-4 text-xs">
                        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-teal-500 inline-block rounded" />Systolic</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-indigo-500 inline-block rounded" />Diastolic</span>
                      </div>
                    )}
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-center">
                      {[
                        { label: "Min", value: minVal.toFixed(minVal < 10 ? 1 : 0) },
                        { label: "Avg", value: avg1.toFixed(avg1 < 10 ? 1 : 0) },
                        { label: "Max", value: maxVal.toFixed(maxVal < 10 ? 1 : 0) },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
                          <p className="text-base font-bold text-gray-900 dark:text-gray-100">{value} <span className="text-xs font-normal text-gray-400">{def.unit}</span></p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        };
        return <TrendModal key={trendType} />;
      })()}

      {/* ── Custom Range Modal ──────────────────────────────────────────── */}
      {customRangeType && (() => {
        const def = ALL_DEFS.find((d) => d.type === customRangeType)!;
        const hasExisting = customRanges[customRangeType] !== undefined;
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setCustomRangeType(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-teal-500" />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Doctor&apos;s Target — {def.label}</h3>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Set a custom normal range as instructed by your doctor. Overrides the standard range for status badges and trend chart.</p>

              {customRangeType === "bp" ? (
                <div className="space-y-3">
                  <div>
                    <label className="label">Systolic range ({def.unit})</label>
                    <div className="flex gap-2 items-center">
                      <input className="input flex-1" type="number" placeholder="Low (e.g. 90)"
                        value={customRangeForm.low} onChange={(e) => setCustomRangeForm({ ...customRangeForm, low: e.target.value })} />
                      <span className="text-gray-400">–</span>
                      <input className="input flex-1" type="number" placeholder="High (e.g. 130)"
                        value={customRangeForm.high} onChange={(e) => setCustomRangeForm({ ...customRangeForm, high: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Diastolic range ({def.unit}) <span className="text-gray-400 font-normal">(optional)</span></label>
                    <div className="flex gap-2 items-center">
                      <input className="input flex-1" type="number" placeholder="Low (e.g. 60)"
                        value={customRangeForm.low2} onChange={(e) => setCustomRangeForm({ ...customRangeForm, low2: e.target.value })} />
                      <span className="text-gray-400">–</span>
                      <input className="input flex-1" type="number" placeholder="High (e.g. 85)"
                        value={customRangeForm.high2} onChange={(e) => setCustomRangeForm({ ...customRangeForm, high2: e.target.value })} />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="label">Target range ({def.unit})</label>
                  <div className="flex gap-2 items-center">
                    <input className="input flex-1" type="number" step="0.1" placeholder="Low"
                      value={customRangeForm.low} onChange={(e) => setCustomRangeForm({ ...customRangeForm, low: e.target.value })} autoFocus />
                    <span className="text-gray-400">–</span>
                    <input className="input flex-1" type="number" step="0.1" placeholder="High"
                      value={customRangeForm.high} onChange={(e) => setCustomRangeForm({ ...customRangeForm, high: e.target.value })} />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={saveCustomRange} className={`btn-primary ${hasExisting ? "flex-1" : "flex-1"}`}>Save Target</button>
                {hasExisting && (
                  <button onClick={clearCustomRange} className="btn-secondary flex-1">Clear</button>
                )}
                <button onClick={() => setCustomRangeType(null)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

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
            ) : logType === "pain" ? (
              <div>
                <label className="label">Pain Level (1–10)</label>
                <input className="input" type="number" min="1" max="10" step="1" placeholder="e.g. 4"
                  value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} autoFocus />
                <p className="text-xs text-gray-400 mt-1">1–3 mild · 4–6 moderate · 7–10 severe</p>
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
                  placeholder={logType ? (VITAL_PLACEHOLDERS[logType] ?? "") : ""}
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
