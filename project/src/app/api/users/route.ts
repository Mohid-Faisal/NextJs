import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { sendEmployeeInvitationEmail } from '@/lib/email';
import { requireApiSession } from '@/lib/auth/requireApiSession';
import bcrypt from "bcryptjs";
import { getOrgPlan, getOrgUsage } from "@/lib/billing/usage";

export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  const isSuperAdmin = session.platformRole === "SUPER_ADMIN";
  const isOrgOwner = session.orgRole === "OWNER";
  if (!isSuperAdmin && !isOrgOwner) {
    return NextResponse.json(
      { error: "Forbidden: Only Super Admins and Org Owners can access this resource" },
      { status: 403 }
    );
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        memberships: {
          some: {
            organizationId: session.organizationId
          }
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        isApproved: true,
        createdAt: true,
        lastLoginAt: true,
        memberships: {
          where: {
            organizationId: session.organizationId
          },
          select: {
            role: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const mappedUsers = users.map(u => {
      const membership = u.memberships?.[0];
      let displayRole = u.role;
      if (membership) {
        const mRole = membership.role.toUpperCase();
        if (mRole === "OWNER" || mRole === "ADMIN") {
          displayRole = "Admin";
        } else if (mRole === "STAFF" || mRole === "ACCOUNTANT") {
          displayRole = "Employee";
        } else {
          displayRole = membership.role;
        }
      }
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: displayRole,
        status: u.status,
        isApproved: u.isApproved,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
      };
    });

    return NextResponse.json(mappedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (auth.error) return auth.error;
  const session = auth.session;

  const isSuperAdmin = session.platformRole === "SUPER_ADMIN";
  const isOrgOwner = session.orgRole === "OWNER";
  if (!isSuperAdmin && !isOrgOwner) {
    return NextResponse.json(
      { error: "Forbidden: Only Super Admins and Org Owners can access this resource" },
      { status: 403 }
    );
  }

  try {
    const plan = await getOrgPlan(session.organizationId);
    if (plan && plan.maxUsers > 0) {
      const isTrialActive =
        plan.subscriptionStatus === "trialing" &&
        plan.trialEndsAt &&
        plan.trialEndsAt.getTime() >= Date.now();
      if (!isTrialActive) {
        const usage = await getOrgUsage(session.organizationId);
        if (usage.members >= plan.maxUsers) {
          return NextResponse.json(
            { error: `Member limit reached. Your subscription plan ("${plan.name}") allows up to ${plan.maxUsers} team members.` },
            { status: 403 }
          );
        }
      }
    }

    const body = await request.json();
    const { name, email, password, role } = body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Fetch organization info to personalize invitation
    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { name: true }
    });
    const organizationName = org?.name || "our platform";

    // Create new user and organization membership in a transaction (directly active and approved)
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          name,
          email: email.trim().toLowerCase(),
          password: hashedPassword,
          role,
          status: 'ACTIVE',
          isApproved: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          isApproved: true,
          createdAt: true,
        }
      });

      await tx.organizationMember.create({
        data: {
          organizationId: session.organizationId,
          userId: u.id,
          role: role,
        }
      });

      return u;
    });

    // Send invitation email directly to employee containing login credentials
    try {
      const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/login`;
      await sendEmployeeInvitationEmail({
        employeeName: user.name,
        employeeEmail: user.email,
        initialPassword: password,
        loginUrl,
        organizationName,
      });
    } catch (emailError) {
      console.error('Failed to send employee invitation email:', emailError);
      // Don't fail user creation if email fails
    }

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
