"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Pill, Activity, Calendar, FileText, Upload, Thermometer, ClipboardList, Bell, BellOff, BellRing, ShieldCheck } from "lucide-react";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import { usePersonContext } from "@/contexts/PersonContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { storage } from "@/lib/storage";
import type { ActivityEntry, NotificationSettings } from "@/lib/storage";

interface Stats {
  medications: number;
  symptomsThisWeek: number;
  upcomingAppointments: number;
  records: number;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { activePersonId } = usePersonContext();
  const [stats, setStats] = useState<Stats>({ medications: 0, symptomsThisWeek: 0, upcomingAppointments: 0, records: 0 });
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityFilter, setActivityFilter] = useState<"all" | "active">("all");
  const [hour] = useState(new Date().getHours());
  const [notifSettings, setNotifSettings] = useState<NotificationSettings | null>(null);
  const [notifSupported, setNotifSupported] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const { requestPermission } = useNotifications();

  useEffect(() => {
    setNotifSettings(storage.notifications.get());
    const supported = typeof window !== "undefined" && "Notification" in window;
    setNotifSupported(supported);
    if (supported) setNotifPermission(Notification.permission);
  }, []);

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
      setStats({
        medications: meds.length,
        symptomsThisWeek: symptoms.filter((s) => new Date(s.loggedAt) >= weekAgo).length,
        upcomingAppointments: appts.filter((a) => a.status === "upcoming" && new Date(a.datetime) >= now).length,
        records: records.length,
      });
      setActivity(acts.slice(0, 20));
    });
  }, [activePersonId]);

  function updateNotif(patch: Partial<NotificationSettings>) {
    if (!notifSettings) return;
    const updated = { ...notifSettings, ...patch };
    storage.notifications.set(updated);
    setNotifSettings(updated);
  }

  async function handleEnableNotifications() {
    const granted = await requestPermission();
    setNotifPermission(granted ? "granted" : "denied");
    updateNotif({ enabled: granted });
  }

  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = session?.user?.name?.split(" ")[0] || "there";

  const summaryCards = [
    { label: "Medications tracked", value: stats.medications, icon: Pill, href: "/medications", color: "bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-100 dark:border-teal-800" },
    { label: "Symptoms this week", value: stats.symptomsThisWeek, icon: Thermometer, href: "/symptoms", color: "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-800" },
    { label: "Upcoming appointments", value: stats.upcomingAppointments, icon: Calendar, href: "/appointments", color: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800" },
    { label: "Reports uploaded", value: stats.records, icon: FileText, href: "/records", color: "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-100 dark:border-orange-800" },
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

        {/* Reminders card */}
        {notifSettings && (
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              {notifPermission === "granted" && notifSettings.enabled
                ? <BellRing className="w-4 h-4 text-teal-500 flex-shrink-0" />
                : notifPermission === "denied"
                ? <BellOff className="w-4 h-4 text-red-400 flex-shrink-0" />
                : <Bell className="w-4 h-4 text-gray-400 flex-shrink-0" />}
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Reminders</h3>
            </div>

            {/* Reminder time pickers — always visible, affect both in-app alerts and .ics export */}
            <div className="mb-3 space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">When is each time of day for you?</p>
              <div className="grid grid-cols-2 gap-2">
                {(["Morning", "Afternoon", "Evening", "Night"] as const).map((slot) => (
                  <label key={slot} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-sm">
                    <span className="text-gray-600 dark:text-gray-300 text-xs">{slot}</span>
                    <input
                      type="time"
                      value={notifSettings.reminderTimes[slot]}
                      onChange={(e) => updateNotif({ reminderTimes: { ...notifSettings.reminderTimes, [slot]: e.target.value } })}
                      className="input text-xs py-0.5 px-1.5 w-24"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Always-visible .ics tip */}
            <div className="flex items-start gap-2 mb-3 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
              <span className="text-base leading-none mt-0.5">📅</span>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Reliable phone reminders:</strong> Go to{" "}
                <Link href="/medications" className="underline underline-offset-2">Medications</Link> → tap{" "}
                <strong>Reminders (.ics)</strong> → open the file on your phone. It imports recurring daily alerts into Apple Calendar or Google Calendar that fire even when this app is closed.
              </p>
            </div>

            {!notifSupported ? (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Your browser doesn&apos;t support web notifications. Use the .ics export above for native phone reminders.
              </p>
            ) : notifPermission === "denied" ? (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Web notifications are blocked in this browser. Use the .ics export above for native phone reminders, or re-enable notifications in browser settings.
              </p>
            ) : notifPermission !== "granted" ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">Optionally enable in-app alerts — these only fire while this tab is open.</p>
                <button
                  onClick={handleEnableNotifications}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  <Bell className="w-4 h-4" /> Enable in-app alerts
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Medication alerts (tab open only)</span>
                  <button
                    role="switch"
                    aria-checked={notifSettings.medicationReminders}
                    onClick={() => updateNotif({ medicationReminders: !notifSettings.medicationReminders })}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${notifSettings.medicationReminders ? "bg-teal-500" : "bg-gray-300 dark:bg-gray-600"}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${notifSettings.medicationReminders ? "translate-x-4" : "translate-x-1"}`} />
                  </button>
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Daily symptom check-in</span>
                  <button
                    role="switch"
                    aria-checked={notifSettings.symptomReminder}
                    onClick={() => updateNotif({ symptomReminder: !notifSettings.symptomReminder })}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${notifSettings.symptomReminder ? "bg-teal-500" : "bg-gray-300 dark:bg-gray-600"}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${notifSettings.symptomReminder ? "translate-x-4" : "translate-x-1"}`} />
                  </button>
                </label>
                {notifSettings.symptomReminder && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Remind me at</span>
                    <input
                      type="time"
                      value={notifSettings.symptomReminderTime}
                      onChange={(e) => updateNotif({ symptomReminderTime: e.target.value })}
                      className="input text-xs py-1 px-2 w-28"
                    />
                  </div>
                )}
                <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">
                  Alert times above also apply to the .ics calendar export.
                </p>
              </div>
            )}
          </div>
        )}

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
          </div>
        </div>

        <div className="flex items-start gap-2 px-1 pb-2">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Your data is stored only on this device. Patient name is never sent to any server. AI summaries are informational — always consult a qualified healthcare professional.
          </p>
        </div>
      </main>
    </>
  );
}
