import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Default Chart of Accounts data based on the image
const defaultAccounts = [
  // Assets
  { code: "1101", accountName: "Cash", category: "Asset", type: "Current Asset", debitRule: "Increases", creditRule: "Decreases", description: "Physical cash and bank accounts" },
  { code: "1102", accountName: "Accounts Receivable", category: "Asset", type: "Current Asset", debitRule: "Increases", creditRule: "Decreases", description: "Money owed by customers for transportation or logistics services" },
  { code: "1103", accountName: "Fuel Inventory", category: "Asset", type: "Current Asset", debitRule: "Increases", creditRule: "Decreases", description: "Fuel stock for transportation vehicles" },
  { code: "1104", accountName: "Spare Parts Inventory", category: "Asset", type: "Current Asset", debitRule: "Increases", creditRule: "Decreases", description: "Spare parts and accessories for vehicle maintenance" },
  { code: "1105", accountName: "Fleet Vehicles", category: "Asset", type: "Fixed Asset", debitRule: "Increases", creditRule: "Decreases", description: "Trucks, vans, and other vehicles used for transportation" },
  { code: "1106", accountName: "Warehousing Facilities", category: "Asset", type: "Fixed Asset", debitRule: "Increases", creditRule: "Decreases", description: "Storage warehouses used in logistics operations" },
  { code: "1107", accountName: "Office Equipment", category: "Asset", type: "Fixed Asset", debitRule: "Increases", creditRule: "Decreases", description: "Office furniture, computers, and administrative equipment" },
  { code: "1108", accountName: "Prepaid Insurance", category: "Asset", type: "Prepayment", debitRule: "Increases", creditRule: "Decreases", description: "Insurance premiums paid in advance for vehicles and cargo" },
  { code: "1109", accountName: "Prepaid Rent", category: "Asset", type: "Prepayment", debitRule: "Increases", creditRule: "Decreases", description: "Advance rent payments for warehouses or office spaces" },
  
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
  { code: "4101", accountName: "Depreciation Expense - Fleet Vehicles", category: "Expense", type: "Depreciation", debitRule: "Increases", creditRule: "Decreases", description: "Depreciation of trucks, vans, and other vehicles" },
  { code: "4102", accountName: "Depreciation Expense - Warehousing Facilities", category: "Expense", type: "Depreciation", debitRule: "Increases", creditRule: "Decreases", description: "Depreciation of warehouses and storage facilities" },
  { code: "4201", accountName: "Fuel Costs", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "Expenses related to fuel consumption for fleet vehicles" },
  { code: "4202", accountName: "Vehicle Maintenance", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "Costs for repairing and maintaining fleet vehicles" },
  { code: "4203", accountName: "Driver Salaries", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "Wages paid to vehicle drivers" },
  { code: "4301", accountName: "Warehouse Rent", category: "Expense", type: "Overhead", debitRule: "Increases", creditRule: "Decreases", description: "Rental costs for warehouses" },
  { code: "4302", accountName: "Utilities Expense", category: "Expense", type: "Overhead", debitRule: "Increases", creditRule: "Decreases", description: "Electricity, water, and internet expenses for facilities" },
  { code: "4303", accountName: "Administrative Salaries", category: "Expense", type: "Overhead", debitRule: "Increases", creditRule: "Decreases", description: "Salaries for administrative and office staff" },
  { code: "4304", accountName: "Insurance Expense", category: "Expense", type: "Overhead", debitRule: "Increases", creditRule: "Decreases", description: "Insurance costs for vehicles and cargo" },
  { code: "4305", accountName: "Vendor Expense", category: "Expense", type: "Direct Costs", debitRule: "Increases", creditRule: "Decreases", description: "Expenses paid to vendors for transportation and logistics services" },
  
  // Revenue
  { code: "5101", accountName: "Freight Revenue", category: "Revenue", type: "Revenue", debitRule: "Decreases", creditRule: "Increases", description: "Revenue earned from freight and cargo transportation" },
  { code: "5102", accountName: "Logistics Services Revenue", category: "Revenue", type: "Revenue", debitRule: "Decreases", creditRule: "Increases", description: "Revenue earned from logistics and warehousing services" },
  { code: "5103", accountName: "Vehicle Leasing Revenue", category: "Revenue", type: "Revenue", debitRule: "Decreases", creditRule: "Increases", description: "Revenue earned from leasing vehicles to third parties" }
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
