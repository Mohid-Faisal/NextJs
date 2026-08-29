import jwt from "jsonwebtoken";
import { Country } from "country-state-city";
import { defaultAccounts } from "@/lib/accounts/defaultAccounts";
import { nextJournalEntryNumber } from "@/lib/tenant/orgJournalChart";
import { getJwtSecretString } from "@/lib/auth/jwtSecret";

export function decodeToken(token: string) {
  try {
    const decoded = jwt.verify(token, getJwtSecretString());
    return decoded as { id: string; email: string; name: string };
  } catch {
    return null;
  }
}

/**
 * Generate a unique, org-scoped invoice number.
 * Backed by the atomic OrgSequence counter.
 */
export async function generateInvoiceNumber(
  prismaClient: any,
  organizationId?: number
): Promise<string> {
  const { nextSequenceNumber } = await import("@/lib/sequences");
  const { prisma } = await import("@/lib/prisma");

  const orgId = organizationId ?? 1;
  const key = `invoice_number`;

  const existing = await prisma.orgSequence.findUnique({
    where: { organizationId_key: { organizationId: orgId, key } },
    select: { nextNumber: true },
  });

  if (!existing) {
    const recentShipments = await prismaClient.shipment.findMany({
      where: {
        ...(organizationId != null ? { organizationId } : {}),
        invoiceNumber: { not: null },
      },
      orderBy: { id: "desc" },
      take: 500,
      select: { invoiceNumber: true },
    });

    const numericValues = recentShipments
      .map((s: { invoiceNumber: string | null }) => s.invoiceNumber)
      .filter((inv: string | null): inv is string => !!inv && /^\d+$/.test(inv.trim()))
      .map((inv: string) => parseInt(inv.trim(), 10))
      .filter((num: number) => !isNaN(num));

    const seed =
      numericValues.length > 0
        ? Math.max(Math.max(...numericValues) + 5, 600000)
        : 600000;

    try {
      await prisma.orgSequence.create({
        data: { organizationId: orgId, key, nextNumber: seed + 1 },
      });
      return seed.toString().padStart(6, "0");
    } catch {
      // Lost a race to seed — fall through to the atomic increment.
    }
  }

  const next = await nextSequenceNumber(prismaClient, orgId, key);
  const nextNumber = Math.max(next, 600000);
  return nextNumber.toString().padStart(6, "0");
}

export function generateVendorInvoiceNumber(customerInvoiceNumber: string): string {
  const customerNumber = parseInt(customerInvoiceNumber, 10);
  if (isNaN(customerNumber)) {
    return "600002";
  }
  const vendorNumber = customerNumber + 2;
  return vendorNumber.toString().padStart(6, "0");
}

export async function addCustomerTransaction(
  prisma: any,
  customerId: number,
  type: 'CREDIT' | 'DEBIT',
  amount: number,
  description: string,
  reference?: string,
  invoice?: string,
  date?: Date | string,
  organizationId?: number
) {
  const delta = type === 'CREDIT' ? amount : -amount;

  const updatedCustomer = await prisma.customers.update({
    where: { id: customerId },
    data: {
      currentBalance: { increment: delta },
    },
    select: { currentBalance: true },
  });

  const newBalance = updatedCustomer.currentBalance;
  const previousBalance = newBalance - delta;
  const transactionDate = date ? new Date(date) : new Date();

  await prisma.customerTransaction.create({
    data: {
      customerId,
      type,
      amount,
      description,
      reference,
      invoice,
      previousBalance,
      newBalance,
      createdAt: transactionDate,
      ...(organizationId != null ? { organizationId } : {}),
    }
  });

  return { previousBalance, newBalance };
}

