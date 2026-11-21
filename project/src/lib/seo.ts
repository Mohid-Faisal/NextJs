import type { Metadata } from "next";

export const SITE_CONFIG = {
  name: "Proxima Smart Solutions",
  shortName: "PSS",
  fullBrand: "Proxima Smart Solutions (PSS)",
  tagline: "All-In-One Courier & Cargo Management SaaS",
  description:
    "Cloud-based courier, cargo, and logistics management SaaS. Automate bookings, real-time shipment tracking, multi-branch operations, automated invoicing, and double-entry accounting.",
  email: "info@psswwe.com",
  phone: "+92 300 8482 321",
  whatsapp: "923008482321",
  address: {
    streetAddress: "LGF-44, Land Mark Plaza, Jail Road",
    addressLocality: "Lahore",
    postalCode: "54660",
    addressCountry: "PK",
  },
  keywords: [
    "courier management software",
    "cargo management SaaS",
    "logistics management system",
    "courier ERP",
    "shipment tracking software",
    "freight billing software",
    "multi-branch courier software",
    "courier accounting software",
    "Proxima Smart Solutions",
    "PSS courier software",
  ],
} as const;

const DEFAULT_SITE_URL = "https://psswwe.com";

function isLocalhostUrl(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1";
}

function parseValidSiteOrigin(raw?: string): string | null {
  if (!raw) return null;
  const candidate = raw.trim().replace(/\/+$/, "");
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.origin;
    }
  } catch {
    // Ignore malformed URLs
  }
  return null;
}

export function getSiteUrl(): string {
  const isProd = process.env.NODE_ENV === "production";
  const envAppRaw = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (envAppRaw) {
    const parsedOrigin = parseValidSiteOrigin(envAppRaw);
    if (parsedOrigin) {
      const parsedUrl = new URL(parsedOrigin);
      if (!isProd || !isLocalhostUrl(parsedUrl)) {
        return parsedOrigin;
      }
    }
  }

  const vercelProdRaw = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProdRaw) {
    const withProtocol = `https://${vercelProdRaw.replace(/^https?:\/\//i, "")}`;
    const parsedVercel = parseValidSiteOrigin(withProtocol);
    if (parsedVercel) {
      return parsedVercel;
    }
  }

  return DEFAULT_SITE_URL;
}

export function absoluteUrl(path = "/"): string {
  const base = getSiteUrl();
  if (!path || path === "/") return base;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  noIndex?: boolean;
};

export function buildPageMetadata(opts: PageMetadataOptions): Metadata {
  return {
    title: opts.title,
    description: opts.description,
    keywords: opts.keywords,
    alternates: {
      canonical: opts.path,
    },
    openGraph: {
      type: "website",
      url: opts.path,
      title: opts.title,
      description: opts.description,
      siteName: SITE_CONFIG.fullBrand,
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
    },
    robots: opts.noIndex
      ? {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false,
          },
        }
      : undefined,
  };
}

export type FaqItem = {
  question: string;
  answer: string;
};

export const LANDING_FAQS: FaqItem[] = [
  {
    question: "What does Proxima Smart Solutions (PSS) include for courier and cargo companies?",
    answer:
      "Proxima Smart Solutions (PSS) combines shipment booking, waybill and invoice PDF generation, real-time public tracking, rate and zone calculation, remote-area lookup, customer and vendor portals, and built-in double-entry accounting in a single cloud platform.",
  },
  {
    question: "Can we manage multiple branches and staff permissions in one workspace?",
    answer:
      "Yes. Each organization gets an isolated multi-tenant workspace with role-based access control (Owner, Admin, Staff, Accountant), branch-level visibility, and team member invitations.",
  },
  {
    question: "Does PSS provide a public shipment tracking page for our customers?",
    answer:
      "Yes. Customers can track consignments in real time on our public tracking portal using their booking ID or tracking number, branded with your organization logo and live delivery milestones.",
  },
  {
    question: "How does built-in accounting and invoicing work?",
    answer:
      "Every shipment invoice, customer payment, vendor bill, credit note, and debit note automatically posts to a double-entry general ledger with Accounts Receivable, Accounts Payable, Chart of Accounts, Balance Sheet, and Income Statement reports.",
  },
  {
    question: "Can we configure carrier rates, zones, and remote area surcharges?",
    answer:
      "Yes. You can upload and manage custom rate lists, country zones, volumetric weight divisors, and carrier-specific remote area rules for DHL, FedEx, UPS, DPD, Parcelforce, Skynet, and local routes.",
  },
  {
    question: "How is tenant data isolated and secured?",
    answer:
      "Every database query is scoped to your organization ID, sessions are backed by server-side revocable tokens and httpOnly cookies, and all responses ship with strict transport and framing security headers.",
  },
  {
    question: "Can we try Proxima Smart Solutions before choosing a paid plan?",
    answer:
      "Yes. You can register a new courier workspace in minutes and start with a 14-day free trial—no credit card required upfront—or test the platform directly from the Live Demo on the sign-in page.",
  },
];

export type SoftwareOffer = {
  name: string;
  price: number;
  priceCurrency?: string;
};

export function getOrganizationSchema(): Record<string, unknown> {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_CONFIG.name,
    alternateName: [SITE_CONFIG.shortName, SITE_CONFIG.fullBrand],
    url: siteUrl,
    logo: absoluteUrl("/SaaS-Logo.png"),
    email: SITE_CONFIG.email,
    telephone: SITE_CONFIG.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE_CONFIG.address.streetAddress,
      addressLocality: SITE_CONFIG.address.addressLocality,
      postalCode: SITE_CONFIG.address.postalCode,
      addressCountry: SITE_CONFIG.address.addressCountry,
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: SITE_CONFIG.phone,
        email: SITE_CONFIG.email,
        contactType: "sales",
        availableLanguage: ["English"],
      },
    ],
  };
}

export function getWebSiteSchema(): Record<string, unknown> {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_CONFIG.fullBrand,
    alternateName: SITE_CONFIG.name,
    url: siteUrl,
    description: SITE_CONFIG.description,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/tracking?bookingId={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function getSoftwareApplicationSchema(
  offers?: SoftwareOffer[]
): Record<string, unknown> {
  const siteUrl = getSiteUrl();
  const formattedOffers =
    offers && offers.length > 0
      ? offers.map((offer) => ({
          "@type": "Offer",
          name: offer.name,
          price: Number.isFinite(offer.price) ? offer.price : 0,
          priceCurrency: offer.priceCurrency || "PKR",
          availability: "https://schema.org/InStock",
          url: absoluteUrl("/auth/signup"),
        }))
      : [
          {
            "@type": "Offer",
            name: "14-Day Free Trial",
            price: 0,
            priceCurrency: "PKR",
            availability: "https://schema.org/InStock",
            url: absoluteUrl("/auth/signup"),
          },
        ];

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_CONFIG.fullBrand,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: SITE_CONFIG.description,
    url: siteUrl,
    featureList: [
      "Multi-branch courier and cargo workspace management",
      "Real-time public shipment tracking with brand logos",
      "Automated rate, zone, and volumetric weight calculation",
      "Double-entry accounting, general ledger, and financial statements",
      "Customer invoicing, payment allocation, and PDF generation",
      "Role-based access control and team permissions",
    ],
    offers: formattedOffers,
  };
}

export function getFaqSchema(faqs: FaqItem[] = LANDING_FAQS): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function getBreadcrumbSchema(
  items: Array<{ name: string; path: string }>
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
