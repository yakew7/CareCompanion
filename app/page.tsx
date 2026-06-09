"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { Pill, Activity, Calendar, FileText, Upload, Thermometer, ClipboardList, ShieldCheck, ChevronRight, Printer, X, Sparkles, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import type { Medication, VitalEntry, Appointment, Symptom, CustomVitalRange, Note } from "@/lib/storage";
import { storage } from "@/lib/storage";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import { usePersonContext } from "@/contexts/PersonContext";
import type { ActivityEntry, VitalType } from "@/lib/storage";
import { getAppTimezone, formatDateIST, formatIST } from "@/lib/time";

interface Insight {
  type: "trend_up" | "trend_down" | "day_spike" | "freq_increase";
  message: string;
  href: string;
}

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const VITAL_LABEL_MAP: Partial<Record<VitalType, string>> = {
  bp: "Blood pressure", glucose: "Blood glucose", heart_rate: "Heart rate",
  spo2: "SpO₂", temperature: "Temperature", hba1c: "HbA1c", weight: "Weight",
  cholesterol: "Cholesterol",
};

function computeInsights(vitals: VitalEntry[], symptoms: Symptom[]): Insight[] {
  const out: Insight[] = [];
  const now = Date.now();

  // 1. Vital consecutive trend — 3+ readings all going same direction
  for (const type of Object.keys(VITAL_LABEL_MAP) as VitalType[]) {
    const sorted = vitals
      .filter((v) => v.type === type)
      .sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());
    if (sorted.length < 3) continue;
    let streak = 1, dir = 0;
    for (let i = sorted.length - 1; i > 0 && streak < 6; i--) {
      const d = sorted[i].value > sorted[i - 1].value ? 1 : sorted[i].value < sorted[i - 1].value ? -1 : 0;
      if (d === 0) break;
      if (dir === 0) dir = d;
      else if (d !== dir) break;
      streak++;
    }
    if (streak >= 3) {
      const label = VITAL_LABEL_MAP[type]!;
      out.push({ type: dir > 0 ? "trend_up" : "trend_down", message: `${label} has trended ${dir > 0 ? "up" : "down"} ${streak} readings in a row`, href: "/vitals" });
    }
  }

  // 2. Day-of-week symptom spike — one day has ≥1.5× mean severity over 28 days
  const recent28 = symptoms.filter((s) => new Date(s.loggedAt).getTime() >= now - 28 * 86400000);
  const bySymptom: Record<string, Symptom[]> = {};
  for (const s of recent28) {
    const k = s.symptom.toLowerCase().trim();
    (bySymptom[k] = bySymptom[k] || []).push(s);
  }
  for (const [name, entries] of Object.entries(bySymptom)) {
    if (entries.length < 4) continue;
    const buckets: number[][] = Array.from({ length: 7 }, () => []);
    for (const e of entries) buckets[new Date(e.loggedAt).getDay()].push(e.severity);
    const dayAvgs = buckets.map((b) => b.length ? b.reduce((a, v) => a + v, 0) / b.length : 0);
    const overall = entries.reduce((a, e) => a + e.severity, 0) / entries.length;
    let peakDay = -1, peakAvg = 0;
    for (let d = 0; d < 7; d++) {
      if (buckets[d].length >= 2 && dayAvgs[d] > peakAvg) { peakDay = d; peakAvg = dayAvgs[d]; }
    }
    if (peakDay !== -1 && overall > 0 && peakAvg / overall >= 1.5) {
      const display = name.charAt(0).toUpperCase() + name.slice(1);
      out.push({ type: "day_spike", message: `${display} severity tends to be higher on ${DOW[peakDay]}s`, href: "/symptoms" });
    }
  }

  // 3. Symptom frequency surge — 3+ times this week and ≥2× last week's count
  const countWeek = (from: number, to: number) => {
    const c: Record<string, number> = {};
    for (const s of symptoms) {
      const t = new Date(s.loggedAt).getTime();
      if (t >= from && t < to) { const k = s.symptom.toLowerCase().trim(); c[k] = (c[k] || 0) + 1; }
    }
    return c;
  };
  const thisWeek = countWeek(now - 7 * 86400000, now);
  const prevWeek = countWeek(now - 14 * 86400000, now - 7 * 86400000);
  for (const [name, n] of Object.entries(thisWeek)) {
    const p = prevWeek[name] || 0;
    if (n >= 3 && n >= Math.max(2, p * 2)) {
      const display = name.charAt(0).toUpperCase() + name.slice(1);
      const msg = p > 0 ? `${display} logged ${n}× this week — up from ${p}× last week` : `${display} has been logged ${n} times this week`;
      out.push({ type: "freq_increase", message: msg, href: "/symptoms" });
    }
  }

  return out.slice(0, 4);
}

