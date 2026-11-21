import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import {
  LANDING_FAQS,
  absoluteUrl,
  getBreadcrumbSchema,
  getFaqSchema,
  getOrganizationSchema,
  getSiteUrl,
  getSoftwareApplicationSchema,
  getWebSiteSchema,
} from "@/lib/seo";

describe("SEO utilities and route generators", () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const originalVercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalAppUrl !== undefined) {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    } else {
      delete process.env.NEXT_PUBLIC_APP_URL;
    }
    if (originalVercelUrl !== undefined) {
      process.env.VERCEL_PROJECT_PRODUCTION_URL = originalVercelUrl;
    } else {
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    }
  });

  it("normalizes getSiteUrl and absoluteUrl across env configs", () => {
    expect(getSiteUrl()).toBe("https://psswwe.com");
    expect(absoluteUrl("/")).toBe("https://psswwe.com");
    expect(absoluteUrl("/tracking")).toBe("https://psswwe.com/tracking");
    expect(absoluteUrl("privacy")).toBe("https://psswwe.com/privacy");

    process.env.NEXT_PUBLIC_APP_URL = "https://app.proximasmart.com///";
    expect(getSiteUrl()).toBe("https://app.proximasmart.com");
    expect(absoluteUrl("/auth/signup")).toBe(
      "https://app.proximasmart.com/auth/signup"
    );

    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "pss-saas.vercel.app";
    expect(getSiteUrl()).toBe("https://pss-saas.vercel.app");

    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    process.env.NEXT_PUBLIC_APP_URL = "not-a-valid-url";
    expect(getSiteUrl()).toBe("https://psswwe.com");
  });

  it("ignores localhost NEXT_PUBLIC_APP_URL in production and falls back to https://psswwe.com", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(getSiteUrl()).toBe("https://psswwe.com");

    process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3000";
    expect(getSiteUrl()).toBe("https://psswwe.com");

    process.env.VERCEL_PROJECT_PRODUCTION_URL = "psswwe.com";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(getSiteUrl()).toBe("https://psswwe.com");
  });

  it("robots() allows public routes, disallows private routes, and links sitemap", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://psswwe.com";
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(result.sitemap).toBe("https://psswwe.com/sitemap.xml");
    expect(result.host).toBe("https://psswwe.com");
    expect(rules?.allow).toEqual(
      expect.arrayContaining(["/", "/tracking", "/privacy", "/terms"])
    );
    expect(rules?.disallow).toEqual(
      expect.arrayContaining(["/dashboard/", "/api/", "/auth/reset-password"])
    );
  });

  it("sitemap() includes canonical public URLs and excludes private routes", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://psswwe.com";
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toEqual(
      expect.arrayContaining([
        "https://psswwe.com",
        "https://psswwe.com/tracking",
        "https://psswwe.com/auth/signup",
        "https://psswwe.com/auth/login",
        "https://psswwe.com/privacy",
        "https://psswwe.com/terms",
      ])
    );

    for (const url of urls) {
      expect(url).not.toContain("/dashboard");
      expect(url).not.toContain("/api");
      expect(url).not.toContain("/reset-password");
    }
  });

  it("JSON-LD builders produce valid Schema.org graphs", () => {
    const org = getOrganizationSchema();
    expect(org["@context"]).toBe("https://schema.org");
    expect(org["@type"]).toBe("Organization");
    expect(org.name).toBe("Proxima Smart Solutions");

    const site = getWebSiteSchema();
    expect(site["@context"]).toBe("https://schema.org");
    expect(site["@type"]).toBe("WebSite");

    const app = getSoftwareApplicationSchema([
      { name: "Starter", price: 7500, priceCurrency: "PKR" },
    ]);
    expect(app["@context"]).toBe("https://schema.org");
    expect(app["@type"]).toBe("SoftwareApplication");
    expect(app.applicationCategory).toBe("BusinessApplication");

    const faq = getFaqSchema(LANDING_FAQS);
    expect(faq["@context"]).toBe("https://schema.org");
    expect(faq["@type"]).toBe("FAQPage");
    expect(Array.isArray(faq.mainEntity)).toBe(true);
    expect((faq.mainEntity as unknown[]).length).toBe(LANDING_FAQS.length);

    const crumbs = getBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Privacy Policy", path: "/privacy" },
    ]);
    expect(crumbs["@context"]).toBe("https://schema.org");
    expect(crumbs["@type"]).toBe("BreadcrumbList");
  });
});
