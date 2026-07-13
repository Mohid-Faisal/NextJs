"use client";

import { useEffect } from "react";
import { startProgress, stopProgress } from "@/lib/toploader";

/**
 * Hook that syncs a loading/searching boolean state with the top progress bar.
 * Uses ref-counting so it works alongside the global fetch interceptor.
 */
export function useTopLoader(isLoading: boolean) {
  useEffect(() => {
    if (isLoading) {
      startProgress();
      return () => {
        stopProgress();
      };
    }
  }, [isLoading]);
}
