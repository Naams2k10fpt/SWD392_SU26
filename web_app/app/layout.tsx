import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LUCY — Học và kết nối",
  description: "Ứng dụng web LUCY cho phòng học, ví, quà tặng và podcast.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
