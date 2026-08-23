"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  Sparkles,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Percent,
  Clock,
  DollarSign
} from "lucide-react";

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);
  const [parcelVolume, setParcelVolume] = useState(5000);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // ROI Calculator Math
  const estimatedHoursSaved = Math.round((parcelVolume / 1000) * 18);
  const estimatedDollarSavings = Math.round(parcelVolume * 0.42);
  const estimatedErrorReduction = 98.4;

  const faqs = [
    {
      q: "Can we migrate our existing customer databases and rate sheets?",
      a: "Yes. PSS includes one-click CSV and Excel import wizards for customers, vendors, recipient addresses, and postal zone rate matrices. Our onboarding team also provides free concierge data migration for Pro and Enterprise plans."
    },
    {
      q: "How does the manual payment verification system work?",
      a: "For regions where couriers prefer bank transfers or cheque payments, clients can upload transfer slips and proof of payment. Organization admins review and verify the proof with one click, which instantly activates the subscription and logs the journal entry."
    },
    {
      q: "Are the general ledger accounts pre-configured or customizable?",
      a: "PSS comes standard with a logistics-optimized Chart of Accounts (COA) out of the box (Accounts Receivable, Fuel Surcharge Liability, Linehaul Freight Revenue, etc.). You can customize codes, add sub-accounts, and modify VAT/Tax rules freely."
    },
    {
      q: "What is your uptime SLA guarantee?",
      a: "We provide an enterprise 99.99% uptime SLA on our Growth and Enterprise plans with real-time status telemetry, automated multi-region database failover, and continuous daily backups."
    },
    {
      q: "Can we manage multiple branches and remote agencies under one account?",
      a: "Yes. Our multi-tenant and multi-branch architecture enables you to configure individual branch desks, specify localized rate markups, and restrict staff permissions per physical agency."
    }
  ];

  return (
    <div className="relative w-full overflow-x-clip bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 pt-28 pb-20">
      {/* Header Section */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center space-y-4 mb-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs font-bold uppercase tracking-widest border border-cyan-500/20">
          <Sparkles className="h-3.5 w-3.5" />
          Predictable Enterprise Pricing
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Scale Operations with <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">Zero Hidden Surcharges</span>
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg max-w-2xl mx-auto">
          Choose a plan tailored to your dispatch volume. Every tier includes our core logistics engine and double-entry accounting suite.
        </p>

        {/* Monthly / Annual Toggle */}
        <div className="flex items-center justify-center gap-4 pt-6">
          <span className={`text-sm font-semibold ${!annual ? "text-slate-900 dark:text-white" : "text-slate-500"}`}>
            Monthly Billing
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            aria-label="Toggle Annual Billing"
            className="relative w-14 h-8 rounded-full bg-slate-200 dark:bg-slate-800 p-1 transition-colors focus:outline-none"
          >
            <div
              className={`w-6 h-6 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-transform ${
                annual ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
          <span className={`text-sm font-semibold flex items-center gap-1.5 ${annual ? "text-slate-900 dark:text-white" : "text-slate-500"}`}>
            Annual Billing
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Save 20%
            </span>
          </span>
        </div>
      </section>

      {/* Pricing Cards Grid */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {/* Plan 1: Starter */}
          <div className="p-8 rounded-3xl bg-white dark:bg-[#0F1422] border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col justify-between space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Starter</h3>
                <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Regional Fleets
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Essential logistics tracking, customer directories, and basic airway bill generation.
              </p>
              <div className="flex items-baseline gap-1 pt-2">
                <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
                  ${annual ? "39" : "49"}
                </span>
                <span className="text-xs text-slate-500 font-medium">/ month</span>
              </div>
              <ul className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-cyan-500 shrink-0" />
                  <span>Up to 1,500 AWBs / month</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-cyan-500 shrink-0" />
                  <span>3 Staff Team Seats</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-cyan-500 shrink-0" />
                  <span>Standard AWB Barcode Printing</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-cyan-500 shrink-0" />
                  <span>Basic Invoice Generation</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-cyan-500 shrink-0" />
                  <span>Email Support</span>
                </li>
              </ul>
            </div>
            <Link
              href="/contact"
              className="w-full py-3 rounded-xl text-center text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Get Started with Starter
            </Link>
          </div>

          {/* Plan 2: Growth / Pro (Featured) */}
          <div className="p-8 rounded-3xl bg-gradient-to-b from-cyan-950/20 via-slate-900/90 to-[#0F1422] dark:from-[#082032] dark:via-[#0F1626] dark:to-[#0B0F17] border-2 border-cyan-500 shadow-2xl shadow-cyan-500/10 flex flex-col justify-between space-y-8 relative">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold tracking-wider uppercase shadow-md">
              Most Popular Choice
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">Growth / Pro</h3>
                <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Scaling Couriers
                </span>
              </div>
              <p className="text-sm text-slate-300">
                Complete operations suite with automated rate matrices, FIFO payments, and multi-branch management.
              </p>
              <div className="flex items-baseline gap-1 pt-2">
                <span className="text-4xl font-extrabold text-white">
                  ${annual ? "119" : "149"}
                </span>
                <span className="text-xs text-slate-400 font-medium">/ month</span>
              </div>
              <ul className="space-y-3 pt-4 border-t border-slate-800 text-sm text-slate-200">
                <li className="flex items-center gap-2.5 font-medium">
                  <Check className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span>Up to 15,000 AWBs / month</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span>10 Staff Seats + Role-Based RBAC</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span>Full Chart of Accounts & General Ledger</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span>FIFO Payment Allocation Engine</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span>Inactive Customer Churn Detector</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span>Multi-Branch & Agency Management</span>
                </li>
              </ul>
            </div>
            <Link
              href="/contact"
              className="w-full py-3.5 rounded-xl text-center text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/25 transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Start 14-Day Free Pro Trial
            </Link>
          </div>

          {/* Plan 3: Enterprise */}
          <div className="p-8 rounded-3xl bg-white dark:bg-[#0F1422] border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col justify-between space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Enterprise</h3>
                <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Global 3PLs
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Unlimited throughput, dedicated database clusters, custom API rate limits, and 24/7 dedicated account manager.
              </p>
              <div className="flex items-baseline gap-1 pt-2">
                <span className="text-4xl font-extrabold text-slate-900 dark:text-white">Custom</span>
                <span className="text-xs text-slate-500 font-medium">/ SLA tailored</span>
              </div>
              <ul className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-blue-500 shrink-0" />
                  <span>Unlimited AWBs & Dispatches</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-blue-500 shrink-0" />
                  <span>Unlimited Tenant Workspaces</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-blue-500 shrink-0" />
                  <span>Custom ERP / SAP / QuickBooks Sync</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-blue-500 shrink-0" />
                  <span>Dedicated Multi-Region Database</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-blue-500 shrink-0" />
                  <span>99.99% Guaranteed SLA + Priority 24/7 Phone</span>
                </li>
              </ul>
            </div>
            <Link
              href="/contact"
              className="w-full py-3 rounded-xl text-center text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Contact Enterprise Sales
            </Link>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* INTERACTIVE ROI SAVINGS CALCULATOR                                       */}
      {/* ========================================================================= */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto mb-24">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 shadow-2xl space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-cyan-400 text-xs font-bold uppercase tracking-widest">
              Interactive ROI Estimator
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">
              Calculate Your Operational & Financial Payback
            </h2>
            <p className="text-slate-300 text-sm">
              See how much your logistics enterprise saves each month by replacing manual entry with automated AWB dispatch and double-entry accounting.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-slate-200">
                Monthly Parcel & Freight Volume:
              </label>
              <span className="text-2xl font-extrabold text-cyan-400">
                {parcelVolume.toLocaleString()} AWBs
              </span>
            </div>
            <input
              type="range"
              min="500"
              max="50000"
              step="500"
              value={parcelVolume}
              onChange={(e) => setParcelVolume(parseInt(e.target.value))}
              className="w-full h-2.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>500 AWBs</span>
              <span>25,000 AWBs</span>
              <span>50,000+ AWBs</span>
            </div>
          </div>

          {/* Metric Outputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 text-center space-y-1">
              <Clock className="h-6 w-6 text-cyan-400 mx-auto mb-2" />
              <p className="text-3xl font-extrabold text-white">{estimatedHoursSaved} hrs</p>
              <p className="text-xs text-slate-400">Admin Hours Saved / Month</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 text-center space-y-1">
              <DollarSign className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-3xl font-extrabold text-emerald-400">
                ${estimatedDollarSavings.toLocaleString()}
              </p>
              <p className="text-xs text-slate-400">Est. Monthly Cost Reduction</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 text-center space-y-1">
              <Percent className="h-6 w-6 text-blue-400 mx-auto mb-2" />
              <p className="text-3xl font-extrabold text-blue-400">{estimatedErrorReduction}%</p>
              <p className="text-xs text-slate-400">Billing Discrepancy Reduction</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* PAYMENT & FLEXIBILITY CALLOUT                                            */}
      {/* ========================================================================= */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-24">
        <div className="p-8 rounded-3xl bg-white dark:bg-[#0F1422] border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-600 dark:text-cyan-400 tracking-wider uppercase">
              <CreditCard className="h-4 w-4" />
              Flexible Enterprise Billing Methods
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              Automated Card Subscriptions or Verified Bank Transfers
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              We understand corporate procurement in logistics. Pay conveniently via credit card, or upload direct bank transfer deposit receipts with automatic admin review and invoice generation.
            </p>
          </div>
          <Link
            href="/contact"
            className="px-6 py-3 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-sm font-semibold whitespace-nowrap transition-colors"
          >
            Inquire About Custom Billing
          </Link>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* FREQUENTLY ASKED QUESTIONS ACCORDION                                      */}
      {/* ========================================================================= */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="text-center space-y-2 mb-12">
          <span className="text-cyan-600 dark:text-cyan-400 text-xs font-bold tracking-widest uppercase">
            Got Questions?
          </span>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1422] overflow-hidden transition-all shadow-sm"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 font-semibold text-slate-900 dark:text-white text-sm sm:text-base hover:text-cyan-600 dark:hover:text-cyan-400"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="h-5 w-5 text-cyan-500 shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/60 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
