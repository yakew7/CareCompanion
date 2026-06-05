"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import { useState } from "react";
import {
  LayoutDashboard, FileText, Pill, Activity, Calendar,
  Heart, LogOut, Sun, Moon, Plus, X, Check, NotebookPen, MessageCircleHeart, HeartPulse,
  Download, Upload,
} from "lucide-react";
import { exportAllData, importBackup } from "@/lib/backup";
import toast from "react-hot-toast";
import { usePersonContext } from "@/contexts/PersonContext";
import { PRESET_COLORS, personColorHex, getNextPersonColor } from "@/lib/storage";
import { useTheme } from "@/lib/theme";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/records", label: "Reports", icon: FileText },
  { href: "/medications", label: "Medications", icon: Pill },
  { href: "/symptoms", label: "Symptoms", icon: Activity },
  { href: "/vitals", label: "Vitals", icon: HeartPulse },
  { href: "/appointments", label: "Appointments", icon: Calendar },
  { href: "/notes", label: "Notes", icon: NotebookPen },
  { href: "/chat", label: "Ask", icon: MessageCircleHeart },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { persons, activePerson, activePersonId, switchPerson, addPerson, removePerson } = usePersonContext();
  const { dark, toggle } = useTheme();
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<{ nickname: string; color: string }>({ nickname: "", color: "purple" });
  const [addError, setAddError] = useState("");
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);

  async function handleSignOut() {
    if (confirm("Sign out?")) {
      signOut({ callbackUrl: "/signin" });
    }
  }

  function handleAddPerson() {
    if (!addForm.nickname.trim()) { setAddError("Enter a name"); return; }
    const p = addPerson(addForm.nickname.trim(), addForm.color);
    switchPerson(p.id);
    setAddOpen(false);
    setAddForm({ nickname: "", color: "purple" });
    setAddError("");
  }

  function openAdd() {
    const nextColor = getNextPersonColor(persons.map((p) => p.color));
    setAddForm({ nickname: "", color: nextColor });
    setAddOpen(true);
  }

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-teal-600 fill-teal-600 flex-shrink-0" />
          <span className="text-xl font-bold text-teal-600">CareCompanion</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              pathname === href
                ? "bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* People switcher */}
      <div className="px-4 pb-3 border-t border-gray-200 dark:border-gray-700 pt-3">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-1">People</p>
        <div className="space-y-0.5 max-h-40 overflow-y-auto">
          {persons.map((p) => {
            const hex = personColorHex(p.color);
            const isActive = p.id === activePersonId;
            return (
              <div key={p.id} className="flex items-center group">
                <button
                  onClick={() => switchPerson(p.id)}
                  className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                    isActive
                      ? "bg-gray-100 dark:bg-gray-700 font-medium text-gray-900 dark:text-gray-100"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <span
                    style={{ backgroundColor: hex }}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  >
                    {p.nickname[0]?.toUpperCase()}
                  </span>
                  <span className="truncate">{p.nickname}</span>
                  {isActive && <Check className="w-3 h-3 text-teal-600 ml-auto flex-shrink-0" />}
                </button>
                {persons.length > 1 && (
                  <button
                    onClick={() => setRemoveConfirmId(p.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-400 transition-all rounded-lg ml-1 flex-shrink-0"
                    title="Remove person"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Add person inline form */}
        {addOpen ? (
          <div className="mt-2 space-y-2">
            <input
              className="input text-xs py-1.5"
              placeholder="Name or nickname"
              value={addForm.nickname}
              autoFocus
              onChange={(e) => { setAddForm({ ...addForm, nickname: e.target.value }); setAddError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleAddPerson()}
            />
            {/* Colour picker — 7 presets */}
            <div className="flex flex-wrap gap-1.5 px-0.5">
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
            {addError && <p className="text-red-500 text-xs px-1">{addError}</p>}
            <div className="flex gap-1.5">
              <button onClick={handleAddPerson} className="btn-primary flex-1 py-1.5 text-xs">Add</button>
              <button onClick={() => { setAddOpen(false); setAddError(""); }} className="btn-secondary flex-1 py-1.5 text-xs">Cancel</button>
            </div>
          </div>
        ) : (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-3 py-2 mt-1 text-xs text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl w-full transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add person
          </button>
        )}
      </div>

      {/* Bottom: dark mode + account + sign out */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
        <button
          onClick={toggle}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors"
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {dark ? "Light mode" : "Dark mode"}
        </button>

        <button
          onClick={() => { exportAllData(); toast.success("Backup downloaded"); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors"
        >
          <Download className="w-4 h-4" />
          Export data
        </button>

        <label className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer">
          <Upload className="w-4 h-4" />
          Import backup
          <input
            type="file"
            accept=".json"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const { personsRestored } = await importBackup(file);
                toast.success(`Restored ${personsRestored} person${personsRestored !== 1 ? "s" : ""} — reloading…`);
                setTimeout(() => window.location.reload(), 1200);
              } catch {
                toast.error("Could not read backup file");
              }
              e.target.value = "";
            }}
          />
        </label>

        <div className="flex items-center gap-3 px-2">
          {session?.user?.image ? (
            <Image src={session.user.image} alt="Profile" width={28} height={28} className="rounded-full flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-900 flex items-center justify-center text-teal-700 dark:text-teal-300 font-bold text-xs flex-shrink-0">
              {(session?.user?.name || "U")[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{session?.user?.name || "User"}</p>
            {activePerson && (
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">Tracking {activePerson.nickname}</p>
            )}
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
        >
          <LogOut className="w-3 h-3" />
          Sign out
        </button>
      </div>
      {/* Remove person confirm modal */}
      {removeConfirmId && (() => {
        const target = persons.find((p) => p.id === removeConfirmId);
        if (!target) return null;
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Remove {target.nickname}?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  This will permanently delete <span className="font-semibold text-gray-700 dark:text-gray-300">{target.nickname}&apos;s</span> entire health record — medications, vitals, symptoms, appointments, reports, and notes. This cannot be undone.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { removePerson(removeConfirmId); setRemoveConfirmId(null); }}
                  className="btn-danger flex-1"
                >
                  Remove and delete all data
                </button>
                <button
                  onClick={() => setRemoveConfirmId(null)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </aside>
  );
}
