"use client";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import toast from "react-hot-toast";
import { Trash2, Plus, Salad, StickyNote, FileText, Pencil, Check, X } from "lucide-react";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import { usePersonContext } from "@/contexts/PersonContext";
import type { Note } from "@/lib/storage";

function truncate(s: string, n = 40) { return s.length > n ? s.slice(0, n) + "…" : s; }
import { formatDateIST } from "@/lib/time";
import { useTimezoneRefresh } from "@/lib/useTimezoneRefresh";

type Tab = "dietary" | "other";

function NoteSection({
  title,
  icon: Icon,
  notes,
  loading,
  onAdd,
  onDelete,
  onEdit,
  onClearAll,
  accentClass,
}: {
  title: string;
  icon: React.FC<{ className?: string }>;
  notes: Note[];
  loading: boolean;
  onAdd: (content: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onClearAll: () => void;
  accentClass: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  function handleAdd() {
    if (!draft.trim()) return;
    onAdd(draft.trim());
    setDraft("");
    setShowForm(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Icon className={`w-4 h-4 ${accentClass}`} />
          {title}
          <span className="text-xs font-normal text-gray-400 dark:text-gray-500">({notes.length})</span>
        </h2>
        <div className="flex gap-2">
          {notes.length > 0 && (
            <button onClick={onClearAll} className="btn-danger text-xs px-3 py-1.5">Clear all</button>
          )}
          <button onClick={() => setShowForm((v) => !v)} className="btn-primary flex items-center gap-1.5 text-xs px-4 py-2">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card space-y-3">
          <textarea
            className="input resize-none"
            rows={3}
            placeholder={`Add a ${title.toLowerCase()} note...`}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="btn-primary flex-1">Save</button>
            <button onClick={() => { setShowForm(false); setDraft(""); }} className="btn-secondary flex-1">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notes.length === 0 ? (
        <div className="card text-center py-8 text-gray-400 dark:text-gray-500">
          <p className="text-sm">No {title.toLowerCase()} notes yet</p>
          <p className="text-xs mt-1">Notes from uploaded reports appear here automatically</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="card flex items-start gap-3">
              <div className="flex-1 min-w-0">
                {editId === n.id ? (
                  <div className="space-y-2">
                    <textarea className="input resize-none text-sm w-full" rows={3} value={editDraft} autoFocus
                      onChange={(e) => setEditDraft(e.target.value)} />
                    <div className="flex gap-2">
                      <button onClick={() => { if (editDraft.trim()) { onEdit(n.id, editDraft.trim()); setEditId(null); } }} className="btn-primary flex-1 py-1 text-xs flex items-center justify-center gap-1"><Check className="w-3 h-3" /> Save</button>
                      <button onClick={() => setEditId(null)} className="btn-secondary flex-1 py-1 text-xs flex items-center justify-center gap-1"><X className="w-3 h-3" /> Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{n.content}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      {n.source !== "manual" ? (
                        <>
                          <FileText className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                          <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[180px]">{n.source}</span>
                          <span className="text-xs text-gray-300 dark:text-gray-600">·</span>
                        </>
                      ) : (
                        <span className="badge-gray text-xs">Manual</span>
                      )}
                      <span className="text-xs text-gray-400 dark:text-gray-500">{formatDateIST(n.createdAt)}</span>
                    </div>
                  </>
                )}
              </div>
              {editId !== n.id && (
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setEditId(n.id); setEditDraft(n.content); }}
                    className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-teal-500 transition-colors rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/20">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onDelete(n.id)}
                    className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NotesPage() {
  useTimezoneRefresh();
  const { activePersonId } = usePersonContext();
  const [dietary, setDietary] = useState<Note[]>([]);
  const [other, setOther] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("dietary");

  useEffect(() => {
    if (!activePersonId) return;
    setLoading(true);
    Promise.all([api.dietary.getAll(), api.other.getAll()]).then(([d, o]) => {
      setDietary(d);
      setOther(o);
      setLoading(false);
    });
  }, [activePersonId]);

  async function addDietary(content: string) {
    const n: Note = { id: uuidv4(), content, source: "manual", createdAt: new Date().toISOString() };
    await api.dietary.save(n);
    setDietary(await api.dietary.getAll());
    toast.success("Dietary note saved");
  }

  function deleteDietary(id: string) {
    const note = dietary.find((n) => n.id === id);
    if (!note) return;
    const prev = [...dietary];
    setDietary((d) => d.filter((n) => n.id !== id));
    let undone = false;
    const tid = `undo-diet-${id}`;
    toast.custom(
      (t) => (
        <div className={`flex items-center gap-3 bg-gray-900 text-white pl-4 pr-3 py-3 rounded-xl shadow-lg max-w-xs transition-all ${t.visible ? "opacity-100" : "opacity-0"}`}>
          <span className="text-sm flex-1">Note deleted</span>
          <button
            onClick={() => { undone = true; toast.dismiss(tid); setDietary(prev); }}
            className="font-semibold text-teal-300 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors text-sm"
          >
            Undo
          </button>
        </div>
      ),
      { id: tid, duration: 5000 }
    );
    setTimeout(async () => {
      if (!undone) {
        await api.dietary.delete(id);
        api.activity.push({ type: "dietary", label: `Deleted dietary note: ${truncate(note.content)}`, at: new Date().toISOString(), deleted: true });
      }
    }, 5100);
  }

  async function editDietary(id: string, content: string) {
    const n = dietary.find((x) => x.id === id);
    if (!n) return;
    await api.dietary.save({ ...n, content });
    setDietary(await api.dietary.getAll());
  }

  async function clearDietary() {
    if (!confirm("Clear all dietary notes for this person?")) return;
    const count = dietary.length;
    await api.dietary.clearAll();
    api.activity.push({ type: "dietary", label: `Cleared all dietary notes (${count} item${count !== 1 ? "s" : ""})`, at: new Date().toISOString(), deleted: true });
    setDietary([]);
    toast.success("Dietary notes cleared");
  }

  async function addOther(content: string) {
    const n: Note = { id: uuidv4(), content, source: "manual", createdAt: new Date().toISOString() };
    await api.other.save(n);
    setOther(await api.other.getAll());
    toast.success("Note saved");
  }

  function deleteOther(id: string) {
    const note = other.find((n) => n.id === id);
    if (!note) return;
    const prev = [...other];
    setOther((o) => o.filter((n) => n.id !== id));
    let undone = false;
    const tid = `undo-other-${id}`;
    toast.custom(
      (t) => (
        <div className={`flex items-center gap-3 bg-gray-900 text-white pl-4 pr-3 py-3 rounded-xl shadow-lg max-w-xs transition-all ${t.visible ? "opacity-100" : "opacity-0"}`}>
          <span className="text-sm flex-1">Note deleted</span>
          <button
            onClick={() => { undone = true; toast.dismiss(tid); setOther(prev); }}
            className="font-semibold text-teal-300 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors text-sm"
          >
            Undo
          </button>
        </div>
      ),
      { id: tid, duration: 5000 }
    );
    setTimeout(async () => {
      if (!undone) {
        await api.other.delete(id);
        api.activity.push({ type: "other", label: `Deleted note: ${truncate(note.content)}`, at: new Date().toISOString(), deleted: true });
      }
    }, 5100);
  }

  async function editOther(id: string, content: string) {
    const n = other.find((x) => x.id === id);
    if (!n) return;
    await api.other.save({ ...n, content });
    setOther(await api.other.getAll());
  }

  async function clearOther() {
    if (!confirm("Clear all other notes for this person?")) return;
    const count = other.length;
    await api.other.clearAll();
    api.activity.push({ type: "other", label: `Cleared all notes (${count} item${count !== 1 ? "s" : ""})`, at: new Date().toISOString(), deleted: true });
    setOther([]);
    toast.success("Notes cleared");
  }

  return (
    <>
      <TopBar />
      <main className="p-4 sm:p-6 max-w-4xl space-y-5">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Notes</h2>

        {/* Mobile: tabs */}
        <div className="flex gap-2 sm:hidden">
          {(["dietary", "other"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                tab === t
                  ? "bg-teal-600 border-teal-600 text-white"
                  : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
              }`}
            >
              {t === "dietary" ? "Dietary" : "Other"}
            </button>
          ))}
        </div>

        {/* Desktop: two columns. Mobile: active tab only */}
        <div className="hidden sm:grid sm:grid-cols-2 sm:gap-6">
          <NoteSection
            title="Dietary"
            icon={Salad}
            notes={dietary}
            loading={loading}
            onAdd={addDietary}
            onDelete={deleteDietary}
            onEdit={editDietary}
            onClearAll={clearDietary}
            accentClass="text-green-600 dark:text-green-400"
          />
          <NoteSection
            title="Other"
            icon={StickyNote}
            notes={other}
            loading={loading}
            onAdd={addOther}
            onDelete={deleteOther}
            onEdit={editOther}
            onClearAll={clearOther}
            accentClass="text-orange-500 dark:text-orange-400"
          />
        </div>

        {/* Mobile: single active tab */}
        <div className="sm:hidden">
          {tab === "dietary" ? (
            <NoteSection
              title="Dietary"
              icon={Salad}
              notes={dietary}
              loading={loading}
              onAdd={addDietary}
              onDelete={deleteDietary}
              onClearAll={clearDietary}
              accentClass="text-green-600 dark:text-green-400"
            />
          ) : (
            <NoteSection
              title="Other"
              icon={StickyNote}
              notes={other}
              loading={loading}
              onAdd={addOther}
              onDelete={deleteOther}
              onClearAll={clearOther}
              accentClass="text-orange-500 dark:text-orange-400"
            />
          )}
        </div>
      </main>
    </>
  );
}
