import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createJournalEntryForTransaction } from "@/lib/utils";

// Helper function to decode JWT token
function decodeToken(token: string) {
  try {
    const secret = process.env.JWT_SECRET || "your-secret-key";
    return jwt.verify(token, secret) as { id: string; [key: string]: unknown };
  } catch (error) {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shipmentId = parseInt(id);

    if (isNaN(shipmentId)) {
      return NextResponse.json(
        { error: "Invalid shipment ID" },
        { status: 400 }
      );
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      return NextResponse.json(
        { error: "Shipment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ shipment });
  } catch (error) {
    console.error("Error fetching shipment:", error);
    return NextResponse.json(
      { error: "Failed to fetch shipment" },
      { status: 500 }
    );
  }
}

// export async function PUT(
//   request: NextRequest,
//   { params }: { params: { id: string } }
// ) {
//   try {
//     const shipmentId = parseInt(params.id);
//     const body = await request.json();

//     // Get the shipment to verify it exists
//     const existingShipment = await prisma.shipment.findUnique({
//       where: { id: shipmentId },
//     });

//     if (!existingShipment) {
//       return NextResponse.json(
//         { success: false, message: "Shipment not found" },
//         { status: 404 }
//       );
//     }

//     // Update the shipment
//     const updatedShipment = await prisma.shipment.update({
//       where: { id: shipmentId },
//       data: {
//         awbNumber: body.awbNumber,
//         senderName: body.senderName,
//         senderPhone: body.senderPhone,
//         senderAddress: body.senderAddress,
//         recipientName: body.recipientName,
//         recipientPhone: body.recipientPhone,
//         recipientAddress: body.recipientAddress,
//         destination: body.destination,
//         weight: body.weight,
//         dimensions: body.dimensions,
//         description: body.description,
//         deliveryStatus: body.deliveryStatus,
//         invoiceStatus: body.invoiceStatus,
//         totalCost: body.totalCost,
//         notes: body.notes,
//       },
//     });

//     return NextResponse.json({
//       success: true,
//       message: "Shipment updated successfully",
//       data: updatedShipment,
//     });
//   } catch (error) {
//     console.error("Update shipment error:", error);
//     return NextResponse.json(
//       { success: false, message: "Failed to update shipment" },
//       { status: 500 }
//     );
//   }
// }

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shipmentId = parseInt(id);
    
    if (isNaN(shipmentId)) {
      return NextResponse.json(
        { error: "Invalid shipment ID" },
        { status: 400 }
      );
    }

    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization token required" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = decodeToken(token);
    
    if (!decoded) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    // Get the request body for password verification
    const body: { password: string } = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: "Password is required for deletion" },
        { status: 400 }
      );
    }

    // Get the current user
    const user = await prisma.user.findUnique({
      where: { id: parseInt(decoded.id) },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Verify the password
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 401 }
      );
    }

    // Check if shipment exists and get related invoices
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        // Include invoices to handle financial transactions
      }
    });

    if (!shipment) {
      return NextResponse.json(
        { error: "Shipment not found" },
        { status: 404 }
      );
    }

    // Find related invoices
    const relatedInvoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { shipmentId: shipmentId },
          { trackingNumber: shipment.trackingId },
          { invoiceNumber: shipment.invoiceNumber }
        ]
      },
      include: {
        customer: true,
        vendor: true
      }
    });

    console.log(`Found ${relatedInvoices.length} related invoices for shipment ${shipmentId}`);

    // Find related journal entries that were created for this shipment
    const relatedJournalEntries = await prisma.journalEntry.findMany({
      where: {
        OR: [
          { reference: shipment.trackingId },
          { reference: shipment.invoiceNumber },
          { description: { contains: shipment.trackingId } },
          { description: { contains: shipment.invoiceNumber } }
        ]
      },
      include: {
        lines: true
      }
    });

    console.log(`Found ${relatedJournalEntries.length} related journal entries for shipment ${shipmentId}`);

    // Find related customer and vendor transactions
    const relatedCustomerTransactions = await prisma.customerTransaction.findMany({
      where: {
        OR: [
          { reference: shipment.trackingId },
          { invoice: shipment.invoiceNumber },
          { description: { contains: shipment.trackingId } },
          { description: { contains: shipment.invoiceNumber } }
        ]
      }
    });

    const relatedVendorTransactions = await prisma.vendorTransaction.findMany({
      where: {
        OR: [
          { reference: shipment.trackingId },
          { invoice: shipment.invoiceNumber },
          { description: { contains: shipment.trackingId } },
          { description: { contains: shipment.invoiceNumber } }
        ]
      }
    });

    console.log(`Found ${relatedCustomerTransactions.length} related customer transactions and ${relatedVendorTransactions.length} vendor transactions for shipment ${shipmentId}`);

    // Handle financial transactions before deletion
    // For paid invoices, we create refund transactions instead of deleting payments
    let customerRefundsProcessed = 0;
    let vendorAdjustmentsProcessed = 0;
    let totalRefundAmount = 0;
    let totalAdjustmentAmount = 0;

    for (const invoice of relatedInvoices) {
      // Only process invoices that are actually paid
      if (invoice.status === "Paid" && invoice.totalAmount > 0) {
        console.log(`Processing paid invoice ${invoice.invoiceNumber} for ${invoice.profile} - Amount: ${invoice.totalAmount}`);

        if (invoice.profile === "Customer" && invoice.customerId) {
          // Customer invoice was paid - we need to create a refund transaction
          // This moves money from our cash account to accounts payable (to refund customer)
          console.log(`Processing customer refund for invoice ${invoice.invoiceNumber}`);
          
          try {
            // Get current customer balance
            const customer = await prisma.customers.findUnique({
              where: { id: invoice.customerId }
            });
            
            if (!customer) {
              console.error(`Customer ${invoice.customerId} not found for refund`);
              continue;
            }
            
            const previousBalance = customer.currentBalance || 0;
            const newBalance = previousBalance + invoice.totalAmount; // Credit reduces balance

            // 1. Add customer credit transaction (reduces what they owe us)
            await prisma.customerTransaction.create({
              data: {
                customerId: invoice.customerId,
                type: "CREDIT",
                amount: invoice.totalAmount,
                description: `Refund for deleted shipment ${shipment.trackingId}`,
                reference: `REFUND-${invoice.invoiceNumber}`,
                invoice: invoice.invoiceNumber,
                previousBalance,
                newBalance,
                createdAt: new Date()
              }
            });

            // 2. Update customer balance
            await prisma.customers.update({
              where: { id: invoice.customerId },
              data: { currentBalance: newBalance }
            });

            // 3. Create journal entry: Debit Logistics Revenue, Credit Cash
            // This reduces our revenue and reduces our cash balance for the refund
            const cashAccount = await prisma.chartOfAccount.findFirst({
              where: { accountName: { contains: 'Cash' } }
            });
            
            const logisticsRevenueAccount = await prisma.chartOfAccount.findFirst({
              where: { accountName: { contains: 'Logistics Services Revenue' } }
            });

            if (cashAccount && logisticsRevenueAccount) {
              const journalEntry = await prisma.journalEntry.create({
                data: {
                  entryNumber: `REFUND-${invoice.invoiceNumber}`,
                  date: new Date(),
                  description: `Customer refund for deleted shipment ${shipment.trackingId}`,
                  reference: `REFUND-${invoice.invoiceNumber}`,
                  totalDebit: invoice.totalAmount,
                  totalCredit: invoice.totalAmount,
                  createdAt: new Date()
                }
              });

              // Create journal entry lines
              await Promise.all([
                // Debit Logistics Revenue (reduces our revenue)
                prisma.journalEntryLine.create({
                  data: {
                    journalEntryId: journalEntry.id,
                    accountId: logisticsRevenueAccount.id,
                    debitAmount: invoice.totalAmount,
                    creditAmount: 0,
                    description: `Debit: Logistics Revenue reduced for refund`,
                    reference: `REFUND-${invoice.invoiceNumber}`
                  }
                }),
                // Credit Cash (reduces our cash balance)
                prisma.journalEntryLine.create({
                  data: {
                    journalEntryId: journalEntry.id,
                    accountId: cashAccount.id,
                    debitAmount: 0,
                    creditAmount: invoice.totalAmount,
                    description: `Credit: Cash reduced for customer refund`,
                    reference: `REFUND-${invoice.invoiceNumber}`
                  }
                })
              ]);
            } else {
              console.error('Cash or Logistics Revenue account not found for journal entry');
            }

            customerRefundsProcessed++;
            totalRefundAmount += invoice.totalAmount;
            console.log(`Customer refund processed for ${invoice.totalAmount} - Balance updated from ${previousBalance} to ${newBalance}`);
          } catch (error) {
            console.error(`Error processing customer refund:`, error);
            // Continue with other invoices even if one fails
          }
        }

        if (invoice.profile === "Vendor" && invoice.vendorId) {
          // Vendor invoice was paid - we won't get money from vendor
          // This creates a credit transaction to reduce what we owe them
          console.log(`Processing vendor payment adjustment for invoice ${invoice.invoiceNumber}`);
          
          try {
            // Get current vendor balance
            const vendor = await prisma.vendors.findUnique({
              where: { id: invoice.vendorId }
            });
            
            if (!vendor) {
              console.error(`Vendor ${invoice.vendorId} not found for payment adjustment`);
              continue;
            }
            
            const previousBalance = vendor.currentBalance || 0;
            const newBalance = previousBalance - invoice.totalAmount; // Credit reduces balance (vendor owes us money)

            // 1. Add vendor credit transaction (reduces what we owe them - they owe us money now)
            await prisma.vendorTransaction.create({
              data: {
                vendorId: invoice.vendorId,
                type: "CREDIT",
                amount: invoice.totalAmount,
                description: `Payment adjustment for deleted shipment ${shipment.trackingId}`,
                reference: `ADJUST-${invoice.invoiceNumber}`,
                invoice: invoice.invoiceNumber,
                previousBalance,
                newBalance,
                createdAt: new Date()
              }
            });

            // 2. Update vendor balance
            await prisma.vendors.update({
              where: { id: invoice.vendorId },
              data: { currentBalance: newBalance }
            });

            // 3. Create journal entry: Debit Accounts Receivable, Credit Logistics Revenue
            // This adds money to accounts receivable and reduces our revenue
            const accountsReceivableAccount = await prisma.chartOfAccount.findFirst({
              where: { accountName: { contains: 'Cash' } }
            });
            
            const vendorExpenseAccount = await prisma.chartOfAccount.findFirst({
              where: { accountName: { contains: 'Vendor Expense' } }
            });

            if (accountsReceivableAccount && vendorExpenseAccount) {
              const journalEntry = await prisma.journalEntry.create({
                data: {
                  entryNumber: `ADJUST-${invoice.invoiceNumber}`,
                  date: new Date(),
                  description: `Vendor payment adjustment for deleted shipment ${shipment.trackingId}`,
                  reference: `ADJUST-${invoice.invoiceNumber}`,
                  totalDebit: invoice.totalAmount,
                  totalCredit: invoice.totalAmount,
                  createdAt: new Date()
                }
              });

              // Create journal entry lines
              await Promise.all([
                // Debit Accounts Receivable (vendor owes us money now)
                prisma.journalEntryLine.create({
                  data: {
                    journalEntryId: journalEntry.id,
                    accountId: accountsReceivableAccount.id,
                    debitAmount: invoice.totalAmount,
                    creditAmount: 0,
                    description: `Debit: Accounts Receivable increased`,
                    reference: `ADJUST-${invoice.invoiceNumber}`
                  }
                }),
                // Credit Logistics Revenue (reduces our revenue)
                prisma.journalEntryLine.create({
                  data: {
                    journalEntryId: journalEntry.id,
                    accountId: vendorExpenseAccount.id,
                    debitAmount: 0,
                    creditAmount: invoice.totalAmount,
                    description: `Credit: Vendor Expense reduced for vendor adjustment`,
                    reference: `ADJUST-${invoice.invoiceNumber}`
                  }
                })
              ]);
            } else {
              console.error('Accounts Receivable or Vendor Expense account not found for journal entry');
            }

            vendorAdjustmentsProcessed++;
            totalAdjustmentAmount += invoice.totalAmount;
            console.log(`Vendor payment adjustment processed for ${invoice.totalAmount} - Balance updated from ${previousBalance} to ${newBalance}`);
          } catch (error) {
            console.error(`Error processing vendor payment adjustment:`, error);
            // Continue with other invoices even if one fails
          }
        }
      } else {
        // Delete related journal entries first (due to foreign key constraints)
        if (relatedJournalEntries.length > 0) {
          console.log(`Deleting ${relatedJournalEntries.length} related journal entries`);
          await prisma.journalEntry.deleteMany({
            where: {
              OR: [
                { description: { contains: "Vendor invoice" } },
                { description: { contains: "Customer invoice" } }
              ]
            }
          });
        }
        console.log(`Skipping invoice ${invoice.invoiceNumber} - Status: ${invoice.status}, Amount: ${invoice.totalAmount}`);
      }
    }

    console.log(`Financial processing summary: ${customerRefundsProcessed} customer refunds (${totalRefundAmount}), ${vendorAdjustmentsProcessed} vendor adjustments (${totalAdjustmentAmount})`);
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Track balance recalculations
    let customerBalancesRecalculated = 0;
    let vendorBalancesRecalculated = 0;


    // Delete related customer transactions ONLY for unpaid invoices
    // For paid invoices, we've already processed the financial adjustments
    const unpaidCustomerTransactions = relatedCustomerTransactions.filter(t => {
      const relatedInvoice = relatedInvoices.find(inv => 
        inv.invoiceNumber === t.invoice || 
        inv.trackingNumber === t.reference ||
        inv.shipmentId === shipmentId
      );
      return !relatedInvoice || relatedInvoice.status !== "Paid";
    });

    if (unpaidCustomerTransactions.length > 0) {
      console.log(`Deleting ${unpaidCustomerTransactions.length} unpaid customer transactions`);
      await prisma.customerTransaction.deleteMany({
        where: {
          id: { in: unpaidCustomerTransactions.map(t => t.id) }
        }
      });

      // Recalculate customer balances after deletion
      console.log('Recalculating customer balances after unpaid transaction deletion...');
      const affectedCustomers = new Set(unpaidCustomerTransactions.map(t => t.customerId));
      
      for (const customerId of affectedCustomers) {
        try {
          // Get all remaining transactions for this customer
          const remainingTransactions = await prisma.customerTransaction.findMany({
            where: { customerId },
            orderBy: { createdAt: 'asc' }
          });

          // Calculate new balance based on remaining transactions
          let newBalance = 0;
          for (const transaction of remainingTransactions) {
            if (transaction.type === 'DEBIT') {
              newBalance -= transaction.amount;
            } else if (transaction.type === 'CREDIT') {
              newBalance += transaction.amount;
            }
          }

          // Update customer balance
          await prisma.customers.update({
            where: { id: customerId },
            data: { currentBalance: newBalance }
          });

          customerBalancesRecalculated++;
          console.log(`Customer ${customerId} balance recalculated to: ${newBalance}`);
        } catch (error) {
          console.error(`Error recalculating balance for customer ${customerId}:`, error);
        }
      }
    } else {
      console.log('No unpaid customer transactions to delete - all invoices are paid');
    }

    // Delete related vendor transactions ONLY for unpaid invoices
    // For paid invoices, we've already processed the financial adjustments
    const unpaidVendorTransactions = relatedVendorTransactions.filter(t => {
      const relatedInvoice = relatedInvoices.find(inv => 
        inv.invoiceNumber === t.invoice || 
        inv.trackingNumber === t.reference ||
        inv.shipmentId === shipmentId
      );
      return !relatedInvoice || relatedInvoice.status !== "Paid";
    });

    if (unpaidVendorTransactions.length > 0) {
      console.log(`Deleting ${unpaidVendorTransactions.length} unpaid vendor transactions`);
      await prisma.vendorTransaction.deleteMany({
        where: {
          id: { in: unpaidVendorTransactions.map(t => t.id) }
        }
      });

      // Recalculate vendor balances after deletion
      console.log('Recalculating vendor balances after unpaid transaction deletion...');
      const affectedVendors = new Set(unpaidVendorTransactions.map(t => t.vendorId));
      
      for (const vendorId of affectedVendors) {
        try {
          // Get all remaining transactions for this vendor
          const remainingTransactions = await prisma.vendorTransaction.findMany({
            where: { vendorId },
            orderBy: { createdAt: 'asc' }
          });

          // Calculate new balance based on remaining transactions
          let newBalance = 0;
          for (const transaction of remainingTransactions) {
            if (transaction.type === 'DEBIT') {
              newBalance += transaction.amount;
            } else if (transaction.type === 'CREDIT') {
              newBalance -= transaction.amount;
            }
          }

          // Update vendor balance
          await prisma.vendors.update({
            where: { id: vendorId },
            data: { currentBalance: newBalance }
          });

          vendorBalancesRecalculated++;
          console.log(`Vendor ${vendorId} balance recalculated to: ${newBalance}`);
        } catch (error) {
          console.error(`Error recalculating balance for vendor ${vendorId}:`, error);
        }
      }
    } else {
      console.log('No unpaid vendor transactions to delete - all invoices are paid');
    }
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Delete related invoices first (due to foreign key constraints)
    if (relatedInvoices.length > 0) {
      console.log(`Deleting ${relatedInvoices.length} related invoices`);
      await prisma.invoice.deleteMany({
        where: {
          OR: [
            { shipmentId: shipmentId },
            { trackingNumber: shipment.trackingId },
            { invoiceNumber: shipment.invoiceNumber }
          ]
        }
      });
    }

    // Delete the shipment
    await prisma.shipment.delete({
      where: { id: shipmentId },
    });

    console.log(`Shipment ${shipmentId} and ${relatedInvoices.length} related invoices deleted successfully`);

    return NextResponse.json({ 
      success: true, 
      message: `Shipment deleted successfully. ${relatedInvoices.length} related invoices, ${relatedJournalEntries.length} journal entries, ${unpaidCustomerTransactions.length} unpaid customer transactions, and ${unpaidVendorTransactions.length} unpaid vendor transactions were also deleted. ${customerBalancesRecalculated} customer balances and ${vendorBalancesRecalculated} vendor balances were recalculated. ${customerRefundsProcessed} customer refunds and ${vendorAdjustmentsProcessed} vendor adjustments were processed for paid invoices.`,
      deletedInvoices: relatedInvoices.length,
      deletedJournalEntries: relatedJournalEntries.length,
      deletedCustomerTransactions: unpaidCustomerTransactions.length,
      deletedVendorTransactions: unpaidVendorTransactions.length,
      balanceRecalculations: {
        customers: customerBalancesRecalculated,
        vendors: vendorBalancesRecalculated
      },
      refundsProcessed: {
        customers: customerRefundsProcessed,
        vendors: vendorAdjustmentsProcessed
      },
      financialAdjustments: relatedInvoices.filter(inv => inv.status === "Paid").length,
      financialSummary: {
        customerRefundsProcessed,
        vendorAdjustmentsProcessed,
        totalRefundAmount,
        totalAdjustmentAmount
      }
    });
  } catch (error) {
    console.error("Error deleting shipment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
