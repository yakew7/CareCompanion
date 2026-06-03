"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Pill, Activity, Calendar } from "lucide-react";

const nav = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/records", label: "Records", icon: FileText },
  { href: "/medications", label: "Meds", icon: Pill },
  { href: "/symptoms", label: "Symptoms", icon: Activity },
  { href: "/appointments", label: "Appts", icon: Calendar },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-30">
      {nav.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href}
          className={`flex-1 flex flex-col items-center py-2 text-xs gap-0.5 transition-colors ${
            pathname === href ? "text-teal-600 font-semibold" : "text-gray-500"
          }`}>
          <Icon className="w-5 h-5" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
