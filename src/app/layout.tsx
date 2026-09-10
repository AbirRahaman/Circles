import type { Metadata, Viewport } from "next";
import { Public_Sans } from "next/font/google";
import "./globals.css";

/* One family everywhere. A system stack would resolve to SF on a Mac and
   Segoe UI on Windows, so the same app would look like two different apps
   depending on who opened it. */
const sans = Public_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Circles",
  description: "Plans, money, photos and challenges for your friend group.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F4F7" },
    { media: "(prefers-color-scheme: dark)", color: "#131317" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="font-sans text-[15px] leading-normal">{children}</body>
    </html>
  );
}
