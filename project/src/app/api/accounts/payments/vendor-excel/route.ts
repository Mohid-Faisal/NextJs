import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { parse, isValid, format } from "date-fns";
import { enUS } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { processPaymentWithAllocation } from "@/lib/utils";
import { createJournalEntryForPaymentProcess } from "@/lib/accounts/createJournalEntryForPaymentProcess";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgWhere } from "@/lib/tenant/prismaScope";
import {
  ChartAccountRow,
  findLatestVendorInvoiceBeforePaymentDate,
  normalizePaymentMethod,
  resolveVendorPaymentAccountIds,
} from "@/lib/accounts/vendorPaymentAccounts";

export const runtime = "nodejs";

function normalizeHeader(h: string) {
  return h
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ");
}

function getField(
  row: Record<string, unknown>,
  candidates: string[]
): unknown {
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    map.set(normalizeHeader(String(k)), v);
  }
  for (const c of candidates) {
    const v = map.get(normalizeHeader(c));
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
}

function parseFlexibleDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === "number" && !Number.isNaN(value)) {
    const utcDays = Math.floor(value - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof value === "string") {
    const s = value.trim();
    const fmts = [
      "dd/MM/yyyy",
      "d/M/yyyy",
      "yyyy-MM-dd",
      "MM/dd/yyyy",
      "dd-MM-yyyy",
      "dd-MMM-yyyy",
      "d-MMM-yyyy",
      "dd-MMM-yy",
      "d-MMM-yy",
    ];
    for (const f of fmts) {
      const useLocale =
        f.includes("MMM") ? { locale: enUS } : undefined;
      const d = parse(s, f, new Date(), useLocale);
      if (isValid(d)) return d;
    }
    const fallback = new Date(s);
    if (!isNaN(fallback.getTime())) return fallback;
  }
  return null;
}

function paymentFingerprint(paymentDate: Date, amount: number): string {
  return `${format(paymentDate, "yyyy-MM-dd")}|${Math.round(amount * 100)}`;
}

type ParsedRow = {
  paymentAmount: number;
  paymentDate: Date;
  paymentMethod: string;
  description: string;
  excelRowIndex: number;
};