export async function addVendorTransaction(
  prisma: any,
  vendorId: number,
  type: 'CREDIT' | 'DEBIT',
  amount: number,
  description: string,
  reference?: string,
  invoice?: string,
  date?: Date | string,
  organizationId?: number
) {
  const delta = type === 'DEBIT' ? amount : -amount;

  const updatedVendor = await prisma.vendors.update({
    where: { id: vendorId },
    data: {
      currentBalance: { increment: delta },
    },
    select: { currentBalance: true },
  });

  const newBalance = updatedVendor.currentBalance;
  const previousBalance = newBalance - delta;
  const transactionDate = date ? new Date(date) : new Date();

  await prisma.vendorTransaction.create({
    data: {
      vendorId,
      type,
      amount,
      description,
      reference,
      invoice,
      previousBalance,
      newBalance,
      createdAt: transactionDate,
      ...(organizationId != null ? { organizationId } : {}),
    }
  });

  return { previousBalance, newBalance };
}

export function buildShipmentDebitTransactionLineDescription(
  trackingId: string,
  country: string,
  packaging: string,
  weightKg: number
): string {
  return `Tracking: ${trackingId} | Country: ${country} | Type: ${packaging} | Weight: ${weightKg}Kg`;
}

export async function syncShipmentInvoiceDebitTransactionDescriptions(
  prisma: any,
  params: {
    lineDescription: string;
    invoices: Array<{
      customerId: number | null;
      vendorId: number | null;
      invoiceNumber: string;
    }>;
  }
) {
  const { lineDescription, invoices } = params;
  const isCreditRef = (ref: string | null | undefined, inv: string | null | undefined) =>
    (ref ?? "").startsWith("CREDIT-") || (inv ?? "").startsWith("CREDIT-");

  for (const inv of invoices) {
    if (inv.customerId) {
      const candidates = await prisma.customerTransaction.findMany({
        where: {
          customerId: inv.customerId,
          type: "DEBIT",
          OR: [
            { reference: inv.invoiceNumber },
            { invoice: inv.invoiceNumber },
            { reference: { startsWith: `Invoice: ${inv.invoiceNumber}` } },
          ],
        },
        orderBy: { createdAt: "asc" },
      });
      const row =
        candidates.find(
          (c: { reference?: string | null; invoice?: string | null; description?: string }) =>
            !isCreditRef(c.reference, c.invoice) && (c.description?.startsWith("Tracking:") ?? false)
        ) ??
        candidates.find(
          (c: { reference?: string | null; invoice?: string | null }) =>
            !isCreditRef(c.reference, c.invoice)
        );
      if (row) {
        await prisma.customerTransaction.update({
          where: { id: row.id },
          data: { description: lineDescription },
        });
      }
    }

    if (inv.vendorId) {
      const candidates = await prisma.vendorTransaction.findMany({
        where: {
          vendorId: inv.vendorId,
          type: "DEBIT",
          OR: [
            { reference: inv.invoiceNumber },
            { invoice: inv.invoiceNumber },
            { reference: { startsWith: `Invoice: ${inv.invoiceNumber}` } },
          ],
        },
        orderBy: { createdAt: "asc" },
      });
      const row =
        candidates.find(
          (c: { reference?: string | null; invoice?: string | null; description?: string }) =>
            !isCreditRef(c.reference, c.invoice) && (c.description?.startsWith("Tracking:") ?? false)
        ) ??
        candidates.find(
          (c: { reference?: string | null; invoice?: string | null }) =>
            !isCreditRef(c.reference, c.invoice)
        );
      if (row) {
        await prisma.vendorTransaction.update({
          where: { id: row.id },
          data: { description: lineDescription },
        });
      }
    }
  }
}

