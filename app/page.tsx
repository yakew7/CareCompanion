"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Pill, Activity, Calendar, FileText, Upload, Thermometer, ClipboardList, ShieldCheck } from "lucide-react";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import { usePersonContext } from "@/contexts/PersonContext";
import type { ActivityEntry } from "@/lib/storage";

interface Stats {
  medications: number;
  symptomsThisWeek: number;
  maxSymptomSeverityThisWeek: number;
  upcomingAppointments: number;
  records: number;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { activePersonId } = usePersonContext();
  const [stats, setStats] = useState<Stats>({ medications: 0, symptomsThisWeek: 0, maxSymptomSeverityThisWeek: 0, upcomingAppointments: 0, records: 0 });
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityFilter, setActivityFilter] = useState<"all" | "active">("all");
  const [hour] = useState(new Date().getHours());

  useEffect(() => {
    if (!activePersonId) return;
    Promise.all([
      api.medications.getAll(),
      api.symptoms.getAll(),
      api.appointments.getAll(),
      api.records.getAll(),
      api.activity.getAll(),
    ]).then(([meds, symptoms, appts, records, acts]) => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const now = new Date();
      const recentSymptoms = symptoms.filter((s) => new Date(s.loggedAt) >= weekAgo);
      setStats({
        medications: meds.length,
        symptomsThisWeek: recentSymptoms.length,
        maxSymptomSeverityThisWeek: recentSymptoms.reduce((max, s) => Math.max(max, s.severity), 0),
        upcomingAppointments: appts.filter((a) => a.status === "upcoming" && new Date(a.datetime) >= now).length,
        records: records.length,
      });
      setActivity(acts.slice(0, 20));
    });
  }, [activePersonId]);

  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = session?.user?.name?.split(" ")[0] || "there";

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
            </Link>
          ))}
        </div>

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
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Activity</h3>
            <div className="flex gap-1 text-xs">
              <button
                onClick={() => setActivityFilter("all")}
                className={`px-2 py-0.5 rounded-full transition-colors ${activityFilter === "all" ? "bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 font-medium" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"}`}
              >All</button>
              <button
                onClick={() => setActivityFilter("active")}
                className={`px-2 py-0.5 rounded-full transition-colors ${activityFilter === "active" ? "bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 font-medium" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"}`}
              >Active only</button>
            </div>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">No activity yet. Start by uploading a report or logging a symptom.</p>
          ) : (() => {
            const filtered = activityFilter === "active" ? activity.filter((e) => !e.deleted) : activity;
            if (filtered.length === 0) return (
              <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">No active entries. Switch to &quot;All&quot; to see deleted items.</p>
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
                      {new Date(entry.at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
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
              <span>For medication reminders on your phone: go to <Link href="/medications" className="underline underline-offset-2 text-teal-600 dark:text-teal-400">Meds</Link> → tap <strong>Reminders (.ics)</strong> → open the file to import into Apple or Google Calendar.</span>
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
    </>
  );
}
