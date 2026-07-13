"use client";

import { useEffect } from "react";
import { startProgress, stopProgress } from "@/lib/toploader";

/**
 * This component patches the global `fetch` so that any fetch request
 * automatically triggers the top progress bar.
 * Uses ref-counting so the bar stays open if a page is also holding it.
 */
export default function TopLoaderFetch() {
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const url = typeof args[0] === "string"
        ? args[0]
        : (args[0] instanceof URL
          ? args[0].href
          : (args[0] && typeof args[0] === "object" && "url" in args[0]
            ? (args[0] as any).url
            : ""));

      const options = args[1];
      const headers = options?.headers;

      // Identify Next.js prefetch or data preflight requests
      let isPrefetch = false;
      if (headers) {
        if (headers instanceof Headers) {
          isPrefetch = headers.get("Purpose") === "prefetch" || headers.get("x-middleware-preflight") === "1";
        } else if (Array.isArray(headers)) {
          isPrefetch = headers.some(([k, v]) => k.toLowerCase() === "purpose" && v === "prefetch");
        } else if (typeof headers === "object") {
          const h = headers as Record<string, string>;
          const purposeKey = Object.keys(h).find(k => k.toLowerCase() === "purpose");
          const preflightKey = Object.keys(h).find(k => k.toLowerCase() === "x-middleware-preflight");
          isPrefetch = (purposeKey && h[purposeKey] === "prefetch") || (preflightKey && h[preflightKey] === "1");
        }
      }

      // Skip progress bar for Next.js internal chunks, hot-reload, and background telemetry
      const isNextAsset = url.includes("/_next/") || url.includes("hot-update");
      const isTelemetry = url.includes("/api/user-activity") || url.includes("/api/notifications");

      if (isPrefetch || isNextAsset || isTelemetry) {
        return originalFetch(...args);
      }

      startProgress();
      try {
        const response = await originalFetch(...args);
        return response;
      } finally {
        stopProgress();
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
