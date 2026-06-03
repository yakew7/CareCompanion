"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import { useState } from "react";
import {
  LayoutDashboard, FileText, Pill, Activity, Calendar,
  Heart, LogOut, Sun, Moon, Plus, X, Check,
} from "lucide-react";
import { usePersonContext } from "@/contexts/PersonContext";
import { PersonColor, PERSON_COLORS, personColorClasses, storage } from "@/lib/storage";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/records", label: "Records & Chat", icon: FileText },
  { href: "/medications", label: "Medications", icon: Pill },
  { href: "/symptoms", label: "Symptoms", icon: Activity },
  { href: "/appointments", label: "Appointments", icon: Calendar },
];

const COLOR_LABELS: Record<PersonColor, string> = {
  teal: "Teal", purple: "Purple", blue: "Blue", orange: "Orange", rose: "Rose",
};

function useTheme() {
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined" && document.documentElement.classList.contains("dark")
  );
  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    storage.theme.set(next ? "dark" : "light");
    setDark(next);
  }
  return { dark, toggle };
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { persons, activePerson, activePersonId, switchPerson, addPerson, removePerson } = usePersonContext();
  const { dark, toggle } = useTheme();
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<{ nickname: string; color: PersonColor }>({ nickname: "", color: "purple" });
  const [addError, setAddError] = useState("");

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

  // Pick a default color that isn't already used
  const usedColors = persons.map((p) => p.color);
  const defaultNewColor = PERSON_COLORS.find((c) => !usedColors.includes(c)) || "teal";

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
        <div className="space-y-0.5">
          {persons.map((p) => {
            const cls = personColorClasses(p.color);
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
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${cls.bg}`}>
                    {p.nickname[0]?.toUpperCase()}
                  </span>
                  <span className="truncate">{p.nickname}</span>
                  {isActive && <Check className="w-3 h-3 text-teal-600 ml-auto flex-shrink-0" />}
                </button>
                {persons.length > 1 && (
                  <button
                    onClick={() => removePerson(p.id)}
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
            <div className="flex gap-1.5 px-0.5">
              {PERSON_COLORS.map((c) => {
                const cls = personColorClasses(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAddForm({ ...addForm, color: c })}
                    title={COLOR_LABELS[c]}
                    className={`w-5 h-5 rounded-full ${cls.bg} ${addForm.color === c ? "ring-2 ring-offset-1 ring-gray-400 scale-110" : "hover:scale-105"} transition-transform`}
                  />
                );
              })}
            </div>
            {addError && <p className="text-red-500 text-xs px-1">{addError}</p>}
            <div className="flex gap-1.5">
              <button onClick={handleAddPerson} className="btn-primary flex-1 py-1.5 text-xs">Add</button>
              <button onClick={() => { setAddOpen(false); setAddError(""); }} className="btn-secondary flex-1 py-1.5 text-xs">Cancel</button>
            </div>
          </div>
        ) : (
          persons.length < 5 && (
            <button
              onClick={() => { setAddOpen(true); setAddForm({ nickname: "", color: defaultNewColor }); }}
              className="flex items-center gap-2 px-3 py-2 mt-1 text-xs text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl w-full transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add person
            </button>
          )
        )}
      </div>

      {/* Bottom: account + dark mode + sign out */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
        {/* Dark mode toggle */}
        <button
          onClick={toggle}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors"
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {dark ? "Light mode" : "Dark mode"}
        </button>

        {/* Account info */}
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
    </aside>
  );
}
