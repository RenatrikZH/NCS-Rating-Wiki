import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "NCS Ratings - NoCopyrightSounds 歌曲评分社区",
  description:
    "为 NCS (NoCopyrightSounds) 厂牌的每首歌曲评分、评论。社区驱动的好评/差评评分系统。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border bg-surface/50 py-6 text-center text-sm text-muted">
          <p>
            NCS Ratings - 社区驱动的 NCS 歌曲评分平台 | 数据来源：Spotify
            Web API
          </p>
          <p className="mt-1">
            本站与 NoCopyrightSounds 官方无关，仅用于社区评分讨论
          </p>
        </footer>
      </body>
    </html>
  );
}
