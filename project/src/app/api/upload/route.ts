import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireApiSession } from "@/lib/auth/requireApiSession";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload
 * Requires API session. Uploads a file (receipt screenshot) to local public/uploads/receipts directory.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create target directory
    const uploadDir = path.join(process.cwd(), "public", "uploads", "receipts");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate unique name
    const ext = path.extname(file.name) || ".png";
    const filename = `receipt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filePath = path.join(uploadDir, filename);

    await fs.promises.writeFile(filePath, buffer);

    const fileUrl = `/uploads/receipts/${filename}`;
    return NextResponse.json({ success: true, url: fileUrl });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
