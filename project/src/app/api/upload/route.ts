import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload
 * Requires API session. Uploads a file (receipt screenshot) to Supabase Storage uploads bucket under receipts/.
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

    // Generate unique name
    const ext = path.extname(file.name) || ".png";
    const filename = `receipt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filePathInBucket = `receipts/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(filePathInBucket, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("❌ Supabase upload error:", uploadError);
      return NextResponse.json(
        { success: false, error: `Failed to upload file to Supabase: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: { publicUrl } } = supabase.storage
      .from("uploads")
      .getPublicUrl(filePathInBucket);

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to upload file" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/upload
 * Requires API session. Deletes a file from Supabase Storage by its public URL.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ success: false, error: "No URL provided" }, { status: 400 });
    }

    const marker = "/public/uploads/";
    const markerIndex = url.indexOf(marker);
    if (markerIndex === -1) {
      return NextResponse.json({ success: false, error: "Invalid URL for storage deletion" }, { status: 400 });
    }

    const filePathInBucket = url.substring(markerIndex + marker.length);

    const { error: deleteError } = await supabase.storage
      .from("uploads")
      .remove([filePathInBucket]);

    if (deleteError) {
      console.error("❌ Supabase delete error:", deleteError);
      return NextResponse.json(
        { success: false, error: `Failed to delete from Supabase: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete file" },
      { status: 500 }
    );
  }
}
