"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Phone,
  Mail,
  Search,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  MessageCircle,
  Plus,
} from "lucide-react";

const PublicNavbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "HOME" },
    { href: "/about", label: "ABOUT US" },
    { href: "/services", label: "SERVICES" },
    { href: "/tracking", label: "TRACKING" },
    { href: "/services", label: "PRICING" },
    { href: "/contact", label: "CONTACT" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Top Bar - dark semi-transparent */}
      <div className="bg-black/80 text-white py-2">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 shrink-0" />
                <span>+92 42 35716494</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 shrink-0" />
                <span>info@psswwe.com</span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4">
              <a href="#" className="hover:text-white/90 transition-colors" aria-label="Facebook">
                <Facebook className="w-4 h-4" />
              </a>
              <a href="#" className="hover:text-white/90 transition-colors" aria-label="Twitter">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="hover:text-white/90 transition-colors" aria-label="Instagram">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="#" className="hover:text-white/90 transition-colors" aria-label="Google+">
                <Plus className="w-4 h-4" />
              </a>
              <a href="#" className="hover:text-white/90 transition-colors" aria-label="LinkedIn">
                <Linkedin className="w-4 h-4" />
              </a>
              <a href="#" className="hover:text-white/90 transition-colors" aria-label="WhatsApp">
                <MessageCircle className="w-4 h-4" />
              </a>
              <button type="button" className="hover:text-white/90 transition-colors" aria-label="Search">
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar - transparent over hero on home, solid on other pages */}
      <div className={`border-b ${pathname === "/" ? "bg-transparent border-white/20" : "bg-black/80 border-white/10"}`}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between gap-4">
            {/* Logo + PSS + tagline */}
            <Link href="/" className="flex items-center gap-3 shrink-0">
              <img
                src="/logo_final.png"
                alt="PSS"
                className="h-10 w-auto object-contain"
              />
            </Link>

            {/* Center - Nav links uppercase */}
            <nav className="hidden lg:flex items-center justify-center flex-1 gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href + link.label}
                  href={link.href}
                  className={`px-3 py-2 text-sm font-medium uppercase tracking-wide transition-colors ${
                    isActive(link.href) ? "text-white" : "text-white/80 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right - GET A QUOTE + Admin Login */}
            <div className="hidden lg:flex items-center gap-4 shrink-0">
              <Link
                href="/contact"
                className="inline-block px-5 py-2.5 text-sm font-medium uppercase tracking-wide text-white border border-white hover:bg-white hover:text-black transition-colors"
              >
                Get a quote
              </Link>
              <Link
                href="/auth/login"
                className="text-sm font-medium uppercase tracking-wide text-white/90 hover:text-white transition-colors"
              >
                Admin Login
              </Link>
            </div>

            <button
              className="lg:hidden p-2 rounded-md text-white hover:bg-white/10"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile menu */}
          {isMenuOpen && (
            <div className="lg:hidden border-t border-white/10 py-4 space-y-1 bg-black/90">
              {navLinks.map((link) => (
                <Link
                  key={link.href + link.label}
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`block px-4 py-3 text-sm font-medium uppercase ${
                    isActive(link.href) ? "text-white" : "text-white/80"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-4 px-4 space-y-2">
                <Link
                  href="/contact"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full py-3 text-center text-sm font-medium uppercase text-white border border-white"
                >
                  Get a quote
                </Link>
                <Link
                  href="/auth/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full py-3 text-center text-sm font-medium uppercase text-white/90 hover:text-white"
                >
                  Admin Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default PublicNavbar;
