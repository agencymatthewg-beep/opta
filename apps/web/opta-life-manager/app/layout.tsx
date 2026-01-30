import type { Metadata } from "next";
import { Sora } from "next/font/google";
import { TaskProvider } from "@/contextsHooks/TaskContext";
import { ClawdbotProvider } from "@/contextsHooks/ClawdbotContext";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Atmosphere } from "@/components/Atmosphere";
import { CustomCursor } from "@/components/CustomCursor";
import { CinematicIntro } from "@/components/CinematicIntro";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Opta Life",
  description: "Personal dashboard for the Opta ecosystem",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "256x256" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Opta Life",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sora.variable} antialiased overflow-x-hidden bg-void text-text-primary selection:bg-primary selection:text-white`}>
        <SmoothScroll>
          <TaskProvider>
            <ClawdbotProvider>
              <Atmosphere />
              <CustomCursor />
              <CinematicIntro>
                <div className="relative z-10">
                  {children}
                </div>
              </CinematicIntro>
            </ClawdbotProvider>
          </TaskProvider>
        </SmoothScroll>
      </body>
    </html>
  );
}
