import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: absoluteUrl("/tracking"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/auth/signup"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/auth/login"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/privacy"),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: absoluteUrl("/terms"),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
