import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

// Public upload endpoint for signup receipt screenshots (no auth required)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Accepted: JPEG, PNG, WebP, GIF, PDF" }, { status: 400 });
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum 5MB." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), "public", "uploads", "signup-receipts");
    await fs.mkdir(uploadsDir, { recursive: true });

    const ext = path.extname(file.name) || ".png";
    const uniqueName = `signup_receipt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filePath = path.join(uploadsDir, uniqueName);

    await fs.writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      url: `/uploads/signup-receipts/${uniqueName}`,
    });
  } catch (error) {
    console.error("Signup upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
