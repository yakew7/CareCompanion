"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import type { ActivityEntry } from "@/lib/storage";

interface Stats {
  medications: number;
  symptomsThisWeek: number;
  upcomingAppointments: number;
  records: number;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats>({ medications: 0, symptomsThisWeek: 0, upcomingAppointments: 0, records: 0 });
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [hour] = useState(new Date().getHours());

useEffect(() => {
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
        symptomsThisWeek: symptoms.filter(s => new Date(s.loggedAt) >= weekAgo).length,
        upcomingAppointments: appts.filter(a => a.status === "upcoming" && new Date(a.datetime) >= now).length,
        records: records.length,
      });
      setActivity(acts.slice(0, 5));
    });
  }, []);

  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const summaryCards = [
    { label: "Medications tracked", value: stats.medications, icon: "💊", href: "/medications", color: "bg-teal-50 text-teal-700 border-teal-100" },
    { label: "Symptoms this week", value: stats.symptomsThisWeek, icon: "🌡️", href: "/symptoms", color: "bg-purple-50 text-purple-700 border-purple-100" },
    { label: "Upcoming appointments", value: stats.upcomingAppointments, icon: "📅", href: "/appointments", color: "bg-blue-50 text-blue-700 border-blue-100" },
    { label: "Reports uploaded", value: stats.records, icon: "📋", href: "/records", color: "bg-orange-50 text-orange-700 border-orange-100" },
  ];

  return (
    <>
      <TopBar />
      <main className="p-6 space-y-6 max-w-4xl">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {greeting}, {session?.user?.name?.split(" ")[0] || "Caregiver"} 👋
          </h2>
          <p className="text-gray-500 mt-1 text-sm">Here&apos;s a summary of your care dashboard</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {summaryCards.map((card) => (
            <Link key={card.label} href={card.href}
              className={`card border hover:shadow-md transition-shadow cursor-pointer ${card.color}`}>
              <div className="flex items-center justify-between">
                <span className="text-3xl">{card.icon}</span>
                <span className="text-4xl font-bold">{card.value}</span>
              </div>
              <p className="text-sm font-medium mt-2">{card.label}</p>
            </Link>
          ))}
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <Link href="/records" className="btn-primary">📤 Upload Report</Link>
            <Link href="/symptoms" className="btn-secondary">🌡️ Log Symptom</Link>
            <Link href="/medications" className="btn-secondary">💊 Add Medication</Link>
            <Link href="/appointments" className="btn-secondary">📅 Add Appointment</Link>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Activity</h3>
          {activity.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No activity yet. Start by uploading a report or logging a symptom.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {activity.map((entry, i) => (
                <li key={i} className="py-2.5 flex items-center gap-3 text-sm">
                  <span className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" />
                  <span className="text-gray-700 flex-1">{entry.label}</span>
                  <span className="text-gray-400 text-xs">{new Date(entry.at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-xs text-gray-400 text-center pb-2">
          ⚠️ CareCompanion is not a medical device. AI summaries are for informational purposes only — always consult a qualified healthcare professional.
        </p>
      </main>
    </>
  );
}
