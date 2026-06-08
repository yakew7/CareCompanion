"use client";
import { useEffect } from "react";
import toast from "react-hot-toast";

// Listens for localStorage changes from other tabs and prompts the user to reload.
// Also listens for in-process concurrent-write conflicts detected by storage.ts.
export default function TabSyncProvider() {
  useEffect(() => {
    function handleStorageChange(e: StorageEvent) {
      if (!e.key || !e.newValue) return;
      const isDataKey = /^(medications|vitals|symptoms|appointments|records|activity|dietary|other|healthProfile|customVitalRanges)__/.test(e.key);
      if (!isDataKey) return;

      toast(
        (t) => (
          <span className="text-sm flex items-center gap-2">
            Updated in another tab.
            <button
              onClick={() => { toast.dismiss(t.id); window.location.reload(); }}
              className="font-semibold text-teal-600 underline whitespace-nowrap"
            >
              Reload
            </button>
          </span>
        ),
        { id: "tab-sync", duration: 10000 }
      );
    }

    function handleWriteConflict() {
      toast(
        (t) => (
          <span className="text-sm flex items-center gap-2">
            Conflict: another tab had unsaved changes — your version was kept.
            <button
              onClick={() => { toast.dismiss(t.id); window.location.reload(); }}
              className="font-semibold text-teal-600 underline whitespace-nowrap"
            >
              Reload
            </button>
          </span>
        ),
        { id: "write-conflict", duration: 12000 }
      );
    }

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("cc:writeconflict", handleWriteConflict);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("cc:writeconflict", handleWriteConflict);
    };
  }, []);

  return null;
}
