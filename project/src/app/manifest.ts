import type { MetadataRoute } from "next";
import { SITE_CONFIG } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_CONFIG.fullBrand,
    short_name: SITE_CONFIG.shortName,
    description: SITE_CONFIG.description,
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#1e3a8a",
    icons: [
      {
        src: "/SaaS-Logo.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
