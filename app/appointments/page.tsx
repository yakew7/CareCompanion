"use client";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import { Pencil, Trash2, CalendarDays, MapPin, Sparkles, Download, MoreVertical, Search, ChevronLeft, ChevronRight, List, LayoutGrid } from "lucide-react";
import { downloadICS } from "@/lib/ics";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import { usePersonContext } from "@/contexts/PersonContext";
import type { Appointment } from "@/lib/storage";
import { nowIST, formatIST } from "@/lib/time";
import { useTimezoneRefresh } from "@/lib/useTimezoneRefresh";

type ViewMode = "list" | "week" | "month";

// Feature 16: Swipe-to-delete for mobile
function SwipeCard({ onDelete, children }: { onDelete: () => void; children: React.ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    if (innerRef.current) innerRef.current.style.transition = "none";
  }
  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current;
    if (dx < -8 && innerRef.current) innerRef.current.style.transform = `translateX(${Math.max(dx, -76)}px)`;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - startX.current;
    if (innerRef.current) { innerRef.current.style.transition = "transform 0.2s"; innerRef.current.style.transform = ""; }
    if (dx < -60) onDelete();
  }
  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="absolute inset-y-0 right-0 w-16 flex items-center justify-center bg-red-500">
        <Trash2 className="w-4 h-4 text-white" />
      </div>
      <div ref={innerRef} className="relative w-full" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {children}
      </div>
    </div>
  );
}

function statusBadge(status: Appointment["status"]) {
  if (status === "upcoming") return "badge-green";
  if (status === "completed") return "badge-gray";
  return "badge-red";
}

function statusColor(status: Appointment["status"]) {
  if (status === "upcoming") return "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300";
  if (status === "completed") return "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400";
  return "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400";
}

const emptyForm = (): Omit<Appointment, "id"> => ({
  doctor: "", specialty: "", datetime: nowIST(), location: "", notes: "",
  status: "upcoming", postVisitNotes: "",
});

