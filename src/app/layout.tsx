import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Studio 24",
  description: "Agentic PowerPoint generation for editable decks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-stone-50 text-stone-950">{children}</body>
    </html>
  );
}