export async function updateInvoiceBalance(
  prisma: any,
  invoiceId: number,
  oldAmount: number,
  newAmount: number,
  oldCustomerId?: number | null,
  newCustomerId?: number | null,
  oldVendorId?: number | null,
  newVendorId?: number | null
) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      vendor: true,
      shipment: {
        select: {
          shipmentDate: true
        }
      }
    }
  });

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const amountDifference = newAmount - oldAmount;
  const customerChanged = oldCustomerId !== undefined && oldCustomerId !== newCustomerId;
  const vendorChanged = oldVendorId !== undefined && oldVendorId !== newVendorId;
  
  if (amountDifference === 0 && !customerChanged && !vendorChanged) {
    return { customerUpdated: false, vendorUpdated: false };
  }

  let customerUpdated = false;
  let vendorUpdated = false;

  if (customerChanged) {
    if (oldCustomerId) {
      const oldCustomer = await prisma.customers.findUnique({
        where: { id: oldCustomerId }
      });
      if (oldCustomer) {
        const previousBalance = oldCustomer.currentBalance;
        const newBalance = previousBalance - oldAmount;

        await prisma.customers.update({
          where: { id: oldCustomerId },
          data: { currentBalance: newBalance }
        });

        const transactionDate = invoice.shipment?.shipmentDate || new Date();
        await prisma.customerTransaction.create({
          data: {
            customerId: oldCustomerId,
            type: 'CREDIT',
            amount: oldAmount,
            description: `Invoice ${invoice.invoiceNumber} reassigned from customer`,
            reference: invoice.invoiceNumber,
            invoice: invoice.invoiceNumber,
            previousBalance,
            newBalance,
            createdAt: transactionDate
          }
        });
      }
    }

    if (newCustomerId) {
      const newCustomer = await prisma.customers.findUnique({
        where: { id: newCustomerId }
      });
      if (newCustomer) {
        const previousBalance = newCustomer.currentBalance;
        const newBalance = previousBalance + newAmount;

        await prisma.customers.update({
          where: { id: newCustomerId },
          data: { currentBalance: newBalance }
        });

        const transactionDate = invoice.shipment?.shipmentDate || new Date();
        await prisma.customerTransaction.create({
          data: {
            customerId: newCustomerId,
            type: 'DEBIT',
            amount: newAmount,
            description: `Invoice ${invoice.invoiceNumber} assigned to customer`,
            reference: invoice.invoiceNumber,
            invoice: invoice.invoiceNumber,
            previousBalance,
            newBalance,
            createdAt: transactionDate
          }
        });
      }
    }
    customerUpdated = true;
  } else if (amountDifference !== 0 && invoice.customerId && invoice.customer) {
    const previousBalance = invoice.customer.currentBalance;
    const newBalance = previousBalance - amountDifference;

    await prisma.customers.update({
      where: { id: invoice.customerId },
      data: { currentBalance: newBalance }
    });

    const existingTransaction = await prisma.customerTransaction.findFirst({
      where: {
        customerId: invoice.customerId,
        OR: [
          { reference: invoice.invoiceNumber },
          { invoice: invoice.invoiceNumber },
          { reference: { startsWith: `Invoice: ${invoice.invoiceNumber}` } }
        ]
      }
    });

    const transactionDate = invoice.shipment?.shipmentDate || new Date();

    if (existingTransaction) {
      await prisma.customerTransaction.update({
        where: { id: existingTransaction.id },
        data: {
          type: 'DEBIT',
          amount: Math.abs(newAmount),
          previousBalance,
          newBalance,
          createdAt: transactionDate
        }
      });
    } else {
      await prisma.customerTransaction.create({
        data: {
          customerId: invoice.customerId,
          type: 'DEBIT',
          amount: Math.abs(newAmount),
          description: `Invoice ${invoice.invoiceNumber} amount updated from ${oldAmount.toFixed(2)} to ${newAmount.toFixed(2)}`,
          reference: invoice.invoiceNumber,
          invoice: invoice.invoiceNumber,
          previousBalance,
          newBalance,
          createdAt: transactionDate
        }
      });
    }

    customerUpdated = true;
  }

  if (vendorChanged) {
    if (oldVendorId) {
      const oldVendor = await prisma.vendors.findUnique({
        where: { id: oldVendorId }
      });
      if (oldVendor) {
        const previousBalance = oldVendor.currentBalance;
        const newBalance = previousBalance - oldAmount;

        await prisma.vendors.update({
          where: { id: oldVendorId },
          data: { currentBalance: newBalance }
        });

        await prisma.vendorTransaction.create({
          data: {
            vendorId: oldVendorId,
            type: 'CREDIT',
            amount: oldAmount,
            description: `Invoice ${invoice.invoiceNumber} reassigned from vendor`,
            reference: `Invoice: ${invoice.invoiceNumber}`,
            previousBalance,
            newBalance
          }
        });
      }
    }

    if (newVendorId) {
      const newVendor = await prisma.vendors.findUnique({
        where: { id: newVendorId }
      });
      if (newVendor) {
        const previousBalance = newVendor.currentBalance;
        const newBalance = previousBalance + newAmount;

        await prisma.vendors.update({
          where: { id: newVendorId },
          data: { currentBalance: newBalance }
        });

        await prisma.vendorTransaction.create({
          data: {
            vendorId: newVendorId,
            type: 'DEBIT',
            amount: newAmount,
            description: `Invoice ${invoice.invoiceNumber} assigned to vendor`,
            reference: `Invoice: ${invoice.invoiceNumber}`,
            previousBalance,
            newBalance
          }
        });
      }
    }
    vendorUpdated = true;
  } else if (amountDifference !== 0 && invoice.vendorId && invoice.vendor) {
    const previousBalance = invoice.vendor.currentBalance;
    const newBalance = previousBalance + amountDifference;

    await prisma.vendors.update({
      where: { id: invoice.vendorId },
      data: { currentBalance: newBalance }
    });

    const existingTransaction = await prisma.vendorTransaction.findFirst({
      where: {
        vendorId: invoice.vendorId,
        OR: [
          { reference: invoice.invoiceNumber },
          { invoice: invoice.invoiceNumber },
          { reference: { startsWith: `Invoice: ${invoice.invoiceNumber}` } }
        ]
      }
    });

    const transactionDate = invoice.shipment?.shipmentDate || new Date();

    if (existingTransaction) {
      await prisma.vendorTransaction.update({
        where: { id: existingTransaction.id },
        data: {
          type: 'DEBIT',
          amount: Math.abs(newAmount),
          previousBalance,
          newBalance,
          createdAt: transactionDate
        }
      });
    } else {
      await prisma.vendorTransaction.create({
        data: {
          vendorId: invoice.vendorId,
          type: 'DEBIT',
          amount: Math.abs(newAmount),
          description: `Invoice ${invoice.invoiceNumber} amount updated from ${oldAmount.toFixed(2)} to ${newAmount.toFixed(2)}`,
          reference: invoice.invoiceNumber,
          invoice: invoice.invoiceNumber,
          previousBalance,
          newBalance,
          createdAt: transactionDate
        }
      });
    }

    vendorUpdated = true;
  }

  return { customerUpdated, vendorUpdated };
}

