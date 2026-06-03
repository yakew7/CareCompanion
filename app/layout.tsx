import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthGate from "@/components/AuthGate";
import NextAuthProvider from "@/components/NextAuthProvider";
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
        <NextAuthProvider>
          <AuthGate>{children}</AuthGate>
          <Toaster
            position="top-right"
            toastOptions={{
              style: { borderRadius: "12px", fontSize: "14px" },
              success: { iconTheme: { primary: "#0D9488", secondary: "white" } },
            }}
          />
        </NextAuthProvider>
      </body>
    </html>
  );
}
