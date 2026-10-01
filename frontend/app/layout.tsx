import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import { ThemeProvider } from "./theme-provider";
import { ThemeSwitch } from "./theme-switch";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mirlo",
  description: "Transcripción, traducción y diarización de audio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg-primary text-text-primary">
        <ThemeProvider>
          <header className="flex items-center justify-between border-b border-border-c bg-bg-surface px-6 py-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-bold tracking-tight"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F1F3F2]">
                <Image src="/logo.svg" alt="" width={22} height={22} unoptimized />
              </span>
              Mirlo
            </Link>
            <ThemeSwitch />
          </header>
          <main className="flex-1">{children}</main>
          <footer className="flex items-center justify-between border-t border-border-c bg-bg-surface px-6 py-4 text-sm text-text-secondary">
            <span>Mirlo · local-first</span>
            <nav className="flex gap-4">
              <Link href="/contacto" className="hover:text-text-primary">
                Contacto
              </Link>
              <Link href="/legal" className="hover:text-text-primary">
                Legal
              </Link>
            </nav>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
