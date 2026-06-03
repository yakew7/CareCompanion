"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/records", label: "Records", icon: "📋" },
  { href: "/medications", label: "Meds", icon: "💊" },
  { href: "/symptoms", label: "Symptoms", icon: "🌡️" },
  { href: "/appointments", label: "Appts", icon: "📅" },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-30">
      {nav.map(({ href, label, icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex-1 flex flex-col items-center py-2 text-xs gap-0.5 transition-colors ${
            pathname === href
              ? "text-teal-600 font-semibold"
              : "text-gray-500"
          }`}
        >
          <span className="text-lg">{icon}</span>
          {label}
        </Link>
      ))}
    </nav>
  );
}
