// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/auth-context";
import { OfflineBanner } from "@/components/sync/offline-banner";
import { AuthenticatedHeartbeat } from "@/components/sync/authenticated-heartbeat";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "CueCloud",
  description: "Snooker club management and POS platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AuthenticatedHeartbeat />
          <OfflineBanner />
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
