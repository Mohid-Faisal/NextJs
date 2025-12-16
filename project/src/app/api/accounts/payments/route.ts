import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// UI-to-enum mapping
const typeMap: Record<string, any> = { Income: "INCOME", Expense: "EXPENSE", Transfer: "TRANSFER", Adjustment: "ADJUSTMENT", Equity: "EQUITY" };
const modeMap: Record<string, any> = { "Cash": "CASH", "Bank Transfer": "BANK_TRANSFER", "Card": "CARD", "Cheque": "CHEQUE" };

export async function GET(request: Request) {
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

  const where: any = {};
  if (type !== "All") where.transactionType = typeMap[type] ?? type;
  if (mode !== "All") where.mode = modeMap[mode] ?? mode;
  if (search) {
    const searchNumber = Number(searchRaw);
    const isNumericSearch = !isNaN(searchNumber);

    const orConditions: any[] = [
      // Category
      { category: { contains: search, mode: "insensitive" } },
      // From / To account names shown in table (customer/vendor or "Us")
      { fromCustomer: { contains: search, mode: "insensitive" } },
      { toVendor: { contains: search, mode: "insensitive" } },
      // Reference / Invoice / Description
      { reference: { contains: search, mode: "insensitive" } },
      { invoice: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];

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

    // Find related journal entries for each payment
    const paymentsWithJournalEntries = await Promise.all(
      payments.map(async (payment) => {
        const journalEntry = await prisma.journalEntry.findFirst({
          where: {
            reference: payment.reference || `Payment-${payment.id}`
          },
          select: {
            entryNumber: true
          }
        });
        
        return {
          ...payment,
          journalEntry
        };
      })
    );

    payments = paymentsWithJournalEntries;
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

      // Find related journal entries for fallback case too
      const paymentsWithJournalEntries = await Promise.all(
        payments.map(async (payment) => {
          const journalEntry = await prisma.journalEntry.findFirst({
            where: {
              reference: payment.reference || `Payment-${payment.id}`
            },
            select: {
              entryNumber: true
            }
          });
          
          return {
            ...payment,
            journalEntry
          };
        })
      );

      payments = paymentsWithJournalEntries;
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

  return NextResponse.json({ payments: ui, total });
}

export async function POST(req: NextRequest) {
  try {
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
      reference: body.reference || null,
      invoice: body.invoice || null,
      description: body.description || null,
      fromCustomer: "Us",
      toVendor: "Us",
    };

    // All internal transactions - no external party relationships

    try {
      const payment = await prisma.payment.create({ data });
      
      // Create journal entry for the payment
      await createJournalEntryForPayment(payment, body);
      
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
        reference: body.reference || null,
        invoice: body.invoice || null,
        description: body.description || null,
        fromCustomer: "Us",
        toVendor: "Us",
      };

      const payment = await prisma.payment.create({ data: fallbackData });
      
      // Create journal entry for the fallback payment
      await createJournalEntryForPayment(payment, body);
      
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

async function createJournalEntryForPayment(payment: any, body: any) {
  try {
    // Generate journal entry number
    const lastEntry = await prisma.journalEntry.findFirst({
      orderBy: { entryNumber: "desc" }
    });

    let entryNumber = "JE-0001";
    if (lastEntry) {
      const lastNumber = parseInt(lastEntry.entryNumber.split("-")[1]);
      entryNumber = `JE-${String(lastNumber + 1).padStart(4, "0")}`;
    }

    // Create journal entry with lines
    const journalEntry = await prisma.$transaction(async (tx) => {
      // Create the journal entry
      const entry = await tx.journalEntry.create({
        data: {
          entryNumber,
          date: new Date(body.date),
          description: `Payment: ${body.category} - ${body.description || 'No description'}`,
          reference: body.reference || `Payment-${payment.id}`,
          totalDebit: Number(body.amount),
          totalCredit: Number(body.amount),
          isPosted: true, // Auto-post payment journal entries
          postedAt: new Date()
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
            reference: body.reference || `Payment-${payment.id}`
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
            reference: body.reference || `Payment-${payment.id}`
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


