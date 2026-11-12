import type { Metadata } from "next";
import "./globals.css";
import "@/lib/mobile.css";
import { Providers } from "./providers";
import ThemeToggle from "@/components/ThemeToggle";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "(function(){try{var t=localStorage.getItem('theme')||'dark';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d){r.classList.add('dark')}else{r.classList.remove('dark')}}catch(e){document.documentElement.classList.add('dark')}})();" }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
        <div className="fixed bottom-4 right-4 z-[9998]">
          <ThemeToggle className="shadow-md bg-background/80 backdrop-blur" />
        </div>
      </body>
    </html>
  );
}
