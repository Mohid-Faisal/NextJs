import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

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
    const paymentId = parseInt(id);

    if (isNaN(paymentId)) {
      return NextResponse.json(
        { success: false, message: "Invalid payment ID" },
        { status: 400 }
      );
    }

    // Get the payment
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

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
    const { id } = await params;
    const paymentId = parseInt(id);
    const body = await request.json();

    // Get the payment to verify it exists
    const existingPayment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!existingPayment) {
      return NextResponse.json(
        { success: false, message: "Payment not found" },
        { status: 404 }
      );
    }

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
        mode: body.mode,
        reference: body.reference,
        description: body.description,
      },
    });

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
    const { id } = await params;
    const paymentId = parseInt(id);
    
    if (isNaN(paymentId)) {
      return NextResponse.json(
        { error: "Invalid payment ID" },
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

    // Check if payment exists
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    // Find and delete the corresponding journal entry first
    try {
      const journalEntry = await prisma.journalEntry.findFirst({
        where: {
          OR: [
            { reference: payment.reference },
            { reference: `Payment-${payment.id}` }
          ]
        },
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
    const { id } = await params;
    const paymentId = parseInt(id);
    const body = await request.json();

    if (isNaN(paymentId)) {
      return NextResponse.json(
        { success: false, message: "Invalid payment ID" },
        { status: 400 }
      );
    }

    // Get the payment to verify it exists
    const existingPayment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

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
          where: {
            OR: [
              { reference: existingPayment.reference },
              { reference: `Payment-${existingPayment.id}` }
            ]
          },
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
