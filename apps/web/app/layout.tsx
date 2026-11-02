import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kazi Merge",
  description: "A simple work operating system for growing businesses.",
  applicationName: "Kazi Merge",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div id="app-root">{children}</div>
      </body>
    </html>
  );
}
