"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { v4 as uuidv4 } from "uuid";
import { scopedPersons, storage, Person, PersonColor } from "@/lib/storage";

const DEV_SKIP_AUTH = process.env.NEXT_PUBLIC_DEV_SKIP_AUTH === "true";

interface PersonContextValue {
  persons: Person[];
  activePersonId: string;
  activePerson: Person | null;
  personsLoading: boolean;
  switchPerson: (id: string) => void;
  addPerson: (nickname: string, color: PersonColor) => Person;
  removePerson: (id: string) => void;
  renamePerson: (id: string, nickname: string, color: PersonColor) => void;
  refreshPersons: () => void;
}

const PersonContext = createContext<PersonContextValue>({
  persons: [],
  activePersonId: "",
  activePerson: null,
  personsLoading: true,
  switchPerson: () => {},
  addPerson: () => ({ id: "", nickname: "", color: "teal" }),
  removePerson: () => {},
  renamePerson: () => {},
  refreshPersons: () => {},
});

export function PersonProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  // In dev-skip-auth mode use a fixed key so storage still works.
  // In prod, wait until the session resolves so we never read the wrong user's data.
  const userKey = DEV_SKIP_AUTH ? "__dev__" : (session?.user?.email ?? "");
  const sessionReady = DEV_SKIP_AUTH || status !== "loading";

  // Seed from unscoped localStorage for instant first-render — refreshPersons will correct to scoped keys
  const [persons, setPersons] = useState<Person[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("persons") || "[]"); } catch { return []; }
  });
  const [activePersonId, setActivePersonIdState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("activePerson") || "";
  });
  const [personsLoading, setPersonsLoading] = useState(true);

  const refreshPersons = useCallback(() => {
    if (!sessionReady) return;
    const ps = scopedPersons(userKey);
    const p = ps.getAll();
    const storedId = ps.getActiveId();
    const validId = p.find((x) => x.id === storedId) ? storedId : p[0]?.id || "";
    setPersons(p);
    setActivePersonIdState(validId);
    if (validId !== storedId) ps.setActiveId(validId);
    storage.persons.setActiveId(validId); // keep unscoped key in sync for api.ts
    setPersonsLoading(false);
  }, [userKey, sessionReady]);

  // Re-load whenever the signed-in user changes (account switch)
  useEffect(() => {
    if (sessionReady) {
      setPersonsLoading(true);
      refreshPersons();
    }
  }, [refreshPersons, sessionReady]);

  const switchPerson = useCallback((id: string) => {
    scopedPersons(userKey).setActiveId(id);
    storage.persons.setActiveId(id); // keep unscoped key in sync for api.ts
    setActivePersonIdState(id);
  }, [userKey]);

  const addPerson = useCallback((nickname: string, color: PersonColor): Person => {
    const ps = scopedPersons(userKey);
    const p: Person = { id: uuidv4(), nickname: nickname.trim(), color };
    ps.save(p);
    const updated = ps.getAll();
    setPersons(updated);
    if (!ps.getActiveId()) {
      ps.setActiveId(p.id);
      storage.persons.setActiveId(p.id);
      setActivePersonIdState(p.id);
    }
    return p;
  }, [userKey]);

  const removePerson = useCallback((id: string) => {
    const ps = scopedPersons(userKey);
    ps.delete(id);
    const remaining = ps.getAll();
    setPersons(remaining);
    if (activePersonId === id) {
      const newId = remaining[0]?.id || "";
      ps.setActiveId(newId);
      storage.persons.setActiveId(newId);
      setActivePersonIdState(newId);
    }
  }, [userKey, activePersonId]);

  const renamePerson = useCallback((id: string, nickname: string, color: PersonColor) => {
    const ps = scopedPersons(userKey);
    const updated = ps.getAll().map((p) => p.id === id ? { ...p, nickname: nickname.trim(), color } : p);
    updated.forEach((p) => ps.save(p));
    setPersons(ps.getAll());
  }, [userKey]);

  const activePerson = persons.find((p) => p.id === activePersonId) || null;

  return (
    <PersonContext.Provider
      value={{ persons, activePersonId, activePerson, personsLoading, switchPerson, addPerson, removePerson, renamePerson, refreshPersons }}
    >
      {children}
    </PersonContext.Provider>
  );
}

export function usePersonContext() {
  return useContext(PersonContext);
}
