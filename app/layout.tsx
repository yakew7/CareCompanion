import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import AuthGate from "@/components/AuthGate";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CareCompanion — AI Caregiver Dashboard",
  description: "AI-powered dashboard for family caregivers managing elderly health",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50`}>
        <AuthGate>
          <Sidebar />
          <div className="md:ml-64 min-h-screen pb-20 md:pb-0">
            {children}
          </div>
          <BottomNav />
        </AuthGate>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { borderRadius: "12px", fontSize: "14px" },
            success: { iconTheme: { primary: "#0D9488", secondary: "white" } },
          }}
        />
      </body>
    </html>
  );
}
