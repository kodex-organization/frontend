import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
