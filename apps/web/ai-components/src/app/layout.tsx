import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { MobileProviders } from "@/components/providers/MobileProviders";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Comp - AI Model Rankings",
  description: "Compare the top AI models across key benchmarks",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-opta-bg touch-manipulation`}>
        <MobileProviders>
          <main className="min-h-screen py-12 px-4">
            {children}
          </main>
        </MobileProviders>
      </body>
    </html>
  );
}
