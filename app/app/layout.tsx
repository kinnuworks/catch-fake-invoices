import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata = {
  title: "InvoiceGuard: catch fake invoices before paying",
  description: "InvoiceGuard is an AI agent that checks a supplier's invoice before any money moves.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-accent="amber" className={`${inter.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
