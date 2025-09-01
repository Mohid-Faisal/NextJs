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
    console.log("🚀 DELETE shipment request started");

    const { id } = await params;
    const shipmentId = parseInt(id);

    console.log(`📦 Processing deletion for shipment ID: ${shipmentId}`);

    if (isNaN(shipmentId)) {
      console.log("❌ Invalid shipment ID provided");
      return NextResponse.json(
        { error: "Invalid shipment ID" },
        { status: 400 }
      );
    }

    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("❌ Authorization header missing or invalid");
      return NextResponse.json(
        { error: "Authorization token required" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = decodeToken(token);

    if (!decoded) {
      console.log("❌ Invalid JWT token");
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    console.log(`👤 User authenticated: ${decoded.id}`);

    // Get the request body for password and verification code
    const body: { password: string; verificationCode?: string } =
      await request.json();
    const { password, verificationCode } = body;

    console.log(
      `🔐 Password provided: ${password ? "Yes" : "No"}, Verification code: ${
        verificationCode ? "Yes" : "No"
      }`
    );

    if (!password) {
      console.log("❌ Password missing from request");
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
      console.log(`❌ User not found in database: ${decoded.id}`);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log(`👤 User found: ${user.email}, Status: ${user.status}`);

    // Verify the password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      console.log("❌ Password verification failed");
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 401 }
      );
    }

    console.log("✅ Password verified successfully");

    // For shipments, require 2FA verification
    if (!verificationCode) {
      console.log("❌ Verification code missing");
      return NextResponse.json(
        { error: "Verification code is required for shipment deletion" },
        { status: 400 }
      );
    }

    // Verify the 2FA code
    if (user.status.startsWith("PENDING_2FA_")) {
      console.log("🔐 Processing 2FA verification");
      const statusParts = user.status.split("_");
      const storedCode = statusParts[2];
      const timestamp = parseInt(statusParts[3]);
      const currentTime = Date.now();

      console.log(
        `🔐 Stored code: ${storedCode}, Timestamp: ${timestamp}, Current time: ${currentTime}`
      );

      // Check if code has expired (10 minutes)
      if (currentTime - timestamp > 10 * 60 * 1000) {
        console.log("⏰ Verification code expired");
        // Reset user status and return error
        await prisma.user.update({
          where: { id: user.id },
          data: { status: "ACTIVE" },
        });
        return NextResponse.json(
          { error: "Verification code has expired. Please request a new one." },
          { status: 400 }
        );
      }

      // Verify the code
      if (verificationCode !== storedCode) {
        console.log(
          `❌ Verification code mismatch. Expected: ${storedCode}, Received: ${verificationCode}`
        );
        return NextResponse.json(
          { error: "Invalid verification code" },
          { status: 401 }
        );
      }

      console.log("✅ 2FA verification successful");

      // Reset user status after successful verification
      await prisma.user.update({
        where: { id: user.id },
        data: { status: "ACTIVE" },
      });

      console.log("👤 User status reset to ACTIVE");
    } else {
      console.log(
        `❌ No pending verification found. User status: ${user.status}`
      );
      return NextResponse.json(
        {
          error:
            "No pending verification found. Please request a new verification code.",
        },
        { status: 400 }
      );
    }

    console.log("🔍 Starting to retrieve shipment and related data...");

    // Check if shipment exists and get related invoices
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        // Include invoices to handle financial transactions
      },
    });

    if (!shipment) {
      console.log(`❌ Shipment ${shipmentId} not found in database`);
      return NextResponse.json(
        { error: "Shipment not found" },
        { status: 404 }
      );
    }

    console.log(
      `📦 Shipment found: ${
        shipment.trackingId || "No tracking ID"
      }, Invoice: ${shipment.invoiceNumber || "No invoice number"}`
    );

    // Find related invoices
    console.log("🔍 Searching for related invoices...");
    const relatedInvoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { shipmentId: shipmentId },
          { trackingNumber: shipment.trackingId },
          { invoiceNumber: shipment.invoiceNumber },
        ],
      },
      include: {
        customer: true,
        vendor: true,
      },
    });

    console.log(
      `📄 Found ${relatedInvoices.length} related invoices for shipment ${shipmentId}`
    );

    if (relatedInvoices.length > 0) {
      relatedInvoices.forEach((invoice, index) => {
        console.log(
          `  📄 Invoice ${index + 1}: ${invoice.invoiceNumber}, Status: ${
            invoice.status
          }, Amount: ${invoice.totalAmount}, Profile: ${invoice.profile}`
        );
      });
    }

    // Find related journal entries that were created for this shipment
    console.log("🔍 Searching for related journal entries...");
    const relatedJournalEntries = await prisma.journalEntry.findMany({
      where: {
        OR: [
          // Customer transactions search
          { reference: shipment.trackingId }, // "1"
          { description: { contains: shipment.trackingId } }, // contains "1"
          { description: { contains: shipment.invoiceNumber } }, // contains "420000"

          // Vendor transactions search
          { reference: shipment.trackingId }, // "1"
          { description: { contains: shipment.trackingId } }, // contains "1",
          { description: { contains: (parseInt(shipment.invoiceNumber) + 2).toString() } }, // contains "420002"
        ],
      },
      include: {
        lines: true,
      },
    });

    // Delete related journal entries (lines first due to foreign key constraints)
    if (relatedJournalEntries.length > 0) {
      console.log(`🗑️ Deleting ${relatedJournalEntries.length} related journal entries...`);
      
      // Delete journal entry lines first
      const journalEntryIds = relatedJournalEntries.map(entry => entry.id);
      await prisma.journalEntryLine.deleteMany({
        where: {
          journalEntryId: { in: journalEntryIds }
        }
      });
      
      // Then delete the journal entries
      await prisma.journalEntry.deleteMany({
        where: {
          id: { in: journalEntryIds }
        }
      });
      
      console.log(`✅ Successfully deleted ${relatedJournalEntries.length} journal entries and their lines`);
    }

    console.log(
      `📊 Processed ${relatedJournalEntries.length} related journal entries for shipment ${shipmentId}`
    );

    if (relatedJournalEntries.length > 0) {
      relatedJournalEntries.forEach((entry, index) => {
        console.log(
          `  📊 Journal Entry ${index + 1}: ${
            entry.entryNumber
          }, Description: ${entry.description}, Amount: ${entry.totalDebit}`
        );
      });
    }

    // Find related customer and vendor transactions
    console.log("🔍 Searching for related customer transactions...");
    const relatedCustomerTransactions =
      await prisma.customerTransaction.findMany({
        where: {
          OR: [
            { reference: shipment.trackingId },
            { invoice: shipment.invoiceNumber },
            { description: { contains: shipment.trackingId } },
            { description: { contains: shipment.invoiceNumber } },
          ],
        },
      });

    console.log("🔍 Searching for related vendor transactions...");
    const relatedVendorTransactions = await prisma.vendorTransaction.findMany({
      where: {
        OR: [
          { reference: shipment.trackingId },
          { invoice: (parseInt(shipment.invoiceNumber) + 2).toString() },
          { description: { contains: shipment.trackingId } },
          { description: { contains: (parseInt(shipment.invoiceNumber) + 2).toString() } },
        ],
      },
    });

    console.log(
      `💰 Found ${relatedCustomerTransactions.length} related customer transactions and ${relatedVendorTransactions.length} vendor transactions for shipment ${shipmentId}`
    );

    if (relatedCustomerTransactions.length > 0) {
      relatedCustomerTransactions.forEach((transaction, index) => {
        console.log(
          `  💰 Customer Transaction ${index + 1}: Type: ${
            transaction.type
          }, Amount: ${transaction.amount}, Reference: ${transaction.reference}`
        );
      });
    }

    if (relatedVendorTransactions.length > 0) {
      relatedVendorTransactions.forEach((transaction, index) => {
        console.log(
          `  💰 Vendor Transaction ${index + 1}: Type: ${
            transaction.type
          }, Amount: ${transaction.amount}, Reference: ${transaction.reference}`
        );
      });
    }

    // Handle financial transactions before deletion
    // For paid invoices, we create refund transactions instead of deleting payments
    console.log(
      "💳 Starting financial transaction processing for paid invoices..."
    );
    let customerRefundsProcessed = 0;
    let vendorAdjustmentsProcessed = 0;
    let totalRefundAmount = 0;
    let totalAdjustmentAmount = 0;

    for (const invoice of relatedInvoices) {
      // Only process invoices that are actually paid
      if (invoice.status === "Paid" && invoice.totalAmount > 0) {
        console.log(
          `💳 Processing paid invoice ${invoice.invoiceNumber} for ${invoice.profile} - Amount: ${invoice.totalAmount}`
        );

        if (invoice.profile === "Customer" && invoice.customerId) {
          // Customer invoice was paid - we need to create a refund transaction
          // This moves money from our cash account to accounts payable (to refund customer)
          console.log(
            `💳 Processing customer refund for invoice ${invoice.invoiceNumber}`
          );

          try {
            // Get current customer balance
            console.log(
              `🔍 Looking up customer ${invoice.customerId} for refund processing`
            );
            const customer = await prisma.customers.findUnique({
              where: { id: invoice.customerId },
            });

            if (!customer) {
              console.error(
                `❌ Customer ${invoice.customerId} not found for refund`
              );
              continue;
            }

            const previousBalance = customer.currentBalance || 0;
            const newBalance = previousBalance + invoice.totalAmount; // Credit reduces balance

            console.log(
              `💰 Customer ${
                customer.CompanyName || customer.id
              }: Previous balance: ${previousBalance}, New balance: ${newBalance}, Refund amount: ${
                invoice.totalAmount
              }`
            );

            // 1. Add customer credit transaction (reduces what they owe us)
            console.log(`📝 Creating customer credit transaction for refund`);
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
                createdAt: new Date(),
              },
            });

            // 2. Update customer balance
            console.log(
              `💳 Updating customer balance from ${previousBalance} to ${newBalance}`
            );
            await prisma.customers.update({
              where: { id: invoice.customerId },
              data: { currentBalance: newBalance },
            });

            // 3. Create journal entry: Debit Logistics Revenue, Credit Cash
            // This reduces our revenue and reduces our cash balance for the refund
            // // Use the journal entries we already found earlier in the code
            // console.log(
            //   `🔍 Looking for original journal entry for invoice ${invoice.invoiceNumber} from already found entries`
            // );
            // const originalJournalEntry = relatedJournalEntries.find((entry) =>
            //   entry.description?.includes(invoice.invoiceNumber)
            // );

            // let cashAccount = null;
            // let logisticsRevenueAccount = null;

            // if (originalJournalEntry && originalJournalEntry.lines.length > 0) {
            //   console.log(
            //     `📊 Found original journal entry: ${originalJournalEntry.entryNumber} with ${originalJournalEntry.lines.length} lines`
            //   );

            //   // Find the cash account from the original journal entry
            //   const cashLine = originalJournalEntry.lines.find(
            //     (line) =>
            //       line.debitAmount > 0
            //   );

            //   if (cashLine) {
            //     console.log(
            //       `💰 Found cash account from original entry: Account ID ${cashLine.accountId}`
            //     );
            //     cashAccount = await prisma.chartOfAccount.findUnique({
            //       where: { id: cashLine.accountId },
            //     });
            //     console.log(
            //       `💰 Cash account details: ${cashAccount?.accountName}`
            //     );
            //   }

            //   // Find the revenue account from the original journal entry
            //   const revenueLine = originalJournalEntry.lines.find(
            //     (line) =>
            //       line.creditAmount > 0
            //   );

            //   if (revenueLine) {
            //     console.log(
            //       `📈 Found revenue account from original entry: Account ID ${revenueLine.accountId}`
            //     );
            //     logisticsRevenueAccount =
            //       await prisma.chartOfAccount.findUnique({
            //         where: { id: revenueLine.accountId },
            //       });
            //     console.log(
            //       `📈 Revenue account details: ${logisticsRevenueAccount?.accountName}`
            //     );
            //   }
            // }

            // // Fallback to searching by name if we couldn't find from journal entries
            // if (!cashAccount) {
            //   console.log(`🔍 Fallback: Searching for cash account by name`);
            //   cashAccount = await prisma.chartOfAccount.findFirst({
            //     where: { accountName: { contains: "Cash" } },
            //   });
            // }

            // if (!logisticsRevenueAccount) {
            //   console.log(
            //     `🔍 Fallback: Searching for logistics revenue account by name`
            //   );
            //   logisticsRevenueAccount = await prisma.chartOfAccount.findFirst({
            //     where: {
            //       accountName: { contains: "Logistics Services Revenue" },
            //     },
            //   });
            // }

            // if (cashAccount && logisticsRevenueAccount) {
            //   const journalEntry = await prisma.journalEntry.create({
            //     data: {
            //       entryNumber: `REFUND-${invoice.invoiceNumber}`,
            //       date: new Date(),
            //       description: `Customer refund for deleted shipment ${shipment.trackingId}`,
            //       reference: `REFUND-${invoice.invoiceNumber}`,
            //       totalDebit: invoice.totalAmount,
            //       totalCredit: invoice.totalAmount,
            //       createdAt: new Date(),
            //     },
            //   });

            //   // Create journal entry lines
            //   await Promise.all([
            //     // Debit Logistics Revenue (reduces our revenue)
            //     prisma.journalEntryLine.create({
            //       data: {
            //         journalEntryId: journalEntry.id,
            //         accountId: logisticsRevenueAccount.id,
            //         debitAmount: invoice.totalAmount,
            //         creditAmount: 0,
            //         description: `Debit: Logistics Revenue reduced for refund`,
            //         reference: `REFUND-${invoice.invoiceNumber}`,
            //       },
            //     }),
            //     // Credit Cash (reduces our cash balance)
            //     prisma.journalEntryLine.create({
            //       data: {
            //         journalEntryId: journalEntry.id,
            //         accountId: cashAccount.id,
            //         debitAmount: 0,
            //         creditAmount: invoice.totalAmount,
            //         description: `Credit: Cash reduced for customer refund`,
            //         reference: `REFUND-${invoice.invoiceNumber}`,
            //       },
            //     }),
            //   ]);
            // } else {
            //   console.error(
            //     "Cash or Logistics Revenue account not found for journal entry"
            //   );
            // }

            customerRefundsProcessed++;
            totalRefundAmount += invoice.totalAmount;
            console.log(
              `Customer refund processed for ${invoice.totalAmount} - Balance updated from ${previousBalance} to ${newBalance}`
            );
          } catch (error) {
            console.error(`Error processing customer refund:`, error);
            // Continue with other invoices even if one fails
          }
        }

        if (invoice.profile === "Vendor" && invoice.vendorId) {
          // Vendor invoice was paid - we won't get money from vendor
          // This creates a credit transaction to reduce what we owe them
          console.log(
            `Processing vendor payment adjustment for invoice ${invoice.invoiceNumber}`
          );

          try {
            // Get current vendor balance
            const vendor = await prisma.vendors.findUnique({
              where: { id: invoice.vendorId },
            });

            if (!vendor) {
              console.error(
                `Vendor ${invoice.vendorId} not found for payment adjustment`
              );
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
                createdAt: new Date(),
              },
            });

            // 2. Update vendor balance
            await prisma.vendors.update({
              where: { id: invoice.vendorId },
              data: { currentBalance: newBalance },
            });

            // 3. Create journal entry: Debit Accounts Receivable, Credit Logistics Revenue
            // This adds money to accounts receivable and reduces our revenue
            // Use the journal entries we already found earlier in the code
            // console.log(
            //   `🔍 Looking for original journal entry for vendor invoice ${invoice.invoiceNumber} from already found entries`
            // );
            // const originalVendorJournalEntry = relatedJournalEntries.find(
            //   (entry) => entry.description?.includes(invoice.invoiceNumber)
            // );

            // let accountsReceivableAccount = null;
            // let vendorExpenseAccount = null;

            // if (
            //   originalVendorJournalEntry &&
            //   originalVendorJournalEntry.lines.length > 0
            // ) {
            //   console.log(
            //     `📊 Found original vendor journal entry: ${originalVendorJournalEntry.entryNumber} with ${originalVendorJournalEntry.lines.length} lines`
            //   );

            //   // Find the accounts used for payment from the original journal entry
            //   const arLine = originalVendorJournalEntry.lines.find(
            //     (line) =>
            //       line.creditAmount > 0
            //   );

            //   if (arLine) {
            //     console.log(
            //       `📋 Found accounts receivable account from original entry: Account ID ${arLine.accountId}`
            //     );
            //     accountsReceivableAccount =
            //       await prisma.chartOfAccount.findUnique({
            //         where: { id: arLine.accountId },
            //       });
            //     console.log(
            //       `📋 AR account details: ${accountsReceivableAccount?.accountName}`
            //     );
            //   }

            //   // Find the expense account from the original journal entry
            //   const expenseLine = originalVendorJournalEntry.lines.find(
            //     (line) =>
            //       line.debitAmount > 0
            //   );

            //   if (expenseLine) {
            //     console.log(
            //       `💸 Found vendor expense account from original entry: Account ID ${expenseLine.accountId}`
            //     );
            //     vendorExpenseAccount = await prisma.chartOfAccount.findUnique({
            //       where: { id: expenseLine.accountId },
            //     });
            //     console.log(
            //       `💸 Expense account details: ${vendorExpenseAccount?.accountName}`
            //     );
            //   }
            // }

            // // Fallback to searching by name if we couldn't find from journal entries
            // if (!accountsReceivableAccount) {
            //   console.log(
            //     `🔍 Fallback: Searching for accounts receivable account by name`
            //   );
            //   accountsReceivableAccount = await prisma.chartOfAccount.findFirst(
            //     {
            //       where: { accountName: { contains: "Cash" } },
            //     }
            //   );
            // }

            // if (!vendorExpenseAccount) {
            //   console.log(
            //     `🔍 Fallback: Searching for vendor expense account by name`
            //   );
            //   vendorExpenseAccount = await prisma.chartOfAccount.findFirst({
            //     where: { accountName: { contains: "Vendor Expense" } },
            //   });
            // }

            // if (accountsReceivableAccount && vendorExpenseAccount) {
            //   const journalEntry = await prisma.journalEntry.create({
            //     data: {
            //       entryNumber: `ADJUST-${invoice.invoiceNumber}`,
            //       date: new Date(),
            //       description: `Vendor payment adjustment for deleted shipment ${shipment.trackingId}`,
            //       reference: `ADJUST-${invoice.invoiceNumber}`,
            //       totalDebit: invoice.totalAmount,
            //       totalCredit: invoice.totalAmount,
            //       createdAt: new Date(),
            //     },
            //   });

            //   // Create journal entry lines
            //   await Promise.all([
            //     // Debit Accounts Receivable (vendor owes us money now)
            //     prisma.journalEntryLine.create({
            //       data: {
            //         journalEntryId: journalEntry.id,
            //         accountId: accountsReceivableAccount.id,
            //         debitAmount: invoice.totalAmount,
            //         creditAmount: 0,
            //         description: `Debit: Accounts Receivable increased`,
            //         reference: `ADJUST-${invoice.invoiceNumber}`,
            //       },
            //     }),
            //     // Credit Logistics Revenue (reduces our revenue)
            //     prisma.journalEntryLine.create({
            //       data: {
            //         journalEntryId: journalEntry.id,
            //         accountId: vendorExpenseAccount.id,
            //         debitAmount: 0,
            //         creditAmount: invoice.totalAmount,
            //         description: `Credit: Vendor Expense reduced for vendor adjustment`,
            //         reference: `ADJUST-${invoice.invoiceNumber}`,
            //       },
            //     }),
            //   ]);
            // } else {
            //   console.error(
            //     "Accounts Receivable or Vendor Expense account not found for journal entry"
            //   );
            // }

            vendorAdjustmentsProcessed++;
            totalAdjustmentAmount += invoice.totalAmount;
            console.log(
              `Vendor payment adjustment processed for ${invoice.totalAmount} - Balance updated from ${previousBalance} to ${newBalance}`
            );
          } catch (error) {
            console.error(`Error processing vendor payment adjustment:`, error);
            // Continue with other invoices even if one fails
          }
        }
      } else {
        console.log(
          `Skipping invoice ${invoice.invoiceNumber} - Status: ${invoice.status}, Amount: ${invoice.totalAmount}`
        );
      }
    }

    console.log(
      `Financial processing summary: ${customerRefundsProcessed} customer refunds (${totalRefundAmount}), ${vendorAdjustmentsProcessed} vendor adjustments (${totalAdjustmentAmount})`
    );
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Track balance recalculations
    let customerBalancesRecalculated = 0;
    let vendorBalancesRecalculated = 0;

    // Delete related customer transactions ONLY for unpaid invoices
    // For paid invoices, we've already processed the financial adjustments
    const unpaidCustomerTransactions = relatedCustomerTransactions.filter(
      (t) => {
        const relatedInvoice = relatedInvoices.find(
          (inv) =>
            inv.invoiceNumber === t.invoice ||
            inv.trackingNumber === t.reference ||
            inv.shipmentId === shipmentId
        );
        return !relatedInvoice || relatedInvoice.status !== "Paid";
      }
    );

    if (unpaidCustomerTransactions.length > 0) {
      console.log(
        `Deleting ${unpaidCustomerTransactions.length} unpaid customer transactions`
      );
      await prisma.customerTransaction.deleteMany({
        where: {
          id: { in: unpaidCustomerTransactions.map((t) => t.id) },
        },
      });

      // Recalculate customer balances after deletion
      console.log(
        "Recalculating customer balances after unpaid transaction deletion..."
      );
      const affectedCustomers = new Set(
        unpaidCustomerTransactions.map((t) => t.customerId)
      );

      for (const customerId of affectedCustomers) {
        try {
          // Get all remaining transactions for this customer
          const remainingTransactions =
            await prisma.customerTransaction.findMany({
              where: { customerId },
              orderBy: { createdAt: "asc" },
            });

          // Calculate new balance based on remaining transactions
          let newBalance = 0;
          for (const transaction of remainingTransactions) {
            if (transaction.type === "DEBIT") {
              newBalance -= transaction.amount;
            } else if (transaction.type === "CREDIT") {
              newBalance += transaction.amount;
            }
          }

          // Update customer balance
          await prisma.customers.update({
            where: { id: customerId },
            data: { currentBalance: newBalance },
          });

          customerBalancesRecalculated++;
          console.log(
            `Customer ${customerId} balance recalculated to: ${newBalance}`
          );
        } catch (error) {
          console.error(
            `Error recalculating balance for customer ${customerId}:`,
            error
          );
        }
      }
    } else {
      console.log(
        "No unpaid customer transactions to delete - all invoices are paid"
      );
    }

    // Delete related vendor transactions ONLY for unpaid invoices
    // For paid invoices, we've already processed the financial adjustments
    const unpaidVendorTransactions = relatedVendorTransactions.filter((t) => {
      const relatedInvoice = relatedInvoices.find(
        (inv) =>
          inv.invoiceNumber === t.invoice ||
          inv.trackingNumber === t.reference ||
          inv.shipmentId === shipmentId
      );
      return !relatedInvoice || relatedInvoice.status !== "Paid";
    });

    if (unpaidVendorTransactions.length > 0) {
      console.log(
        `Deleting ${unpaidVendorTransactions.length} unpaid vendor transactions`
      );
      await prisma.vendorTransaction.deleteMany({
        where: {
          id: { in: unpaidVendorTransactions.map((t) => t.id) },
        },
      });

      // Recalculate vendor balances after deletion
      console.log(
        "Recalculating vendor balances after unpaid transaction deletion..."
      );
      const affectedVendors = new Set(
        unpaidVendorTransactions.map((t) => t.vendorId)
      );

      for (const vendorId of affectedVendors) {
        try {
          // Get all remaining transactions for this vendor
          const remainingTransactions = await prisma.vendorTransaction.findMany(
            {
              where: { vendorId },
              orderBy: { createdAt: "asc" },
            }
          );

          // Calculate new balance based on remaining transactions
          let newBalance = 0;
          for (const transaction of remainingTransactions) {
            if (transaction.type === "DEBIT") {
              newBalance += transaction.amount;
            } else if (transaction.type === "CREDIT") {
              newBalance -= transaction.amount;
            }
          }

          // Update vendor balance
          await prisma.vendors.update({
            where: { id: vendorId },
            data: { currentBalance: newBalance },
          });

          vendorBalancesRecalculated++;
          console.log(
            `Vendor ${vendorId} balance recalculated to: ${newBalance}`
          );
        } catch (error) {
          console.error(
            `Error recalculating balance for vendor ${vendorId}:`,
            error
          );
        }
      }
    } else {
      console.log(
        "No unpaid vendor transactions to delete - all invoices are paid"
      );
    }
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Delete related invoices first (due to foreign key constraints)
    if (relatedInvoices.length > 0) {
      console.log(`🗑️ Deleting ${relatedInvoices.length} related invoices...`);
      await prisma.invoice.deleteMany({
        where: {
          OR: [
            { shipmentId: shipmentId },
            { trackingNumber: shipment.trackingId },
            { invoiceNumber: shipment.invoiceNumber },
          ],
        },
      });
      console.log(
        `✅ Successfully deleted ${relatedInvoices.length} related invoices`
      );
    }

    // Delete the shipment
    console.log(`🗑️ Deleting shipment ${shipmentId}...`);
    await prisma.shipment.delete({
      where: { id: shipmentId },
    });
    console.log(`✅ Successfully deleted shipment ${shipmentId}`);

    console.log(
      `🎉 Shipment ${shipmentId} and ${relatedInvoices.length} related invoices deleted successfully`
    );

    console.log("🎉 Shipment deletion completed successfully!");
    console.log(`📊 Final Summary:`);
    console.log(`  - Deleted invoices: ${relatedInvoices.length}`);
    console.log(`  - Deleted journal entries: ${relatedJournalEntries.length}`);
    console.log(
      `  - Deleted customer transactions: ${unpaidCustomerTransactions.length}`
    );
    console.log(
      `  - Deleted vendor transactions: ${unpaidVendorTransactions.length}`
    );
    console.log(
      `  - Customer balances recalculated: ${customerBalancesRecalculated}`
    );
    console.log(
      `  - Vendor balances recalculated: ${vendorBalancesRecalculated}`
    );
    console.log(`  - Customer refunds processed: ${customerRefundsProcessed}`);
    console.log(
      `  - Vendor adjustments processed: ${vendorAdjustmentsProcessed}`
    );
    console.log(`  - Total refund amount: ${totalRefundAmount}`);
    console.log(`  - Total adjustment amount: ${totalAdjustmentAmount}`);

    return NextResponse.json({
      success: true,
      message: `Shipment deleted successfully. ${relatedInvoices.length} related invoices, ${relatedJournalEntries.length} journal entries, ${unpaidCustomerTransactions.length} unpaid customer transactions, and ${unpaidVendorTransactions.length} unpaid vendor transactions were also deleted. ${customerBalancesRecalculated} customer balances and ${vendorBalancesRecalculated} vendor balances were recalculated. ${customerRefundsProcessed} customer refunds and ${vendorAdjustmentsProcessed} vendor adjustments were processed for paid invoices.`,
      deletedInvoices: relatedInvoices.length,
      deletedJournalEntries: relatedJournalEntries.length,
      deletedCustomerTransactions: unpaidCustomerTransactions.length,
      deletedVendorTransactions: unpaidVendorTransactions.length,
      balanceRecalculations: {
        customers: customerBalancesRecalculated,
        vendors: vendorBalancesRecalculated,
      },
      refundsProcessed: {
        customers: customerRefundsProcessed,
        vendors: vendorAdjustmentsProcessed,
      },
      financialAdjustments: relatedInvoices.filter(
        (inv) => inv.status === "Paid"
      ).length,
      financialSummary: {
        customerRefundsProcessed,
        vendorAdjustmentsProcessed,
        totalRefundAmount,
        totalAdjustmentAmount,
      },
    });
  } catch (error) {
    console.error("💥 ERROR during shipment deletion:", error);
    console.error("💥 Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : "No stack trace",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
