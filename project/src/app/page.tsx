import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  Building2,
  PackageSearch,
  Calculator,
  BookOpenCheck,
  ShieldCheck,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  LANDING_FAQS,
  SITE_CONFIG,
  buildPageMetadata,
  getFaqSchema,
  getSoftwareApplicationSchema,
} from "@/lib/seo";
import {
  FaqAccordion,
  LandingContactForm,
  PricingSectionClient,
  QuickTrackForm,
  type PublicPlan,
} from "@/components/landing/LandingInteractive";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: `${SITE_CONFIG.fullBrand} — All-In-One Courier & Cargo Management SaaS`,
  description: SITE_CONFIG.description,
  path: "/",
  keywords: [...SITE_CONFIG.keywords],
});

const FALLBACK_PLANS: PublicPlan[] = [
  {
    id: 1,
    code: "starter",
    name: "Starter",
    priceMonthly: 7500,
    currency: "PKR",
    maxUsers: 1,
    maxShipmentsPerMonth: 100,
    description: "Built for solo couriers and emerging dispatch desks.",
    featuresList: [
      "100 shipments/month",
      "1 user limit",
      "1 branch limit",
      "Real-time shipment tracking",
      "Automated waybill & invoice PDFs",
    ],
    yearlyDiscountPercent: 20,
  },
  {
    id: 2,
    code: "growth",
    name: "Growth",
    priceMonthly: 18000,
    currency: "PKR",
    maxUsers: 5,
    maxShipmentsPerMonth: 300,
    description: "Ideal for multi-branch courier teams scaling daily volume.",
    featuresList: [
      "300 shipments/month",
      "5 users limit",
      "3 branches limit",
      "Remote Area Lookup included",
      "Role-based permissions & team portal",
    ],
    yearlyDiscountPercent: 20,
  },
  {
    id: 3,
    code: "pro",
    name: "Pro",
    priceMonthly: 35000,
    currency: "PKR",
    maxUsers: 10,
    maxShipmentsPerMonth: 500,
    description: "Full ERP + double-entry accounting for high-volume cargo hubs.",
    featuresList: [
      "500 shipments/month",
      "10 users limit",
      "5 branches limit",
      "Double-entry general ledger & AR/AP",
      "Remote Area Lookup & full reports",
    ],
    yearlyDiscountPercent: 20,
  },
];

const CARRIER_LOGOS = [
  { name: "DHL", src: "/logo/DHL.png" },
  { name: "FedEx", src: "/logo/FedEx.png" },
  { name: "UPS", src: "/logo/UPS.png" },
  { name: "DPD", src: "/logo/DPD.png" },
  { name: "Parcelforce Worldwide", src: "/logo/Parcelforce.png" },
  { name: "Skynet Worldwide Express", src: "/logo/Skynet.png" },
];

const FEATURES = [
  {
    icon: Building2,
    title: "Multi-Branch Tenant Workspaces",
    description:
      "Operate isolated courier workspaces with custom branding, invoice prefixes, multi-currency billing, and centralized branch oversight.",
  },
  {
    icon: PackageSearch,
    title: "Real-Time Public Shipment Tracking",
    description:
      "Give shippers and recipients instant milestone visibility via branded tracking pages with booking ID lookup and live status timelines.",
  },
  {
    icon: Calculator,
    title: "Automated Rate, Zone & Remote Engine",
    description:
      "Calculate accurate air, freight, and express quotes using carrier rate lists, country zones, volumetric divisors, and remote-area checks.",
  },
  {
    icon: BookOpenCheck,
    title: "Double-Entry Accounting & Invoicing",
    description:
      "Generate invoices, credit/debit notes, and payment allocations that automatically post to your Chart of Accounts, AR/AP, and P&L.",
  },
  {
    icon: ShieldCheck,
    title: "Role-Based Access & Security",
    description:
      "Control Owner, Admin, Staff, and Accountant permissions with server-side session revocation and strict organization data isolation.",
  },
  {
    icon: FileSpreadsheet,
    title: "Bulk Imports & Print-Ready PDFs",
    description:
      "Batch upload shipments, payments, and rate sheets via spreadsheets while producing crisp PDF waybills, receipts, and tax invoices.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Create Your Courier Workspace",
    description:
      "Sign up in under two minutes, configure your company logo and invoice prefix, and invite branch staff with granular roles.",
  },
  {
    step: "02",
    title: "Configure Rates & Book Shipments",
    description:
      "Upload carrier rate lists and remote area rules, quote clients accurately, and issue branded waybills and invoices in one click.",
  },
  {
    step: "03",
    title: "Track, Collect & Reconcile Live",
    description:
      "Share live public tracking links with customers while payments, vendor bills, and general ledger balances stay synced automatically.",
  },
];

