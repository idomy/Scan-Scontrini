import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scan Scontrini — OCR AI per le tue spese",
  description:
    "Fotografa uno scontrino, l'AI estrae i dati strutturati e tiene traccia delle tue spese.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
