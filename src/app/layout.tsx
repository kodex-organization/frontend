// src/app/layout.tsx
import type { Metadata } from "next";
// TypeScript may complain about side-effect CSS imports in some setups.
// @ts-ignore: Allow importing global CSS for Next.js app directory
import "./globals.css";
import { AuthProvider } from "@/lib/auth/auth-context";
import { OfflineBanner } from "@/components/sync/offline-banner";

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
          <OfflineBanner />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}