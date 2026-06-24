import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Operating Plan — Implementation Tracker",
  description: "Shared operating-plan implementation tracker.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
