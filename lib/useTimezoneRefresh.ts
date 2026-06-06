"use client";
import { useEffect, useState } from "react";

export const TZ_EVENT = "cc_timezone_changed";

export function dispatchTimezoneChange() {
  window.dispatchEvent(new Event(TZ_EVENT));
}

export function useTimezoneRefresh() {
  const [, setV] = useState(0);
  useEffect(() => {
    const handler = () => setV((n) => n + 1);
    window.addEventListener(TZ_EVENT, handler);
    return () => window.removeEventListener(TZ_EVENT, handler);
  }, []);
}
