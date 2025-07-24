
import "../globals.css";
import type { Metadata } from "next";
import { Toaster } from "sonner";
import LayoutContent from "@/components/LayoutContent";
import { inter } from "@/lib/fonts"; // Only define font class here

export const metadata: Metadata = {
  title: "Courier Dashboard",
  description: "Admin and User Courier Portal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.className}>
      <body className="text-gray-900 bg-gray-50 dark:bg-black dark:text-white transition-colors duration-300">
        <LayoutContent>{children}</LayoutContent>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
