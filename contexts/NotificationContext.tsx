"use client";
import { createContext, useContext, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { storage } from "@/lib/storage";
import { usePersonContext } from "./PersonContext";

function parseTime(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(":").map(Number);
  return { h: h || 0, m: m || 0 };
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface NotificationCtxValue {
  requestPermission: () => Promise<boolean>;
}

const NotificationCtx = createContext<NotificationCtxValue>({
  requestPermission: async () => false,
});

export function useNotifications() {
  return useContext(NotificationCtx);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { activePersonId } = usePersonContext();
  const shownToday = useRef<Set<string>>(new Set());
  const lastResetDay = useRef<number>(-1);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined" || !("Notification" in window)) return false;
    const result = await Notification.requestPermission();
    const granted = result === "granted";
    const current = storage.notifications.get();
    storage.notifications.set({ ...current, enabled: granted });
    return granted;
  }, []);

  const fire = useCallback((title: string, body: string) => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.svg", badge: "/favicon.svg" });
    } else {
      toast(body, { icon: "💊", duration: 8000 });
    }
  }, []);

  useEffect(() => {
    if (!activePersonId) return;

    const check = async () => {
      const settings = storage.notifications.get();
      if (!settings.medicationReminders && !settings.symptomReminder) return;

      const now = new Date();
      const todayNum = now.getDate();
      const todayStr = now.toISOString().split("T")[0];

      if (lastResetDay.current !== todayNum) {
        shownToday.current = new Set();
        lastResetDay.current = todayNum;
      }

      // Merge persisted fired keys so reloads don't duplicate notifications.
      const persistKey = `cc_rem_${todayStr}`;
      try {
        const raw = localStorage.getItem(persistKey);
        if (raw) {
          for (const k of JSON.parse(raw) as string[]) shownToday.current.add(k);
        }
      } catch { /* ignore */ }

      function markShown(key: string) {
        shownToday.current.add(key);
        try {
          const keys = JSON.parse(localStorage.getItem(persistKey) || "[]") as string[];
          if (!keys.includes(key)) {
            keys.push(key);
            localStorage.setItem(persistKey, JSON.stringify(keys));
          }
        } catch { /* ignore */ }
      }

      const nowMin = now.getHours() * 60 + now.getMinutes();

      if (settings.medicationReminders) {
        const meds = await api.medications.getAll();
        for (const med of meds) {
          for (const timeEntry of med.times) {
            const parts = timeEntry.split(" ");
            let slot: { h: number; m: number } | undefined;

            if (parts.length === 2) {
              // weekly: "Monday Morning"
              const [dayStr, timeOfDay] = parts;
              if (now.getDay() !== DAY_NAMES.indexOf(dayStr)) continue;
              const custom = settings.reminderTimes[timeOfDay as keyof typeof settings.reminderTimes];
              slot = custom ? parseTime(custom) : undefined;
            } else {
              // daily: "Morning", "Evening" etc.
              const custom = settings.reminderTimes[timeEntry as keyof typeof settings.reminderTimes];
              slot = custom ? parseTime(custom) : undefined;
            }

            if (!slot) continue;
            // Fire within a 5-minute window after the slot so reloads don't miss reminders.
            const slotMin = slot.h * 60 + slot.m;
            const diff = nowMin - slotMin;
            if (diff < 0 || diff > 4) continue;

            const key = `med_${med.id}_${timeEntry}_${todayStr}`;
            if (!shownToday.current.has(key)) {
              markShown(key);
              fire(
                "Medication Reminder",
                `Time to take ${med.name}${med.dosage ? ` (${med.dosage})` : ""}`
              );
            }
          }
        }
      }

      // Auto-expire medications
      const allMeds = await api.medications.getAll();
      const expired = allMeds.filter((m) => m.expiresAt && new Date(m.expiresAt) <= now);
      for (const med of expired) {
        await api.medications.delete(med.id);
        await api.activity.push({ type: "medication", label: `Auto-removed: ${med.name} (course completed)`, at: now.toISOString(), deleted: true });
        fire("Medication course complete", `${med.name} has been removed — course finished.`);
      }

      if (settings.symptomReminder) {
        const [rH, rM] = settings.symptomReminderTime.split(":").map(Number);
        const slotMin = rH * 60 + rM;
        const diff = nowMin - slotMin;
        if (diff >= 0 && diff <= 4) {
          const key = `symptom_checkin_${todayStr}`;
          if (!shownToday.current.has(key)) {
            markShown(key);
            fire("Symptom Check-in", "Don't forget to log today's symptoms.");
          }
        }
      }
    };

    const interval = setInterval(check, 30_000);
    check();
    return () => clearInterval(interval);
  }, [activePersonId, fire]);

  return (
    <NotificationCtx.Provider value={{ requestPermission }}>
      {children}
    </NotificationCtx.Provider>
  );
}
