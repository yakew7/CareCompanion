"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Pill, Activity, Calendar, NotebookPen } from "lucide-react";

const nav = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/records", label: "Records", icon: FileText },
  { href: "/medications", label: "Meds", icon: Pill },
  { href: "/symptoms", label: "Symptoms", icon: Activity },
  { href: "/appointments", label: "Appts", icon: Calendar },
  { href: "/notes", label: "Notes", icon: NotebookPen },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex z-30">
      {nav.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex-1 flex flex-col items-center py-2 text-[10px] gap-0.5 transition-colors ${
            pathname === href
              ? "text-teal-600 dark:text-teal-400 font-semibold"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          <Icon className="w-4 h-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
