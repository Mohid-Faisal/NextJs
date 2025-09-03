import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import jwt from "jsonwebtoken"
import { Country } from "country-state-city"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function decodeToken(token: string) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    return decoded as { id: string; email: string; name: string };
  } catch (error) {
    return null;
  }
}

// Function to generate unique invoice numbers
export async function generateInvoiceNumber(prisma: any): Promise<string> {
  // Get the highest invoice number from the database
  const lastShipment = await prisma.shipment.findFirst({
    orderBy: {
      invoiceNumber: 'desc'
    },
    select: {
      invoiceNumber: true
    }
  });

  let nextNumber: number;

  if (lastShipment && lastShipment.invoiceNumber) {
    // Extract the numeric part and increment by 5
    const currentNumber = parseInt(lastShipment.invoiceNumber, 10);
    nextNumber = currentNumber + 5;
  } else {
    // Start from 420000 if no shipments exist
    nextNumber = 420000;
  }

  // Format as 6-digit string with leading zeros
  return nextNumber.toString().padStart(6, '0');
}

// Function to generate vendor invoice number (customer invoice + 2)
export function generateVendorInvoiceNumber(customerInvoiceNumber: string): string {
  const customerNumber = parseInt(customerInvoiceNumber, 10);
  const vendorNumber = customerNumber + 2;
  return vendorNumber.toString().padStart(6, '0');
}

// Function to get full country name from country code
export function getCountryNameFromCode(countryCode: string): string {
  if (!countryCode) return '';
  
  const country = Country.getCountryByCode(countryCode.toUpperCase());
  return country ? country.name : countryCode;
}

// Financial transaction utilities
export async function addCustomerTransaction(
  prisma: any,
  customerId: number,
  type: 'CREDIT' | 'DEBIT',
  amount: number,
  description: string,
  reference?: string,
  invoice?: string
) {
  const customer = await prisma.customers.findUnique({
    where: { id: customerId }
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  const previousBalance = customer.currentBalance;
  const newBalance = type === 'CREDIT' 
    ? previousBalance + amount 
    : previousBalance - amount;

  // Update customer balance
  await prisma.customers.update({
    where: { id: customerId },
    data: { currentBalance: newBalance }
  });

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
      newBalance
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
  invoice?: string
) {
  const vendor = await prisma.vendors.findUnique({
    where: { id: vendorId }
  });

  if (!vendor) {
    throw new Error('Vendor not found');
  }

  const previousBalance = vendor.currentBalance;
  
  // For vendors: 
  // - DEBIT means we owe them money (increases their positive balance)
  // - CREDIT means we're paying them (decreases their positive balance)
  const newBalance = type === 'DEBIT' 
    ? previousBalance + amount  // We owe them more
    : previousBalance - amount; // We're paying them

  // Update vendor balance
  await prisma.vendors.update({
    where: { id: vendorId },
    data: { currentBalance: newBalance }
  });

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
      newBalance
    }
  });

  return { previousBalance, newBalance };
}

