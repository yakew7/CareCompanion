"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { usePersonContext } from "@/contexts/PersonContext";
import { PersonColor, PERSON_COLORS, personColorClasses } from "@/lib/storage";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";

const DEV_SKIP_AUTH = process.env.NEXT_PUBLIC_DEV_SKIP_AUTH === "true";

const COLOR_LABELS: Record<PersonColor, string> = {
  teal: "Teal",
  purple: "Purple",
  blue: "Blue",
  orange: "Orange",
  rose: "Rose",
};

export default function AuthGate({ children }: { children: React.ReactNode }) {
  if (DEV_SKIP_AUTH) return <DevShell>{children}</DevShell>;
  return <AuthShell>{children}</AuthShell>;
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <div className="md:ml-64 min-h-screen pb-20 md:pb-0 bg-white dark:bg-gray-900">{children}</div>
      <BottomNav />
    </>
  );
}

function DevShell({ children }: { children: React.ReactNode }) {
  const { persons, addPerson, personsLoading } = usePersonContext();

  useEffect(() => {
    if (!personsLoading && persons.length === 0) {
      const p = addPerson("Demo", "teal");
      import("@/lib/storage").then(({ storage }) => storage.persons.setActiveId(p.id));
    }
  }, [personsLoading, persons.length, addPerson]);

  if (personsLoading || persons.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}

function AuthShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const { persons, addPerson, personsLoading, refreshPersons } = usePersonContext();
  const [form, setForm] = useState<{ nickname: string; color: PersonColor }>({ nickname: "", color: "teal" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const isSignInPage = pathname === "/signin";

  useEffect(() => {
    if (status === "unauthenticated" && !isSignInPage) router.push("/signin");
  }, [status, isSignInPage, router]);

  function handleCompleteSetup() {
    if (!form.nickname.trim()) { setError("Enter a name or nickname"); return; }
    setSaving(true);
    addPerson(form.nickname.trim(), form.color);
    refreshPersons();
    setSaving(false);
  }

  if (isSignInPage) return <>{children}</>;

  if (status === "loading" || (status === "authenticated" && personsLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "authenticated" && !personsLoading && persons.length === 0) {
    const firstName = session?.user?.name?.split(" ")[0] || "there";
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 dark:from-teal-950 to-white dark:to-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-3">
              <Heart className="w-10 h-10 text-teal-600 fill-teal-600" />
            </div>
            <h1 className="text-3xl font-bold text-teal-600">CareCompanion</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Welcome, {firstName}!</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Who are you tracking?</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Add your first person. You can add more later.</p>
            </div>
            <div>
              <label className="label">Name or nickname</label>
              <input
                className="input"
                placeholder="e.g. Mum, Dad, Myself"
                value={form.nickname}
                autoFocus
                onChange={(e) => { setForm({ ...form, nickname: e.target.value }); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleCompleteSetup()}
              />
            </div>
            <div>
              <label className="label">Pick a colour</label>
              <div className="flex gap-3 mt-1">
                {PERSON_COLORS.map((c) => {
                  const cls = personColorClasses(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      title={COLOR_LABELS[c]}
                      className={`w-9 h-9 rounded-full ${cls.bg} transition-transform ${form.color === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-105"}`}
                    />
                  );
                })}
              </div>
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button onClick={handleCompleteSetup} disabled={saving} className="btn-primary w-full py-3 text-base disabled:opacity-60">
              {saving ? "Saving..." : "Continue to dashboard"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
