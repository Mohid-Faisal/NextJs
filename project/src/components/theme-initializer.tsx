"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export function ThemeInitializer({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      // Ensure theme is properly set
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme && savedTheme !== theme) {
        setTheme(savedTheme as "light" | "dark" | "system");
      }
    }
  }, [mounted, theme, setTheme]);

  if (!mounted) {
    return <div className="min-h-screen bg-background" />;
  }

  return <>{children}</>;
} 