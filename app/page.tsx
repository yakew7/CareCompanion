"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Pill, Activity, Calendar, FileText, Upload, Thermometer, ClipboardList, ShieldCheck, ChevronRight, Printer, X } from "lucide-react";
import type { Medication, VitalEntry, Appointment, Symptom, CustomVitalRange } from "@/lib/storage";
import { storage } from "@/lib/storage";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import { usePersonContext } from "@/contexts/PersonContext";
import type { ActivityEntry, VitalType } from "@/lib/storage";
import { getAppTimezone } from "@/lib/time";

const ACTIVITY_FILTERS = [
  { value: "all",        label: "All"      },
  { value: "active",     label: "Active"   },
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
  const { activePersonId } = usePersonContext();
  const [stats, setStats] = useState<Stats>({ medications: 0, symptomsThisWeek: 0, maxSymptomSeverityThisWeek: 0, upcomingAppointments: 0, records: 0 });
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityFilter, setActivityFilter] = useState<ActivityFilterType>("all");
  const [medAdherence, setMedAdherence] = useState<number | null>(null);
  const [symptomSparkline, setSymptomSparkline] = useState<number[]>([]);
  const [flaggedVitals, setFlaggedVitals] = useState<{ label: string; reading: string; status: "warning" | "danger" }[]>([]);
  const [hour] = useState(new Date().getHours());
  const [showPrint, setShowPrint] = useState(false);
  const [reengageDismissed, setReengageDismissed] = useState(false);
  const [daysSinceLast, setDaysSinceLast] = useState<number | null>(null);
  const [printData, setPrintData] = useState<{
    meds: Medication[]; vitals: VitalEntry[]; appts: Appointment[]; symptoms: Symptom[];
  }>({ meds: [], vitals: [], appts: [], symptoms: [] });
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
    ]).then(([meds, symptoms, appts, records, acts, vitals]) => {
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
      setActivity(acts.slice(0, 20));
      setPrintData({ meds, vitals, appts, symptoms });

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
            expected += med.times.length;
            taken += med.times.filter((t) => med.log[day]?.[t]).length;
          });
        });
        setMedAdherence(expected > 0 ? Math.round((taken / expected) * 100) : null);
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
    });
  }, [activePersonId]);

  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = session?.user?.name?.split(" ")[0] || "there";

  const isFirstUse = !onboardingDismissed
    && stats.medications === 0
    && stats.records === 0
    && stats.symptomsThisWeek === 0
    && stats.upcomingAppointments === 0
    && activity.length === 0;

  function dismissOnboarding() {
    localStorage.setItem("onboarding_dismissed", "1");
    setOnboardingDismissed(true);
  }

  const showReengage = !isFirstUse && !reengageDismissed && daysSinceLast !== null && daysSinceLast >= 2;

  const neutral = "bg-gray-50 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 border-gray-100 dark:border-gray-700";
  const orange  = "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-100 dark:border-orange-800";
  const red     = "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-100 dark:border-red-800";

  const symptomColor = stats.maxSymptomSeverityThisWeek === 5 ? red
    : stats.maxSymptomSeverityThisWeek >= 4 ? orange
    : neutral;

  const summaryCards = [
    { label: "Medications tracked",   value: stats.medications,           icon: Pill,       href: "/medications",  color: neutral },
    { label: "Symptoms this week",    value: stats.symptomsThisWeek,      icon: Thermometer, href: "/symptoms",    color: symptomColor },
    { label: "Upcoming appointments", value: stats.upcomingAppointments,  icon: Calendar,   href: "/appointments", color: neutral },
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
                  desc: "Tap the person icon in the top bar to create a profile.",
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
                onClick={async () => { await api.activity.clearAll(); setActivity([]); }}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >Clear</button>
            )}
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1 mb-3 text-xs -mx-1 px-1">
            {ACTIVITY_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setActivityFilter(f.value)}
                className={`px-2.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 transition-colors ${
                  activityFilter === f.value
                    ? "bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 font-medium"
                    : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
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
                      {new Date(entry.at).toLocaleDateString("en-IN", { timeZone: getAppTimezone() })}
                    </span>
                  </li>
                ))}
              </ul>
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

      {/* ── Print Summary Modal ────────────────────────────────────────────── */}
      {showPrint && (
        <>
          <style>{`@media print{*{visibility:hidden;}#print-root,#print-root *{visibility:visible;}#print-root{position:absolute;top:0;left:0;right:0;padding:24px;}}`}</style>
          <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center overflow-y-auto py-6 px-4">
            <div id="print-root" className="bg-white text-gray-900 rounded-2xl w-full max-w-2xl shadow-2xl">
              {/* Print header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Health Summary</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
                <div className="flex items-center gap-2 print:hidden">
                  <button onClick={() => window.print()} className="btn-primary flex items-center gap-2 text-sm">
                    <Printer className="w-4 h-4" /> Print / Save PDF
                  </button>
                  <button onClick={() => setShowPrint(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="px-6 py-5 space-y-6">
                {/* Medications */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Current Medications ({printData.meds.length})</h3>
                  {printData.meds.length === 0 ? (
                    <p className="text-sm text-gray-400">None recorded</p>
                  ) : (
                    <table className="w-full text-sm border-collapse">
                      <thead><tr className="border-b border-gray-200"><th className="text-left pb-1.5 font-semibold text-gray-700">Medication</th><th className="text-left pb-1.5 font-semibold text-gray-700">Dose</th><th className="text-left pb-1.5 font-semibold text-gray-700">Frequency</th><th className="text-left pb-1.5 font-semibold text-gray-700">Times</th></tr></thead>
                      <tbody>
                        {printData.meds.map((m) => (
                          <tr key={m.id} className="border-b border-gray-100">
                            <td className="py-1.5 font-medium">{m.name}</td>
                            <td className="py-1.5 text-gray-600">{m.dosage || "—"}</td>
                            <td className="py-1.5 text-gray-600">{m.frequency}</td>
                            <td className="py-1.5 text-gray-600">{m.times.join(", ")}</td>
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
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Latest Vitals</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Array.from(latest.entries()).map(([type, v]) => (
                          <div key={type} className="border border-gray-200 rounded-lg px-3 py-2">
                            <p className="text-xs text-gray-400">{VITAL_LABELS[type] ?? type}</p>
                            <p className="text-sm font-semibold">{v.value2 != null ? `${v.value}/${v.value2}` : v.value} {v.unit}</p>
                            <p className="text-xs text-gray-400">{new Date(v.loggedAt).toLocaleDateString("en-IN")}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })()}

                {/* Upcoming Appointments */}
                {printData.appts.filter(a => a.status === "upcoming" && new Date(a.datetime) >= new Date()).length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Upcoming Appointments</h3>
                    <div className="space-y-2">
                      {printData.appts.filter(a => a.status === "upcoming" && new Date(a.datetime) >= new Date()).slice(0,5).map(a => (
                        <div key={a.id} className="flex items-start gap-3 border border-gray-100 rounded-lg px-3 py-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{a.doctor}{a.specialty ? ` — ${a.specialty}` : ""}</p>
                            <p className="text-xs text-gray-500">{new Date(a.datetime).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}{a.location ? ` · ${a.location}` : ""}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Recent Symptoms */}
                {printData.symptoms.slice(0, 10).length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Recent Symptoms (last {printData.symptoms.slice(0,10).length})</h3>
                    <table className="w-full text-sm border-collapse">
                      <thead><tr className="border-b border-gray-200"><th className="text-left pb-1.5 font-semibold text-gray-700">Symptom</th><th className="text-left pb-1.5 font-semibold text-gray-700">Severity</th><th className="text-left pb-1.5 font-semibold text-gray-700">Date</th></tr></thead>
                      <tbody>
                        {printData.symptoms.slice(0,10).map(s => (
                          <tr key={s.id} className="border-b border-gray-100">
                            <td className="py-1.5 font-medium capitalize">{s.symptom}</td>
                            <td className="py-1.5 text-gray-600">{s.severity}/5</td>
                            <td className="py-1.5 text-gray-500">{new Date(s.loggedAt).toLocaleDateString("en-IN")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                )}

                <footer className="pt-4 border-t border-gray-200 text-xs text-gray-400">
                  Generated by CareCompanion · {new Date().toLocaleString("en-IN")} · For informational purposes only. Always consult a qualified healthcare professional.
                </footer>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
