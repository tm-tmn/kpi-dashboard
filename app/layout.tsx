import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KPI Dashboard - หน่วยเจาะเลือด",
  description: "สถิติงานบริการหน่วยเจาะเลือด เก็บสิ่งส่งตรวจ และ POCT",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 font-sans">{children}</body>
    </html>
  );
}
