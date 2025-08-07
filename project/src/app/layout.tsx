import "./globals.css";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeInitializer } from "@/components/theme-initializer";
import { Toaster } from "@/components/ui/sonner";
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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ThemeInitializer>
            {children}
            <Toaster position="top-center" richColors />
          </ThemeInitializer>
        </ThemeProvider>
      </body>
    </html>
  );
}
