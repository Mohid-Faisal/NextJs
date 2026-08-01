import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const DEMO_EMAIL = "demo@psswe.com";
export const DEMO_PASSWORD = "DemoUser@123";
export const DEMO_ORG_SLUG = "pss-demo";

/**
 * Guarantees that the unified Demo Account and Demo Organization exist in the database,
 * active, approved, and fully featured.
 */
export async function ensureDemoAccountExists() {
  try {
    // 1. Find or create the Demo Organization
    let org = await prisma.organization.findUnique({
      where: { slug: DEMO_ORG_SLUG },
      include: { subscription: true },
    });

    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: "Demo Workspace (Shared)",
          slug: DEMO_ORG_SLUG,
          status: "active",
          currency: "PKR",
          invoicePrefix: "DEMO-",
          website: "https://proximasmart.com",
        },
        include: { subscription: true },
      });
    }

    // 2. Ensure default plan exists or fetch first available plan for subscription
    let plan = await prisma.plan.findFirst({
      where: { code: "enterprise" },
    });

    if (!plan) {
      plan = await prisma.plan.findFirst();
    }

    if (plan && !org.subscription) {
      await prisma.subscription.create({
        data: {
          organizationId: org.id,
          planId: plan.id,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        },
      });
    }

    // 3. Hash password and upsert Demo User
    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

    const user = await prisma.user.upsert({
      where: { email: DEMO_EMAIL },
      create: {
        name: "Demo User",
        email: DEMO_EMAIL,
        password: hashedPassword,
        role: "ADMIN",
        status: "ACTIVE",
        isApproved: true,
        platformRole: null,
      },
      update: {
        status: "ACTIVE",
        isApproved: true,
        // Update password hash if needed so DEMO_PASSWORD always works
        password: hashedPassword,
      },
    });

    // 4. Ensure Organization Member link exists
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: user.id,
        },
      },
      create: {
        organizationId: org.id,
        userId: user.id,
        role: "OWNER",
      },
      update: {
        role: "OWNER",
      },
    });

    return { user, org };
  } catch (error) {
    console.error("Error ensuring demo account exists:", error);
    throw error;
  }
}
