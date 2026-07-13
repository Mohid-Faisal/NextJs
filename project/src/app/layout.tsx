import "./globals.css";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeInitializer } from "@/components/theme-initializer";
import { Toaster } from "@/components/ui/sonner";
import PublicLayout from "@/components/PublicLayout";
import NextTopLoader from "nextjs-toploader";
import type { Metadata } from "next";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Courier Express",
  description: "Fast, Reliable and Affordable Courier Services",
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
        <NextTopLoader
          color="#3b82f6"
          height={3}
          showSpinner={false}
          shadow="0 0 10px #3b82f6, 0 0 5px #3b82f6"
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ThemeInitializer>
            <PublicLayout>
              {children}
            </PublicLayout>
            <Toaster position="top-center" richColors />
          </ThemeInitializer>
        </ThemeProvider>
      </body>
    </html>
  );
}
