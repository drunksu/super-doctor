import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Super-Doctor · 智能问诊多智能体系统",
    template: "%s · Super-Doctor",
  },
  description:
    "Super-Doctor 是一个多智能体智能问诊系统：分诊、结构化问诊、全科建议、报告解读与安全审查协同工作，回答引用可查证的中文临床指南。",
  applicationName: "Super-Doctor",
  keywords: ["智能问诊", "多智能体", "健康助手", "报告解读", "Super-Doctor"],
  authors: [{ name: "Super-Doctor" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f8fa",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
