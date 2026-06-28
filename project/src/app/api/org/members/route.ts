import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";

import bcrypt from "bcryptjs";
import { sendEmail } from "@/lib/email";

const MANAGE_ROLES = ["OWNER", "ADMIN"];
export const ASSIGNABLE_ROLES = ["OWNER", "ADMIN", "STAFF", "ACCOUNTANT"];

export const dynamic = 'force-dynamic';

/** GET /api/org/members — list members of the current org. */
export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  try {
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { id: "asc" },
      select: {
        id: true,
        role: true,
        user: { select: { id: true, name: true, email: true, status: true } },
      },
    });

    const data = members.map((m) => ({
      id: m.id,
      role: m.role,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      userStatus: m.user.status,
      isSelf: m.user.id === session.userId,
    }));

    return NextResponse.json({ success: true, members: data, role: session.orgRole });
  } catch (error) {
    console.error("Error listing members:", error);
    return NextResponse.json({ success: false, error: "Failed to list members" }, { status: 500 });
  }
}

/**
 * POST /api/org/members — add an existing user to the org by email.
 * OWNER/ADMIN only. If the invited user does not have an account,
 * a placeholder user is created with status "INVITED" and an email invitation is sent.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  if (!MANAGE_ROLES.includes(session.orgRole)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = typeof body.role === "string" ? body.role.trim().toUpperCase() : "STAFF";

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return NextResponse.json(
        { success: false, error: `role must be one of: ${ASSIGNABLE_ROLES.join(", ")}` },
        { status: 400 }
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { name: true },
    });
    const orgName = org?.name || "our organization";

    let user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, status: true },
    });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const placeholderPassword = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(placeholderPassword, 12);
      const username = email.split("@")[0];

      user = await prisma.user.create({
        data: {
          name: username,
          email,
          password: hashedPassword,
          status: "INVITED",
          isApproved: false,
        },
        select: { id: true, name: true, email: true, status: true },
      });
    }

    const existing = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: session.organizationId, userId: user.id } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "This user is already a member of the organization." },
        { status: 409 }
      );
    }

    const member = await prisma.organizationMember.create({
      data: { organizationId: session.organizationId, userId: user.id, role },
      select: {
        id: true,
        role: true,
        user: { select: { id: true, name: true, email: true, status: true } },
      },
    });

    if (isNewUser) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const inviteLink = `${appUrl}/auth/signup?email=${encodeURIComponent(email)}`;
      try {
        await sendEmail({
          to: email,
          subject: `You've been invited to join ${orgName} on Courier Express`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h2 style="color: #1e3a8a;">Join Your Team</h2>
              <p>Hello,</p>
              <p>You have been invited to join <strong>${orgName}</strong> as a <strong>${role}</strong> on Courier Express.</p>
              <p>To accept this invitation and activate your account, please click the button below to register:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${inviteLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Activate Account
                </a>
              </div>
              <p style="color: #6b7280; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="color: #2563eb; font-size: 14px; word-break: break-all;">${inviteLink}</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Failed to send invitation email:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      invited: isNewUser,
      member: {
        id: member.id,
        role: member.role,
        userId: member.user.id,
        name: member.user.name,
        email: member.user.email,
        userStatus: member.user.status,
        isSelf: member.user.id === session.userId,
      },
    });
  } catch (error) {
    console.error("Error adding member:", error);
    return NextResponse.json({ success: false, error: "Failed to add member" }, { status: 500 });
  }
}

