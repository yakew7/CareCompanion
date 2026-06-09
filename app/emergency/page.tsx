"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Phone, Heart, AlertTriangle, User, Pencil, Plus, Trash2, X, Shield,
} from "lucide-react";
import TopBar from "@/components/TopBar";
import { usePersonContext } from "@/contexts/PersonContext";
import { storage } from "@/lib/storage";
import type { EmergencyInfo, EmergencyContact } from "@/lib/storage";

const BLOOD_TYPES = ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−", "Unknown"];

const EMPTY: EmergencyInfo = { allergies: [], emergencyContacts: [] };

export default function EmergencyPage() {
  const { activePersonId } = usePersonContext();
  const [info, setInfo] = useState<EmergencyInfo>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EmergencyInfo>(EMPTY);

  // Allergy input state
  const [allergyInput, setAllergyInput] = useState("");
  // New contact form state
  const [addingContact, setAddingContact] = useState(false);
  const [contactForm, setContactForm] = useState<EmergencyContact>({ name: "", phone: "", relation: "" });

  useEffect(() => {
    if (!activePersonId) return;
    const loaded = storage.emergencyInfo.get(activePersonId);
    setInfo(loaded);
  }, [activePersonId]);

  function startEdit() {
    setDraft({ ...info, allergies: [...info.allergies], emergencyContacts: info.emergencyContacts.map((c) => ({ ...c })) });
    setAllergyInput("");
    setAddingContact(false);
    setContactForm({ name: "", phone: "", relation: "" });
    setEditing(true);
  }

  function save() {
    if (!activePersonId) return;
    storage.emergencyInfo.set(draft, activePersonId);
    setInfo(draft);
    setEditing(false);
    toast.success("Emergency info saved");
  }

  function cancel() {
    setEditing(false);
    setAllergyInput("");
    setAddingContact(false);
    setContactForm({ name: "", phone: "", relation: "" });
  }

  // ── Edit helpers ──────────────────────────────────────────────
  function addAllergy() {
    const val = allergyInput.trim();
    if (!val) return;
    setDraft((d) => ({ ...d, allergies: [...d.allergies, val] }));
    setAllergyInput("");
  }

  function removeAllergy(idx: number) {
    setDraft((d) => ({ ...d, allergies: d.allergies.filter((_, i) => i !== idx) }));
  }

  function addContact() {
    if (!contactForm.name.trim()) return;
    setDraft((d) => ({ ...d, emergencyContacts: [...d.emergencyContacts, { ...contactForm }] }));
    setContactForm({ name: "", phone: "", relation: "" });
    setAddingContact(false);
  }

  function removeContact(idx: number) {
    setDraft((d) => ({ ...d, emergencyContacts: d.emergencyContacts.filter((_, i) => i !== idx) }));
  }

  const isEmpty =
    !info.bloodType &&
    info.allergies.length === 0 &&
    info.emergencyContacts.length === 0 &&
    !info.primaryDoctor &&
    !info.primaryDoctorPhone &&
    !info.notes;

  // ── View mode ─────────────────────────────────────────────────
  if (!editing) {
    return (
      <>
        <TopBar />
        <main className="p-4 sm:p-6 max-w-2xl space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Emergency Info</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Show this screen to emergency responders</p>
              </div>
            </div>
            <button onClick={startEdit} className="btn-secondary flex items-center gap-1.5 text-sm px-4 py-2">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          </div>

          {isEmpty ? (
            <div className="card text-center py-12 space-y-3">
              <Shield className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto" />
              <p className="text-base font-medium text-gray-500 dark:text-gray-400">No emergency info yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">Tap Edit to add blood type, allergies, and emergency contacts.</p>
              <button onClick={startEdit} className="btn-primary inline-flex items-center gap-2 mx-auto mt-2">
                <Plus className="w-4 h-4" /> Add emergency info
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Blood type */}
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Blood Type</span>
                </div>
                <span className={`inline-block px-5 py-2 rounded-xl text-2xl font-bold ${
                  info.bloodType
                    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                }`}>
                  {info.bloodType || "Unknown"}
                </span>
              </div>

              {/* Allergies */}
              {info.allergies.length > 0 && (
                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Allergies</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {info.allergies.map((a, i) => (
                      <span key={i} className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Emergency contacts */}
              {info.emergencyContacts.length > 0 && (
                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <Phone className="w-4 h-4 text-teal-500" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Emergency Contacts</span>
                  </div>
                  <div className="space-y-3">
                    {info.emergencyContacts.map((c, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{c.name}</p>
                            {c.relation && <p className="text-xs text-gray-500 dark:text-gray-400">{c.relation}</p>}
                          </div>
                        </div>
                        {c.phone && (
                          <a
                            href={`tel:${c.phone}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors flex-shrink-0"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            {c.phone}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Primary doctor */}
              {(info.primaryDoctor || info.primaryDoctorPhone) && (
                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Primary Doctor</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{info.primaryDoctor || "—"}</p>
                    {info.primaryDoctorPhone && (
                      <a
                        href={`tel:${info.primaryDoctorPhone}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium transition-colors flex-shrink-0 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {info.primaryDoctorPhone}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {info.notes && (
                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Additional Notes</span>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{info.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <p className="text-xs text-center text-gray-400 dark:text-gray-500 pb-4">
            This information is stored only on this device. Show this screen to emergency responders.
          </p>
        </main>
      </>
    );
  }

  // ── Edit mode ─────────────────────────────────────────────────
  return (
    <>
      <TopBar />
      <main className="p-4 sm:p-6 max-w-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Edit Emergency Info</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={cancel} className="btn-secondary text-sm px-4 py-2">Cancel</button>
            <button onClick={save} className="btn-primary text-sm px-4 py-2">Save</button>
          </div>
        </div>

        {/* Blood type */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-red-500" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Blood Type</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {BLOOD_TYPES.map((bt) => (
              <button
                key={bt}
                onClick={() => setDraft((d) => ({ ...d, bloodType: d.bloodType === bt ? undefined : bt }))}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                  draft.bloodType === bt
                    ? "bg-red-600 border-red-600 text-white"
                    : "border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-red-300 dark:hover:border-red-700"
                }`}
              >
                {bt}
              </button>
            ))}
          </div>
          <input
            className="input text-sm"
            placeholder="Or type a custom blood type…"
            value={BLOOD_TYPES.includes(draft.bloodType ?? "") ? "" : (draft.bloodType ?? "")}
            onChange={(e) => setDraft((d) => ({ ...d, bloodType: e.target.value || undefined }))}
          />
        </div>

        {/* Allergies */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Allergies</span>
          </div>
          <div className="flex gap-2">
            <input
              className="input text-sm flex-1"
              placeholder="e.g. Penicillin, Peanuts…"
              value={allergyInput}
              onChange={(e) => setAllergyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addAllergy()}
            />
            <button onClick={addAllergy} className="btn-primary flex items-center gap-1 px-3 py-2 text-sm flex-shrink-0">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          {draft.allergies.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {draft.allergies.map((a, i) => (
                <span key={i} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                  {a}
                  <button onClick={() => removeAllergy(i)} className="hover:text-red-900 dark:hover:text-red-100 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Emergency contacts */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-teal-500" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Emergency Contacts</span>
            </div>
            {!addingContact && (
              <button onClick={() => setAddingContact(true)} className="btn-secondary flex items-center gap-1 text-xs px-3 py-1.5">
                <Plus className="w-3.5 h-3.5" /> Add contact
              </button>
            )}
          </div>

          {addingContact && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 space-y-2">
              <input
                className="input text-sm"
                placeholder="Name *"
                value={contactForm.name}
                autoFocus
                onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className="input text-sm"
                placeholder="Phone number"
                value={contactForm.phone}
                type="tel"
                onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <input
                className="input text-sm"
                placeholder="Relation (e.g. Spouse, Sibling)"
                value={contactForm.relation}
                onChange={(e) => setContactForm((f) => ({ ...f, relation: e.target.value }))}
              />
              <div className="flex gap-2">
                <button onClick={addContact} className="btn-primary flex-1 py-1.5 text-sm">Add</button>
                <button onClick={() => { setAddingContact(false); setContactForm({ name: "", phone: "", relation: "" }); }} className="btn-secondary flex-1 py-1.5 text-sm">Cancel</button>
              </div>
            </div>
          )}

          {draft.emergencyContacts.length > 0 && (
            <div className="space-y-2">
              {draft.emergencyContacts.map((c, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{[c.relation, c.phone].filter(Boolean).join(" · ")}</p>
                  </div>
                  <button onClick={() => removeContact(i)} className="p-1.5 text-gray-400 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Primary doctor */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Primary Doctor</span>
          </div>
          <input
            className="input text-sm"
            placeholder="Doctor name"
            value={draft.primaryDoctor ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, primaryDoctor: e.target.value || undefined }))}
          />
          <input
            className="input text-sm"
            placeholder="Doctor phone number"
            type="tel"
            value={draft.primaryDoctorPhone ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, primaryDoctorPhone: e.target.value || undefined }))}
          />
        </div>

        {/* Notes */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Additional Notes</span>
          </div>
          <textarea
            className="input resize-none text-sm"
            rows={4}
            placeholder="Any additional medical information for emergency responders…"
            value={draft.notes ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value || undefined }))}
          />
        </div>

        <div className="flex gap-3 pb-8">
          <button onClick={save} className="btn-primary flex-1 py-3 text-base font-semibold">Save emergency info</button>
          <button onClick={cancel} className="btn-secondary flex-1 py-3">Cancel</button>
        </div>

        <p className="text-xs text-center text-gray-400 dark:text-gray-500 pb-4">
          This information is stored only on this device. Show this screen to emergency responders.
        </p>
      </main>
    </>
  );
}
