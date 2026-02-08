import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ProvaProvider } from "@/contexts/ProvaContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Monta Provas",
  description: "Editor de questões para provas e avaliações",
  icons: {
    icon: [
      { url: "/mp.svg", type: "image/svg+xml" },
      { url: "/mp.png", sizes: "32x32", type: "image/png" }
    ],
    apple: "/apple-icon.png", // 180x180
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ProvaProvider>
          {children}
        </ProvaProvider>
      </body>
    </html>
  );
}
