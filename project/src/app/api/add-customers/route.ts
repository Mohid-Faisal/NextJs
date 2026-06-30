import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgData, orgWhere } from "@/lib/tenant/prismaScope";
import { supabase } from "@/lib/supabase";

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
    const auth = await requireApiSession(req);
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
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const ext = path.extname(file.name) || ".png";
      const filename = `customer_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
      const filePathInBucket = `customer-documents/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(filePathInBucket, buffer, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        console.error("❌ Supabase upload error:", uploadError);
        return NextResponse.json(
          { success: false, message: `Failed to upload customer document: ${uploadError.message}` },
          { status: 500 }
        );
      }

      const { data: { publicUrl } } = supabase.storage
        .from("uploads")
        .getPublicUrl(filePathInBucket);

      fileUrl = publicUrl;
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