export async function createJournalEntryForTransaction(
  prisma: any,
  type: 'CUSTOMER_DEBIT' | 'CUSTOMER_CREDIT' | 'VENDOR_DEBIT' | 'VENDOR_CREDIT' | 'COMPANY_DEBIT' | 'COMPANY_CREDIT',
  amount: number,
  description: string,
  reference?: string,
  invoice?: string,
  date?: Date | string,
  organizationId?: number
) {
  try {
    const orgFilter = organizationId != null ? { organizationId } : {};

    if (organizationId != null) {
      const existingCount = await prisma.chartOfAccount.count({
        where: { organizationId }
      });
      if (existingCount === 0) {
        try {
          await prisma.chartOfAccount.createMany({
            data: defaultAccounts.map((account) => ({
              ...account,
              organizationId,
              isActive: true,
            })),
          });
        } catch (err) {
          console.error(`Failed to initialize default accounts for organization ${organizationId}:`, err);
        }
      }
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      console.warn(`Skipping ${type} journal entry for ${reference || invoice}: non-positive amount ${amount}`);
      return null;
    }

    let entryNumber = "JE-0001";
    if (organizationId != null) {
      entryNumber = await nextJournalEntryNumber(prisma, organizationId);
    } else {
      const lastEntry = await prisma.journalEntry.findFirst({
        where: orgFilter,
        orderBy: { entryNumber: "desc" }
      });
      if (lastEntry) {
        const lastNumber = parseInt(String(lastEntry.entryNumber).split("-")[1], 10);
        entryNumber = `JE-${String((Number.isFinite(lastNumber) ? lastNumber : 0) + 1).padStart(4, "0")}`;
      }
    }

    const chartWhere = (extra: Record<string, unknown>) =>
      organizationId != null ? { organizationId, ...extra } : extra;

    const cashAccount = await prisma.chartOfAccount.findFirst({
      where: chartWhere({ accountName: "Cash" })
    });

    const accountsReceivable = await prisma.chartOfAccount.findFirst({
      where: chartWhere({ accountName: "Accounts Receivable" })
    });

    const accountsPayable = await prisma.chartOfAccount.findFirst({
      where: chartWhere({ accountName: "Accounts Payable" })
    });

    const revenueAccount = await prisma.chartOfAccount.findFirst({
      where: chartWhere({
        category: "Revenue",
        accountName: "Logistics Services Revenue"
      })
    });

    const expenseAccount = await prisma.chartOfAccount.findFirst({
      where: chartWhere({
        category: "Expense",
        accountName: "Vendor Expense"
      })
    });

    const writeEntry = async (tx: any) => {
      const entryDate = date ? new Date(date) : new Date();

      const existingEntry = reference && !reference.startsWith("Transaction-")
        ? await tx.journalEntry.findFirst({
            where: { ...orgFilter, reference },
            include: { lines: true }
          })
        : null;

      if (existingEntry) {
        await tx.journalEntry.update({
          where: { id: existingEntry.id },
          data: {
            date: entryDate,
            description: description,
            totalDebit: amount,
            totalCredit: amount,
            updatedAt: new Date()
          }
        });

        for (const line of existingEntry.lines) {
          if (line.debitAmount > 0) {
            await tx.journalEntryLine.update({
              where: { id: line.id },
              data: { debitAmount: amount }
            });
          } else if (line.creditAmount > 0) {
            await tx.journalEntryLine.update({
              where: { id: line.id },
              data: { creditAmount: amount }
            });
          }
        }
        return existingEntry;
      }

      const entry = await tx.journalEntry.create({
        data: {
          ...orgFilter,
          entryNumber,
          date: entryDate,
          description: description,
          reference: reference || `Transaction-${Date.now()}`,
          totalDebit: amount,
          totalCredit: amount,
          isPosted: true,
          postedAt: entryDate
        }
      });

      switch (type) {
        case 'CUSTOMER_DEBIT':
          if (accountsReceivable && revenueAccount) {
            await Promise.all([
              tx.journalEntryLine.create({
                data: {
                  journalEntryId: entry.id,
                  accountId: accountsReceivable.id,
                  debitAmount: amount,
                  creditAmount: 0,
                  description: `Debit: Customer owes money`,
                  reference: reference
                }
              }),
              tx.journalEntryLine.create({
                data: {
                  journalEntryId: entry.id,
                  accountId: revenueAccount.id,
                  debitAmount: 0,
                  creditAmount: amount,
                  description: `Credit: Revenue earned`,
                  reference: reference
                }
              })
            ]);
          }
          break;

        case 'CUSTOMER_CREDIT':
          if (cashAccount && accountsReceivable) {
            await Promise.all([
              tx.journalEntryLine.create({
                data: {
                  journalEntryId: entry.id,
                  accountId: cashAccount.id,
                  debitAmount: amount,
                  creditAmount: 0,
                  description: `Debit: Cash received`,
                  reference: reference
                }
              }),
              tx.journalEntryLine.create({
                data: {
                  journalEntryId: entry.id,
                  accountId: accountsReceivable.id,
                  debitAmount: 0,
                  creditAmount: amount,
                  description: `Credit: Accounts receivable reduced`,
                  reference: reference
                }
              })
            ]);
          }
          break;

        case 'VENDOR_DEBIT':
          if (expenseAccount && accountsPayable) {
            await Promise.all([
              tx.journalEntryLine.create({
                data: {
                  journalEntryId: entry.id,
                  accountId: expenseAccount.id,
                  debitAmount: amount,
                  creditAmount: 0,
                  description: `Debit: Expense incurred`,
                  reference: reference
                }
              }),
              tx.journalEntryLine.create({
                data: {
                  journalEntryId: entry.id,
                  accountId: accountsPayable.id,
                  debitAmount: 0,
                  creditAmount: amount,
                  description: `Credit: Accounts payable increased`,
                  reference: reference
                }
              })
            ]);
          }
          break;

        case 'VENDOR_CREDIT':
          if (accountsPayable && cashAccount) {
            await Promise.all([
              tx.journalEntryLine.create({
                data: {
                  journalEntryId: entry.id,
                  accountId: accountsPayable.id,
                  debitAmount: amount,
                  creditAmount: 0,
                  description: `Debit: Accounts payable reduced`,
                  reference: reference
                }
              }),
              tx.journalEntryLine.create({
                data: {
                  journalEntryId: entry.id,
                  accountId: cashAccount.id,
                  debitAmount: 0,
                  creditAmount: amount,
                  description: `Credit: Cash paid`,
                  reference: reference
                }
              })
            ]);
          }
          break;

        case 'COMPANY_DEBIT':
          if (cashAccount && revenueAccount) {
            await Promise.all([
              tx.journalEntryLine.create({
                data: {
                  journalEntryId: entry.id,
                  accountId: cashAccount.id,
                  debitAmount: amount,
                  creditAmount: 0,
                  description: `Debit: Cash received`,
                  reference: reference
                }
              }),
              tx.journalEntryLine.create({
                data: {
                  journalEntryId: entry.id,
                  accountId: revenueAccount.id,
                  debitAmount: 0,
                  creditAmount: amount,
                  description: `Credit: Revenue earned`,
                  reference: reference
                }
              })
            ]);
          }
          break;

        case 'COMPANY_CREDIT':
          if (expenseAccount && cashAccount) {
            await Promise.all([
              tx.journalEntryLine.create({
                data: {
                  journalEntryId: entry.id,
                  accountId: expenseAccount.id,
                  debitAmount: amount,
                  creditAmount: 0,
                  description: `Debit: Expense incurred`,
                  reference: reference
                }
              }),
              tx.journalEntryLine.create({
                data: {
                  journalEntryId: entry.id,
                  accountId: cashAccount.id,
                  debitAmount: 0,
                  creditAmount: amount,
                  description: `Credit: Cash paid`,
                  reference: reference
                }
              })
            ]);
          }
          break;
      }

      return entry;
    };

    const journalEntry =
      typeof prisma.$transaction === "function"
        ? await prisma.$transaction(writeEntry)
        : await writeEntry(prisma);

    return journalEntry;
  } catch (error) {
    console.error("Error creating journal entry for transaction:", error);
    throw error;
  }
}

