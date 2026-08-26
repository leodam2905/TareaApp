import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import dynamic from "next/dynamic";

const AiSupportChat = dynamic(() => import("@/components/ui/AiSupportChat"), { ssr: false });

export const viewport: Viewport = {
  themeColor: "#38BDF8",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  // Without this, Next resolves Open Graph and canonical URLs relative to
  // localhost at build time — the share previews Google and every social
  // platform read would point at a machine nobody can reach.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://taptarea.com"),
  title: "Tarea — Find Trusted Handymen Near You",
  description:
    "Book skilled handymen for plumbing, electrical, carpentry, cleaning, and more. Fast, reliable, and affordable home services.",
  keywords: ["handyman", "home repair", "plumbing", "electrical", "cleaning", "Tarea"],
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tarea",
  },
  openGraph: {
    title: "Tarea",
    description: "Find Trusted Handymen Near You",
    type: "website",
  },
};

// Day by default — ThemeContext adds .dark for anyone who picks night.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
        <LanguageProvider>
        {children}
        <AiSupportChat />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1E3A8A",
              color: "#fff",
              borderRadius: "12px",
              fontFamily: "Inter, sans-serif",
            },
            success: { style: { background: "#059669" } },
            error: { style: { background: "#DC2626" } },
          }}
        />
        </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
