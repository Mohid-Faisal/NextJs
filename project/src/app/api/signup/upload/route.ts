import { NextRequest, NextResponse } from "next/server";

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

    const storageUrl = process.env.NEXT_PUBLIC_CPANEL_STORAGE_URL;
    const secretKey = process.env.CPANEL_UPLOAD_SECRET_KEY;

    if (!storageUrl || !secretKey) {
      console.error("❌ cPanel storage environment variables are missing.");
      return NextResponse.json(
        { error: "Storage configuration is missing on the server" },
        { status: 500 }
      );
    }

    const cpanelFormData = new FormData();
    cpanelFormData.append("file", file);
    cpanelFormData.append("category", "signup-receipts");
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
        { error: `Failed to upload file to storage: ${response.statusText}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    if (!data.success) {
      return NextResponse.json(
        { error: data.error || "Failed to upload file to storage" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: data.url,
    });
  } catch (error) {
    console.error("Signup upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
