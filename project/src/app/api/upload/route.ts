import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { rateLimit, rateLimitResponse, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * SECURITY hardening vs. previous version:
 *  - POST: file type/extension allow-list and a 10MB size cap (previously
 *    ANY file of ANY size was relayed to shared storage).
 *  - DELETE: the target URL must be referenced by this organization's own
 *    records (customer documents or payment-proof receipts) — previously
 *    any authenticated user could delete arbitrary files belonging to any
 *    tenant on the shared storage.
 */

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function getFileExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx).toLowerCase();
}

export async function POST(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  try {
    const ip = getClientIp(req);
    const limit = rateLimit(`upload:${ip}`, 30, 60 * 60 * 1000);
    if (!limit.allowed) return rateLimitResponse(limit);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    // SECURITY: validate type and size before relaying to storage.
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: "File too large (max 10MB)" },
        { status: 400 }
      );
    }

    const ext = getFileExtension(file.name || "");
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { success: false, error: `File type not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }
    if (file.type && !file.type.startsWith("image/") && file.type !== "application/pdf") {
      return NextResponse.json(
        { success: false, error: "Only image and PDF files are accepted" },
        { status: 400 }
      );
    }

    const storageUrl = process.env.NEXT_PUBLIC_CPANEL_STORAGE_URL;
    const secretKey = process.env.CPANEL_UPLOAD_SECRET_KEY;

    if (!storageUrl || !secretKey) {
      console.error("cPanel storage environment variables are missing.");
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
      console.error("cPanel storage upload error response:", errorText);
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
 * Requires API session + ownership proof: the URL must be referenced by an
 * organization-scoped record.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  try {
    const body = await req.json();
    const url: string | undefined = body?.url;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ success: false, error: "No URL provided" }, { status: 400 });
    }

    // SECURITY: verify this organization actually owns a record referencing
    // the URL before allowing deletion.
    const [customerRef, proofRef] = await Promise.all([
      prisma.customers.findFirst({
        where: { organizationId: session.organizationId, FilePath: url },
        select: { id: true },
      }),
      prisma.paymentProof.findFirst({
        where: { organizationId: session.organizationId, receiptUrl: url },
        select: { id: true },
      }),
    ]);

    if (!customerRef && !proofRef) {
      return NextResponse.json(
        { success: false, error: "File is not associated with your organization" },
        { status: 403 }
      );
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
      console.error("cPanel storage delete error response:", errorText);
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
