import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgData, orgWhere } from "@/lib/tenant/prismaScope";

// UI-to-enum mapping
const typeMap: Record<string, any> = { Income: "INCOME", Expense: "EXPENSE", Transfer: "TRANSFER", Adjustment: "ADJUSTMENT", Equity: "EQUITY", Return: "ADJUSTMENT" };
const modeMap: Record<string, any> = { "Cash": "CASH", "Bank Transfer": "BANK_TRANSFER", "Card": "CARD", "Cheque": "CHEQUE" };

type PaymentJournalEntry = { entryNumber: string; reference: string | null; totalDebit: number; date: Date };

/**
 * Resolve JE for each payment.
 * Prefer Payment-{id}/PAY-{id} (current format); fall back to legacy bank-ref JE.reference.
 */
async function attachJournalEntriesToPayments(
  session: { organizationId: number },
  payments: any[]
) {
  if (payments.length === 0) return payments;

  const paymentKeys = payments.flatMap((p) => [`Payment-${p.id}`, `PAY-${p.id}`]);
  const bankRefs = [
    ...new Set(
      payments
        .map((p) => (p.reference ?? "").trim())
        .filter((ref: string) => ref.length > 0 && !ref.startsWith("Payment-") && !ref.startsWith("PAY-"))
    ),
  ];

  const journalEntries = await prisma.journalEntry.findMany({
    where: orgWhere(session, {
      OR: [
        { reference: { in: paymentKeys } },
        ...(bankRefs.length > 0 ? [{ reference: { in: bankRefs } }] : []),
      ],
    }),
    select: {
      entryNumber: true,
      reference: true,
      totalDebit: true,
      date: true,
    },
  });

  const byRef = new Map<string, PaymentJournalEntry[]>();
  for (const je of journalEntries) {
    const key = (je.reference ?? "").trim();
    if (!key) continue;
    const list = byRef.get(key) ?? [];
    list.push(je);
    byRef.set(key, list);
  }

  const pickByAmount = (candidates: PaymentJournalEntry[], amount: number) => {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    return (
      candidates.find((je) => Math.abs(Number(je.totalDebit) - Number(amount)) < 0.009) ??
      candidates[0]
    );
  };

  return payments.map((payment) => {
    const unique =
      byRef.get(`Payment-${payment.id}`)?.[0] ??
      byRef.get(`PAY-${payment.id}`)?.[0] ??
      null;
    if (unique) {
      return { ...payment, journalEntry: unique };
    }

    const bankRef = (payment.reference ?? "").trim();
    if (!bankRef) {
      return { ...payment, journalEntry: null };
    }

    return {
      ...payment,
      journalEntry: pickByAmount(byRef.get(bankRef) ?? [], payment.amount),
    };
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (auth.error) return auth.error;
  const session = auth.session;

  const url = new URL(request.url);

  const page = Number(url.searchParams.get("page") || 1);
  const limitParam = url.searchParams.get("limit") || "10";
  const limit = limitParam === "all" ? undefined : Number(limitParam);
  const type = url.searchParams.get("type") || "All";
  const mode = url.searchParams.get("mode") || "All";
  const searchRaw = url.searchParams.get("search") || "";
  const search = searchRaw.toLowerCase();
  const fromDate = url.searchParams.get("fromDate");
  const toDate = url.searchParams.get("toDate");
  const sortField = (url.searchParams.get("sortField") || "date").toString();
  const sortOrder = (url.searchParams.get("sortOrder") || "desc").toLowerCase() as "asc" | "desc";
  const validSortFields = ["id", "date", "amount", "category", "mode", "reference", "invoice"];
  const finalSortField = validSortFields.includes(sortField) ? sortField : "date";

  const where: any = { ...orgWhere(session) };
  if (type !== "All") where.transactionType = typeMap[type] ?? type;
  if (mode !== "All") where.mode = modeMap[mode] ?? mode;
  if (search) {
    const searchNumber = Number(searchRaw);
    const isNumericSearch = !isNaN(searchNumber);

    const orConditions: any[] = [
      // Category
      { category: { contains: search } },
      // From / To account names shown in table (customer/vendor or "Us")
      { fromCustomer: { contains: search } },
      { toVendor: { contains: search } },
      // Reference / Invoice / Description
      { reference: { contains: search } },
      { invoice: { contains: search } },
      { description: { contains: search } },
    ];

    if (searchRaw && searchRaw !== search) {
      orConditions.push(
        { category: { contains: searchRaw } },
        { fromCustomer: { contains: searchRaw } },
        { toVendor: { contains: searchRaw } },
        { reference: { contains: searchRaw } },
        { invoice: { contains: searchRaw } },
        { description: { contains: searchRaw } },
      );
    }

    // Map textual search to transactionType enum (Income, Expense, etc.)
    const typeSearchKey = Object.keys(typeMap).find((key) =>
      key.toLowerCase().includes(search)
    );
    if (typeSearchKey) {
      orConditions.push({ transactionType: typeMap[typeSearchKey] });
    }

    // Map textual search to mode enum (Cash, Bank Transfer, Card, Cheque)
    const modeSearchKey = Object.keys(modeMap).find((key) =>
      key.toLowerCase().includes(search)
    );
    if (modeSearchKey) {
      orConditions.push({ mode: modeMap[modeSearchKey] });
    }

    // Numeric search should also match ID and Amount exactly
    if (isNumericSearch) {
      orConditions.push(
        { id: searchNumber },
        { amount: searchNumber },
      );
    }

    where.OR = orConditions;
  }

  // Add date range filtering
  if (fromDate || toDate) {
    where.date = {};
    if (fromDate) {
      where.date.gte = new Date(fromDate);
    }
    if (toDate) {
      where.date.lte = new Date(toDate);
    }
  }

  const db: any = prisma;
  let total = 0;
  let payments: any[] = [];
  try {
    total = await db.payment.count({ where });
    payments = await db.payment.findMany({
      where,
      orderBy: { [finalSortField]: sortOrder },
      skip: limit ? (page - 1) * limit : 0,
      take: limit ?? undefined,
    });

    payments = await attachJournalEntriesToPayments(session, payments);
  } catch (err) {
    // Fallback if relations not present; select scalar fields
    try {
      total = await db.payment.count({ where });
      payments = await db.payment.findMany({
        where,
        orderBy: { [finalSortField]: sortOrder },
        skip: limit ? (page - 1) * limit : 0,
        take: limit ?? undefined,
        select: {
          id: true,
          transactionType: true,
          category: true,
          date: true,
          amount: true,
          fromCustomer: true,
          toVendor: true,
          mode: true,
          reference: true,
          invoice: true,
          description: true,
        },
      });

      payments = await attachJournalEntriesToPayments(session, payments);
    } catch (e) {
      return NextResponse.json({ payments: [], total: 0 });
    }
  }

  const ui = payments.map((p: any) => ({
    id: p.id,
    transactionType: p.transactionType,
    category: p.category,
    date: (p.date instanceof Date ? p.date : new Date(p.date)).toISOString(),
    amount: p.amount,
    fromAccount: p.fromCustomer?.CompanyName ?? p.fromCustomer ?? (p.fromPartyType === "US" ? "Us" : ""),
    toAccount: p.toVendor?.CompanyName ?? p.toVendor ?? (p.toPartyType === "US" ? "Us" : ""),
    mode: p.mode,
    reference: p.reference ?? undefined,
    invoice: p.invoice ?? undefined,
    description: p.description ?? undefined,
    journalEntryNumber: p.journalEntry?.entryNumber ?? undefined,
  }));

  // Get total amount sum
  const sumResult = await prisma.payment.aggregate({
    where,
    _sum: {
      amount: true,
    },
  });
  const totalAmount = sumResult._sum.amount ?? 0;

  // Compute counts for all tabs based on active search and date filters
  const countWhere = { ...where };
  delete countWhere.transactionType;

  const [incomeCount, expenseCount, transferCount, adjustmentCount, totalCount] = await Promise.all([
    prisma.payment.count({ where: { ...countWhere, transactionType: "INCOME" } }),
    prisma.payment.count({ where: { ...countWhere, transactionType: "EXPENSE" } }),
    prisma.payment.count({ where: { ...countWhere, transactionType: "TRANSFER" } }),
    prisma.payment.count({ where: { ...countWhere, transactionType: "ADJUSTMENT" } }),
    prisma.payment.count({ where: countWhere }),
  ]);

  return NextResponse.json({
    payments: ui,
    total,
    totalAmount,
    counts: {
      total: totalCount,
      income: incomeCount,
      expense: expenseCount,
      transfer: transferCount,
      return: adjustmentCount,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    if (session.email === "demo@psswe.com") {
      const demoCount = await prisma.payment.count({
        where: { organizationId: session.organizationId },
      });
      if (demoCount >= 15) {
        return NextResponse.json(
          { success: false, message: "Demo transaction limit reached (max 15). Please start a 14-Day Free Trial for unlimited transactions!" },
          { status: 403 }
        );
      }
    }

    const body = await req.json();

    // Basic validation
    const required = ["transactionType", "category", "date", "amount"];
    for (const key of required) {
      if (body[key] === undefined || body[key] === null || String(body[key]).trim() === "") {
        return NextResponse.json(
          { success: false, message: `${key} is required.` },
          { status: 400 }
        );
      }
    }

    // Validate chart of accounts
    if (!body.debitAccountId || !body.creditAccountId) {
      return NextResponse.json(
        { success: false, message: "Both debit and credit accounts are required." },
        { status: 400 }
      );
    }

    // Validate accounts are different
    if (body.debitAccountId === body.creditAccountId) {
      return NextResponse.json(
        { success: false, message: "Debit and credit accounts must be different." },
        { status: 400 }
      );
    }

    // Party validation - all internal transactions
    const fromPartyType = "US";
    const toPartyType = "US";

    const data: any = {
      transactionType: typeMap[body.transactionType] ?? body.transactionType,
      category: body.category,
      date: new Date(body.date),
      amount: Number(body.amount),
      fromPartyType: fromPartyType,
      toPartyType: toPartyType,
      mode: body.paymentMethod ? (modeMap[body.paymentMethod] ?? body.paymentMethod) : null,
      reference: body.reference && typeof body.reference === "string" && body.reference.trim() !== "" ? body.reference.trim() : null,
      invoice: body.invoice || null,
      description: body.description || null,
      fromCustomer: "Us",
      toVendor: "Us",
    };

    // Enforce unique reference number per organization if reference is provided
    if (data.reference && typeof data.reference === "string" && data.reference.trim() !== "") {
      const trimmedRef = data.reference.trim();
      const existingRef = await prisma.payment.findFirst({
        where: orgWhere(session, {
          reference: trimmedRef,
        }),
      });

      if (existingRef) {
        return NextResponse.json(
          {
            success: false,
            message: `A transaction with reference "${trimmedRef}" already exists (Transaction #${existingRef.id}). Reference number must be unique.`,
          },
          { status: 400 }
        );
      }
    }

    // Deduplication check: if identical payment created in last 10 seconds, return existing payment
    const tenSecondsAgo = new Date(Date.now() - 10000);
    const existingDuplicate = await prisma.payment.findFirst({
      where: orgWhere(session, {
        transactionType: data.transactionType,
        category: data.category,
        amount: data.amount,
        reference: data.reference,
        description: data.description,
        createdAt: { gte: tenSecondsAgo }
      })
    });

    if (existingDuplicate) {
      console.log(`[POST /api/accounts/payments] Deduplication triggered: returning existing payment ID ${existingDuplicate.id}`);
      return NextResponse.json({ success: true, message: "Payment added successfully.", payment: existingDuplicate });
    }

    try {
      const payment = await prisma.payment.create({ data: orgData(session, data) });
      
      // Create journal entry for the payment
      await createJournalEntryForPayment(payment, body, session.organizationId);
      
      return NextResponse.json({ success: true, message: "Payment added successfully.", payment });
    } catch (e) {
      // Fallback: some databases may still have scalar columns instead of relations
      // All internal transactions
      const fallbackData: any = {
        transactionType: typeMap[body.transactionType] ?? body.transactionType,
        category: body.category,
        date: new Date(body.date),
        amount: Number(body.amount),
        fromPartyType: fromPartyType,
        toPartyType: toPartyType,
        mode: body.paymentMethod ? (modeMap[body.paymentMethod] ?? body.paymentMethod) : null,
        reference: body.reference && typeof body.reference === "string" && body.reference.trim() !== "" ? body.reference.trim() : null,
        invoice: body.invoice || null,
        description: body.description || null,
        fromCustomer: "Us",
        toVendor: "Us",
      };

      const payment = await prisma.payment.create({ data: orgData(session, fallbackData) });
      
      // Create journal entry for the fallback payment
      await createJournalEntryForPayment(payment, body, session.organizationId);
      
      return NextResponse.json({ success: true, message: "Payment added successfully.", payment });
    }
  } catch (error) {
    console.error("Add payment error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to add payment." },
      { status: 500 }
    );
  }
}

async function createJournalEntryForPayment(payment: any, body: any, organizationId: number) {
  try {
    const lastEntry = await prisma.journalEntry.findFirst({
      where: { organizationId },
      orderBy: { entryNumber: "desc" }
    });

    let entryNumber = "JE-0001";
    if (lastEntry) {
      const lastNumber = parseInt(lastEntry.entryNumber.split("-")[1]);
      entryNumber = `JE-${String(lastNumber + 1).padStart(4, "0")}`;
    }

    const journalEntry = await prisma.$transaction(async (tx) => {
      const journalEntryDate = body.date 
        ? new Date(body.date) 
        : (payment.date ? new Date(payment.date) : new Date());
      
      // Always use Payment-{id} so delete can find this JE even when bank ref is shared (e.g. "Office")
      const paymentKey = `Payment-${payment.id}`;
      const userRef = body.reference ? ` (Ref: ${body.reference})` : "";
      const entry = await tx.journalEntry.create({
        data: {
          organizationId,
          entryNumber,
          date: journalEntryDate,
          description: `Payment: ${body.category} - ${body.description || 'No description'}${userRef}`,
          reference: paymentKey,
          totalDebit: Number(body.amount),
          totalCredit: Number(body.amount),
          isPosted: true, // Auto-post payment journal entries
          postedAt: journalEntryDate
        }
      });

      // Create the journal entry lines
      await Promise.all([
        // Debit line
        tx.journalEntryLine.create({
          data: {
            journalEntryId: entry.id,
            accountId: body.debitAccountId,
            debitAmount: Number(body.amount),
            creditAmount: 0,
            description: `Debit: ${body.category}`,
            reference: paymentKey
          }
        }),
        // Credit line
        tx.journalEntryLine.create({
          data: {
            journalEntryId: entry.id,
            accountId: body.creditAccountId,
            debitAmount: 0,
            creditAmount: Number(body.amount),
            description: `Credit: ${body.category}`,
            reference: paymentKey
          }
        })
      ]);

      return entry;
    });

    console.log(`Created journal entry ${journalEntry.entryNumber} for payment ${payment.id}`);
  } catch (error) {
    console.error("Error creating journal entry for payment:", error);
    throw error;
  }
}


