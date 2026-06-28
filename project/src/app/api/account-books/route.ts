import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgWhere } from "@/lib/tenant/prismaScope";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiSession(request);
    if (auth.error) return auth.error;
    const session = auth.session;

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const category = searchParams.get('category');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limitParam = searchParams.get('limit');
    const limit = limitParam === 'all' ? undefined : parseInt(limitParam || '1000') || 1000;

    const whereClause: any = orgWhere(session);

    if (dateFrom || dateTo) {
      whereClause.date = {};
      if (dateFrom) {
        whereClause.date.gte = new Date(dateFrom + 'T00:00:00.000Z');
      }
      if (dateTo) {
        whereClause.date.lte = new Date(dateTo + 'T23:59:59.999Z');
      }
    }

    if (accountId) {
      whereClause.lines = {
        some: {
          accountId: parseInt(accountId)
        }
      };
    }

    if (category && category !== 'all-categories') {
      whereClause.lines = {
        some: {
          account: {
            category: category,
            organizationId: session.organizationId,
          }
        }
      };
    }

    const totalCount = await prisma.journalEntry.count({
      where: whereClause,
    });

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

    const transformedEntries = journalEntries.flatMap(entry => 
      entry.lines
        .filter(line => {
          if (accountId && line.accountId !== parseInt(accountId)) {
            return false;
          }
          if (category && category !== 'all-categories' && line.account.category !== category) {
            return false;
          }
          return true;
        })
        .map(line => ({
          id: `${entry.id}-${line.id}`,
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
          fromCustomer: '',
          toVendor: '',
          fromPartyType: 'SYSTEM',
          toPartyType: 'SYSTEM',
          journalEntryNumber: entry.entryNumber,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount
        }))
    );

    return NextResponse.json({
      success: true,
      payments: transformedEntries,
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
