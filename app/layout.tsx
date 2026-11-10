import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Releasebuff — Find the story worth sharing",
  description: "Turn your development work into grounded stories for LinkedIn and X.",
  applicationName: "Releasebuff",
  icons: { icon: "/brand/releasebuff-mark.svg" }
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#173d2d" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