function rowToParsed(
  row: Record<string, unknown>,
  excelRowIndex: number
): ParsedRow | { error: string } {
  const amountRaw = getField(row, [
    "payment amount",
    "amount",
    "payment",
  ]);
  const dateRaw = getField(row, ["payment date", "date"]);
  const methodRaw = getField(row, [
    "payment method",
    "method",
    "mode",
  ]);
  const descRaw = getField(row, ["description", "desc", "note"]);

  if (
    amountRaw === undefined &&
    dateRaw === undefined &&
    (methodRaw === undefined || methodRaw === "") &&
    (descRaw === undefined || descRaw === "")
  ) {
    return { error: "empty" };
  }

  const amount =
    typeof amountRaw === "number"
      ? amountRaw
      : parseFloat(String(amountRaw ?? "").replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Invalid or missing payment amount" };
  }

  const paymentDate = parseFlexibleDate(dateRaw);
  if (!paymentDate) {
    return { error: "Invalid or missing payment date" };
  }

  const methodStr =
    methodRaw !== undefined && methodRaw !== null
      ? String(methodRaw)
      : "Cash";
  const paymentMethod = normalizePaymentMethod(methodStr);

  const description =
    descRaw !== undefined && descRaw !== null ? String(descRaw).trim() : "";

  return {
    paymentAmount: amount,
    paymentDate,
    paymentMethod,
    description,
    excelRowIndex,
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const formData = await req.formData();
    const file = formData.get("file");
    const vendorIdRaw = formData.get("vendorId");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Excel file is required" }, { status: 400 });
    }

    const vendorId = parseInt(String(vendorIdRaw ?? ""), 10);
    if (!Number.isFinite(vendorId)) {
      return NextResponse.json({ error: "Valid vendorId is required" }, { status: 400 });
    }

    const vendor = await prisma.vendors.findFirst({
      where: orgWhere(session, { id: vendorId }),
    });
    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { error: "Workbook has no sheets" },
        { status: 400 }
      );
    }
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });

    const accounts = await prisma.chartOfAccount.findMany({
      where: { isActive: true },
    });
    const coaRows: ChartAccountRow[] = accounts.map((a) => ({
      id: a.id,
      accountName: a.accountName,
      category: a.category,
    }));

    const existingExpenseToVendor = await prisma.payment.findMany({
      where: orgWhere(session, {
        toVendorId: vendorId,
        transactionType: "EXPENSE",
      }),
      select: { date: true, amount: true },
    });

    const recordedFingerprints = new Set<string>();
    for (const p of existingExpenseToVendor) {
      recordedFingerprints.add(paymentFingerprint(p.date, p.amount));
    }

    const results: {
      row: number;
      success: boolean;
      skipped?: boolean;
      invoiceNumber?: string;
      amount?: number;
      message?: string;
    }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const excelRowIndex = i + 2;
      const parsed = rowToParsed(rows[i], excelRowIndex);
      if ("error" in parsed) {
        if (parsed.error === "empty") continue;
        results.push({
          row: excelRowIndex,
          success: false,
          message: parsed.error,
        });
        continue;
      }

      const {
        paymentAmount,
        paymentDate,
        paymentMethod,
        description,
      } = parsed;

      const fp = paymentFingerprint(paymentDate, paymentAmount);
      if (recordedFingerprints.has(fp)) {
        results.push({
          row: excelRowIndex,
          success: true,
          skipped: true,
          message:
            "Skipped: a vendor payment with this date and amount already exists",
          amount: paymentAmount,
        });
        continue;
      }

      const invoice = await findLatestVendorInvoiceBeforePaymentDate(
        prisma,
        vendorId,
        paymentDate
      );

      if (!invoice || invoice.vendorId !== vendorId || invoice.organizationId !== session.organizationId) {
        results.push({
          row: excelRowIndex,
          success: false,
          message:
            "No vendor invoice found with invoice date before this payment date",
        });
        continue;
      }

      const accountIds = resolveVendorPaymentAccountIds(
        coaRows,
        paymentMethod
      );
      if (!accountIds) {
        results.push({
          row: excelRowIndex,
          success: false,
          message:
            "Could not resolve chart of accounts (Accounts Payable / cash or bank)",
        });
        continue;
      }

      const invoiceNumber = invoice.invoiceNumber;
      const reference = invoiceNumber;
      const paymentDateStr = format(paymentDate, "yyyy-MM-dd");

      const body = {
        invoiceNumber,
        paymentAmount,
        paymentType: "VENDOR_PAYMENT" as const,
        paymentMethod,
        reference,
        description: description || undefined,
        paymentDate: paymentDateStr,
        debitAccountId: accountIds.debitAccountId,
        creditAccountId: accountIds.creditAccountId,
      };

      try {
        const result = await processPaymentWithAllocation(
          prisma,
          invoiceNumber,
          paymentAmount,
          "VENDOR_PAYMENT",
          paymentMethod,
          reference,
          description || undefined,
          paymentDateStr,
          accountIds.debitAccountId,
          accountIds.creditAccountId,
          session.organizationId
        );

        await createJournalEntryForPaymentProcess(
          result.payment,
          body,
          result.invoice,
          session.organizationId
        );

        recordedFingerprints.add(fp);

        results.push({
          row: excelRowIndex,
          success: true,
          skipped: false,
          invoiceNumber,
          amount: paymentAmount,
        });
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Failed to process payment";
        results.push({
          row: excelRowIndex,
          success: false,
          message: msg,
        });
      }
    }

    const importedCount = results.filter((r) => r.success && !r.skipped).length;
    const skippedCount = results.filter((r) => r.skipped).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      vendorId,
      vendorName: vendor.CompanyName,
      summary: {
        processed: results.length,
        imported: importedCount,
        skipped: skippedCount,
        failed: failCount,
      },
      results,
    });
  } catch (error) {
    console.error("vendor-excel payment import:", error);
    return NextResponse.json(
      { error: "Failed to import vendor payments from Excel" },
      { status: 500 }
    );
  }
}
