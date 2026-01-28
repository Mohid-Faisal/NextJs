"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
  FaGlobe,
  FaChevronDown,
  FaYoutube,
  FaInstagram,
  FaTwitter,
  FaFacebookF,
  FaArrowRight,
  FaExternalLinkAlt,
  FaBars,
  FaTimes,
} from "react-icons/fa";

const PublicNavbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { href: "/#home", label: "Home" },
    { href: "/#about", label: "About us" },
    { href: "/#services", label: "Services" },
    { href: "/#contact", label: "Contact" },
    { href: "/auth/login", label: "Sign in" },
  ];

  const handleSectionClick = (e: React.MouseEvent, href: string) => {
    if (pathname !== "/") return;
    if (href.startsWith("/#")) {
      e.preventDefault();
      const id = href.slice(2);
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setIsMenuOpen(false);
    }
  };

  const isActive = (href: string) => {
    if (href === "/" || href === "/#home") return pathname === "/";
    if (href.startsWith("/#")) return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Top Bar - match reference: phone | email | address left, language | social right, 5% margin, larger font */}
      <div className="bg-[#0f172a] py-2.5">
        <div className="w-full mx-auto px-[5%]">
          <div className="flex flex-wrap items-center justify-between gap-y-2 text-sm text-white">
            {/* Left: Phone | Email | Address, each separated by vertical divider */}
            <div className="flex flex-wrap items-center gap-0 min-w-0">
              <a href="tel:+924235716494" className="flex items-center gap-2 hover:text-white/90 transition-colors shrink-0 pr-12 sm:pr-12 border-r border-white/30">
                <FaPhone className="w-4 h-4 shrink-0 text-white" />
                <span>+92 42 35716494</span>
              </a>
              <a href="mailto:info@psswwe.com" className="flex items-center gap-2 hover:text-white/90 transition-colors min-w-0 px-12 sm:px-12">
                <FaEnvelope className="w-4 h-4 shrink-0 text-white" />
                <span className="truncate max-w-[180px] sm:max-w-none">info@psswwe.com</span>
              </a>
              <span className="hidden sm:flex items-center gap-2 min-w-0 pl-30 sm:pl-30">
                <FaMapMarkerAlt className="w-4 h-4 shrink-0 text-white" />
                <span className="truncate max-w-[200px] lg:max-w-none">LGF-44 Land Mark Plaza, Jail Road, Lahore, 54660, Pakistan</span>
              </span>
            </div>
            {/* Right: Language | Social icons with vertical dividers */}
            <div className="flex items-center gap-0 shrink-0 border-l border-white/30 pl-12 sm:pl-12">
              <div className="flex items-center gap-2 cursor-pointer hover:text-white/90 pr-12 sm:pr-12 border-r border-white/30">
                <FaGlobe className="w-4 h-4 text-white" />
                <span>EN</span>
                <FaChevronDown className="w-4 h-4 text-white" />
              </div>
              <div className="flex items-center gap-4 pl-16 sm:pl-16">
                <a href="#" className="hover:text-white/90 transition-colors text-white" aria-label="YouTube">
                  <FaYoutube className="w-4 h-4" />
                </a>
                <a href="#" className="hover:text-white/90 transition-colors text-white" aria-label="Instagram">
                  <FaInstagram className="w-4 h-4" />
                </a>
                <a href="#" className="hover:text-white/90 transition-colors text-white" aria-label="Twitter">
                  <FaTwitter className="w-4 h-4" />
                </a>
                <a href="#" className="hover:text-white/90 transition-colors text-white" aria-label="Facebook">
                  <FaFacebookF className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar - white, 5% side margin, larger font */}
      <div className="bg-white border-b border-gray-100">
        <div className="w-full px-[5%]">
          <div className="flex h-20 items-center justify-between gap-6">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 shrink-0">
              <img
                src="/logo_final.png"
                alt="PSS"
                className="h-16 w-auto object-contain"
              />
            </Link>

            {/* Center - Nav links, sentence case, dark grey, increased font */}
            <nav className="hidden lg:flex items-center justify-center flex-1 gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href + link.label}
                  href={link.href}
                  onClick={(e) => handleSectionClick(e, link.href)}
                  className={`px-1 py-2 text-lg font-medium text-slate-700 hover:text-slate-900 transition-colors ${
                    isActive(link.href) ? "text-slate-900" : ""
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right - Track order link + Rate calculator button */}
            <div className="hidden lg:flex items-center gap-6 shrink-0">
              {pathname === "/" ? (
                <Link
                  href="/#track-package"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("track-package")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="inline-flex items-center gap-1.5 text-md font-medium text-black hover:text-black transition-colors"
                >
                  <FaArrowRight className="w-5 h-5 fill-current" />
                  <span>Tracking</span>
                </Link>
              ) : (
                <Link
                  href="/tracking"
                  className="inline-flex items-center gap-1.5 text-md font-medium text-black hover:text-black transition-colors"
                >
                  <FaArrowRight className="w-5 h-5 fill-current" />
                  <span>Tracking</span>
                </Link>
              )}
              <Link
                href="/rate-calculator"
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-md font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <span>Rate calculator</span>
                <FaExternalLinkAlt className="w-5 h-5 fill-current" />
              </Link>
            </div>

            <button
              className="lg:hidden p-2 rounded-md text-black hover:bg-black/10"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <FaTimes className="h-5 w-5 fill-current" /> : <FaBars className="h-5 w-5 fill-current" />}
            </button>
          </div>

          {/* Mobile menu */}
          {isMenuOpen && (
            <div className="lg:hidden border-t border-black/10 py-4 space-y-1 bg-white">
              {navLinks.map((link) => (
                <Link
                  key={link.href + link.label}
                  href={link.href}
                  onClick={(e) => {
                    handleSectionClick(e, link.href);
                    setIsMenuOpen(false);
                  }}
                  className={`block px-4 py-3 text-lg font-medium ${
                    isActive(link.href) ? "text-slate-900" : "text-slate-700"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {pathname === "/" ? (
                <Link
                  href="/#track-package"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("track-package")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    setIsMenuOpen(false);
                  }}
                  className="block px-4 py-3 text-lg font-medium text-black"
                >
                  Track order
                </Link>
              ) : (
                <Link
                  href="/tracking"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-4 py-3 text-lg font-medium text-black"
                >
                  Track order
                </Link>
              )}
              <div className="pt-2 px-4">
                <Link
                  href="/rate-calculator"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full py-3 text-center text-lg font-medium rounded-full bg-blue-600 text-white"
                >
                  Rate calculator
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
