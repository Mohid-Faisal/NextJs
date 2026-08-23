"use client";

import Link from "next/link";
import {
  ShieldCheck,
  Building2,
  Lock,
  Database,
  Award,
  Globe2,
  Cpu,
  Layers
} from "lucide-react";

export default function AboutPage() {
  return (
    <div className="relative w-full overflow-x-clip bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 pt-28 pb-24">
      {/* Header */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center space-y-4 mb-20">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs font-bold uppercase tracking-widest border border-cyan-500/20">
          <Building2 className="h-3.5 w-3.5" />
          Prompt Software Solutions (PSS)
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Pioneering Financial Precision for <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">Global Logistics</span>
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg max-w-2xl mx-auto">
          We built PSS with a single obsessive vision: replace fragile courier paperwork and disconnected spreadsheets with a unified, high-speed logistics and double-entry accounting operating system.
        </p>
      </section>

      {/* Story & Mission Grid */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6 space-y-6">
          <span className="text-xs font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
            Our Origin & Philosophy
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
            Logistics moves fast. Your accounting should move faster.
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
            For decades, freight forwarders and courier operators have struggled with a disconnect: physical packages move in hours, but invoicing, surcharge calculations, and vendor reconciliations take weeks at month-end.
          </p>
          <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
            Prompt Software Solutions engineered PSS from the ground up to eliminate this latency. By integrating an enterprise Chart of Accounts (COA) directly into the core AWB booking engine, every parcel dispatched automatically maintains perfectly balanced general ledger debits and credits in real time.
          </p>
          <div className="pt-4 grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0F1422] border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-2xl font-extrabold text-cyan-500">100%</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Real-Time Ledger Balancing</p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0F1422] border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-2xl font-extrabold text-blue-500">0s</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Month-End Audit Latency</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 p-8 rounded-3xl bg-slate-950 text-white border border-slate-800 shadow-2xl space-y-6">
          <h3 className="text-xl font-bold text-cyan-400 flex items-center gap-2">
            <Cpu className="h-5 w-5" /> Core Architecture Principles
          </h3>
          <div className="space-y-4 text-sm">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <h4 className="font-bold text-white flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-400" />
                Zero-Leak Multi-Tenant DB Isolation
              </h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Every courier organisation’s data is isolated with strict cryptographic tenant claims on every row and JWT token.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <h4 className="font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-cyan-400" />
                Double-Entry Financial Integrity
              </h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Immutable journal vouchers ensure zero unallocated invoices, automatic FIFO matching, and transparent audit trails.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <h4 className="font-bold text-white flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-blue-400" />
                Global Cloud Edge Telemetry
              </h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Sub-second AWB generation and thermal print dispatch across multi-branch and international airport hubs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Compliance Badges */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-24">
        <div className="p-10 rounded-3xl bg-white dark:bg-[#0F1422] border border-slate-200 dark:border-slate-800 shadow-xl space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-cyan-600 dark:text-cyan-400 text-xs font-bold uppercase tracking-widest">
              Trust & Compliance
            </span>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
              Enterprise Grade Security Standards
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2 text-center">
              <ShieldCheck className="h-8 w-8 text-cyan-500 mx-auto" />
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">SOC-2 Type II Compliant</h4>
              <p className="text-xs text-slate-500">Audited cloud security and organizational access controls.</p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2 text-center">
              <Lock className="h-8 w-8 text-blue-500 mx-auto" />
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">AES-256 Data Encryption</h4>
              <p className="text-xs text-slate-500">All data in transit and at rest encrypted with bank-grade standards.</p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2 text-center">
              <Layers className="h-8 w-8 text-emerald-500 mx-auto" />
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Multi-Tenant Scoping</h4>
              <p className="text-xs text-slate-500">Zero data contamination between courier workspaces.</p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2 text-center">
              <Award className="h-8 w-8 text-amber-500 mx-auto" />
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">99.99% Uptime SLA</h4>
              <p className="text-xs text-slate-500">Continuous multi-region failover and real-time health telemetry.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="p-12 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-950 to-blue-950 text-white border border-slate-800 shadow-2xl space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Ready to experience PSS in your courier business?
          </h2>
          <p className="text-slate-300 max-w-xl mx-auto text-sm sm:text-base">
            Get started in 5 minutes with our concierge onboarding and free trial sandbox.
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/contact"
              className="px-8 py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/25"
            >
              Start Free Trial
            </Link>
            <Link
              href="/features"
              className="px-8 py-3.5 rounded-xl font-bold text-sm text-slate-200 bg-slate-800 border border-slate-700"
            >
              Explore Solutions
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
