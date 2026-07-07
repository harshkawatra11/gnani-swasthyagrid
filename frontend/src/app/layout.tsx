import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "SwasthyaGrid AI — District Health Operations Center",
  description:
    "An AI district health operations center that predicts, explains, and recommends resource redistribution across PHCs and CHCs — with a Citizen Portal for emergency guidance and nearest PHC routing. Human always in the loop.",
  keywords: ["healthcare", "AI", "district health", "PHC", "Gemini", "Google Cloud", "emergency guidance"],
  openGraph: {
    title: "SwasthyaGrid AI",
    description: "Predictive · Prescriptive · Explainable · Human-Governed · Citizen-Centric",
    url: "https://swasthyagrid.vercel.app",
    siteName: "SwasthyaGrid AI",
    locale: "en_IN",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${plexSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {children}
      </body>
    </html>
  );
}
