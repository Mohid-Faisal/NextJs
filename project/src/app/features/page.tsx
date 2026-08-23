"use client";

import { useState } from "react";
import {
  Boxes,
  Receipt,
  Building2,
  Lock,
  Barcode,
  CheckCircle2,
  Check,
  ShieldCheck,
  Cpu
} from "lucide-react";

export default function FeaturesPage() {
  const [activeTab, setActiveTab] = useState<"ops" | "accounts" | "branches" | "security">("ops");

  return (
    <div className="relative w-full overflow-x-clip bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 pt-28 pb-24">
      {/* Header Section */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center space-y-4 mb-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs font-bold uppercase tracking-widest border border-cyan-500/20">
          <Cpu className="h-3.5 w-3.5" />
          Technical Architecture & Features
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Every Layer of Modern Logistics <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">Built In</span>
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg max-w-2xl mx-auto">
          Explore the deep technical engines powering dispatch automation, real-time double-entry general ledgers, and multi-tenant courier fleets.
        </p>

        {/* Tab Navigation Pill Bar */}
        <div className="flex items-center justify-center gap-2 pt-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab("ops")}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === "ops"
                ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25"
                : "bg-white dark:bg-[#0F1422] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Boxes className="h-4 w-4" />
            Operations & Dispatch
          </button>
          <button
            onClick={() => setActiveTab("accounts")}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === "accounts"
                ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25"
                : "bg-white dark:bg-[#0F1422] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Receipt className="h-4 w-4" />
            Enterprise Accounting
          </button>
          <button
            onClick={() => setActiveTab("branches")}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === "branches"
                ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25"
                : "bg-white dark:bg-[#0F1422] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Fleet & Agencies
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === "security"
                ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25"
                : "bg-white dark:bg-[#0F1422] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Lock className="h-4 w-4" />
            Security & RBAC
          </button>
        </div>
      </section>

      {/* Tab Deep-Dive Content Screen */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-24">
        {/* TAB 1: OPERATIONS & DISPATCH */}
        {activeTab === "ops" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-fadeIn">
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
                01 / Real-Time Dispatch Core
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
                High-Volume Airway Bill Generation & Batch Processing
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
                Empower your dispatch clerks to book individual consignments or bulk-upload thousands of shipments from CSV/Excel sheets. PSS instantly validates recipient addresses, calculates dimensional weight against volumetric divisors, and generates GS1-compliant 2D barcodes.
              </p>
              <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-cyan-500 shrink-0 mt-0.5" />
                  <span><strong>Automated Zone Surcharge Matrix:</strong> Real-time fuel surcharges, remote delivery area detection, and custom duty fees.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-cyan-500 shrink-0 mt-0.5" />
                  <span><strong>High-Speed PDF/Thermal Label Printing:</strong> Compatible with standard 4x6 Zebra thermal printers and A4 multi-copy invoices.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-cyan-500 shrink-0 mt-0.5" />
                  <span><strong>Public & Customer Tracking Portal:</strong> Real-time milestone updates with zero login required for end consignees.</span>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-6 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 bg-slate-950 p-3">
              <img
                src="/assets/phase1_warehouse.jpg"
                alt="Automated Warehouse Barcode System"
                className="w-full h-64 object-cover rounded-2xl"
              />
              <div className="p-4 text-white font-mono text-xs space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-cyan-400 font-bold flex items-center gap-2">
                    <Barcode className="h-4 w-4" /> BATCH DISPATCH ENGINE
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                    ACTIVE &bull; 1,240 AWBs/MIN
                  </span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>File: consignment_manifest_europe.xlsx</span>
                  <span className="text-cyan-400">420 Records Loaded &bull; 0.42ms/record</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ENTERPRISE ACCOUNTING */}
        {activeTab === "accounts" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-fadeIn">
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                02 / Logistics Financial Suite
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
                Automated Double-Entry Accounting & FIFO Payment Engine
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
                Eliminate disconnected spreadsheets and late billing reconciliations. Every shipment booked triggers compliant double-entry journal vouchers to your Chart of Accounts. Our automated FIFO engine matches customer payments against unpaid invoices in chronological order.
              </p>
              <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <span><strong>Comprehensive Chart of Accounts (COA):</strong> Pre-mapped for freight revenues, carrier linehaul costs, fuel surcharges, and customs duties.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <span><strong>Instant Financial Statements:</strong> Generate real-time Trial Balance, Profit & Loss (P&L), and Balance Sheet reports anytime.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <span><strong>Customer Debit/Credit Notes:</strong> Streamline claims, rate adjustments, and tax reconciliations with complete audit trails.</span>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-6 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 bg-slate-950 p-3">
              <img
                src="/assets/phase2_fintech.jpg"
                alt="Fintech General Ledger Command Center"
                className="w-full h-64 object-cover rounded-2xl"
              />
              <div className="p-4 text-white font-mono text-xs space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-blue-400 font-bold flex items-center gap-2">
                    <Receipt className="h-4 w-4" /> GENERAL LEDGER AUDIT MONITOR
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px]">
                    BALANCED &bull; DR = CR
                  </span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Customer: Global Trade Partners</span>
                  <span className="text-emerald-400">+$8,450.00 Received (FIFO Allocated)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FLEET & AGENCIES */}
        {activeTab === "branches" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-fadeIn">
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
                03 / Fleet & Agency Network
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
                Multi-Branch Hierarchies & Vendor Reconciliation
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
                Scale your logistics business across multiple cities, airports, and partner agency franchises. Maintain central financial oversight while granting local staff desks restricted access to their specific branch operations.
              </p>
              <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-cyan-500 shrink-0 mt-0.5" />
                  <span><strong>Branch-Specific Rate Multipliers:</strong> Configure localized markups and commission structures per franchise location.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-cyan-500 shrink-0 mt-0.5" />
                  <span><strong>Vendor & 3PL Cost Reconciliation:</strong> Track payables to major third-party carriers (DHL, FedEx, Aramex) alongside internal margins.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-cyan-500 shrink-0 mt-0.5" />
                  <span><strong>Daily Cash Book Oversight:</strong> Reconcile cash collections and COD payouts per courier counter before shift close.</span>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-6 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 bg-slate-950 p-3">
              <img
                src="/assets/phase0_cargo.jpg"
                alt="Global Fleet Hub Network"
                className="w-full h-64 object-cover rounded-2xl"
              />
              <div className="p-4 text-white font-mono text-xs space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-cyan-400 font-bold flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> NETWORK HUB OVERVIEW
                  </span>
                  <span className="text-slate-400 text-[10px]">12 Active Regional Branches</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Airport Gateway (LHE-01)</span>
                  <span className="text-emerald-400">1,840 Dispatches Today</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SECURITY & RBAC */}
        {activeTab === "security" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-fadeIn">
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                04 / Security & Multi-Tenancy
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
                Cryptographic Tenant Isolation & Immutable Audit Trails
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
                Protect sensitive corporate financial data and customer shipment records with database-level tenant scoping, hardware TOTP two-factor authentication, and tamper-evident event logging.
              </p>
              <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Zero Data Bleed:</strong> Every database query is scoped strictly by organization ID claims verified inside tamper-proof JWTs.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Role-Based Access Control (RBAC):</strong> Granular permissions for Super Admin, Owner, Dispatch Staff, and Chartered Accountants.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Immutable Audit Logs:</strong> Track every rate modification, manual invoice void, and payment verification with IP and user stamps.</span>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-6 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 bg-slate-950 p-3">
              <img
                src="/assets/phase2_fintech.jpg"
                alt="Security and Audit Log Operations"
                className="w-full h-64 object-cover rounded-2xl"
              />
              <div className="p-4 text-white font-mono text-xs space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-emerald-400 font-bold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" /> SECURITY EVENT STREAM
                  </span>
                  <span className="text-emerald-400 text-[10px]">2FA ENFORCED &bull; AES-256</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>[2026-08-23 16:42:01] Ledger Auth Verified</span>
                  <span className="text-emerald-400">PASSED</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Feature Specification Comparison Table */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-2 mb-12">
          <span className="text-cyan-600 dark:text-cyan-400 text-xs font-bold tracking-widest uppercase">
            Detailed Capabilities
          </span>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
            Feature Comparison Matrix
          </h2>
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1422] overflow-hidden shadow-xl">
          <div className="overflow-x-auto min-w-[650px]">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 text-xs uppercase font-bold text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="p-4 pl-6">Module & Feature Spec</th>
                  <th className="p-4 text-center">Starter</th>
                  <th className="p-4 text-center text-cyan-600 dark:text-cyan-400">Growth / Pro</th>
                  <th className="p-4 text-center text-blue-600 dark:text-blue-400">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <td className="p-4 pl-6 font-medium text-slate-900 dark:text-white">AWB Barcode Generation & Thermal Printing</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-cyan-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-cyan-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-cyan-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 pl-6 font-medium text-slate-900 dark:text-white">Bulk CSV/Excel Manifest Uploader</td>
                  <td className="p-4 text-center text-slate-400">Basic</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-cyan-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-cyan-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 pl-6 font-medium text-slate-900 dark:text-white">Automated Double-Entry General Ledger</td>
                  <td className="p-4 text-center text-slate-400">-</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-cyan-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-cyan-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 pl-6 font-medium text-slate-900 dark:text-white">FIFO Customer Payment Allocation</td>
                  <td className="p-4 text-center text-slate-400">-</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-cyan-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-cyan-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 pl-6 font-medium text-slate-900 dark:text-white">Inactive Customer Churn Detection</td>
                  <td className="p-4 text-center text-slate-400">-</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-cyan-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-cyan-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 pl-6 font-medium text-slate-900 dark:text-white">Multi-Branch Agency Desks & RBAC</td>
                  <td className="p-4 text-center text-slate-400">-</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-cyan-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-cyan-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 pl-6 font-medium text-slate-900 dark:text-white">Custom API Webhooks & ERP Sync</td>
                  <td className="p-4 text-center text-slate-400">-</td>
                  <td className="p-4 text-center text-slate-400">Add-on</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-cyan-500 mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
