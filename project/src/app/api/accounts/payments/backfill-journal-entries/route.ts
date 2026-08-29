import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/requirePermission";
import { orgWhere } from "@/lib/tenant/prismaScope";

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

  let acc = accounts.find(
    (a) => a.category === prismaCategory && a.accountName.toLowerCase() === lower
  );
  if (acc) return acc;

  acc = accounts.find(
    (a) =>
      a.category === prismaCategory &&
      a.accountName.toLowerCase().includes(lower)
  );
  if (acc) return acc;

  acc = accounts.find(
    (a) =>
      a.category === prismaCategory &&
      lower.includes(a.accountName.toLowerCase())
  );
  if (acc) return acc;

  return accounts.find((a) => a.category === prismaCategory);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "manage_billing");
    if (auth.error) return auth.error;
    const session = auth.session;
    const organizationId = session.organizationId;

    const accounts = await prisma.chartOfAccount.findMany({
      where: orgWhere(session),
      select: {
        id: true,
        code: true,
        accountName: true,
        category: true,
      },
    });

    const payments = await prisma.payment.findMany({
      where: orgWhere(session),
      orderBy: { id: "asc" },
    });

    const journalEntries = await prisma.journalEntry.findMany({
      where: orgWhere(session),
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

    if (missingPayments.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All transactions already have linked journal entries.",
        backfilledCount: 0,
      });
    }

    let maxSeq = 1;
    for (const je of journalEntries) {
      const m = /\d+/.exec(je.entryNumber);
      if (m) {
        const n = parseInt(m[0], 10);
        if (n >= maxSeq) maxSeq = n + 1;
      }
    }
    let seq = maxSeq;

    let createdCount = 0;
    const BATCH_SIZE = 4;

    for (let i = 0; i < missingPayments.length; i += BATCH_SIZE) {
      const batch = missingPayments.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (payment) => {
          const entryNumber = `JE-${String(seq++).padStart(4, "0")}`;
          const amount = Number(payment.amount);
          const paymentKey = `Payment-${payment.id}`;
          const userRef = payment.reference ? ` (Ref: ${payment.reference})` : "";

          let debitAccount: ChartAccount | undefined;
          let creditAccount: ChartAccount | undefined;

          const cashOrBank = findCashOrBankAccount(accounts, payment.mode);

          if (payment.transactionType === "EXPENSE") {
            debitAccount =
              findCategoryAccount(accounts, payment.category, "Expense") ||
              accounts.find((a) => a.category === "Expense");
            creditAccount = cashOrBank;
          } else if (payment.transactionType === "INCOME") {
            debitAccount = cashOrBank;
            creditAccount =
              findCategoryAccount(accounts, payment.category, "Revenue") ||
              accounts.find((a) => a.category === "Revenue");
          } else if (payment.transactionType === "TRANSFER") {
            debitAccount = accounts.find((a) => a.category === "Asset");
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
              organizationId,
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
                    organizationId,
                    accountId: debitAccount!.id,
                    debitAmount: amount,
                    creditAmount: 0,
                    description: `Debit: ${payment.category || "General"}`,
                    reference: paymentKey,
                  },
                  {
                    organizationId,
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

      createdCount += batch.length;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully backfilled ${createdCount} missing journal entries.`,
      backfilledCount: createdCount,
    });
  } catch (error: any) {
    console.error("Backfill journal entries error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to backfill journal entries." },
      { status: 500 }
    );
  }
}
