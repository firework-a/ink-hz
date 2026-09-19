import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "水墨杭州",
  description: "An online ink-style city of Hangzhou, made by gamemcu",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      {/* suppressHydrationWarning: browser extensions inject attributes (e.g.
          data-atm-ext-installed) onto <body> before React hydrates, which would
          otherwise log a hydration mismatch on every load. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
