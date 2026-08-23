import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { resolvePublicLogoPath, safeRemoteLogoUrl } from "@/lib/logoUrl";

export async function GET(req: NextRequest) {
  try {
    // Attempt to resolve dynamic organization logo if session exists
    // Get logo as base64
    let logoBase64 = '';
    let logoPath = path.join(process.cwd(), 'public', 'logo_final.png');

    const auth = await requireApiSession(req);
    if (auth.session) {
      const org = await prisma.organization.findUnique({
        where: { id: auth.session.organizationId },
        select: { logoUrl: true }
      });

      if (org && org.logoUrl) {
        // SECURITY: SSRF/arbitrary-file-read protection. Only safe https(s)
        // remote URLs are fetched, and local paths are resolved with a
        // containment check inside the public directory.
        const remoteUrl = safeRemoteLogoUrl(org.logoUrl);
        if (remoteUrl) {
          try {
            const res = await fetch(remoteUrl, { redirect: "error" });
            if (res.ok) {
              const contentType = res.headers.get('content-type') || '';
              if (contentType.startsWith('image/')) {
                const buffer = await res.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                logoBase64 = `data:${contentType};base64,${base64}`;
              }
            }
          } catch (err) {
            console.error('Error fetching remote logo:', err);
          }
        } else {
          const containedPath = resolvePublicLogoPath(org.logoUrl);
          if (containedPath && fs.existsSync(containedPath)) {
            logoPath = containedPath;
          }
        }
      }
    }

    if (!logoBase64) {
      try {
        const logoBuffer = fs.readFileSync(logoPath);
        const base64 = logoBuffer.toString('base64');
        const ext = path.extname(logoPath).toLowerCase();
        const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
        logoBase64 = `data:${mime};base64,${logoBase64}`;
      } catch (error) {
        console.error('Error reading logo file:', error);
      }
    }

    // Get footer as base64
    const footerPath = path.join(process.cwd(), 'public', 'footer.png');
    let footerBase64 = '';
    try {
      const footerBuffer = fs.readFileSync(footerPath);
      footerBase64 = footerBuffer.toString('base64');
      footerBase64 = `data:image/png;base64,${footerBase64}`;
    } catch (error) {
      console.error('Error reading footer file:', error);
    }

    return NextResponse.json({
      logo: logoBase64,
      footer: footerBase64
    });
  } catch (error) {
    console.error("Error getting assets:", error);
    return NextResponse.json(
      { error: "Failed to get assets", logo: '', footer: '' },
      { status: 500 }
    );
  }
}
