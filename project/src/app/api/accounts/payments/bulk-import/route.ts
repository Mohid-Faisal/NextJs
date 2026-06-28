import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { parse, isValid } from "date-fns";
import { enUS } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgData, orgWhere } from "@/lib/tenant/prismaScope";
import { nextJournalEntryNumber } from "@/lib/tenant/orgJournalChart";

export const runtime = "nodejs";

// UI label / Excel value -> Prisma enum
const TYPE_MAP: Record<string, string> = {
  income: "INCOME",
  incomes: "INCOME",
  expense: "EXPENSE",
  expenses: "EXPENSE",
  expence: "EXPENSE",
  expences: "EXPENSE",
  transfer: "TRANSFER",
  transfers: "TRANSFER",
  adjustment: "ADJUSTMENT",
  equity: "EQUITY",
};

const MODE_MAP: Record<string, string> = {
  cash: "CASH",
  "bank transfer": "BANK_TRANSFER",
  bank: "BANK_TRANSFER",
  banktransfer: "BANK_TRANSFER",
  card: "CARD",
  "credit card": "CARD",
  cheque: "CHEQUE",
  check: "CHEQUE",
};

type ChartAccount = {
  id: number;
  accountName: string;
  category: string;
};

function normalizeKey(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ");
}

function getField(
  row: Record<string, unknown>,
  candidates: string[]
): unknown {
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    map.set(normalizeKey(String(k)), v);
  }
  for (const c of candidates) {
    const v = map.get(normalizeKey(c));
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
}

function parseFlexibleDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === "number" && !Number.isNaN(value)) {
    const utcDays = Math.floor(value - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof value === "string") {
    const s = value.trim();
    const fmts = [
      "dd-MMM-yyyy",
      "d-MMM-yyyy",
      "dd-MMM-yy",
      "d-MMM-yy",
      "dd/MM/yyyy",
      "d/M/yyyy",
      "yyyy-MM-dd",
      "MM/dd/yyyy",
      "dd-MM-yyyy",
    ];
    for (const f of fmts) {
      const useLocale = f.includes("MMM") ? { locale: enUS } : undefined;
      const d = parse(s, f, new Date(), useLocale);
      if (isValid(d)) return d;
    }
    const fallback = new Date(s);
    if (!isNaN(fallback.getTime())) return fallback;
  }
  return null;
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[, ]/g, "").trim();
    const n = parseFloat(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function findCashOrBankAccount(
  accounts: ChartAccount[],
  paymentMethod: string
): ChartAccount | undefined {
  const isCash = paymentMethod === "CASH";
  if (isCash) {
    return (
      accounts.find(
        (a) =>
          a.accountName.toLowerCase().includes("cash") &&
          a.category === "Asset"
      ) || accounts.find((a) => a.accountName.toLowerCase().includes("cash"))
    );
  }
  const matches = ["bank", "current account", "checking", "savings"];
  for (const needle of matches) {
    const m = accounts.find(
      (a) =>
        a.accountName.toLowerCase().includes(needle) && a.category === "Asset"
    );
    if (m) return m;
  }
  for (const needle of matches) {
    const m = accounts.find((a) =>
      a.accountName.toLowerCase().includes(needle)
    );
    if (m) return m;
  }
  return undefined;
}

function findCategoryAccount(
  accounts: ChartAccount[],
  categoryName: string,
  prismaCategory: "Expense" | "Revenue"
): ChartAccount | undefined {
  const lower = categoryName.toLowerCase();
  // Exact (case-insensitive)
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
  // Category includes account name (handles e.g. "Packaging" matching "Packaging Material")
  acc = accounts.find(
    (a) =>
      a.category === prismaCategory &&
      lower.includes(a.accountName.toLowerCase())
  );
  return acc;
}

function resolveAccounts(
  accounts: ChartAccount[],
  transactionType: string,
  category: string,
  paymentMethod: string
): { debitAccountId: number; creditAccountId: number } | null {
  if (transactionType === "EXPENSE") {
    const expense = findCategoryAccount(accounts, category, "Expense");
    const cash = findCashOrBankAccount(accounts, paymentMethod);
    if (!expense || !cash) return null;
    return { debitAccountId: expense.id, creditAccountId: cash.id };
  }
  if (transactionType === "INCOME") {
    const revenue = findCategoryAccount(accounts, category, "Revenue");
    const cash = findCashOrBankAccount(accounts, paymentMethod);
    if (!revenue || !cash) return null;
    return { debitAccountId: cash.id, creditAccountId: revenue.id };
  }
  return null;
}

async function getNextJournalEntrySeq(): Promise<number> {
  // Pull the largest numeric suffix found in JournalEntry.entryNumber
  // and return seq = max + 1. Handles both "JE-0001" and "JE-<timestamp>" styles.
  try {
    const rows = await prisma.$queryRaw<{ max: bigint | null }[]>`
      SELECT MAX(
        CAST(
          NULLIF(REGEXP_REPLACE("entryNumber", '[^0-9]', '', 'g'), '') AS BIGINT
        )
      )::bigint AS max
      FROM "JournalEntry"
    `;
    const maxVal = rows?.[0]?.max;
    if (maxVal !== null && maxVal !== undefined) {
      return Number(maxVal) + 1;
    }
  } catch {
    // fall through
  }
  return 1;
}

type ParsedRow = {
  transactionType: string;
  category: string;
  date: Date;
  amount: number;
  paymentMethod: string;
  reference: string;
  description: string;
  excelRow: number;
};

function parseRow(
  row: Record<string, unknown>,
  excelRow: number
): ParsedRow | { error: string } {
  const typeRaw = getField(row, [
    "transaction type",
    "type",
    "txn type",
  ]);
  const categoryRaw = getField(row, ["category", "cat"]);
  const dateRaw = getField(row, ["date", "transaction date"]);
  const amountRaw = getField(row, ["amount", "value"]);
  const methodRaw = getField(row, [
    "payment method",
    "method",
    "mode",
  ]);
  const refRaw = getField(row, ["reference", "ref", "ref."]);
  const descRaw = getField(row, ["description", "desc", "note", "notes"]);

  const allEmpty =
    [typeRaw, categoryRaw, dateRaw, amountRaw, methodRaw, refRaw, descRaw].every(
      (v) => v === undefined || v === null || v === ""
    );
  if (allEmpty) return { error: "empty" };

  const typeStr = typeRaw !== undefined ? String(typeRaw).trim() : "";
  const transactionType = TYPE_MAP[typeStr.toLowerCase()];
  if (!transactionType) {
    return { error: `Unknown transaction type "${typeStr}"` };
  }
  if (transactionType !== "EXPENSE" && transactionType !== "INCOME") {
    return {
      error: `Only Income and Expense imports are supported (got "${typeStr}")`,
    };
  }

  const category = categoryRaw !== undefined ? String(categoryRaw).trim() : "";
  if (!category) return { error: "Missing category" };

  const date = parseFlexibleDate(dateRaw);
  if (!date) return { error: "Invalid or missing date" };

  const amount = parseAmount(amountRaw);
  if (amount === null || amount <= 0) {
    return { error: "Invalid or missing amount" };
  }

  const methodStr =
    methodRaw !== undefined ? String(methodRaw).trim() : "Cash";
  const paymentMethod = MODE_MAP[methodStr.toLowerCase()] || null;
  if (!paymentMethod) {
    return { error: `Unknown payment method "${methodStr}"` };
  }

  const reference = refRaw !== undefined ? String(refRaw).trim() : "";
  const description = descRaw !== undefined ? String(descRaw).trim() : "";

  return {
    transactionType,
    category,
    date,
    amount,
    paymentMethod,
    reference,
    description,
    excelRow,
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "Excel file is required" },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { error: "Workbook has no sheets" },
        { status: 400 }
      );
    }
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });

    const accountRows = await prisma.chartOfAccount.findMany({
      where: orgWhere(session, { isActive: true }),
    });
    const accounts: ChartAccount[] = accountRows.map((a) => ({
      id: a.id,
      accountName: a.accountName,
      category: a.category,
    }));

    let nextSeq = Number(
      (await nextJournalEntryNumber(prisma, session.organizationId)).split("-")[1]
    );

    const results: {
      row: number;
      success: boolean;
      message?: string;
      amount?: number;
      category?: string;
      type?: string;
      journalEntry?: string;
    }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const excelRow = i + 2;
      const parsed = parseRow(rows[i], excelRow);
      if ("error" in parsed) {
        if (parsed.error === "empty") continue;
        results.push({
          row: excelRow,
          success: false,
          message: parsed.error,
        });
        continue;
      }

      const accountIds = resolveAccounts(
        accounts,
        parsed.transactionType,
        parsed.category,
        parsed.paymentMethod
      );
      if (!accountIds) {
        results.push({
          row: excelRow,
          success: false,
          message: `Could not resolve chart of accounts for category "${parsed.category}" (payment method ${parsed.paymentMethod}). Make sure that account exists in your Chart of Accounts.`,
        });
        continue;
      }

      // Try to insert with retry-on-collision for the JE entryNumber
      let attempt = 0;
      let inserted = false;
      let lastError = "";
      while (attempt < 5 && !inserted) {
        const seq = nextSeq + attempt;
        const entryNumber = `JE-${String(seq).padStart(4, "0")}`;
        try {
          await prisma.$transaction(
            async (tx) => {
              const payment = await tx.payment.create({
                data: orgData(session, {
                  transactionType: parsed.transactionType as any,
                  category: parsed.category,
                  date: parsed.date,
                  amount: parsed.amount,
                  fromPartyType: "US",
                  toPartyType: "US",
                  mode: parsed.paymentMethod as any,
                  reference: parsed.reference || null,
                  invoice: null,
                  description: parsed.description || null,
                  fromCustomer: "Us",
                  toVendor: "Us",
                }),
              });

              const entry = await tx.journalEntry.create({
                data: {
                  organizationId: session.organizationId,
                  entryNumber,
                  date: parsed.date,
                  description: `Payment: ${parsed.category} - ${
                    parsed.description || "No description"
                  }`,
                  reference: parsed.reference || `Payment-${payment.id}`,
                  totalDebit: parsed.amount,
                  totalCredit: parsed.amount,
                  isPosted: true,
                  postedAt: parsed.date,
                },
              });

              await tx.journalEntryLine.createMany({
                data: [
                  {
                    journalEntryId: entry.id,
                    accountId: accountIds.debitAccountId,
                    debitAmount: parsed.amount,
                    creditAmount: 0,
                    description: `Debit: ${parsed.category}`,
                    reference: parsed.reference || `Payment-${payment.id}`,
                  },
                  {
                    journalEntryId: entry.id,
                    accountId: accountIds.creditAccountId,
                    debitAmount: 0,
                    creditAmount: parsed.amount,
                    description: `Credit: ${parsed.category}`,
                    reference: parsed.reference || `Payment-${payment.id}`,
                  },
                ],
              });
            },
            { timeout: 30_000, maxWait: 15_000 }
          );

          inserted = true;
          nextSeq = seq + 1;
          results.push({
            row: excelRow,
            success: true,
            amount: parsed.amount,
            category: parsed.category,
            type: parsed.transactionType,
            journalEntry: entryNumber,
          });
        } catch (e: any) {
          lastError = e?.message || "Unknown error";
          // P2002 = unique constraint failure. Retry with next seq.
          if (e?.code === "P2002") {
            attempt++;
            continue;
          }
          break;
        }
      }

      if (!inserted) {
        results.push({
          row: excelRow,
          success: false,
          message: lastError || "Failed to insert payment",
        });
      }
    }

    const imported = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      summary: {
        processed: results.length,
        imported,
        failed,
      },
      results,
    });
  } catch (error) {
    console.error("payments bulk-import error:", error);
    return NextResponse.json(
      { error: "Failed to import payments" },
      { status: 500 }
    );
  }
}
