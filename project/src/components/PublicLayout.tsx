"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import PublicNavbar from "./PublicNavbar";
import { FaWhatsapp } from "react-icons/fa";
import { Mail, MapPin, Phone } from "lucide-react";

const WHATSAPP_NUMBER = "923008482321";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const showPublicChrome =
    !pathname.startsWith("/dashboard") &&
    !pathname.startsWith("/auth") &&
    pathname !== "/tracking";

  return (
    <div className="flex min-h-screen flex-col">
      {showPublicChrome && <PublicNavbar />}
      <main className="flex-1">{children}</main>
      {showPublicChrome && (
        <footer className="border-t border-slate-200 bg-slate-950 text-slate-300">
          <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="space-y-4">
                <Link href="/" className="inline-flex items-center gap-2">
                  <Image
                    src="/SaaS-Logo.png"
                    alt="Proxima Smart Solutions (PSS)"
                    width={150}
                    height={40}
                    className="h-9 w-auto object-contain brightness-0 invert"
                  />
                </Link>
                <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
                  Proxima Smart Solutions (PSS) — all-in-one cloud courier, cargo,
                  and logistics management SaaS for modern delivery teams.
                </p>
              </div>

              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
                  Product
                </h2>
                <ul className="space-y-2.5 text-sm text-slate-400">
                  <li>
                    <Link href="/#features" className="hover:text-white transition-colors">
                      Features
                    </Link>
                  </li>
                  <li>
                    <Link href="/#pricing" className="hover:text-white transition-colors">
                      Pricing Plans
                    </Link>
                  </li>
                  <li>
                    <Link href="/#faq" className="hover:text-white transition-colors">
                      Frequently Asked Questions
                    </Link>
                  </li>
                  <li>
                    <Link href="/tracking" className="hover:text-white transition-colors">
                      Real-Time Tracking
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
                  Account &amp; Legal
                </h2>
                <ul className="space-y-2.5 text-sm text-slate-400">
                  <li>
                    <Link href="/auth/signup" className="hover:text-white transition-colors">
                      Start 14-Day Free Trial
                    </Link>
                  </li>
                  <li>
                    <Link href="/auth/login" className="hover:text-white transition-colors">
                      Sign In to Portal
                    </Link>
                  </li>
                  <li>
                    <Link href="/privacy" className="hover:text-white transition-colors">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/terms" className="hover:text-white transition-colors">
                      Terms of Service
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
                  Contact
                </h2>
                <ul className="space-y-3 text-sm text-slate-400">
                  <li className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                    <span>
                      LGF-44, Land Mark Plaza, Jail Road
                      <br />
                      Lahore, 54660, Pakistan
                    </span>
                  </li>
                  <li>
                    <a
                      href="tel:+923008482321"
                      className="flex items-center gap-2.5 hover:text-white transition-colors"
                    >
                      <Phone className="w-4 h-4 shrink-0 text-blue-400" />
                      <span>+92 300 8482 321</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="mailto:info@psswwe.com"
                      className="flex items-center gap-2.5 hover:text-white transition-colors"
                    >
                      <Mail className="w-4 h-4 shrink-0 text-blue-400" />
                      <span>info@psswwe.com</span>
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
              <p>
                © {new Date().getFullYear()} Proxima Smart Solutions (PSS). All rights reserved.
              </p>
              <div className="flex items-center gap-5">
                <Link href="/privacy" className="hover:text-slate-300 transition-colors">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="hover:text-slate-300 transition-colors">
                  Terms of Service
                </Link>
              </div>
            </div>
          </div>
        </footer>
      )}

      {showPublicChrome && (
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
