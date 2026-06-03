"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { storage, Person, PersonColor } from "@/lib/storage";

interface PersonContextValue {
  persons: Person[];
  activePersonId: string;
  activePerson: Person | null;
  personsLoading: boolean;
  switchPerson: (id: string) => void;
  addPerson: (nickname: string, color: PersonColor) => Person;
  removePerson: (id: string) => void;
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
  refreshPersons: () => {},
});

export function PersonProvider({ children }: { children: React.ReactNode }) {
  const [persons, setPersons] = useState<Person[]>([]);
  const [activePersonId, setActivePersonIdState] = useState<string>("");
  const [personsLoading, setPersonsLoading] = useState(true);

  const refreshPersons = useCallback(() => {
    const p = storage.persons.getAll();
    const storedId = storage.persons.getActiveId();
    const validId = p.find((x) => x.id === storedId) ? storedId : p[0]?.id || "";
    setPersons(p);
    setActivePersonIdState(validId);
    if (validId !== storedId) storage.persons.setActiveId(validId);
    setPersonsLoading(false);
  }, []);

  useEffect(() => {
    refreshPersons();
  }, [refreshPersons]);

  const switchPerson = useCallback((id: string) => {
    storage.persons.setActiveId(id);
    setActivePersonIdState(id);
  }, []);

  const addPerson = useCallback((nickname: string, color: PersonColor): Person => {
    const p: Person = { id: uuidv4(), nickname: nickname.trim(), color };
    storage.persons.save(p);
    const updated = storage.persons.getAll();
    setPersons(updated);
    if (!storage.persons.getActiveId()) {
      storage.persons.setActiveId(p.id);
      setActivePersonIdState(p.id);
    }
    return p;
  }, []);

  const removePerson = useCallback(
    (id: string) => {
      storage.persons.delete(id);
      const remaining = storage.persons.getAll();
      setPersons(remaining);
      if (activePersonId === id) {
        const newId = remaining[0]?.id || "";
        storage.persons.setActiveId(newId);
        setActivePersonIdState(newId);
      }
    },
    [activePersonId]
  );

  const activePerson = persons.find((p) => p.id === activePersonId) || null;

  return (
    <PersonContext.Provider
      value={{ persons, activePersonId, activePerson, personsLoading, switchPerson, addPerson, removePerson, refreshPersons }}
    >
      {children}
    </PersonContext.Provider>
  );
}

export function usePersonContext() {
  return useContext(PersonContext);
}
