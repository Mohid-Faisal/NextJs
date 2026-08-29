import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import jwt from "jsonwebtoken"
import { Country, State } from "country-state-city"
import { defaultAccounts } from "@/lib/accounts/defaultAccounts";
import { nextJournalEntryNumber } from "@/lib/tenant/orgJournalChart";
import { getJwtSecretString } from "@/lib/auth/jwtSecret";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function decodeToken(token: string) {
  try {
    // SECURITY: fails closed when JWT_SECRET is not configured (previously
    // fell back to a publicly-known constant, enabling token forgery).
    const decoded = jwt.verify(token, getJwtSecretString());
    return decoded as { id: string; email: string; name: string };
  } catch {
    return null;
  }
}

/**
 * Generate a unique, org-scoped invoice number.
 *
 * Backed by the atomic OrgSequence counter (see lib/sequences.ts) so two
 * concurrent shipments can never receive the same number, and tenants cannot
 * collide with each other (invoiceNumber is unique per organization).
 *
 * Legacy signature `generateInvoiceNumber(prisma)` still works: it falls back
 * to a global sequence key for the platform org. New code should pass an
 * explicit organizationId.
 */
export async function generateInvoiceNumber(
  prismaClient: any,
  organizationId?: number
): Promise<string> {
  const { nextSequenceNumber } = await import("@/lib/sequences");
  const { prisma } = await import("@/lib/prisma");

  const orgId = organizationId ?? 1;
  const key = `invoice_number`;

  // Seed the sequence above any existing numeric invoice numbers for this
  // org (first use after migration only).
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

    // Preserve legacy spacing (+5) and 600000 floor.
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

// Function to generate vendor invoice number (customer invoice + 2)
export function generateVendorInvoiceNumber(customerInvoiceNumber: string): string {
  const customerNumber = parseInt(customerInvoiceNumber, 10);
  if (isNaN(customerNumber)) {
    return "600002";
  }
  const vendorNumber = customerNumber + 2;
  return vendorNumber.toString().padStart(6, "0");
}

// Function to get full country name from country code
export function getCountryNameFromCode(countryCode: string): string {
  if (!countryCode) return '';
  
  const country = Country.getCountryByCode(countryCode.toUpperCase());
  return country ? country.name : countryCode;
}

// Function to get full state name from state code (and country code)
export function getStateNameFromCode(stateCode: string, countryCode: string): string {
  if (!stateCode) return '';
  if (!countryCode) return stateCode;
  const state = State.getStateByCodeAndCountry(stateCode.trim().toUpperCase(), countryCode.toUpperCase());
  return state ? state.name : stateCode;
}

// Financial transaction utilities
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

  // Atomic balance update
  const updatedCustomer = await prisma.customers.update({
    where: { id: customerId },
    data: {
      currentBalance: { increment: delta },
    },
    select: { currentBalance: true },
  });

  const newBalance = updatedCustomer.currentBalance;
  const previousBalance = newBalance - delta;

  // Use provided date or default to current date
  const transactionDate = date ? new Date(date) : new Date();

  // Create transaction record
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
  // For vendors: 
  // - DEBIT means we owe them money (increases their positive balance)
  // - CREDIT means we're paying them (decreases their positive balance)
  const delta = type === 'DEBIT' ? amount : -amount;

  // Atomic balance update
  const updatedVendor = await prisma.vendors.update({
    where: { id: vendorId },
    data: {
      currentBalance: { increment: delta },
    },
    select: { currentBalance: true },
  });

  const newBalance = updatedVendor.currentBalance;
  const previousBalance = newBalance - delta;

  // Use provided date or default to current date
  const transactionDate = date ? new Date(date) : new Date();

  // Create transaction record
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

/** Same format as add-shipment / bulk-upload customer & vendor invoice DEBIT lines */
export function buildShipmentDebitTransactionLineDescription(
  trackingId: string,
  country: string,
  packaging: string,
  weightKg: number
): string {
  return `Tracking: ${trackingId} | Country: ${country} | Type: ${packaging} | Weight: ${weightKg}Kg`;
}

/**
 * Rewrites primary shipment invoice DEBIT rows so metadata edits (weight, country, etc.) show on account transactions.
 * Skips CREDIT-* rows (balance application). Prefers rows whose description starts with "Tracking:".
 */
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

// Invoice balance update utilities
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
  // Get the invoice with customer, vendor, and shipment info
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

  // Handle customer changes
  if (customerChanged) {
    // Remove amount from old customer if exists
    if (oldCustomerId) {
      const oldCustomer = await prisma.customers.findUnique({
        where: { id: oldCustomerId }
      });
      if (oldCustomer) {
        const previousBalance = oldCustomer.currentBalance;
        const newBalance = previousBalance - oldAmount; // Remove the old amount

        await prisma.customers.update({
          where: { id: oldCustomerId },
          data: { currentBalance: newBalance }
        });

        // Create transaction record for removal
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

    // Add amount to new customer if exists
    if (newCustomerId) {
      const newCustomer = await prisma.customers.findUnique({
        where: { id: newCustomerId }
      });
      if (newCustomer) {
        const previousBalance = newCustomer.currentBalance;
        const newBalance = previousBalance + newAmount; // Add the new amount

        await prisma.customers.update({
          where: { id: newCustomerId },
          data: { currentBalance: newBalance }
        });

        // Create transaction record for addition
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
    // Update existing customer balance if amount changed
    const previousBalance = invoice.customer.currentBalance;
    const newBalance = previousBalance - amountDifference; // DEBIT increases with amount

    await prisma.customers.update({
      where: { id: invoice.customerId },
      data: { currentBalance: newBalance }
    });

    // Find and update existing transaction instead of creating new one
    // Search by both reference and invoice fields to handle different formats
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

    // Get shipment date for transaction date
    const transactionDate = invoice.shipment?.shipmentDate || new Date();

    if (existingTransaction) {
      // Update existing transaction
      // For customer invoices, transaction type should always be DEBIT (customer owes us money)
      // regardless of whether amount increased or decreased
      await prisma.customerTransaction.update({
        where: { id: existingTransaction.id },
        data: {
          type: 'DEBIT', // Always DEBIT for customer invoices
          amount: Math.abs(newAmount),
          previousBalance,
          newBalance,
          createdAt: transactionDate // Use shipment date
        }
      });
    } else {
      // Create new transaction if none exists (fallback)
      // For customer invoices, transaction type should always be DEBIT
      await prisma.customerTransaction.create({
        data: {
          customerId: invoice.customerId,
          type: 'DEBIT', // Always DEBIT for customer invoices
          amount: Math.abs(newAmount),
          description: `Invoice ${invoice.invoiceNumber} amount updated from ${oldAmount.toFixed(2)} to ${newAmount.toFixed(2)}`,
          reference: invoice.invoiceNumber, // Use invoice number directly to match shipment format
          invoice: invoice.invoiceNumber,
          previousBalance,
          newBalance,
          createdAt: transactionDate // Use shipment date
        }
      });
    }

    customerUpdated = true;
  }

  // Handle vendor changes
  if (vendorChanged) {
    // Remove amount from old vendor if exists
    if (oldVendorId) {
      const oldVendor = await prisma.vendors.findUnique({
        where: { id: oldVendorId }
      });
      if (oldVendor) {
        const previousBalance = oldVendor.currentBalance;
        const newBalance = previousBalance - oldAmount; // Remove the old amount

        await prisma.vendors.update({
          where: { id: oldVendorId },
          data: { currentBalance: newBalance }
        });

        // Create transaction record for removal
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

    // Add amount to new vendor if exists
    if (newVendorId) {
      const newVendor = await prisma.vendors.findUnique({
        where: { id: newVendorId }
      });
      if (newVendor) {
        const previousBalance = newVendor.currentBalance;
        const newBalance = previousBalance + newAmount; // DEBIT increases vendor balance (we owe them more)

        await prisma.vendors.update({
          where: { id: newVendorId },
          data: { currentBalance: newBalance }
        });

        // Create transaction record for addition
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
    // Update existing vendor balance if amount changed
    // For vendors: DEBIT means we owe them more money (positive balance)
    const previousBalance = invoice.vendor.currentBalance;
    const newBalance = previousBalance + amountDifference; // DEBIT increases vendor balance (we owe them more)

    await prisma.vendors.update({
      where: { id: invoice.vendorId },
      data: { currentBalance: newBalance }
    });

    // Find and update existing transaction instead of creating new one
    // Search by both reference and invoice fields to handle different formats
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

    // Get shipment date for transaction date
    const transactionDate = invoice.shipment?.shipmentDate || new Date();

    if (existingTransaction) {
      // Update existing transaction
      // For vendor invoices, transaction type should always be DEBIT (we owe them money)
      // regardless of whether amount increased or decreased
      await prisma.vendorTransaction.update({
        where: { id: existingTransaction.id },
        data: {
          type: 'DEBIT', // Always DEBIT for vendor invoices
          amount: Math.abs(newAmount),
          previousBalance,
          newBalance,
          createdAt: transactionDate // Use shipment date
        }
      });
    } else {
      // Create new transaction if none exists (fallback)
      // For vendor invoices, transaction type should always be DEBIT
      await prisma.vendorTransaction.create({
        data: {
          vendorId: invoice.vendorId,
          type: 'DEBIT', // Always DEBIT for vendor invoices
          amount: Math.abs(newAmount),
          description: `Invoice ${invoice.invoiceNumber} amount updated from ${oldAmount.toFixed(2)} to ${newAmount.toFixed(2)}`,
          reference: invoice.invoiceNumber, // Use invoice number directly to match shipment format
          invoice: invoice.invoiceNumber,
          previousBalance,
          newBalance,
          createdAt: transactionDate // Use shipment date
        }
      });
    }

    vendorUpdated = true;
  }

  return { customerUpdated, vendorUpdated };
}


// Payment allocation lives in lib/accounts/invoicePayments.ts

// Create journal entry for customer/vendor transactions
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

    // Ensure Chart of Accounts is initialized for this organization
    if (organizationId != null) {
      const existingCount = await prisma.chartOfAccount.count({
        where: { organizationId }
      });
      if (existingCount === 0) {
        console.log(`Initializing default accounts for organization ${organizationId} on the fly...`);
        try {
          await prisma.chartOfAccount.createMany({
            data: defaultAccounts.map((account) => ({
              ...account,
              organizationId,
              isActive: true,
            })),
          });
        } catch (err) {
          console.error(`Failed to initialize default accounts for organization ${organizationId} on the fly:`, err);
        }
      }
    }

    // Do not post zero/invalid amounts — callers should create when the invoice
    // amount becomes > 0 (see updateCustomerJournalEntry create-if-missing).
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

      // Create journal entry lines based on transaction type
      switch (type) {
        case 'CUSTOMER_DEBIT':
          // Customer owes us money: Debit Accounts Receivable, Credit Revenue
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
          // Customer pays us: Debit Cash, Credit Accounts Receivable
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
          // We owe vendor money: Debit Expense, Credit Accounts Payable
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
          // We pay vendor: Debit Accounts Payable, Credit Cash
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
          // Company receives money: Debit Cash, Credit Revenue
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
          // Company pays money: Debit Expense, Credit Cash
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

    // Support being called with an interactive transaction client (no nested $transaction).
    const journalEntry =
      typeof prisma.$transaction === "function"
        ? await prisma.$transaction(writeEntry)
        : await writeEntry(prisma);

    console.log(`Created journal entry ${journalEntry.entryNumber} for ${type} transaction`);
    return journalEntry;
  } catch (error) {
    console.error("Error creating journal entry for transaction:", error);
    throw error;
  }
}

// Update journal entries for invoice modifications
// Update journal entries for invoice modifications
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
    console.log(`Updating journal entries for invoice ${invoiceNumber}:`, {
      oldAmount,
      newAmount,
      oldCustomerId,
      newCustomerId,
      oldVendorId,
      newVendorId
    });

    const updates = [];

    // Handle customer journal entry
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

    // Handle vendor journal entry
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

    // Execute all updates
    if (updates.length > 0) {
      await Promise.all(updates);
      console.log(`Successfully updated journal entries for invoice ${invoiceNumber}`);
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

// Helper function to update customer journal entry
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
      // Update the journal entry if amount or description changed
      await prisma.journalEntry.update({
        where: { id: existingEntry.id },
        data: {
          description: description,
          totalDebit: newAmount,
          totalCredit: newAmount,
          updatedAt: new Date()
        }
      });

      // Update journal entry lines
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
      console.log(`Updated customer journal entry ${existingEntry.entryNumber} for invoice ${invoiceNumber}`);
    } else if (newAmount > 0) {
      // Invoice/ledger exists but revenue was never posted — create it now.
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
      console.log(`Created missing customer journal entry for invoice ${invoiceNumber}`);
    }
  } catch (error) {
    console.error(`Error updating customer journal entry for invoice ${invoiceNumber}:`, error);
    throw error;
  }
}

// Helper function to update vendor journal entry
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
      // Update the journal entry
      await prisma.journalEntry.update({
        where: { id: existingEntry.id },
        data: {
          description: description,
          totalDebit: newAmount,
          totalCredit: newAmount,
          updatedAt: new Date()
        }
      });

      // Update journal entry lines
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
      console.log(`Updated vendor journal entry ${existingEntry.entryNumber} for invoice ${invoiceNumber}`);
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
      console.log(`Created missing vendor journal entry for invoice ${invoiceNumber}`);
    }
  } catch (error) {
    console.error(`Error updating vendor journal entry for invoice ${invoiceNumber}:`, error);
    throw error;
  }
}

// Function to check if a location is a remote area
// Returns an object with isRemote (boolean) and companies (array of company names)
export async function checkRemoteArea(
  prisma: any,
  country: string,
  city?: string,
  zip?: string,
  organizationId?: number
): Promise<{ isRemote: boolean; companies: string[] }> {
  try {
    if (!country) return { isRemote: false, companies: [] };

    // Fetch all remote areas (scoped to org when provided)
    const remoteAreas = await prisma.remoteArea.findMany({
      where: organizationId != null ? { organizationId } : undefined,
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    if (!remoteAreas || remoteAreas.length === 0) return { isRemote: false, companies: [] };

    // Get country name from code
    const selectedCountry = Country.getCountryByCode(country);
    const searchCountryName = selectedCountry?.name || country;
    const searchCountryCode = country.toLowerCase();

    // Filter by country - check country code, country name, and IATA code
    let matchingAreas = remoteAreas.filter((area: any) => {
      const areaCountry = (area.country?.toLowerCase() || '').trim();
      const areaIataCode = (area.iataCode?.toLowerCase() || '').trim();
      const searchCountryNameLower = searchCountryName.toLowerCase();
      
      // Check multiple matching strategies
      return (
        areaCountry === searchCountryCode ||
        areaCountry === searchCountryNameLower ||
        areaIataCode === searchCountryCode ||
        areaCountry.includes(searchCountryNameLower) ||
        searchCountryNameLower.includes(areaCountry)
      );
    });
    
    // If no matches found by country name/code, try matching by IATA code only
    if (matchingAreas.length === 0) {
      matchingAreas = remoteAreas.filter((area: any) => {
        const areaIataCode = (area.iataCode?.toLowerCase() || '').trim();
        return areaIataCode === searchCountryCode;
      });
    }

    if (matchingAreas.length === 0) return { isRemote: false, companies: [] };

    const matchedCompanies = new Set<string>();

    // Check by zip code if provided
    if (zip && zip.trim()) {
      const zipValue = zip.trim();
      const zipNumber = parseFloat(zipValue);
      
      if (!isNaN(zipNumber)) {
        // Check if zip code falls within any range
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
        
        // Also check for string matches
        const stringMatches = matchingAreas.filter((area: any) => {
          const lowStr = String(area.low || '').trim();
          const highStr = String(area.high || '').trim();
          return lowStr.includes(zipValue) || highStr.includes(zipValue);
        });
        
        stringMatches.forEach((area: any) => {
          if (area.company) matchedCompanies.add(area.company);
        });
      } else {
        // String match for zip
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

    // Check by city if provided
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
