"use client";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sun, Moon, Users, Check, Plus, X } from "lucide-react";
import { usePersonContext } from "@/contexts/PersonContext";
import { personColorHex, PRESET_COLORS, getNextPersonColor } from "@/lib/storage";
import { useTheme } from "@/lib/theme";

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/records": "Reports",
  "/medications": "Medications",
  "/symptoms": "Symptom Log",
  "/vitals": "Vitals",
  "/appointments": "Appointments",
  "/notes": "Notes",
  "/chat": "Health Assistant",
};

export default function TopBar({ reportName }: { reportName?: string }) {
  const pathname = usePathname();
  const title = titles[pathname] || "CareCompanion";
  const { dark, toggle } = useTheme();
  const { persons, activePerson, activePersonId, switchPerson, addPerson } = usePersonContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<{ nickname: string; color: string }>({ nickname: "", color: "teal" });
  const [addError, setAddError] = useState("");

  const activeHex = activePerson ? personColorHex(activePerson.color) : null;

  function openAddForm() {
    const next = getNextPersonColor(persons.map((p) => p.color));
    setAddForm({ nickname: "", color: next });
    setAddError("");
    setAddOpen(true);
  }

  function handleAdd() {
    if (!addForm.nickname.trim()) { setAddError("Enter a name"); return; }
    const p = addPerson(addForm.nickname.trim(), addForm.color);
    switchPerson(p.id);
    setAddOpen(false);
    setMenuOpen(false);
  }

  return (
    <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 justify-between sticky top-0 z-20">
      {activePerson && activeHex ? (
        <div className="flex items-center gap-2 min-w-0">
          <span
            style={{ backgroundColor: activeHex }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          >
            {activePerson.nickname[0]?.toUpperCase()}
          </span>
          <span className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
            {activePerson.nickname}
          </span>
        </div>
      ) : (
        <span className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</span>
      )}

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {reportName && (
          <span className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full truncate max-w-[140px]">
            {reportName}
          </span>
        )}

        <button
          onClick={toggle}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          <span className="block transition-transform duration-300 ease-in-out">
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </span>
        </button>

        {/* Person switcher — mobile only */}
        {persons.length > 0 && (
          <div className="relative md:hidden">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); setAddOpen(false); }}
              title="Switch or add profile"
              aria-label="Switch or add profile"
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {activePerson && activeHex ? (
                <span
                  style={{ backgroundColor: activeHex }}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                >
                  {activePerson.nickname[0]?.toUpperCase()}
                </span>
              ) : (
                <Users className="w-4 h-4 text-gray-500" />
              )}
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => { setMenuOpen(false); setAddOpen(false); }} />
                <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 overflow-hidden">
                  {/* Person list */}
                  {persons.map((p) => {
                    const hex = personColorHex(p.color);
                    const isActive = p.id === activePersonId;
                    return (
                      <button
                        key={p.id}
                        onClick={() => { switchPerson(p.id); setMenuOpen(false); setAddOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left ${
                          isActive ? "bg-gray-50 dark:bg-gray-700 font-medium" : "hover:bg-gray-50 dark:hover:bg-gray-700"
                        }`}
                      >
                        <span style={{ backgroundColor: hex }} className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {p.nickname[0]?.toUpperCase()}
                        </span>
                        <span className="truncate text-gray-900 dark:text-gray-100">{p.nickname}</span>
                        {isActive && <Check className="w-3.5 h-3.5 text-teal-600 ml-auto flex-shrink-0" />}
                      </button>
                    );
                  })}

                  {/* Add person */}
                  <div className="border-t border-gray-100 dark:border-gray-700">
                    {!addOpen ? (
                      <button
                        onClick={openAddForm}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-teal-600 dark:text-teal-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" /> Add person
                      </button>
                    ) : (
                      <div className="p-3 space-y-2">
                        <input
                          className="input text-sm py-1.5"
                          placeholder="Name or nickname"
                          value={addForm.nickname}
                          autoFocus
                          onChange={(e) => { setAddForm({ ...addForm, nickname: e.target.value }); setAddError(""); }}
                          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                        />
                        {/* Colour dots */}
                        <div className="flex flex-wrap gap-1.5">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setAddForm({ ...addForm, color: c.id })}
                              title={c.label}
                              style={{ backgroundColor: c.hex }}
                              className={`w-5 h-5 rounded-full transition-transform ${
                                addForm.color === c.id ? "ring-2 ring-offset-1 ring-gray-400 scale-110" : "hover:scale-105"
                              }`}
                            />
                          ))}
                        </div>
                        {addError && <p className="text-red-500 text-xs">{addError}</p>}
                        <div className="flex gap-2">
                          <button onClick={handleAdd} className="btn-primary flex-1 py-1.5 text-xs">Add</button>
                          <button onClick={() => setAddOpen(false)} className="btn-secondary py-1.5 px-3">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
