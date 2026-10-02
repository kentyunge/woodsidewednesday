import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Woodside Wednesday", template: "%s · Woodside Wednesday" },
  description: "Woodside Wednesday golf league: scores, standings and stats.",
  // Home-screen name and full-screen launch on iPhone; icons come from app/icon.svg and app/apple-icon.png.
  // A translucent status bar lets the green header run up behind the clock, like a native app.
  appleWebApp: { capable: true, title: "Woodside", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2f6b45",
  // Draw under the notch and home indicator; layouts pad with env(safe-area-inset-*).
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster position="top-center" richColors mobileOffset={{ top: "calc(env(safe-area-inset-top) + 16px)" }} />
      </body>
    </html>
  );
}
