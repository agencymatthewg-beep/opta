import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Model Rankings | aicomp.optamize.biz",
  description: "Compare the top AI models across key benchmarks. Live rankings, performance scores, pricing, and industry news.",
  keywords: ["AI models", "LLM comparison", "GPT-4", "Claude", "Gemini", "benchmarks", "MMLU", "HumanEval", "AI pricing"],
  openGraph: {
    title: "AI Model Rankings",
    description: "Compare the top AI models across key benchmarks",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className={`${inter.variable} font-sans antialiased bg-opta-bg`}>
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
