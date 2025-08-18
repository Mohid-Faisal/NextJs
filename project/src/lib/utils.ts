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
    const newBalance = previousBalance + amountDifference; // DEBIT increases with amount

    await prisma.customers.update({
      where: { id: invoice.customerId },
      data: { currentBalance: newBalance }
    });

    // Create transaction record
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

    // Create transaction record
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

    vendorUpdated = true;
  }

  return { customerUpdated, vendorUpdated };
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
      reference: invoiceNumber
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
