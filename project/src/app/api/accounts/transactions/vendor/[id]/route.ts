import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addVendorTransaction, createJournalEntryForTransaction } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vendorId = parseInt(id);
    
    if (isNaN(vendorId)) {
      return NextResponse.json(
        { error: "Invalid vendor ID" },
        { status: 400 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const sortField = searchParams.get('sortField') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Build where clause for filtering
    const whereClause: any = {
      vendorId: vendorId
    };

    // Add search filter
    if (search) {
      whereClause.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { amount: { equals: parseFloat(search) || undefined } }
      ];
    }

    // Add date range filter
    if (fromDate || toDate) {
      whereClause.createdAt = {};
      if (fromDate) {
        whereClause.createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        whereClause.createdAt.lte = new Date(toDate);
      }
    }

    // Validate sort field
    const allowedSortFields = ['createdAt', 'amount', 'type', 'description', 'reference'];
    const validSortField = allowedSortFields.includes(sortField) ? sortField : 'createdAt';
    const validSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    // Get vendor info
    const vendor = await prisma.vendors.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        CompanyName: true,
        PersonName: true,
        currentBalance: true,
        creditLimit: true
      }
    });

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    // Get total count for pagination
    const total = await prisma.vendorTransaction.count({
      where: whereClause
    });

    // First, get ALL transactions for this vendor (without pagination) to recalculate balances
    const allTransactions = await prisma.vendorTransaction.findMany({
      where: { vendorId: vendorId },
      orderBy: { createdAt: 'asc' }, // Sort chronologically by createdAt first
      select: {
        id: true,
        type: true,
        amount: true,
        createdAt: true,
        invoice: true,
        reference: true
      }
    });

    // Fetch shipment and payment dates for all transactions to determine voucher dates
    const transactionsWithVoucherDates = await Promise.all(
      allTransactions.map(async (transaction) => {
        let voucherDate = transaction.createdAt;
        
        // If this is a debit note transaction, fetch the date from the debit note record
        if (transaction.reference?.startsWith("#DEBIT")) {
          const debitNote = await prisma.debitNote.findUnique({
            where: { debitNoteNumber: transaction.reference },
            select: { date: true }
          });
          if (debitNote?.date) {
            voucherDate = debitNote.date;
          }
        } else if (transaction.reference?.startsWith("#CREDIT")) {
          // For vendor transactions, credit notes might also exist
          const debitNote = await prisma.debitNote.findFirst({
            where: { debitNoteNumber: transaction.reference },
            select: { date: true }
          });
          if (debitNote?.date) {
            voucherDate = debitNote.date;
          }
        }

        if (transaction.invoice) {
          // Find the invoice and get shipment info
          const invoice = await prisma.invoice.findFirst({
            where: { invoiceNumber: transaction.invoice },
            include: {
              shipment: {
                select: {
                  shipmentDate: true
                }
              }
            }
          });
          
          if (transaction.type === "DEBIT" && invoice?.shipment?.shipmentDate) {
            // For DEBIT transactions (vendor invoices), use shipmentDate
            voucherDate = invoice.shipment.shipmentDate;
          } else if (transaction.type === "CREDIT") {
            // For CREDIT transactions (vendor payments), use payment date
            const payment = await prisma.payment.findFirst({
              where: {
                invoice: transaction.invoice,
                toVendorId: vendorId,
                transactionType: "EXPENSE"
              },
              orderBy: {
                date: 'desc'
              },
              select: {
                date: true
              }
            });
            
            if (payment?.date) {
              voucherDate = payment.date;
            }
          }
        }
        
        return {
          ...transaction,
          voucherDate
        };
      })
    );

    // Sort by voucher date (not createdAt) for balance calculation
    // When dates are the same, DEBIT (shipment/invoice) transactions come before CREDIT (payment) transactions
    transactionsWithVoucherDates.sort((a, b) => {
      const dateDiff = a.voucherDate.getTime() - b.voucherDate.getTime();
      if (dateDiff !== 0) {
        return dateDiff;
      }
      // Same date: DEBIT (shipment/invoice) before CREDIT (payment)
      if (a.type === "DEBIT" && b.type === "CREDIT") return -1;
      if (a.type === "CREDIT" && b.type === "DEBIT") return 1;
      return 0;
    });

    // Find starting balance transaction (reference starts with "STARTING-BALANCE")
    const startingBalanceTransaction = transactionsWithVoucherDates.find(
      (t) => t.reference && t.reference.startsWith("STARTING-BALANCE")
    );

    // Calculate initial balance from starting balance transaction
    // For vendors: DEBIT increases balance (we owe them), CREDIT decreases (we pay them)
    // Starting balance transaction sets the initial balance
    let runningBalance = 0;
    if (startingBalanceTransaction) {
      // The starting balance transaction itself represents the initial balance
      // If it's DEBIT, we owe them (positive balance), if CREDIT, they owe us (negative balance)
      runningBalance = startingBalanceTransaction.type === 'DEBIT' 
        ? startingBalanceTransaction.amount 
        : -startingBalanceTransaction.amount;
    }

    // Recalculate balances chronologically based on voucher date
    // Exclude starting balance transaction from the loop since it already sets the initial balance
    const transactionsToUpdate = transactionsWithVoucherDates
      .filter((transaction) => !transaction.reference || !transaction.reference.startsWith("STARTING-BALANCE"))
      .map((transaction) => {
        const previousBalance = runningBalance;
        // For vendors: DEBIT increases balance (we owe them), CREDIT decreases (we pay them)
        const newBalance = transaction.type === 'DEBIT' 
          ? previousBalance + transaction.amount 
          : previousBalance - transaction.amount;
        runningBalance = newBalance;
      
        return {
          id: transaction.id,
          previousBalance,
          newBalance
        };
      });

    // Also update the starting balance transaction with its own balance values
    if (startingBalanceTransaction) {
      const startingBalance = startingBalanceTransaction.type === 'DEBIT' 
        ? startingBalanceTransaction.amount 
        : -startingBalanceTransaction.amount;
      transactionsToUpdate.push({
        id: startingBalanceTransaction.id,
        previousBalance: 0,
        newBalance: startingBalance
      });
    }

    // Update all transactions with recalculated balances
    await Promise.all(
      transactionsToUpdate.map(({ id, previousBalance, newBalance }) =>
        prisma.vendorTransaction.update({
          where: { id },
          data: { previousBalance, newBalance }
        })
      )
    );

    // Update vendor's currentBalance to match the final runningBalance after all transactions
    // Use runningBalance which already has the final calculated balance
    await prisma.vendors.update({
      where: { id: vendorId },
      data: { currentBalance: runningBalance }
    });
    // Update vendor object for response
    vendor.currentBalance = runningBalance;

    // Now get the paginated transactions with updated balances
    const transactions = await prisma.vendorTransaction.findMany({
      where: whereClause,
      orderBy: { [validSortField]: validSortOrder },
      skip,
      take: limit,
      include: {
        vendor: {
          select: {
            CompanyName: true,
            PersonName: true
          }
        }
      }
    });

    // Fetch shipment information and payment date for transactions that have invoice references
    const transactionsWithShipmentInfo = await Promise.all(
      transactions.map(async (transaction) => {
        let shipmentInfo = null;
        let shipmentDate: string | undefined = undefined;
        let paymentDate: string | undefined = undefined;
        let debitNoteDate: string | undefined = undefined;
        
        // If this is a debit note transaction, fetch the date from the debit note record
        if (transaction.reference?.startsWith("#DEBIT")) {
          const debitNote = await prisma.debitNote.findUnique({
            where: { debitNoteNumber: transaction.reference },
            select: { date: true }
          });
          if (debitNote?.date) {
            debitNoteDate = debitNote.date.toISOString();
          }
        } else if (transaction.reference?.startsWith("#CREDIT")) {
          const debitNote = await prisma.debitNote.findFirst({
            where: { debitNoteNumber: transaction.reference },
            select: { date: true }
          });
          if (debitNote?.date) {
            debitNoteDate = debitNote.date.toISOString();
          }
        }
        
        if (transaction.invoice) {
          // Find the invoice and get shipment info
          const invoice = await prisma.invoice.findFirst({
            where: { invoiceNumber: transaction.invoice },
            include: {
              shipment: {
                select: {
                  trackingId: true,
                  weight: true,
                  destination: true,
                  referenceNumber: true,
                  deliveryStatus: true,
                  shipmentDate: true
                }
              }
            }
          });
          
          if (invoice?.shipment) {
            shipmentInfo = {
              awbNo: invoice.shipment.trackingId,
              weight: invoice.shipment.weight,
              destination: invoice.shipment.destination,
              referenceNo: invoice.shipment.referenceNumber,
              status: invoice.shipment.deliveryStatus || 'Sale',
              shipmentDate: invoice.shipment.shipmentDate
            };
            
            // Extract shipmentDate for direct access
            if (invoice.shipment.shipmentDate) {
              shipmentDate = invoice.shipment.shipmentDate.toISOString();
            }
          }
          
          // For payment transactions (CREDIT), fetch payment date from Payment table
          if (transaction.type === "CREDIT") {
            const payment = await prisma.payment.findFirst({
              where: {
                invoice: transaction.invoice,
                toVendorId: vendorId,
                transactionType: "EXPENSE"
              },
              orderBy: {
                date: 'desc' // Get the most recent payment for this invoice
              },
              select: {
                date: true
              }
            });
            
            if (payment?.date) {
              paymentDate = payment.date.toISOString();
            }
          }
        }
        
        return {
          ...transaction,
          shipmentInfo,
          shipmentDate,
          paymentDate,
          debitNoteDate
        };
      })
    );

    return NextResponse.json({
      vendor: {
        id: vendor.id,
        CompanyName: vendor.CompanyName,
        PersonName: vendor.PersonName,
        currentBalance: vendor.currentBalance,
        creditLimit: vendor.creditLimit
      },
      transactions: transactionsWithShipmentInfo,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error("Error fetching vendor transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor transactions" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vendorId = parseInt(id);
    
    if (isNaN(vendorId)) {
      return NextResponse.json(
        { error: "Invalid vendor ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { type, amount, description, reference, date } = body;

    if (!type || !amount || !description) {
      return NextResponse.json(
        { error: "Type, amount, and description are required" },
        { status: 400 }
      );
    }

    if (!['CREDIT', 'DEBIT'].includes(type)) {
      return NextResponse.json(
        { error: "Type must be CREDIT or DEBIT" },
        { status: 400 }
      );
    }

    // Check if this is a starting balance transaction
    const isStartingBalance = reference && reference.startsWith("STARTING-BALANCE");

    if (isStartingBalance) {
      // Find existing starting balance transaction
      const existingStartingBalance = await prisma.vendorTransaction.findFirst({
        where: {
          vendorId: vendorId,
          reference: { startsWith: "STARTING-BALANCE" }
        }
      });

      if (existingStartingBalance) {
        // Use provided date or default to earliest date for starting balance
        const transactionDate = date ? new Date(date) : new Date('1970-01-01');
        
        // Find and delete existing journal entries for this starting balance
        // Use the existing transaction's reference to find matching journal entries
        const existingJournalEntries = await prisma.journalEntry.findMany({
          where: {
            reference: existingStartingBalance.reference 
              ? existingStartingBalance.reference 
              : { startsWith: "STARTING-BALANCE" }
          }
        });
        
        // Delete journal entry lines first, then the journal entries
        for (const entry of existingJournalEntries) {
          await prisma.journalEntryLine.deleteMany({
            where: { journalEntryId: entry.id }
          });
          await prisma.journalEntry.delete({
            where: { id: entry.id }
          });
        }
        
        // Update existing starting balance transaction
        await prisma.vendorTransaction.update({
          where: { id: existingStartingBalance.id },
          data: {
            type: type,
            amount: parseFloat(amount),
            description: description,
            reference: reference,
            createdAt: transactionDate,
            previousBalance: 0,
            newBalance: type === 'DEBIT' ? parseFloat(amount) : -parseFloat(amount)
          }
        });
        
        // Create journal entry with the provided date (skip for CREDIT as it's not needed)
        if (type === 'DEBIT') {
          const transactionType = 'VENDOR_DEBIT';
          await createJournalEntryForTransaction(
            prisma,
            transactionType,
            parseFloat(amount),
            description,
            reference,
            undefined,
            transactionDate
          );
        }

        // Trigger balance recalculation by calling GET endpoint logic
        // We'll need to recalculate all balances
        const allTransactions = await prisma.vendorTransaction.findMany({
          where: { vendorId: vendorId }
        });

        // Recalculate balances (this will be done on next GET request)
        // For now, just return success
        return NextResponse.json({
          success: true,
          message: "Starting balance updated successfully",
          previousBalance: 0,
          newBalance: type === 'DEBIT' ? parseFloat(amount) : -parseFloat(amount)
        });
      }
    }

    const result = await addVendorTransaction(
      prisma,
      vendorId,
      type,
      parseFloat(amount),
      description,
      reference,
      undefined,
      date ? new Date(date) : undefined
    );

    // For starting balance, find the transaction we just created and update it
    if (isStartingBalance) {
      const createdTransaction = await prisma.vendorTransaction.findFirst({
        where: {
          vendorId: vendorId,
          reference: reference
        },
        orderBy: { createdAt: 'desc' }
      });

      if (createdTransaction) {
        // Use provided date or default to earliest date for starting balance
        const transactionDate = date ? new Date(date) : new Date('1970-01-01');
        
        await prisma.vendorTransaction.update({
          where: { id: createdTransaction.id },
          data: {
            createdAt: transactionDate,
            previousBalance: 0,
            newBalance: type === 'DEBIT' ? parseFloat(amount) : -parseFloat(amount)
          }
        });
        
        // Create journal entry for new starting balance (skip for CREDIT as it's not needed)
        if (type === 'DEBIT') {
          const transactionType = 'VENDOR_DEBIT';
          await createJournalEntryForTransaction(
            prisma,
            transactionType,
            parseFloat(amount),
            description,
            reference,
            undefined,
            transactionDate
          );
        }
      }
    }

    // Create journal entry for vendor transaction (skip for starting balance as it's handled above)
    if (!isStartingBalance) {
      const transactionType = type === 'CREDIT' ? 'VENDOR_CREDIT' : 'VENDOR_DEBIT';
      const transactionDate = date ? new Date(date) : undefined;
      await createJournalEntryForTransaction(
        prisma,
        transactionType,
        parseFloat(amount),
        description,
        reference,
        undefined,
        transactionDate
      );
    }

    return NextResponse.json({
      success: true,
      message: "Transaction added successfully",
      previousBalance: result.previousBalance,
      newBalance: result.newBalance
    });

  } catch (error) {
    console.error("Error adding vendor transaction:", error);
    return NextResponse.json(
      { error: "Failed to add transaction" },
      { status: 500 }
    );
  }
}
