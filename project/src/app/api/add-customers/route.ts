import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/requirePermission";
import { orgData, orgWhere } from "@/lib/tenant/prismaScope";

// Function to generate next customer ID starting from 1000 with increment of 5
async function getNextCustomerId(): Promise<number> {
  try {
    const lastCustomer = await prisma.customers.findFirst({
      orderBy: { id: "desc" },
      select: { id: true },
    });

    if (!lastCustomer || lastCustomer.id < 1000) {
      return 1000;
    }

    return lastCustomer.id + 5;
  } catch (error) {
    console.error("Error getting next customer ID:", error);
    return 1000;
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "manage_customers");
    if (auth.error) return auth.error;
    const session = auth.session;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const jsonstring = formData.get("form") as string | null;

    if (!jsonstring) {
      return NextResponse.json(
        { success: false, message: "Form data is required." },
        { status: 400 }
      );
    }

    const obj = JSON.parse(jsonstring);

    let fileUrl = "";
    if (file && file.size > 0) {
      const storageUrl = process.env.NEXT_PUBLIC_CPANEL_STORAGE_URL;
      const secretKey = process.env.CPANEL_UPLOAD_SECRET_KEY;

      if (!storageUrl || !secretKey) {
        console.error("❌ cPanel storage environment variables are missing.");
        return NextResponse.json(
          { success: false, message: "Storage configuration is missing on the server" },
          { status: 500 }
        );
      }

      const cpanelFormData = new FormData();
      cpanelFormData.append("file", file);
      cpanelFormData.append("category", "customer-documents");
      cpanelFormData.append("secret_key", secretKey);
      cpanelFormData.append("action", "upload");

      const response = await fetch(storageUrl, {
        method: "POST",
        body: cpanelFormData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ cPanel storage upload error response:", errorText);
        return NextResponse.json(
          { success: false, message: `Failed to upload customer document: ${response.statusText}` },
          { status: 500 }
        );
      }

      const data = await response.json();
      if (!data.success) {
        return NextResponse.json(
          { success: false, message: data.error || "Failed to upload customer document to storage" },
          { status: 500 }
        );
      }

      fileUrl = data.url;
    }

    // Generate custom customer ID
    const customId = await getNextCustomerId();

    const customerData = {
      id: customId,
      CompanyName: obj.companyname,
      PersonName: obj.personname,
      Email: obj.email,
      Phone: obj.phone,
      DocumentType: obj.documentType,
      DocumentNumber: obj.documentNumber,
      DocumentExpiry: obj.documentExpiry,
      Country: obj.country,
      State: obj.state,
      City: obj.city,
      Zip: obj.zip,
      Address: obj.address,
      ActiveStatus: obj.activestatus,
      FilePath: fileUrl,
    };

    if (!customerData.CompanyName || customerData.CompanyName.trim() === "") {
      return NextResponse.json(
        { success: false, message: "Company Name is required." },
        { status: 400 }
      );
    }
    if (!customerData.PersonName || customerData.PersonName.trim() === "") {
      return NextResponse.json(
        { success: false, message: "Person Name is required." },
        { status: 400 }
      );
    }
    if (!customerData.Country || customerData.Country.trim() === "") {
      return NextResponse.json(
        { success: false, message: "Country is required." },
        { status: 400 }
      );
    }

    const existingCustomer = await prisma.customers.findFirst({
      where: orgWhere(session, {
        CompanyName: customerData.CompanyName,
      }),
    });

    if (existingCustomer) {
      return NextResponse.json(
        { success: false, message: "Customer already exists." },
        { status: 400 }
      );
    }

    const newCustomer = await prisma.customers.create({
      data: orgData(session, customerData),
    });

    return NextResponse.json({
      success: true,
      message: "Customer created and file uploaded successfully.",
      customer: newCustomer,
    });
  } catch (error: any) {
    console.error("❌ Customer creation error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
