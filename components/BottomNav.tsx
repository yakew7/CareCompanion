"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, FileText, Pill, Activity,
  HeartPulse, Calendar, NotebookPen, MessageCircleHeart, MoreHorizontal, X, Globe, ShieldAlert, BookOpen,
} from "lucide-react";
import toast from "react-hot-toast";
import { dispatchTimezoneChange } from "@/lib/useTimezoneRefresh";

const primary = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/records", label: "Reports", icon: FileText },
  { href: "/medications", label: "Meds", icon: Pill },
  { href: "/symptoms", label: "Symptoms", icon: Activity },
  { href: "/vitals", label: "Vitals", icon: HeartPulse },
];

const overflow = [
  { href: "/chat", label: "Ask AI", icon: MessageCircleHeart },
  { href: "/appointments", label: "Appts", icon: Calendar },
  { href: "/notes", label: "Notes", icon: NotebookPen },
  { href: "/emergency", label: "Emergency", icon: ShieldAlert },
  { href: "/journal", label: "Journal", icon: BookOpen },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }
  const [timezone, setTimezone] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("cc_timezone") || "Asia/Kolkata";
    return "Asia/Kolkata";
  });

  const overflowActive = overflow.some((i) => i.href === pathname);
  const activeOverflow = overflow.find((i) => i.href === pathname);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex z-50">
        {primary.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
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
            <div className="grid grid-cols-3">
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
            <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Timezone</span>
              </div>
              <select
                value={timezone}
                onChange={(e) => {
                  const tz = e.target.value;
                  setTimezone(tz);
                  localStorage.setItem("cc_timezone", tz);
                  dispatchTimezoneChange();
                  toast.success("Timezone updated");
                }}
                className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-2"
              >
                <option value="Asia/Kolkata">IST — India (+5:30)</option>
                <option value="Asia/Dubai">GST — Gulf (+4)</option>
                <option value="Asia/Singapore">SGT — Singapore (+8)</option>
                <option value="Asia/Tokyo">JST — Japan (+9)</option>
                <option value="Australia/Sydney">AEST — Sydney (+10/11)</option>
                <option value="Europe/London">GMT/BST — London</option>
                <option value="Europe/Paris">CET — Europe (+1)</option>
                <option value="America/New_York">ET — New York</option>
                <option value="America/Chicago">CT — Chicago</option>
                <option value="America/Los_Angeles">PT — Los Angeles</option>
                <option value="Pacific/Auckland">NZST — Auckland (+12)</option>
              </select>
            </div>
          </div>
        </>
      )}
    </>
  );
}
