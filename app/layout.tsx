import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KPI Dashboard - หน่วยเจาะเลือด",
  description: "สถิติงานบริการหน่วยเจาะเลือด เก็บสิ่งส่งตรวจ และ POCT",
};

// Applied before first paint (blocking, in <head>) so a returning visitor's
// saved theme/mode shows immediately instead of flashing the SSR default
// and then snapping to their choice once React hydrates.
const SET_THEME_BEFORE_PAINT = `
try {
  var t = localStorage.getItem("kpi-theme");
  if (t) document.documentElement.setAttribute("data-theme", t);
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className="h-full antialiased" data-theme="ocean-dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: SET_THEME_BEFORE_PAINT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <div className="ambient-bg" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
