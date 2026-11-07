import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  addCustomerTransaction,
  addVendorTransaction,
  createJournalEntryForTransaction,
  generateVendorInvoiceNumber,
  updateVendorJournalEntry,
} from "@/lib/server/ledger";
import { Country } from "country-state-city";
import { resolveCreditPaymentVoucherDate } from "@/lib/accounts/resolveCreditPaymentVoucherDate";
import { debitVoucherDateFromInvoice } from "@/lib/accounts/invoiceDebitVoucherDate";
import {
  inferAdjustmentType,
  isCustomerCreditNoteReference,
  normalizeNoteLineDescription,
  parseDateInputAsLocalDate,
} from "@/lib/noteFormats";
import { requirePermission } from "@/lib/auth/requirePermission";
import { orgWhere } from "@/lib/tenant/prismaScope";
import { creditNoteOrgFilter } from "@/lib/tenant/findOrgCreditNote";
import { parseListPaging } from "@/lib/money";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = parseInt(id);
    
    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: "Invalid customer ID" },
        { status: 400 }
      );
    }

    const auth = await requirePermission(req, "view_revenue");
    if (auth.error) return auth.error;
    const { session } = auth;

    const customerExists = await prisma.customers.findFirst({
      where: orgWhere(session, { id: customerId }),
    });
    if (!customerExists) {
      return NextResponse.json(
        { error: "Customer not found" },
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
      customerId: customerId
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

    // Get customer info
    const customer = await prisma.customers.findFirst({
      where: orgWhere(session, { id: customerId }),
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

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Self-heal: clean up any Vendor invoices (`profile: "Vendor"`) that were mistakenly
    // assigned `customerId` or given a `CustomerTransaction` DEBIT on this customer,
    // and deduplicate any duplicate invoice DEBIT rows on this customer.
    try {
      const allCustomerDebitTxs = await prisma.customerTransaction.findMany({
        where: orgWhere(session, {
          customerId,
          type: "DEBIT",
        }),
        orderBy: { id: "asc" },
        select: { id: true, invoice: true, reference: true, amount: true, description: true },
      });

      const candidateInvNos = Array.from(
        new Set(
          allCustomerDebitTxs
            .filter(
              (t) =>
                !isCustomerCreditNoteReference(t.reference) &&
                !isCustomerCreditNoteReference(t.invoice) &&
                !/^(Adjustment|Credit Note|Debit Note)\s*:/i.test(t.description || "")
            )
            .flatMap((t) => [t.invoice, t.reference])
            .filter((v): v is string => !!v && !v.startsWith("STARTING-BALANCE"))
        )
      );

      const [hijackedVendorInvoices, referencedVendorInvoices] = await Promise.all([
        prisma.invoice.findMany({
          where: orgWhere(session, {
            customerId,
            profile: "Vendor",
          }),
          include: { shipment: true },
        }),
        candidateInvNos.length > 0
          ? prisma.invoice.findMany({
              where: orgWhere(session, {
                invoiceNumber: { in: candidateInvNos },
                profile: "Vendor",
              }),
              include: { shipment: true },
            })
          : Promise.resolve([]),
      ]);

      const corruptedVendorInvsMap = new Map<number, (typeof hijackedVendorInvoices)[number]>();
      for (const inv of [...hijackedVendorInvoices, ...referencedVendorInvoices]) {
        corruptedVendorInvsMap.set(inv.id, inv);
      }

      if (corruptedVendorInvsMap.size > 0) {
        const vendorInvNumbers: string[] = [];
        for (const vInv of corruptedVendorInvsMap.values()) {
          vendorInvNumbers.push(vInv.invoiceNumber);

          // Resolve vendorId from shipment.vendor if missing
          let resolvedVendorId = vInv.vendorId;
          if (!resolvedVendorId && vInv.shipment?.vendor) {
            const matchedVendor = await prisma.vendors.findFirst({
              where: orgWhere(session, {
                CompanyName: { equals: String(vInv.shipment.vendor).trim() },
              }),
              select: { id: true },
            });
            if (matchedVendor) resolvedVendorId = matchedVendor.id;
          }

          // Check if totalAmount was overwritten with customer totalCost during a buggy shipment edit
          let correctedVendorAmount = Number(vInv.totalAmount) || 0;
          if (vInv.shipment) {
            const ship = vInv.shipment;
            const shipTotalCost = Number(ship.totalCost) || 0;
            let shipVendorCost = 0;
            if (ship.manualRate && Number(ship.cos) > 0) {
              shipVendorCost = Math.round(Number(ship.cos));
            } else if (ship.calculatedValues) {
              try {
                const calc =
                  typeof ship.calculatedValues === "string"
                    ? JSON.parse(ship.calculatedValues)
                    : (ship.calculatedValues as any);
                if (calc?.vendorPrice && Number(calc.vendorPrice) > 0) {
                  shipVendorCost = Math.round(Number(calc.vendorPrice));
                }
              } catch {
                // ignore
              }
            }
            if (
              shipVendorCost === 0 &&
              !ship.manualRate &&
              Number(ship.price) > 0 &&
              Number(ship.price) < shipTotalCost
            ) {
              shipVendorCost = Math.round(Number(ship.price) - (Number(ship.fixedCharge) || 0));
            }
            if (
              shipVendorCost > 0 &&
              Math.abs(correctedVendorAmount - shipTotalCost) < 0.01 &&
              Math.abs(shipVendorCost - shipTotalCost) > 0.01
            ) {
              correctedVendorAmount = shipVendorCost;
            }
          }

          await prisma.invoice.update({
            where: { id: vInv.id },
            data: {
              customerId: null,
              ...(resolvedVendorId ? { vendorId: resolvedVendorId } : {}),
              totalAmount: correctedVendorAmount,
            },
          });

          // Ensure vendor DEBIT transaction exists if vendorId is resolved
          if (resolvedVendorId && correctedVendorAmount > 0) {
            const existingVendorTx = await prisma.vendorTransaction.findFirst({
              where: orgWhere(session, {
                vendorId: resolvedVendorId,
                type: "DEBIT",
                OR: [
                  { reference: vInv.invoiceNumber },
                  { invoice: vInv.invoiceNumber },
                ],
              }),
            });
            if (!existingVendorTx) {
              const tracking = vInv.shipment?.trackingId || vInv.trackingNumber || "N/A";
              const country = vInv.shipment?.destination || vInv.destination || "N/A";
              const pkg = vInv.shipment?.packaging || "Wpx";
              const wt = Number(vInv.shipment?.totalWeight || vInv.shipment?.weight || vInv.weight) || 0;
              const desc = `Tracking: ${tracking} | Country: ${country} | Type: ${pkg} | Weight: ${wt}Kg`;
              await addVendorTransaction(
                prisma,
                resolvedVendorId,
                "DEBIT",
                correctedVendorAmount,
                desc,
                vInv.invoiceNumber,
                vInv.invoiceNumber,
                vInv.shipment?.shipmentDate || vInv.invoiceDate || vInv.createdAt,
                session.organizationId
              );
            }
          }

          // Fix journal entry for this vendor invoice so it is VENDOR_DEBIT rather than CUSTOMER_DEBIT
          const tracking = vInv.shipment?.trackingId || vInv.trackingNumber || vInv.invoiceNumber;
          await updateVendorJournalEntry(
            prisma,
            resolvedVendorId ?? 0,
            Number(vInv.totalAmount) || 0,
            correctedVendorAmount,
            vInv.invoiceNumber,
            `Vendor invoice for shipment ${tracking}`,
            session.organizationId,
            vInv.shipment?.shipmentDate || vInv.invoiceDate || undefined
          );
        }

        if (vendorInvNumbers.length > 0) {
          await prisma.customerTransaction.deleteMany({
            where: orgWhere(session, {
              customerId,
              type: "DEBIT",
              reference: { in: vendorInvNumbers },
            }),
          });
        }
      }

      // Deduplicate any duplicate DEBIT rows for the exact same customer invoice number
      // while NEVER treating customer adjustments (#CR / #DR) as duplicate invoice debits
      const remainingCustomerDebitTxs = await prisma.customerTransaction.findMany({
        where: orgWhere(session, {
          customerId,
          type: "DEBIT",
        }),
        orderBy: { id: "asc" },
        select: { id: true, invoice: true, reference: true, description: true },
      });
      const seenInvoiceDebits = new Set<string>();
      const seenAdjustmentRefs = new Set<string>();
      const duplicateDebitIds: number[] = [];
      for (const txRow of remainingCustomerDebitTxs) {
        if (
          isCustomerCreditNoteReference(txRow.reference) ||
          isCustomerCreditNoteReference(txRow.invoice) ||
          /^(Adjustment|Credit Note|Debit Note)\s*:/i.test(txRow.description || "")
        ) {
          const adjRef = txRow.reference || txRow.invoice;
          if (adjRef) {
            if (seenAdjustmentRefs.has(adjRef)) {
              duplicateDebitIds.push(txRow.id);
            } else {
              seenAdjustmentRefs.add(adjRef);
            }
          }
          continue;
        }
        const key = txRow.invoice || txRow.reference;
        if (!key || key.startsWith("STARTING-BALANCE")) {
          continue;
        }
        if (seenInvoiceDebits.has(key)) {
          duplicateDebitIds.push(txRow.id);
        } else {
          seenInvoiceDebits.add(key);
        }
      }
      if (duplicateDebitIds.length > 0) {
        await prisma.customerTransaction.deleteMany({
          where: { id: { in: duplicateDebitIds } },
        });
      }

      // Clean up orphan customer transactions left behind by deleted shipments:
      // (a) Fake REFUND- rows created for deleted shipments
      // (b) DEBIT rows where neither invoice nor shipment exists in DB
      const allCustomerTxsForOrphanCheck = await prisma.customerTransaction.findMany({
        where: orgWhere(session, { customerId }),
        select: { id: true, invoice: true, reference: true, type: true, description: true },
      });

      const candInvNums = Array.from(
        new Set(
          allCustomerTxsForOrphanCheck
            .map((t) =>
              t.reference?.startsWith("REFUND-")
                ? t.reference.replace(/^REFUND-/, "")
                : t.invoice || t.reference
            )
            .filter(
              (n): n is string =>
                typeof n === "string" &&
                n.trim().length > 0 &&
                !n.startsWith("STARTING-BALANCE") &&
                !isCustomerCreditNoteReference(n)
            )
        )
      );
      const existingInvoices = candInvNums.length
        ? await prisma.invoice.findMany({
            where: orgWhere(session, {
              customerId,
              invoiceNumber: { in: candInvNums },
            }),
            select: { invoiceNumber: true },
          })
        : [];
      const existingInvoiceSet = new Set(
        existingInvoices.map((i) => i.invoiceNumber)
      );

      const trackingIdsToCheck: string[] = [];
      for (const t of allCustomerTxsForOrphanCheck) {
        const match = t.description?.match(/Tracking:\s*([^\s|]+)/i);
        if (match && match[1]) trackingIdsToCheck.push(match[1]);
      }
      const existingShipments = trackingIdsToCheck.length
        ? await prisma.shipment.findMany({
            where: orgWhere(session, {
              trackingId: { in: Array.from(new Set(trackingIdsToCheck)) },
            }),
            select: { trackingId: true },
          })
        : [];
      const existingShipmentSet = new Set(
        existingShipments.map((s) => s.trackingId).filter(Boolean)
      );

      const orphanCustomerTxIds: number[] = [];
      for (const t of allCustomerTxsForOrphanCheck) {
        if (
          t.reference?.startsWith("STARTING-BALANCE") ||
          isCustomerCreditNoteReference(t.reference) ||
          isCustomerCreditNoteReference(t.invoice) ||
          /^(Adjustment|Credit Note|Debit Note)\s*:/i.test(t.description || "")
        ) {
          continue;
        }

        if (
          t.reference?.startsWith("REFUND-") ||
          /Refund for deleted shipment/i.test(t.description || "")
        ) {
          const invNum = t.reference
            ? t.reference.replace(/^REFUND-/, "")
            : t.invoice;
          if (!invNum || !existingInvoiceSet.has(invNum)) {
            orphanCustomerTxIds.push(t.id);
          }
          continue;
        }

        if (t.type === "DEBIT") {
          const invNum = t.invoice || t.reference;
          let exists = false;
          if (invNum && existingInvoiceSet.has(invNum)) exists = true;
          if (!exists) {
            const match = t.description?.match(/Tracking:\s*([^\s|]+)/i);
            if (match && match[1] && existingShipmentSet.has(match[1]))
              exists = true;
          }
          if (!exists) {
            orphanCustomerTxIds.push(t.id);
          }
        }
      }

      if (orphanCustomerTxIds.length > 0) {
        await prisma.customerTransaction.deleteMany({
          where: { id: { in: orphanCustomerTxIds } },
        });
      }

      if (duplicateDebitIds.length > 0 || orphanCustomerTxIds.length > 0) {
        const remainingTxs = await prisma.customerTransaction.findMany({
          where: orgWhere(session, { customerId }),
          orderBy: { createdAt: "asc" },
        });
        const startingTx = remainingTxs.find(
          (t) => t.reference && t.reference.startsWith("STARTING-BALANCE")
        );
        let newBal = 0;
        if (startingTx) {
          newBal =
            startingTx.type === "DEBIT"
              ? -Number(startingTx.amount || 0)
              : Number(startingTx.amount || 0);
        }
        for (const t of remainingTxs) {
          if (t.reference && t.reference.startsWith("STARTING-BALANCE")) continue;
          const amt = Number(t.amount || 0);
          if (t.type === "DEBIT") newBal -= amt;
          else if (t.type === "CREDIT") newBal += amt;
        }
        await prisma.customers.update({
          where: { id: customerId },
          data: { currentBalance: newBal },
        });
        customer.currentBalance = newBal;
      }
    } catch (healErr) {
      console.error("Error in customer transaction self-heal:", healErr);
    }

    // Ensure all customer invoices have corresponding DEBIT transactions, and sync amounts
    const customerInvoices = await prisma.invoice.findMany({
      where: orgWhere(session, {
        customerId,
        profile: "Customer",
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
            recipientName: true,
            totalCost: true,
            price: true,
          },
        },
      },
    });

    if (customerInvoices.length > 0) {
      const invNumbers = customerInvoices.map((inv) => inv.invoiceNumber);
      const existingDebitTxs = await prisma.customerTransaction.findMany({
        where: orgWhere(session, {
          customerId,
          type: "DEBIT",
          OR: [
            { reference: { in: invNumbers } },
            { invoice: { in: invNumbers } },
          ],
        }),
        select: { id: true, reference: true, invoice: true, amount: true, description: true },
      });

      const existingDebitMap = new Map<string, { id: number; amount: number }>();
      const existingSet = new Set<string>();
      for (const t of existingDebitTxs) {
        if (
          isCustomerCreditNoteReference(t.reference) ||
          isCustomerCreditNoteReference(t.invoice) ||
          /^(Adjustment|Credit Note|Debit Note)\s*:/i.test(t.description || "")
        ) {
          continue;
        }
        const key = t.invoice || t.reference;
        if (key && !key.startsWith("STARTING-BALANCE")) {
          existingDebitMap.set(key, { id: t.id, amount: Number(t.amount || 0) });
          existingSet.add(key);
        }
        if (t.reference) existingSet.add(t.reference);
        if (t.invoice) existingSet.add(t.invoice);
      }

      let customerTransactionsModified = false;
      for (const inv of customerInvoices) {
        let invTotal = Number(inv.totalAmount) || 0;
        if (invTotal <= 0 && inv.shipment) {
          const shipCost = Number((inv.shipment as any).totalCost || (inv.shipment as any).price || 0);
          if (shipCost > 0) {
            await prisma.invoice.update({
              where: { id: inv.id },
              data: { totalAmount: shipCost },
            });
            inv.totalAmount = shipCost;
            invTotal = shipCost;
          }
        }

        if (invTotal > 0) {
          const existing = existingDebitMap.get(inv.invoiceNumber);
          if (existing && Math.abs(existing.amount - invTotal) > 0.01) {
            await prisma.customerTransaction.update({
              where: { id: existing.id },
              data: { amount: invTotal },
            });
            customerTransactionsModified = true;
          }
        }
      }

      const missingInvoices = customerInvoices.filter(
        (inv) => !existingSet.has(inv.invoiceNumber) && Number(inv.totalAmount) > 0
      );

      if (missingInvoices.length > 0) {
        customerTransactionsModified = true;
        for (const inv of missingInvoices) {
          const tracking = inv.shipment?.trackingId || inv.trackingNumber || "N/A";
          const country = inv.shipment?.destination || inv.destination || "N/A";
          const pkg = inv.shipment?.packaging || "Wpx";
          const wt = inv.shipment?.totalWeight || inv.shipment?.weight || 0;
          const consigneePrefix = inv.shipment?.recipientName
            ? `Consignee: ${inv.shipment.recipientName} | `
            : "";
          const desc = `${consigneePrefix}Tracking: ${tracking} | Country: ${country} | Type: ${pkg} | Weight: ${wt}Kg`;
          const txDate = inv.shipment?.shipmentDate || inv.invoiceDate || inv.createdAt;

          await prisma.customerTransaction.create({
            data: {
              organizationId: session.organizationId,
              customerId,
              type: "DEBIT",
              amount: Number(inv.totalAmount),
              description: desc,
              reference: inv.invoiceNumber,
              invoice: inv.invoiceNumber,
              previousBalance: 0,
              newBalance: -Number(inv.totalAmount),
              createdAt: txDate,
            },
          });
        }
      }

      if (customerTransactionsModified) {
        const remainingTxs = await prisma.customerTransaction.findMany({
          where: orgWhere(session, { customerId }),
          orderBy: { createdAt: "asc" },
        });
        const startingTx = remainingTxs.find(
          (t) => t.reference && t.reference.startsWith("STARTING-BALANCE")
        );
        let newBal = 0;
        if (startingTx) {
          newBal =
            startingTx.type === "DEBIT"
              ? -Number(startingTx.amount || 0)
              : Number(startingTx.amount || 0);
        }
        for (const t of remainingTxs) {
          if (t.reference && t.reference.startsWith("STARTING-BALANCE")) continue;
          const amt = Number(t.amount || 0);
          if (t.type === "DEBIT") newBal -= amt;
          else if (t.type === "CREDIT") newBal += amt;
        }
        await prisma.customers.update({
          where: { id: customerId },
          data: { currentBalance: newBal },
        });
        customer.currentBalance = newBal;
      }
    }

    // Ensure all customer adjustments (CreditNote: #CR / #DR) have corresponding CustomerTransaction rows
    try {
      const customerCreditNotes = await prisma.creditNote.findMany({
        where: { ...creditNoteOrgFilter(session), customerId },
        include: {
          invoice: { select: { invoiceNumber: true } },
        },
      });

      if (customerCreditNotes.length > 0) {
        const cnNumbers = customerCreditNotes
          .map((cn) => cn.creditNoteNumber)
          .filter(Boolean);
        const existingCnTxs = await prisma.customerTransaction.findMany({
          where: orgWhere(session, {
            customerId,
            reference: { in: cnNumbers },
          }),
          select: { id: true, reference: true, type: true, amount: true, invoice: true },
        });

        const existingCnTxByRef = new Map(
          existingCnTxs.map((t) => [t.reference!, t])
        );

        for (const cn of customerCreditNotes) {
          const cnAmt = Math.abs(Number(cn.amount) || 0);
          if (cnAmt <= 0 || !cn.creditNoteNumber) continue;

          const existingTx = existingCnTxByRef.get(cn.creditNoteNumber);
          const inferredType = inferAdjustmentType({
            reference: cn.creditNoteNumber,
            description: cn.description,
            transactionType:
              existingTx?.type === "DEBIT" || existingTx?.type === "CREDIT"
                ? existingTx.type
                : null,
            fallback: "CREDIT",
          });
          const expectedInv = cn.invoice?.invoiceNumber || null;
          const expectedDesc =
            cn.description ||
            normalizeNoteLineDescription(
              inferredType === "DEBIT" ? "debit" : "credit",
              "",
              cn.creditNoteNumber
            );

          if (!existingTx) {
            await prisma.customerTransaction.create({
              data: {
                organizationId: session.organizationId,
                customerId,
                type: inferredType,
                amount: cnAmt,
                description: expectedDesc,
                reference: cn.creditNoteNumber,
                invoice: expectedInv,
                previousBalance: 0,
                newBalance: inferredType === "CREDIT" ? cnAmt : -cnAmt,
                createdAt: cn.date || cn.createdAt,
              },
            });
          } else if (
            existingTx.type !== inferredType ||
            Math.abs(Number(existingTx.amount) - cnAmt) > 0.01 ||
            (!existingTx.invoice && expectedInv)
          ) {
            await prisma.customerTransaction.update({
              where: { id: existingTx.id },
              data: {
                type: inferredType,
                amount: cnAmt,
                ...(expectedInv && !existingTx.invoice ? { invoice: expectedInv } : {}),
              },
            });
          }
        }
      }
    } catch (cnHealErr) {
      console.error("Error healing customer credit/debit notes:", cnHealErr);
    }

    // List path: use existing balances; always filter and sort by voucher date (not createdAt)
    if (!recalcBalances) {
      const whereForList: any = { ...whereClause };

      const listTransactions = await prisma.customerTransaction.findMany({
        where: whereForList,
      });

      if (listTransactions.length === 0) {
        return NextResponse.json({
          customer: {
            id: customer.id,
            CompanyName: customer.CompanyName,
            PersonName: customer.PersonName,
            currentBalance: customer.currentBalance,
            creditLimit: customer.creditLimit,
            Address: customer.Address,
            City: customer.City,
            Country: customer.Country,
          },
          metrics: {
            grossProfit: 0,
            totalShipments: 0,
            avgOrderValue: 0,
            totalSpent: 0,
          },
          transactions: [],
          total: 0,
          page,
          limit: isAllLimit || !limit ? 0 : limit,
          totalPages: 1,
        });
      }

      const creditNoteRefsList = listTransactions
        .filter((t) => isCustomerCreditNoteReference(t.reference))
        .map((t) => t.reference!)
        .filter((ref, index, self) => self.indexOf(ref) === index);

      const creditNotesMapList = new Map<string, Date>();
      const creditNoteInvoiceByRefList = new Map<string, string>();
      if (creditNoteRefsList.length > 0) {
        const creditNotesList = await prisma.creditNote.findMany({
          where: { ...creditNoteOrgFilter(session), creditNoteNumber: { in: creditNoteRefsList } },
          select: {
            creditNoteNumber: true,
            date: true,
            invoice: { select: { invoiceNumber: true } },
          },
        });
        creditNotesList.forEach((cn) => {
          if (cn.date) creditNotesMapList.set(cn.creditNoteNumber, cn.date);
          const inv = cn.invoice?.invoiceNumber;
          if (inv) creditNoteInvoiceByRefList.set(cn.creditNoteNumber, inv);
        });
      }

      const invoiceNumbersList = listTransactions
        .filter((t) => t.invoice)
        .map((t) => t.invoice!)
        .filter((inv, index, self) => self.indexOf(inv) === index);

      const invoicesMapList = new Map<
        string,
        { shipmentDate?: Date; invoiceDate?: Date }
      >();
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
            fromCustomerId: customerId,
            transactionType: "INCOME",
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
          let voucherDate = transaction.createdAt;

          if (transaction.reference) {
            const creditNoteDate = creditNotesMapList.get(transaction.reference);
            if (creditNoteDate) {
              voucherDate = creditNoteDate;
            }
          }

          const fromCreditNote =
            !!transaction.reference &&
            creditNotesMapList.has(transaction.reference);

          if (transaction.type === "CREDIT") {
            if (!fromCreditNote) {
              const paymentDate = resolveCreditPaymentVoucherDate(
                {
                  amount: transaction.amount,
                  invoice: transaction.invoice,
                  reference: transaction.reference,
                  createdAt: transaction.createdAt,
                },
                paymentsListForVoucher
              );
              if (paymentDate) voucherDate = paymentDate;
            }
          } else if (transaction.invoice && !fromCreditNote) {
            // Invoice DEBIT bills use shipment/invoice date; credit/debit notes keep note date
            const invoiceData = invoicesMapList.get(transaction.invoice);
            if (transaction.type === "DEBIT") {
              const vd = debitVoucherDateFromInvoice(invoiceData);
              if (vd) voucherDate = vd;
            }
          }

          return {
            ...transaction,
            voucherDate,
            invoice:
              transaction.invoice ??
              (transaction.reference
                ? creditNoteInvoiceByRefList.get(transaction.reference) ?? null
                : null),
          };
        }
      );

      // Sort all customer transactions chronologically (oldest -> newest) to compute exact running balance
      const chronologicalAll = [...transactionsWithVoucherDatesList].sort((a, b) => {
        const dateDiff = a.voucherDate.getTime() - b.voucherDate.getTime();
        if (dateDiff !== 0) return dateDiff;
        if (a.type === "DEBIT" && b.type === "CREDIT") return -1;
        if (a.type === "CREDIT" && b.type === "DEBIT") return 1;
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
          ? -Number(startingBalanceTransaction.amount || 0)
          : Number(startingBalanceTransaction.amount || 0);
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
        const next = t.type === 'CREDIT' ? prev + Number(t.amount || 0) : prev - Number(t.amount || 0);
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
          customer: {
            id: customer.id,
            CompanyName: customer.CompanyName,
            PersonName: customer.PersonName,
            currentBalance: customer.currentBalance,
            creditLimit: customer.creditLimit,
            Address: customer.Address,
            City: customer.City,
            Country: customer.Country,
          },
          metrics: {
            grossProfit: 0,
            totalShipments: 0,
            avgOrderValue: 0,
            totalSpent: 0,
          },
          transactions: [],
          total: 0,
          page,
          limit: isAllLimit || !limit ? 0 : limit,
          totalPages: 1,
        });
      }

      const total = filteredTransactionsList.length;

      // Aggregate shipment/invoice metrics for the currently filtered period.
      // We consider "shipments" as DEBIT transactions where reference == invoice.
      let metrics = {
        totalShipments: 0,
        totalSpent: 0,
        avgOrderValue: 0,
        grossProfit: 0,
      };
      try {
        const shipmentInvoiceNumbers = Array.from(
          new Set(
            filteredTransactionsList
              .filter(
                (t: any) =>
                  t.invoice &&
                  t.type === "DEBIT" &&
                  t.reference &&
                  t.reference === t.invoice
              )
              .map((t: any) => t.invoice as string)
          )
        );

        if (shipmentInvoiceNumbers.length > 0) {
          const invoicesForMetricsBase = await prisma.invoice.findMany({
            where: {
              ...orgWhere(session),
              invoiceNumber: { in: shipmentInvoiceNumbers },
              profile: "Customer",
              status: { not: "Cancelled" },
            },
            select: {
              invoiceNumber: true,
              totalAmount: true,
              shipmentId: true,
            },
          });

          const vendorInvoiceNumbersForMetrics = invoicesForMetricsBase
            .map((inv) => generateVendorInvoiceNumber(inv.invoiceNumber))
            .filter((invNo, idx, arr) => arr.indexOf(invNo) === idx);
          const shipmentIdsForMetrics = invoicesForMetricsBase
            .map((inv) => inv.shipmentId)
            .filter((sid): sid is number => sid != null);

          const vendorInvoicesForMetrics = await prisma.invoice.findMany({
            where: {
              ...orgWhere(session),
              profile: "Vendor",
              status: { not: "Cancelled" },
              OR: [
                { invoiceNumber: { in: vendorInvoiceNumbersForMetrics } },
                ...(shipmentIdsForMetrics.length > 0
                  ? [{ shipmentId: { in: shipmentIdsForMetrics } }]
                  : []),
              ],
            },
            select: {
              invoiceNumber: true,
              totalAmount: true,
              shipmentId: true,
            },
          });

          const vendorAmountByInvoiceNumber = new Map(
            vendorInvoicesForMetrics.map((inv) => [
              inv.invoiceNumber,
              Number(inv.totalAmount) || 0,
            ])
          );
          const vendorAmountByShipmentId = new Map<number, number>();
          for (const inv of vendorInvoicesForMetrics) {
            if (inv.shipmentId != null) {
              vendorAmountByShipmentId.set(inv.shipmentId, Number(inv.totalAmount) || 0);
            }
          }

          const invoicesForMetrics = invoicesForMetricsBase.map((inv) => {
            const vendorInvoiceNumber = generateVendorInvoiceNumber(
              inv.invoiceNumber
            );
            const vendorInvoiceAmount =
              (inv.shipmentId != null ? vendorAmountByShipmentId.get(inv.shipmentId) : undefined) ??
              vendorAmountByInvoiceNumber.get(vendorInvoiceNumber) ??
              0;
            return {
              ...inv,
              vendorInvoiceNumber,
              vendorInvoiceAmount,
            };
          });

          const totalShipments = invoicesForMetrics.length;
          const totalSpent = invoicesForMetrics.reduce(
            (sum, inv) => sum + Number(inv.totalAmount || 0),
            0
          );
          const grossProfit = invoicesForMetrics.reduce(
            (sum, inv) =>
              sum + (Number(inv.totalAmount || 0) - Number(inv.vendorInvoiceAmount || 0)),
            0
          );

          metrics = {
            totalShipments,
            totalSpent,
            avgOrderValue:
              totalShipments > 0 ? totalSpent / totalShipments : 0,
            grossProfit,
          };
        }
      } catch (e) {
        console.error("Failed to compute customer metrics:", e);
      }

      const transactionIdsForSort = filteredTransactionsList.map((t) => t.id);
      const fullTransactionsForSortingList =
        await prisma.customerTransaction.findMany({
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

      const pageRows = await prisma.customerTransaction.findMany({
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

      const paginatedCreditNoteRefs = orderedTransactions
        .filter((t) => isCustomerCreditNoteReference(t.reference))
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

      // Batch fetch credit notes for paginated transactions
      const paginatedCreditNotesMap = new Map<string, Date>();
      const paginatedCreditNoteInvoiceMap = new Map<string, string>();
      if (paginatedCreditNoteRefs.length > 0) {
        const paginatedCreditNotes = await prisma.creditNote.findMany({
          where: { ...creditNoteOrgFilter(session), creditNoteNumber: { in: paginatedCreditNoteRefs } },
          select: {
            creditNoteNumber: true,
            date: true,
            invoice: { select: { invoiceNumber: true } },
          },
        });
        paginatedCreditNotes.forEach((cn) => {
          if (cn.date) paginatedCreditNotesMap.set(cn.creditNoteNumber, cn.date);
          const inv = cn.invoice?.invoiceNumber;
          if (inv) paginatedCreditNoteInvoiceMap.set(cn.creditNoteNumber, inv);
        });

        const missingCnInvoices = [...paginatedCreditNoteInvoiceMap.values()].filter(
          (inv) => !paginatedInvoicesMap.has(inv)
        );
        if (missingCnInvoices.length > 0) {
          const extraInvoices = await prisma.invoice.findMany({
            where: { ...orgWhere(session), invoiceNumber: { in: missingCnInvoices } },
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
            fromCustomerId: customerId,
            transactionType: "INCOME",
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

      // Map transactions with shipment info using batched data
      const transactionsWithShipmentInfo = orderedTransactions.map(
        (transaction) => {
          let shipmentInfo = null;
          let shipmentDate: string | undefined = undefined;
          let paymentDate: string | undefined = undefined;
          let creditNoteDate: string | undefined = undefined;
          let consigneeName: string | undefined = undefined;
          let trackingId: string | undefined = undefined;

          if (transaction.reference) {
            const cnDate = paginatedCreditNotesMap.get(transaction.reference);
            if (cnDate) {
              creditNoteDate = cnDate.toISOString();
            }
          }

          const fromCreditNote =
            !!transaction.reference &&
            paginatedCreditNotesMap.has(transaction.reference);

          if (transaction.type === "CREDIT" && !fromCreditNote) {
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
            transaction.invoice ??
            (transaction.reference
              ? paginatedCreditNoteInvoiceMap.get(transaction.reference) ?? null
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

          const computedBal = balanceByTxId.get(transaction.id);
          return {
            ...transaction,
            previousBalance: computedBal !== undefined ? computedBal.previousBalance : transaction.previousBalance,
            newBalance: computedBal !== undefined ? computedBal.newBalance : transaction.newBalance,
            invoice: resolvedInvoice,
            shipmentInfo,
            shipmentDate,
            paymentDate,
            creditNoteDate,
            consigneeName,
            trackingId,
          };
        }
      );

      // Keep customer.currentBalance in sync with the computed ledger balance when viewing all transactions
      if (!search && Math.abs((Number(customer.currentBalance) || 0) - runningBal) > 0.01) {
        await prisma.customers.update({
          where: { id: customerId },
          data: { currentBalance: runningBal },
        });
      }

      return NextResponse.json({
        customer: {
          id: customer.id,
          CompanyName: customer.CompanyName,
          PersonName: customer.PersonName,
          currentBalance: runningBal,
          creditLimit: Number(customer.creditLimit || 0),
          Address: customer.Address,
          City: customer.City,
          Country: customer.Country,
        },
        metrics,
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
    const allTransactions = await prisma.customerTransaction.findMany({
      where: orgWhere(session, { customerId: customerId }),
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
    const creditNoteRefs = allTransactions
      .filter((t) => isCustomerCreditNoteReference(t.reference))
      .map(t => t.reference!)
      .filter((ref, index, self) => self.indexOf(ref) === index); // unique refs
    
    const creditNotesMap = new Map<string, Date>();
    const creditNoteInvoiceByRefHeavy = new Map<string, string>();
    if (creditNoteRefs.length > 0) {
      const creditNotes = await prisma.creditNote.findMany({
        where: { ...creditNoteOrgFilter(session), creditNoteNumber: { in: creditNoteRefs } },
        select: {
          creditNoteNumber: true,
          date: true,
          invoice: { select: { invoiceNumber: true } },
        },
      });
      creditNotes.forEach((cn) => {
        if (cn.date) creditNotesMap.set(cn.creditNoteNumber, cn.date);
        const inv = cn.invoice?.invoiceNumber;
        if (inv) creditNoteInvoiceByRefHeavy.set(cn.creditNoteNumber, inv);
      });
    }

    // Batch fetch invoices with shipments
    const invoiceNumbers = allTransactions
      .filter(t => t.invoice)
      .map(t => t.invoice!)
      .filter((inv, index, self) => self.indexOf(inv) === index); // unique invoices
    
    const invoicesMap = new Map<
      string,
      { shipmentDate?: Date; invoiceDate?: Date }
    >();
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
          fromCustomerId: customerId,
          transactionType: "INCOME",
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

    // Map transactions with voucher dates using batched data
    const transactionsWithVoucherDates = allTransactions.map((transaction) => {
      let voucherDate = transaction.createdAt;

      if (transaction.reference) {
        const creditNoteDate = creditNotesMap.get(transaction.reference);
        if (creditNoteDate) {
          voucherDate = creditNoteDate;
        }
      }

      const fromCreditNote =
        !!transaction.reference && creditNotesMap.has(transaction.reference);

      if (transaction.type === "CREDIT") {
        if (!fromCreditNote) {
          const paymentDate = resolveCreditPaymentVoucherDate(
            {
              amount: transaction.amount,
              invoice: transaction.invoice,
              reference: transaction.reference,
              createdAt: transaction.createdAt,
            },
            paymentsForVoucherHeavy
          );
          if (paymentDate) voucherDate = paymentDate;
        }
      } else if (transaction.invoice && !fromCreditNote) {
        // Invoice DEBIT bills use shipment/invoice date; credit/debit notes keep note date
        const invoiceData = invoicesMap.get(transaction.invoice);
        if (transaction.type === "DEBIT") {
          const vd = debitVoucherDateFromInvoice(invoiceData);
          if (vd) voucherDate = vd;
        }
      }

      return {
        ...transaction,
        voucherDate,
        invoice:
          transaction.invoice ??
          (transaction.reference
            ? creditNoteInvoiceByRefHeavy.get(transaction.reference) ?? null
            : null),
      };
    });

    // Sort by voucher date (not createdAt) for balance calculation
    // For the same date:
    // - CREDIT (payment) after DEBIT (shipment)
    // - Within the same type, order by invoice number ascending so that the
    //   highest invoice ends up last for that date (and therefore gets the
    //   final balance for that date, which the UI then shows at the top).
    transactionsWithVoucherDates.sort((a, b) => {
      const dateDiff = a.voucherDate.getTime() - b.voucherDate.getTime(); // oldest -> newest
      if (dateDiff !== 0) {
        return dateDiff;
      }
      // Same date, different types
      if (a.type === "DEBIT" && b.type === "CREDIT") return -1;
      if (a.type === "CREDIT" && b.type === "DEBIT") return 1;

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
    // For customers: CREDIT increases balance (they pay us), DEBIT decreases (they owe us)
    // Starting balance transaction sets the initial balance
    let runningBalance = 0;
    if (startingBalanceTransaction) {
      // The starting balance transaction itself represents the initial balance
      // If it's DEBIT, customer owes (negative balance), if CREDIT, we owe (positive balance)
      runningBalance = startingBalanceTransaction.type === 'DEBIT' 
        ? -Number(startingBalanceTransaction.amount || 0) 
        : Number(startingBalanceTransaction.amount || 0);
    }

    // Recalculate balances chronologically based on voucher date
    // Exclude starting balance transaction from the loop since it already sets the initial balance
    const transactionsToUpdate = transactionsWithVoucherDates
      .filter((transaction) => !transaction.reference || !transaction.reference.startsWith("STARTING-BALANCE"))
      .map((transaction) => {
        const previousBalance = Number(runningBalance) || 0;
        const txAmount = Number(transaction.amount || 0);
        // For customers: CREDIT increases balance (they pay us), DEBIT decreases (they owe us)
        const newBalance = transaction.type === 'CREDIT' 
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
        ? -Number(startingBalanceTransaction.amount || 0) 
        : Number(startingBalanceTransaction.amount || 0);
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
          prisma.customerTransaction.update({
            where: { id },
            data: { previousBalance, newBalance }
          })
        )
      );
    }

    // Update customer's currentBalance to match the final runningBalance after all transactions
    // Use runningBalance which already has the final calculated balance
    await prisma.customers.update({
      where: { id: customerId },
      data: { currentBalance: runningBalance }
    });
    // Update customer object for response
    customer.currentBalance = runningBalance;

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

    // Apply search filter if provided (already handled in whereClause, but we need to apply it to filtered transactions)
    // Get all transaction IDs that match the search criteria
    let matchingTransactionIds: number[] = [];
    if (search) {
      const searchWhereClause: any = orgWhere(session, {
        customerId: customerId
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
      
      const matchingTransactions = await prisma.customerTransaction.findMany({
        where: searchWhereClause,
        select: { id: true }
      });
      matchingTransactionIds = matchingTransactions.map(t => t.id);
      
      // Apply search filter to filtered transactions
      filteredTransactions = filteredTransactions.filter(t => matchingTransactionIds.includes(t.id));
    }

    // Get total count after date and search filtering
    const total = filteredTransactions.length;

    // Aggregate shipment/invoice metrics for the currently filtered period.
    let metrics = {
      totalShipments: 0,
      totalSpent: 0,
      avgOrderValue: 0,
      grossProfit: 0,
    };
    try {
      const shipmentInvoiceNumbers = Array.from(
        new Set(
          filteredTransactions
            .filter(
              (t: any) =>
                t.invoice &&
                t.type === "DEBIT" &&
                t.reference &&
                t.reference === t.invoice
            )
            .map((t: any) => t.invoice as string)
        )
      );

      if (shipmentInvoiceNumbers.length > 0) {
        const invoicesForMetricsBase = await prisma.invoice.findMany({
          where: {
            ...orgWhere(session),
            invoiceNumber: { in: shipmentInvoiceNumbers },
            profile: "Customer",
            status: { not: "Cancelled" },
          },
          select: {
            invoiceNumber: true,
            totalAmount: true,
            shipmentId: true,
          },
        });

        const vendorInvNos = invoicesForMetricsBase
          .map((inv) => generateVendorInvoiceNumber(inv.invoiceNumber))
          .filter((v, i, a) => a.indexOf(v) === i);
        const shipmentIdsForMetrics = invoicesForMetricsBase
          .map((inv) => inv.shipmentId)
          .filter((sid): sid is number => sid != null);

        const vendorInvs = await prisma.invoice.findMany({
          where: {
            ...orgWhere(session),
            profile: "Vendor",
            status: { not: "Cancelled" },
            OR: [
              { invoiceNumber: { in: vendorInvNos } },
              ...(shipmentIdsForMetrics.length > 0
                ? [{ shipmentId: { in: shipmentIdsForMetrics } }]
                : []),
            ],
          },
          select: { invoiceNumber: true, totalAmount: true, shipmentId: true },
        });

        const vendorAmtMap = new Map(
          vendorInvs.map((inv) => [inv.invoiceNumber, Number(inv.totalAmount) || 0])
        );
        const vendorAmtByShipmentId = new Map<number, number>();
        for (const inv of vendorInvs) {
          if (inv.shipmentId != null) {
            vendorAmtByShipmentId.set(inv.shipmentId, Number(inv.totalAmount) || 0);
          }
        }

        const invoicesForMetrics = invoicesForMetricsBase.map((inv) => {
          const vendorInvoiceNumber = generateVendorInvoiceNumber(inv.invoiceNumber);
          const vendorInvoiceAmount =
            (inv.shipmentId != null ? vendorAmtByShipmentId.get(inv.shipmentId) : undefined) ??
            vendorAmtMap.get(vendorInvoiceNumber) ??
            0;
          return { ...inv, vendorInvoiceNumber, vendorInvoiceAmount };
        });

        const totalShipments = invoicesForMetrics.length;
        const totalSpent = invoicesForMetrics.reduce(
          (sum, inv) => sum + Number(inv.totalAmount || 0),
          0
        );
        const grossProfit = invoicesForMetrics.reduce(
          (sum, inv) => sum + (Number(inv.totalAmount || 0) - Number(inv.vendorInvoiceAmount || 0)),
          0
        );

        metrics = {
          totalShipments,
          totalSpent,
          avgOrderValue:
            totalShipments > 0 ? totalSpent / totalShipments : 0,
          grossProfit,
        };
      }
    } catch (e) {
      console.error("Failed to compute customer metrics:", e);
    }

    // Fetch full transaction data for sorting
    const transactionIds = filteredTransactions.map(t => t.id);
    const fullTransactionsForSorting = await prisma.customerTransaction.findMany({
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
    const transactions = await prisma.customerTransaction.findMany({
      where: { id: { in: paginatedTransactionIds } },
      include: {
        customer: {
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
    
    const paginatedCreditNoteRefs = orderedTransactions
      .filter((t) => isCustomerCreditNoteReference(t.reference))
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
              recipientName: true,
            }
          }
        }
      });
      paginatedInvoices.forEach(inv => {
        paginatedInvoicesMap.set(inv.invoiceNumber, inv);
      });
    }
    
    // Batch fetch credit notes for paginated transactions
    const paginatedCreditNotesMap = new Map<string, Date>();
    const paginatedCreditNoteInvoiceMapRecalc = new Map<string, string>();
    if (paginatedCreditNoteRefs.length > 0) {
      const paginatedCreditNotes = await prisma.creditNote.findMany({
        where: { ...creditNoteOrgFilter(session), creditNoteNumber: { in: paginatedCreditNoteRefs } },
        select: {
          creditNoteNumber: true,
          date: true,
          invoice: { select: { invoiceNumber: true } },
        },
      });
      paginatedCreditNotes.forEach((cn) => {
        if (cn.date) paginatedCreditNotesMap.set(cn.creditNoteNumber, cn.date);
        const inv = cn.invoice?.invoiceNumber;
        if (inv) paginatedCreditNoteInvoiceMapRecalc.set(cn.creditNoteNumber, inv);
      });

      const missingCnInvoices = [
        ...paginatedCreditNoteInvoiceMapRecalc.values(),
      ].filter((inv) => !paginatedInvoicesMap.has(inv));
      if (missingCnInvoices.length > 0) {
        const extraInvoices = await prisma.invoice.findMany({
          where: { ...orgWhere(session), invoiceNumber: { in: missingCnInvoices } },
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
      .map((t) => t.invoice!);
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
          fromCustomerId: customerId,
          transactionType: "INCOME",
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
      let creditNoteDate: string | undefined = undefined;
      let consigneeName: string | undefined = undefined;
      let trackingId: string | undefined = undefined;

      if (transaction.reference) {
        const cnDate = paginatedCreditNotesMap.get(transaction.reference);
        if (cnDate) {
          creditNoteDate = cnDate.toISOString();
        }
      }

      const fromCreditNote =
        !!transaction.reference &&
        paginatedCreditNotesMap.has(transaction.reference);

      if (transaction.type === "CREDIT" && !fromCreditNote) {
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
        transaction.invoice ??
        (transaction.reference
          ? paginatedCreditNoteInvoiceMapRecalc.get(transaction.reference) ??
            null
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

      return {
        ...transaction,
        invoice: resolvedInvoice,
        shipmentInfo,
        shipmentDate,
        paymentDate,
        creditNoteDate,
        consigneeName,
        trackingId,
      };
    });

    return NextResponse.json({
      customer: {
        id: customer.id,
        CompanyName: customer.CompanyName,
        PersonName: customer.PersonName,
        currentBalance: Number(customer.currentBalance || 0),
        creditLimit: Number(customer.creditLimit || 0),
        Address: customer.Address,
        City: customer.City,
        Country: customer.Country,
      },
      transactions: transactionsWithShipmentInfo,
      metrics,
      total,
      page,
      limit: isAllLimit || !limit ? total : limit,
      totalPages:
        isAllLimit || !limit
          ? 1
          : Math.ceil(total / (limit || 1))
    });

  } catch (error) {
    console.error("Error fetching customer transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer transactions" },
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
    const customerId = parseInt(id);
    
    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: "Invalid customer ID" },
        { status: 400 }
      );
    }

    const auth = await requirePermission(req, "manage_billing");
    if (auth.error) return auth.error;
    const { session } = auth;

    const customerExists = await prisma.customers.findFirst({
      where: orgWhere(session, { id: customerId }),
    });
    if (!customerExists) {
      return NextResponse.json(
        { error: "Customer not found" },
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
      const existingStartingBalance = await prisma.customerTransaction.findFirst({
        where: orgWhere(session, {
          customerId: customerId,
          reference: { startsWith: "STARTING-BALANCE" }
        })
      });

      if (existingStartingBalance) {
        // Use provided date or default to earliest date for starting balance
        const transactionDate = date ? parseDateInputAsLocalDate(date) : new Date('1970-01-01');
        
        // Find and delete existing journal entries for this starting balance
        // Use the existing transaction's reference to find matching journal entries
        const targetRef = existingStartingBalance.reference || `STARTING-BALANCE-CUST-${customerId}`;
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
        await prisma.customerTransaction.update({
          where: { id: existingStartingBalance.id },
          data: {
            type: type,
            amount: parseFloat(amount),
            description: description,
            reference: reference,
            createdAt: transactionDate,
            previousBalance: 0,
            newBalance: type === 'DEBIT' ? -parseFloat(amount) : parseFloat(amount)
          }
        });
        
        // Create journal entry with the provided date (skip for CREDIT as it's not needed)
        if (type === 'DEBIT') {
          const transactionType = 'CUSTOMER_DEBIT';
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
        const allTransactions = await prisma.customerTransaction.findMany({
          where: orgWhere(session, { customerId: customerId })
        });

        // Recalculate balances (this will be done on next GET request)
        // For now, just return success
        return NextResponse.json({
          success: true,
          message: "Starting balance updated successfully",
          previousBalance: 0,
          newBalance: type === 'DEBIT' ? -parseFloat(amount) : parseFloat(amount)
        });
      }
    }

    const result = await addCustomerTransaction(
      prisma,
      customerId,
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
      const createdTransaction = await prisma.customerTransaction.findFirst({
        where: orgWhere(session, {
          customerId: customerId,
          reference: reference
        }),
        orderBy: { createdAt: 'desc' }
      });

      if (createdTransaction) {
        // Use provided date or default to earliest date for starting balance
        const transactionDate = date ? parseDateInputAsLocalDate(date) : new Date('1970-01-01');
        
        await prisma.customerTransaction.update({
          where: { id: createdTransaction.id },
          data: {
            createdAt: transactionDate,
            previousBalance: 0,
            newBalance: type === 'DEBIT' ? -parseFloat(amount) : parseFloat(amount)
          }
        });
        
        // Create journal entry for new starting balance (skip for CREDIT as it's not needed)
        if (type === 'DEBIT') {
          const transactionType = 'CUSTOMER_DEBIT';
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

    // Create journal entry for customer transaction (skip for starting balance as it's handled above)
    if (!isStartingBalance) {
      const transactionType = type === 'CREDIT' ? 'CUSTOMER_CREDIT' : 'CUSTOMER_DEBIT';
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
    console.error("Error adding customer transaction:", error);
    return NextResponse.json(
      { error: "Failed to add transaction" },
      { status: 500 }
    );
  }
}



