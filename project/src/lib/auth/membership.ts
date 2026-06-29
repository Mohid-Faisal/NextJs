import { prisma } from "@/lib/prisma";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "org";
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  let suffix = 0;

  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    const taken = await prisma.organization.findUnique({ where: { slug: candidate } });
    if (!taken) return candidate;
    suffix++;
  }
}

export { slugify, uniqueSlug };

export type ResolvedMembership = {
  organizationId: number;
  orgRole: string;
  orgStatus: string;
  orgName: string;
  orgSlug: string;
};

/** Primary membership, or auto-link to pss-default for legacy users. */
export async function resolveMembership(userId: number): Promise<ResolvedMembership | null> {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    orderBy: { id: "asc" },
    include: {
      organization: {
        select: { id: true, name: true, slug: true, status: true },
      },
    },
  });

  if (membership) {
    return {
      organizationId: membership.organizationId,
      orgRole: membership.role,
      orgStatus: membership.organization.status,
      orgName: membership.organization.name,
      orgSlug: membership.organization.slug,
    };
  }

  const defaultOrg = await prisma.organization.findUnique({
    where: { slug: "pss-default" },
  });
  if (!defaultOrg) return null;

  const created = await prisma.organizationMember.create({
    data: {
      userId,
      organizationId: defaultOrg.id,
      role: "OWNER",
    },
    include: {
      organization: {
        select: { id: true, name: true, slug: true, status: true },
      },
    },
  });

  return {
    organizationId: created.organizationId,
    orgRole: created.role,
    orgStatus: created.organization.status,
    orgName: created.organization.name,
    orgSlug: created.organization.slug,
  };
}

export async function createOrganizationForSignup(
  companyName: string,
  userId: number,
  planCode = "starter"
): Promise<{ id: number; slug: string }> {
  const slug = await uniqueSlug(companyName);

  // Resolve the requested plan, falling back to starter so a bad/empty code
  // never blocks signup.
  const plan =
    (await prisma.plan.findUnique({ where: { code: planCode } })) ??
    (await prisma.plan.findUnique({ where: { code: "starter" } }));
  if (!plan) throw new Error("No subscription plans configured");

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  const org = await prisma.organization.create({
    data: {
      name: companyName.trim(),
      slug,
      status: "trial",
      subscription: {
        create: {
          planId: plan.id,
          status: "trialing",
          trialEndsAt,
        },
      },
      members: {
        create: {
          userId,
          role: "OWNER",
        },
      },
    },
  });

  return { id: org.id, slug: org.slug };
}
