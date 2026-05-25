import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reddit 评论监控预警平台",
  description: "Reddit品牌声誉监控与恶意评论预警系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
