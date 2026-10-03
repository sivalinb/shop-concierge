import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shop Concierge",
  description:
    "Private enquiries, draft work orders and shared Stories for Siva’s shop.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
