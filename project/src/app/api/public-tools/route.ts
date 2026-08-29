import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

const SETTING_KEY = "public_tools_disabled";

/** No DB row, or value "true" => public tools blocked (404). Value "false" => tools enabled. */
function rowToDisabled(value: string | null | undefined): boolean {
  if (value == null) return true;
  return value !== "false";
}

export async function GET() {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: SETTING_KEY },
    });
    const disabled = rowToDisabled(row?.value);
    return NextResponse.json({ disabled });
  } catch (e) {
    console.error("public-tools GET error", e);
    return NextResponse.json({ disabled: true });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession(request);
    if (!session || session.platformRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const disabled = !!body?.disabled;
    const value = disabled ? "true" : "false";

    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value },
      update: { value },
    });

    return NextResponse.json({ disabled });
  } catch (e) {
    console.error("public-tools POST error", e);
    return NextResponse.json(
      { error: "Failed to persist public tools setting" },
      { status: 500 }
    );
  }
}
