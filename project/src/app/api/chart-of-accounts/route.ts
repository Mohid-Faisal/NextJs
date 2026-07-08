import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgData, orgWhere } from "@/lib/tenant/prismaScope";
import { findOrgChartAccountByCode } from "@/lib/tenant/findOrgChartAccount";
import { defaultAccounts } from "@/lib/accounts/defaultAccounts";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const type = searchParams.get("type") || "";
    const isActive = searchParams.get("isActive");

    const skip = (page - 1) * limit;

    const where: any = { ...orgWhere(session) };

    if (search) {
      where.OR = [
        { code: { contains: search} },
        { accountName: { contains: search} },
        { description: { contains: search} },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (type) {
      where.type = type;
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    const [accounts, total] = await Promise.all([
      prisma.chartOfAccount.findMany({
        where,
        orderBy: [{ category: "asc" }, { code: "asc" }],
        skip,
        take: limit,
      }),
      prisma.chartOfAccount.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: accounts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching chart of accounts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch chart of accounts" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const body = await req.json();
    const { code, accountName, category, type, debitRule, creditRule, description } = body;

    if (!code || !accountName || !category || !type) {
      return NextResponse.json(
        { success: false, error: "Code, account name, category, and type are required" },
        { status: 400 }
      );
    }

    const existingAccount = await findOrgChartAccountByCode(session, code);

    if (existingAccount) {
      return NextResponse.json(
        { success: false, error: "Account code already exists" },
        { status: 400 }
      );
    }

    const account = await prisma.chartOfAccount.create({
      data: orgData(session, {
        code,
        accountName,
        category,
        type,
        debitRule: debitRule || "",
        creditRule: creditRule || "",
        description,
        isActive: true,
      }),
    });

    return NextResponse.json({
      success: true,
      data: account,
      message: "Account created successfully",
    });
  } catch (error) {
    console.error("Error creating account:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create account" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const body = await req.json();
    const { action } = body;

    if (action === "initialize") {
      const existingCount = await prisma.chartOfAccount.count({
        where: orgWhere(session),
      });

      if (existingCount > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Chart of accounts already initialized",
          },
          { status: 400 }
        );
      }

      const createdAccounts = await prisma.chartOfAccount.createMany({
        data: defaultAccounts.map((account) =>
          orgData(session, account)
        ),
      });

      return NextResponse.json({
        success: true,
        message: `Successfully initialized ${createdAccounts.count} default accounts`,
        count: createdAccounts.count,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Invalid action",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error initializing accounts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to initialize accounts" },
      { status: 500 }
    );
  }
}
