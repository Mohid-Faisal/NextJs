import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: "Start date and end date are required" },
        { status: 400 }
      );
    }

    // Check if closing entry already exists for this period
    const existingClosing = await prisma.journalEntry.findFirst({
      where: {
        description: {
          contains: `Closing Entry`
        },
        reference: {
          contains: `CLOSE-${startDate}-${endDate}`
        }
      }
    });

    if (existingClosing) {
      return NextResponse.json({
        success: true,
        message: "Closing entry already exists for this period",
        data: existingClosing
      });
    }

    // Get all revenue and expense accounts
    const revenueAccounts = await prisma.chartOfAccount.findMany({
      where: { category: "Revenue" }
    });

    const expenseAccounts = await prisma.chartOfAccount.findMany({
      where: { category: "Expense" }
    });

    // Get Current Year Earnings account
    let currentYearEarnings = await prisma.chartOfAccount.findFirst({
      where: {
        category: "Equity",
        OR: [
          { accountName: { contains: "Current year earnings", mode: "insensitive" } },
          { accountName: { contains: "Current Year Earnings", mode: "insensitive" } },
          { accountName: { contains: "Retained Earnings", mode: "insensitive" } }
        ]
      }
    });

    // If not found, try to find any equity account
    if (!currentYearEarnings) {
      currentYearEarnings = await prisma.chartOfAccount.findFirst({
        where: { category: "Equity" }
      });
    }

    if (!currentYearEarnings) {
      return NextResponse.json(
        { success: false, error: "No equity account found for closing entries" },
        { status: 400 }
      );
    }

    // Fetch all journal entry lines up to endDate to calculate cumulative balances
    const journalEntries = await prisma.journalEntry.findMany({
      where: {
        date: {
          lte: new Date(endDate + 'T23:59:59.999Z')
        },
        isPosted: true
      },
      include: {
        lines: {
          include: {
            account: true
          }
        }
      }
    });

    // Calculate cumulative revenue and expense balances up to endDate
    const revenueBalances = new Map<number, number>();
    const expenseBalances = new Map<number, number>();

    // Initialize all revenue and expense accounts
    revenueAccounts.forEach(acc => revenueBalances.set(acc.id, 0));
    expenseAccounts.forEach(acc => expenseBalances.set(acc.id, 0));

    // Calculate balances from all journal entries up to endDate
    journalEntries.forEach(entry => {
      entry.lines.forEach(line => {
        const account = line.account;
        if (!account) return;

        if (account.category === 'Revenue') {
          const current = revenueBalances.get(account.id) || 0;
          // Revenue: Credit increases, Debit decreases
          revenueBalances.set(account.id, current + (line.creditAmount - line.debitAmount));
        } else if (account.category === 'Expense') {
          const current = expenseBalances.get(account.id) || 0;
          // Expense: Debit increases, Credit decreases
          expenseBalances.set(account.id, current + (line.debitAmount - line.creditAmount));
        }
      });
    });

    // Calculate total revenue and total expenses
    let totalRevenue = 0;
    let totalExpenses = 0;

    revenueBalances.forEach(balance => {
      if (balance > 0) totalRevenue += balance;
    });

    expenseBalances.forEach(balance => {
      if (balance > 0) totalExpenses += balance;
    });

    const netIncome = totalRevenue - totalExpenses;

    // If net income is zero, no need to create closing entry
    if (Math.abs(netIncome) < 0.01) {
      return NextResponse.json({
        success: true,
        message: "No net income to close for this period",
        data: null
      });
    }

    // Generate journal entry number
    const lastEntry = await prisma.journalEntry.findFirst({
      orderBy: { entryNumber: "desc" }
    });

    let entryNumber = "JE-0001";
    if (lastEntry) {
      const lastNumber = parseInt(lastEntry.entryNumber.split("-")[1]);
      entryNumber = `JE-${String(lastNumber + 1).padStart(4, "0")}`;
    }

    // Create closing entry
    const closingEntry = await prisma.$transaction(async (tx) => {
      // Create the journal entry
      const entry = await tx.journalEntry.create({
        data: {
          entryNumber,
          date: new Date(endDate),
          description: `Closing Entry: Transfer Net Income to Equity for period ${startDate} to ${endDate}`,
          reference: `CLOSE-${startDate}-${endDate}`,
          totalDebit: Math.abs(netIncome),
          totalCredit: Math.abs(netIncome),
          isPosted: true,
          postedAt: new Date()
        }
      });

      const entryLines = [];

      // Create a simple closing entry: Transfer net income directly to Current Year Earnings
      // This is a simplified approach - we debit/credit a temporary Income Summary account
      // and then transfer to equity. For simplicity, we'll use a direct transfer.
      
      if (netIncome > 0) {
        // Profit: 
        // Debit: Income Summary (or directly from revenue net)
        // Credit: Current Year Earnings
        entryLines.push(
          tx.journalEntryLine.create({
            data: {
              journalEntryId: entry.id,
              accountId: currentYearEarnings.id,
              debitAmount: 0,
              creditAmount: netIncome,
              description: `Close Net Income to Current Year Earnings (Revenue: ${totalRevenue.toFixed(2)}, Expenses: ${totalExpenses.toFixed(2)})`,
              reference: `CLOSE-${startDate}-${endDate}`
            }
          })
        );
        
        // Create offsetting entry - we'll use the first revenue account as a summary
        // In practice, this would be an Income Summary account, but for simplicity we use revenue
        if (revenueAccounts.length > 0) {
          entryLines.push(
            tx.journalEntryLine.create({
              data: {
                journalEntryId: entry.id,
                accountId: revenueAccounts[0].id,
                debitAmount: netIncome,
                creditAmount: 0,
                description: `Close Net Income Summary`,
                reference: `CLOSE-${startDate}-${endDate}`
              }
            })
          );
        }
      } else if (netIncome < 0) {
        // Loss:
        // Debit: Current Year Earnings
        // Credit: Income Summary
        entryLines.push(
          tx.journalEntryLine.create({
            data: {
              journalEntryId: entry.id,
              accountId: currentYearEarnings.id,
              debitAmount: Math.abs(netIncome),
              creditAmount: 0,
              description: `Close Net Loss to Current Year Earnings (Revenue: ${totalRevenue.toFixed(2)}, Expenses: ${totalExpenses.toFixed(2)})`,
              reference: `CLOSE-${startDate}-${endDate}`
            }
          })
        );
        
        // Create offsetting entry
        if (expenseAccounts.length > 0) {
          entryLines.push(
            tx.journalEntryLine.create({
              data: {
                journalEntryId: entry.id,
                accountId: expenseAccounts[0].id,
                debitAmount: 0,
                creditAmount: Math.abs(netIncome),
                description: `Close Net Loss Summary`,
                reference: `CLOSE-${startDate}-${endDate}`
              }
            })
          );
        }
      }

      await Promise.all(entryLines);

      return entry;
    });

    return NextResponse.json({
      success: true,
      message: `Closing entry created successfully. Net Income: ${netIncome.toFixed(2)}`,
      data: closingEntry,
      netIncome: netIncome
    });
  } catch (error) {
    console.error("Error creating closing entry:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create closing entry" },
      { status: 500 }
    );
  }
}

