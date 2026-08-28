import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "2026 일본 여행",
  description: "2026년 10월 2일부터 6일까지의 일본 여행 일정",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
