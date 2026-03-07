"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FaChevronDown,
  FaExternalLinkAlt,
  FaBars,
  FaTimes,
  FaCalculator,
  FaSearch,
  FaBox,
  FaMapMarkerAlt,
} from "react-icons/fa";

const toolLinks = [
  { href: "/rate-calculator", label: "Rate Calculator", icon: FaCalculator },
  { href: "/tracking", label: "Shipment Tracking", icon: FaSearch },
  { href: "/tools/volumetric-calculator", label: "Volumetric Calculator", icon: FaBox },
  { href: "/tools/remote-area-lookup", label: "Remote Area Lookup", icon: FaMapMarkerAlt },
];

const PublicNavbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const navLinks = [
    { href: "/#home", label: "Home" },
    { href: "/#about", label: "About us" },
    { href: "/#services", label: "Services" },
    { href: "/#contact", label: "Contact" },
    { href: "/auth/login", label: "Sign in" },
  ];

  const NAVBAR_OFFSET = 80;

  // Close tools dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setIsToolsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSectionClick = (e: React.MouseEvent, href: string) => {
    if (pathname !== "/") return;
    if (href.startsWith("/#")) {
      e.preventDefault();
      const id = href.slice(2);
      const el = document.getElementById(id);
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - NAVBAR_OFFSET;
        window.scrollTo({ top, behavior: "smooth" });
      }
      setIsMenuOpen(false);
    }
  };

  const isActive = (href: string) => {
    if (href === "/" || href === "/#home") return pathname === "/";
    if (href.startsWith("/#")) return pathname === "/";
    return pathname.startsWith(href);
  };

  const isToolActive = toolLinks.some((t) => pathname.startsWith(t.href));

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="bg-white/50 border-b border-gray-200/50 backdrop-blur-sm">
        <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 sm:h-16 items-center justify-between gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <img
                src="/logo_final.png"
                alt="PSS"
                className="h-9 sm:h-10 w-auto object-contain"
              />
            </Link>

            {/* Center - Nav links */}
            <nav className="hidden lg:flex items-center justify-center flex-1 gap-4 xl:gap-6 min-w-0">
              {navLinks.map((link) => (
                <Link
                  key={link.href + link.label}
                  href={link.href}
                  onClick={(e) => handleSectionClick(e, link.href)}
                  className={`shrink-0 px-1 py-2 text-sm xl:text-base font-medium text-slate-700 hover:text-slate-900 transition-colors ${
                    isActive(link.href) ? "text-slate-900" : ""
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right - Tools dropdown */}
            <div className="hidden lg:flex items-center gap-4 xl:gap-6 shrink-0" ref={toolsRef}>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsToolsOpen((o) => !o)}
                  className={`inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 xl:px-5 xl:py-2.5 text-sm xl:text-base font-medium text-white hover:bg-blue-700 transition-colors shrink-0 ${
                    isToolActive ? "ring-2 ring-blue-300" : ""
                  }`}
                >
                  <span>Tools</span>
                  <FaChevronDown className={`w-3 h-3 transition-transform ${isToolsOpen ? "rotate-180" : ""}`} />
                </button>

                {isToolsOpen && (
                  <div className="absolute right-0 mt-2 w-60 rounded-xl bg-white shadow-lg ring-1 ring-black/5 py-2 z-50">
                    {toolLinks.map((tool) => {
                      const Icon = tool.icon;
                      return (
                        <Link
                          key={tool.href}
                          href={tool.href}
                          onClick={() => setIsToolsOpen(false)}
                          className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-slate-50 ${
                            pathname.startsWith(tool.href)
                              ? "text-blue-600 bg-blue-50/50"
                              : "text-slate-700"
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{tool.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
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

              {/* Tools section in mobile */}
              <div className="pt-3 border-t border-slate-100 mt-2">
                <p className="px-4 pb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Tools</p>
                {toolLinks.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <Link
                      key={tool.href}
                      href={tool.href}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 text-base font-medium ${
                        pathname.startsWith(tool.href) ? "text-blue-600" : "text-slate-700"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{tool.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default PublicNavbar;