function getDefaultChecklist(plan: {
  code: string;
  maxUsers: number;
  maxShipmentsPerMonth: number;
}): string[] {
  switch (plan.code) {
    case "starter":
      return [
        `${plan.maxShipmentsPerMonth} shipments/month`,
        `${plan.maxUsers} user limit`,
        "1 branch limit",
        "All core features",
        "Excludes Remote Area & Finances",
      ];
    case "growth":
      return [
        `${plan.maxShipmentsPerMonth} shipments/month`,
        `${plan.maxUsers} users limit`,
        "3 branches limit",
        "Remote Area Lookup included",
        "Excludes Finances",
      ];
    case "pro":
      return [
        `${plan.maxShipmentsPerMonth} shipments/month`,
        `${plan.maxUsers} users limit`,
        "5 branches limit",
        "Remote Area Lookup included",
        "Finances & Reports included",
      ];
    default:
      return [
        `${plan.maxShipmentsPerMonth} shipments/month`,
        `Up to ${plan.maxUsers} users`,
        "Real-time shipment tracking",
        "Automated invoicing",
      ];
  }
}

async function getLandingPlans(): Promise<PublicPlan[]> {
  try {
    const dbPlans = await prisma.plan.findMany({
      where: {
        code: { notIn: ["trial", "free"] },
      },
      orderBy: { priceMonthlyUsd: "asc" },
    });

    if (!dbPlans.length) return FALLBACK_PLANS;

    return dbPlans.map((plan) => {
      let featuresObj: Record<string, unknown> = {};
      if (typeof plan.features === "string") {
        try {
          featuresObj = JSON.parse(plan.features);
        } catch {
          featuresObj = {};
        }
      } else if (plan.features && typeof plan.features === "object") {
        featuresObj = plan.features as Record<string, unknown>;
      }

      const rawPrice = Number(plan.priceMonthlyUsd);
      const featuresList =
        Array.isArray(featuresObj.featuresList) &&
        featuresObj.featuresList.length > 0
          ? featuresObj.featuresList.map((item) => String(item))
          : getDefaultChecklist(plan);

      const discountRaw = featuresObj.yearlyDiscountPercent;
      const yearlyDiscountPercent =
        discountRaw !== undefined && !Number.isNaN(Number(discountRaw))
          ? Number(discountRaw)
          : 20;

      return {
        id: plan.id,
        code: plan.code,
        name: plan.name,
        priceMonthly: Number.isFinite(rawPrice) ? rawPrice : 0,
        currency: "PKR",
        maxUsers: plan.maxUsers,
        maxShipmentsPerMonth: plan.maxShipmentsPerMonth,
        description:
          typeof featuresObj.description === "string" &&
          featuresObj.description.trim().length > 0
            ? featuresObj.description
            : `Built for teams managing up to ${plan.maxShipmentsPerMonth} monthly shipments.`,
        featuresList,
        yearlyDiscountPercent,
      };
    });
  } catch {
    return FALLBACK_PLANS;
  }
}

