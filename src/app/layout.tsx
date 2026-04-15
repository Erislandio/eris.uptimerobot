import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TriggerBot — API Scheduler & Monitor",
  description:
    "Schedule and monitor API triggers with real-time logs, cool-down management, and smart retry logic.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