const ACTIVITY_FILTERS = [
  { value: "all",        label: "All"      },
  { value: "active",     label: "Current"  },
  { value: "medication", label: "Meds"     },
  { value: "vital",      label: "Vitals"   },
  { value: "record",     label: "Reports"  },
  { value: "symptom",    label: "Symptoms" },
] as const;
type ActivityFilterType = typeof ACTIVITY_FILTERS[number]["value"];

function vitalStatus(
  type: VitalType,
  value: number,
  value2?: number,
  custom?: CustomVitalRange,
): "normal" | "warning" | "danger" {
  if (custom?.low !== undefined && custom?.high !== undefined) {
    const inRange = value >= custom.low && value <= custom.high;
    if (type === "bp" && value2 !== undefined && custom.low2 !== undefined && custom.high2 !== undefined) {
      return inRange && value2 >= custom.low2 && value2 <= custom.high2 ? "normal" : "warning";
    }
    return inRange ? "normal" : "warning";
  }
  switch (type) {
    case "bp":          return value <= 120 && (value2 ?? 0) <= 80 ? "normal" : value <= 140 && (value2 ?? 0) <= 90 ? "warning" : "danger";
    case "glucose":     return value >= 70 && value <= 140 ? "normal" : value <= 200 ? "warning" : "danger";
    case "spo2":        return value >= 95 ? "normal" : value >= 90 ? "warning" : "danger";
    case "heart_rate":  return value >= 60 && value <= 100 ? "normal" : value >= 40 && value <= 120 ? "warning" : "danger";
    case "temperature": return value >= 36.1 && value <= 37.2 ? "normal" : value <= 38.0 ? "warning" : "danger";
    case "hba1c":       return value < 5.7 ? "normal" : value < 6.5 ? "warning" : "danger";
    default: return "normal";
  }
}

interface Stats {
  medications: number;
  symptomsThisWeek: number;
  maxSymptomSeverityThisWeek: number;
  upcomingAppointments: number;
  records: number;
}

