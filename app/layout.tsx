import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Repzept Praxis-Copilot",
  description: "Minimaler Praxis-Copilot mit Rezeptmodus, Parsing und Demo-Modus.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
