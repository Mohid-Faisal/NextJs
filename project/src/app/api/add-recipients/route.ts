import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRemoteArea } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    // Robust body parsing to support JSON, form-urlencoded and multipart
    const contentType = req.headers.get("content-type") || "";
    let body: any = {};
    try {
      if (contentType.includes("application/json")) {
        body = await req.json();
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const text = await req.text();
        body = Object.fromEntries(new URLSearchParams(text));
      } else if (contentType.includes("multipart/form-data")) {
        const form = await req.formData();
        const formDataObj: any = {};
        
        // Handle both direct fields and nested form object
        for (const [key, value] of form.entries()) {
          if (key === "form" && typeof value === "string") {
            try {
              const parsedForm = JSON.parse(value);
              Object.assign(formDataObj, parsedForm);
            } catch (e) {
              console.error("Failed to parse form JSON:", e);
            }
          } else {
            formDataObj[key] = value;
          }
        }
        body = formDataObj;
      } else {
        const text = await req.text();
        try {
          body = JSON.parse(text || "{}");
        } catch {
          // fallback to query-like parsing
          body = Object.fromEntries(new URLSearchParams(text));
        }
      }
    } catch (e) {
      // If parsing fails, ensure body is at least an empty object
      body = {};
    }

    const {
      companyname,
      personname,
      email,
      phone,
      country,
      state,
      city,
      zip,
      address,
    } = body;

    // console.log(companyname, personname, email, phone, country, state, city, zip, address);

    // console.log(Email);
    // Basic validation
    const requiredFields = ["companyname", "country"] as const;

    const existingRecipient = await prisma.recipients.findUnique({
      where: {
        CompanyName: companyname,
      },
    });
    
    if (existingRecipient) {
      return NextResponse.json(
        { success: false, message: "Recipient already exists." },
        { status: 400 }
      );
    }

    for (const field of requiredFields) {
      if (!body[field] || String(body[field]).trim() === "") {
        return NextResponse.json(
          { success: false, message: `${field} is required.` },
          { status: 400 }
        );
      }
    }

    // Check if location is a remote area
    const remoteAreaCheck = await checkRemoteArea(prisma, country, city, zip);

    // Store shipment in the database
    const recipient = await prisma.recipients.create({
      data: {
        CompanyName: companyname,
        PersonName: personname,
        Email: email,
        Phone: phone,
        Country: country,
        State: state,
        City: city,
        Zip: zip,
        Address: address,
        isRemoteArea: remoteAreaCheck.isRemote,
        remoteAreaCompanies: remoteAreaCheck.companies.length > 0 
          ? JSON.stringify(remoteAreaCheck.companies) 
          : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Recipient added successfully.",
      recipient,
    });
  } catch (error) {
    console.error("Add recipient error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to add recipient." },
      { status: 500 }
    );
  }
}
