import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Default Chart of Accounts data based on the image
const defaultAccounts = [
  // Assets
  { code: "1101", accountName: "Cash", category: "Asset", type: "Current Asset", debitRule: "Increases", creditRule: "Decreases", description: "Physical cash" },
  { code: "1102", accountName: "Bank", category: "Asset", type: "Current Asset", debitRule: "Increases", creditRule: "Decreases", description: "Bank Account" },
  { code: "1103", accountName: "Accounts Receivable", category: "Asset", type: "Current Asset", debitRule: "Increases", creditRule: "Decreases", description: "Money owed by customers for transportation or logistics services" },
  { code: "1104", accountName: "Warehousing Facilities", category: "Asset", type: "Fixed Asset", debitRule: "Increases", creditRule: "Decreases", description: "Storage warehouses used in logistics operations" },
  { code: "1105", accountName: "Office Equipment", category: "Asset", type: "Fixed Asset", debitRule: "Increases", creditRule: "Decreases", description: "Office furniture, computers, and administrative equipment" },
  
  // Liabilities
  { code: "2101", accountName: "Accounts Payable", category: "Liability", type: "Current Liability", debitRule: "Decreases", creditRule: "Increases", description: "Money owed to suppliers, contractors, or vendors" },
  { code: "2102", accountName: "Taxes Payable", category: "Liability", type: "Current Liability", debitRule: "Decreases", creditRule: "Increases", description: "Taxes owed to government authorities" },
  { code: "2103", accountName: "Wages Payable", category: "Liability", type: "Current Liability", debitRule: "Decreases", creditRule: "Increases", description: "Unpaid salaries and wages owed to drivers and staff" },
  { code: "2201", accountName: "Vehicle Loan Payable", category: "Liability", type: "Non-Current Liability", debitRule: "Decreases", creditRule: "Increases", description: "Long-term loans for purchasing fleet vehicles" },
  { code: "2202", accountName: "Warehouse Mortgage Payable", category: "Liability", type: "Non-Current Liability", debitRule: "Decreases", creditRule: "Increases", description: "Mortgage loans for warehousing facilities" },
  
  // Equity
  { code: "3101", accountName: "Owner's Equity", category: "Equity", type: "Equity", debitRule: "Decreases", creditRule: "Increases", description: "Owner's initial and additional investments in the business" },
  { code: "3102", accountName: "Retained Earnings", category: "Equity", type: "Equity", debitRule: "Decreases", creditRule: "Increases", description: "Cumulative profits retained in the business for reinvestment" },
  { code: "3103", accountName: "Current Year Earnings", category: "Equity", type: "Equity", debitRule: "Decreases", creditRule: "Increases", description: "Current year's net income or loss" },
  
  // Expenses
  { code: "4101", accountName: "Vendor Expense", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "Expenses paid to vendors for transportation and logistics services" },
  { code: "4102", accountName: "Bank Charges", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "Bank charges for the bank account" },
  { code: "4103", accountName: "Equipments", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "Equipment Costs" },
  { code: "4104", accountName: "Fuel", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "Fuel" },
  { code: "4105", accountName: "Insurance", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "Insurances" },
  { code: "4106", accountName: "Legal and Accounting", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "For Legal Cases" },
  { code: "4107", accountName: "Licsense and Permit", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "Licsense and Permit" },
  { code: "4108", accountName: "Maintenance and Repair", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "Maintenance and Repair" },
  { code: "4109", accountName: "Marketing and Advertising", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "Marketing and Advertising" },
  { code: "4110", accountName: "Office Supplies", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "Supplies for the office" },
  { code: "4111", accountName: "Packaging Material", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "Packaging Material" },
  { code: "4112", accountName: "Petty", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "Small Expenses" },
  { code: "4113", accountName: "Renewals", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "Renewal of Certificates" },
  { code: "4114", accountName: "Rent", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "Rent" },
  { code: "4115", accountName: "Salary and Wages", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "Salary and Wages" },
  { code: "4116", accountName: "Taxes", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "Taxes" },
  { code: "4117", accountName: "Tools", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "Tools" },
  { code: "4118", accountName: "Transportation", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "Transportation" },
  { code: "4119", accountName: "Utilities", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "Utlities" },
  
  // Revenue
  { code: "5101", accountName: "Logistics Services Revenue", category: "Revenue", type: "Revenue", debitRule: "Decreases", creditRule: "Increases", description: "Revenue earned from logistics services" },
  { code: "5102", accountName: "Packaging Revenue", category: "Revenue", type: "Revenue", debitRule: "Decreases", creditRule: "Increases", description: "Revenue earned from Packaging" },
  { code: "5103", accountName: "Other Revenue", category: "Revenue", type: "Revenue", debitRule: "Decreases", creditRule: "Increases", description: "Revenue earned from third parties" }
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const type = searchParams.get("type") || "";
    const isActive = searchParams.get("isActive");

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { accountName: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } }
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

    // Fetch accounts with pagination
    const [accounts, total] = await Promise.all([
      prisma.chartOfAccount.findMany({
        where,
        orderBy: [
          { category: "asc" },
          { code: "asc" }
        ],
        skip,
        take: limit,
      }),
      prisma.chartOfAccount.count({ where })
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
    const body = await req.json();
    const { code, accountName, category, type, debitRule, creditRule, description } = body;

    // Validate required fields
    if (!code || !accountName || !category || !type) {
      return NextResponse.json(
        { success: false, error: "Code, account name, category, and type are required" },
        { status: 400 }
      );
    }

    // Check if account code already exists
    const existingAccount = await prisma.chartOfAccount.findUnique({
      where: { code }
    });

    if (existingAccount) {
      return NextResponse.json(
        { success: false, error: "Account code already exists" },
        { status: 400 }
      );
    }

    // Create new account
    const account = await prisma.chartOfAccount.create({
      data: {
        code,
        accountName,
        category,
        type,
        debitRule: debitRule || "",
        creditRule: creditRule || "",
        description,
        isActive: true
      }
    });

    return NextResponse.json({
      success: true,
      data: account,
      message: "Account created successfully"
    });
  } catch (error) {
    console.error("Error creating account:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create account" },
      { status: 500 }
    );
  }
}

// Initialize default accounts
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "initialize") {
      // Check if accounts already exist
      const existingCount = await prisma.chartOfAccount.count();
      
      if (existingCount > 0) {
        return NextResponse.json({
          success: false,
          error: "Chart of accounts already initialized"
        }, { status: 400 });
      }

      // Create all default accounts
      const createdAccounts = await prisma.chartOfAccount.createMany({
        data: defaultAccounts
      });

      return NextResponse.json({
        success: true,
        message: `Successfully initialized ${createdAccounts.count} default accounts`,
        count: createdAccounts.count
      });
    }

    return NextResponse.json({
      success: false,
      error: "Invalid action"
    }, { status: 400 });
  } catch (error) {
    console.error("Error initializing accounts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to initialize accounts" },
      { status: 500 }
    );
  }
}
