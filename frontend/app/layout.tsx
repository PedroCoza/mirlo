import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
            <a href="/" className="text-lg font-bold tracking-tight">
              🐦 Mirlo
            </a>
            <ThemeSwitch />
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border-c bg-bg-surface px-6 py-4 text-center text-sm text-text-secondary">
            Mirlo · Transcripción, traducción y diarización de audio · local-first
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
