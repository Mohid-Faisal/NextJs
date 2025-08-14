import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addCompanyTransaction } from "@/lib/utils";

// UI-to-enum mapping
const typeMap: Record<string, any> = { Income: "INCOME", Expense: "EXPENSE", Transfer: "TRANSFER", Return: "RETURN" };
const modeMap: Record<string, any> = { "Cash": "CASH", "Bank Transfer": "BANK_TRANSFER", "Card": "CARD", "Cheque": "CHEQUE" };

export async function GET(request: Request) {
  const url = new URL(request.url);

  const page = Number(url.searchParams.get("page") || 1);
  const limitParam = url.searchParams.get("limit") || "10";
  const limit = limitParam === "all" ? undefined : Number(limitParam);
  const type = url.searchParams.get("type") || "All";
  const mode = url.searchParams.get("mode") || "All";
  const search = (url.searchParams.get("search") || "").toLowerCase();
  const sortField = (url.searchParams.get("sortField") || "date").toString();
  const sortOrder = (url.searchParams.get("sortOrder") || "desc").toLowerCase() as "asc" | "desc";
  const validSortFields = ["id", "date", "amount", "category", "currency", "mode", "reference", "dueDate"];
  const finalSortField = validSortFields.includes(sortField) ? sortField : "date";

  const where: any = {};
  if (type !== "All") where.transactionType = typeMap[type] ?? type;
  if (mode !== "All") where.mode = modeMap[mode] ?? mode;
  if (search) {
    where.OR = [
      { category: { contains: search, mode: "insensitive" } },
      { reference: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
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
      include: { fromCustomer: true, toVendor: true },
    });
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
          currency: true,
          amount: true,
          fromCustomer: true,
          toVendor: true,
          mode: true,
          reference: true,
          dueDate: true,
          description: true,
        },
      });
    } catch (e) {
      return NextResponse.json({ payments: [], total: 0 });
    }
  }

  const ui = payments.map((p: any) => ({
    id: p.id,
    transactionType: p.transactionType,
    category: p.category,
    date: (p.date instanceof Date ? p.date : new Date(p.date)).toISOString(),
    currency: p.currency,
    amount: p.amount,
    fromAccount: p.fromCustomer?.CompanyName ?? p.fromCustomer ?? (p.fromPartyType === "US" ? "Us" : ""),
    toAccount: p.toVendor?.CompanyName ?? p.toVendor ?? (p.toPartyType === "US" ? "Us" : ""),
    mode: p.mode,
    reference: p.reference ?? undefined,
    dueDate: p.dueDate ? (p.dueDate instanceof Date ? p.dueDate : new Date(p.dueDate)).toISOString() : null,
    description: p.description ?? undefined,
  }));

  return NextResponse.json({ payments: ui, total });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Basic validation similar to other routes
    const required = ["transactionType", "category", "date", "currency", "amount"];
    for (const key of required) {
      if (body[key] === undefined || body[key] === null || String(body[key]).trim() === "") {
        return NextResponse.json(
          { success: false, message: `${key} is required.` },
          { status: 400 }
        );
      }
    }

    // Party validation
    const resolvedFromParty = body.fromPartyType ?? (body.fromAccount === "Us" ? "US" : "CUSTOMER");
    const resolvedToParty = body.toPartyType ?? (body.toAccount === "Us" ? "US" : "VENDOR");
    if (resolvedFromParty === "CUSTOMER" && !body.fromCustomerId) {
      return NextResponse.json(
        { success: false, message: "fromCustomerId is required when fromPartyType is CUSTOMER." },
        { status: 400 }
      );
    }
    if (resolvedToParty === "VENDOR" && !body.toVendorId) {
      return NextResponse.json(
        { success: false, message: "toVendorId is required when toPartyType is VENDOR." },
        { status: 400 }
      );
    }

    const data: any = {
      transactionType: typeMap[body.transactionType] ?? body.transactionType,
      category: body.category,
      date: new Date(body.date),
      currency: body.currency,
      amount: Number(body.amount),
      fromPartyType: resolvedFromParty,
      toPartyType: resolvedToParty,
      mode: body.mode ? (modeMap[body.mode] ?? body.mode) : null,
      reference: body.reference || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      description: body.description || null,
    };

    if (resolvedFromParty === "CUSTOMER") {
      data.fromCustomer = { connect: { id: Number(body.fromCustomerId) } };
    }
    if (resolvedToParty === "VENDOR") {
      data.toVendor = { connect: { id: Number(body.toVendorId) } };
    }

    try {
      const payment = await prisma.payment.create({ data });
      
      // Handle company account transactions based on payment type
      if (data.transactionType === "EXPENSE") {
        // For expenses, create a DEBIT transaction in company account
        await addCompanyTransaction(
          prisma,
          'DEBIT',
          Number(body.amount),
          `Expense: ${body.category} - ${body.description || 'No description'}`,
          body.reference || `Payment-${payment.id}`
        );
      } else if (data.transactionType === "INCOME") {
        // For income, create a CREDIT transaction in company account
        await addCompanyTransaction(
          prisma,
          'CREDIT',
          Number(body.amount),
          `Income: ${body.category} - ${body.description || 'No description'}`,
          body.reference || `Payment-${payment.id}`
        );
      } else if (data.transactionType === "TRANSFER") {
        // For transfers, create both DEBIT and CREDIT transactions
        // DEBIT from source account
        await addCompanyTransaction(
          prisma,
          'DEBIT',
          Number(body.amount),
          `Transfer out: ${body.category} - ${body.description || 'No description'}`,
          body.reference || `Transfer-${payment.id}`
        );
        // CREDIT to destination account
        await addCompanyTransaction(
          prisma,
          'CREDIT',
          Number(body.amount),
          `Transfer in: ${body.category} - ${body.description || 'No description'}`,
          body.reference || `Transfer-${payment.id}`
        );
      } else if (data.transactionType === "RETURN") {
        // For returns, create a DEBIT transaction in company account (money going out)
        await addCompanyTransaction(
          prisma,
          'DEBIT',
          Number(body.amount),
          `Return: ${body.category} - ${body.description || 'No description'}`,
          body.reference || `Return-${payment.id}`
        );
        
        // If return is to a customer, update customer balance (CREDIT - they owe us less)
        if (data.toPartyType === "CUSTOMER" && data.toCustomerId) {
          const { addCustomerTransaction } = await import("@/lib/utils");
          await addCustomerTransaction(
            prisma,
            Number(data.toCustomerId),
            'CREDIT',
            Number(body.amount),
            `Return: ${body.category} - ${body.description || 'No description'}`,
            body.reference || `Return-${payment.id}`
          );
        }
      }
      
      return NextResponse.json({ success: true, message: "Payment added successfully.", payment });
    } catch (e) {
      // Fallback: some databases may still have scalar columns instead of relations
      // Compose scalar-friendly payload by storing party names
      let fromName = "Us";
      let toName = "Us";
      if (resolvedFromParty === "CUSTOMER") {
        const c = await prisma.customers.findUnique({ where: { id: Number(body.fromCustomerId) } });
        fromName = c?.CompanyName || fromName;
      }
      if (resolvedToParty === "VENDOR") {
        const v = await prisma.vendors.findUnique({ where: { id: Number(body.toVendorId) } });
        toName = v?.CompanyName || toName;
      }

      const fallbackData: any = {
        transactionType: typeMap[body.transactionType] ?? body.transactionType,
        category: body.category,
        date: new Date(body.date),
        currency: body.currency,
        amount: Number(body.amount),
        fromPartyType: resolvedFromParty,
        toPartyType: resolvedToParty,
        mode: body.mode ? (modeMap[body.mode] ?? body.mode) : null,
        reference: body.reference || null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        description: body.description || null,
        fromCustomer: fromName,
        toVendor: toName,
      };

      const payment = await (prisma as any).payment.create({ data: fallbackData });
      
      // Handle company account transactions for fallback case too
      if (fallbackData.transactionType === "EXPENSE") {
        await addCompanyTransaction(
          prisma,
          'DEBIT',
          Number(body.amount),
          `Expense: ${body.category} - ${body.description || 'No description'}`,
          body.reference || `Payment-${payment.id}`
        );
      } else if (fallbackData.transactionType === "INCOME") {
        await addCompanyTransaction(
          prisma,
          'CREDIT',
          Number(body.amount),
          `Income: ${body.category} - ${body.description || 'No description'}`,
          body.reference || `Payment-${payment.id}`
        );
             } else if (fallbackData.transactionType === "TRANSFER") {
         await addCompanyTransaction(
           prisma,
           'DEBIT',
           Number(body.amount),
           `Transfer out: ${body.category} - ${body.description || 'No description'}`,
           body.reference || `Transfer-${payment.id}`
         );
         await addCompanyTransaction(
           prisma,
           'CREDIT',
           Number(body.amount),
           `Transfer in: ${body.category} - ${body.description || 'No description'}`,
           body.reference || `Transfer-${payment.id}`
         );
       } else if (fallbackData.transactionType === "RETURN") {
         await addCompanyTransaction(
           prisma,
           'DEBIT',
           Number(body.amount),
           `Return: ${body.category} - ${body.description || 'No description'}`,
           body.reference || `Return-${payment.id}`
         );
         
         // If return is to a customer, update customer balance (CREDIT - they owe us less)
         if (fallbackData.toPartyType === "CUSTOMER" && body.toCustomerId) {
           const { addCustomerTransaction } = await import("@/lib/utils");
           await addCustomerTransaction(
             prisma,
             Number(body.toCustomerId),
             'CREDIT',
             Number(body.amount),
             `Return: ${body.category} - ${body.description || 'No description'}`,
             body.reference || `Return-${payment.id}`
           );
         }
       }
      
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