export async function updateJournalEntriesForInvoice(
  prisma: any,
  invoiceId: number,
  oldAmount: number,
  newAmount: number,
  oldCustomerId: number | null,
  newCustomerId: number | null,
  oldVendorId: number | null,
  newVendorId: number | null,
  invoiceNumber: string,
  description: string,
  organizationId?: number
) {
  try {
    const updates = [];
    const effectiveCustomerId = newCustomerId || oldCustomerId;
    if (effectiveCustomerId && newAmount > 0) {
      updates.push(
        updateCustomerJournalEntry(
          prisma,
          effectiveCustomerId,
          oldAmount,
          newAmount,
          invoiceNumber,
          description,
          organizationId
        )
      );
    }

    const effectiveVendorId = newVendorId || oldVendorId;
    if (effectiveVendorId && newAmount > 0) {
      updates.push(
        updateVendorJournalEntry(
          prisma,
          effectiveVendorId,
          oldAmount,
          newAmount,
          invoiceNumber,
          description,
          organizationId
        )
      );
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }

    return { 
      customerUpdated: !!effectiveCustomerId,
      vendorUpdated: !!effectiveVendorId
    };
  } catch (error) {
    console.error(`Error updating journal entries for invoice ${invoiceNumber}:`, error);
    throw error;
  }
}

