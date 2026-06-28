/**
 * Day 3 isolation test — org A vs org B shipment lists.
 * Requires dev server: npm run dev
 *   npx tsx scripts/test-isolation-day3.ts
 */
const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${email}: ${data.message || res.status}`);
  return data.token as string;
}

async function fetchShipments(token: string) {
  const res = await fetch(`${BASE}/api/shipments?limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error("Unauthorized — check token");
  const data = await res.json();
  return (data.shipments || []) as { trackingId?: string; organizationId?: number }[];
}

async function main() {
  console.log("=== Day 3 isolation test ===\n");

  const tokenA = await login("admin@pss.test", "Test@1234");
  const tokenB = await login("admin@orgb.test", "Test@1234");

  const shipsA = await fetchShipments(tokenA);
  const shipsB = await fetchShipments(tokenB);

  console.log(`Org A (pss-default): ${shipsA.length} shipment(s)`);
  shipsA.forEach((s) => console.log(`  - ${s.trackingId}`));

  console.log(`\nOrg B (test-org-b): ${shipsB.length} shipment(s)`);
  shipsB.forEach((s) => console.log(`  - ${s.trackingId}`));

  const aHasOrgB = shipsA.some((s) => s.trackingId === "ORGB-TEST-001");
  const bHasOrgB = shipsB.some((s) => s.trackingId === "ORGB-TEST-001");

  console.log("\nResults:");
  console.log(`  Org A sees ORGB-TEST-001: ${aHasOrgB ? "FAIL (leak!)" : "PASS"}`);
  console.log(`  Org B sees ORGB-TEST-001: ${bHasOrgB ? "PASS" : "FAIL"}`);

  if (!aHasOrgB && bHasOrgB) {
    console.log("\nIsolation OK.");
  } else {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
