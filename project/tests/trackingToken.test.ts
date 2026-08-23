process.env.JWT_SECRET = "test-secret-value-at-least-32-characters-long!!";

import { describe, expect, test } from "vitest";
import { signTrackingToken, verifyTrackingToken, buildTrackingUrl } from "@/lib/trackingToken";

describe("tracking token roundtrip", () => {
  test("signs and verifies", () => {
    const t = signTrackingToken("DEMO-1001");
    expect(verifyTrackingToken(t)).toBe("DEMO-1001");
  });

  test("rejects tampered ids", () => {
    const t = signTrackingToken("DEMO-1001");
    // Flip the id but keep signature
    const parts = t.split(".");
    const forged = `DEMO-9999.${parts[1]}.${parts[2]}`;
    expect(verifyTrackingToken(forged)).toBeNull();
  });

  test("rejects tampered signatures", () => {
    const t = signTrackingToken("DEMO-1001");
    const parts = t.split(".");
    expect(verifyTrackingToken(`${parts[0]}.${parts[1]}.AAAA${parts[2].slice(4)}`)).toBeNull();
  });

  test("rejects expired tokens", () => {
    const t = signTrackingToken("DEMO-1001", -1); // already expired
    expect(verifyTrackingToken(t)).toBeNull();
  });

  test("rejects garbage", () => {
    expect(verifyTrackingToken("")).toBeNull();
    expect(verifyTrackingToken("abc")).toBeNull();
    expect(verifyTrackingToken("a.b.c")).toBeNull();
  });

  test("builds full URL with encoded token", () => {
    const url = buildTrackingUrl("TRK/1 2", "http://localhost:3000");
    expect(url.startsWith("http://localhost:3000/tracking?t=")).toBe(true);
    const token = decodeURIComponent(url.split("t=")[1]);
    expect(verifyTrackingToken(token)).toBe("TRK/1 2");
  });
});
