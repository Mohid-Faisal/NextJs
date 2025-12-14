import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addCustomerTransaction, createJournalEntryForTransaction } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = parseInt(id);
    
    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: "Invalid customer ID" },
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
      customerId: customerId
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

    // Get customer info
    const customer = await prisma.customers.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        CompanyName: true,
        PersonName: true,
        currentBalance: true,
        creditLimit: true
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Get total count for pagination
    const total = await prisma.customerTransaction.count({
      where: whereClause
    });

    // First, get ALL transactions for this customer (without pagination) to recalculate balances
    const allTransactions = await prisma.customerTransaction.findMany({
      where: { customerId: customerId },
      orderBy: { createdAt: 'asc' }, // Sort chronologically by createdAt first
      select: {
        id: true,
        type: true,
        amount: true,
        createdAt: true,
        invoice: true
      }
    });

    // Fetch shipment and payment dates for all transactions to determine voucher dates
    const transactionsWithVoucherDates = await Promise.all(
      allTransactions.map(async (transaction) => {
        let voucherDate = transaction.createdAt;
        
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
            // For DEBIT transactions (shipments), use shipmentDate
            voucherDate = invoice.shipment.shipmentDate;
          } else if (transaction.type === "CREDIT") {
            // For CREDIT transactions (payments), use payment date
            const payment = await prisma.payment.findFirst({
              where: {
                invoice: transaction.invoice,
                fromCustomerId: customerId,
                transactionType: "INCOME"
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
    transactionsWithVoucherDates.sort((a, b) => 
      a.voucherDate.getTime() - b.voucherDate.getTime()
    );

    // Recalculate balances chronologically based on voucher date
    let runningBalance = 0;
    const transactionsToUpdate = transactionsWithVoucherDates.map((transaction) => {
      const previousBalance = runningBalance;
      // For customers: CREDIT increases balance (they pay us), DEBIT decreases (they owe us)
      const newBalance = transaction.type === 'CREDIT' 
        ? previousBalance + transaction.amount 
        : previousBalance - transaction.amount;
      runningBalance = newBalance;
      
      return {
        id: transaction.id,
        previousBalance,
        newBalance
      };
    });

    // Update all transactions with recalculated balances
    await Promise.all(
      transactionsToUpdate.map(({ id, previousBalance, newBalance }) =>
        prisma.customerTransaction.update({
          where: { id },
          data: { previousBalance, newBalance }
        })
      )
    );

    // Update customer's currentBalance to match the latest transaction's newBalance
    if (transactionsToUpdate.length > 0) {
      const latestBalance = transactionsToUpdate[transactionsToUpdate.length - 1].newBalance;
      await prisma.customers.update({
        where: { id: customerId },
        data: { currentBalance: latestBalance }
      });
      // Update customer object for response
      customer.currentBalance = latestBalance;
    }

    // Now get the paginated transactions with updated balances
    const transactions = await prisma.customerTransaction.findMany({
      where: whereClause,
      orderBy: { [validSortField]: validSortOrder },
      skip,
      take: limit,
      include: {
        customer: {
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
                fromCustomerId: customerId,
                transactionType: "INCOME"
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
          paymentDate
        };
      })
    );

    return NextResponse.json({
      customer: {
        id: customer.id,
        CompanyName: customer.CompanyName,
        PersonName: customer.PersonName,
        currentBalance: customer.currentBalance,
        creditLimit: customer.creditLimit
      },
      transactions: transactionsWithShipmentInfo,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error("Error fetching customer transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer transactions" },
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
    const customerId = parseInt(id);
    
    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: "Invalid customer ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { type, amount, description, reference } = body;

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

    const result = await addCustomerTransaction(
      prisma,
      customerId,
      type,
      parseFloat(amount),
      description,
      reference
    );

    // Create journal entry for customer transaction
    const transactionType = type === 'CREDIT' ? 'CUSTOMER_CREDIT' : 'CUSTOMER_DEBIT';
    await createJournalEntryForTransaction(
      prisma,
      transactionType,
      parseFloat(amount),
      description,
      reference
    );

    return NextResponse.json({
      success: true,
      message: "Transaction added successfully",
      previousBalance: result.previousBalance,
      newBalance: result.newBalance
    });

  } catch (error) {
    console.error("Error adding customer transaction:", error);
    return NextResponse.json(
      { error: "Failed to add transaction" },
      { status: 500 }
    );
  }
}
