import "./globals.css";
import type { Metadata } from "next";
import { Raleway } from "next/font/google";

// 1. Import and configure Raleway
const raleway = Raleway({
  subsets: ["latin"],
  // Pulling in regular, bold, and black weights for your UI
  weight: ["400", "700", "900"], 
});

export const metadata: Metadata = {
  title: "Aether-Drift: Airship",
  description: "A cyberpunk endless runner",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* 2. Apply Raleway to the entire body */}
      <body className={`${raleway.className} antialiased bg-black`}>
        {children}
      </body>
    </html>
  );
}