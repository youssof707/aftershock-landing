import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "Aftershock — Montreal's Favorite Afters";
const DESCRIPTION =
  "Montreal's Favorite Afters. Sat Oct 3, 10PM – 3AM at St. Catherine Hall.";

export const metadata: Metadata = {
  metadataBase: new URL("https://aftershock.events"),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Aftershock",
  alternates: { canonical: "/" },
  // No `openGraph.images` / `twitter.images` here on purpose: the file-based
  // `opengraph-image.tsx` and `twitter-image.tsx` routes take priority and
  // would silently override anything set here.
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Aftershock",
    locale: "en_CA",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// `themeColor` has been deprecated inside `metadata` since Next 14.
export const viewport: Viewport = { themeColor: "#05060a" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
