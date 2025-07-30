import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import formidable, { Fields, Files } from "formidable";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const config = {
  api: {
    bodyParser: false,
  },
};

const uploadDir = path.join(process.cwd(), "public/uploads");
fs.mkdirSync(uploadDir, { recursive: true });

async function toNodeIncomingMessage(req: Request): Promise<any> {
  const reader = req.body?.getReader();
  const stream = new Readable({
    async read() {
      if (!reader) return this.push(null);
      const { done, value } = await reader.read();
      done ? this.push(null) : this.push(value);
    },
  });

  (stream as any).headers = Object.fromEntries(req.headers.entries());
  (stream as any).method = req.method;
  (stream as any).url = new URL(req.url).pathname;

  return stream;
}

async function parseForm(req: Request): Promise<{ fields: Fields; files: Files }> {
  const incoming = await toNodeIncomingMessage(req);

  const form = formidable({
    uploadDir,
    keepExtensions: true,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    filename: (_, __, part) => `${Date.now()}_${part.originalFilename}`,
  });

  return new Promise((resolve, reject) => {
    form.parse(incoming, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const { fields, files } = await parseForm(req);
    const uploadedFile = files.file?.[0];
    const filename = uploadedFile?.newFilename;
    
    // console.log(fields);
    const jsonstring = fields.form?.[0]
    const obj = JSON.parse(jsonstring!)
    
    // console.log(obj)
    // const normalize = (str: string) => str.toLowerCase().replace(/\s/g, "");

    // const getString = (obj: Fields, key: string): string => {
    //   const normalizedKey = Object.keys(obj).find(
    //     (k) => normalize(k) === normalize(key)
    //   );
    //   const value = normalizedKey ? obj[normalizedKey] : "";
    //   return Array.isArray(value) ? value[0] : value || "";
    // };
    
    const customerData = {
      CompanyName: obj.companyname,
      PersonName: obj.personname,
      Email: obj.email,
      Phone: obj.phone,
      DocumentType: obj.documentType,
      DocumentNumber: obj.documentNumber,
      Country: obj.country,
      State: obj.state,
      City: obj.city,
      Zip: obj.zip,
      Address: obj.address,
      ActiveStatus: obj.activestatus,
      FilePath: `/uploads/${filename}`,
    };
    
    // console.log(customerData);
    

    const existingCustomer = await prisma.vendors.findUnique({
      where: {
        Email: customerData.Email,
      },
    });
    
    if (existingCustomer) {
      return NextResponse.json(
        { success: false, message: "Customer already exists." },
        { status: 400 }
      );
    }
    
    console.log(customerData);
    const newCustomer = await prisma.customers.create({
      data: customerData,
    });

    return NextResponse.json({
      success: true,
      message: "Customer created and file uploaded successfully.",
      customer: newCustomer,
    });
  } catch (error: any) {
    console.error("❌ Upload error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
