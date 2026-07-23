import type { Metadata } from "next";
import "./globals.css";
import "@/lib/mobile.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Around You",
  description: "Around You — guest, partner and admin portal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
