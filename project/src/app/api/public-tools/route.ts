import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const FLAG_FILE = path.join(process.cwd(), "public-tools-flag.json");

async function readFlagFromDisk(): Promise<boolean> {
  try {
    const data = await fs.readFile(FLAG_FILE, "utf8");
    const parsed = JSON.parse(data);
    return !!parsed?.disabled;
  } catch {
    // Default to disabled when no file exists
    return true;
  }
}

async function writeFlagToDisk(disabled: boolean) {
  try {
    const payload = JSON.stringify({ disabled }, null, 2);
    await fs.writeFile(FLAG_FILE, payload, "utf8");
  } catch (e) {
    console.error("Failed to persist public tools flag", e);
  }
}

export async function GET() {
  const disabled = await readFlagFromDisk();
  return NextResponse.json({ disabled });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const disabled = !!body?.disabled;
    await writeFlagToDisk(disabled);
    return NextResponse.json({ disabled });
  } catch {
    const disabled = await readFlagFromDisk();
    return NextResponse.json({ disabled }, { status: 200 });
  }
}

