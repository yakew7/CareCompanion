"use client";
import { useEffect, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { daysSinceFirstUse, dismissBackupReminder, isBackupReminderDismissed, exportAllData } from "@/lib/backup";

export default function BackupReminder() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isBackupReminderDismissed() && daysSinceFirstUse() >= 7) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function handleDismiss() {
    dismissBackupReminder();
    setVisible(false);
  }

  function handleExport() {
    exportAllData();
    dismissBackupReminder();
    setVisible(false);
  }

  return (
    <div className="fixed bottom-20 md:bottom-4 left-2 right-2 md:left-auto md:right-4 md:w-96 z-40">
      <div className="bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700 rounded-2xl shadow-xl p-4 flex gap-3 items-start">
        <ShieldCheck className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Back up your data</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            You have weeks of health records stored here. Download a backup so you never lose it if you clear your browser.
          </p>
          <button
            onClick={handleExport}
            className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
          >
            Download backup now →
          </button>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg flex-shrink-0"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
