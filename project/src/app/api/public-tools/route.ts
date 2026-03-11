import { NextResponse } from "next/server";

let publicToolsDisabled = false;

export async function GET() {
  return NextResponse.json({ disabled: publicToolsDisabled });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const disabled = !!body?.disabled;
    publicToolsDisabled = disabled;
    return NextResponse.json({ disabled: publicToolsDisabled });
  } catch {
    return NextResponse.json({ disabled: publicToolsDisabled }, { status: 200 });
  }
}

