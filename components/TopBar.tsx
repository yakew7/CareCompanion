"use client";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sun, Moon, Users, Check, Plus, X, Pencil, Trash2, Search } from "lucide-react";
import GlobalSearch from "@/components/GlobalSearch";
import { usePersonContext } from "@/contexts/PersonContext";
import { personColorHex, PRESET_COLORS, getNextPersonColor } from "@/lib/storage";
import { useTheme } from "@/lib/theme";
import type { PersonColor } from "@/lib/storage";

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/records": "Reports",
  "/medications": "Medications",
  "/symptoms": "Symptom Log",
  "/vitals": "Vitals",
  "/appointments": "Appointments",
  "/notes": "Notes",
  "/chat": "Health Assistant",
  "/find-care": "Find Care",
};

export default function TopBar({ reportName }: { reportName?: string }) {
  const pathname = usePathname();
  const title = titles[pathname] || "CareCompanion";
  const { dark, toggle } = useTheme();
  const { persons, activePerson, activePersonId, switchPerson, addPerson, renamePerson, removePerson } = usePersonContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<{ nickname: string; color: string }>({ nickname: "", color: "teal" });
  const [addError, setAddError] = useState("");
  const [editPersonId, setEditPersonId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ nickname: string; color: string }>({ nickname: "", color: "teal" });
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

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
    <>
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
          onClick={() => setSearchOpen(true)}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          title="Search (⌘K)"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </button>

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
                    if (editPersonId === p.id) {
                      return (
                        <div key={p.id} className="px-3 py-2 space-y-2 bg-gray-50 dark:bg-gray-700/50">
                          <input
                            className="input text-sm py-1.5 w-full"
                            value={editForm.nickname}
                            autoFocus
                            onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && editForm.nickname.trim()) {
                                renamePerson(p.id, editForm.nickname, editForm.color as PersonColor);
                                setEditPersonId(null);
                              } else if (e.key === "Escape") setEditPersonId(null);
                            }}
                          />
                          <div className="flex flex-wrap gap-1.5">
                            {PRESET_COLORS.map((c) => (
                              <button key={c.id} type="button" onClick={() => setEditForm({ ...editForm, color: c.id })}
                                title={c.label} style={{ backgroundColor: c.hex }}
                                className={`w-5 h-5 rounded-full transition-transform ${editForm.color === c.id ? "ring-2 ring-offset-1 ring-gray-400 scale-110" : "hover:scale-105"}`}
                              />
                            ))}
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => { if (editForm.nickname.trim()) { renamePerson(p.id, editForm.nickname, editForm.color as PersonColor); setEditPersonId(null); } }}
                              className="btn-primary flex-1 py-1 text-xs"
                            >Save</button>
                            <button onClick={() => setEditPersonId(null)} className="btn-secondary flex-1 py-1 text-xs">Cancel</button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={p.id} className={`flex items-center group ${isActive ? "bg-gray-50 dark:bg-gray-700" : ""}`}>
                        <button
                          onClick={() => { switchPerson(p.id); setMenuOpen(false); setAddOpen(false); setEditPersonId(null); }}
                          className={`flex-1 flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left ${
                            isActive ? "font-medium" : "hover:bg-gray-50 dark:hover:bg-gray-700"
                          }`}
                        >
                          <span style={{ backgroundColor: hex }} className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {p.nickname[0]?.toUpperCase()}
                          </span>
                          <span className="truncate text-gray-900 dark:text-gray-100">{p.nickname}</span>
                          {isActive && <Check className="w-3.5 h-3.5 text-teal-600 ml-auto flex-shrink-0" />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditPersonId(p.id); setEditForm({ nickname: p.nickname, color: p.color }); setAddOpen(false); }}
                          className="p-2 text-gray-300 dark:text-gray-600 hover:text-teal-500 transition-colors flex-shrink-0"
                          title="Rename / recolor"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {persons.length > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setRemoveConfirmId(p.id); }}
                            className="p-2 text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 pr-3"
                            title="Remove person"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
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

    <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

    {/* Remove person confirm modal — rendered outside header to avoid z-index issues */}
    {removeConfirmId && (() => {
      const target = persons.find((p) => p.id === removeConfirmId);
      if (!target) return null;
      return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Remove {target.nickname}?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                This will permanently delete <span className="font-semibold text-gray-700 dark:text-gray-300">{target.nickname}&apos;s</span> entire health record — medications, vitals, symptoms, appointments, reports, and notes. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { removePerson(removeConfirmId); setRemoveConfirmId(null); setMenuOpen(false); }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm"
              >
                Remove and delete all data
              </button>
              <button onClick={() => setRemoveConfirmId(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      );
    })()}
  </>
  );
}
