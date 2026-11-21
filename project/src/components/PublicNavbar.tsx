"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, ArrowRight } from "lucide-react";

const NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
  { href: "/tracking", label: "Track Shipment" },
];

export default function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/70 dark:border-zinc-800/80 bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md">
      <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 shrink-0"
            aria-label="Proxima Smart Solutions (PSS) Home"
          >
            <Image
              src="/SaaS-Logo.png"
              alt="Proxima Smart Solutions (PSS)"
              width={160}
              height={44}
              priority
              className="h-9 sm:h-10 w-auto object-contain"
            />
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/auth/login"
              className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-colors"
            >
              Start Free Trial
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-900"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-zinc-800 py-4 space-y-3">
            <nav aria-label="Mobile navigation" className="flex flex-col space-y-2">
              {NAV_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/auth/login"
                onClick={() => setMobileOpen(false)}
                className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                onClick={() => setMobileOpen(false)}
                className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
