import "./globals.css";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
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
      <body className={inter.className}>
        {/* Wrap in ThemeProvider for dark/light support */}
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
          <Toaster /> {/* ✅ Required for Sonner toast notifications */}
        </ThemeProvider>
      </body>
    </html>
  );
}
