"use client";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import toast from "react-hot-toast";
import { BookOpen, Plus, Pencil, Trash2, X, Smile, Meh, Frown } from "lucide-react";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import { usePersonContext } from "@/contexts/PersonContext";
import type { JournalEntry } from "@/lib/storage";
import { getAppTimezone } from "@/lib/time";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: getAppTimezone(),
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: getAppTimezone(), hour: "2-digit", minute: "2-digit",
  });
}

const MOOD_CONFIG = {
  good:    { icon: Smile,  label: "Good day",   color: "text-green-600 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" },
  neutral: { icon: Meh,   label: "Neutral",     color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" },
  tough:   { icon: Frown, label: "Tough day",   color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" },
} as const;

export default function JournalPage() {
  const { activePersonId, activePerson } = usePersonContext();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<JournalEntry["mood"]>(undefined);

  useEffect(() => {
    if (!activePersonId) return;
    setLoading(true);
    api.journal.getAll().then((data) => {
      setEntries(data.sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()));
      setLoading(false);
    });
  }, [activePersonId]);

  function openAdd() {
    setEditing(null);
    setContent("");
    setMood(undefined);
    setShowModal(true);
  }

  function openEdit(entry: JournalEntry) {
    setEditing(entry);
    setContent(entry.content);
    setMood(entry.mood);
    setShowModal(true);
  }

  async function save() {
    if (!content.trim()) { toast.error("Write something first"); return; }
    const entry: JournalEntry = {
      id: editing?.id || uuidv4(),
      content: content.trim(),
      mood,
      loggedAt: editing?.loggedAt || new Date().toISOString(),
    };
    await api.journal.save(entry);
    const updated = await api.journal.getAll();
    setEntries(updated.sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()));
    setShowModal(false);
    toast.success(editing ? "Entry updated" : "Entry saved");
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this entry?")) return;
    await api.journal.delete(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast.success("Entry deleted");
  }

  // Group by date
  const grouped: { date: string; label: string; entries: JournalEntry[] }[] = [];
  for (const entry of entries) {
    const dateKey = entry.loggedAt.split("T")[0];
    const existing = grouped.find((g) => g.date === dateKey);
    if (existing) {
      existing.entries.push(entry);
    } else {
      grouped.push({ date: dateKey, label: formatDate(entry.loggedAt), entries: [entry] });
    }
  }

  return (
    <>
      <TopBar />
      <main className="p-4 sm:p-6 max-w-2xl space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Caregiver Journal</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Daily notes about {activePerson?.nickname ?? "your patient"}</p>
          </div>
          <button onClick={openAdd} className="btn-primary flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> New Entry
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="card text-center py-12 text-gray-400 dark:text-gray-500 space-y-3">
            <BookOpen className="w-10 h-10 mx-auto opacity-30" />
            <p className="font-medium">No journal entries yet</p>
            <p className="text-sm">Write anything — observations, moods, how the day went. These stay private on your device.</p>
            <button onClick={openAdd} className="btn-primary mx-auto flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Write first entry
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ date, label, entries: dayEntries }) => (
              <div key={date}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2 px-1">{label}</p>
                <div className="space-y-3">
                  {dayEntries.map((entry) => {
                    const mc = entry.mood ? MOOD_CONFIG[entry.mood] : null;
                    return (
                      <div key={entry.id} className={`card border ${mc ? mc.bg : "border-gray-100 dark:border-gray-700"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {mc && (
                              <div className={`flex items-center gap-1 mb-2 text-xs font-medium ${mc.color}`}>
                                <mc.icon className="w-3.5 h-3.5" />
                                {mc.label}
                              </div>
                            )}
                            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{entry.content}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{formatTime(entry.loggedAt)}</p>
                          </div>
                          <div className="flex gap-0.5 flex-shrink-0">
                            <button
                              onClick={() => openEdit(entry)}
                              className="p-1.5 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/30"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteEntry(entry.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-lg shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {editing ? "Edit Entry" : "New Journal Entry"}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="label">How was today? (optional)</label>
              <div className="flex gap-2">
                {(["good", "neutral", "tough"] as const).map((m) => {
                  const cfg = MOOD_CONFIG[m];
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMood(mood === m ? undefined : m)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                        mood === m
                          ? `${cfg.bg} ${cfg.color} border-current`
                          : "border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300"
                      }`}
                    >
                      <cfg.icon className="w-4 h-4" />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea
                className="input resize-none"
                rows={5}
                placeholder="How did the day go? Any observations, changes in behaviour, or things to remember for the doctor..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={save} className="btn-primary flex-1">
                {editing ? "Save Changes" : "Save Entry"}
              </button>
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
