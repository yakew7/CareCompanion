"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Pill, Activity, Calendar, StickyNote, Salad } from "lucide-react";
import { api } from "@/lib/api";
import { usePersonContext } from "@/contexts/PersonContext";
import type { Medication, Symptom, Appointment, Note } from "@/lib/storage";

interface SearchResult {
  type: "medication" | "symptom" | "appointment" | "note";
  label: string;
  sublabel?: string;
  href: string;
}

interface AllData {
  meds: Medication[];
  symptoms: Symptom[];
  appts: Appointment[];
  notes: Note[];
  dietary: Note[];
}

const ICONS = {
  medication:  Pill,
  symptom:     Activity,
  appointment: Calendar,
  note:        StickyNote,
};

const TYPE_LABEL: Record<string, string> = {
  medication:  "Medication",
  symptom:     "Symptom",
  appointment: "Appointment",
  note:        "Note",
};

export default function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { activePersonId } = usePersonContext();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const allData = useRef<AllData | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !activePersonId) return;
    allData.current = null;
    setQuery("");
    setResults([]);
    setSelected(0);
    const t = setTimeout(() => inputRef.current?.focus(), 40);
    Promise.all([
      api.medications.getAll(),
      api.symptoms.getAll(),
      api.appointments.getAll(),
      api.other.getAll(),
      api.dietary.getAll(),
    ]).then(([meds, symptoms, appts, notes, dietary]) => {
      allData.current = { meds, symptoms, appts, notes, dietary };
    });
    return () => clearTimeout(t);
  }, [open, activePersonId]);

  useEffect(() => {
    if (!query.trim() || !allData.current) { setResults([]); setSelected(0); return; }
    const q = query.toLowerCase();
    const out: SearchResult[] = [];

    for (const m of allData.current.meds) {
      if (`${m.name} ${m.dosage} ${m.notes}`.toLowerCase().includes(q)) {
        out.push({ type: "medication", label: m.name, sublabel: [m.dosage, m.frequency].filter(Boolean).join(" · "), href: "/medications" });
      }
    }
    for (const s of allData.current.symptoms) {
      if (`${s.symptom} ${s.notes}`.toLowerCase().includes(q)) {
        out.push({ type: "symptom", label: s.symptom, sublabel: `Severity ${s.severity}/5`, href: "/symptoms" });
      }
    }
    for (const a of allData.current.appts) {
      if (`${a.doctor} ${a.specialty} ${a.notes}`.toLowerCase().includes(q)) {
        out.push({ type: "appointment", label: a.doctor || "Appointment", sublabel: a.specialty || undefined, href: "/appointments" });
      }
    }
    for (const n of allData.current.notes) {
      if (n.content.toLowerCase().includes(q)) {
        out.push({ type: "note", label: n.content.slice(0, 70), sublabel: "Note", href: "/notes" });
      }
    }
    for (const d of allData.current.dietary) {
      if (d.content.toLowerCase().includes(q)) {
        out.push({ type: "note", label: d.content.slice(0, 70), sublabel: "Dietary note", href: "/notes" });
      }
    }

    setResults(out.slice(0, 10));
    setSelected(0);
  }, [query]);

  // Close on Escape at document level
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  function navigate(href: string) {
    router.push(href);
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter" && results[selected]) { navigate(results[selected].href); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search medications, symptoms, appointments…"
            className="flex-1 text-sm bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
          />
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <ul className="max-h-80 overflow-y-auto py-2">
            {results.map((r, i) => {
              const Icon = ICONS[r.type];
              return (
                <li key={i}>
                  <button
                    onMouseEnter={() => setSelected(i)}
                    onClick={() => navigate(r.href)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === selected ? "bg-teal-50 dark:bg-teal-900/30" : "hover:bg-gray-50 dark:hover:bg-gray-700/50"}`}
                  >
                    <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{r.label}</p>
                      {r.sublabel && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{r.sublabel}</p>}
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{TYPE_LABEL[r.type]}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {query && results.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No results for &ldquo;{query}&rdquo;</p>
        )}

        {!query && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-5">
            Search across medications, symptoms, appointments, and notes
          </p>
        )}
      </div>
    </div>
  );
}
