"use client";

import { usePathname } from "next/navigation";
import PublicNavbar from "./PublicNavbar";
import { FaWhatsapp } from "react-icons/fa";

const WHATSAPP_NUMBER = "923008482321";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

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

      {/* Floating WhatsApp button - bottom right, on public pages only */}
      {showPublicNavbar && (
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat on WhatsApp"
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-all hover:scale-110 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2"
        >
          <FaWhatsapp className="h-8 w-8" />
        </a>
      )}
    </div>
  );
}
