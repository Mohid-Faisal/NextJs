"use client";

import { useEffect } from "react";
import NProgress from "nprogress";

/**
 * This component patches the global `fetch` so that any fetch request
 * automatically triggers the top progress bar (NProgress).
 * It tracks concurrent requests and only finishes when all are done.
 */
export default function TopLoaderFetch() {
  useEffect(() => {
    const originalFetch = window.fetch;
    let activeRequests = 0;

    window.fetch = async (...args) => {
      activeRequests++;
      if (activeRequests === 1) {
        NProgress.start();
      }

      try {
        const response = await originalFetch(...args);
        return response;
      } finally {
        activeRequests--;
        if (activeRequests === 0) {
          NProgress.done();
        }
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
