"use client";
import { useEffect, useState } from "react";
import { storage, UserProfile } from "@/lib/storage";

const RELATIONS = ["Child", "Spouse", "Sibling", "Parent", "Grandchild", "Other"];

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null | "loading">("loading");
  const [form, setForm] = useState({ name: "", patientName: "", relation: "Child" });
  const [error, setError] = useState("");

  useEffect(() => {
    setProfile(storage.profile.get());
  }, []);

  function handleSignIn() {
    if (!form.name.trim()) { setError("Please enter your name"); return; }
    const p: UserProfile = {
      name: form.name.trim(),
      patientName: form.patientName.trim(),
      relation: form.relation,
      createdAt: new Date().toISOString(),
    };
    storage.profile.save(p);
    setProfile(p);
  }

  if (profile === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">❤️</div>
            <h1 className="text-3xl font-bold text-teal-600">CareCompanion</h1>
            <p className="text-gray-500 mt-2 text-sm">
              AI-powered dashboard for family caregivers
            </p>
          </div>

          {/* Sign-in card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Get started</h2>
              <p className="text-sm text-gray-500 mt-1">
                Tell us a bit about yourself — your details stay on this device only.
              </p>
            </div>

            <div>
              <label className="label">Your name *</label>
              <input
                className="input"
                placeholder="e.g. Priya Sharma"
                value={form.name}
                onChange={(e) => { setForm({ ...form, name: e.target.value }); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                autoFocus
              />
              {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </div>

            <div>
              <label className="label">Patient&apos;s name (optional)</label>
              <input
                className="input"
                placeholder="e.g. Radha Sharma (your parent / dependent)"
                value={form.patientName}
                onChange={(e) => setForm({ ...form, patientName: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Your relation to the patient</label>
              <select
                className="input"
                value={form.relation}
                onChange={(e) => setForm({ ...form, relation: e.target.value })}
              >
                {RELATIONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>

            <button onClick={handleSignIn} className="btn-primary w-full py-3 text-base">
              Start using CareCompanion →
            </button>

            <p className="text-xs text-gray-400 text-center">
              No account needed. Everything is saved privately on this device.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
