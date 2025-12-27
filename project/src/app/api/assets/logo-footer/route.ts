import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function GET() {
  try {
    // Get logo as base64
    const logoPath = path.join(process.cwd(), 'public', 'logo_final.png');
    let logoBase64 = '';
    try {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = logoBuffer.toString('base64');
      logoBase64 = `data:image/png;base64,${logoBase64}`;
    } catch (error) {
      console.error('Error reading logo file:', error);
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

