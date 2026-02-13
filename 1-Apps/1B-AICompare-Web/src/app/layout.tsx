import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";

const sora = Sora({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AI Model Rankings | aicomp.optamize.biz",
  description: "Compare the top AI models across key benchmarks. Live rankings, performance scores, and detailed analysis.",
  keywords: ["AI models", "LLM comparison", "GPT-4", "Claude", "Gemini", "benchmarks", "MMLU", "HumanEval"],
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
    <html lang="en" className="dark">
      <body className={`${sora.variable} font-sans antialiased bg-opta-bg`}>
        <Providers>
          <main className="min-h-screen">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
