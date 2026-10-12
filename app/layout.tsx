import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reserve | Workspace reservations",
  description: "Find and reserve shared workspace resources.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
