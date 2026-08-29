/**
 * Backfill missing JournalEntry records for Payment records.
 *
 * Usage:
 *   npx tsx scripts/backfill-payment-journal-entries.ts           (dry-run preview)
 *   npx tsx scripts/backfill-payment-journal-entries.ts --apply   (apply writes)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type ChartAccount = {
  id: number;
  code: string;
  accountName: string;
  category: string;
};

function findCashOrBankAccount(
  accounts: ChartAccount[],
  mode: string | null
): ChartAccount | undefined {
  const isCash = !mode || mode.toUpperCase() === "CASH";
  if (isCash) {
    const cash = accounts.find(
      (a) =>
        (a.accountName.toLowerCase().includes("cash in hand") ||
          a.accountName.toLowerCase().includes("petty cash") ||
          a.accountName.toLowerCase() === "cash") &&
        a.category === "Asset"
    );
    if (cash) return cash;
    return accounts.find(
      (a) => a.accountName.toLowerCase().includes("cash") && a.category === "Asset"
    );
  }

  // Bank transfer / Card / Cheque
  const bank = accounts.find(
    (a) =>
      (a.accountName.toLowerCase().includes("bank") ||
        a.accountName.toLowerCase().includes("current account") ||
        a.accountName.toLowerCase().includes("checking") ||
        a.accountName.toLowerCase().includes("meezan") ||
        a.accountName.toLowerCase().includes("hbl")) &&
      a.category === "Asset"
  );
  if (bank) return bank;

  // Fallback to any Asset cash account
  return accounts.find((a) => a.category === "Asset");
}

function findCategoryAccount(
  accounts: ChartAccount[],
  categoryName: string,
  prismaCategory: "Expense" | "Revenue"
): ChartAccount | undefined {
  const lower = (categoryName || "").toLowerCase().trim();
  if (!lower) {
    return accounts.find((a) => a.category === prismaCategory);
  }

  // Exact match
  let acc = accounts.find(
    (a) => a.category === prismaCategory && a.accountName.toLowerCase() === lower
  );
  if (acc) return acc;

  // Account name includes category
  acc = accounts.find(
    (a) =>
      a.category === prismaCategory &&
      a.accountName.toLowerCase().includes(lower)
  );
  if (acc) return acc;

  // Category includes account name
  acc = accounts.find(
    (a) =>
      a.category === prismaCategory &&
      lower.includes(a.accountName.toLowerCase())
  );
  if (acc) return acc;

  // Fallback to general Expense / Revenue account
  return accounts.find((a) => a.category === prismaCategory);
}

async function ensureDefaultAccounts(
  organizationId: number
): Promise<ChartAccount[]> {
  let accounts = await prisma.chartOfAccount.findMany({
    where: { organizationId },
    select: {
      id: true,
      code: true,
      accountName: true,
      category: true,
    },
  });

  if (accounts.length === 0) {
    console.log(`[Org ${organizationId}] Seeding default chart of accounts...`);
    const defaults = [
      { code: "1010", name: "Cash in Hand", category: "Asset", type: "Current Asset", debitRule: "Increase", creditRule: "Decrease" },
      { code: "1020", name: "Bank Account", category: "Asset", type: "Current Asset", debitRule: "Increase", creditRule: "Decrease" },
      { code: "1030", name: "Accounts Receivable", category: "Asset", type: "Current Asset", debitRule: "Increase", creditRule: "Decrease" },
      { code: "2010", name: "Accounts Payable", category: "Liability", type: "Current Liability", debitRule: "Decrease", creditRule: "Increase" },
      { code: "4010", name: "Courier & Delivery Revenue", category: "Revenue", type: "Operating Revenue", debitRule: "Decrease", creditRule: "Increase" },
      { code: "5010", name: "Transportation Expense", category: "Expense", type: "Operating Expense", debitRule: "Increase", creditRule: "Decrease" },
      { code: "5020", name: "Fuel Expense", category: "Expense", type: "Operating Expense", debitRule: "Increase", creditRule: "Decrease" },
      { code: "5030", name: "Office Expense", category: "Expense", type: "Operating Expense", debitRule: "Increase", creditRule: "Decrease" },
      { code: "5040", name: "General Expense", category: "Expense", type: "Operating Expense", debitRule: "Increase", creditRule: "Decrease" },
    ];

    if (APPLY) {
      for (const d of defaults) {
        await prisma.chartOfAccount.create({
          data: {
            organizationId,
            code: d.code,
            accountName: d.name,
            category: d.category,
            type: d.type,
            debitRule: d.debitRule,
            creditRule: d.creditRule,
          },
        });
      }
      accounts = await prisma.chartOfAccount.findMany({
        where: { organizationId },
        select: {
          id: true,
          code: true,
          accountName: true,
          category: true,
        },
      });
    }
  }

  return accounts;
}

async function main() {
  console.log(`\n=== Payment Journal Entry Backfill ===`);
  console.log(`Mode: ${APPLY ? "APPLY (writing changes)" : "DRY-RUN (preview only)"}\n`);

  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true },
  });

  let totalMissing = 0;
  let totalCreated = 0;

  for (const org of orgs) {
    const orgId = org.id;
    console.log(`Checking Organization: "${org.name}" (ID: ${orgId})`);

    const accounts = await ensureDefaultAccounts(orgId);
    if (accounts.length === 0 && !APPLY) {
      console.log(`  (No accounts found; will be seeded during --apply)`);
    }

    const payments = await prisma.payment.findMany({
      where: { organizationId: orgId },
      orderBy: { id: "asc" },
    });

    const journalEntries = await prisma.journalEntry.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        entryNumber: true,
        reference: true,
        totalDebit: true,
      },
    });

    const jeByRef = new Map<string, typeof journalEntries>();
    for (const je of journalEntries) {
      const key = (je.reference ?? "").trim();
      if (!key) continue;
      const list = jeByRef.get(key) ?? [];
      list.push(je);
      jeByRef.set(key, list);
    }

    // Identify payments missing journal entries
    const missingPayments = payments.filter((payment) => {
      const hasUnique =
        jeByRef.has(`Payment-${payment.id}`) || jeByRef.has(`PAY-${payment.id}`);
      if (hasUnique) return false;

      const bankRef = (payment.reference ?? "").trim();
      if (bankRef) {
        const matches = jeByRef.get(bankRef);
        if (matches && matches.length > 0) {
          const match = matches.find(
            (je) => Math.abs(Number(je.totalDebit) - Number(payment.amount)) < 0.009
          );
          if (match) return false;
        }
      }
      return true;
    });

    console.log(
      `  Total Payments: ${payments.length} | Missing Journal Entries: ${missingPayments.length}`
    );
    totalMissing += missingPayments.length;

    if (missingPayments.length === 0) continue;

    // Get max JE number for this org
    let maxSeq = 1;
    for (const je of journalEntries) {
      const m = /\d+/.exec(je.entryNumber);
      if (m) {
        const n = parseInt(m[0], 10);
        if (n >= maxSeq) maxSeq = n + 1;
      }
    }
    let seq = maxSeq;

    const BATCH_SIZE = 4;
    for (let i = 0; i < missingPayments.length; i += BATCH_SIZE) {
      const batch = missingPayments.slice(i, i + BATCH_SIZE);

      if (APPLY) {
        await Promise.all(
          batch.map(async (payment) => {
            const currentSeq = seq++;
            const entryNumber = `JE-${String(currentSeq).padStart(4, "0")}`;
            const amount = Number(payment.amount);
            const paymentKey = `Payment-${payment.id}`;
            const userRef = payment.reference ? ` (Ref: ${payment.reference})` : "";

            let debitAccount: ChartAccount | undefined;
            let creditAccount: ChartAccount | undefined;

            const cashOrBank = findCashOrBankAccount(accounts, payment.mode);

            const isCustomerPayment =
              payment.fromCustomerId != null ||
              payment.category === "Customer Payment" ||
              payment.fromPartyType === "CUSTOMER" ||
              payment.transactionType === "INCOME";

            const isVendorPayment =
              payment.toVendorId != null ||
              payment.category === "Vendor Payment" ||
              payment.toPartyType === "VENDOR";

            if (isCustomerPayment) {
              debitAccount = cashOrBank;
              creditAccount =
                accounts.find((a) => a.accountName === "Accounts Receivable" || a.code === "1030") ||
                accounts.find((a) => a.category === "Asset" && a.id !== cashOrBank?.id) ||
                findCategoryAccount(accounts, payment.category, "Revenue");
            } else if (isVendorPayment) {
              debitAccount =
                accounts.find((a) => a.accountName === "Accounts Payable" || a.code === "2010") ||
                accounts.find((a) => a.category === "Liability") ||
                findCategoryAccount(accounts, payment.category, "Expense");
              creditAccount = cashOrBank;
            } else if (payment.transactionType === "EXPENSE") {
              debitAccount =
                findCategoryAccount(accounts, payment.category, "Expense") ||
                accounts.find((a) => a.category === "Expense");
              creditAccount = cashOrBank;
            } else if (payment.transactionType === "TRANSFER") {
              debitAccount = accounts.find((a) => a.category === "Asset" && a.id !== cashOrBank?.id) || cashOrBank;
              creditAccount = cashOrBank;
            } else {
              debitAccount = accounts.find((a) => a.category === "Expense");
              creditAccount = cashOrBank;
            }

            if (!debitAccount || !creditAccount) {
              debitAccount = accounts[0] || { id: 1, code: "1000", accountName: "General Ledger", category: "Expense" };
              creditAccount = accounts[1] || accounts[0] || { id: 2, code: "1010", accountName: "Cash in Hand", category: "Asset" };
            }

            await prisma.journalEntry.create({
              data: {
                organizationId: orgId,
                entryNumber,
                date: new Date(payment.date),
                description: `Payment: ${payment.category || "General"} - ${payment.description || "No description"}${userRef}`,
                reference: paymentKey,
                totalDebit: amount,
                totalCredit: amount,
                isPosted: true,
                postedAt: new Date(payment.date),
                lines: {
                  create: [
                    {
                      organizationId: orgId,
                      accountId: debitAccount!.id,
                      debitAmount: amount,
                      creditAmount: 0,
                      description: `Debit: ${payment.category || "General"}`,
                      reference: paymentKey,
                    },
                    {
                      organizationId: orgId,
                      accountId: creditAccount!.id,
                      debitAmount: 0,
                      creditAmount: amount,
                      description: `Credit: ${payment.category || "General"}`,
                      reference: paymentKey,
                    },
                  ],
                },
              },
            });
          })
        );

        totalCreated += batch.length;
        if (totalCreated % 100 === 0 || totalCreated >= missingPayments.length) {
          console.log(`    Progress: ${totalCreated}/${missingPayments.length} journal entries created...`);
        }
      } else {
        for (const payment of batch) {
          const entryNumber = `JE-${String(seq++).padStart(4, "0")}`;
          console.log(`    [#${payment.id}] ${payment.transactionType} | ${payment.category || "N/A"} | PKR ${Number(payment.amount)} | ${entryNumber}`);
        }
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total Missing Found: ${totalMissing}`);
  if (APPLY) {
    console.log(`Total Backfilled: ${totalCreated} Journal Entries created successfully!`);
  } else {
    console.log(`Dry-run complete. Run with --apply to write changes.`);
  }
}

main()
  .catch((e) => {
    console.error("Backfill failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
