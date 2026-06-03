"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { storage, UserProfile } from "@/lib/storage";

const nav = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/records", label: "Records & Chat", icon: "📋" },
  { href: "/medications", label: "Medications", icon: "💊" },
  { href: "/symptoms", label: "Symptoms", icon: "🌡️" },
  { href: "/appointments", label: "Appointments", icon: "📅" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    setProfile(storage.profile.get());
  }, []);

  function signOut() {
    if (confirm("Sign out? Your data will stay saved on this device.")) {
      storage.profile.clear();
      window.location.reload();
    }
  }

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-white border-r border-gray-200 fixed left-0 top-0 z-30">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-2xl">❤️</span>
          <span className="text-xl font-bold text-teal-600">CareCompanion</span>
        </div>
        <p className="text-xs text-gray-400 mt-1 ml-8">AI Caregiver Dashboard</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {nav.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              pathname === href
                ? "bg-teal-50 text-teal-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <span className="text-base">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200 space-y-3">
        {profile && (
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm flex-shrink-0">
              {profile.name[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{profile.name}</p>
              {profile.patientName && (
                <p className="text-xs text-gray-400 truncate">
                  Caring for {profile.patientName}
                </p>
              )}
            </div>
          </div>
        )}
        <button
          onClick={signOut}
          className="w-full text-left px-4 py-2 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
        >
          Sign out
        </button>
        <p className="text-xs text-gray-400 text-center">V1TROUS Hackathon 2026</p>
      </div>
    </aside>
  );
}
