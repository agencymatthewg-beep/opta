import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OptaPlus",
  description: "Your bots. One app. Zero compromise.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-void text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
