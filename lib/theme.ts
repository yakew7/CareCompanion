"use client";
import { useState, useEffect } from "react";
import { storage } from "@/lib/storage";

const EVENT = "cc-theme-change";

export function useTheme() {
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined" && document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    function handler(e: Event) {
      setDark((e as CustomEvent<boolean>).detail);
    }
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    storage.theme.set(next ? "dark" : "light");
    setDark(next);
    window.dispatchEvent(new CustomEvent<boolean>(EVENT, { detail: next }));
  }

  return { dark, toggle };
}
