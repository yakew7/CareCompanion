"use client";
import { usePathname } from "next/navigation";

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/records": "Records & Chat",
  "/medications": "Medications",
  "/symptoms": "Symptom Log",
  "/appointments": "Appointments",
};

export default function TopBar({ reportName }: { reportName?: string }) {
  const pathname = usePathname();
  const title = titles[pathname] || "CareCompanion";
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 justify-between sticky top-0 z-20">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      {reportName && (
        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full truncate max-w-xs">
          📄 {reportName}
        </span>
      )}
    </header>
  );
}
