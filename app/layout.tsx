import "./globals.css";
import type { Metadata } from "next";

import { AuthSessionBar } from "@/components/AuthSessionBar";

export const metadata: Metadata = {
  title: "Repzept Praxis-Copilot",
  description: "Minimaler Praxis-Copilot mit Rezeptmodus, Parsing und Demo-Modus.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>
        <AuthSessionBar />
        {children}
      </body>
    </html>
  );
}
