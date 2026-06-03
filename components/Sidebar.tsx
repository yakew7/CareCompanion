"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/records", label: "Records & Chat", icon: "📋" },
  { href: "/medications", label: "Medications", icon: "💊" },
  { href: "/symptoms", label: "Symptoms", icon: "🌡️" },
  { href: "/appointments", label: "Appointments", icon: "📅" },
];

export default function Sidebar() {
  const pathname = usePathname();
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
      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-gray-400 text-center">V1TROUS Hackathon 2026</p>
      </div>
    </aside>
  );
}
