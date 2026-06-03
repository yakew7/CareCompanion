import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthGate from "@/components/AuthGate";
import NextAuthProvider from "@/components/NextAuthProvider";
import { PersonProvider } from "@/contexts/PersonContext";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "CareCompanion",
    template: "%s — CareCompanion",
  },
  description: "Dashboard for family caregivers managing health",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply dark class before first paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}`,
          }}
        />
      </head>
      <body className={`${inter.className} bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100`}>
        <NextAuthProvider>
          <PersonProvider>
            <AuthGate>{children}</AuthGate>
          </PersonProvider>
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
