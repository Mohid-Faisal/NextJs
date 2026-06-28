/** Quick Day 2 check: login returns org-scoped JWT. */
const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function main() {
  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@pss.test", password: "Test@1234" }),
  });
  const data = await res.json();
  console.log("Status:", res.status);
  console.log(JSON.stringify(data, null, 2));

  if (data.token) {
    const payload = JSON.parse(
      Buffer.from(data.token.split(".")[1], "base64url").toString()
    );
    console.log("\nJWT claims:", {
      organizationId: payload.organizationId,
      orgRole: payload.orgRole,
      orgStatus: payload.orgStatus,
      platformRole: payload.platformRole,
    });
  }
}

main().catch(console.error);
