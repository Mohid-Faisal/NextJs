/**
 * One-shot CLI: settle unpaid Skynet Worldwide Express vendor invoices.
 * Run from project root: npx tsx scripts/run-skynet-auto-pay.ts
 */
import { prisma } from "../src/lib/prisma";
import {
  isSkynetWorldwideExpressVendor,
  runSkynetVendorAutoPay,
} from "../src/lib/accounts/skynetVendorAutoPay";

async function main() {
  try {
    const skynetCandidates = await prisma.vendors.findMany({
      where: {
        CompanyName: { contains: "Skynet"},
      },
      select: { id: true, CompanyName: true },
    });

    const skynet =
      skynetCandidates.find((v) =>
        isSkynetWorldwideExpressVendor(v.CompanyName)
      ) ?? null;

    if (!skynet) {
      console.error(
        "No vendor matched Skynet Worldwide Express (name must include skynet, worldwide, and express)."
      );
      if (skynetCandidates.length > 0) {
        console.error("Vendors containing \"Skynet\":");
        for (const v of skynetCandidates) {
          console.error(`  id=${v.id}  ${v.CompanyName}`);
        }
      } else {
        const sample = await prisma.vendors.findMany({
          take: 15,
          orderBy: { id: "asc" },
          select: { id: true, CompanyName: true },
        });
        console.error("No vendor names contain \"Skynet\". Sample vendors in DB:");
        for (const v of sample) {
          console.error(`  id=${v.id}  ${v.CompanyName}`);
        }
      }
      process.exitCode = 1;
      return;
    }

    console.log(`Vendor: ${skynet.CompanyName} (id=${skynet.id})`);

    const outcome = await runSkynetVendorAutoPay(prisma, skynet.id, {
      onProgress: (line) => console.log(line),
    });

    if (!outcome.ok) {
      console.error(`Failed (${outcome.status}): ${outcome.error}`);
      process.exitCode = 1;
      return;
    }

    console.log(JSON.stringify(outcome.data, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
