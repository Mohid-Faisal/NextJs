/**
 * Week 3 isolation tests — verifies tenant data isolation across two orgs.
 *
 * Prerequisites:
 *   1. Dev server running:  npm run dev
 *   2. Two seeded orgs with admin users (see scripts/seed-org-b.ts / seed-test-user.ts):
 *        Org A: admin@pss.test  / Test@1234   (slug pss-default)
 *        Org B: admin@orgb.test / Test@1234   (slug test-org-b, has shipment ORGB-TEST-001)
 *
 * Run:
 *   npx tsx scripts/test-isolation-week3.ts
 */
const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const ORG_B_MARKER = "ORGB-TEST-001";

const A_EMAIL = process.env.ORG_A_EMAIL || "admin@pss.test";
const B_EMAIL = process.env.ORG_B_EMAIL || "admin@orgb.test";
const PASSWORD = process.env.TEST_PASSWORD || "Test@1234";

let failures = 0;

function check(name: string, passed: boolean, detail = "") {
  const status = passed ? "PASS" : "FAIL";
  if (!passed) failures++;
  console.log(`  [${status}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed for ${email}: ${data.message || res.status}`);
  return data.token as string;
}

type Shipment = { id?: number; trackingId?: string; organizationId?: number };

async function fetchShipments(token: string): Promise<Shipment[]> {
  const res = await fetch(`${BASE}/api/shipments?limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Shipments fetch failed: ${res.status}`);
  const data = await res.json();
  return (data.shipments || []) as Shipment[];
}

async function fetchShipmentById(token: string, id: number): Promise<number> {
  const res = await fetch(`${BASE}/api/shipments/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status;
}

async function main() {
  console.log("=== Week 3 isolation tests ===\n");

  const tokenA = await login(A_EMAIL, PASSWORD);
  const tokenB = await login(B_EMAIL, PASSWORD);

  const shipsA = await fetchShipments(tokenA);
  const shipsB = await fetchShipments(tokenB);

  console.log(`Org A: ${shipsA.length} shipment(s) | Org B: ${shipsB.length} shipment(s)\n`);

  // 1. List isolation
  console.log("1) List isolation");
  check("Org A does NOT see Org B's marker shipment", !shipsA.some((s) => s.trackingId === ORG_B_MARKER));
  check("Org B DOES see its own marker shipment", shipsB.some((s) => s.trackingId === ORG_B_MARKER), `expected ${ORG_B_MARKER}`);

  // 2. Cross-org fetch-by-id must 404
  console.log("\n2) Cross-org fetch by id returns 404");
  const orgBShipment = shipsB.find((s) => typeof s.id === "number");
  if (!orgBShipment?.id) {
    check("Org B has a shipment with an id to probe", false, "no shipment id available");
  } else {
    const statusForA = await fetchShipmentById(tokenA, orgBShipment.id);
    check(`Org A fetching Org B shipment #${orgBShipment.id} -> 404`, statusForA === 404, `got ${statusForA}`);
    const statusForB = await fetchShipmentById(tokenB, orgBShipment.id);
    check(`Org B fetching its own shipment #${orgBShipment.id} -> 200`, statusForB === 200, `got ${statusForB}`);
  }

  // 3. SaaS admin guard
  console.log("\n3) SaaS admin endpoint guard");
  const saasRes = await fetch(`${BASE}/api/saas/organizations`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  // Org A's admin may or may not be a super admin; either way it must NOT 500
  // and must be one of 200 (super admin) or 403 (regular org admin).
  check(
    "GET /api/saas/organizations returns 200 or 403 (never open/500)",
    saasRes.status === 200 || saasRes.status === 403,
    `got ${saasRes.status}`
  );

  console.log("\n=== Summary ===");
  if (failures === 0) {
    console.log("All isolation checks passed.");
  } else {
    console.log(`${failures} check(s) FAILED.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
