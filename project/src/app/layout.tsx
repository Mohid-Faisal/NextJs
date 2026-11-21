import "./globals.css";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeInitializer } from "@/components/theme-initializer";
import { Toaster } from "@/components/ui/sonner";
import PublicLayout from "@/components/PublicLayout";
import NextTopLoader from "nextjs-toploader";
import TopLoaderFetch from "@/components/TopLoaderFetch";
import type { Metadata, Viewport } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  SITE_CONFIG,
  getSiteUrl,
  getOrganizationSchema,
  getWebSiteSchema,
} from "@/lib/seo";

const inter = Inter({ subsets: ["latin"], display: "swap" });

const googleVerification =
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() || undefined;
const bingVerification =
  process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim() || undefined;

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${SITE_CONFIG.fullBrand} — Courier & Cargo Management SaaS`,
    template: `%s | ${SITE_CONFIG.name}`,
  },
  description: SITE_CONFIG.description,
  applicationName: SITE_CONFIG.name,
  keywords: [...SITE_CONFIG.keywords],
  authors: [{ name: SITE_CONFIG.name, url: getSiteUrl() }],
  creator: SITE_CONFIG.name,
  publisher: SITE_CONFIG.name,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: SITE_CONFIG.fullBrand,
    title: `${SITE_CONFIG.fullBrand} — Courier & Cargo Management SaaS`,
    description: SITE_CONFIG.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_CONFIG.fullBrand} — Courier & Cargo Management SaaS`,
    description: SITE_CONFIG.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification:
    googleVerification || bingVerification
      ? {
          google: googleVerification,
          other: bingVerification
            ? { "msvalidate.01": bingVerification }
            : undefined,
        }
      : undefined,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#090d1f" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`min-h-screen font-sans antialiased ${inter.className}`}
      >
        <JsonLd data={[getOrganizationSchema(), getWebSiteSchema()]} />
        <NextTopLoader
          color="#3b82f6"
          height={3}
          showSpinner={false}
          shadow="0 0 10px #3b82f6, 0 0 5px #3b82f6"
        />
        <TopLoaderFetch />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ThemeInitializer>
            <PublicLayout>{children}</PublicLayout>
            <Toaster position="top-center" richColors />
          </ThemeInitializer>
        </ThemeProvider>
      </body>
    </html>
  );
}
