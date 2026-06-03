"use client";
import { useSession, signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { storage, UserProfile } from "@/lib/storage";

const RELATIONS = [
  "I am the patient",
  "Child",
  "Spouse / Partner",
  "Parent",
  "Sibling",
  "Grandchild",
  "Caretaker",
  "Other",
];

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<UserProfile | null | "loading">("loading");
  const [form, setForm] = useState({ patientName: "", relation: "Child", customRelation: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    if (session?.user) {
      setProfile(storage.profile.get());
    }
  }, [session]);

  function completeSetup() {
    if (!form.patientName.trim() && form.relation !== "I am the patient") {
      setError("Please enter the patient's name");
      return;
    }
    if (form.relation === "Other" && !form.customRelation.trim()) {
      setError("Please describe your relation");
      return;
    }
    const p: UserProfile = {
      name: session!.user!.name || "Caregiver",
      patientName:
        form.relation === "I am the patient"
          ? session!.user!.name || "Yourself"
          : form.patientName.trim(),
      relation: form.relation === "Other" ? form.customRelation.trim() : form.relation,
      createdAt: new Date().toISOString(),
    };
    storage.profile.save(p);
    setProfile(p);
  }

  // Loading spinner
  if (status === "loading" || (status === "authenticated" && profile === "loading")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Not signed in — redirect to sign-in
  if (status === "unauthenticated") {
    signIn(undefined, { callbackUrl: "/" });
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Signed in but no patient profile yet — show one-time setup
  if (!profile) {
    const isSelf = form.relation === "I am the patient";
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">❤️</div>
            <h1 className="text-3xl font-bold text-teal-600">CareCompanion</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Welcome, {session?.user?.name?.split(" ")[0]}!
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">One last thing</h2>
              <p className="text-sm text-gray-500 mt-1">
                Tell us who you&apos;re caring for so we can personalise your dashboard.
              </p>
            </div>

            <div>
              <label className="label">Your relation to the patient</label>
              <select
                className="input"
                value={form.relation}
                onChange={(e) => { setForm({ ...form, relation: e.target.value }); setError(""); }}
              >
                {RELATIONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>

            {form.relation === "Other" && (
              <div>
                <label className="label">Describe your relation *</label>
                <input
                  className="input"
                  placeholder="e.g. Family friend, Nurse, Guardian..."
                  value={form.customRelation}
                  onChange={(e) => { setForm({ ...form, customRelation: e.target.value }); setError(""); }}
                  autoFocus
                />
              </div>
            )}

            {!isSelf && (
              <div>
                <label className="label">Patient&apos;s name *</label>
                <input
                  className="input"
                  placeholder="e.g. Radha Sharma"
                  value={form.patientName}
                  onChange={(e) => { setForm({ ...form, patientName: e.target.value }); setError(""); }}
                  autoFocus={form.relation !== "Other"}
                />
                {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
              </div>
            )}

            {isSelf && (
              <div className="bg-teal-50 rounded-xl px-4 py-3 text-sm text-teal-700">
                We&apos;ll set up the dashboard for you to track your own health.
              </div>
            )}

            <button onClick={completeSetup} className="btn-primary w-full py-3 text-base">
              Go to dashboard →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
