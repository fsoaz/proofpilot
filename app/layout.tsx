import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProofPilot — Verification workspace",
  description: "AI that proves its own work with browser evidence.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
