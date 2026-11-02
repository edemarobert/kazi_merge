import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kazi Merge",
  description: "A simple work operating system for growing businesses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
