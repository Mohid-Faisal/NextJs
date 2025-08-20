import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const isPosted = searchParams.get('isPosted');
    const skip = (page - 1) * limit;

    // Build where clause for filtering
    const whereClause: any = {};

    // Filter by search term
    if (search) {
      whereClause.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { entryNumber: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Filter by date range
    if (fromDate || toDate) {
      whereClause.date = {};
      if (fromDate) {
        whereClause.date.gte = new Date(fromDate);
      }
      if (toDate) {
        whereClause.date.lte = new Date(toDate + 'T23:59:59.999Z');
      }
    }

    // Filter by posted status
    if (isPosted && isPosted !== 'all') {
      whereClause.isPosted = isPosted === 'true';
    }

    // Get total count
    const total = await prisma.journalEntry.count({ where: whereClause });

    // Get journal entries with lines
    const entries = await prisma.journalEntry.findMany({
      where: whereClause,
      include: {
        lines: {
          include: {
            account: {
              select: {
                id: true,
                code: true,
                accountName: true,
                category: true,
                type: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
      skip,
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: entries,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("Error fetching journal entries:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch journal entries" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, description, reference, lines } = body;

    // Validate required fields
    if (!date || !description || !lines || !Array.isArray(lines) || lines.length < 2) {
      return NextResponse.json(
        { success: false, error: "Date, description, and at least 2 lines are required" },
        { status: 400 }
      );
    }

    // Validate double-entry bookkeeping (debits = credits)
    const totalDebit = lines.reduce((sum: number, line: any) => sum + (line.debitAmount || 0), 0);
    const totalCredit = lines.reduce((sum: number, line: any) => sum + (line.creditAmount || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json(
        { success: false, error: "Total debits must equal total credits" },
        { status: 400 }
      );
    }

    // Validate that each line has either debit or credit amount
    for (const line of lines) {
      if (!line.accountId) {
        return NextResponse.json(
          { success: false, error: "Each line must have an account" },
          { status: 400 }
        );
      }
      
      if ((line.debitAmount || 0) === 0 && (line.creditAmount || 0) === 0) {
        return NextResponse.json(
          { success: false, error: "Each line must have either debit or credit amount" },
          { status: 400 }
        );
      }
      
      if ((line.debitAmount || 0) > 0 && (line.creditAmount || 0) > 0) {
        return NextResponse.json(
          { success: false, error: "Each line cannot have both debit and credit amounts" },
          { status: 400 }
        );
      }
    }

    // Generate entry number
    const lastEntry = await prisma.journalEntry.findFirst({
      orderBy: { entryNumber: "desc" }
    });

    let entryNumber = "JE-0001";
    if (lastEntry) {
      const lastNumber = parseInt(lastEntry.entryNumber.split("-")[1]);
      entryNumber = `JE-${String(lastNumber + 1).padStart(4, "0")}`;
    }

    // Create journal entry with lines in a transaction
    const journalEntry = await prisma.$transaction(async (tx) => {
      // Create the journal entry
      const entry = await tx.journalEntry.create({
        data: {
          entryNumber,
          date: new Date(date),
          description,
          reference,
          totalDebit,
          totalCredit,
          isPosted: false
        }
      });

      // Create the journal entry lines
      const entryLines = await Promise.all(
        lines.map((line: any) =>
          tx.journalEntryLine.create({
            data: {
              journalEntryId: entry.id,
              accountId: line.accountId,
              debitAmount: line.debitAmount || 0,
              creditAmount: line.creditAmount || 0,
              description: line.description,
              reference: line.reference
            }
          })
        )
      );

      return {
        ...entry,
        lines: entryLines
      };
    });

    return NextResponse.json({
      success: true,
      data: journalEntry,
      message: "Journal entry created successfully"
    });
  } catch (error) {
    console.error("Error creating journal entry:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create journal entry" },
      { status: 500 }
    );
  }
}

// Post journal entry
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, entryId } = body;

    if (action === "post" && entryId) {
      const entry = await prisma.journalEntry.findUnique({
        where: { id: entryId },
        include: { lines: true }
      });

      if (!entry) {
        return NextResponse.json(
          { success: false, error: "Journal entry not found" },
          { status: 404 }
        );
      }

      if (entry.isPosted) {
        return NextResponse.json(
          { success: false, error: "Journal entry is already posted" },
          { status: 400 }
        );
      }

      // Post the journal entry
      await prisma.journalEntry.update({
        where: { id: entryId },
        data: {
          isPosted: true,
          postedAt: new Date()
        }
      });

      return NextResponse.json({
        success: true,
        message: "Journal entry posted successfully"
      });
    }

    return NextResponse.json({
      success: false,
      error: "Invalid action"
    }, { status: 400 });
  } catch (error) {
    console.error("Error posting journal entry:", error);
    return NextResponse.json(
      { success: false, error: "Failed to post journal entry" },
      { status: 500 }
    );
  }
}
