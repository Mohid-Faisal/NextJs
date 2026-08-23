"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import PublicNavbar from "./PublicNavbar";
import {
  ShieldCheck,
  Lock,
  Database,
  Sparkles,
  Mail,
  Send
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [email, setEmail] = useState("");

  // Only show public marketing header/footer on public marketing pages
  const isDashboard = pathname.startsWith("/dashboard");
  const isAuth = pathname.startsWith("/auth") || pathname === "/login" || pathname === "/signup";
  const showPublicShell = !isDashboard && !isAuth;

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid business email address.");
      return;
    }
    toast.success("Thank you for subscribing to PSS Enterprise updates!");
    setEmail("");
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {showPublicShell && <PublicNavbar />}
      <main className="flex-1 w-full">{children}</main>

      {showPublicShell && (
        <footer className="relative border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#080B11] pt-16 pb-12 overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-gradient-to-b from-cyan-500/5 to-transparent blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            {/* Top Footer Banner / Newsletter */}
            <div className="mb-14 p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-blue-950 text-white border border-slate-800 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-8">
              <div className="space-y-2 max-w-xl text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-semibold tracking-wide border border-cyan-500/30">
                  <Sparkles className="h-3.5 w-3.5" />
                  Enterprise Release v3.4
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Ready to upgrade your courier operations?
                </h3>
                <p className="text-slate-300 text-sm sm:text-base">
                  Join hundreds of logistics enterprises running real-time AWBs and automated double-entry accounting on PSS.
                </p>
              </div>

              <form onSubmit={handleSubscribe} className="w-full lg:w-auto flex flex-col sm:flex-row gap-3">
                <div className="relative min-w-[280px]">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your work email"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 font-semibold text-sm text-white shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95 shrink-0"
                >
                  Request Access
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>

            {/* Footer Navigation Columns */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12 pb-12 border-b border-slate-200 dark:border-slate-800">
              {/* Brand Column */}
              <div className="col-span-2 space-y-4">
                <Link href="/" className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white font-extrabold text-lg">
                    P
                  </div>
                  <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">
                    PSS Worldwide
                  </span>
                </Link>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed max-w-sm">
                  The complete Multi-Tenant Logistics ERP & Accounting Operating System for couriers, freight forwarders, and 3PL networks.
                </p>

                {/* Trust Badges */}
                <div className="pt-2 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
                    <ShieldCheck className="h-3.5 w-3.5 text-cyan-500" />
                    <span>SOC-2 Type II</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
                    <Lock className="h-3.5 w-3.5 text-blue-500" />
                    <span>256-Bit SSL</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
                    <Database className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Tenant Isolated</span>
                  </div>
                </div>
              </div>

              {/* Product Column */}
              <div className="space-y-3">
                <p className="font-semibold text-sm text-slate-900 dark:text-white tracking-wider uppercase">
                  Platform
                </p>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <li>
                    <Link href="/features" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                      Live AWB Routing
                    </Link>
                  </li>
                  <li>
                    <Link href="/features" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                      Double-Entry General Ledger
                    </Link>
                  </li>
                  <li>
                    <Link href="/features" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                      FIFO Payment Allocation
                    </Link>
                  </li>
                  <li>
                    <Link href="/features" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                      Bulk Shipment Booking
                    </Link>
                  </li>
                  <li>
                    <Link href="/tracking" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                      Public Shipment Tracking
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Solutions Column */}
              <div className="space-y-3">
                <p className="font-semibold text-sm text-slate-900 dark:text-white tracking-wider uppercase">
                  Solutions
                </p>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <li>
                    <Link href="/features" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                      Regional Couriers
                    </Link>
                  </li>
                  <li>
                    <Link href="/features" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                      Global 3PL & Freight
                    </Link>
                  </li>
                  <li>
                    <Link href="/features" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                      Multi-Branch Networks
                    </Link>
                  </li>
                  <li>
                    <Link href="/pricing" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                      Enterprise SLA
                    </Link>
                  </li>
                  <li>
                    <Link href="/contact" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                      Custom Integrations
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Company & Resources Column */}
              <div className="space-y-3">
                <p className="font-semibold text-sm text-slate-900 dark:text-white tracking-wider uppercase">
                  Company
                </p>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <li>
                    <Link href="/about" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                      About Prompt Solutions
                    </Link>
                  </li>
                  <li>
                    <Link href="/pricing" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                      Pricing Plans
                    </Link>
                  </li>
                  <li>
                    <Link href="/contact" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                      Schedule Live Demo
                    </Link>
                  </li>
                  <li>
                    <Link href="/contact" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                      Support & Helpdesk
                    </Link>
                  </li>
                  <li>
                    <Link href="/about" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                      Security & Compliance
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>All systems operational &bull; 99.99% Uptime</span>
              </div>
              <p>
                &copy; {new Date().getFullYear()} Prompt Software Solutions (PSS Worldwide). All rights reserved.
              </p>
              <div className="flex items-center gap-4">
                <Link href="/about" className="hover:underline">Privacy Policy</Link>
                <Link href="/about" className="hover:underline">Terms of Service</Link>
                <Link href="/contact" className="hover:underline">Contact Security</Link>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
