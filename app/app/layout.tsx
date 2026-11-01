import type { ReactNode } from "react";

export const metadata = { title: "Catch fake invoices before paying" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, lineHeight: 1.5 }}>{children}</body>
    </html>
  );
}
