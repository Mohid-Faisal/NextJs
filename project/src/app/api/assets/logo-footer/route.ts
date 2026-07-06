import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";

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
        if (org.logoUrl.startsWith('http://') || org.logoUrl.startsWith('https://')) {
          try {
            const res = await fetch(org.logoUrl);
            if (res.ok) {
              const buffer = await res.arrayBuffer();
              const base64 = Buffer.from(buffer).toString('base64');
              const contentType = res.headers.get('content-type') || 'image/png';
              logoBase64 = `data:${contentType};base64,${base64}`;
            }
          } catch (err) {
            console.error('Error fetching remote logo:', err);
          }
        } else if (org.logoUrl.startsWith('/')) {
          const customPath = path.join(process.cwd(), 'public', org.logoUrl);
          if (fs.existsSync(customPath)) {
            logoPath = customPath;
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
