import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRemoteArea } from "@/lib/utils";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgData, orgWhere } from "@/lib/tenant/prismaScope";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

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
    if (!companyname || String(companyname).trim() === "") {
      return NextResponse.json(
        { success: false, message: "Company Name is required." },
        { status: 400 }
      );
    }
    if (!personname || String(personname).trim() === "") {
      return NextResponse.json(
        { success: false, message: "Person Name is required." },
        { status: 400 }
      );
    }
    if (!country || String(country).trim() === "") {
      return NextResponse.json(
        { success: false, message: "Country is required." },
        { status: 400 }
      );
    }

    const existingRecipient = await prisma.recipients.findFirst({
      where: orgWhere(session, {
        CompanyName: companyname,
      }),
    });
    
    if (existingRecipient) {
      return NextResponse.json(
        { success: false, message: "Recipient already exists." },
        { status: 400 }
      );
    }

    // Check if location is a remote area
    const remoteAreaCheck = await checkRemoteArea(prisma, country, city, zip, session.organizationId);

    // Store shipment in the database
    const recipient = await prisma.recipients.create({
      data: orgData(session, {
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
        remoteAreaCompanies: (remoteAreaCheck.companies.length > 0 
          ? JSON.stringify(remoteAreaCheck.companies) 
          : null) as any,
      }),
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
