import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addVendorTransaction, createJournalEntryForTransaction, lookupVendorRate } from "@/lib/server/ledger";
import { Country } from "country-state-city";
import { resolveCreditPaymentVoucherDate } from "@/lib/accounts/resolveCreditPaymentVoucherDate";
import { computeVendorLedgerVoucherDate } from "@/lib/accounts/vendorLedgerVoucherDate";
import type { InvoiceFieldsForDebitVoucher } from "@/lib/accounts/invoiceDebitVoucherDate";
import {
  inferAdjustmentType,
  isVendorDebitNoteReference,
  normalizeNoteLineDescription,
  parseDateInputAsLocalDate,
} from "@/lib/noteFormats";
import { requirePermission } from "@/lib/auth/requirePermission";
import { orgWhere } from "@/lib/tenant/prismaScope";
import { debitNoteOrgFilter } from "@/lib/tenant/findOrgDebitNote";
import { parseListPaging } from "@/lib/money";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vendorId = parseInt(id);
    
    if (isNaN(vendorId)) {
      return NextResponse.json(
        { error: "Invalid vendor ID" },
        { status: 400 }
      );
    }

    const auth = await requirePermission(req, "view_revenue");
    if (auth.error) return auth.error;
    const { session } = auth;

    const vendorExists = await prisma.vendors.findFirst({
      where: orgWhere(session, { id: vendorId }),
    });
    if (!vendorExists) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const { page, take: limit, skip } = parseListPaging(searchParams, 10);
    const isAllLimit = false;
    const search = searchParams.get('search') || '';
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const sortField = searchParams.get('sortField') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const recalcBalances = searchParams.get('recalc') === 'true';

    // Build where clause for filtering
    const whereClause: any = orgWhere(session, {
      vendorId: vendorId
    });

    // Add search filter
    if (search) {
      // Try to parse as number for price search
      const searchAsNumber = parseFloat(search);
      const isNumericSearch = !isNaN(searchAsNumber);
      
      // Get all country codes that match the search term (by name or code)
      const matchingCountryCodes: string[] = [];
      if (search.trim()) {
        const allCountries = Country.getAllCountries();
        const searchLower = search.toLowerCase().trim();
        allCountries.forEach(country => {
          if (
            country.name.toLowerCase().includes(searchLower) ||
            country.isoCode.toLowerCase().includes(searchLower) ||
            country.name.toLowerCase() === searchLower
          ) {
            matchingCountryCodes.push(country.isoCode);
          }
        });
      }
      
      // Find invoices/shipments matching destination search
      let matchingInvoiceNumbers: string[] = [];
      if (matchingCountryCodes.length > 0 || search.trim()) {
        const invoiceSearchConditions: any = {
          OR: [
            { destination: { contains: search} }
          ]
        };
        if (matchingCountryCodes.length > 0) {
          invoiceSearchConditions.OR.push({
            destination: { in: matchingCountryCodes }
          });
        }
        
        const matchingInvoices = await prisma.invoice.findMany({
          where: { ...orgWhere(session), ...invoiceSearchConditions },
          select: { invoiceNumber: true }
        });
        matchingInvoiceNumbers = matchingInvoices.map(inv => inv.invoiceNumber);
      }
      
      // Build search conditions
      const searchConditions: any[] = [
        { description: { contains: search} },
        { reference: { contains: search} }
      ];
      
      // Add amount search (exact match or range)
      if (isNumericSearch) {
        searchConditions.push({
          amount: {
            gte: searchAsNumber * 0.99,
            lte: searchAsNumber * 1.01
          }
        });
      }
      
      // Add invoice number search if we found matching invoices
      if (matchingInvoiceNumbers.length > 0) {
        searchConditions.push({
          invoice: { in: matchingInvoiceNumbers }
        });
      }
      
      whereClause.OR = searchConditions;
    }

    // Note: Date range filtering will be done after calculating voucher dates
    // We don't filter by createdAt here because transactions are displayed by voucher date

    // Validate sort field
    const allowedSortFields = ['createdAt', 'amount', 'type', 'description', 'reference'];
    const validSortField = allowedSortFields.includes(sortField) ? sortField : 'createdAt';
    const validSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    // Get vendor info
    const vendor = await prisma.vendors.findFirst({
      where: orgWhere(session, { id: vendorId }),
      select: {
        id: true,
        CompanyName: true,
        PersonName: true,
        currentBalance: true,
        creditLimit: true,
        Address: true,
        City: true,
        Country: true
      }
    });

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    // Self-heal: link any unlinked Vendor invoices whose shipment.vendor matches this vendor,
    // ensure all Vendor invoices have corresponding DEBIT transactions, and deduplicate DEBIT rows.
    try {
      if (vendor.CompanyName) {
        const unlinkedVendorInvs = await prisma.invoice.findMany({
          where: orgWhere(session, {
            vendorId: null,
            profile: "Vendor",
            status: { not: "Cancelled" },
            shipment: {
              vendor: { equals: vendor.CompanyName.trim() },
            },
          }),
          select: { id: true },
        });
        if (unlinkedVendorInvs.length > 0) {
          await prisma.invoice.updateMany({
            where: { id: { in: unlinkedVendorInvs.map((i) => i.id) } },
            data: { vendorId, customerId: null },
          });
        }
      }

      const vendorInvoices = await prisma.invoice.findMany({
        where: orgWhere(session, {
          vendorId,
          profile: "Vendor",
          status: { not: "Cancelled" },
        }),
        include: {
          shipment: {
            select: {
              trackingId: true,
              destination: true,
              packaging: true,
              weight: true,
              totalWeight: true,
              shipmentDate: true,
            },
          },
        },
      });

      if (vendorInvoices.length > 0) {
        const invNumbers = vendorInvoices.map((inv) => inv.invoiceNumber);
        const existingDebitTxs = await prisma.vendorTransaction.findMany({
          where: orgWhere(session, {
            vendorId,
            type: "DEBIT",
            OR: [
              { reference: { in: invNumbers } },
              { invoice: { in: invNumbers } },
            ],
          }),
          orderBy: { id: "asc" },
          select: { id: true, reference: true, invoice: true, amount: true, description: true },
        });

        const existingSet = new Set<string>();
        const seenAdjustmentRefs = new Set<string>();
        const duplicateIds: number[] = [];
        for (const t of existingDebitTxs) {
          if (
            isVendorDebitNoteReference(t.reference) ||
            isVendorDebitNoteReference(t.invoice) ||
            /^(Adjustment|Credit Note|Debit Note)\s*:/i.test(t.description || "")
          ) {
            const adjRef = t.reference || t.invoice;
            if (adjRef) {
              if (seenAdjustmentRefs.has(adjRef)) {
                duplicateIds.push(t.id);
              } else {
                seenAdjustmentRefs.add(adjRef);
              }
            }
            continue;
          }
          const key = t.invoice || t.reference;
          if (!key || key.startsWith("STARTING-BALANCE")) {
            continue;
          }
          if (existingSet.has(key)) {
            duplicateIds.push(t.id);
          } else {
            existingSet.add(key);
          }
          if (t.reference) existingSet.add(t.reference);
          if (t.invoice) existingSet.add(t.invoice);
        }

        if (duplicateIds.length > 0) {
          await prisma.vendorTransaction.deleteMany({
            where: { id: { in: duplicateIds } },
          });
          // Fast list path already computes chronological runningBal and updates vendor.currentBalance
        }

        // Clean up orphan vendor transactions left behind by deleted shipments:
        // (a) Fake ADJUST- / REFUND- rows created for deleted shipments
        // (b) DEBIT rows where neither invoice nor shipment exists in DB
        const allVendorTxsForOrphanCheck = await prisma.vendorTransaction.findMany({
          where: orgWhere(session, { vendorId }),
          select: { id: true, invoice: true, reference: true, type: true, description: true },
        });

        const candVInvNums = Array.from(
          new Set(
            allVendorTxsForOrphanCheck
              .map((t) =>
                t.reference?.startsWith("ADJUST-") || t.reference?.startsWith("REFUND-")
                  ? t.reference.replace(/^(ADJUST|REFUND)-/, "")
                  : t.invoice || t.reference
              )
              .filter(
                (n): n is string =>
                  typeof n === "string" &&
                  n.trim().length > 0 &&
                  !n.startsWith("STARTING-BALANCE") &&
                  !isVendorDebitNoteReference(n)
              )
          )
        );
        const existingVInvoices = candVInvNums.length
          ? await prisma.invoice.findMany({
              where: orgWhere(session, {
                vendorId,
                invoiceNumber: { in: candVInvNums },
              }),
              select: { invoiceNumber: true },
            })
          : [];
        const existingVInvoiceSet = new Set(
          existingVInvoices.map((i) => i.invoiceNumber)
        );

        const vTrackingIdsToCheck: string[] = [];
        for (const t of allVendorTxsForOrphanCheck) {
          const match = t.description?.match(/Tracking:\s*([^\s|]+)/i);
          if (match && match[1]) vTrackingIdsToCheck.push(match[1]);
        }
        const existingVShipments = vTrackingIdsToCheck.length
          ? await prisma.shipment.findMany({
              where: orgWhere(session, {
                trackingId: { in: Array.from(new Set(vTrackingIdsToCheck)) },
              }),
              select: { trackingId: true },
            })
          : [];
        const existingVShipmentSet = new Set(
          existingVShipments.map((s) => s.trackingId).filter(Boolean)
        );

        const orphanVendorTxIds: number[] = [];
        for (const t of allVendorTxsForOrphanCheck) {
          if (
            t.reference?.startsWith("STARTING-BALANCE") ||
            isVendorDebitNoteReference(t.reference) ||
            isVendorDebitNoteReference(t.invoice) ||
            /^(Adjustment|Credit Note|Debit Note)\s*:/i.test(t.description || "")
          ) {
            continue;
          }

          if (
            t.reference?.startsWith("ADJUST-") ||
            t.reference?.startsWith("REFUND-") ||
            /deleted shipment/i.test(t.description || "")
          ) {
            const invNum = t.reference
              ? t.reference.replace(/^(ADJUST|REFUND)-/, "")
              : t.invoice;
            if (!invNum || !existingVInvoiceSet.has(invNum)) {
              orphanVendorTxIds.push(t.id);
            }
            continue;
          }

          if (t.type === "DEBIT") {
            const invNum = t.invoice || t.reference;
            let exists = false;
            if (invNum && existingVInvoiceSet.has(invNum)) exists = true;
            if (!exists) {
              const match = t.description?.match(/Tracking:\s*([^\s|]+)/i);
              if (match && match[1] && existingVShipmentSet.has(match[1]))
                exists = true;
            }
            if (!exists) {
              orphanVendorTxIds.push(t.id);
            }
          }
        }

        if (orphanVendorTxIds.length > 0) {
          await prisma.vendorTransaction.deleteMany({
            where: { id: { in: orphanVendorTxIds } },
          });
        }

        if (duplicateIds.length > 0 || orphanVendorTxIds.length > 0) {
          const remainingTxs = await prisma.vendorTransaction.findMany({
            where: orgWhere(session, { vendorId }),
            orderBy: { createdAt: "asc" },
          });
          const startingTx = remainingTxs.find(
            (t) => t.reference && t.reference.startsWith("STARTING-BALANCE")
          );
          let newBal = 0;
          if (startingTx) {
            newBal =
              startingTx.type === "DEBIT"
                ? Number(startingTx.amount || 0)
                : -Number(startingTx.amount || 0);
          }
          for (const t of remainingTxs) {
            if (t.reference && t.reference.startsWith("STARTING-BALANCE")) continue;
            const amt = Number(t.amount || 0);
            if (t.type === "DEBIT") newBal += amt;
            else if (t.type === "CREDIT") newBal -= amt;
          }
          await prisma.vendors.update({
            where: { id: vendorId },
            data: { currentBalance: newBal },
          });
          vendor.currentBalance = newBal;
        }

        // Clean up bogus prepayment application rows ("Balance applied for vendor invoice..." / CREDIT-{inv})
        // while preserving their amounts as a recovery signal for zeroed vendor invoices
        const bogusVendorCredits = await prisma.vendorTransaction.findMany({
          where: orgWhere(session, {
            vendorId,
            type: "CREDIT",
            OR: [
              { reference: { startsWith: "CREDIT-" } },
              { description: { startsWith: "Balance applied for vendor invoice" } },
            ],
          }),
          select: { id: true, reference: true, invoice: true, amount: true },
        });
        const creditAppliedByInvNum = new Map<string, number>();
        for (const bc of bogusVendorCredits) {
          const refKey = bc.invoice || (bc.reference ? bc.reference.replace(/^CREDIT-/, "") : "");
          const amt = Number(bc.amount) || 0;
          if (refKey && amt > 0) {
            creditAppliedByInvNum.set(refKey, Math.max(creditAppliedByInvNum.get(refKey) || 0, amt));
          }
        }
        if (bogusVendorCredits.length > 0) {
          await prisma.vendorTransaction.deleteMany({
            where: { id: { in: bogusVendorCredits.map((b) => b.id) } },
          });
          const creditRefs = bogusVendorCredits
            .map((b) => b.reference)
            .filter((r): r is string => Boolean(r && r.startsWith("CREDIT-")));
          if (creditRefs.length > 0) {
            await prisma.journalEntry.deleteMany({
              where: orgWhere(session, { reference: { in: creditRefs } }),
            });
          }
          // Fast list path already computes chronological runningBal and updates vendor.currentBalance
        }

        // Gather payment allocation amounts by invoiceId and by invoiceNumber (from ALLOCATIONS: string)
        const vendorPayments = await prisma.payment.findMany({
          where: orgWhere(session, { toVendorId: vendorId }),
          select: {
            description: true,
            allocations: { select: { invoiceId: true, amount: true } },
          },
        });
        const allocAmountByInvId = new Map<number, number>();
        const allocAmountByInvNum = new Map<string, number>();
        for (const vp of vendorPayments) {
          for (const al of (vp as any).allocations || []) {
            const amt = Number(al.amount) || 0;
            if (amt > 0) {
              allocAmountByInvId.set(al.invoiceId, (allocAmountByInvId.get(al.invoiceId) || 0) + amt);
            }
          }
          if (vp.description && vp.description.includes("ALLOCATIONS:")) {
            const allocPart = vp.description.split("ALLOCATIONS:")[1]?.split(/\s/)[0] || "";
            for (const pair of allocPart.split("|")) {
              const [invNum, amtStr] = pair.split(":");
              const amt = parseFloat(amtStr || "0");
              if (invNum && amt > 0) {
                allocAmountByInvNum.set(invNum.trim(), Math.max(allocAmountByInvNum.get(invNum.trim()) || 0, Math.round(amt)));
              }
            }
          }
        }

        // Fetch full shipment pricing fields for vendorInvoices that have shipmentId
        const shipmentIds = vendorInvoices
          .map((inv) => inv.shipmentId)
          .filter((sid): sid is number => typeof sid === "number");
        const fullShipments = shipmentIds.length > 0
          ? await prisma.shipment.findMany({
              where: { id: { in: shipmentIds } },
              select: {
                id: true,
                vendor: true,
                serviceMode: true,
                destination: true,
                packaging: true,
                weight: true,
                totalWeight: true,
                price: true,
                fixedCharge: true,
                cos: true,
                calculatedValues: true,
              },
            })
          : [];
        const fullShipmentMap = new Map(fullShipments.map((s) => [s.id, s]));

        const keptDebitByInv = new Map<string, { id: number; amount: number }>();
        for (const t of existingDebitTxs) {
          if (duplicateIds.includes(t.id)) continue;
          if (
            isVendorDebitNoteReference(t.reference) ||
            isVendorDebitNoteReference(t.invoice) ||
            /^(Adjustment|Credit Note|Debit Note)\s*:/i.test(t.description || "")
          ) {
            continue;
          }
          const k = t.invoice || t.reference;
          if (k && !keptDebitByInv.has(k)) {
            keptDebitByInv.set(k, { id: t.id, amount: Number(t.amount) || 0 });
          }
        }

        // Heal vendor invoices and DEBIT transactions whose amount was zeroed out
        for (const inv of vendorInvoices) {
          const fullShip = inv.shipmentId ? fullShipmentMap.get(inv.shipmentId) : undefined;
          let trueVendorAmount = Number(inv.totalAmount) || 0;

          if (trueVendorAmount <= 0 && fullShip && Number(fullShip.cos) > 0) {
            trueVendorAmount = Math.round(Number(fullShip.cos));
          }
          if (trueVendorAmount <= 0 && fullShip?.calculatedValues) {
            try {
              const calc =
                typeof fullShip.calculatedValues === "string"
                  ? JSON.parse(fullShip.calculatedValues)
                  : (fullShip.calculatedValues as any);
              const vp = Number(calc?.vendorPrice) || Number(calc?.cos) || 0;
              if (vp > 0) trueVendorAmount = Math.round(vp);
            } catch {
              // ignore
            }
          }
          if (trueVendorAmount <= 0) {
            const fromAllocStr = allocAmountByInvNum.get(inv.invoiceNumber) || 0;
            const fromAllocRow = allocAmountByInvId.get(inv.id) || 0;
            const fromCreditRow = creditAppliedByInvNum.get(inv.invoiceNumber) || 0;
            trueVendorAmount = Math.max(fromAllocStr, fromAllocRow, fromCreditRow);
          }
          if (trueVendorAmount <= 0 && Array.isArray(inv.lineItems)) {
            const lineSum = (inv.lineItems as any[]).reduce((s, li) => {
              const v = Number(li?.value) || 0;
              return li?.description !== "Balance Applied" && v > 0 ? s + v : s;
            }, 0);
            if (lineSum > 0) trueVendorAmount = Math.round(lineSum);
          }
          if (trueVendorAmount <= 0 && fullShip) {
            const rateMatch = await lookupVendorRate(prisma, {
              organizationId: session.organizationId,
              vendor: fullShip.vendor || vendor.CompanyName,
              serviceMode: fullShip.serviceMode,
              destination: fullShip.destination || inv.destination,
              packaging: fullShip.packaging,
              weight: Number(fullShip.totalWeight || fullShip.weight || inv.weight) || 0,
            });
            if (rateMatch && rateMatch.vendorPrice > 0) {
              trueVendorAmount = Math.round(rateMatch.vendorPrice);
            }
          }
          if (trueVendorAmount <= 0 && fullShip && Number(fullShip.price) > 0) {
            const fallbackPrice = Math.round(Number(fullShip.price) - (Number(fullShip.fixedCharge) || 0));
            if (fallbackPrice > 0) trueVendorAmount = fallbackPrice;
          }

          if (trueVendorAmount > 0) {
            if ((Number(inv.totalAmount) || 0) <= 0) {
              await prisma.invoice.update({
                where: { id: inv.id },
                data: { totalAmount: trueVendorAmount },
              });
              (inv as any).totalAmount = trueVendorAmount;
            }
            if (fullShip && (Number(fullShip.cos) || 0) <= 0) {
              await prisma.shipment.update({
                where: { id: fullShip.id },
                data: { cos: trueVendorAmount },
              });
            }
            const keptTx = keptDebitByInv.get(inv.invoiceNumber);
            if (keptTx && Math.abs(keptTx.amount - trueVendorAmount) > 0.01) {
              await prisma.vendorTransaction.update({
                where: { id: keptTx.id },
                data: { amount: trueVendorAmount },
              });
              // Fast list path already computes chronological runningBal and updates vendor.currentBalance
            }
          }
        }

        const missingInvoices = vendorInvoices.filter(
          (inv) => !existingSet.has(inv.invoiceNumber) && Number(inv.totalAmount) > 0
        );

        if (missingInvoices.length > 0) {
          for (const inv of missingInvoices) {
            const tracking = inv.shipment?.trackingId || inv.trackingNumber || "N/A";
            const country = inv.shipment?.destination || inv.destination || "N/A";
            const pkg = inv.shipment?.packaging || "Wpx";
            const wt = Number(inv.shipment?.totalWeight || inv.shipment?.weight || inv.weight) || 0;
            const desc = `Tracking: ${tracking} | Country: ${country} | Type: ${pkg} | Weight: ${wt}Kg`;
            const txDate = inv.shipment?.shipmentDate || inv.invoiceDate || inv.createdAt;

            await prisma.vendorTransaction.create({
              data: {
                organizationId: session.organizationId,
                vendorId,
                type: "DEBIT",
                amount: Number(inv.totalAmount),
                description: desc,
                reference: inv.invoiceNumber,
                invoice: inv.invoiceNumber,
                previousBalance: 0,
                newBalance: Number(inv.totalAmount),
                createdAt: txDate,
              },
            });
          }
          // Fast list path already computes chronological runningBal and updates vendor.currentBalance
        }
      }

      // Ensure all vendor adjustments (DebitNote: #DR / #CR) have corresponding VendorTransaction rows
      const vendorDebitNotes = await prisma.debitNote.findMany({
        where: { ...debitNoteOrgFilter(session), vendorId },
        include: {
          bill: { select: { invoiceNumber: true } },
        },
      });

      if (vendorDebitNotes.length > 0) {
        const dnNumbers = vendorDebitNotes
          .map((dn) => dn.debitNoteNumber)
          .filter(Boolean);
        const existingDnTxs = await prisma.vendorTransaction.findMany({
          where: orgWhere(session, {
            vendorId,
            reference: { in: dnNumbers },
          }),
          select: { id: true, reference: true, type: true, amount: true, invoice: true },
        });

        const existingDnTxByRef = new Map(
          existingDnTxs.map((t) => [t.reference!, t])
        );

        for (const dn of vendorDebitNotes) {
          const dnAmt = Math.abs(Number(dn.amount) || 0);
          if (dnAmt <= 0 || !dn.debitNoteNumber) continue;

          const existingTx = existingDnTxByRef.get(dn.debitNoteNumber);
          const inferredType =
            dn.type === "DEBIT" || dn.type === "CREDIT"
              ? (dn.type as "DEBIT" | "CREDIT")
              : inferAdjustmentType({
                  noteType: dn.type,
                  reference: dn.debitNoteNumber,
                  description: dn.description,
                  transactionType:
                    existingTx?.type === "DEBIT" || existingTx?.type === "CREDIT"
                      ? existingTx.type
                      : null,
                  fallback: "DEBIT",
                });
          const expectedInv =
            dn.bill?.invoiceNumber || (dn.billId ? `Bill ${dn.billId}` : null);
          const expectedDesc =
            dn.description ||
            normalizeNoteLineDescription(
              inferredType === "CREDIT" ? "credit" : "debit",
              "",
              dn.debitNoteNumber
            );

          if (!existingTx) {
            await prisma.vendorTransaction.create({
              data: {
                organizationId: session.organizationId,
                vendorId,
                type: inferredType,
                amount: dnAmt,
                description: expectedDesc,
                reference: dn.debitNoteNumber,
                invoice: expectedInv,
                previousBalance: 0,
                newBalance: inferredType === "DEBIT" ? dnAmt : -dnAmt,
                createdAt: dn.date || dn.createdAt,
              },
            });
          } else if (
            existingTx.type !== inferredType ||
            Math.abs(Number(existingTx.amount) - dnAmt) > 0.01 ||
            (!existingTx.invoice && expectedInv)
          ) {
            await prisma.vendorTransaction.update({
              where: { id: existingTx.id },
              data: {
                type: inferredType,
                amount: dnAmt,
                ...(expectedInv && !existingTx.invoice ? { invoice: expectedInv } : {}),
              },
            });
          }
        }
      }
    } catch (healErr) {
      console.error("Error in vendor transaction self-heal:", healErr);
    }

    // List path: use existing balances; always filter and sort by voucher date (not createdAt)
    if (!recalcBalances) {
      const whereForList: any = { ...whereClause };

      const listTransactions = await prisma.vendorTransaction.findMany({
        where: whereForList,
      });

      if (listTransactions.length === 0) {
        return NextResponse.json({
          vendor: {
            id: vendor.id,
            CompanyName: vendor.CompanyName,
            PersonName: vendor.PersonName,
            currentBalance: Number(vendor.currentBalance || 0),
            creditLimit: Number(vendor.creditLimit || 0),
            Address: vendor.Address,
            City: vendor.City,
            Country: vendor.Country,
          },
          transactions: [],
          total: 0,
          page,
          limit: isAllLimit || !limit ? 0 : limit,
          totalPages: 1,
        });
      }

      const debitNoteRefsList = listTransactions
        .filter((t) => isVendorDebitNoteReference(t.reference))
        .map((t) => t.reference!)
        .filter((ref, index, self) => self.indexOf(ref) === index);

      const debitNotesMapList = new Map<string, Date>();
      if (debitNoteRefsList.length > 0) {
        const debitNotesList = await prisma.debitNote.findMany({
          where: { ...debitNoteOrgFilter(session), debitNoteNumber: { in: debitNoteRefsList } },
          select: { debitNoteNumber: true, date: true },
        });
        debitNotesList.forEach((dn) => {
          if (dn.date) debitNotesMapList.set(dn.debitNoteNumber, dn.date);
        });
      }

      const invoiceNumbersList = listTransactions
        .filter((t) => t.invoice)
        .map((t) => t.invoice!)
        .filter((inv, index, self) => self.indexOf(inv) === index);

      const invoicesMapList = new Map<string, InvoiceFieldsForDebitVoucher>();
      if (invoiceNumbersList.length > 0) {
        const invoicesList = await prisma.invoice.findMany({
          where: { ...orgWhere(session), invoiceNumber: { in: invoiceNumbersList } },
          include: {
            shipment: { select: { shipmentDate: true } },
          },
        });
        invoicesList.forEach((inv) => {
          invoicesMapList.set(inv.invoiceNumber, {
            shipmentDate: inv.shipment?.shipmentDate || undefined,
            invoiceDate: inv.invoiceDate,
          });
        });
      }

      const creditTxList = listTransactions.filter((t) => t.type === "CREDIT");
      const creditInvoicesList = creditTxList
        .filter((t) => t.invoice)
        .map((t) => t.invoice!);
      const creditRefsList = creditTxList
        .filter((t) => t.reference)
        .map((t) => t.reference!);

      let paymentsListForVoucher: Array<{
        id: number;
        date: Date;
        amount: number;
        invoice: string | null;
        reference: string | null;
      }> = [];
      if (creditInvoicesList.length > 0 || creditRefsList.length > 0) {
        const uniqueInvList = [...new Set(creditInvoicesList)];
        const uniqueRefList = [...new Set(creditRefsList)];
        paymentsListForVoucher = await prisma.payment.findMany({
          where: orgWhere(session, {
            toVendorId: vendorId,
            transactionType: "EXPENSE",
            OR: [
              ...(uniqueRefList.length > 0
                ? [{ reference: { in: uniqueRefList } }]
                : []),
              ...(uniqueInvList.length > 0
                ? [{ invoice: { in: uniqueInvList } }]
                : []),
            ],
          }),
          select: {
            id: true,
            invoice: true,
            reference: true,
            date: true,
            amount: true,
          },
          orderBy: { date: "desc" },
        });
      }

      const transactionsWithVoucherDatesList = listTransactions.map(
        (transaction) => {
          const voucherDate = computeVendorLedgerVoucherDate(transaction, {
            debitNotesMap: debitNotesMapList,
            invoicesMap: invoicesMapList,
            paymentsForVoucher: paymentsListForVoucher,
          });
          return { ...transaction, voucherDate };
        }
      );

      // Sort all vendor transactions chronologically (oldest -> newest) to compute exact running balance
      const chronologicalAll = [...transactionsWithVoucherDatesList].sort((a, b) => {
        const dateDiff = a.voucherDate.getTime() - b.voucherDate.getTime();
        if (dateDiff !== 0) return dateDiff;
        if (a.type === "DEBIT" && b.type === "CREDIT") return 1;
        if (a.type === "CREDIT" && b.type === "DEBIT") return -1;
        const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
        if (timeDiff !== 0) return timeDiff;
        if (a.invoice && b.invoice) {
          const invA = parseInt(a.invoice, 10);
          const invB = parseInt(b.invoice, 10);
          if (!Number.isNaN(invA) && !Number.isNaN(invB)) {
            return invA - invB;
          }
          return a.invoice.localeCompare(b.invoice);
        }
        return 0;
      });

      const startingBalanceTransaction = chronologicalAll.find(
        (t) => t.reference && t.reference.startsWith("STARTING-BALANCE")
      );

      let runningBal = 0;
      if (startingBalanceTransaction) {
        runningBal = startingBalanceTransaction.type === 'DEBIT' 
          ? Number(startingBalanceTransaction.amount || 0)
          : -Number(startingBalanceTransaction.amount || 0);
      }

      const balanceByTxId = new Map<number, { previousBalance: number; newBalance: number }>();
      if (startingBalanceTransaction) {
        balanceByTxId.set(startingBalanceTransaction.id, {
          previousBalance: 0,
          newBalance: runningBal
        });
      }

      for (const t of chronologicalAll) {
        if (t.reference && t.reference.startsWith("STARTING-BALANCE")) continue;
        const prev = runningBal;
        const next = t.type === 'DEBIT' ? prev + Number(t.amount || 0) : prev - Number(t.amount || 0);
        runningBal = next;
        balanceByTxId.set(t.id, {
          previousBalance: prev,
          newBalance: next
        });
      }

      let filteredTransactionsList = transactionsWithVoucherDatesList;
      if (fromDate || toDate) {
        const fromDateObj = fromDate ? new Date(fromDate) : null;
        const toDateObj = toDate ? new Date(toDate) : null;
        filteredTransactionsList = transactionsWithVoucherDatesList.filter(
          (transaction) => {
            const voucherDate = transaction.voucherDate;
            if (fromDateObj && voucherDate < fromDateObj) {
              return false;
            }
            if (toDateObj && voucherDate > toDateObj) {
              return false;
            }
            return true;
          }
        );
      }

      if (filteredTransactionsList.length === 0) {
        return NextResponse.json({
          vendor: {
            id: vendor.id,
            CompanyName: vendor.CompanyName,
            PersonName: vendor.PersonName,
            currentBalance: vendor.currentBalance,
            creditLimit: vendor.creditLimit,
            Address: vendor.Address,
            City: vendor.City,
            Country: vendor.Country,
          },
          transactions: [],
          total: 0,
          page,
          limit: isAllLimit || !limit ? 0 : limit,
          totalPages: 1,
        });
      }

      const total = filteredTransactionsList.length;

      const transactionIdsForSort = filteredTransactionsList.map((t) => t.id);
      const fullTransactionsForSortingList =
        await prisma.vendorTransaction.findMany({
          where: { id: { in: transactionIdsForSort } },
          orderBy: { [validSortField]: validSortOrder },
        });

      const transactionDataMapList = new Map(
        fullTransactionsForSortingList.map((t) => [t.id, t])
      );

      filteredTransactionsList.sort((a, b) => {
        const transactionA = transactionDataMapList.get(a.id);
        const transactionB = transactionDataMapList.get(b.id);
        if (!transactionA || !transactionB) return 0;

        if (validSortField === "createdAt") {
          const dateDiff =
            a.voucherDate.getTime() - b.voucherDate.getTime();
          if (dateDiff !== 0) {
            return validSortOrder === "desc" ? -dateDiff : dateDiff;
          }
          // Same date, compare exact creation time (latest first for desc order)
          const timeDiff =
            a.createdAt.getTime() - b.createdAt.getTime();
          if (timeDiff !== 0) {
            return validSortOrder === "desc" ? -timeDiff : timeDiff;
          }
          if (a.type === "DEBIT" && b.type === "CREDIT") {
            return validSortOrder === "desc" ? 1 : -1;
          }
          if (a.type === "CREDIT" && b.type === "DEBIT") {
            return validSortOrder === "desc" ? -1 : 1;
          }
          return 0;
        }
        const aIndex = fullTransactionsForSortingList.findIndex(
          (t) => t.id === a.id
        );
        const bIndex = fullTransactionsForSortingList.findIndex(
          (t) => t.id === b.id
        );
        return aIndex - bIndex;
      });

      const paginatedTransactionIdsList =
        isAllLimit || !limit
          ? filteredTransactionsList.map((t) => t.id)
          : filteredTransactionsList
              .slice(skip, skip + limit)
              .map((t) => t.id);

      const pageRows = await prisma.vendorTransaction.findMany({
        where: { id: { in: paginatedTransactionIdsList } },
      });

      const transactionMapList = new Map(pageRows.map((t) => [t.id, t]));
      const orderedTransactions = paginatedTransactionIdsList
        .map((id) => transactionMapList.get(id))
        .filter((t): t is NonNullable<typeof t> => t !== undefined);

      // Batch fetch shipment information and payment dates for paginated transactions
      const paginatedInvoiceNumbers = orderedTransactions
        .filter((t) => t.invoice)
        .map((t) => t.invoice!)
        .filter((inv, index, self) => self.indexOf(inv) === index);

      const paginatedDebitNoteRefs = orderedTransactions
        .filter((t) => isVendorDebitNoteReference(t.reference))
        .map((t) => t.reference!)
        .filter((ref, index, self) => self.indexOf(ref) === index);

      // Batch fetch invoices with full shipment info
      const paginatedInvoicesMap = new Map<string, any>();
      if (paginatedInvoiceNumbers.length > 0) {
        const paginatedInvoices = await prisma.invoice.findMany({
          where: { ...orgWhere(session), invoiceNumber: { in: paginatedInvoiceNumbers } },
          include: {
            shipment: {
              select: {
                trackingId: true,
                weight: true,
                destination: true,
                referenceNumber: true,
                deliveryStatus: true,
                shipmentDate: true,
                recipientName: true,
              },
            },
          },
        });
        paginatedInvoices.forEach((inv) => {
          paginatedInvoicesMap.set(inv.invoiceNumber, inv);
        });
      }

      const invoicesFieldsByNumber = new Map<string, InvoiceFieldsForDebitVoucher>();
      paginatedInvoicesMap.forEach((inv, invoiceNumber) => {
        invoicesFieldsByNumber.set(invoiceNumber, {
          shipmentDate: inv.shipment?.shipmentDate ?? undefined,
          invoiceDate: inv.invoiceDate,
        });
      });

      // Batch fetch debit notes for paginated transactions
      const paginatedDebitNotesMap = new Map<string, Date>();
      const paginatedDebitNoteInvoiceMap = new Map<string, string>();
      if (paginatedDebitNoteRefs.length > 0) {
        const paginatedDebitNotes = await prisma.debitNote.findMany({
          where: { ...debitNoteOrgFilter(session), debitNoteNumber: { in: paginatedDebitNoteRefs } },
          select: {
            debitNoteNumber: true,
            date: true,
            bill: { select: { invoiceNumber: true } },
          },
        });
        paginatedDebitNotes.forEach((dn) => {
          if (dn.date) paginatedDebitNotesMap.set(dn.debitNoteNumber, dn.date);
          const inv = dn.bill?.invoiceNumber;
          if (inv) paginatedDebitNoteInvoiceMap.set(dn.debitNoteNumber, inv);
        });

        // Ensure bill invoices linked to adjustments are available for shipment lookup
        const missingBillInvoices = [...paginatedDebitNoteInvoiceMap.values()].filter(
          (inv) => !paginatedInvoicesMap.has(inv)
        );
        if (missingBillInvoices.length > 0) {
          const extraInvoices = await prisma.invoice.findMany({
            where: { ...orgWhere(session), invoiceNumber: { in: missingBillInvoices } },
            include: {
              shipment: {
                select: {
                  trackingId: true,
                  weight: true,
                  destination: true,
                  referenceNumber: true,
                  deliveryStatus: true,
                  shipmentDate: true,
                  recipientName: true,
                },
              },
            },
          });
          extraInvoices.forEach((inv) => {
            paginatedInvoicesMap.set(inv.invoiceNumber, inv);
            invoicesFieldsByNumber.set(inv.invoiceNumber, {
              shipmentDate: inv.shipment?.shipmentDate ?? undefined,
              invoiceDate: inv.invoiceDate,
            });
          });
        }
      }

      // Batch fetch payments for CREDIT transactions in paginated results.
      // IMPORTANT: Match by reference first, then fallback to invoice.
      // Using only "latest payment per invoice" can assign wrong dates when
      // there are multiple payments against the same invoice.
      const paginatedCreditTransactions = orderedTransactions.filter(
        (t) => t.type === "CREDIT"
      );
      const paginatedCreditInvoices = paginatedCreditTransactions
        .filter((t) => t.invoice)
        .map((t) => t.invoice!);
      const paginatedCreditReferences = paginatedCreditTransactions
        .filter((t) => t.reference)
        .map((t) => t.reference!);

      let paginatedPaymentsList: Array<{
        id: number;
        date: Date;
        amount: number;
        invoice: string | null;
        reference: string | null;
      }> = [];
      if (
        paginatedCreditInvoices.length > 0 ||
        paginatedCreditReferences.length > 0
      ) {
        const uniquePaginatedInvoices = [...new Set(paginatedCreditInvoices)];
        const uniquePaginatedReferences = [...new Set(paginatedCreditReferences)];
        paginatedPaymentsList = await prisma.payment.findMany({
          where: orgWhere(session, {
            toVendorId: vendorId,
            transactionType: "EXPENSE",
            OR: [
              ...(uniquePaginatedReferences.length > 0
                ? [{ reference: { in: uniquePaginatedReferences } }]
                : []),
              ...(uniquePaginatedInvoices.length > 0
                ? [{ invoice: { in: uniquePaginatedInvoices } }]
                : []),
            ],
          }),
          select: {
            id: true,
            invoice: true,
            reference: true,
            date: true,
            amount: true,
          },
          orderBy: { date: "desc" },
        });
      }

      const transactionsWithShipmentInfo = orderedTransactions.map(
        (transaction) => {
          let shipmentInfo = null;
          let shipmentDate: string | undefined = undefined;
          let paymentDate: string | undefined = undefined;
          let debitNoteDate: string | undefined = undefined;
          let consigneeName: string | undefined = undefined;
          let trackingId: string | undefined = undefined;

          if (transaction.reference) {
            const dnDate = paginatedDebitNotesMap.get(transaction.reference);
            if (dnDate) {
              debitNoteDate = dnDate.toISOString();
            }
          }

          const fromDebitNote =
            !!transaction.reference &&
            paginatedDebitNotesMap.has(transaction.reference);

          if (transaction.type === "CREDIT" && !fromDebitNote) {
            const paymentDateObj = resolveCreditPaymentVoucherDate(
              {
                amount: transaction.amount,
                invoice: transaction.invoice,
                reference: transaction.reference,
                createdAt: transaction.createdAt,
              },
              paginatedPaymentsList
            );
            if (paymentDateObj) {
              paymentDate = paymentDateObj.toISOString();
            }
          }

          const resolvedInvoice =
            (transaction.invoice && paginatedInvoicesMap.has(transaction.invoice)
              ? transaction.invoice
              : null) ??
            (transaction.reference
              ? paginatedDebitNoteInvoiceMap.get(transaction.reference) ?? null
              : null);

          if (resolvedInvoice) {
            const invoice = paginatedInvoicesMap.get(resolvedInvoice);

            if (invoice?.shipment) {
              shipmentInfo = {
                awbNo: invoice.shipment.trackingId,
                weight: invoice.shipment.weight,
                destination: invoice.shipment.destination,
                referenceNo: invoice.shipment.referenceNumber,
                status: invoice.shipment.deliveryStatus || "Sale",
                shipmentDate: invoice.shipment.shipmentDate,
              };

              if (invoice.shipment.shipmentDate) {
                shipmentDate = invoice.shipment.shipmentDate.toISOString();
              }

              if (invoice.shipment.recipientName) {
                consigneeName = invoice.shipment.recipientName;
              }

              if (invoice.shipment.trackingId) {
                trackingId = invoice.shipment.trackingId;
              }
            }
          }

          const ledgerVoucherDate = computeVendorLedgerVoucherDate(
            transaction,
            {
              debitNotesMap: paginatedDebitNotesMap,
              invoicesMap: invoicesFieldsByNumber,
              paymentsForVoucher: paginatedPaymentsList,
            }
          );

          const computedBal = balanceByTxId.get(transaction.id);
          return {
            ...transaction,
            previousBalance: computedBal !== undefined ? computedBal.previousBalance : transaction.previousBalance,
            newBalance: computedBal !== undefined ? computedBal.newBalance : transaction.newBalance,
            shipmentInfo,
            shipmentDate,
            paymentDate,
            debitNoteDate,
            consigneeName,
            trackingId,
            ledgerVoucherDate: ledgerVoucherDate.toISOString(),
          };
        }
      );

      // Keep vendor.currentBalance in sync with the computed ledger balance when viewing all transactions
      if (!search && Math.abs((Number(vendor.currentBalance) || 0) - runningBal) > 0.01) {
        await prisma.vendors.update({
          where: { id: vendorId },
          data: { currentBalance: runningBal },
        });
      }

      return NextResponse.json({
        vendor: {
          id: vendor.id,
          CompanyName: vendor.CompanyName,
          PersonName: vendor.PersonName,
          currentBalance: runningBal,
          creditLimit: Number(vendor.creditLimit || 0),
          Address: vendor.Address,
          City: vendor.City,
          Country: vendor.Country,
        },
        transactions: transactionsWithShipmentInfo,
        total,
        page,
        limit: isAllLimit || !limit ? total : limit,
        totalPages:
          isAllLimit || !limit
            ? 1
            : Math.ceil(total / (limit || 1)),
      });
    }

    // Heavy path: full-history recalculation, only when explicitly requested
    const allTransactions = await prisma.vendorTransaction.findMany({
      where: orgWhere(session, { vendorId: vendorId }),
      orderBy: { createdAt: 'asc' }, // Sort chronologically by createdAt first
      select: {
        id: true,
        type: true,
        amount: true,
        createdAt: true,
        invoice: true,
        reference: true
      }
    });

    // Batch fetch all related data to avoid N+1 queries
    const debitNoteRefs = allTransactions
      .filter((t) => isVendorDebitNoteReference(t.reference))
      .map(t => t.reference!)
      .filter((ref, index, self) => self.indexOf(ref) === index); // unique refs
    
    const debitNotesMap = new Map<string, Date>();
    const debitNoteInvoiceByRefHeavy = new Map<string, string>();
    if (debitNoteRefs.length > 0) {
      const debitNotes = await prisma.debitNote.findMany({
        where: { ...debitNoteOrgFilter(session), debitNoteNumber: { in: debitNoteRefs } },
        select: {
          debitNoteNumber: true,
          date: true,
          bill: { select: { invoiceNumber: true } },
        },
      });
      debitNotes.forEach(dn => {
        if (dn.date) debitNotesMap.set(dn.debitNoteNumber, dn.date);
        const inv = dn.bill?.invoiceNumber;
        if (inv) debitNoteInvoiceByRefHeavy.set(dn.debitNoteNumber, inv);
      });
    }

    // Batch fetch invoices with shipments
    const invoiceNumbers = allTransactions
      .filter(t => t.invoice)
      .map(t => t.invoice!)
      .filter((inv, index, self) => self.indexOf(inv) === index); // unique invoices
    
    const invoicesMap = new Map<string, InvoiceFieldsForDebitVoucher>();
    if (invoiceNumbers.length > 0) {
      const invoices = await prisma.invoice.findMany({
        where: { ...orgWhere(session), invoiceNumber: { in: invoiceNumbers } },
        include: {
          shipment: {
            select: { shipmentDate: true }
          }
        }
      });
      invoices.forEach(inv => {
        invoicesMap.set(inv.invoiceNumber, {
          shipmentDate: inv.shipment?.shipmentDate || undefined,
          invoiceDate: inv.invoiceDate,
        });
      });
    }

    // Batch fetch payments for CREDIT transactions.
    // Match by reference first, then fallback to invoice.
    const creditTransactions = allTransactions.filter((t) => t.type === "CREDIT");
    const creditTransactionInvoices = creditTransactions
      .filter((t) => t.invoice)
      .map((t) => t.invoice!);
    const creditTransactionReferences = creditTransactions
      .filter((t) => t.reference)
      .map((t) => t.reference!);
    
    let paymentsForVoucherHeavy: Array<{
      id: number;
      date: Date;
      amount: number;
      invoice: string | null;
      reference: string | null;
    }> = [];
    if (creditTransactionInvoices.length > 0 || creditTransactionReferences.length > 0) {
      const uniqueInvoices = [...new Set(creditTransactionInvoices)];
      const uniqueReferences = [...new Set(creditTransactionReferences)];
      paymentsForVoucherHeavy = await prisma.payment.findMany({
        where: orgWhere(session, {
          toVendorId: vendorId,
          transactionType: "EXPENSE",
          OR: [
            ...(uniqueReferences.length > 0
              ? [{ reference: { in: uniqueReferences } }]
              : []),
            ...(uniqueInvoices.length > 0 ? [{ invoice: { in: uniqueInvoices } }] : []),
          ],
        }),
        select: {
          id: true,
          invoice: true,
          reference: true,
          date: true,
          amount: true,
        },
        orderBy: { date: "desc" },
      });
    }

    const transactionsWithVoucherDates = allTransactions.map((transaction) => {
      const voucherDate = computeVendorLedgerVoucherDate(transaction, {
        debitNotesMap,
        invoicesMap,
        paymentsForVoucher: paymentsForVoucherHeavy,
      });
      return {
        ...transaction,
        voucherDate,
        invoice:
          transaction.invoice ??
          (transaction.reference
            ? debitNoteInvoiceByRefHeavy.get(transaction.reference) ?? null
            : null),
      };
    });

    // Sort by voucher date (not createdAt) for balance calculation
    // For the same date:
    // - CREDIT (payment) before DEBIT (shipment)
    // - Within the same type, order by invoice number ascending so that the
    //   highest invoice ends up last for that date (and therefore gets the
    //   final balance for that date, which the UI then shows at the top).
    transactionsWithVoucherDates.sort((a, b) => {
      const dateDiff = a.voucherDate.getTime() - b.voucherDate.getTime(); // oldest -> newest
      if (dateDiff !== 0) {
        return dateDiff;
      }
      // Same date, different types
      if (a.type === "DEBIT" && b.type === "CREDIT") return 1;
      if (a.type === "CREDIT" && b.type === "DEBIT") return -1;

      // Same date, same type – compare exact creation time (oldest first, latest last)
      const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }

      // Same date, same type – use invoice number ascending when available
      if (a.invoice && b.invoice) {
        const invA = parseInt(a.invoice, 10);
        const invB = parseInt(b.invoice, 10);
        if (!Number.isNaN(invA) && !Number.isNaN(invB)) {
          return invA - invB; // lowest invoice first, highest last
        }
        return a.invoice.localeCompare(b.invoice);
      }

      return 0;
    });

    // Find starting balance transaction (reference starts with "STARTING-BALANCE")
    const startingBalanceTransaction = transactionsWithVoucherDates.find(
      (t) => t.reference && t.reference.startsWith("STARTING-BALANCE")
    );

    // Calculate initial balance from starting balance transaction
    // For vendors: DEBIT increases balance (we owe them), CREDIT decreases (we pay them)
    // Starting balance transaction sets the initial balance
    let runningBalance = 0;
    if (startingBalanceTransaction) {
      // The starting balance transaction itself represents the initial balance
      // If it's DEBIT, we owe them (positive balance), if CREDIT, they owe us (negative balance)
      runningBalance = startingBalanceTransaction.type === 'DEBIT' 
        ? Number(startingBalanceTransaction.amount || 0) 
        : -Number(startingBalanceTransaction.amount || 0);
    }

    // Recalculate balances chronologically based on voucher date
    // Exclude starting balance transaction from the loop since it already sets the initial balance
    const transactionsToUpdate = transactionsWithVoucherDates
      .filter((transaction) => !transaction.reference || !transaction.reference.startsWith("STARTING-BALANCE"))
      .map((transaction) => {
        const previousBalance = Number(runningBalance) || 0;
        const txAmount = Number(transaction.amount || 0);
        // For vendors: DEBIT increases balance (we owe them), CREDIT decreases (we pay them)
        const newBalance = transaction.type === 'DEBIT' 
          ? previousBalance + txAmount 
          : previousBalance - txAmount;
        runningBalance = newBalance;
      
        return {
          id: transaction.id,
          previousBalance,
          newBalance
        };
      });

    // Also update the starting balance transaction with its own balance values
    if (startingBalanceTransaction) {
      const startingBalance = startingBalanceTransaction.type === 'DEBIT' 
        ? Number(startingBalanceTransaction.amount || 0) 
        : -Number(startingBalanceTransaction.amount || 0);
      transactionsToUpdate.push({
        id: startingBalanceTransaction.id,
        previousBalance: 0,
        newBalance: startingBalance
      });
    }

    // Update all transactions with recalculated balances in chunks to prevent connection pool exhaustion
    const CHUNK_SIZE = 20;
    for (let i = 0; i < transactionsToUpdate.length; i += CHUNK_SIZE) {
      const chunk = transactionsToUpdate.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(({ id, previousBalance, newBalance }) =>
          prisma.vendorTransaction.update({
            where: { id },
            data: { previousBalance, newBalance }
          })
        )
      );
    }

    // Update vendor's currentBalance to match the final runningBalance after all transactions
    // Use runningBalance which already has the final calculated balance
    await prisma.vendors.update({
      where: { id: vendorId },
      data: { currentBalance: runningBalance }
    });
    // Update vendor object for response
    vendor.currentBalance = runningBalance;

    // Filter by voucher date if date range is provided
    let filteredTransactions = transactionsWithVoucherDates;
    if (fromDate || toDate) {
      const fromDateObj = fromDate ? new Date(fromDate) : null;
      const toDateObj = toDate ? new Date(toDate) : null;
      
      filteredTransactions = transactionsWithVoucherDates.filter((transaction) => {
        const voucherDate = transaction.voucherDate;
        if (fromDateObj && voucherDate < fromDateObj) {
          return false;
        }
        if (toDateObj && voucherDate > toDateObj) {
          return false;
        }
        return true;
      });
    }

    // Apply search filter if provided
    let matchingTransactionIds: number[] = [];
    if (search) {
      const searchWhereClause: any = orgWhere(session, {
        vendorId: vendorId
      });
      
      // Try to parse as number for price search
      const searchAsNumber = parseFloat(search);
      const isNumericSearch = !isNaN(searchAsNumber);
      
      // Get all country codes that match the search term (by name or code)
      const matchingCountryCodes: string[] = [];
      if (search.trim()) {
        const allCountries = Country.getAllCountries();
        const searchLower = search.toLowerCase().trim();
        allCountries.forEach(country => {
          if (
            country.name.toLowerCase().includes(searchLower) ||
            country.isoCode.toLowerCase().includes(searchLower) ||
            country.name.toLowerCase() === searchLower
          ) {
            matchingCountryCodes.push(country.isoCode);
          }
        });
      }
      
      // Find invoices/shipments matching destination search
      let matchingInvoiceNumbers: string[] = [];
      if (matchingCountryCodes.length > 0 || search.trim()) {
        const invoiceSearchConditions: any = {
          OR: [
            { destination: { contains: search} }
          ]
        };
        if (matchingCountryCodes.length > 0) {
          invoiceSearchConditions.OR.push({
            destination: { in: matchingCountryCodes }
          });
        }
        
        const matchingInvoices = await prisma.invoice.findMany({
          where: { ...orgWhere(session), ...invoiceSearchConditions },
          select: { invoiceNumber: true }
        });
        matchingInvoiceNumbers = matchingInvoices.map(inv => inv.invoiceNumber);
      }
      
      // Build search conditions
      const searchConditions: any[] = [
        { description: { contains: search} },
        { reference: { contains: search} }
      ];
      
      // Add amount search (exact match or range)
      if (isNumericSearch) {
        searchConditions.push({
          amount: {
            gte: searchAsNumber * 0.99,
            lte: searchAsNumber * 1.01
          }
        });
      }
      
      // Add invoice number search if we found matching invoices
      if (matchingInvoiceNumbers.length > 0) {
        searchConditions.push({
          invoice: { in: matchingInvoiceNumbers }
        });
      }
      
      searchWhereClause.OR = searchConditions;
      
      const matchingTransactions = await prisma.vendorTransaction.findMany({
        where: searchWhereClause,
        select: { id: true }
      });
      matchingTransactionIds = matchingTransactions.map(t => t.id);
      
      // Apply search filter to filtered transactions
      filteredTransactions = filteredTransactions.filter(t => matchingTransactionIds.includes(t.id));
    }

    // Get total count after date and search filtering
    const total = filteredTransactions.length;

    // Fetch full transaction data for sorting
    const transactionIds = filteredTransactions.map(t => t.id);
    const fullTransactionsForSorting = await prisma.vendorTransaction.findMany({
      where: { id: { in: transactionIds } },
      orderBy: { [validSortField]: validSortOrder }
    });
    
    // Create a map for quick lookup
    const transactionDataMap = new Map(fullTransactionsForSorting.map(t => [t.id, t]));
    
    // Sort filteredTransactions based on the sort field
    filteredTransactions.sort((a, b) => {
      const transactionA = transactionDataMap.get(a.id);
      const transactionB = transactionDataMap.get(b.id);
      
      if (!transactionA || !transactionB) return 0;
      
      if (validSortField === 'createdAt') {
        // For createdAt, sort by voucher date instead
        const dateDiff = a.voucherDate.getTime() - b.voucherDate.getTime();
        if (dateDiff !== 0) {
          return validSortOrder === 'desc' ? -dateDiff : dateDiff;
        }
        // Same date, compare exact creation time (latest first for desc order)
        const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
        if (timeDiff !== 0) {
          return validSortOrder === 'desc' ? -timeDiff : timeDiff;
        }
        // Same date: DEBIT (shipment/invoice) before CREDIT (payment)
        if (a.type === "DEBIT" && b.type === "CREDIT") return validSortOrder === 'desc' ? 1 : -1;
        if (a.type === "CREDIT" && b.type === "DEBIT") return validSortOrder === 'desc' ? -1 : 1;
        return 0;
      } else {
        // For other fields, use the database sort order
        const aIndex = fullTransactionsForSorting.findIndex(t => t.id === a.id);
        const bIndex = fullTransactionsForSorting.findIndex(t => t.id === b.id);
        return aIndex - bIndex;
      }
    });

    // Apply pagination
    const paginatedTransactionIds = isAllLimit || !limit
      ? filteredTransactions.map(t => t.id)
      : filteredTransactions
          .slice(skip, skip + limit)
          .map(t => t.id);

    // Now get the paginated transactions with updated balances
    // Maintain the order from filteredTransactions
    const transactions = await prisma.vendorTransaction.findMany({
      where: { id: { in: paginatedTransactionIds } },
      include: {
        vendor: {
          select: {
            CompanyName: true,
            PersonName: true
          }
        }
      }
    });
    
    // Sort transactions to match the order from filteredTransactions
    const transactionMap = new Map(transactions.map(t => [t.id, t]));
    const orderedTransactions = paginatedTransactionIds
      .map(id => transactionMap.get(id))
      .filter((t): t is NonNullable<typeof t> => t !== undefined);

    // Batch fetch shipment information and payment dates for paginated transactions
    const paginatedInvoiceNumbers = orderedTransactions
      .filter(t => t.invoice)
      .map(t => t.invoice!)
      .filter((inv, index, self) => self.indexOf(inv) === index);
    
    const paginatedDebitNoteRefs = orderedTransactions
      .filter((t) => isVendorDebitNoteReference(t.reference))
      .map(t => t.reference!)
      .filter((ref, index, self) => self.indexOf(ref) === index);
    
    // Batch fetch invoices with full shipment info
    const paginatedInvoicesMap = new Map<string, any>();
    if (paginatedInvoiceNumbers.length > 0) {
      const paginatedInvoices = await prisma.invoice.findMany({
        where: { ...orgWhere(session), invoiceNumber: { in: paginatedInvoiceNumbers } },
        include: {
          shipment: {
            select: {
              trackingId: true,
              weight: true,
              destination: true,
              referenceNumber: true,
              deliveryStatus: true,
              shipmentDate: true,
              recipientName: true
            }
          }
        }
      });
      paginatedInvoices.forEach(inv => {
        paginatedInvoicesMap.set(inv.invoiceNumber, inv);
      });
    }

    const invoicesFieldsByNumberRecalc = new Map<string, InvoiceFieldsForDebitVoucher>();
    paginatedInvoicesMap.forEach((inv, invoiceNumber) => {
      invoicesFieldsByNumberRecalc.set(invoiceNumber, {
        shipmentDate: inv.shipment?.shipmentDate ?? undefined,
        invoiceDate: inv.invoiceDate,
      });
    });
    
    // Batch fetch debit notes for paginated transactions
    const paginatedDebitNotesMap = new Map<string, Date>();
    const paginatedDebitNoteInvoiceMapRecalc = new Map<string, string>();
    if (paginatedDebitNoteRefs.length > 0) {
      const paginatedDebitNotes = await prisma.debitNote.findMany({
        where: { ...debitNoteOrgFilter(session), debitNoteNumber: { in: paginatedDebitNoteRefs } },
        select: {
          debitNoteNumber: true,
          date: true,
          bill: { select: { invoiceNumber: true } },
        },
      });
      paginatedDebitNotes.forEach((dn) => {
        if (dn.date) paginatedDebitNotesMap.set(dn.debitNoteNumber, dn.date);
        const inv = dn.bill?.invoiceNumber;
        if (inv) paginatedDebitNoteInvoiceMapRecalc.set(dn.debitNoteNumber, inv);
      });

      const missingBillInvoices = [
        ...paginatedDebitNoteInvoiceMapRecalc.values(),
      ].filter((inv) => !paginatedInvoicesMap.has(inv));
      if (missingBillInvoices.length > 0) {
        const extraInvoices = await prisma.invoice.findMany({
          where: { ...orgWhere(session), invoiceNumber: { in: missingBillInvoices } },
          include: {
            shipment: {
              select: {
                trackingId: true,
                weight: true,
                destination: true,
                referenceNumber: true,
                deliveryStatus: true,
                shipmentDate: true,
                recipientName: true,
              },
            },
          },
        });
        extraInvoices.forEach((inv) => {
          paginatedInvoicesMap.set(inv.invoiceNumber, inv);
          invoicesFieldsByNumberRecalc.set(inv.invoiceNumber, {
            shipmentDate: inv.shipment?.shipmentDate ?? undefined,
            invoiceDate: inv.invoiceDate,
          });
        });
      }
    }
    
    // Batch fetch payments for CREDIT transactions in paginated results.
    // Match by reference first, then fallback to invoice.
    const paginatedCreditTransactions = orderedTransactions.filter(
      (t) => t.type === "CREDIT"
    );
    const paginatedCreditInvoices = paginatedCreditTransactions
      .filter((t) => t.invoice)
      .map(t => t.invoice!);
    const paginatedCreditReferences = paginatedCreditTransactions
      .filter((t) => t.reference)
      .map((t) => t.reference!);
    
    let paginatedPaymentsListRecalc: Array<{
      id: number;
      date: Date;
      amount: number;
      invoice: string | null;
      reference: string | null;
    }> = [];
    if (paginatedCreditInvoices.length > 0 || paginatedCreditReferences.length > 0) {
      const uniquePaginatedInvoices = [...new Set(paginatedCreditInvoices)];
      const uniquePaginatedReferences = [...new Set(paginatedCreditReferences)];
      paginatedPaymentsListRecalc = await prisma.payment.findMany({
        where: orgWhere(session, {
          toVendorId: vendorId,
          transactionType: "EXPENSE",
          OR: [
            ...(uniquePaginatedReferences.length > 0
              ? [{ reference: { in: uniquePaginatedReferences } }]
              : []),
            ...(uniquePaginatedInvoices.length > 0
              ? [{ invoice: { in: uniquePaginatedInvoices } }]
              : []),
          ],
        }),
        select: {
          id: true,
          invoice: true,
          reference: true,
          date: true,
          amount: true,
        },
        orderBy: { date: "desc" },
      });
    }

    const transactionsWithShipmentInfo = orderedTransactions.map((transaction) => {
      let shipmentInfo = null;
      let shipmentDate: string | undefined = undefined;
      let paymentDate: string | undefined = undefined;
      let debitNoteDate: string | undefined = undefined;
      let consigneeName: string | undefined = undefined;
      let trackingId: string | undefined = undefined;

      if (transaction.reference) {
        const dnDate = paginatedDebitNotesMap.get(transaction.reference);
        if (dnDate) {
          debitNoteDate = dnDate.toISOString();
        }
      }

      const fromDebitNote =
        !!transaction.reference &&
        paginatedDebitNotesMap.has(transaction.reference);

      if (transaction.type === "CREDIT" && !fromDebitNote) {
        const paymentDateObj = resolveCreditPaymentVoucherDate(
          {
            amount: transaction.amount,
            invoice: transaction.invoice,
            reference: transaction.reference,
            createdAt: transaction.createdAt,
          },
          paginatedPaymentsListRecalc
        );
        if (paymentDateObj) {
          paymentDate = paymentDateObj.toISOString();
        }
      }

      const resolvedInvoice =
        (transaction.invoice && paginatedInvoicesMap.has(transaction.invoice)
          ? transaction.invoice
          : null) ??
        (transaction.reference
          ? paginatedDebitNoteInvoiceMapRecalc.get(transaction.reference) ?? null
          : null);

      if (resolvedInvoice) {
        const invoice = paginatedInvoicesMap.get(resolvedInvoice);

        if (invoice?.shipment) {
          shipmentInfo = {
            awbNo: invoice.shipment.trackingId,
            weight: invoice.shipment.weight,
            destination: invoice.shipment.destination,
            referenceNo: invoice.shipment.referenceNumber,
            status: invoice.shipment.deliveryStatus || "Sale",
            shipmentDate: invoice.shipment.shipmentDate,
          };

          if (invoice.shipment.shipmentDate) {
            shipmentDate = invoice.shipment.shipmentDate.toISOString();
          }

          if (invoice.shipment.recipientName) {
            consigneeName = invoice.shipment.recipientName;
          }

          if (invoice.shipment.trackingId) {
            trackingId = invoice.shipment.trackingId;
          }
        }
      }

      const ledgerVoucherDateRecalc = computeVendorLedgerVoucherDate(
        transaction,
        {
          debitNotesMap: paginatedDebitNotesMap,
          invoicesMap: invoicesFieldsByNumberRecalc,
          paymentsForVoucher: paginatedPaymentsListRecalc,
        }
      );

      return {
        ...transaction,
        shipmentInfo,
        shipmentDate,
        paymentDate,
        debitNoteDate,
        consigneeName,
        trackingId,
        ledgerVoucherDate: ledgerVoucherDateRecalc.toISOString(),
      };
    });

    return NextResponse.json({
      vendor: {
        id: vendor.id,
        CompanyName: vendor.CompanyName,
        PersonName: vendor.PersonName,
        currentBalance: Number(vendor.currentBalance || 0),
        creditLimit: Number(vendor.creditLimit || 0),
        Address: vendor.Address,
        City: vendor.City,
        Country: vendor.Country,
      },
      transactions: transactionsWithShipmentInfo,
      total,
      page,
      limit: isAllLimit || !limit ? total : limit,
      totalPages:
        isAllLimit || !limit
          ? 1
          : Math.ceil(total / (limit || 1)),
    });

  } catch (error) {
    console.error("Error fetching vendor transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor transactions" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vendorId = parseInt(id);
    
    if (isNaN(vendorId)) {
      return NextResponse.json(
        { error: "Invalid vendor ID" },
        { status: 400 }
      );
    }

    const auth = await requirePermission(req, "manage_billing");
    if (auth.error) return auth.error;
    const { session } = auth;

    const vendorExists = await prisma.vendors.findFirst({
      where: orgWhere(session, { id: vendorId }),
    });
    if (!vendorExists) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { type, amount, description, reference, date } = body;

    if (!type || !amount || !description) {
      return NextResponse.json(
        { error: "Type, amount, and description are required" },
        { status: 400 }
      );
    }

    if (!['CREDIT', 'DEBIT'].includes(type)) {
      return NextResponse.json(
        { error: "Type must be CREDIT or DEBIT" },
        { status: 400 }
      );
    }

    // Check if this is a starting balance transaction
    const isStartingBalance = reference && reference.startsWith("STARTING-BALANCE");

    if (isStartingBalance) {
      // Find existing starting balance transaction
      const existingStartingBalance = await prisma.vendorTransaction.findFirst({
        where: orgWhere(session, {
          vendorId: vendorId,
          reference: { startsWith: "STARTING-BALANCE" }
        })
      });

      if (existingStartingBalance) {
        // Use provided date or default to earliest date for starting balance
        const transactionDate = date ? parseDateInputAsLocalDate(date) : new Date('1970-01-01');
        
        // Find and delete existing journal entries for this starting balance
        // Use the existing transaction's reference to find matching journal entries
        const targetRef = existingStartingBalance.reference || `STARTING-BALANCE-VEND-${vendorId}`;
        const existingJournalEntries = await prisma.journalEntry.findMany({
          where: orgWhere(session, {
            reference: targetRef
          })
        });
        
        // Delete journal entry lines first, then the journal entries
        for (const entry of existingJournalEntries) {
          await prisma.journalEntryLine.deleteMany({
            where: { journalEntryId: entry.id }
          });
          await prisma.journalEntry.delete({
            where: { id: entry.id }
          });
        }
        
        // Update existing starting balance transaction
        await prisma.vendorTransaction.update({
          where: { id: existingStartingBalance.id },
          data: {
            type: type,
            amount: parseFloat(amount),
            description: description,
            reference: reference,
            createdAt: transactionDate,
            previousBalance: 0,
            newBalance: type === 'DEBIT' ? parseFloat(amount) : -parseFloat(amount)
          }
        });
        
        // Create journal entry with the provided date (skip for CREDIT as it's not needed)
        if (type === 'DEBIT') {
          const transactionType = 'VENDOR_DEBIT';
          await createJournalEntryForTransaction(
            prisma,
            transactionType,
            parseFloat(amount),
            description,
            reference,
            undefined,
            transactionDate,
            session.organizationId
          );
        }

        // Trigger balance recalculation by calling GET endpoint logic
        // We'll need to recalculate all balances
        const allTransactions = await prisma.vendorTransaction.findMany({
          where: orgWhere(session, { vendorId: vendorId })
        });

        // Recalculate balances (this will be done on next GET request)
        // For now, just return success
        return NextResponse.json({
          success: true,
          message: "Starting balance updated successfully",
          previousBalance: 0,
          newBalance: type === 'DEBIT' ? parseFloat(amount) : -parseFloat(amount)
        });
      }
    }

    const result = await addVendorTransaction(
      prisma,
      vendorId,
      type,
      parseFloat(amount),
      description,
      reference,
      undefined,
      date ? parseDateInputAsLocalDate(date) : undefined,
      session.organizationId
    );

    // For starting balance, find the transaction we just created and update it
    if (isStartingBalance) {
      const createdTransaction = await prisma.vendorTransaction.findFirst({
        where: orgWhere(session, {
          vendorId: vendorId,
          reference: reference
        }),
        orderBy: { createdAt: 'desc' }
      });

      if (createdTransaction) {
        // Use provided date or default to earliest date for starting balance
        const transactionDate = date ? parseDateInputAsLocalDate(date) : new Date('1970-01-01');
        
        await prisma.vendorTransaction.update({
          where: { id: createdTransaction.id },
          data: {
            createdAt: transactionDate,
            previousBalance: 0,
            newBalance: type === 'DEBIT' ? parseFloat(amount) : -parseFloat(amount)
          }
        });
        
        // Create journal entry for new starting balance (skip for CREDIT as it's not needed)
        if (type === 'DEBIT') {
          const transactionType = 'VENDOR_DEBIT';
          await createJournalEntryForTransaction(
            prisma,
            transactionType,
            parseFloat(amount),
            description,
            reference,
            undefined,
            transactionDate,
            session.organizationId
          );
        }
      }
    }

    // Create journal entry for vendor transaction (skip for starting balance as it's handled above)
    if (!isStartingBalance) {
      const transactionType = type === 'CREDIT' ? 'VENDOR_CREDIT' : 'VENDOR_DEBIT';
      const transactionDate = date ? parseDateInputAsLocalDate(date) : undefined;
      await createJournalEntryForTransaction(
        prisma,
        transactionType,
        parseFloat(amount),
        description,
        reference,
        undefined,
        transactionDate,
        session.organizationId
      );
    }

    return NextResponse.json({
      success: true,
      message: "Transaction added successfully",
      previousBalance: result.previousBalance,
      newBalance: result.newBalance
    });

  } catch (error) {
    console.error("Error adding vendor transaction:", error);
    return NextResponse.json(
      { error: "Failed to add transaction" },
      { status: 500 }
    );
  }
}
