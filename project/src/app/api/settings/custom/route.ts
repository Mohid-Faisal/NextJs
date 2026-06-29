import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/requireApiSession";

export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const key = req.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
  }

  const setting = await prisma.appSetting.findUnique({
    where: { key },
  });

  if (!setting) {
    // Provide default values if not configured yet
    if (key === "settings_notifications") {
      const defaultNotifications = [
        { event: "Shipment Created", email: true, whatsapp: false, webhook: false },
        { event: "Out for Delivery", email: true, whatsapp: false, webhook: false },
        { event: "Delivered", email: true, whatsapp: false, webhook: false },
        { event: "Exception", email: true, whatsapp: false, webhook: false }
      ];
      return NextResponse.json({ value: JSON.stringify(defaultNotifications) });
    }
    if (key === "settings_billing") {
      const defaultBilling = {
        currency: "USD - United States Dollar ($)",
        tax: "0%",
        paymentTerms: "Payment is due upon receipt.",
        invoiceFooter: "Thank you for your business.",
        invoiceDesign: "MODERN PURPLE"
      };
      return NextResponse.json({ value: JSON.stringify(defaultBilling) });
    }
    return NextResponse.json({ value: null });
  }

  return NextResponse.json(setting);
}

export async function POST(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;

  const { key, value } = await req.json();
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  const setting = await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });

  return NextResponse.json(setting);
}
