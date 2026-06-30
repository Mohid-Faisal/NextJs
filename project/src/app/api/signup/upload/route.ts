import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { supabase } from "@/lib/supabase";

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

    const ext = path.extname(file.name) || ".png";
    const uniqueName = `signup_receipt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filePathInBucket = `signup-receipts/${uniqueName}`;

    const { error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(filePathInBucket, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("❌ Signup Supabase upload error:", uploadError);
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: { publicUrl } } = supabase.storage
      .from("uploads")
      .getPublicUrl(filePathInBucket);

    return NextResponse.json({
      success: true,
      url: publicUrl,
    });
  } catch (error) {
    console.error("Signup upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
