import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

export const viewport: Viewport = {
  themeColor: "#38BDF8",
};

export const metadata: Metadata = {
  title: "Tarea — Find Trusted Handymen Near You",
  description:
    "Book skilled handymen for plumbing, electrical, carpentry, cleaning, and more. Fast, reliable, and affordable home services.",
  keywords: ["handyman", "home repair", "plumbing", "electrical", "cleaning", "Tarea"],
  manifest: "/manifest.json",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
        <LanguageProvider>
        {children}
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
