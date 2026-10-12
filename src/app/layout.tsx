import type { Metadata } from "next";
import { Silkscreen, VT323 } from "next/font/google";
import "./globals.css";

const display = Silkscreen({
  variable: "--font-display",
  weight: ["400", "700"],
  subsets: ["latin"],
});

const body = VT323({
  variable: "--font-body",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Noir — The Larkin Job",
  description: "A 3D pixel-art detective vignette rendered with three.js.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
