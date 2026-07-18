import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/requireApiSession";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload
 * Requires API session. Uploads a file (receipt screenshot) to cPanel storage under receipts/.
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

    const storageUrl = process.env.NEXT_PUBLIC_CPANEL_STORAGE_URL;
    const secretKey = process.env.CPANEL_UPLOAD_SECRET_KEY;

    if (!storageUrl || !secretKey) {
      console.error("❌ cPanel storage environment variables are missing.");
      return NextResponse.json(
        { success: false, error: "Storage configuration is missing on the server" },
        { status: 500 }
      );
    }

    const cpanelFormData = new FormData();
    cpanelFormData.append("file", file);
    cpanelFormData.append("category", "receipts");
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
        { success: false, error: `Failed to upload file to storage: ${response.statusText}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    if (!data.success) {
      return NextResponse.json(
        { success: false, error: data.error || "Failed to upload file to storage" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, url: data.url });
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
 * Requires API session. Deletes a file from cPanel storage by its public URL.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ success: false, error: "No URL provided" }, { status: 400 });
    }

    const storageUrl = process.env.NEXT_PUBLIC_CPANEL_STORAGE_URL;
    const secretKey = process.env.CPANEL_UPLOAD_SECRET_KEY;

    if (!storageUrl || !secretKey) {
      return NextResponse.json(
        { success: false, error: "Storage configuration is missing on the server" },
        { status: 500 }
      );
    }

    const cpanelFormData = new FormData();
    cpanelFormData.append("action", "delete");
    cpanelFormData.append("url", url);
    cpanelFormData.append("secret_key", secretKey);

    const response = await fetch(storageUrl, {
      method: "POST",
      body: cpanelFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ cPanel storage delete error response:", errorText);
      return NextResponse.json(
        { success: false, error: `Failed to delete file from storage: ${response.statusText}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    if (!data.success) {
      return NextResponse.json(
        { success: false, error: data.error || "Failed to delete file from storage" },
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
