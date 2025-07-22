// app/layout.tsx

import "./globals.css";
import type { Metadata } from "next";
import LayoutContent from "@/components/LayoutContent";

export const metadata: Metadata = {
  title: "Courier Dashboard",
  description: "Admin and User Courier Portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="text-gray-900">
        <LayoutContent>{children}</LayoutContent>
      </body>
    </html>
  );
}