export async function addCompanyTransaction(
  prisma: any,
  type: 'CREDIT' | 'DEBIT',
  amount: number,
  description: string,
  reference?: string,
  invoice?: string
) {
  // Get or create company account
  let companyAccount = await prisma.companyAccount.findFirst();
  
  if (!companyAccount) {
    companyAccount = await prisma.companyAccount.create({
      data: {
        name: "Main Company Account",
        currentBalance: 0
      }
    });
  }

  const previousBalance = companyAccount.currentBalance;
  const newBalance = type === 'CREDIT' 
    ? previousBalance + amount 
    : previousBalance - amount;

  // Update company balance
  await prisma.companyAccount.update({
    where: { id: companyAccount.id },
    data: { currentBalance: newBalance }
  });

  // Create transaction record
  await prisma.companyTransaction.create({
    data: {
      accountId: companyAccount.id,
      type,
      amount,
      description,
      reference,
      invoice,
      previousBalance,
      newBalance
    }
  });

  return { previousBalance, newBalance };
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
  // Get the invoice with customer and vendor info
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      vendor: true
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
        await prisma.customerTransaction.create({
          data: {
            customerId: oldCustomerId,
            type: 'CREDIT',
            amount: oldAmount,
            description: `Invoice ${invoice.invoiceNumber} reassigned from customer`,
            reference: `Invoice: ${invoice.invoiceNumber}`,
            previousBalance,
            newBalance
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
        await prisma.customerTransaction.create({
          data: {
            customerId: newCustomerId,
            type: 'DEBIT',
            amount: newAmount,
            description: `Invoice ${invoice.invoiceNumber} assigned to customer`,
            reference: `Invoice: ${invoice.invoiceNumber}`,
            previousBalance,
            newBalance
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
    const existingTransaction = await prisma.customerTransaction.findFirst({
      where: {
        customerId: invoice.customerId,
        reference: invoice.invoiceNumber
      }
    });

    if (existingTransaction) {
      // Update existing transaction
      await prisma.customerTransaction.update({
        where: { id: existingTransaction.id },
        data: {
          type: amountDifference > 0 ? 'DEBIT' : 'CREDIT',
          amount: Math.abs(newAmount),
          previousBalance,
          newBalance
        }
      });
    } else {
      // Create new transaction if none exists (fallback)
      await prisma.customerTransaction.create({
        data: {
          customerId: invoice.customerId,
          type: amountDifference > 0 ? 'DEBIT' : 'CREDIT',
          amount: Math.abs(amountDifference),
          description: `Invoice ${invoice.invoiceNumber} amount updated from ${oldAmount.toFixed(2)} to ${newAmount.toFixed(2)}`,
          reference: `Invoice: ${invoice.invoiceNumber}`,
          previousBalance,
          newBalance
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
    const existingTransaction = await prisma.vendorTransaction.findFirst({
      where: {
        vendorId: invoice.vendorId,
        reference: invoice.invoiceNumber
      }
    });

    if (existingTransaction) {
      // Update existing transaction
      await prisma.vendorTransaction.update({
        where: { id: existingTransaction.id },
        data: {
          type: amountDifference > 0 ? 'DEBIT' : 'CREDIT',
          amount: Math.abs(newAmount),
          previousBalance,
          newBalance
        }
      });
    } else {
      // Create new transaction if none exists (fallback)
      await prisma.vendorTransaction.create({
        data: {
          vendorId: invoice.vendorId,
          type: amountDifference > 0 ? 'DEBIT' : 'CREDIT',
          amount: Math.abs(amountDifference),
          description: `Invoice ${invoice.invoiceNumber} amount updated from ${oldAmount.toFixed(2)} to ${newAmount.toFixed(2)}`,
          reference: `Invoice: ${invoice.invoiceNumber}`,
          previousBalance,
          newBalance
        }
      });
    }

    vendorUpdated = true;
  }

  return { customerUpdated, vendorUpdated };
}

// Payment allocation utilities for excess payments
export async function allocateExcessPayment(
  prisma: any,
  customerId: number | null,
  vendorId: number | null,
  excessAmount: number,
  originalInvoiceNumber: string,
  paymentReference: string,
  paymentType: 'CUSTOMER_PAYMENT' | 'VENDOR_PAYMENT'
) {
  const allocations: Array<{
    invoiceNumber: string;
    amount: number;
    status: string;
  }> = [];

  let remainingAmount = excessAmount;

  if (paymentType === 'CUSTOMER_PAYMENT' && customerId) {
    // Find outstanding customer invoices (oldest first)
    const outstandingInvoices = await prisma.invoice.findMany({
      where: {
        customerId: customerId,
        status: { in: ['Pending', 'Partial'] },
        invoiceNumber: { not: originalInvoiceNumber } // Exclude the original invoice
      },
      orderBy: { invoiceDate: 'asc' }, // Oldest first
      include: {
        customer: true
      }
    });

    // Calculate remaining amounts for each invoice
    for (const invoice of outstandingInvoices) {
      if (remainingAmount <= 0) break;

      const totalPaid = await prisma.payment.aggregate({
        where: {
          invoice: invoice.invoiceNumber,
          transactionType: 'INCOME'
        },
        _sum: { amount: true }
      });

      const alreadyPaid = totalPaid._sum.amount || 0;
      const remainingInvoiceAmount = Math.max(0, invoice.totalAmount - alreadyPaid);

      if (remainingInvoiceAmount > 0) {
        const allocationAmount = Math.min(remainingAmount, remainingInvoiceAmount);
        
        // Create payment record for this allocation
        await prisma.payment.create({
          data: {
            transactionType: 'INCOME',
            category: 'Customer Payment Allocation',
            date: new Date(),
            amount: allocationAmount,
            fromPartyType: 'CUSTOMER',
            fromCustomerId: customerId,
            fromCustomer: invoice.customer?.CompanyName || '',
            toPartyType: 'US',
            toVendor: '',
            mode: 'CASH', // Default mode for allocations
            reference: `${paymentReference}-ALLOC`,
            invoice: invoice.invoiceNumber,
            description: `Excess payment allocation from invoice ${originalInvoiceNumber}`
          }
        });

        // Note: Customer transaction will be created in the main payment processing
        // This allocation just updates the invoice status and creates payment record

        // Update invoice status
        const newTotalPaid = alreadyPaid + allocationAmount;
        const newStatus = newTotalPaid >= invoice.totalAmount ? 'Paid' : 'Partial';
        
        await prisma.invoice.update({
          where: { invoiceNumber: invoice.invoiceNumber },
          data: { status: newStatus }
        });

        allocations.push({
          invoiceNumber: invoice.invoiceNumber,
          amount: allocationAmount,
          status: newStatus
        });

        remainingAmount -= allocationAmount;
      }
    }
  } else if (paymentType === 'VENDOR_PAYMENT' && vendorId) {
    // Find outstanding vendor invoices (oldest first)
    const outstandingInvoices = await prisma.invoice.findMany({
      where: {
        vendorId: vendorId,
        status: { in: ['Pending', 'Partial'] },
        invoiceNumber: { not: originalInvoiceNumber } // Exclude the original invoice
      },
      orderBy: { invoiceDate: 'asc' }, // Oldest first
      include: {
        vendor: true
      }
    });

    // Calculate remaining amounts for each invoice
    for (const invoice of outstandingInvoices) {
      if (remainingAmount <= 0) break;

      const totalPaid = await prisma.payment.aggregate({
        where: {
          invoice: invoice.invoiceNumber,
          transactionType: 'EXPENSE'
        },
        _sum: { amount: true }
      });

      const alreadyPaid = totalPaid._sum.amount || 0;
      const remainingInvoiceAmount = Math.max(0, invoice.totalAmount - alreadyPaid);

      if (remainingInvoiceAmount > 0) {
        const allocationAmount = Math.min(remainingAmount, remainingInvoiceAmount);
        
        // Create payment record for this allocation
        await prisma.payment.create({
          data: {
            transactionType: 'EXPENSE',
            category: 'Vendor Payment Allocation',
            date: new Date(),
            amount: allocationAmount,
            fromPartyType: 'US',
            fromCustomer: '',
            toPartyType: 'VENDOR',
            toVendorId: vendorId,
            toVendor: invoice.vendor?.CompanyName || '',
            mode: 'CASH', // Default mode for allocations
            reference: `${paymentReference}-ALLOC`,
            invoice: invoice.invoiceNumber,
            description: `Excess payment allocation from invoice ${originalInvoiceNumber}`
          }
        });

        // Note: Vendor transaction will be created in the main payment processing
        // This allocation just updates the invoice status and creates payment record

        // Update invoice status
        const newTotalPaid = alreadyPaid + allocationAmount;
        const newStatus = newTotalPaid >= invoice.totalAmount ? 'Paid' : 'Partial';
        
        await prisma.invoice.update({
          where: { invoiceNumber: invoice.invoiceNumber },
          data: { status: newStatus }
        });

        allocations.push({
          invoiceNumber: invoice.invoiceNumber,
          amount: allocationAmount,
          status: newStatus
        });

        remainingAmount -= allocationAmount;
      }
    }
  }

  return {
    allocations,
    remainingUnallocated: remainingAmount,
    totalAllocated: excessAmount - remainingAmount
  };
}

// Enhanced payment processing with automatic allocation
export async function processPaymentWithAllocation(
  prisma: any,
  invoiceNumber: string,
  paymentAmount: number,
  paymentType: 'CUSTOMER_PAYMENT' | 'VENDOR_PAYMENT',
  paymentMethod: string,
  reference: string,
  description?: string,
  paymentDate?: string,
  debitAccountId?: number,
  creditAccountId?: number
) {
  // Find the invoice
  const invoice = await prisma.invoice.findUnique({
    where: { invoiceNumber },
    include: {
      customer: true,
      vendor: true
    }
  });

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const paymentAmountNum = parseFloat(paymentAmount.toString());
  let allocationResult = null;

  if (paymentType === "CUSTOMER_PAYMENT") {
    if (!invoice.customerId) {
      throw new Error('This invoice is not associated with a customer');
    }

    // Calculate how much is still owed on this invoice
    const totalPaidSoFar = await prisma.payment.aggregate({
      where: {
        invoice: invoiceNumber,
        transactionType: "INCOME"
      },
      _sum: { amount: true }
    });

    const alreadyPaid = totalPaidSoFar._sum.amount || 0;
    const remainingAmount = Math.max(0, invoice.totalAmount - alreadyPaid);
    
    // Determine how much goes to the invoice and how much becomes excess
    const amountForInvoice = Math.min(paymentAmountNum, remainingAmount);
    const overpaymentAmount = Math.max(0, paymentAmountNum - remainingAmount);

    // If there's an overpayment, allocate it to other invoices first
    if (overpaymentAmount > 0) {
      allocationResult = await allocateExcessPayment(
        prisma,
        invoice.customerId,
        null,
        overpaymentAmount,
        invoiceNumber,
        reference,
        'CUSTOMER_PAYMENT'
      );
    }

    // Create a single comprehensive customer transaction for the entire payment
    if (paymentAmountNum > 0) {
      let transactionDescription = description || `Payment for invoice ${invoiceNumber}`;
      
      // Add allocation details to the description if there were allocations
      if (allocationResult && allocationResult.allocations.length > 0) {
        const allocationDetails = allocationResult.allocations
          .map(alloc => `invoice ${alloc.invoiceNumber} (${alloc.amount.toFixed(2)})`)
          .join(', ');
        transactionDescription += ` and excess allocation to ${allocationDetails}`;
      }

      await addCustomerTransaction(
        prisma,
        invoice.customerId,
        'CREDIT',
        paymentAmountNum,
        transactionDescription,
        reference,
        invoiceNumber
      );
    }

  } else if (paymentType === "VENDOR_PAYMENT") {
    if (!invoice.vendorId) {
      throw new Error('This invoice is not associated with a vendor');
    }

    // Calculate how much is still owed on this invoice
    const totalPaidSoFar = await prisma.payment.aggregate({
      where: {
        invoice: invoiceNumber,
        transactionType: "EXPENSE"
      },
      _sum: { amount: true }
    });

    const alreadyPaid = totalPaidSoFar._sum.amount || 0;
    const remainingAmount = Math.max(0, invoice.totalAmount - alreadyPaid);
    
    // Determine how much goes to the invoice and how much becomes excess
    const amountForInvoice = Math.min(paymentAmountNum, remainingAmount);
    const overpaymentAmount = Math.max(0, paymentAmountNum - remainingAmount);

    // If there's an overpayment, allocate it to other invoices first
    if (overpaymentAmount > 0) {
      allocationResult = await allocateExcessPayment(
        prisma,
        null,
        invoice.vendorId,
        overpaymentAmount,
        invoiceNumber,
        reference,
        'VENDOR_PAYMENT'
      );
    }

    // Create a single comprehensive vendor transaction for the entire payment
    if (paymentAmountNum > 0) {
      let transactionDescription = description || `Payment for invoice ${invoiceNumber}`;
      
      // Add allocation details to the description if there were allocations
      if (allocationResult && allocationResult.allocations.length > 0) {
        const allocationDetails = allocationResult.allocations
          .map(alloc => `invoice ${alloc.invoiceNumber} (${alloc.amount.toFixed(2)})`)
          .join(', ');
        transactionDescription += ` and excess allocation to ${allocationDetails}`;
      }

      await addVendorTransaction(
        prisma,
        invoice.vendorId,
        'CREDIT',
        paymentAmountNum,
        transactionDescription,
        reference,
        invoiceNumber
      );
    }
  }

  // Create main payment record
  const payment = await prisma.payment.create({
    data: {
      transactionType: paymentType === "CUSTOMER_PAYMENT" ? "INCOME" : "EXPENSE",
      category: paymentType === "CUSTOMER_PAYMENT" ? "Customer Payment" : "Vendor Payment",
      date: paymentDate ? new Date(paymentDate) : new Date(),
      amount: paymentAmountNum,
      fromPartyType: paymentType === "CUSTOMER_PAYMENT" ? "CUSTOMER" : "US",
      fromCustomerId: paymentType === "CUSTOMER_PAYMENT" ? invoice.customerId : null,
      fromCustomer: paymentType === "CUSTOMER_PAYMENT" ? invoice.customer?.CompanyName || "" : "",
      toPartyType: paymentType === "CUSTOMER_PAYMENT" ? "US" : "VENDOR",
      toVendorId: paymentType === "VENDOR_PAYMENT" ? invoice.vendorId : null,
      toVendor: paymentType === "VENDOR_PAYMENT" ? invoice.vendor?.CompanyName || "" : "",
      mode: paymentMethod || "CASH",
      reference: reference,
      invoice: invoiceNumber,
      description: description || `Payment for invoice ${invoiceNumber}`
    }
  });

  // Calculate invoice payment status and update
  const paymentStatus = await calculateInvoicePaymentStatus(
    prisma,
    invoiceNumber,
    invoice.totalAmount
  );

  // Update invoice status based on total payments
  await prisma.invoice.update({
    where: { invoiceNumber },
    data: { 
      status: paymentStatus.status
    }
  });

  return {
    payment,
    invoice: {
      invoiceNumber: invoice.invoiceNumber,
      status: paymentStatus.status,
      totalPaid: paymentStatus.totalPaid,
      remainingAmount: paymentStatus.remainingAmount,
      totalAmount: paymentStatus.totalAmount
    },
    allocation: allocationResult
  };
}

// Invoice payment status utility
export async function calculateInvoicePaymentStatus(
  prisma: any,
  invoiceNumber: string,
  invoiceAmount: number
) {
  // Calculate total payments for this invoice
  const totalPayments = await prisma.payment.aggregate({
    where: {
      invoice: invoiceNumber
    },
    _sum: {
      amount: true
    }
  });

  const totalPaid = totalPayments._sum.amount || 0;
  const remainingAmount = Math.max(0, invoiceAmount - totalPaid);
  
  // Determine invoice status based on total payments
  let status = "Pending";
  if (totalPaid >= invoiceAmount) {
    status = "Paid";
  } else if (totalPaid > 0) {
    status = "Partial";
  }

  return {
    status,
    totalPaid,
    remainingAmount,
    totalAmount: invoiceAmount
  };
}

// Create journal entry for customer/vendor transactions
export async function createJournalEntryForTransaction(
  prisma: any,
  type: 'CUSTOMER_DEBIT' | 'CUSTOMER_CREDIT' | 'VENDOR_DEBIT' | 'VENDOR_CREDIT' | 'COMPANY_DEBIT' | 'COMPANY_CREDIT',
  amount: number,
  description: string,
  reference?: string,
  invoice?: string
) {
  try {
    // Generate journal entry number
    const lastEntry = await prisma.journalEntry.findFirst({
      orderBy: { entryNumber: "desc" }
    });

    let entryNumber = "JE-0001";
    if (lastEntry) {
      const lastNumber = parseInt(lastEntry.entryNumber.split("-")[1]);
      entryNumber = `JE-${String(lastNumber + 1).padStart(4, "0")}`;
    }

    // Get chart of accounts
    const cashAccount = await prisma.chartOfAccount.findFirst({
      where: { accountName: "Cash" }
    });

    const accountsReceivable = await prisma.chartOfAccount.findFirst({
      where: { accountName: "Accounts Receivable" }
    });

    const accountsPayable = await prisma.chartOfAccount.findFirst({
      where: { accountName: "Accounts Payable" }
    });

    const revenueAccount = await prisma.chartOfAccount.findFirst({
      where: { 
        category: "Revenue",
        accountName: "Logistics Services Revenue"
      }
    });

    const expenseAccount = await prisma.chartOfAccount.findFirst({
      where: { 
        category: "Expense",
        accountName: "Vendor Expense"
      }
    });

    // Create journal entry with lines
    const journalEntry = await prisma.$transaction(async (tx: any) => {
      // Create the journal entry
      const entry = await tx.journalEntry.create({
        data: {
          entryNumber,
          date: new Date(),
          description: description,
          reference: reference || `Transaction-${Date.now()}`,
          totalDebit: amount,
          totalCredit: amount,
          isPosted: true,
          postedAt: new Date()
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
    });

    console.log(`Created journal entry ${journalEntry.entryNumber} for ${type} transaction`);
    return journalEntry;
  } catch (error) {
    console.error("Error creating journal entry for transaction:", error);
    throw error;
  }
}

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
  description: string
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

    // If amounts haven't changed and customer/vendor IDs haven't changed, no need to update
    if (oldAmount === newAmount && 
        oldCustomerId === newCustomerId && 
        oldVendorId === newVendorId) {
      console.log(`No changes detected for invoice ${invoiceNumber}, skipping journal entry updates`);
      return { customerUpdated: false, vendorUpdated: false };
    }

    const updates = [];

    // Update customer journal entry if customer ID or amount changed
    if (oldCustomerId !== newCustomerId || oldAmount !== newAmount) {
      if (oldCustomerId) {
        // Update existing customer journal entry
        updates.push(updateCustomerJournalEntry(
          prisma,
          oldCustomerId,
          oldAmount,
          newAmount,
          invoiceNumber,
          description
        ));
      }
      if (newCustomerId && newCustomerId !== oldCustomerId) {
        // Create new customer journal entry
        updates.push(createJournalEntryForTransaction(
          prisma,
          'CUSTOMER_DEBIT',
          newAmount,
          description,
          invoiceNumber,
          invoiceNumber
        ));
      }
    }

    // Update vendor journal entry if vendor ID or amount changed
    if (oldVendorId !== newVendorId || oldAmount !== newAmount) {
      if (oldVendorId) {
        // Update existing vendor journal entry
        updates.push(updateVendorJournalEntry(
          prisma,
          oldVendorId,
          oldAmount,
          newAmount,
          invoiceNumber,
          description
        ));
      }
      if (newVendorId && newVendorId !== oldVendorId) {
        // Create new vendor journal entry
        updates.push(createJournalEntryForTransaction(
          prisma,
          'VENDOR_DEBIT',
          newAmount,
          description,
          invoiceNumber,
          invoiceNumber
        ));
      }
    }

    // Execute all updates
    if (updates.length > 0) {
      await Promise.all(updates);
      console.log(`Successfully updated journal entries for invoice ${invoiceNumber}`);
    }

    return { 
      customerUpdated: oldCustomerId !== newCustomerId || oldAmount !== newAmount,
      vendorUpdated: oldVendorId !== newVendorId || oldAmount !== newAmount
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
  description: string
) {
  try {
    // Find existing journal entry for this customer invoice
    const existingEntry = await prisma.journalEntry.findFirst({
      where: {
        OR: [
          { reference: invoiceNumber },
          { description: { contains: invoiceNumber } }
        ]
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
      console.log(`Updated customer journal entry ${existingEntry.entryNumber} for invoice ${invoiceNumber}`);
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
  description: string
) {
  try {
    console.log(invoiceNumber);
    // Find existing journal entry for this vendor invoice
    const existingEntry = await prisma.journalEntry.findFirst({
      where: {
        OR: [
          { reference: invoiceNumber },
          { description: { contains: invoiceNumber } }
        ]
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
      console.log(existingEntry);
      console.log(`Updated vendor journal entry ${existingEntry.entryNumber} for invoice ${invoiceNumber}`);
    }
  } catch (error) {
    console.error(`Error updating vendor journal entry for invoice ${invoiceNumber}:`, error);
    throw error;
  }
}
