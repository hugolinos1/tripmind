import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tripmind - Votre assistant voyage intelligent",
  description: "Planifiez vos voyages avec l'aide de l'intelligence artificielle. Itinéraires personnalisés, recommandations intelligentes et enrichissement automatique.",
  keywords: ["voyage", "travel", "itinerary", "itinéraire", "IA", "AI", "tripmind", "planification", "travel planner"],
  authors: [{ name: "Tripmind" }],
  icons: {
    icon: "/logo.png",
  },
  openGraph: {
    title: "Tripmind - Assistant voyage intelligent",
    description: "Créez des itinéraires de voyage personnalisés avec l'aide de l'IA",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
