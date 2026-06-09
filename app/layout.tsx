import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import AuthGate from "@/components/AuthGate";
import NextAuthProvider from "@/components/NextAuthProvider";
import { PersonProvider } from "@/contexts/PersonContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { Toaster } from "react-hot-toast";
import TabSyncProvider from "@/components/TabSyncProvider";
import StorageQuotaMonitor from "@/components/StorageQuotaMonitor";

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
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0D9488" />
        {/* Apply dark class before first paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');`,
          }}
        />
      </head>
      <body className="font-sans bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <NextAuthProvider>
          <PersonProvider>
            <NotificationProvider>
              <TabSyncProvider />
              <StorageQuotaMonitor />
          <AuthGate>{children}</AuthGate>
            </NotificationProvider>
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
