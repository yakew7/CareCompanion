"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, FileText, Pill, Activity,
  HeartPulse, Calendar, NotebookPen, MessageCircleHeart, MoreHorizontal, X,
} from "lucide-react";

const primary = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/medications", label: "Meds", icon: Pill },
  { href: "/symptoms", label: "Symptoms", icon: Activity },
  { href: "/chat", label: "Ask AI", icon: MessageCircleHeart },
];

const overflow = [
  { href: "/records", label: "Reports", icon: FileText },
  { href: "/vitals", label: "Vitals", icon: HeartPulse },
  { href: "/appointments", label: "Appointments", icon: Calendar },
  { href: "/notes", label: "Notes", icon: NotebookPen },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const overflowActive = overflow.some((i) => i.href === pathname);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex z-30">
        {primary.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center py-2 text-[10px] gap-0.5 transition-colors ${
              pathname === href
                ? "text-teal-600 dark:text-teal-400 font-semibold"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            <Icon className="w-5 h-5" />
            {label}
          </Link>
        ))}

        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex-1 flex flex-col items-center py-2 text-[10px] gap-0.5 transition-colors ${
            overflowActive || open
              ? "text-teal-600 dark:text-teal-400 font-semibold"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {open ? <X className="w-5 h-5" /> : <MoreHorizontal className="w-5 h-5" />}
          More
        </button>
      </nav>

      {/* More sheet */}
      {open && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="md:hidden fixed bottom-16 left-2 right-2 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl overflow-hidden">
            <div className="grid grid-cols-4">
              {overflow.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`flex flex-col items-center gap-1.5 py-4 text-xs transition-colors ${
                    pathname === href
                      ? "text-teal-600 dark:text-teal-400 font-semibold"
                      : "text-gray-600 dark:text-gray-300"
                  }`}
                >
                  <Icon className="w-6 h-6" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
