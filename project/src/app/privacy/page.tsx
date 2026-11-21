import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  SITE_CONFIG,
  buildPageMetadata,
  getBreadcrumbSchema,
} from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy Policy",
  description: `Privacy Policy for ${SITE_CONFIG.fullBrand}. Learn how we collect, isolate, protect, and process courier workspace and shipment tracking data.`,
  path: "/privacy",
});

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 py-14 px-4 sm:px-6 lg:px-8">
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Privacy Policy", path: "/privacy" },
        ])}
      />

      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 sm:p-10 shadow-sm space-y-6">
        <nav aria-label="Breadcrumb" className="text-xs text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span>Privacy Policy</span>
        </nav>

        <header className="space-y-2 border-b border-slate-100 dark:border-zinc-800 pb-6">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Privacy Policy
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Effective Date: November 2026 · {SITE_CONFIG.fullBrand}
          </p>
        </header>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            1. Information We Collect
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            When you create a courier workspace, track a consignment, or submit
            a contact inquiry on {SITE_CONFIG.fullBrand}, we collect account
            registration details (company name, user name, email address, phone
            number), shipment metadata, billing records, and technical security
            logs required to operate the platform.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            2. Multi-Tenant Data Isolation &amp; Security
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Each organization workspace is logically isolated by organization ID
            across shipments, customers, invoices, and accounting ledgers.
            Authentication relies on encrypted httpOnly cookies and server-side
            revocable session tokens.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            3. How We Use Your Data
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            We process operational data solely to deliver shipment tracking,
            rate calculation, invoicing, financial reporting, customer support,
            and security monitoring. We do not sell tenant or recipient data to
            third parties.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            4. Contact &amp; Data Requests
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            For data access, correction, or deletion requests, email{" "}
            <a
              href={`mailto:${SITE_CONFIG.email}`}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              {SITE_CONFIG.email}
            </a>{" "}
            or call {SITE_CONFIG.phone}.
          </p>
        </section>

        <footer className="pt-6 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap gap-4 text-sm font-medium">
          <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
            Back to Home
          </Link>
          <Link href="/tracking" className="text-blue-600 dark:text-blue-400 hover:underline">
            Track Shipment
          </Link>
          <Link href="/auth/signup" className="text-blue-600 dark:text-blue-400 hover:underline">
            Start Free Trial
          </Link>
        </footer>
      </article>
    </div>
  );
}
