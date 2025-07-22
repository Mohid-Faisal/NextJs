import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";


const inter = Inter({ subsets: ["latin"], display: "swap" });

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className={cn("min-h-screen bg-background font-sans antialiased", inter.className)}>
        {children}
      </div>
    </ThemeProvider>
  );
}
