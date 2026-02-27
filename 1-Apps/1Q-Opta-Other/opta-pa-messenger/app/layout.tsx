import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Opta PA Messenger",
  description: "Personal AI assistant for Matthew via Facebook Messenger",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
