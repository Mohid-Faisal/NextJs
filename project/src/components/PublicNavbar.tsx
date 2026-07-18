"use client";

import Link from "next/link";

const PublicNavbar = () => {
  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="bg-white/50 border-b border-gray-200/50 backdrop-blur-sm">
        <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 sm:h-16 items-center justify-between gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <img
                src="/logo_final.png"
                alt="PSS Logo"
                className="h-9 sm:h-10 w-auto object-contain"
              />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default PublicNavbar;
