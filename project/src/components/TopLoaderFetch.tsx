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
