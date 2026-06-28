import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { calculateInvoicePaymentStatus } from "@/lib/utils";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgWhere } from "@/lib/tenant/prismaScope";
import { findOrgPayment } from "@/lib/tenant/findOrgPayment";
import { findOrgInvoiceByNumber } from "@/lib/tenant/findOrgPayment";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiSession(request);
    if (auth.error) return auth.error;
    const session = auth.session;

    const { id } = await params;
    const paymentId = parseInt(id);

    if (isNaN(paymentId)) {
      return NextResponse.json(
        { success: false, message: "Invalid payment ID" },
        { status: 400 }
      );
    }

    const payment = await findOrgPayment(session, paymentId);

    if (!payment) {
      return NextResponse.json(
        { success: false, message: "Payment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        transactionType: payment.transactionType,
        category: payment.category,
        date: payment.date,
        amount: payment.amount,
        fromPartyType: payment.fromPartyType,
        fromCustomerId: payment.fromCustomerId,
        fromCustomer: payment.fromCustomer,
        toPartyType: payment.toPartyType,
        toVendorId: payment.toVendorId,
        toVendor: payment.toVendor,
        mode: payment.mode,
        reference: payment.reference,
        description: payment.description,
        invoice: payment.invoice,
      },
    });
  } catch (error) {
    console.error("Get payment error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch payment" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiSession(request);
    if (auth.error) return auth.error;
    const session = auth.session;

    const { id } = await params;
    const paymentId = parseInt(id);
    const body = await request.json();

    const existingPayment = await findOrgPayment(session, paymentId);

    if (!existingPayment) {
      return NextResponse.json(
        { success: false, message: "Payment not found" },
        { status: 404 }
      );
    }

    // Store old values for comparison
    const oldAmount = existingPayment.amount;
    const oldDate = existingPayment.date;
    const oldDescription = existingPayment.description;
    const oldReference = existingPayment.reference;
    const oldInvoice = existingPayment.invoice;

    // Update the payment
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        transactionType: body.transactionType,
        category: body.category,
        date: body.date,
        amount: body.amount,
        fromPartyType: body.fromPartyType,
        fromCustomerId: body.fromCustomerId,
        toPartyType: body.toPartyType,
        toVendorId: body.toVendorId,
        mode: body.paymentMethod,
        reference: body.reference,
        description: body.description,
      },
    });

    // Update customer/vendor transactions if payment is linked to an invoice
    // IMPORTANT: Invoice/shipment lines use the same invoice# as reference with type DEBIT.
    // Payments are type CREDIT. Without `type: 'CREDIT'`, findFirst could match the invoice DEBIT and corrupt it.
    if (existingPayment.invoice) {
      try {
        const paymentReference = existingPayment.reference || `Payment-${paymentId}`;
        const newDate = new Date(body.date);
        const newAmountNum = Number(body.amount);
        const amountDelta = newAmountNum - oldAmount;

        // Customer paying us (INCOME): ledger line is CREDIT (not the shipment DEBIT)
        if (existingPayment.fromCustomerId && existingPayment.transactionType === "INCOME") {
          const customerTransaction = await prisma.customerTransaction.findFirst({
            where: orgWhere(session, {
              customerId: existingPayment.fromCustomerId,
              invoice: existingPayment.invoice,
              reference: paymentReference,
              type: "CREDIT",
            }),
          });

          if (customerTransaction) {
            if (amountDelta !== 0) {
              const cust = await prisma.customers.findFirst({
                where: orgWhere(session, { id: existingPayment.fromCustomerId }),
              });
              if (cust) {
                await prisma.customers.update({
                  where: { id: cust.id },
                  data: { currentBalance: cust.currentBalance + amountDelta },
                });
              }
            }
            await prisma.customerTransaction.update({
              where: { id: customerTransaction.id },
              data: {
                amount: newAmountNum,
                description:
                  body.description || `Payment for invoice ${existingPayment.invoice}`,
                createdAt: newDate,
              },
            });
            console.log(`Updated customer CREDIT transaction ${customerTransaction.id} for payment ${paymentId}`);
          }
        }

        // We pay vendor (EXPENSE): payment line is CREDIT (not the shipment/vendor DEBIT)
        if (existingPayment.toVendorId && existingPayment.transactionType === "EXPENSE") {
          const vendorTransaction = await prisma.vendorTransaction.findFirst({
            where: orgWhere(session, {
              vendorId: existingPayment.toVendorId,
              invoice: existingPayment.invoice,
              reference: paymentReference,
              type: "CREDIT",
            }),
          });

          if (vendorTransaction) {
            if (amountDelta !== 0) {
              const ven = await prisma.vendors.findFirst({
                where: orgWhere(session, { id: existingPayment.toVendorId }),
              });
              if (ven) {
                await prisma.vendors.update({
                  where: { id: ven.id },
                  data: { currentBalance: ven.currentBalance - amountDelta },
                });
              }
            }
            await prisma.vendorTransaction.update({
              where: { id: vendorTransaction.id },
              data: {
                amount: newAmountNum,
                description:
                  body.description || `Payment for invoice ${existingPayment.invoice}`,
                createdAt: newDate,
              },
            });
            console.log(`Updated vendor CREDIT transaction ${vendorTransaction.id} for payment ${paymentId}`);
          }
        }
      } catch (transactionError) {
        console.error("Error updating customer/vendor transactions:", transactionError);
        // Don't fail the payment update if transaction update fails
      }
    }

    // If updateJournalEntry flag is true, update the corresponding journal entry
    if (body.updateJournalEntry && body.debitAccountId && body.creditAccountId) {
      try {
        console.log(`Updating journal entry for payment ${paymentId}`);
        
        // Find the journal entry for this payment
        const journalEntry = await prisma.journalEntry.findFirst({
          where: orgWhere(session, {
            OR: [
              { reference: existingPayment.reference },
              { reference: `Payment-${existingPayment.id}` }
            ]
          }),
        });

        if (journalEntry) {
          console.log(`Found journal entry ${journalEntry.entryNumber} for payment ${paymentId}`);
          
          // Update the journal entry
          await prisma.journalEntry.update({
            where: { id: journalEntry.id },
            data: {
              date: new Date(body.date),
              description: `Payment: ${body.category} - ${body.description || 'No description'}`,
              reference: body.reference || `Payment-${paymentId}`,
              totalDebit: Number(body.amount),
              totalCredit: Number(body.amount),
            },
          });

          // Delete existing journal entry lines
          await prisma.journalEntryLine.deleteMany({
            where: { journalEntryId: journalEntry.id },
          });

          // Create new journal entry lines with updated accounts
          await Promise.all([
            // Debit line
            prisma.journalEntryLine.create({
              data: {
                journalEntryId: journalEntry.id,
                accountId: body.debitAccountId,
                debitAmount: Number(body.amount),
                creditAmount: 0,
                description: `Debit: ${body.category}`,
                reference: body.reference || `Payment-${paymentId}`
              }
            }),
            // Credit line
            prisma.journalEntryLine.create({
              data: {
                journalEntryId: journalEntry.id,
                accountId: body.creditAccountId,
                debitAmount: 0,
                creditAmount: Number(body.amount),
                description: `Credit: ${body.category}`,
                reference: body.reference || `Payment-${paymentId}`
              }
            })
          ]);

          console.log(`Updated journal entry ${journalEntry.entryNumber} with new accounts and amount`);
        } else {
          console.log(`No journal entry found for payment ${paymentId}`);
        }
      } catch (journalError) {
        console.error("Journal entry update error:", journalError);
        // Don't fail the payment update if journal entry update fails
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment updated successfully",
      data: updatedPayment,
    });
  } catch (error) {
    console.error("Update payment error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update payment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiSession(request);
    if (auth.error) return auth.error;
    const session = auth.session;

    const { id } = await params;
    const paymentId = parseInt(id);
    
    if (isNaN(paymentId)) {
      return NextResponse.json(
        { error: "Invalid payment ID" },
        { status: 400 }
      );
    }

    const body: { password: string } = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: "Password is required for deletion" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 401 }
      );
    }

    const payment = await findOrgPayment(session, paymentId);

    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    // Delete customer/vendor transactions associated with this payment (CREDIT rows only — never invoice DEBIT)
    try {
      if (payment.fromCustomerId && payment.transactionType === "INCOME") {
        const customerTransactions = await prisma.customerTransaction.findMany({
          where: orgWhere(session, {
            customerId: payment.fromCustomerId,
            reference: payment.reference || `Payment-${payment.id}`,
            invoice: payment.invoice || undefined,
            type: "CREDIT",
          }),
        });

        for (const transaction of customerTransactions) {
          await prisma.customerTransaction.delete({
            where: { id: transaction.id },
          });
          console.log(`Deleted customer CREDIT transaction ${transaction.id}`);
        }

        // Also delete allocation transactions (excess payments allocated to other invoices)
        if (payment.invoice) {
          const allocationTransactions = await prisma.customerTransaction.findMany({
            where: orgWhere(session, {
              customerId: payment.fromCustomerId,
              reference: {
                startsWith: `CREDIT-${payment.invoice}`
              }
            }),
          });

          for (const transaction of allocationTransactions) {
            await prisma.customerTransaction.delete({
              where: { id: transaction.id }
            });
            console.log(`Deleted customer allocation transaction ${transaction.id}`);
          }
        }
      }

      if (payment.toVendorId && payment.transactionType === "EXPENSE") {
        const vendorTransactions = await prisma.vendorTransaction.findMany({
          where: orgWhere(session, {
            vendorId: payment.toVendorId,
            reference: payment.reference || `Payment-${payment.id}`,
            invoice: payment.invoice || undefined,
            type: "CREDIT",
          }),
        });

        for (const transaction of vendorTransactions) {
          await prisma.vendorTransaction.delete({
            where: { id: transaction.id },
          });
          console.log(`Deleted vendor CREDIT transaction ${transaction.id}`);
        }

        // Also delete allocation transactions (excess payments allocated to other invoices)
        if (payment.invoice) {
          const allocationTransactions = await prisma.vendorTransaction.findMany({
            where: orgWhere(session, {
              vendorId: payment.toVendorId,
              reference: {
                startsWith: `CREDIT-${payment.invoice}`
              }
            }),
          });

          for (const transaction of allocationTransactions) {
            await prisma.vendorTransaction.delete({
              where: { id: transaction.id }
            });
            console.log(`Deleted vendor allocation transaction ${transaction.id}`);
          }
        }
      }
    } catch (transactionError) {
      console.error("Error deleting customer/vendor transactions:", transactionError);
      // Continue with deletion even if transaction deletion fails
    }

    // Recalculate and update invoice status
    if (payment.invoice) {
      try {
        const invoice = await findOrgInvoiceByNumber(session, payment.invoice);

        if (invoice) {
          const paymentStatus = await calculateInvoicePaymentStatus(
            prisma,
            payment.invoice,
            invoice.totalAmount
          );

          await prisma.invoice.update({
            where: { invoiceNumber: payment.invoice },
            data: { status: paymentStatus.status }
          });

          console.log(`Updated invoice ${payment.invoice} status to ${paymentStatus.status}`);
        }
      } catch (invoiceError) {
        console.error("Error updating invoice status:", invoiceError);
        // Continue with deletion even if invoice update fails
      }
    }

    // Find and delete the corresponding journal entry
    try {
      const journalEntry = await prisma.journalEntry.findFirst({
        where: orgWhere(session, {
          OR: [
            { reference: payment.reference },
            { reference: `Payment-${payment.id}` }
          ]
        }),
      });

      if (journalEntry) {
        console.log(`Found journal entry ${journalEntry.entryNumber} for payment ${payment.id}, deleting...`);
        
        // Delete the journal entry lines first (due to foreign key constraints)
        await prisma.journalEntryLine.deleteMany({
          where: { journalEntryId: journalEntry.id },
        });
        
        // Delete the journal entry
        await prisma.journalEntry.delete({
          where: { id: journalEntry.id },
        });
        
        console.log(`Deleted journal entry ${journalEntry.entryNumber} and its lines`);
      } else {
        console.log(`No journal entry found for payment ${payment.id}`);
      }
    } catch (journalError) {
      console.error("Error deleting journal entry:", journalError);
      // Continue with payment deletion even if journal entry deletion fails
    }

    // Delete the payment
    await prisma.payment.delete({
      where: { id: paymentId },
    });

    return NextResponse.json({ 
      success: true, 
      message: "Payment deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting payment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiSession(request);
    if (auth.error) return auth.error;
    const session = auth.session;

    const { id } = await params;
    const paymentId = parseInt(id);
    const body = await request.json();

    if (isNaN(paymentId)) {
      return NextResponse.json(
        { success: false, message: "Invalid payment ID" },
        { status: 400 }
      );
    }

    const existingPayment = await findOrgPayment(session, paymentId);

    if (!existingPayment) {
      return NextResponse.json(
        { success: false, message: "Payment not found" },
        { status: 404 }
      );
    }

    // Only allow amount updates in PATCH method
    if (body.amount === undefined) {
      return NextResponse.json(
        { success: false, message: "Amount is required for update" },
        { status: 400 }
      );
    }

    // Update only the amount
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        amount: parseFloat(body.amount),
      },
    });

    // If updateJournalEntry flag is true, update the corresponding journal entry
    if (body.updateJournalEntry) {
      try {
        console.log(`Looking for journal entry for payment ${existingPayment.id}`);
        console.log(`Payment reference: ${existingPayment.reference}`);
        console.log(`Payment ID: ${existingPayment.id}`);
        
        // Find and update the journal entry
        // Journal entries are linked to payments through the reference field
        // The reference can be either the payment's reference or "Payment-{paymentId}"
        const journalEntry = await prisma.journalEntry.findFirst({
          where: orgWhere(session, {
            OR: [
              { reference: existingPayment.reference },
              { reference: `Payment-${existingPayment.id}` }
            ]
          }),
        });

        if (journalEntry) {
          console.log(`Found journal entry ${journalEntry.entryNumber} for payment ${existingPayment.id}`);
          console.log(`Journal entry reference: ${journalEntry.reference}`);
          
          // Update the journal entry total amounts
          await prisma.journalEntry.update({
            where: { id: journalEntry.id },
            data: {
              totalDebit: parseFloat(body.amount),
              totalCredit: parseFloat(body.amount),
            },
          });

          // Update the journal entry lines amounts
          // We need to update the lines based on whether they are debit or credit lines
          const journalLines = await prisma.journalEntryLine.findMany({
            where: { journalEntryId: journalEntry.id },
          });

          console.log(`Found ${journalLines.length} journal entry lines`);

          for (const line of journalLines) {
            if (line.debitAmount > 0) {
              // This is a debit line, update the debit amount
              await prisma.journalEntryLine.update({
                where: { id: line.id },
                data: { debitAmount: parseFloat(body.amount) },
              });
              console.log(`Updated debit line ${line.id} with amount ${body.amount}`);
            } else if (line.creditAmount > 0) {
              // This is a credit line, update the credit amount
              await prisma.journalEntryLine.update({
                where: { id: line.id },
                data: { creditAmount: parseFloat(body.amount) },
              });
              console.log(`Updated credit line ${line.id} with amount ${body.amount}`);
            }
          }

          console.log(`Updated journal entry ${journalEntry.entryNumber} with new amount: ${body.amount}`);
        } else {
          console.log(`No journal entry found for payment ${existingPayment.id}`);
          
          // Let's also check what journal entries exist to help debug
          const allJournalEntries = await prisma.journalEntry.findMany({
            where: orgWhere(session),
            take: 10,
            orderBy: { createdAt: 'desc' }
          });
          console.log(`Recent journal entries:`, allJournalEntries.map(je => ({
            id: je.id,
            entryNumber: je.entryNumber,
            reference: je.reference,
            totalDebit: je.totalDebit,
            totalCredit: je.totalCredit
          })));
        }
      } catch (journalError) {
        console.error("Journal entry update error:", journalError);
        // Don't fail the payment update if journal entry update fails
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment amount updated successfully",
      payment: updatedPayment,
    });
  } catch (error) {
    console.error("PATCH payment error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update payment amount" },
      { status: 500 }
    );
  }
}
