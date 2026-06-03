"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import type { Appointment } from "@/lib/storage";
import { nowIST, formatIST } from "@/lib/time";

function statusBadge(status: Appointment["status"]) {
  if (status === "upcoming") return "badge-green";
  if (status === "completed") return "badge-gray";
  return "badge-red";
}

const emptyForm = (): Omit<Appointment, "id"> => ({
  doctor: "", specialty: "", datetime: nowIST(), location: "", notes: "",
  status: "upcoming", postVisitNotes: "",
});

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [notesTarget, setNotesTarget] = useState<string | null>(null);
  const [postNotes, setPostNotes] = useState("");
  const [followupSuggestion, setFollowupSuggestion] = useState<{
    appt: Appointment; daysFromNow: number; reason: string;
  } | null>(null);

  useEffect(() => {
    api.appointments.getAll().then(data => { setAppointments(data); setLoading(false); });
  }, []);

  function openAdd() { setEditing(null); setForm(emptyForm()); setShowModal(true); }
  function openEdit(appt: Appointment) {
    setEditing(appt);
    setForm({ doctor: appt.doctor, specialty: appt.specialty, datetime: appt.datetime ? new Date(appt.datetime).toISOString().slice(0, 16) : nowIST(),
      location: appt.location, notes: appt.notes, status: appt.status, postVisitNotes: appt.postVisitNotes });
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

  async function deleteAppt(id: string) {
    await api.appointments.delete(id);
    setAppointments(await api.appointments.getAll());
    toast.success("Appointment removed");
  }

  async function savePostNotes(id: string) {
    const appt = appointments.find(a => a.id === id);
    if (!appt) return;
    const updated = { ...appt, postVisitNotes: postNotes };
    await api.appointments.save(updated);
    setAppointments(await api.appointments.getAll());
    setNotesTarget(null);
    toast.success("Notes saved");

    if (postNotes.trim()) {
      const res = await fetch("/api/suggest-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: postNotes, doctor: appt.doctor, specialty: appt.specialty }),
      });
      const data = await res.json();
      if (data.suggested) setFollowupSuggestion({ appt: updated, daysFromNow: data.daysFromNow, reason: data.reason });
    }
  }

  async function createFollowup() {
    if (!followupSuggestion) return;
    const { appt, daysFromNow } = followupSuggestion;
    const followupDate = new Date();
    followupDate.setDate(followupDate.getDate() + daysFromNow);
    const newAppt: Appointment = {
      id: uuidv4(),
      doctor: appt.doctor,
      specialty: appt.specialty,
      datetime: followupDate.toISOString(),
      location: appt.location,
      notes: `Follow-up: ${followupSuggestion.reason}`,
      status: "upcoming",
      postVisitNotes: "",
    };
    await api.appointments.save(newAppt);
    await api.activity.push({ type: "appointment", label: `Follow-up created: ${appt.doctor}`, at: new Date().toISOString() });
    setAppointments(await api.appointments.getAll());
    setFollowupSuggestion(null);
    toast.success("Follow-up appointment created!");
  }

  const now = new Date();
  const upcoming = appointments.filter(a => a.status === "upcoming" && new Date(a.datetime) >= now)
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  const past = appointments.filter(a => a.status !== "upcoming" || new Date(a.datetime) < now)
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());

  function AppCard({ appt }: { appt: Appointment }) {
    return (
      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900">{appt.doctor}</h3>
              {appt.specialty && <span className="badge-purple">{appt.specialty}</span>}
              <span className={statusBadge(appt.status)}>{appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}</span>
            </div>
            <div className="text-sm text-gray-500 mt-1 space-y-0.5">
              <p>📅 {formatIST(appt.datetime)}</p>
              {appt.location && <p>📍 {appt.location}</p>}
              {appt.notes && <p className="text-xs text-gray-400 italic">{appt.notes}</p>}
            </div>
            {appt.postVisitNotes && (
              <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 mb-0.5">Post-visit notes</p>
                <p className="text-sm text-gray-700">{appt.postVisitNotes}</p>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <button onClick={() => openEdit(appt)} className="text-sm text-gray-400 hover:text-teal-600 transition-colors">✏️</button>
            <button onClick={() => deleteAppt(appt.id)} className="text-sm text-gray-400 hover:text-red-500 transition-colors">🗑️</button>
          </div>
        </div>
        {appt.status === "completed" && (
          <div className="mt-3 pt-3 border-t border-gray-100">
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
                className="text-sm text-teal-600 hover:underline">
                {appt.postVisitNotes ? "Edit notes" : "+ Add visit notes"}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <TopBar />
      <main className="p-6 max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Appointments</h2>
          <button onClick={openAdd} className="btn-primary">+ Add Appointment</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <>
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Upcoming ({upcoming.length})</h3>
              {upcoming.length === 0 ? (
                <div className="card text-center py-8 text-gray-400"><p className="text-sm">No upcoming appointments</p></div>
              ) : (
                <div className="space-y-3">{upcoming.map(a => <AppCard key={a.id} appt={a} />)}</div>
              )}
            </div>
            {past.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Past & Cancelled ({past.length})</h3>
                <div className="space-y-3">{past.map(a => <AppCard key={a.id} appt={a} />)}</div>
              </div>
            )}
            {appointments.length === 0 && (
              <div className="card text-center py-10 text-gray-400">
                <div className="text-4xl mb-3">📅</div>
                <p className="font-medium">No appointments yet</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* AI Follow-up suggestion */}
      {followupSuggestion && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50">
          <div className="bg-white border border-teal-200 rounded-2xl shadow-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">🤖</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">Follow-up detected</p>
                <p className="text-sm text-gray-600 mt-0.5">{followupSuggestion.reason}</p>
                <p className="text-xs text-teal-600 mt-1 font-medium">
                  📅 {new Date(Date.now() + followupSuggestion.daysFromNow * 86400000)
                    .toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" })}
                  {" "}with {followupSuggestion.appt.doctor}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={createFollowup} className="btn-primary flex-1 py-2">
                Create Appointment
              </button>
              <button onClick={() => setFollowupSuggestion(null)} className="btn-secondary px-4 py-2">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900">{editing ? "Edit Appointment" : "Add Appointment"}</h3>
            <div><label className="label">Doctor / Facility *</label><input className="input" placeholder="e.g. Dr. Meera Sharma" value={form.doctor} onChange={(e) => setForm({ ...form, doctor: e.target.value })} /></div>
            <div><label className="label">Specialty</label><input className="input" placeholder="e.g. Cardiologist" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} /></div>
            <div><label className="label">Date & time (IST) *</label><input type="datetime-local" className="input" value={form.datetime} onChange={(e) => setForm({ ...form, datetime: e.target.value })} /></div>
            <div><label className="label">Location</label><input className="input" placeholder="e.g. Apollo Hospital" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><label className="label">Notes (optional)</label><textarea className="input resize-none" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Appointment["status"] })}>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={save} className="btn-primary flex-1">{editing ? "Save Changes" : "Add Appointment"}</button>
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
