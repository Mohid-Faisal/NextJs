"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Search,
  Globe,
  Phone,
  Mail,
  ChevronDown,
  Play,
  FileText,
  Facebook,
  Twitter,
  Youtube,
  Instagram,
  Linkedin,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const PublicNavbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About Us" },
    { href: "/services", label: "Services" },
    { href: "/tracking", label: "Tracking" },
    { href: "/contact", label: "Contact" },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Top Bar */}
      <div className="bg-[#1a365d] text-white py-2">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between text-sm">
            {/* Left - Contact Info */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span>+92 300 8482 321 (Any time 24/7)</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span>info@psswwe.com</span>
              </div>
            </div>

            {/* Right - Social Media & User Menu */}
            <div className="hidden md:flex items-center gap-4">
              <div className="flex items-center gap-3">
                <a href="#" className="hover:text-yellow-400 transition-colors">
                  <Facebook className="w-4 h-4" />
                </a>
                <a href="#" className="hover:text-yellow-400 transition-colors">
                  <Twitter className="w-4 h-4" />
                </a>
                <a href="#" className="hover:text-yellow-400 transition-colors">
                  <Youtube className="w-4 h-4" />
                </a>
                <a href="#" className="hover:text-yellow-400 transition-colors">
                  <Instagram className="w-4 h-4" />
                </a>
                <a href="#" className="hover:text-yellow-400 transition-colors">
                  <Linkedin className="w-4 h-4" />
                </a>
              </div>
              <div className="flex items-center gap-2 cursor-pointer hover:text-yellow-400 transition-colors">
                <span>Admin</span>
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-blue-600 rounded flex items-center justify-center">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <span className="text-2xl font-bold text-[#1a365d]">PSS</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? "text-[#1a365d] font-semibold"
                      : "text-gray-700 hover:text-[#1a365d]"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right Side - Icons & CTA */}
            <div className="hidden lg:flex items-center gap-4">
              <button className="p-2 text-gray-700 hover:text-[#1a365d] transition-colors">
                <Search className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-1 text-gray-700 cursor-pointer hover:text-[#1a365d] transition-colors">
                <Globe className="w-5 h-5" />
                <span className="text-sm">English</span>
                <ChevronDown className="w-4 h-4" />
              </div>
              <Link href="/contact">
                <Button className="bg-[#fbbf24] hover:bg-[#f59e0b] text-white border-0 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Get a quote
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="outline" className="ml-2">
                  Admin Login
                </Button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="lg:hidden border-t py-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`block px-4 py-2 text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? "text-[#1a365d] font-semibold"
                      : "text-gray-700 hover:text-[#1a365d]"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-4 space-y-2">
                <Link href="/contact" onClick={() => setIsMenuOpen(false)}>
                  <Button className="w-full bg-[#fbbf24] hover:bg-[#f59e0b] text-white">
                    Get a quote
                  </Button>
                </Link>
                <Link href="/auth/login" onClick={() => setIsMenuOpen(false)}>
                  <Button variant="outline" className="w-full">
                    Admin Login
                  </Button>
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
