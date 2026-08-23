process.env.JWT_SECRET = "test-secret-value-at-least-32-characters-long!!";

import { describe, expect, test } from "vitest";
import { validateLogoUrl, resolvePublicLogoPath } from "@/lib/logoUrl";

describe("validateLogoUrl", () => {
  test("allows empty", () => {
    expect(validateLogoUrl("").ok).toBe(true);
    expect(validateLogoUrl("   ").ok).toBe(true);
  });

  test("allows public https URLs", () => {
    expect(validateLogoUrl("https://example.com/logo.png").ok).toBe(true);
    expect(validateLogoUrl("https://cdn.example.co.uk/a/b.png").ok).toBe(true);
  });

  test("blocks private/loopback/metadata hosts (SSRF)", () => {
    const blocked = [
      "http://localhost:3000/logo.png",
      "http://127.0.0.1/logo.png",
      "http://169.254.169.254/latest/meta-data/",
      "http://10.0.0.5/x",
      "http://192.168.1.1/x",
      "http://172.16.0.1/x",
      "http://172.31.255.255/x",
      "http://0.0.0.0/x",
      "https://metadata.google.internal/computeMetadata/v1/",
      "https://db.internal/x",
    ];
    for (const url of blocked) {
      expect(validateLogoUrl(url).ok, url).toBe(false);
    }
  });

  test("blocks credentials in URL", () => {
    expect(validateLogoUrl("https://user:pass@example.com/x").ok).toBe(false);
  });

  test("blocks path traversal and non-rooted paths", () => {
    expect(validateLogoUrl("/../../.env").ok).toBe(false);
    expect(validateLogoUrl("/images/../../secret").ok).toBe(false);
    expect(validateLogoUrl("../../etc/passwd").ok).toBe(false);
    expect(validateLogoUrl("images/logo.png").ok).toBe(false); // must be rooted
  });

  test("allows rooted paths without traversal", () => {
    expect(validateLogoUrl("/logo_final.png").ok).toBe(true);
    expect(validateLogoUrl("/branding/accent.svg").ok).toBe(true);
  });
});

describe("resolvePublicLogoPath containment", () => {
  test("resolves inside public/", () => {
    const p = resolvePublicLogoPath("/logo_final.png");
    expect(p).toContain("public");
    expect(p?.endsWith("logo_final.png")).toBe(true);
  });

  test("rejects traversal outside public/", () => {
    expect(resolvePublicLogoPath("/../../.env")).toBeNull();
    expect(resolvePublicLogoPath("https://example.com/a.png")).toBeNull();
    expect(resolvePublicLogoPath("")).toBeNull();
  });
});
