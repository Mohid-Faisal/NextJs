import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const category = searchParams.get('category');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limitParam = searchParams.get('limit');
    const limit = limitParam === 'all' ? undefined : parseInt(limitParam || '1000') || 1000;

    // Build where clause for filtering journal entries
    const whereClause: any = {};

    // Filter by date range
    if (dateFrom || dateTo) {
      whereClause.date = {};
      if (dateFrom) {
        whereClause.date.gte = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.date.lte = new Date(dateTo + 'T23:59:59.999Z');
      }
    }

    // Filter by account if specified
    if (accountId) {
      whereClause.lines = {
        some: {
          accountId: parseInt(accountId)
        }
      };
    }

    // Filter by category if specified
    if (category && category !== 'all-categories') {
      whereClause.lines = {
        some: {
          account: {
            category: category
          }
        }
      };
    }

    // Check if there are any journal entries first
    const totalCount = await prisma.journalEntry.count({
      where: whereClause,
    });

    // Fetch journal entries with their lines and account details
    const journalEntries = await prisma.journalEntry.findMany({
      where: whereClause,
      include: {
        lines: {
          include: {
            account: true
          }
        }
      },
      orderBy: {
        date: 'desc',
      },
      ...(limit && { take: limit }),
    });

    // Transform journal entries into a format similar to payments for compatibility
    // Only include lines that match the filter criteria
    const transformedEntries = journalEntries.flatMap(entry => 
      entry.lines
        .filter(line => {
          // If filtering by account, only include lines for that specific account
          if (accountId && line.accountId !== parseInt(accountId)) {
            return false;
          }
          // If filtering by category, only include lines for accounts in that category
          if (category && category !== 'all-categories' && line.account.category !== category) {
            return false;
          }
          return true;
        })
        .map(line => ({
          id: `${entry.id}-${line.id}`, // Create unique ID
          date: entry.date,
          description: line.description || entry.description,
          amount: line.debitAmount > 0 ? line.debitAmount : line.creditAmount,
          reference: line.reference || entry.reference,
          transactionType: line.debitAmount > 0 ? 'DEBIT' : 'CREDIT',
          category: line.account.category,
          accountName: line.account.accountName,
          accountCode: line.account.code,
          accountId: line.account.id,
          mode: 'JOURNAL_ENTRY',
          fromCustomer: '', // Not applicable for journal entries
          toVendor: '', // Not applicable for journal entries
          fromPartyType: 'SYSTEM',
          toPartyType: 'SYSTEM',
          journalEntryNumber: entry.entryNumber,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount
        }))
    );

    return NextResponse.json({
      success: true,
      payments: transformedEntries, // Keep the field name for compatibility
      total: totalCount,
    });
  } catch (error) {
    console.error("Error fetching account book entries:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch account book entries" },
      { status: 500 }
    );
  }
}
