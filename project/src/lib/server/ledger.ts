import jwt from "jsonwebtoken";
import { Country } from "country-state-city";
import { defaultAccounts } from "@/lib/accounts/defaultAccounts";
import { nextJournalEntryNumber } from "@/lib/tenant/orgJournalChart";
import { getJwtSecretString } from "@/lib/auth/jwtSecret";
import { parseDateInputAsLocalDate } from "@/lib/noteFormats";

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
  const orgScope = organizationId != null ? { organizationId } : {};

  const existing = await prisma.orgSequence.findUnique({
    where: { organizationId_key: { organizationId: orgId, key } },
    select: { nextNumber: true },
  });

  if (!existing) {
    const [recentShipments, recentInvoices] = await Promise.all([
      prismaClient.shipment.findMany({
        where: {
          ...orgScope,
          invoiceNumber: { not: null },
        },
        orderBy: { id: "desc" },
        take: 500,
        select: { invoiceNumber: true },
      }),
      prismaClient.invoice.findMany({
        where: orgScope,
        orderBy: { id: "desc" },
        take: 500,
        select: { invoiceNumber: true },
      }),
    ]);

    const numericValues = [
      ...recentShipments.map((s: { invoiceNumber: string | null }) => s.invoiceNumber),
      ...recentInvoices.map((inv: { invoiceNumber: string | null }) => inv.invoiceNumber),
    ]
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

  // Advance sequence until neither candidate nor its companion vendor invoice (+2) collides
  for (let attempt = 0; attempt < 50; attempt++) {
    const next = await nextSequenceNumber(prismaClient, orgId, key);
    const nextNumber = Math.max(next, 600000);
    const candidate = nextNumber.toString().padStart(6, "0");
    const vendorCompanion = generateVendorInvoiceNumber(candidate);

    const [existingInv, existingShip] = await Promise.all([
      prismaClient.invoice.findFirst({
        where: {
          ...orgScope,
          invoiceNumber: { in: [candidate, vendorCompanion] },
        },
        select: { id: true },
      }),
      prismaClient.shipment.findFirst({
        where: {
          ...orgScope,
          invoiceNumber: { in: [candidate, vendorCompanion] },
        },
        select: { id: true },
      }),
    ]);

    if (!existingInv && !existingShip) {
      return candidate;
    }
  }

  const fallback = await nextSequenceNumber(prismaClient, orgId, key);
  return Math.max(fallback, 600000).toString().padStart(6, "0");
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
  const amountNum = Number(amount) || 0;
  const delta = type === 'CREDIT' ? amountNum : -amountNum;

  const updatedCustomer = await prisma.customers.update({
    where: { id: customerId },
    data: {
      currentBalance: { increment: delta },
    },
    select: { currentBalance: true },
  });

  const newBalance = Number(updatedCustomer.currentBalance);
  const previousBalance = newBalance - delta;
  const transactionDate = date ? parseDateInputAsLocalDate(date) : new Date();

  await prisma.customerTransaction.create({
    data: {
      customerId,
      type,
      amount: amountNum,
      description,
      reference: reference ?? invoice ?? null,
      invoice: invoice ?? null,
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
  const amountNum = Number(amount) || 0;
  const delta = type === 'DEBIT' ? amountNum : -amountNum;

  const updatedVendor = await prisma.vendors.update({
    where: { id: vendorId },
    data: {
      currentBalance: { increment: delta },
    },
    select: { currentBalance: true },
  });

  const newBalance = Number(updatedVendor.currentBalance);
  const previousBalance = newBalance - delta;
  const transactionDate = date ? parseDateInputAsLocalDate(date) : new Date();

  await prisma.vendorTransaction.create({
    data: {
      vendorId,
      type,
      amount: amountNum,
      description,
      reference: reference ?? invoice ?? null,
      invoice: invoice ?? null,
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

  const oldAmountNum = Number(oldAmount) || 0;
  const newAmountNum = Number(newAmount) || 0;
  const amountDifference = newAmountNum - oldAmountNum;
  const customerChanged = oldCustomerId !== undefined && oldCustomerId !== newCustomerId;
  const vendorChanged = oldVendorId !== undefined && oldVendorId !== newVendorId;
  const orgScope = invoice.organizationId != null ? { organizationId: invoice.organizationId } : {};
  const isVendorProfile =
    invoice.profile === "Vendor" ||
    (!invoice.profile && Boolean((invoice.vendorId || newVendorId || oldVendorId) && !invoice.customerId));
  const isCustomerProfile = !isVendorProfile;
  
  if (amountDifference === 0 && !customerChanged && !vendorChanged) {
    return { customerUpdated: false, vendorUpdated: false };
  }

  let customerUpdated = false;
  let vendorUpdated = false;

  if (isCustomerProfile && customerChanged) {
    if (oldCustomerId) {
      const oldCustomer = await prisma.customers.findUnique({
        where: { id: oldCustomerId }
      });
      if (oldCustomer) {
        const previousBalance = Number(oldCustomer.currentBalance) || 0;
        const newBalance = previousBalance + oldAmountNum; // Unassigning removes the debit, increasing balance

        await prisma.customers.update({
          where: { id: oldCustomerId },
          data: { currentBalance: newBalance }
        });

        const existingOldDebit = await prisma.customerTransaction.findFirst({
          where: {
            customerId: oldCustomerId,
            type: 'DEBIT',
            OR: [
              { reference: invoice.invoiceNumber },
              { invoice: invoice.invoiceNumber },
              { reference: { startsWith: `Invoice: ${invoice.invoiceNumber}` } }
            ]
          }
        });

        if (existingOldDebit) {
          await prisma.customerTransaction.delete({
            where: { id: existingOldDebit.id }
          });
        } else {
          const transactionDate = invoice.shipment?.shipmentDate || new Date();
          await prisma.customerTransaction.create({
            data: {
              ...orgScope,
              customerId: oldCustomerId,
              type: 'CREDIT',
              amount: oldAmountNum,
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
    }

    if (newCustomerId) {
      const newCustomer = await prisma.customers.findUnique({
        where: { id: newCustomerId }
      });
      if (newCustomer) {
        const previousBalance = Number(newCustomer.currentBalance) || 0;
        const newBalance = previousBalance - newAmountNum; // Assigning adds the debit, decreasing balance

        await prisma.customers.update({
          where: { id: newCustomerId },
          data: { currentBalance: newBalance }
        });

        const transactionDate = invoice.shipment?.shipmentDate || new Date();
        await prisma.customerTransaction.create({
          data: {
            ...orgScope,
            customerId: newCustomerId,
            type: 'DEBIT',
            amount: newAmountNum,
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
  } else if (isCustomerProfile && amountDifference !== 0 && invoice.customerId && invoice.customer) {
    const updatedCustomer = await prisma.customers.update({
      where: { id: invoice.customerId },
      data: { currentBalance: { increment: -amountDifference } },
      select: { currentBalance: true }
    });
    const currentBalanceNum = Number(updatedCustomer.currentBalance);

    const existingTransaction = await prisma.customerTransaction.findFirst({
      where: {
        customerId: invoice.customerId,
        type: 'DEBIT',
        OR: [
          { reference: invoice.invoiceNumber },
          { invoice: invoice.invoiceNumber },
          { reference: { startsWith: `Invoice: ${invoice.invoiceNumber}` } }
        ]
      }
    });

    const transactionDate = invoice.shipment?.shipmentDate || new Date();

    if (existingTransaction) {
      const prevBal = Number(existingTransaction.previousBalance) || 0;
      const nextBal = prevBal - Math.abs(newAmountNum);
      await prisma.customerTransaction.update({
        where: { id: existingTransaction.id },
        data: {
          type: 'DEBIT',
          amount: Math.abs(newAmountNum),
          previousBalance: prevBal,
          newBalance: nextBal,
          createdAt: transactionDate
        }
      });
    } else {
      await prisma.customerTransaction.create({
        data: {
          ...orgScope,
          customerId: invoice.customerId,
          type: 'DEBIT',
          amount: Math.abs(newAmountNum),
          description: `Invoice ${invoice.invoiceNumber} amount updated from ${oldAmountNum.toFixed(2)} to ${newAmountNum.toFixed(2)}`,
          reference: invoice.invoiceNumber,
          invoice: invoice.invoiceNumber,
          previousBalance: currentBalanceNum + amountDifference,
          newBalance: currentBalanceNum,
          createdAt: transactionDate
        }
      });
    }

    customerUpdated = true;
  }

  if (isVendorProfile && vendorChanged) {
    if (oldVendorId) {
      const oldVendor = await prisma.vendors.findUnique({
        where: { id: oldVendorId }
      });
      if (oldVendor) {
        const previousBalance = Number(oldVendor.currentBalance) || 0;
        const newBalance = previousBalance - oldAmountNum;

        await prisma.vendors.update({
          where: { id: oldVendorId },
          data: { currentBalance: newBalance }
        });

        const existingOldVendorDebit = await prisma.vendorTransaction.findFirst({
          where: {
            vendorId: oldVendorId,
            type: 'DEBIT',
            OR: [
              { reference: invoice.invoiceNumber },
              { invoice: invoice.invoiceNumber },
              { reference: { startsWith: `Invoice: ${invoice.invoiceNumber}` } }
            ]
          }
        });

        if (existingOldVendorDebit) {
          await prisma.vendorTransaction.delete({
            where: { id: existingOldVendorDebit.id }
          });
        } else {
          await prisma.vendorTransaction.create({
            data: {
              ...orgScope,
              vendorId: oldVendorId,
              type: 'CREDIT',
              amount: oldAmountNum,
              description: `Invoice ${invoice.invoiceNumber} reassigned from vendor`,
              reference: invoice.invoiceNumber,
              invoice: invoice.invoiceNumber,
              previousBalance,
              newBalance
            }
          });
        }
      }
    }

    if (newVendorId) {
      const newVendor = await prisma.vendors.findUnique({
        where: { id: newVendorId }
      });
      if (newVendor) {
        const previousBalance = Number(newVendor.currentBalance) || 0;
        const newBalance = previousBalance + newAmountNum;

        await prisma.vendors.update({
          where: { id: newVendorId },
          data: { currentBalance: newBalance }
        });

        await prisma.vendorTransaction.create({
          data: {
            ...orgScope,
            vendorId: newVendorId,
            type: 'DEBIT',
            amount: newAmountNum,
            description: `Invoice ${invoice.invoiceNumber} assigned to vendor`,
            reference: invoice.invoiceNumber,
            invoice: invoice.invoiceNumber,
            previousBalance,
            newBalance
          }
        });
      }
    }
    vendorUpdated = true;
  } else if (isVendorProfile && amountDifference !== 0 && invoice.vendorId && invoice.vendor) {
    const updatedVendor = await prisma.vendors.update({
      where: { id: invoice.vendorId },
      data: { currentBalance: { increment: amountDifference } },
      select: { currentBalance: true }
    });
    const newBalance = Number(updatedVendor.currentBalance) || 0;
    const previousBalance = newBalance - amountDifference;

    const existingTransaction = await prisma.vendorTransaction.findFirst({
      where: {
        vendorId: invoice.vendorId,
        type: 'DEBIT',
        OR: [
          { reference: invoice.invoiceNumber },
          { invoice: invoice.invoiceNumber },
          { reference: { startsWith: `Invoice: ${invoice.invoiceNumber}` } }
        ]
      }
    });

    const transactionDate = invoice.shipment?.shipmentDate || new Date();

    if (existingTransaction) {
      const prevBal = Number(existingTransaction.previousBalance) || 0;
      const nextBal = prevBal + Math.abs(newAmountNum);
      await prisma.vendorTransaction.update({
        where: { id: existingTransaction.id },
        data: {
          type: 'DEBIT',
          amount: Math.abs(newAmountNum),
          previousBalance: prevBal,
          newBalance: nextBal,
          createdAt: transactionDate
        }
      });
    } else {
      await prisma.vendorTransaction.create({
        data: {
          ...orgScope,
          vendorId: invoice.vendorId,
          type: 'DEBIT',
          amount: Math.abs(newAmountNum),
          description: `Invoice ${invoice.invoiceNumber} amount updated from ${oldAmountNum.toFixed(2)} to ${newAmountNum.toFixed(2)}`,
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

    let accounts = await prisma.chartOfAccount.findMany({
      where: chartWhere({
        accountName: {
          in: [
            "Cash",
            "Accounts Receivable",
            "Accounts Payable",
            "Logistics Services Revenue",
            "Vendor Expense"
          ]
        }
      })
    });

    if (accounts.length === 0 && organizationId != null) {
      try {
        await prisma.chartOfAccount.createMany({
          data: defaultAccounts.map((account) => ({
            ...account,
            organizationId,
            isActive: true,
          })),
        });
        accounts = await prisma.chartOfAccount.findMany({
          where: chartWhere({
            accountName: {
              in: [
                "Cash",
                "Accounts Receivable",
                "Accounts Payable",
                "Logistics Services Revenue",
                "Vendor Expense"
              ]
            }
          })
        });
      } catch (err) {
        console.error(`Failed to initialize default accounts for organization ${organizationId}:`, err);
      }
    }

    const cashAccount = accounts.find((a: any) => a.accountName === "Cash");
    const accountsReceivable = accounts.find((a: any) => a.accountName === "Accounts Receivable");
    const accountsPayable = accounts.find((a: any) => a.accountName === "Accounts Payable");
    const revenueAccount = accounts.find((a: any) => a.accountName === "Logistics Services Revenue") ||
      accounts.find((a: any) => a.category === "Revenue");
    const expenseAccount = accounts.find((a: any) => a.accountName === "Vendor Expense") ||
      accounts.find((a: any) => a.category === "Expense");

    const writeEntry = async (tx: any) => {
      const entryDate = date ? parseDateInputAsLocalDate(date) : new Date();

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
  organizationId?: number,
  newDate?: Date
) {
  try {
    const oldAmountNum = Number(oldAmount) || 0;
    const newAmountNum = Number(newAmount) || 0;
    const invoiceRecord = invoiceId
      ? await prisma.invoice.findUnique({
          where: { id: invoiceId },
          select: { profile: true, customerId: true, vendorId: true },
        })
      : null;

    const isVendorProfile =
      invoiceRecord?.profile === "Vendor" ||
      (!invoiceRecord?.profile &&
        Boolean((newVendorId || oldVendorId || invoiceRecord?.vendorId) && !(newCustomerId || oldCustomerId || invoiceRecord?.customerId)));

    const updates = [];
    const effectiveCustomerId = newCustomerId || oldCustomerId || invoiceRecord?.customerId || null;
    const effectiveVendorId = newVendorId || oldVendorId || invoiceRecord?.vendorId || null;

    if (!isVendorProfile && effectiveCustomerId) {
      updates.push(
        updateCustomerJournalEntry(
          prisma,
          effectiveCustomerId,
          oldAmountNum,
          newAmountNum,
          invoiceNumber,
          description,
          organizationId,
          newDate
        )
      );
    }

    if (isVendorProfile) {
      updates.push(
        updateVendorJournalEntry(
          prisma,
          effectiveVendorId ?? 0,
          oldAmountNum,
          newAmountNum,
          invoiceNumber,
          description,
          organizationId,
          newDate
        )
      );
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }

    return { 
      customerUpdated: !isVendorProfile && !!effectiveCustomerId,
      vendorUpdated: isVendorProfile
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
  organizationId?: number,
  newDate?: Date
) {
  try {
    const newAmountNum = Number(newAmount) || 0;
    const orgFilter = organizationId != null ? { organizationId } : {};
    const existingEntry = await prisma.journalEntry.findFirst({
      where: {
        ...orgFilter,
        reference: invoiceNumber,
      },
      include: { lines: { include: { account: { select: { code: true } } } } }
    });

    const hasWrongAccountTypes = existingEntry?.lines?.some(
      (l: any) => l.account?.code === "2000" || l.account?.code === "5000"
    );

    if (existingEntry && hasWrongAccountTypes) {
      await prisma.journalEntry.delete({ where: { id: existingEntry.id } });
    }

    if (existingEntry && !hasWrongAccountTypes) {
      if (newAmountNum <= 0) {
        await prisma.journalEntry.delete({
          where: { id: existingEntry.id }
        });
      } else {
        const updateData: any = {
          description: description,
          totalDebit: newAmountNum,
          totalCredit: newAmountNum,
          updatedAt: new Date()
        };
        if (newDate) {
          updateData.date = newDate;
          updateData.postedAt = newDate;
        }

        await prisma.journalEntry.update({
          where: { id: existingEntry.id },
          data: updateData
        });

        for (const line of existingEntry.lines) {
          if (Number(line.debitAmount) > 0 || (line.description && line.description.includes('Debit'))) {
            await prisma.journalEntryLine.update({
              where: { id: line.id },
              data: { debitAmount: newAmountNum }
            });
          } else if (Number(line.creditAmount) > 0 || (line.description && line.description.includes('Credit'))) {
            await prisma.journalEntryLine.update({
              where: { id: line.id },
              data: { creditAmount: newAmountNum }
            });
          }
        }

        if (newDate) {
          await prisma.customerTransaction.updateMany({
            where: {
              ...(organizationId != null ? { organizationId } : {}),
              reference: invoiceNumber,
              type: "DEBIT"
            },
            data: { createdAt: newDate }
          });
        }
      }
    } else if (newAmountNum > 0) {
      const invoice = await prisma.invoice.findFirst({
        where: organizationId != null
          ? { organizationId, invoiceNumber }
          : { invoiceNumber },
        include: { shipment: { select: { shipmentDate: true, trackingId: true } } },
      });
      const entryDate =
        newDate || invoice?.shipment?.shipmentDate || invoice?.invoiceDate || new Date();
      const tracking =
        invoice?.shipment?.trackingId || invoice?.trackingNumber || invoiceNumber;
      await createJournalEntryForTransaction(
        prisma,
        "CUSTOMER_DEBIT",
        newAmountNum,
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
  organizationId?: number,
  newDate?: Date
) {
  try {
    const newAmountNum = Number(newAmount) || 0;
    const orgFilter = organizationId != null ? { organizationId } : {};
    const existingEntry = await prisma.journalEntry.findFirst({
      where: {
        ...orgFilter,
        reference: invoiceNumber,
      },
      include: { lines: { include: { account: { select: { code: true } } } } }
    });

    const hasWrongAccountTypes = existingEntry?.lines?.some(
      (l: any) => l.account?.code === "1200" || l.account?.code === "4000"
    );

    if (existingEntry && hasWrongAccountTypes) {
      await prisma.journalEntry.delete({ where: { id: existingEntry.id } });
    }

    if (existingEntry && !hasWrongAccountTypes) {
      if (newAmountNum <= 0) {
        await prisma.journalEntry.delete({
          where: { id: existingEntry.id }
        });
      } else {
        const updateData: any = {
          description: description,
          totalDebit: newAmountNum,
          totalCredit: newAmountNum,
          updatedAt: new Date()
        };
        if (newDate) {
          updateData.date = newDate;
          updateData.postedAt = newDate;
        }

        await prisma.journalEntry.update({
          where: { id: existingEntry.id },
          data: updateData
        });

        for (const line of existingEntry.lines) {
          if (Number(line.debitAmount) > 0 || (line.description && line.description.includes('Debit'))) {
            await prisma.journalEntryLine.update({
              where: { id: line.id },
              data: { debitAmount: newAmountNum }
            });
          } else if (Number(line.creditAmount) > 0 || (line.description && line.description.includes('Credit'))) {
            await prisma.journalEntryLine.update({
              where: { id: line.id },
              data: { creditAmount: newAmountNum }
            });
          }
        }

        if (newDate) {
          await prisma.vendorTransaction.updateMany({
            where: {
              ...(organizationId != null ? { organizationId } : {}),
              reference: invoiceNumber,
              type: "DEBIT"
            },
            data: { createdAt: newDate }
          });
        }
      }
    } else if (newAmountNum > 0) {
      const invoice = await prisma.invoice.findFirst({
        where: organizationId != null
          ? { organizationId, invoiceNumber }
          : { invoiceNumber },
        include: { shipment: { select: { shipmentDate: true, trackingId: true } } },
      });
      const entryDate =
        newDate || invoice?.shipment?.shipmentDate || invoice?.invoiceDate || new Date();
      const tracking =
        invoice?.shipment?.trackingId || invoice?.trackingNumber || invoiceNumber;
      await createJournalEntryForTransaction(
        prisma,
        "VENDOR_DEBIT",
        newAmountNum,
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
