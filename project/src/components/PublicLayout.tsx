"use client";

import { usePathname } from "next/navigation";
import PublicNavbar from "./PublicNavbar";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Show public navbar on all pages except dashboard and auth pages
  const showPublicNavbar = !pathname.startsWith("/dashboard") && !pathname.startsWith("/auth");

  return (
    <div className="flex min-h-screen flex-col">
      {showPublicNavbar && <PublicNavbar />}
      <main className="flex-1">{children}</main>
      {showPublicNavbar && (
        <footer className="border-t border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-900 py-4">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              © {new Date().getFullYear()} PSS Worldwide. All rights reserved.
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