export async function updateCustomerJournalEntry(
  prisma: any,
  customerId: number,
  oldAmount: number,
  newAmount: number,
  invoiceNumber: string,
  description: string,
  organizationId?: number
) {
  try {
    const orgFilter = organizationId != null ? { organizationId } : {};
    const existingEntry = await prisma.journalEntry.findFirst({
      where: {
        ...orgFilter,
        reference: invoiceNumber,
      },
      include: { lines: true }
    });

    if (existingEntry) {
      await prisma.journalEntry.update({
        where: { id: existingEntry.id },
        data: {
          description: description,
          totalDebit: newAmount,
          totalCredit: newAmount,
          updatedAt: new Date()
        }
      });

      for (const line of existingEntry.lines) {
        if (line.debitAmount >= 0 && line.description.includes('Debit')) {
          await prisma.journalEntryLine.update({
            where: { id: line.id },
            data: { debitAmount: newAmount }
          });
        } else if (line.creditAmount >= 0 && line.description.includes('Credit')) {
          await prisma.journalEntryLine.update({
            where: { id: line.id },
            data: { creditAmount: newAmount }
          });
        }
      }
    } else if (newAmount > 0) {
      const invoice = await prisma.invoice.findFirst({
        where: organizationId != null
          ? { organizationId, invoiceNumber }
          : { invoiceNumber },
        include: { shipment: { select: { shipmentDate: true, trackingId: true } } },
      });
      const entryDate =
        invoice?.shipment?.shipmentDate || invoice?.invoiceDate || new Date();
      const tracking =
        invoice?.shipment?.trackingId || invoice?.trackingNumber || invoiceNumber;
      await createJournalEntryForTransaction(
        prisma,
        "CUSTOMER_DEBIT",
        newAmount,
        description || `Customer invoice for shipment ${tracking}`,
        invoiceNumber,
        invoiceNumber,
        entryDate,
        organizationId
      );
    }
  } catch (error) {
    console.error(`Error updating customer journal entry for invoice ${invoiceNumber}:`, error);
    throw error;
  }
}

