"use client";

/**
 * Organization branding — sourced from org-scoped AppSettings (server) with
 * localStorage as an offline cache.
 *
 * Previously branding lived ONLY in localStorage: settings were per-browser,
 * so teammates never saw each other's branding and invoice documents silently
 * fell back to platform defaults on new devices. The server is now the source
 * of truth; localStorage remains as an instant-read cache.
 */

export interface Branding {
  accentColor: string;
  invoiceDisclaimer: string;
  supportEmail: string;
  supportPhone: string;
  supportAddress: string;
}

export const DEFAULT_BRANDING: Branding = {
  accentColor: "blue",
  invoiceDisclaimer:
    "No cash, Cash equivalent, Gold jewelary or Dangerous goods accepted. Insurance is compulsory from shipper side, PSS is not responsible for any loss and damage goods.",
  supportEmail: "info@psswwe.com",
  supportPhone: "+92 (21) 111-222-333",
  supportAddress: "LG-44, Land Mark Plaza, 5-6 Jail Road, Lahore",
};

const CACHE_KEY = "org_branding_cache";

/** One-time migration from the old per-feature localStorage keys. */
function readLegacyKeys(): Partial<Branding> {
  const legacy: Record<string, string | undefined> = {
    accentColor: localStorage.getItem("brand_accent_color") ?? undefined,
    invoiceDisclaimer: localStorage.getItem("brand_invoice_disclaimer") ?? undefined,
    supportEmail: localStorage.getItem("brand_support_email") ?? undefined,
    supportPhone: localStorage.getItem("brand_support_phone") ?? undefined,
    supportAddress: localStorage.getItem("brand_support_address") ?? undefined,
  };
  return Object.fromEntries(
    Object.entries(legacy).filter(([, v]) => v != null)
  ) as Partial<Branding>;
}

function readCache(): Partial<Branding> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
    // First visit after upgrade: carry over any pre-existing local settings.
    return readLegacyKeys();
  } catch {
    return {};
  }
}

let hydrationScheduled = false;
/**
 * Sync read from the local cache; also schedules a one-time background
 * hydration from the server so later reads see authoritative values.
 */
export function readCachedBranding(): Branding {
  if (!hydrationScheduled && typeof window !== "undefined") {
    hydrationScheduled = true;
    void fetchBranding();
  }
  return { ...DEFAULT_BRANDING, ...readCache() };
}

/**
 * Load branding from the server (falling back to cached values), refreshing
 * the cache for subsequent synchronous reads.
 */
export async function fetchBranding(): Promise<Branding> {
  try {
    const res = await fetch("/api/settings/custom?key=settings_branding");
    if (res.ok) {
      const data = await res.json();
      if (data?.value) {
        const parsed = JSON.parse(data.value);
        const merged: Branding = { ...DEFAULT_BRANDING, ...parsed };
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
        } catch {
          // storage unavailable — ignore
        }
        return merged;
      }
    }
  } catch {
    // network failure — fall back to cache below
  }
  return readCachedBranding();
}

/** Persist branding to the server (OWNER/ADMIN only) and refresh the cache. */
export async function saveBranding(branding: Branding): Promise<boolean> {
  const res = await fetch("/api/settings/custom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: "settings_branding", value: JSON.stringify(branding) }),
  });
  if (res.ok) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(branding));
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event("orgBrandingUpdated"));
    return true;
  }
  return false;
}
