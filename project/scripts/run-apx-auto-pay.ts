/**
 * One-shot CLI: settle unpaid APX Logistics vendor invoices via BANK_TRANSFER + "IB- Funds Transfer".
 * Run from project root: npx tsx scripts/run-apx-auto-pay.ts
 */
import { prisma } from "../src/lib/prisma";
import {
  isApxLogisticsVendor,
  runApxLogisticsAutoPay,
} from "../src/lib/accounts/skynetVendorAutoPay";

async function main() {
  try {
    const apxCandidates = await prisma.vendors.findMany({
      where: {
        CompanyName: { contains: "APX", mode: "insensitive" },
      },
      select: { id: true, CompanyName: true },
    });

    const apx =
      apxCandidates.find((v) => isApxLogisticsVendor(v.CompanyName)) ?? null;

    if (!apx) {
      console.error(
        "No vendor matched APX Logistics (name must include apx and logistics)."
      );
      if (apxCandidates.length > 0) {
        console.error('Vendors containing "APX":');
        for (const v of apxCandidates) {
          console.error(`  id=${v.id}  ${v.CompanyName}`);
        }
      } else {
        const sample = await prisma.vendors.findMany({
          take: 15,
          orderBy: { id: "asc" },
          select: { id: true, CompanyName: true },
        });
        console.error('No vendor names contain "APX". Sample vendors in DB:');
        for (const v of sample) {
          console.error(`  id=${v.id}  ${v.CompanyName}`);
        }
      }
      process.exitCode = 1;
      return;
    }

    console.log(`Vendor: ${apx.CompanyName} (id=${apx.id})`);

    const outcome = await runApxLogisticsAutoPay(prisma, apx.id, {
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
