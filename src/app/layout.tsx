import type { Metadata } from "next";
import { Cormorant_Garamond, Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-ui" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "The Booth | 私人德州扑克",
  description: "最多五人一起玩的私人德州扑克桌。无需注册，打开浏览器即可开局。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN" className={`${geist.variable} ${cormorant.variable}`}><body>{children}</body></html>;
}
