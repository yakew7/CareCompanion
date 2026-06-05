"use client";
import { useEffect } from "react";
import toast from "react-hot-toast";

// Listens for localStorage changes from other tabs and prompts the user to reload.
export default function TabSyncProvider() {
  useEffect(() => {
    function handleStorageChange(e: StorageEvent) {
      if (!e.key || !e.newValue) return;
      // Only react to our app's person-scoped data keys
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

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return null;
}