export async function updateVendorJournalEntry(
  prisma: any,
  vendorId: number,
  oldAmount: number,
  newAmount: number,
  invoiceNumber: string,
  description: string,
  organizationId?: number
) {
  try {
    const orgFilter = organizationId != null ? { organizationId } : {};
    const existingEntry = await prisma.journalEntry.findFirst({
      where: {
        ...orgFilter,
        reference: invoiceNumber,
      },
      include: { lines: true }
    });

    if (existingEntry) {
      await prisma.journalEntry.update({
        where: { id: existingEntry.id },
        data: {
          description: description,
          totalDebit: newAmount,
          totalCredit: newAmount,
          updatedAt: new Date()
        }
      });

      for (const line of existingEntry.lines) {
        if (line.debitAmount >= 0 && line.description.includes('Debit')) {
          await prisma.journalEntryLine.update({
            where: { id: line.id },
            data: { debitAmount: newAmount }
          });
        } else if (line.creditAmount >= 0 && line.description.includes('Credit')) {
          await prisma.journalEntryLine.update({
            where: { id: line.id },
            data: { creditAmount: newAmount }
          });
        }
      }
    } else if (newAmount > 0) {
      const invoice = await prisma.invoice.findFirst({
        where: organizationId != null
          ? { organizationId, invoiceNumber }
          : { invoiceNumber },
        include: { shipment: { select: { shipmentDate: true, trackingId: true } } },
      });
      const entryDate =
        invoice?.shipment?.shipmentDate || invoice?.invoiceDate || new Date();
      const tracking =
        invoice?.shipment?.trackingId || invoice?.trackingNumber || invoiceNumber;
      await createJournalEntryForTransaction(
        prisma,
        "VENDOR_DEBIT",
        newAmount,
        description || `Vendor invoice for shipment ${tracking}`,
        invoiceNumber,
        invoiceNumber,
        entryDate,
        organizationId
      );
    }
  } catch (error) {
    console.error(`Error updating vendor journal entry for invoice ${invoiceNumber}:`, error);
    throw error;
  }
}