export default function AppointmentsPage() {
  useTimezoneRefresh();
  const { activePersonId, activePerson } = usePersonContext();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [calOffset, setCalOffset] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [showOverflow, setShowOverflow] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [notesTarget, setNotesTarget] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [postNotes, setPostNotes] = useState("");
  const [followupSuggestion, setFollowupSuggestion] = useState<{
    appt: Appointment; daysFromNow: number; reason: string;
  } | null>(null);

  useEffect(() => {
    if (!activePersonId) return;
    setLoading(true);
    api.appointments.getAll().then((data) => { setAppointments(data); setLoading(false); });
  }, [activePersonId]);

  function openAdd() { setEditing(null); setForm(emptyForm()); setShowModal(true); }
  function openEdit(appt: Appointment) {
    setEditing(appt);
    setForm({
      doctor: appt.doctor, specialty: appt.specialty,
      datetime: appt.datetime ? new Date(appt.datetime).toISOString().slice(0, 16) : nowIST(),
      location: appt.location, notes: appt.notes, status: appt.status, postVisitNotes: appt.postVisitNotes,
    });
    setShowModal(true);
  }

  async function save() {
    if (!form.doctor.trim()) { toast.error("Doctor name is required"); return; }
    if (!form.datetime) { toast.error("Date and time is required"); return; }
    const appt: Appointment = { id: editing?.id || uuidv4(), ...form, datetime: new Date(form.datetime).toISOString() };
    await api.appointments.save(appt);
    if (!editing) api.activity.push({ type: "appointment", label: `Added appointment: ${appt.doctor}`, at: new Date().toISOString() });
    setAppointments(await api.appointments.getAll());
    setShowModal(false);
    toast.success(editing ? "Appointment updated" : "Appointment added");
  }

  function deleteAppt(id: string) {
    const appt = appointments.find((a) => a.id === id);
    if (!appt) return;
    const prevAppts = [...appointments];
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    let undone = false;
    const tid = `undo-appt-${id}`;
    toast.custom(
      (t) => (
        <div className={`flex items-center gap-3 bg-gray-900 text-white pl-4 pr-3 py-3 rounded-xl shadow-lg max-w-xs transition-all ${t.visible ? "opacity-100" : "opacity-0"}`}>
          <span className="text-sm flex-1">Appointment removed</span>
          <button
            onClick={() => { undone = true; toast.dismiss(tid); setAppointments(prevAppts); }}
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
        await api.appointments.delete(id);
        api.activity.push({ type: "appointment", label: `Deleted appointment: ${appt.doctor}`, at: new Date().toISOString(), deleted: true });
      }
    }, 5100);
  }

  async function clearAll() {
    const count = appointments.length;
    await api.appointments.clearAll();
    api.activity.push({ type: "appointment", label: `Cleared all appointments (${count} item${count !== 1 ? "s" : ""})`, at: new Date().toISOString(), deleted: true });
    setAppointments([]);
    setShowClearConfirm(false);
    toast.success("All appointments cleared");
  }

  async function savePostNotes(id: string) {
    const appt = appointments.find((a) => a.id === id);
    if (!appt) return;
    const updated = { ...appt, postVisitNotes: postNotes };
    await api.appointments.save(updated);
    setAppointments(await api.appointments.getAll());
    setNotesTarget(null);
    toast.success("Notes saved");
    if (postNotes.trim()) {
      try {
        const res = await fetch("/api/suggest-followup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: postNotes, doctor: appt.doctor, specialty: appt.specialty }),
        });
        const data = await res.json();
        if (data.suggested) setFollowupSuggestion({ appt: updated, daysFromNow: data.daysFromNow, reason: data.reason });
      } catch { /* non-critical */ }
    }
  }

  async function createFollowup() {
    if (!followupSuggestion) return;
    const { appt, daysFromNow } = followupSuggestion;
    const followupDate = new Date(appt.datetime);
    followupDate.setDate(followupDate.getDate() + daysFromNow);
    const newAppt: Appointment = {
      id: uuidv4(), doctor: appt.doctor, specialty: appt.specialty,
      datetime: followupDate.toISOString(), location: appt.location,
      notes: `Follow-up: ${followupSuggestion.reason}`, status: "upcoming", postVisitNotes: "",
    };
    await api.appointments.save(newAppt);
    await api.activity.push({ type: "appointment", label: `Follow-up created: ${appt.doctor}`, at: new Date().toISOString() });
    setAppointments(await api.appointments.getAll());
    setFollowupSuggestion(null);
    toast.success("Follow-up appointment created");
  }

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const q = search.toLowerCase().trim();
  const matchesSearch = (a: Appointment) =>
    !q || a.doctor.toLowerCase().includes(q) || a.specialty.toLowerCase().includes(q) || a.location.toLowerCase().includes(q);
  const upcoming = appointments
    .filter((a) => a.status === "upcoming" && new Date(a.datetime) >= todayStart && matchesSearch(a))
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  const past = appointments
    .filter((a) => (a.status !== "upcoming" || new Date(a.datetime) < todayStart) && matchesSearch(a))
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());

  function AppCard({ appt }: { appt: Appointment }) {
    return (
      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{appt.doctor}</h3>
              {appt.specialty && <span className="badge-purple">{appt.specialty}</span>}
              <span className={statusBadge(appt.status)}>
                {appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
              </span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 space-y-0.5">
              <p className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
                {formatIST(appt.datetime)}
              </p>
              {appt.location && (
                <p className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  {appt.location}
                </p>
              )}
              {appt.notes && <p className="text-xs text-gray-400 dark:text-gray-500 italic">{appt.notes}</p>}
            </div>
            {appt.postVisitNotes && (
              <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Post-visit notes</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{appt.postVisitNotes}</p>
              </div>
            )}
          </div>
          <div className="flex gap-0.5 flex-shrink-0">
            <button
              onClick={() => downloadICS([appt], `${appt.doctor.replace(/\s+/g, "_")}.ics`)}
              title="Add to calendar"
              className="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => openEdit(appt)}
              className="p-1.5 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/30"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => deleteAppt(appt.id)}
              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        {appt.status === "completed" && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            {notesTarget === appt.id ? (
              <div className="space-y-2">
                <textarea className="input resize-none text-sm" rows={3} placeholder="Notes from this visit..."
                  value={postNotes} onChange={(e) => setPostNotes(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={() => savePostNotes(appt.id)} className="btn-primary text-xs py-1.5">Save</button>
                  <button onClick={() => setNotesTarget(null)} className="btn-secondary text-xs py-1.5">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setNotesTarget(appt.id); setPostNotes(appt.postVisitNotes); }}
                className="text-sm text-teal-600 dark:text-teal-400 hover:underline">
                {appt.postVisitNotes ? "Edit notes" : "+ Add visit notes"}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Week View ──────────────────────────────────────────────────────────────
  function WeekView() {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + calOffset * 7);
    weekStart.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });
    const weekEnd = days[6];
    const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCalOffset(o => o - 1)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – {weekEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          <button onClick={() => setCalOffset(o => o + 1)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAY_LABELS.map((d, i) => {
            const isToday = days[i].toDateString() === now.toDateString();
            return (
              <div key={d} className="text-center">
                <div className={`text-[10px] font-medium mb-0.5 ${isToday ? "text-teal-600 dark:text-teal-400" : "text-gray-400 dark:text-gray-500"}`}>{d}</div>
                <div className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center text-xs font-semibold ${isToday ? "bg-teal-600 text-white" : "text-gray-600 dark:text-gray-400"}`}>
                  {days[i].getDate()}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-7 gap-1 min-h-[100px]">
          {days.map((day, i) => {
            const dateStr = day.toISOString().split("T")[0];
            const dayAppts = appointments
              .filter(a => a.datetime.startsWith(dateStr))
              .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
            const isToday = day.toDateString() === now.toDateString();
            return (
              <div key={i} className={`rounded-lg p-0.5 min-h-[80px] border ${isToday ? "border-teal-200 dark:border-teal-700 bg-teal-50/30 dark:bg-teal-900/10" : "border-gray-100 dark:border-gray-700/50"}`}>
                {dayAppts.map(a => (
                  <button key={a.id} onClick={() => openEdit(a)}
                    className={`w-full text-left px-1.5 py-1 rounded mb-0.5 text-[10px] leading-tight font-medium truncate ${statusColor(a.status)}`}
                    title={`${a.doctor}${a.specialty ? ` · ${a.specialty}` : ""}`}
                  >
                    <div className="truncate">{a.doctor}</div>
                    <div className="opacity-75 truncate">{new Date(a.datetime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {appointments.length === 0 && (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
            <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No appointments scheduled this week</p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-700 mt-3">
          {[["bg-teal-100 dark:bg-teal-900/40", "Upcoming"], ["bg-gray-100 dark:bg-gray-700", "Completed"], ["bg-red-100 dark:bg-red-900/30", "Cancelled"]].map(([cls, lbl]) => (
            <span key={lbl} className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded ${cls} inline-block`} />{lbl}</span>
          ))}
        </div>
      </div>
    );
  }

  // ── Month View ─────────────────────────────────────────────────────────────
  function MonthView() {
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const displayDate = new Date(now.getFullYear(), now.getMonth() + calOffset, 1);
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();
    const firstDow = displayDate.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = now.toISOString().split("T")[0];

    const selectedAppts = selectedDate
      ? appointments.filter(a => a.datetime.startsWith(selectedDate)).sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
      : [];

    return (
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <button onClick={() => { setCalOffset(o => o - 1); setSelectedDate(null); }} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {displayDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </span>
          <button onClick={() => { setCalOffset(o => o + 1); setSelectedDate(null); }} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-gray-400 dark:text-gray-500">
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <div key={d} className="py-0.5 font-medium">{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayAppts = appointments.filter(a => a.datetime.startsWith(dateStr));
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const hasUpcoming = dayAppts.some(a => a.status === "upcoming");
            const hasCompleted = dayAppts.some(a => a.status === "completed");
            const hasCancelled = dayAppts.some(a => a.status === "cancelled");

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`h-9 rounded-lg flex flex-col items-center justify-start pt-1 transition-colors ${
                  isSelected ? "bg-teal-100 dark:bg-teal-900/40 ring-2 ring-teal-500 ring-offset-1 dark:ring-offset-gray-800" :
                  isToday ? "bg-teal-600" :
                  dayAppts.length > 0 ? "bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700" :
                  "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <span className={`text-[11px] font-medium ${isToday ? "text-white" : isSelected ? "text-teal-700 dark:text-teal-300" : "text-gray-700 dark:text-gray-300"}`}>{day}</span>
                {dayAppts.length > 0 && !isToday && (
                  <div className="flex gap-0.5 mt-0.5">
                    {hasUpcoming && <span className="w-1 h-1 rounded-full bg-teal-500" />}
                    {hasCompleted && <span className="w-1 h-1 rounded-full bg-gray-400" />}
                    {hasCancelled && <span className="w-1 h-1 rounded-full bg-red-400" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {selectedDate && (
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </h4>
            {selectedAppts.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">No appointments on this day</p>
            ) : (
              selectedAppts.map(a => (
                <div key={a.id} className="flex items-start justify-between gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{a.doctor}</span>
                      {a.specialty && <span className="badge-purple">{a.specialty}</span>}
                      <span className={statusBadge(a.status)}>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {new Date(a.datetime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                      {a.location && ` · ${a.location}`}
                    </p>
                  </div>
                  <div className="flex gap-0.5 flex-shrink-0">
                    <button onClick={() => openEdit(a)} className="p-1.5 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors rounded-lg">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteAppt(a.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
          {[["bg-teal-500", "Upcoming"], ["bg-gray-400", "Completed"], ["bg-red-400", "Cancelled"]].map(([cls, lbl]) => (
            <span key={lbl} className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${cls} inline-block`} />{lbl}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <TopBar />
      <main className="p-4 sm:p-6 max-w-3xl space-y-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Appointments</h2>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-0.5 gap-0.5">
              <button
                onClick={() => setViewMode("list")}
                title="List view"
                className={`p-1.5 rounded-lg transition-colors ${viewMode === "list" ? "bg-white dark:bg-gray-600 shadow-sm text-teal-600 dark:text-teal-400" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"}`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { setViewMode("week"); setCalOffset(0); }}
                title="Week view"
                className={`p-1.5 rounded-lg transition-colors ${viewMode === "week" ? "bg-white dark:bg-gray-600 shadow-sm text-teal-600 dark:text-teal-400" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"}`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { setViewMode("month"); setCalOffset(0); }}
                title="Month view"
                className={`p-1.5 rounded-lg transition-colors ${viewMode === "month" ? "bg-white dark:bg-gray-600 shadow-sm text-teal-600 dark:text-teal-400" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>

            <button onClick={openAdd} className="btn-primary">+ Add</button>
            {appointments.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowOverflow((v) => !v)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  title="More options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {showOverflow && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowOverflow(false)} />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 overflow-hidden">
                      <button
                        onClick={() => { downloadICS(appointments, "all_appointments.ics"); setShowOverflow(false); }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Download className="w-4 h-4" /> Export all as .ics
                      </button>
                      <button
                        onClick={() => { setShowOverflow(false); setShowClearConfirm(true); }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" /> Clear all appointments
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {viewMode === "list" && appointments.length > 3 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              className="input pl-9 text-sm"
              placeholder="Search by doctor, specialty, or location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : viewMode === "week" ? (
          <WeekView />
        ) : viewMode === "month" ? (
          <MonthView />
        ) : (
          <>
            {appointments.length === 0 ? (
              <div className="card text-center py-10 text-gray-400 dark:text-gray-500">
                <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No appointments yet</p>
                <p className="text-sm mt-1">Tap + Add to schedule your first appointment.</p>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    Upcoming ({upcoming.length})
                  </h3>
                  {upcoming.length === 0 ? (
                    <div className="card text-center py-8 text-gray-400 dark:text-gray-500">
                      <p className="text-sm">No upcoming appointments</p>
                    </div>
                  ) : (
                    <div className="space-y-3">{upcoming.map((a) => <SwipeCard key={a.id} onDelete={() => deleteAppt(a.id)}><AppCard appt={a} /></SwipeCard>)}</div>
                  )}
                </div>
                {past.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                      Past and Cancelled ({past.length})
                    </h3>
                    <div className="space-y-3">{past.map((a) => <SwipeCard key={a.id} onDelete={() => deleteAppt(a.id)}><AppCard appt={a} /></SwipeCard>)}</div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Follow-up suggestion */}
      {followupSuggestion && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50">
          <div className="bg-white dark:bg-gray-800 border border-teal-200 dark:border-teal-700 rounded-2xl shadow-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Follow-up suggested</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{followupSuggestion.reason}</p>
                <p className="text-xs text-teal-600 dark:text-teal-400 mt-1 font-medium">
                  {new Date(new Date(followupSuggestion.appt.datetime).getTime() + followupSuggestion.daysFromNow * 86400000).toLocaleDateString("en-IN", {
                    timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric",
                  })}{" "}with {followupSuggestion.appt.doctor}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={createFollowup} className="btn-primary flex-1 py-2">Create Appointment</button>
              <button onClick={() => setFollowupSuggestion(null)} className="btn-secondary px-4 py-2">Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {editing ? "Edit Appointment" : "Add Appointment"}
            </h3>
            <div>
              <label className="label">Doctor / Facility *</label>
              <input className="input" placeholder="e.g. Dr. Meera Sharma" value={form.doctor}
                onChange={(e) => setForm({ ...form, doctor: e.target.value })} />
            </div>
            <div>
              <label className="label">Specialty</label>
              <input className="input" placeholder="e.g. Cardiologist" value={form.specialty}
                onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
            </div>
            <div>
              <label className="label">Date and time (IST) *</label>
              <input type="datetime-local" className="input" value={form.datetime}
                onChange={(e) => setForm({ ...form, datetime: e.target.value })} />
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input" placeholder="e.g. Apollo Hospital" value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <textarea className="input resize-none" rows={2} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Appointment["status"] })}>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={save} className="btn-primary flex-1">
                {editing ? "Save Changes" : "Add Appointment"}
              </button>
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Delete all appointments for {activePerson?.nickname}?
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                This will permanently remove all {appointments.length} appointment{appointments.length !== 1 ? "s" : ""}. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={clearAll} className="btn-danger flex-1">Delete all</button>
              <button onClick={() => setShowClearConfirm(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
