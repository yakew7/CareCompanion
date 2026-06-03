"use client";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sun, Moon, Users, Check } from "lucide-react";
import { usePersonContext } from "@/contexts/PersonContext";
import { personColorClasses } from "@/lib/storage";
import { useTheme } from "@/lib/theme";

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/records": "Records & Chat",
  "/medications": "Medications",
  "/symptoms": "Symptom Log",
  "/appointments": "Appointments",
};

export default function TopBar({ reportName }: { reportName?: string }) {
  const pathname = usePathname();
  const title = titles[pathname] || "CareCompanion";
  const { dark, toggle } = useTheme();
  const { persons, activePerson, activePersonId, switchPerson } = usePersonContext();
  const [personMenuOpen, setPersonMenuOpen] = useState(false);

  const activeColor = activePerson ? personColorClasses(activePerson.color) : null;

  return (
    <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 justify-between sticky top-0 z-20">
      <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{title}</h1>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {reportName && (
          <span className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full truncate max-w-[140px]">
            {reportName}
          </span>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Person switcher — mobile only (desktop uses Sidebar) */}
        {persons.length > 0 && (
          <div className="relative md:hidden">
            <button
              onClick={() => setPersonMenuOpen((o) => !o)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {activePerson && activeColor ? (
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${activeColor.bg}`}>
                  {activePerson.nickname[0]?.toUpperCase()}
                </span>
              ) : (
                <Users className="w-4 h-4 text-gray-500" />
              )}
            </button>

            {personMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPersonMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 overflow-hidden">
                  {persons.map((p) => {
                    const cls = personColorClasses(p.color);
                    const isActive = p.id === activePersonId;
                    return (
                      <button
                        key={p.id}
                        onClick={() => { switchPerson(p.id); setPersonMenuOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left ${
                          isActive ? "bg-gray-50 dark:bg-gray-700 font-medium" : "hover:bg-gray-50 dark:hover:bg-gray-700"
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${cls.bg}`}>
                          {p.nickname[0]?.toUpperCase()}
                        </span>
                        <span className="truncate text-gray-900 dark:text-gray-100">{p.nickname}</span>
                        {isActive && <Check className="w-3.5 h-3.5 text-teal-600 ml-auto flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
