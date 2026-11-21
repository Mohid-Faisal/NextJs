import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/tracking",
          "/privacy",
          "/terms",
          "/auth/login",
          "/auth/signup",
        ],
        disallow: [
          "/dashboard/",
          "/api/",
          "/auth/reset-password",
          "/tools/",
          "/rate-calculator",
          "/about",
          "/services",
          "/contact",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
