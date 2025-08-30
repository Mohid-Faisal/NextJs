import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeToken } from "@/lib/utils";
import bcrypt from "bcrypt";

// Define proper types for the request body
interface CustomerUpdateData {
  companyname?: string;
  personname?: string;
  email?: string;
  phone?: string;
  documenttype?: string;
  documentnumber?: string;
  documentexpiry?: string;
  country?: string;
  state?: string;
  city?: string;
  zip?: string;
  address?: string;
  activestatus?: string;
}

interface AddressUpdateData {
  Address?: string;
  City?: string;
  State?: string;
  Country?: string;
  Zip?: string;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = parseInt(id);
    
    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: "Invalid customer ID" },
        { status: 400 }
      );
    }

    const customer = await prisma.customers.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ customer });
  } catch (error) {
    console.error("Error fetching customer:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = parseInt(id);
    
    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: "Invalid customer ID" },
        { status: 400 }
      );
    }

    // Handle FormData
    const formData = await req.formData();
    const formString = formData.get('form') as string;
    
    if (!formString) {
      return NextResponse.json(
        { error: "Form data is required" },
        { status: 400 }
      );
    }

    const body: CustomerUpdateData = JSON.parse(formString);
    
    const updatedCustomer = await prisma.customers.update({
      where: { id: customerId },
      data: {
        CompanyName: body.companyname,
        PersonName: body.personname,
        Email: body.email,
        Phone: body.phone,
        DocumentType: body.documenttype,
        DocumentNumber: body.documentnumber,
        DocumentExpiry: body.documentexpiry,
        Country: body.country,
        State: body.state,
        City: body.city,
        Zip: body.zip,
        Address: body.address,
        ActiveStatus: body.activestatus,
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: "Customer updated successfully",
      customer: updatedCustomer 
    });
  } catch (error) {
    console.error("Error updating customer:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = parseInt(id);
    
    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: "Invalid customer ID" },
        { status: 400 }
      );
    }

    // Get the authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization token required" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = decodeToken(token);
    
    if (!decoded) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    // Get the request body for password verification
    const body = await req.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: "Password is required for deletion" },
        { status: 400 }
      );
    }

    // Get the current user
    const user = await prisma.user.findUnique({
      where: { id: parseInt(decoded.id) },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Verify the password
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 401 }
      );
    }

    // Check if customer exists
    const customer = await prisma.customers.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Delete the customer
    await prisma.customers.delete({
      where: { id: customerId },
    });

    return NextResponse.json({ 
      success: true, 
      message: "Customer deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting customer:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idNum = parseInt(id);
    const body: AddressUpdateData = await req.json();

    const updatedCustomer = await prisma.customers.update({
      where: { id: idNum },
      data: {
        Address: body.Address,
        City: body.City,
        State: body.State,
        Country: body.Country,
        Zip: body.Zip,
      },
    });

    return NextResponse.json({
      success: true,
      customer: updatedCustomer,
    });
  } catch (error) {
    console.error("Error updating customer:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update customer" },
      { status: 500 }
    );
  }
} 