export default async function HomePage() {
  const plans = await getLandingPlans();

  const softwareOffers = [
    { name: "14-Day Free Trial", price: 0, priceCurrency: "PKR" },
    ...plans.map((p) => ({
      name: p.name,
      price: p.priceMonthly,
      priceCurrency: p.currency,
    })),
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100">
      <JsonLd
        data={[
          getSoftwareApplicationSchema(softwareOffers),
          getFaqSchema(LANDING_FAQS),
        ]}
      />

      {/* ───────────────────────────── HERO ───────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#090d1f] via-[#0f172a] to-[#1e3a8a] text-white">
        <div
          className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] bg-size-[24px_24px]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/15 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-blue-200">
                <span>Smart Logistics, Stronger Business</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
                All-In-One{" "}
                <span className="bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
                  Courier &amp; Cargo
                </span>{" "}
                Management SaaS.
              </h1>

              <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
                Proxima Smart Solutions (PSS) unifies shipment booking, real-time
                customer tracking, multi-branch operations, rate calculation,
                and double-entry accounting into one cloud workspace.
              </p>

              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors"
                >
                  Start 14-Day Free Trial
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 hover:bg-white/15 px-6 py-3.5 text-sm font-semibold text-white transition-colors"
                >
                  Sign In / Live Demo
                </Link>
              </div>

              <div className="pt-4 space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                  Already have a shipment booking ID?
                </p>
                <QuickTrackForm />
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  14-day free trial
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Multi-tenant isolation
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Built-in AR/AP &amp; general ledger
                </span>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative rounded-3xl border border-white/15 bg-white/5 p-6 sm:p-8 backdrop-blur-md shadow-2xl">
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">
                      Unified Operations Hub
                    </p>
                    <p className="text-lg font-bold text-white mt-0.5">
                      Built for Courier &amp; Cargo Teams
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-xs font-semibold text-emerald-300">
                    Cloud Ready
                  </span>
                </div>

                <div className="relative my-6 flex justify-center">
                  <Image
                    src="/boxes.png"
                    alt="International courier and cargo parcels managed in Proxima Smart Solutions"
                    width={560}
                    height={340}
                    priority
                    className="w-full max-w-sm h-auto object-contain"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 text-center pt-2 border-t border-white/10">
                  <div className="rounded-xl bg-white/5 p-3">
                    <p className="text-xl font-extrabold text-white">100+</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Countries &amp; Zones
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3">
                    <p className="text-xl font-extrabold text-white">Real-Time</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Public Tracking
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3">
                    <p className="text-xl font-extrabold text-white">2x Entry</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Full Accounting
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────── CARRIER ECOSYSTEM ───────────────────── */}
      <section className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 py-10">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 mb-6">
            Supports Rate Cards, Zones &amp; Tracking Workflows Across Major Global Carriers
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 items-center justify-items-center">
            {CARRIER_LOGOS.map((carrier) => (
              <div
                key={carrier.name}
                className="flex items-center justify-center h-14 px-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/70 dark:border-zinc-800 w-full"
              >
                <Image
                  src={carrier.src}
                  alt={`${carrier.name} courier integration`}
                  width={120}
                  height={40}
                  className="h-8 w-auto object-contain"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── FEATURES ───────────────────────── */}
      <section id="features" className="py-20 sm:py-24 scroll-mt-20">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400 mb-2">
              Platform Capabilities
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Everything required to run a modern courier &amp; cargo business
            </h2>
            <p className="mt-3 text-base text-slate-600 dark:text-slate-400">
              Eliminate disconnected spreadsheets and manual ledgers with one unified platform for dispatch, tracking, and finance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-7 shadow-sm hover:shadow-lg transition-shadow"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-5">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {feature.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────── HOW IT WORKS ─────────────────────── */}
      <section className="py-20 bg-slate-50 dark:bg-zinc-900/40 border-y border-slate-200 dark:border-zinc-800">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400 mb-2">
              Fast Onboarding
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Launch your branded courier workspace in 3 steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((item) => (
              <div
                key={item.step}
                className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-7"
              >
                <span className="inline-block text-xs font-extrabold tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-full mb-4">
                  STEP {item.step}
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── PRICING ───────────────────────── */}
      <section id="pricing" className="py-20 sm:py-24 scroll-mt-20">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400 mb-2">
              Transparent SaaS Pricing
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Plans built to scale with your shipment volume
            </h2>
            <p className="mt-3 text-base text-slate-600 dark:text-slate-400">
              Start with a 14-day free trial and upgrade seamlessly as your branches and customers grow.
            </p>
          </div>

          <PricingSectionClient plans={plans} />
        </div>
      </section>

      {/* ─────────────────────────── FAQ ─────────────────────────── */}
      <section
        id="faq"
        className="py-20 bg-slate-50 dark:bg-zinc-900/40 border-y border-slate-200 dark:border-zinc-800 scroll-mt-20"
      >
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400 mb-2">
              Frequently Asked Questions
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Answers about Proxima Smart Solutions (PSS)
            </h2>
          </div>

          <FaqAccordion faqs={LANDING_FAQS} />
        </div>
      </section>

      {/* ───────────────────────── CONTACT ───────────────────────── */}
      <section id="contact" className="py-20 sm:py-24 scroll-mt-20">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5 space-y-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                Get In Touch
              </p>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Book a walkthrough or ask our onboarding team
              </h2>
              <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                Need help migrating rate sheets, setting up multi-branch workspaces, or activating your team? Reach out directly.
              </p>

              <div className="space-y-4 pt-2 text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Office Address
                    </p>
                    <p className="text-slate-600 dark:text-slate-400">
                      {SITE_CONFIG.address.streetAddress},{" "}
                      {SITE_CONFIG.address.addressLocality},{" "}
                      {SITE_CONFIG.address.postalCode}, Pakistan
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Phone / WhatsApp
                    </p>
                    <a
                      href={`tel:${SITE_CONFIG.phone.replace(/\s+/g, "")}`}
                      className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {SITE_CONFIG.phone}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Email
                    </p>
                    <a
                      href={`mailto:${SITE_CONFIG.email}`}
                      className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {SITE_CONFIG.email}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm">
              <LandingContactForm />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
