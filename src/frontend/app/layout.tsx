import type { Metadata } from 'next';
import './globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import { Providers } from './providers';
import { cn } from '@/lib/utils';
import { Navbar } from "@/components/Navbar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { Footer } from "@/components/Footer";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'ArbiLoop',
  description: 'Automated DeFi strategies on Arbitrum.',
  icons: {
    icon: [
      { url: '/ArbiLoop.png', type: 'image/png' },
    ],
    apple: [
      { url: '/ArbiLoop.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      {
        rel: 'apple-touch-icon-precomposed',
        url: '/ArbiLoop.png',
      },
    ],
  },
  manifest: '/favicons/site.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen font-sans antialiased selection:bg-primary/20 pb-20 md:pb-0")}>
        <Providers>
          <Navbar />
          {children}
          <Footer />
          <MobileBottomNav />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}