export async function checkRemoteArea(
  prisma: any,
  country: string,
  city?: string,
  zip?: string,
  organizationId?: number
): Promise<{ isRemote: boolean; companies: string[] }> {
  try {
    if (!country) return { isRemote: false, companies: [] };

    const remoteAreas = await prisma.remoteArea.findMany({
      where: organizationId != null ? { organizationId } : undefined,
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    if (!remoteAreas || remoteAreas.length === 0) return { isRemote: false, companies: [] };

    const selectedCountry = Country.getCountryByCode(country);
    const searchCountryName = selectedCountry?.name || country;
    const searchCountryCode = country.toLowerCase();

    let matchingAreas = remoteAreas.filter((area: any) => {
      const areaCountry = (area.country?.toLowerCase() || '').trim();
      const areaIataCode = (area.iataCode?.toLowerCase() || '').trim();
      const searchCountryNameLower = searchCountryName.toLowerCase();
      
      return (
        areaCountry === searchCountryCode ||
        areaCountry === searchCountryNameLower ||
        areaIataCode === searchCountryCode ||
        areaCountry.includes(searchCountryNameLower) ||
        searchCountryNameLower.includes(areaCountry)
      );
    });
    
    if (matchingAreas.length === 0) {
      matchingAreas = remoteAreas.filter((area: any) => {
        const areaIataCode = (area.iataCode?.toLowerCase() || '').trim();
        return areaIataCode === searchCountryCode;
      });
    }

    if (matchingAreas.length === 0) return { isRemote: false, companies: [] };

    const matchedCompanies = new Set<string>();

    if (zip && zip.trim()) {
      const zipValue = zip.trim();
      const zipNumber = parseFloat(zipValue);
      
      if (!isNaN(zipNumber)) {
        const rangeMatches = matchingAreas.filter((area: any) => {
          const low = parseFloat(String(area.low || '').trim());
          const high = parseFloat(String(area.high || '').trim());
          
          if (!isNaN(low) && !isNaN(high)) {
            return zipNumber >= low && zipNumber <= high;
          }
          return false;
        });
        
        rangeMatches.forEach((area: any) => {
          if (area.company) matchedCompanies.add(area.company);
        });
        
        const stringMatches = matchingAreas.filter((area: any) => {
          const lowStr = String(area.low || '').trim();
          const highStr = String(area.high || '').trim();
          return lowStr.includes(zipValue) || highStr.includes(zipValue);
        });
        
        stringMatches.forEach((area: any) => {
          if (area.company) matchedCompanies.add(area.company);
        });
      } else {
        const stringMatches = matchingAreas.filter((area: any) => {
          const lowStr = String(area.low || '').trim();
          const highStr = String(area.high || '').trim();
          return lowStr.includes(zipValue) || highStr.includes(zipValue);
        });
        
        stringMatches.forEach((area: any) => {
          if (area.company) matchedCompanies.add(area.company);
        });
      }
    }

    if (city && city.trim()) {
      const cityValue = city.trim().toLowerCase();
      const cityMatches = matchingAreas.filter((area: any) => {
        const areaCity = area.city?.toLowerCase();
        return areaCity === cityValue;
      });
      
      cityMatches.forEach((area: any) => {
        if (area.company) matchedCompanies.add(area.company);
      });
    }

    const companies = Array.from(matchedCompanies);
    return {
      isRemote: companies.length > 0,
      companies: companies
    };
  } catch (error) {
    console.error("Error checking remote area:", error);
    return { isRemote: false, companies: [] };
  }
}
