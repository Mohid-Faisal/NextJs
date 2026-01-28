import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

const CONTACT_RECIPIENT = process.env.CONTACT_EMAIL || "psswwe@gmail.com";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { company, name, phone, email, service, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email and message are required." },
        { status: 400 }
      );
    }

    const subject = `Contact form: ${service ? `[${service}] ` : ""}from ${name}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">New contact form submission</h2>
        <p>You have received a new message from the website contact form.</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p style="margin: 0 0 8px 0;"><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
          ${company ? `<p style="margin: 0 0 8px 0;"><strong>Company:</strong> ${escapeHtml(company)}</p>` : ""}
          ${phone ? `<p style="margin: 0 0 8px 0;"><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ""}
          ${service ? `<p style="margin: 0 0 8px 0;"><strong>Service:</strong> ${escapeHtml(service)}</p>` : ""}
        </div>
        <h3 style="color: #374151;">Message</h3>
        <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 16px; border-radius: 6px; white-space: pre-wrap;">${escapeHtml(message)}</div>
        <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">Sent from PSS Worldwide contact form at ${new Date().toISOString()}</p>
      </div>
    `;
    const text = [
      `New contact from ${name} (${email})`,
      company ? `Company: ${company}` : "",
      phone ? `Phone: ${phone}` : "",
      service ? `Service: ${service}` : "",
      "",
      "Message:",
      message,
    ]
      .filter(Boolean)
      .join("\n");

    await sendEmail({
      to: CONTACT_RECIPIENT,
      subject,
      html,
      text,
    });

    return NextResponse.json({ success: true, message: "Message sent successfully." });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to send your message. Please try again or email us directly." },
      { status: 500 }
    );
  }
}

function escapeHtml(s: string): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
