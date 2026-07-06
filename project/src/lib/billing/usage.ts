import { prisma } from "@/lib/prisma";

/**
 * The platform owner's own workspace (legacy PSS data) is never limited.
 * Tenant orgs created via signup get real ids > 1.
 */
export const DEFAULT_ORG_ID = 1;

export type PlanFeatures = {
  accounts?: boolean;
  bulkUpload?: boolean;
  stripePriceId?: string;
  unlimited?: boolean;
  [key: string]: unknown;
};

export type OrgPlan = {
  code: string;
  name: string;
  maxUsers: number;
  maxShipmentsPerMonth: number;
  features: PlanFeatures;
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
};

export type OrgUsage = {
  shipmentsThisMonth: number;
  members: number;
};

/** Start of the current calendar month (server local time). */
export function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function asFeatures(value: unknown): PlanFeatures {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as PlanFeatures;
  }
  return {};
}

export async function getOrgPlan(organizationId: number): Promise<OrgPlan | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      subscription: {
        select: {
          status: true,
          trialEndsAt: true,
          plan: {
            select: {
              code: true,
              name: true,
              maxUsers: true,
              maxShipmentsPerMonth: true,
              features: true,
            },
          },
        },
      },
    },
  });

  const sub = org?.subscription;
  if (!sub?.plan) return null;

  return {
    code: sub.plan.code,
    name: sub.plan.name,
    maxUsers: sub.plan.maxUsers,
    maxShipmentsPerMonth: sub.plan.maxShipmentsPerMonth,
    features: asFeatures(sub.plan.features),
    subscriptionStatus: sub.status,
    trialEndsAt: sub.trialEndsAt,
  };
}

export async function getOrgUsage(organizationId: number): Promise<OrgUsage> {
  const [shipmentsThisMonth, members] = await Promise.all([
    prisma.shipment.count({
      where: { organizationId, createdAt: { gte: startOfMonth() } },
    }),
    prisma.organizationMember.count({ where: { organizationId } }),
  ]);
  return { shipmentsThisMonth, members };
}

export type LimitCheck = {
  allowed: boolean;
  reason: "ok" | "limit_reached" | "trial_expired" | "subscription_inactive";
  message?: string;
  limit: number; // -1 = unlimited
  used: number;
  planCode: string | null;
};

function isUnlimited(plan: OrgPlan): boolean {
  return plan.features.unlimited === true || plan.maxShipmentsPerMonth <= 0;
}

/**
 * Decide whether the org may create another shipment this month.
 * The platform's own default org always passes.
 */
export async function checkShipmentLimit(organizationId: number): Promise<LimitCheck> {
  if (organizationId === DEFAULT_ORG_ID) {
    return { allowed: true, reason: "ok", limit: -1, used: 0, planCode: null };
  }

  const plan = await getOrgPlan(organizationId);
  if (!plan) {
    // No subscription on record — don't hard-block, just allow.
    return { allowed: true, reason: "ok", limit: -1, used: 0, planCode: null };
  }

  // Active free trial check - bypass all limits
  const isTrialActive =
    plan.subscriptionStatus === "trialing" &&
    plan.trialEndsAt &&
    plan.trialEndsAt.getTime() >= Date.now();
  if (isTrialActive) {
    return { allowed: true, reason: "ok", limit: -1, used: 0, planCode: plan.code };
  }

  // Payment lapsed.
  if (plan.subscriptionStatus === "past_due" || plan.subscriptionStatus === "canceled") {
    return {
      allowed: false,
      reason: "subscription_inactive",
      message:
        "Your subscription is inactive. Please update billing to continue creating shipments.",
      limit: plan.maxShipmentsPerMonth,
      used: 0,
      planCode: plan.code,
    };
  }

  // Trial elapsed without converting to a paid plan.
  if (
    plan.subscriptionStatus === "trialing" &&
    plan.trialEndsAt &&
    plan.trialEndsAt.getTime() < Date.now()
  ) {
    return {
      allowed: false,
      reason: "trial_expired",
      message: "Your free trial has ended. Choose a plan to keep creating shipments.",
      limit: plan.maxShipmentsPerMonth,
      used: 0,
      planCode: plan.code,
    };
  }

  if (isUnlimited(plan)) {
    return { allowed: true, reason: "ok", limit: -1, used: 0, planCode: plan.code };
  }

  const used = await prisma.shipment.count({
    where: { organizationId, createdAt: { gte: startOfMonth() } },
  });

  if (used >= plan.maxShipmentsPerMonth) {
    return {
      allowed: false,
      reason: "limit_reached",
      message: `You've reached your plan limit of ${plan.maxShipmentsPerMonth} shipments this month. Upgrade to add more.`,
      limit: plan.maxShipmentsPerMonth,
      used,
      planCode: plan.code,
    };
  }

  return { allowed: true, reason: "ok", limit: plan.maxShipmentsPerMonth, used, planCode: plan.code };
}

export async function checkBranchLimit(organizationId: number): Promise<LimitCheck> {
  if (organizationId === DEFAULT_ORG_ID) {
    return { allowed: true, reason: "ok", limit: -1, used: 0, planCode: null };
  }

  const plan = await getOrgPlan(organizationId);
  if (!plan) {
    return { allowed: true, reason: "ok", limit: -1, used: 0, planCode: null };
  }

  // Active free trial check - bypass all limits
  const isTrialActive =
    plan.subscriptionStatus === "trialing" &&
    plan.trialEndsAt &&
    plan.trialEndsAt.getTime() >= Date.now();
  if (isTrialActive) {
    return { allowed: true, reason: "ok", limit: -1, used: 0, planCode: plan.code };
  }

  // Parse maxBranches from features
  const maxBranchesRaw = plan.features.maxBranches;
  let maxBranches = typeof maxBranchesRaw === "number"
    ? maxBranchesRaw
    : (maxBranchesRaw ? parseInt(maxBranchesRaw as string, 10) : 0);

  if (maxBranches <= 0) {
    // Default fallback limits by plan code
    if (plan.code === "starter") maxBranches = 1;
    else if (plan.code === "growth" || plan.code === "basic") maxBranches = 3;
    else maxBranches = 5; // pro/enterprise
  }

  // Count offices + agencies
  const [officesCount, agenciesCount] = await Promise.all([
    prisma.office.count({ where: { organizationId } }),
    prisma.agency.count({ where: { organizationId } }),
  ]);
  const used = officesCount + agenciesCount;

  if (used >= maxBranches) {
    return {
      allowed: false,
      reason: "limit_reached",
      message: `You've reached your plan limit of ${maxBranches} branches. Upgrade your plan to add more.`,
      limit: maxBranches,
      used,
      planCode: plan.code,
    };
  }

  return { allowed: true, reason: "ok", limit: maxBranches, used, planCode: plan.code };
}

export function planHasFeature(plan: OrgPlan | null, key: keyof PlanFeatures): boolean {
  return Boolean(plan?.features?.[key]);
}