function DashSparkline({ values }: { values: number[] }) {
  const nonZero = values.filter((v) => v > 0);
  if (nonZero.length < 2) return null;
  const max = 5; // severity max
  const W = 56, H = 14, P = 1;
  const pts = values.map((v, i) => [
    P + (i / (values.length - 1)) * (W - P * 2),
    P + (1 - v / max) * (H - P * 2),
  ]);
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg width={W} height={H} className="mt-1.5 opacity-60">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { activePersonId, activePerson } = usePersonContext();
  const [stats, setStats] = useState<Stats>({ medications: 0, symptomsThisWeek: 0, maxSymptomSeverityThisWeek: 0, upcomingAppointments: 0, records: 0 });
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityFilter, setActivityFilter] = useState<ActivityFilterType>("all");
  const [medAdherence, setMedAdherence] = useState<number | null>(null);
  const [symptomSparkline, setSymptomSparkline] = useState<number[]>([]);
  const [flaggedVitals, setFlaggedVitals] = useState<{ label: string; reading: string; status: "warning" | "danger" }[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [expiringMeds, setExpiringMeds] = useState<{name: string; daysLeft: number}[]>([]);
  const [hour] = useState(new Date().getHours());
  const [showPrint, setShowPrint] = useState(false);
  const [reengageDismissed, setReengageDismissed] = useState(false);
  const [daysSinceLast, setDaysSinceLast] = useState<number | null>(null);
  const [printData, setPrintData] = useState<{
    meds: Medication[]; vitals: VitalEntry[]; appts: Appointment[]; symptoms: Symptom[];
    dietary: Note[]; other: Note[]; emergencyInfo: import("@/lib/storage").EmergencyInfo;
  }>({ meds: [], vitals: [], appts: [], symptoms: [], dietary: [], other: [], emergencyInfo: { allergies: [], emergencyContacts: [] } });
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("onboarding_dismissed") === "1";
    return false;
  });

  useEffect(() => {
    if (!activePersonId) return;
    Promise.all([
      api.medications.getAll(),
      api.symptoms.getAll(),
      api.appointments.getAll(),
      api.records.getAll(),
      api.activity.getAll(),
      api.vitals.getAll(),
      api.dietary.getAll(),
      api.other.getAll(),
    ]).then(([meds, symptoms, appts, records, acts, vitals, dietary, other]) => {
      const now = new Date();
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const recentSymptoms = symptoms.filter((s) => new Date(s.loggedAt) >= weekAgo);

      setStats({
        medications: meds.length,
        symptomsThisWeek: recentSymptoms.length,
        maxSymptomSeverityThisWeek: recentSymptoms.reduce((max, s) => Math.max(max, s.severity), 0),
        upcomingAppointments: appts.filter((a) => a.status === "upcoming" && new Date(a.datetime) >= now).length,
        records: records.length,
      });
      setActivity(acts.slice(0, 50));
      setPrintData({ meds, vitals, appts, symptoms, dietary, other, emergencyInfo: storage.emergencyInfo.get(activePersonId) });

      // Days since last logged entry
      const lastEntry = acts[0];
      if (lastEntry) {
        const d = Math.floor((Date.now() - new Date(lastEntry.at).getTime()) / 86400000);
        setDaysSinceLast(d);
      }

      // 7-day symptom sparkline — max severity per day
      const sparkDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split("T")[0];
      });
      setSymptomSparkline(sparkDays.map((day) => {
        const daySymptoms = symptoms.filter((s) => s.loggedAt.startsWith(day));
        return daySymptoms.length ? Math.max(...daySymptoms.map((s) => s.severity)) : 0;
      }));

      // Medication adherence over past 7 days
      if (meds.length > 0) {
        let expected = 0, taken = 0;
        sparkDays.forEach((day) => {
          meds.forEach((med) => {
            if (med.times.length === 0) return;
            if (med.createdAt && day < med.createdAt) return;
            expected += med.times.length;
            taken += med.times.filter((t) => med.log[day]?.[t]).length;
          });
        });
        setMedAdherence(expected > 0 ? Math.round((taken / expected) * 100) : null);
      } else {
        setMedAdherence(null);
      }

      // Flagged vitals (Watch or High, latest reading per type)
      const VITAL_LABELS: Partial<Record<VitalType, string>> = {
        bp: "Blood Pressure", glucose: "Blood Glucose", heart_rate: "Heart Rate",
        spo2: "SpO₂", temperature: "Temperature", hba1c: "HbA1c",
      };
      const customRanges = storage.customVitalRanges.get(activePersonId);
      const latestByType = new Map<VitalType, VitalEntry>();
      [...vitals].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())
        .forEach((v) => { if (!latestByType.has(v.type)) latestByType.set(v.type, v); });
      const flagged: typeof flaggedVitals = [];
      latestByType.forEach((v, type) => {
        if (!(type in VITAL_LABELS)) return;
        const s = vitalStatus(type, v.value, v.value2, customRanges[type]);
        if (s !== "normal") {
          const reading = v.value2 != null ? `${v.value}/${v.value2} ${v.unit}` : `${v.value} ${v.unit}`;
          flagged.push({ label: VITAL_LABELS[type]!, reading, status: s });
        }
      });
      setFlaggedVitals(flagged);
      setInsights(computeInsights(vitals, symptoms));

      // Expiring medications: expiresAt set, daysLeft > 0 and <= 7
      const nowMs = Date.now();
      const expiringByDate = meds
        .filter((m) => {
          if (!m.expiresAt) return false;
          const daysLeft = Math.ceil((new Date(m.expiresAt).getTime() - nowMs) / 86400000);
          return daysLeft > 0 && daysLeft <= 7;
        })
        .map((m) => ({
          name: m.name,
          daysLeft: Math.ceil((new Date(m.expiresAt!).getTime() - nowMs) / 86400000),
        }));

      // Also flag low pill count medications
      const lowPillMeds = meds
        .filter((m) => {
          if (m.pillCount == null) return false;
          const freq = m.frequency?.toLowerCase() || "";
          const isWeeklyM = freq.includes("weekly");
          const isMonthlyM = freq.includes("monthly");
          const dailyDoses = (!isWeeklyM && !isMonthlyM && m.frequency !== "As needed") ? m.times.length : 1;
          const daysLeft = Math.floor(m.pillCount / Math.max(dailyDoses, 1));
          return daysLeft <= 7 && daysLeft >= 0;
        })
        .map((m) => {
          const freq = m.frequency?.toLowerCase() || "";
          const isWeeklyM = freq.includes("weekly");
          const isMonthlyM = freq.includes("monthly");
          const dailyDoses = (!isWeeklyM && !isMonthlyM && m.frequency !== "As needed") ? m.times.length : 1;
          return { name: m.name, daysLeft: Math.floor(m.pillCount! / Math.max(dailyDoses, 1)) };
        });

      const combined = [...expiringByDate];
      for (const lp of lowPillMeds) {
        if (!combined.find((e) => e.name === lp.name)) combined.push(lp);
      }
      setExpiringMeds(combined.sort((a, b) => a.daysLeft - b.daysLeft));

      setDataLoaded(true);
    });
  }, [activePersonId]);

  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = activePerson?.nickname || session?.user?.name?.split(" ")[0] || "there";

  const isFirstUse = dataLoaded
    && !onboardingDismissed
    && stats.medications === 0
    && stats.records === 0
    && stats.symptomsThisWeek === 0
    && stats.upcomingAppointments === 0
    && activity.length === 0;

  function dismissOnboarding() {
    localStorage.setItem("onboarding_dismissed", "1");
    setOnboardingDismissed(true);
  }

  async function loadDemoData() {
    if (!activePersonId) return;
    const now = new Date();
    const iso = (offsetDays: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() + offsetDays);
      return d.toISOString();
    };
    const dateStr = (offsetDays: number) => iso(offsetDays).split("T")[0];

    // Health profile
    storage.healthProfile.set({ age: 68, heightCm: 162, gender: "female" }, activePersonId);

    // Medications
    const medsData = [
      { id: "demo-m1", name: "Metformin", dosage: "500mg", frequency: "Twice daily", times: ["Morning", "Evening"], notes: "Take with food", log: { [dateStr(0)]: { Morning: "08:12" } }, createdAt: dateStr(-60) },
      { id: "demo-m2", name: "Lisinopril", dosage: "10mg", frequency: "Once daily", times: ["Morning"], notes: "", log: { [dateStr(0)]: { Morning: "08:15" } }, createdAt: dateStr(-90) },
      { id: "demo-m3", name: "Atorvastatin", dosage: "20mg", frequency: "Once daily", times: ["Night"], notes: "Take at bedtime", log: {}, createdAt: dateStr(-90) },
    ];
    for (const m of medsData) {
      await api.medications.save(m as import("@/lib/storage").Medication);
      api.activity.push({ type: "medication", label: `Added medication: ${m.name}`, at: iso(-90) });
    }

    // Vitals (bp, glucose, hba1c, weight, heart_rate)
    const vitalsData = [
      { id: "demo-v1", type: "bp" as const, value: 138, value2: 88, unit: "mmHg", notes: "", loggedAt: iso(-14) },
      { id: "demo-v2", type: "bp" as const, value: 132, value2: 84, unit: "mmHg", notes: "", loggedAt: iso(-7) },
      { id: "demo-v3", type: "bp" as const, value: 128, value2: 82, unit: "mmHg", notes: "After morning walk", loggedAt: iso(-1) },
      { id: "demo-v4", type: "glucose" as const, value: 126, unit: "mg/dL", notes: "Fasting", loggedAt: iso(-7) },
      { id: "demo-v5", type: "hba1c" as const, value: 7.1, unit: "%", notes: "", loggedAt: iso(-30) },
      { id: "demo-v6", type: "weight" as const, value: 64, unit: "kg", notes: "", loggedAt: iso(-7) },
      { id: "demo-v7", type: "heart_rate" as const, value: 76, unit: "bpm", notes: "", loggedAt: iso(-3) },
    ];
    for (const v of vitalsData) {
      await api.vitals.save(v as import("@/lib/storage").VitalEntry);
      api.activity.push({ type: "vital", label: `Logged ${v.type}`, at: v.loggedAt });
    }

    // Symptoms
    const symptomsData = [
      { id: "demo-s1", symptom: "Headache", severity: 3, notes: "After lunch", loggedAt: iso(-5), linkedMedication: "Lisinopril" },
      { id: "demo-s2", symptom: "Fatigue", severity: 2, notes: "", loggedAt: iso(-4) },
      { id: "demo-s3", symptom: "Fatigue", severity: 3, notes: "Worse in the afternoon", loggedAt: iso(-2) },
      { id: "demo-s4", symptom: "Dizziness", severity: 2, notes: "Upon standing", loggedAt: iso(-1), linkedMedication: "Lisinopril" },
    ];
    for (const s of symptomsData) {
      await api.symptoms.save(s as import("@/lib/storage").Symptom);
      api.activity.push({ type: "symptom", label: `Logged symptom: ${s.symptom}`, at: s.loggedAt });
    }

    // Appointments
    const upcomingAppt: import("@/lib/storage").Appointment = {
      id: "demo-a1",
      doctor: "Dr. Priya Sharma",
      specialty: "Endocrinologist",
      datetime: iso(12),
      location: "Apollo Hospital, Mumbai",
      notes: "3-month HbA1c follow-up",
      status: "upcoming",
      postVisitNotes: "",
    };
    const pastAppt: import("@/lib/storage").Appointment = {
      id: "demo-a2",
      doctor: "Dr. Rakesh Mehta",
      specialty: "Cardiologist",
      datetime: iso(-21),
      location: "Fortis Hospital",
      notes: "",
      status: "completed",
      postVisitNotes: "BP improving. Continue Lisinopril.",
      visitDoctorSaid: "Blood pressure improving on current dose. Target below 130/80.",
      visitMedsChanged: "No changes. Continue Lisinopril 10mg.",
      visitActionItems: "Monitor BP daily. Return in 3 months. Schedule echo if BP stays elevated.",
    };
    await api.appointments.save(upcomingAppt);
    await api.appointments.save(pastAppt);
    api.activity.push({ type: "appointment", label: `Added appointment: Dr. Priya Sharma`, at: iso(-1) });

    // Notes
    await api.dietary.save({ id: "demo-n1", content: "Low sodium diet — avoid processed foods and canned goods. Limit salt to 1500mg/day.", source: "manual", createdAt: iso(-30), tags: ["cardiologist"] });
    await api.other.save({ id: "demo-n2", content: "Allergic to sulfa drugs. Check with pharmacist before any new prescriptions.", source: "manual", createdAt: iso(-30), tags: ["allergy", "important"] });

    toast.success("Demo data loaded!");
    dismissOnboarding();
    // Reload to pick up all state
    window.location.reload();
  }

  const showReengage = !isFirstUse && !reengageDismissed && daysSinceLast !== null && daysSinceLast >= 2;
  const hasAnyData = activity.length > 0 || stats.medications > 0 || stats.records > 0;

  const neutral = "bg-gray-50 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 border-gray-100 dark:border-gray-700";
  const orange  = "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-100 dark:border-orange-800";
  const red     = "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-100 dark:border-red-800";

  const symptomColor = stats.maxSymptomSeverityThisWeek === 5 ? red
    : stats.maxSymptomSeverityThisWeek >= 4 ? orange
    : neutral;

  const summaryCards = [
    { label: "Medications tracked",   value: stats.medications,           icon: Pill,       href: "/medications",  color: neutral },
    { label: "Symptoms this week",    value: stats.symptomsThisWeek,      icon: Activity,    href: "/symptoms",    color: symptomColor },
    { label: "Appointments",          value: stats.upcomingAppointments,  icon: Calendar,   href: "/appointments", color: neutral },
    { label: "Reports uploaded",      value: stats.records,               icon: FileText,   href: "/records",      color: neutral },
  ];

  return (
    <>
      <TopBar />
      <main className="p-4 sm:p-6 space-y-5 max-w-4xl">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{greeting}, {firstName}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Here is a summary of your care dashboard.</p>
        </div>

        {isFirstUse && (
          <div className="card border border-teal-200 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-900/10 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-teal-800 dark:text-teal-200">Welcome to CareCompanion</p>
                <p className="text-xs text-teal-700 dark:text-teal-300 mt-0.5">Get started in 3 simple steps</p>
              </div>
              <button onClick={dismissOnboarding} className="text-teal-400 hover:text-teal-600 dark:hover:text-teal-300 text-lg leading-none flex-shrink-0">×</button>
            </div>
            <div className="space-y-3">
              {[
                {
                  step: "1",
                  title: "Add the person you're caring for",
                  desc: "On mobile: tap the avatar in the top bar. On desktop: use the People section in the sidebar.",
                  href: null,
                  color: "bg-teal-500",
                },
                {
                  step: "2",
                  title: "Upload a report or add a medication",
                  desc: "Upload any PDF report to auto-extract data, or manually add medications.",
                  href: "/records",
                  color: "bg-purple-500",
                },
                {
                  step: "3",
                  title: "Track vitals and symptoms",
                  desc: "Log daily readings and spot patterns with AI analysis.",
                  href: "/vitals",
                  color: "bg-emerald-500",
                },
              ].map(({ step, title, desc, href, color }) => (
                <Link
                  key={step}
                  href={href ?? "#"}
                  onClick={href ? dismissOnboarding : (e) => e.preventDefault()}
                  className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-600 transition-colors group"
                >
                  <span className={`w-6 h-6 rounded-full ${color} text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5`}>{step}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>
                  </div>
                  {href && <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-teal-500 transition-colors flex-shrink-0 mt-1" />}
                </Link>
              ))}
            </div>
            <button
              onClick={loadDemoData}
              className="w-full text-xs text-center text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 py-1 transition-colors"
            >
              Or try with demo data →
            </button>
          </div>
        )}

        {showReengage && (
          <div className="card border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                  Last logged {daysSinceLast} day{daysSinceLast !== 1 ? "s" : ""} ago
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Anything new to log today?</p>
              </div>
              <button onClick={() => setReengageDismissed(true)} className="text-blue-300 hover:text-blue-500 dark:hover:text-blue-300 text-lg leading-none flex-shrink-0">×</button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <Link href="/vitals" onClick={() => setReengageDismissed(true)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Log vitals</Link>
              <Link href="/symptoms" onClick={() => setReengageDismissed(true)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"><Thermometer className="w-3.5 h-3.5" /> Log symptom</Link>
              <Link href="/medications" onClick={() => setReengageDismissed(true)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"><Pill className="w-3.5 h-3.5" /> Check meds</Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {summaryCards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className={`card border hover:shadow-md transition-shadow cursor-pointer ${card.color}`}
            >
              <div className="flex items-center justify-between">
                <card.icon className="w-5 h-5 sm:w-6 sm:h-6 opacity-70" />
                <span className="text-3xl sm:text-4xl font-bold">{card.value}</span>
              </div>
              <p className="text-xs sm:text-sm font-medium mt-2">{card.label}</p>
              {/* Passive data overlays */}
              {card.label === "Medications tracked" && medAdherence !== null && (
                <p className="text-xs mt-1 opacity-70">{medAdherence}% doses taken this week</p>
              )}
              {card.label === "Symptoms this week" && symptomSparkline.some((v) => v > 0) && (
                <DashSparkline values={symptomSparkline} />
              )}
            </Link>
          ))}
        </div>

        {/* Refill reminder */}
        {expiringMeds.length > 0 && dataLoaded && (
          <div className="card border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">Refill reminder{expiringMeds.length > 1 ? "s" : ""}</h3>
              <Link href="/medications" className="ml-auto text-xs text-amber-600 dark:text-amber-400 hover:underline">View all →</Link>
            </div>
            <ul className="space-y-1">
              {expiringMeds.map(m => (
                <li key={m.name} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{m.name}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${m.daysLeft <= 2 ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"}`}>
                    {m.daysLeft === 1 ? "Last day" : `${m.daysLeft}d left`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Flagged vitals banner */}
        {flaggedVitals.length > 0 && (
          <Link href="/vitals" className="flex flex-wrap gap-2 card border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 hover:shadow-md transition-shadow cursor-pointer">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 w-full mb-1">Vitals needing attention</p>
            {flaggedVitals.map((v) => (
              <span key={v.label} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                v.status === "danger"
                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                  : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
              }`}>
                {v.label}: {v.reading}
              </span>
            ))}
          </Link>
        )}

        {dataLoaded && (insights.length > 0 ? (
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-teal-500" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Insights</h3>
              <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">Auto-detected patterns</span>
            </div>
            <ul className="space-y-1.5">
              {insights.map((ins, i) => {
                const Icon = ins.type === "trend_up" ? TrendingUp : ins.type === "trend_down" ? TrendingDown : ins.type === "day_spike" ? Calendar : Activity;
                const iconClass = ins.type === "trend_up"
                  ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400"
                  : ins.type === "trend_down"
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                  : ins.type === "day_spike"
                  ? "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
                  : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400";
                return (
                  <li key={i}>
                    <Link href={ins.href} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors group">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${iconClass}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <p className="text-sm text-gray-700 dark:text-gray-300 flex-1 leading-snug group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors">{ins.message}</p>
                      <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-teal-500 transition-colors flex-shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : hasAnyData ? (
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-teal-500" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Insights</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Keep logging vitals and symptoms — patterns will surface automatically once there&apos;s enough data.
            </p>
          </div>
        ) : null)}

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Quick Actions</h3>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Link href="/records" className="btn-primary flex items-center gap-2">
              <Upload className="w-4 h-4" /> Upload Report
            </Link>
            <Link href="/symptoms" className="btn-secondary flex items-center gap-2">
              <Activity className="w-4 h-4" /> Log Symptom
            </Link>
            <Link href="/medications" className="btn-secondary flex items-center gap-2">
              <Pill className="w-4 h-4" /> Add Medication
            </Link>
            <Link href="/appointments" className="btn-secondary flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Add Appointment
            </Link>
            <button onClick={() => setShowPrint(true)} className="btn-secondary flex items-center gap-2">
              <Printer className="w-4 h-4" /> Print Summary
            </button>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Activity</h3>
            {activity.length > 0 && (
              <button
                onClick={async () => { if (!confirm("Clear all recent activity? This cannot be undone.")) return; await api.activity.clearAll(); setActivity([]); }}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >Clear</button>
            )}
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1 mb-3 text-xs -mx-1 px-1">
            {ACTIVITY_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => { setActivityFilter(f.value); }}
                className={`px-2.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 transition-colors ${
                  activityFilter === f.value
                    ? "bg-teal-600 dark:bg-teal-700 text-white font-medium"
                    : "bg-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                }`}
              >{f.label}</button>
            ))}
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">No activity yet. Start by uploading a report or logging a symptom.</p>
          ) : (() => {
            const filtered = (() => {
              switch (activityFilter) {
                case "active":     return activity.filter((e) => !e.deleted);
                case "medication": return activity.filter((e) => e.type === "medication" && !e.deleted);
                case "vital":      return activity.filter((e) => e.type === "vital" && !e.deleted);
                case "record":     return activity.filter((e) => e.type === "record" && !e.deleted);
                case "symptom":    return activity.filter((e) => e.type === "symptom" && !e.deleted);
                default:           return activity;
              }
            })();
            if (filtered.length === 0) return (
              <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">No entries for this filter. Try &quot;All&quot; to see everything.</p>
            );
            return (
              <>
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map((entry, i) => (
                    <li key={i} className={`py-2.5 flex items-center gap-3 text-sm ${entry.deleted ? "opacity-60" : ""}`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${entry.deleted ? "bg-red-400" : "bg-teal-400"}`} />
                      <span className={`flex-1 ${entry.deleted ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-700 dark:text-gray-300"}`}>
                        {entry.label}
                      </span>
                      {entry.deleted && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium flex-shrink-0">
                          Deleted
                        </span>
                      )}
                      <span className="text-gray-400 dark:text-gray-500 text-xs flex-shrink-0">
                        {formatDateIST(entry.at)}
                      </span>
                    </li>
                  ))}
                </ul>
                {activity.length >= 50 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center pt-3">Showing last 50 entries</p>
                )}
              </>
            );
          })()}
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Quick Help</h3>
          <div className="grid grid-cols-1 gap-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-start gap-2">
              <ClipboardList className="w-4 h-4 mt-0.5 text-teal-500 flex-shrink-0" />
              <span>Upload a medical report to get a plain-English summary and auto-extract medications and appointments.</span>
            </div>
            <div className="flex items-start gap-2">
              <Activity className="w-4 h-4 mt-0.5 text-purple-500 flex-shrink-0" />
              <span>Log symptoms regularly and use AI Analysis to spot patterns over time.</span>
            </div>
            <div className="flex items-start gap-2">
              <Pill className="w-4 h-4 mt-0.5 text-teal-500 flex-shrink-0" />
              <span>Track medications and log a dose with one tap. Set up calendar reminders from the <Link href="/medications" className="underline underline-offset-2 text-teal-600 dark:text-teal-400">Medications</Link> page.</span>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 px-1 pb-2">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Your data is stored only on this device. Patient name is never sent to any server. AI summaries are informational. Always consult a qualified healthcare professional.
          </p>
        </div>
      </main>

      {/* ── Floating Ask AI button ──────────────────────────────────────────── */}
      <Link
        href="/chat"
        className="fixed bottom-6 right-6 z-40 hidden md:flex items-center gap-2 px-4 py-2.5 bg-gradient-to-br from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-white rounded-2xl shadow-lg shadow-teal-500/30 hover:shadow-xl hover:shadow-teal-500/40 hover:scale-105 active:scale-95 transition-all duration-150"
      >
        <Sparkles className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-semibold">Ask AI</span>
      </Link>

      {/* ── Print Summary Modal ────────────────────────────────────────────── */}
      {showPrint && (
        <>
          <style>{`@media print{*{visibility:hidden;}#print-root,#print-root *{visibility:visible;}#print-root{position:absolute;top:0;left:0;right:0;padding:24px;}}`}</style>
          <div className="fixed inset-0 bg-black/90 z-50" onClick={() => setShowPrint(false)} />
          <div className="fixed inset-0 z-50 overflow-y-auto py-6 px-4 flex items-start justify-center pointer-events-none">
            <div id="print-root" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-2xl w-full max-w-2xl shadow-2xl pointer-events-auto" onClick={e => e.stopPropagation()}>
              {/* Print header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Health Summary</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
                <div className="flex items-center gap-2 print:hidden">
                  <button onClick={() => window.print()} className="btn-primary flex items-center gap-2 text-sm">
                    <Printer className="w-4 h-4" /> Print / Save PDF
                  </button>
                  <button onClick={() => setShowPrint(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="px-6 py-5 space-y-6">
                {/* Patient context */}
                {(printData.emergencyInfo.bloodType || printData.emergencyInfo.allergies.length > 0 || printData.emergencyInfo.primaryDoctor) && (
                  <section className="flex flex-wrap gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    {printData.emergencyInfo.bloodType && (
                      <div><p className="text-[10px] text-gray-400 uppercase tracking-wide">Blood Type</p><p className="text-sm font-bold text-red-600 dark:text-red-400">{printData.emergencyInfo.bloodType}</p></div>
                    )}
                    {printData.emergencyInfo.allergies.length > 0 && (
                      <div><p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Allergies</p><div className="flex flex-wrap gap-1">{printData.emergencyInfo.allergies.map((a, i) => <span key={i} className="text-xs px-2 py-0.5 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">{a}</span>)}</div></div>
                    )}
                    {printData.emergencyInfo.primaryDoctor && (
                      <div><p className="text-[10px] text-gray-400 uppercase tracking-wide">Primary Doctor</p><p className="text-sm font-medium">{printData.emergencyInfo.primaryDoctor}{printData.emergencyInfo.primaryDoctorPhone ? ` · ${printData.emergencyInfo.primaryDoctorPhone}` : ""}</p></div>
                    )}
                  </section>
                )}

                {/* Medications */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">Current Medications ({printData.meds.length})</h3>
                  {printData.meds.length === 0 ? (
                    <p className="text-sm text-gray-400">None recorded</p>
                  ) : (
                    <table className="w-full text-sm border-collapse">
                      <thead><tr className="border-b border-gray-200 dark:border-gray-700"><th className="text-left pb-1.5 font-semibold text-gray-700 dark:text-gray-300">Medication</th><th className="text-left pb-1.5 font-semibold text-gray-700 dark:text-gray-300">Dose</th><th className="text-left pb-1.5 font-semibold text-gray-700 dark:text-gray-300">Frequency</th><th className="text-left pb-1.5 font-semibold text-gray-700 dark:text-gray-300">Times</th></tr></thead>
                      <tbody>
                        {printData.meds.map((m) => (
                          <tr key={m.id} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-1.5 font-medium">{m.name}</td>
                            <td className="py-1.5 text-gray-600 dark:text-gray-400">{m.dosage || "—"}</td>
                            <td className="py-1.5 text-gray-600 dark:text-gray-400">{m.frequency}</td>
                            <td className="py-1.5 text-gray-600 dark:text-gray-400">{m.times.join(", ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>

                {/* Latest Vitals */}
                {printData.vitals.length > 0 && (() => {
                  const VITAL_LABELS: Record<string, string> = { bp:"Blood Pressure", glucose:"Blood Glucose", weight:"Weight", heart_rate:"Heart Rate", temperature:"Temperature", spo2:"SpO₂", respiratory_rate:"Resp. Rate", hba1c:"HbA1c", cholesterol:"Cholesterol", hemoglobin:"Hemoglobin", creatinine:"Creatinine", pain:"Pain Level" };
                  const latest = new Map<string, VitalEntry>();
                  [...printData.vitals].sort((a,b)=>new Date(b.loggedAt).getTime()-new Date(a.loggedAt).getTime()).forEach(v=>{if(!latest.has(v.type))latest.set(v.type,v);});
                  return (
                    <section>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">Latest Vitals</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Array.from(latest.entries()).map(([type, v]) => (
                          <div key={type} className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                            <p className="text-xs text-gray-400 dark:text-gray-500">{VITAL_LABELS[type] ?? type}</p>
                            <p className="text-sm font-semibold">{v.value2 != null ? `${v.value}/${v.value2}` : v.value} {v.unit}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{formatDateIST(v.loggedAt)}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })()}

                {/* Appointments */}
                {(() => {
                  const now = new Date();
                  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
                  const upcoming = printData.appts
                    .filter(a => a.status === "upcoming" && new Date(a.datetime) >= now)
                    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
                    .slice(0, 5);
                  const recentPast = printData.appts
                    .filter(a => a.status === "completed" && new Date(a.datetime) >= thirtyDaysAgo)
                    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
                    .slice(0, 3);
                  if (upcoming.length === 0 && recentPast.length === 0) return null;
                  return (
                    <section>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">Appointments</h3>
                      <div className="space-y-2">
                        {upcoming.map(a => (
                          <div key={a.id} className="flex items-start gap-3 border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{a.doctor}{a.specialty ? ` — ${a.specialty}` : ""}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{formatIST(a.datetime)}{a.location ? ` · ${a.location}` : ""}</p>
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 font-medium flex-shrink-0">Upcoming</span>
                          </div>
                        ))}
                        {recentPast.map(a => (
                          <div key={a.id} className="flex items-start gap-3 border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{a.doctor}{a.specialty ? ` — ${a.specialty}` : ""}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{formatIST(a.datetime)}{a.location ? ` · ${a.location}` : ""}</p>
                              {a.visitDoctorSaid && <p className="text-xs text-teal-700 dark:text-teal-400 mt-0.5"><span className="font-medium">Said:</span> {a.visitDoctorSaid}</p>}
                              {a.visitMedsChanged && <p className="text-xs text-purple-700 dark:text-purple-400 mt-0.5"><span className="font-medium">Meds:</span> {a.visitMedsChanged}</p>}
                              {a.visitActionItems && <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5"><span className="font-medium">Actions:</span> {a.visitActionItems}</p>}
                              {!a.visitDoctorSaid && !a.visitMedsChanged && a.postVisitNotes && <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 italic">{a.postVisitNotes}</p>}
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium flex-shrink-0">Completed</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })()}

                {/* Recent Symptoms */}
                {printData.symptoms.slice(0, 10).length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">Recent Symptoms (last {printData.symptoms.slice(0,10).length})</h3>
                    <table className="w-full text-sm border-collapse">
                      <thead><tr className="border-b border-gray-200 dark:border-gray-700"><th className="text-left pb-1.5 font-semibold text-gray-700 dark:text-gray-300">Symptom</th><th className="text-left pb-1.5 font-semibold text-gray-700 dark:text-gray-300">Severity</th><th className="text-left pb-1.5 font-semibold text-gray-700 dark:text-gray-300">Date</th></tr></thead>
                      <tbody>
                        {printData.symptoms.slice(0,10).map(s => (
                          <tr key={s.id} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-1.5 font-medium capitalize">{s.symptom}</td>
                            <td className="py-1.5 text-gray-600 dark:text-gray-400">{s.severity}/5</td>
                            <td className="py-1.5 text-gray-500 dark:text-gray-400">{formatDateIST(s.loggedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                )}

                {/* Notes */}
                {(printData.dietary.length > 0 || printData.other.length > 0) && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">Notes</h3>
                    <div className="space-y-2">
                      {printData.dietary.slice(0, 5).map(n => (
                        <div key={n.id} className="border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2">
                          <p className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wide mb-0.5">Dietary</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{n.content}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatDateIST(n.createdAt)}</p>
                        </div>
                      ))}
                      {printData.other.slice(0, 5).map(n => (
                        <div key={n.id} className="border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2">
                          <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-0.5">Other</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{n.content}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatDateIST(n.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <footer className="pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
                  Generated by CareCompanion · {formatIST(new Date().toISOString())} · For informational purposes only. Always consult a qualified healthcare professional.
                </footer>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
