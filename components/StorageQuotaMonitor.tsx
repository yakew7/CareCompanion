"use client";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { HardDrive } from "lucide-react";
import { exportAllData } from "@/lib/backup";

export default function StorageQuotaMonitor() {
  useEffect(() => {
    function handleQuotaExceeded() {
      toast.custom(
        (t) => (
          <div
            className={`flex items-start gap-3 bg-red-50 border border-red-200 dark:bg-red-900/30 dark:border-red-700 px-4 py-3 rounded-xl shadow-lg max-w-sm transition-all ${t.visible ? "opacity-100" : "opacity-0"}`}
          >
            <HardDrive className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-800 dark:text-red-200">Storage full</p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                Your last change wasn&apos;t saved — browser storage is full.
              </p>
              <button
                onClick={() => { exportAllData(); toast.dismiss(t.id); }}
                className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400 underline"
              >
                Export backup &amp; free space
              </button>
            </div>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="text-red-400 hover:text-red-600 dark:hover:text-red-300 ml-1 flex-shrink-0 text-lg leading-none"
            >
              ×
            </button>
          </div>
        ),
        { id: "quota-exceeded", duration: Infinity }
      );
    }

    window.addEventListener("cc:quotaexceeded", handleQuotaExceeded);
    return () => window.removeEventListener("cc:quotaexceeded", handleQuotaExceeded);
  }, []);

  return null;
}
