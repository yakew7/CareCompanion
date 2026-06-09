"use client";
import { useEffect, useState } from "react";
import { X, Smartphone } from "lucide-react";

/**
 * Shows a one-time dismissible banner on iOS Safari (non-standalone) explaining
 * that Web Push notifications require the app to be installed as a PWA.
 * Only renders if:
 *   1. The device is iOS (iPhone / iPad / iPod)
 *   2. The app is NOT already running in standalone mode (home screen PWA)
 *   3. The user hasn't dismissed it this session
 */
export default function IOSPushBanner() {
  const [show, setShow] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    // `navigator.standalone` is an Apple extension — true when running as a home-screen app
    const isStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const dismissed = sessionStorage.getItem("ios_push_banner_dismissed") === "1";

    if (isIOS && !isStandalone && !dismissed) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  function dismiss() {
    sessionStorage.setItem("ios_push_banner_dismissed", "1");
    setShow(false);
  }

  return (
    <div className="card border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/10 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
              Reminders need the app installed on iOS
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              Safari on iPhone doesn&apos;t support background notifications unless CareCompanion is added to your Home Screen.
            </p>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-blue-600 dark:text-blue-400 underline underline-offset-2 ml-6"
      >
        {expanded ? "Hide instructions" : "How to add to Home Screen →"}
      </button>

      {expanded && (
        <ol className="ml-6 mt-1 space-y-1 text-xs text-blue-700 dark:text-blue-300 list-decimal list-inside">
          <li>Tap the <strong>Share</strong> button (box with arrow) at the bottom of Safari</li>
          <li>Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong></li>
          <li>Tap <strong>Add</strong> in the top-right corner</li>
          <li>Open CareCompanion from your Home Screen — notifications will work</li>
        </ol>
      )}
    </div>
  );
}
