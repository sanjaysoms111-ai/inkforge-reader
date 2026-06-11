import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import "./globals.css";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { ComicsProvider } from "./lib/ComicsContext";
import { ThemeProvider } from "./lib/ThemeContext";
import { RegisterSW } from "./components/RegisterSW";
import { InstallPrompt } from "./components/InstallPrompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'Inkforge Reader',
  description: 'Discover & Read AI Webtoons — installable PWA with offline support for unlocked chapters',
  icons: {
    icon: '/icon-192.jpg',
    apple: '/icon-192.jpg',
  },
  appleWebApp: {
    capable: true,
    title: 'Inkforge Reader',
    statusBarStyle: 'black-translucent',
  },
} 

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[var(--bg)] text-[var(--text)] transition-colors duration-200`}>
        <ThemeProvider>
          <ComicsProvider>
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
            {/* PWA: SW registration + custom install banner (beforeinstallprompt) */}
            <RegisterSW />
            <InstallPrompt />
          </ComicsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
