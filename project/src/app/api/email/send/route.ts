import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    // Verify JWT token
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET || "your-secret-key";
    
    let decoded;
    try {
      decoded = jwt.verify(token, secret) as { id: string; [key: string]: unknown };
    } catch (error) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { recipients, subject, body, emailType } = await req.json();

    // Validate required fields
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "Recipients are required" }, { status: 400 });
    }

    if (!subject || !subject.trim()) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }

    if (!body || !body.trim()) {
      return NextResponse.json({ error: "Email body is required" }, { status: 400 });
    }

    // Get user details for recipients
    const recipientUsers = await prisma.user.findMany({
      where: {
        id: {
          in: recipients.map((r: any) => parseInt(r.id))
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true
      }
    });

    if (recipientUsers.length === 0) {
      return NextResponse.json({ error: "No valid recipients found" }, { status: 400 });
    }

    // Send emails to each recipient
    const emailPromises = recipientUsers.map(async (user) => {
      try {
        // Replace placeholders in email body
        let personalizedBody = body
          .replace(/\{\{name\}\}/g, user.name || "User")
          .replace(/\{\{email\}\}/g, user.email)
          .replace(/\{\{role\}\}/g, user.role || "User")
          .replace(/\{\{status\}\}/g, user.status || "Unknown");

        // Send email using the email service
        await sendEmail({
          to: user.email,
          subject: subject,
          html: personalizedBody.replace(/\n/g, '<br>'),
          text: personalizedBody
        });

        return { success: true, email: user.email };
      } catch (error) {
        console.error(`Failed to send email to ${user.email}:`, error);
        return { success: false, email: user.email, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    const results = await Promise.all(emailPromises);
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return NextResponse.json({
      success: true,
      message: `Emails sent successfully to ${successful.length} recipients`,
      results: {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
        details: results
      }
    });

  } catch (error) {
    console.error("Error in email send endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
