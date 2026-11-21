import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  SITE_CONFIG,
  buildPageMetadata,
  getBreadcrumbSchema,
} from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Terms of Service",
  description: `Terms of Service governing subscriptions, workspace usage, shipment tracking, and acceptable use of ${SITE_CONFIG.fullBrand}.`,
  path: "/terms",
});

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 py-14 px-4 sm:px-6 lg:px-8">
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Terms of Service", path: "/terms" },
        ])}
      />

      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 sm:p-10 shadow-sm space-y-6">
        <nav aria-label="Breadcrumb" className="text-xs text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span>Terms of Service</span>
        </nav>

        <header className="space-y-2 border-b border-slate-100 dark:border-zinc-800 pb-6">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Terms of Service
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Effective Date: November 2026 · {SITE_CONFIG.fullBrand}
          </p>
        </header>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            1. Platform Access &amp; Workspaces
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {SITE_CONFIG.fullBrand} grants subscribing organizations a
            non-exclusive, revocable license to access the cloud courier,
            cargo, tracking, and accounting software according to the user and
            monthly shipment limits of their selected plan.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            2. Trials, Billing &amp; Plan Limits
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            New organizations may begin on a 14-day trial before selecting a
            monthly or annual subscription tier. Organizations remain
            responsible for safeguarding credentials and maintaining accurate
            tax, customs, and billing records entered into their workspace.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            3. Acceptable Use
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            You agree not to attempt unauthorized access to other tenant
            workspaces, probe internal APIs, or use the platform to transmit
            unlawful or fraudulent shipment records.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            4. Contact
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Questions about these terms may be directed to{" "}
            <a
              href={`mailto:${SITE_CONFIG.email}`}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              {SITE_CONFIG.email}
            </a>{" "}
            at {SITE_CONFIG.address.streetAddress},{" "}
            {SITE_CONFIG.address.addressLocality}, Pakistan.
          </p>
        </section>

        <footer className="pt-6 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap gap-4 text-sm font-medium">
          <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
            Back to Home
          </Link>
          <Link href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
            Privacy Policy
          </Link>
          <Link href="/auth/signup" className="text-blue-600 dark:text-blue-400 hover:underline">
            Start Free Trial
          </Link>
        </footer>
      </article>
    </div>
  );
}
