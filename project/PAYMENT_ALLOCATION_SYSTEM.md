# Payment Allocation System

## Overview

The Payment Allocation System automatically handles excess payments by allocating them to other outstanding invoices for the same customer or vendor. This ensures that overpayments are properly applied to reduce outstanding balances rather than sitting as unused credits.

## Features

### Automatic Allocation
- **Enabled by default**: When processing payments, excess amounts are automatically allocated to other outstanding invoices
- **Oldest first**: Allocations are made to the oldest outstanding invoices first (FIFO - First In, First Out)
- **Status updates**: Invoice statuses are automatically updated to "Paid" or "Partial" based on payment allocation
- **Transaction tracking**: All allocations are recorded as separate transactions with proper references

### Manual Allocation
- **Manual control**: You can disable automatic allocation and manually control where excess payments go
- **Specific targeting**: Allocate to specific invoices rather than oldest first
- **Reallocation**: Reallocate existing credits to different invoices

## How It Works

### Customer Payments
1. **Payment Processing**: Customer makes a payment for an invoice
2. **Amount Calculation**: System calculates how much goes to the target invoice vs. excess
3. **Automatic Allocation**: Excess amount is allocated to other outstanding customer invoices (oldest first)
4. **Status Updates**: All affected invoices have their status updated
5. **Transaction Records**: Separate payment and transaction records are created for each allocation

### Vendor Payments
1. **Payment Processing**: Company makes a payment to a vendor for an invoice
2. **Amount Calculation**: System calculates how much goes to the target invoice vs. excess
3. **Automatic Allocation**: Excess amount is allocated to other outstanding vendor invoices (oldest first)
4. **Status Updates**: All affected invoices have their status updated
5. **Transaction Records**: Separate payment and transaction records are created for each allocation

## API Endpoints

### Process Payment with Allocation
```
POST /api/accounts/payments/process
```

**Parameters:**
- `invoiceNumber`: Target invoice number
- `paymentAmount`: Amount being paid
- `paymentType`: "CUSTOMER_PAYMENT" or "VENDOR_PAYMENT"
- `paymentMethod`: Payment method (CASH, BANK_TRANSFER, etc.)
- `reference`: Payment reference number
- `description`: Payment description
- `debitAccountId`: Chart of accounts debit account
- `creditAccountId`: Chart of accounts credit account
- `enableAllocation`: Boolean (default: true) - Enable/disable automatic allocation

**Response:**
```json
{
  "success": true,
  "message": "Payment processed successfully with automatic allocation",
  "payment": { ... },
  "invoice": { ... },
  "allocation": {
    "allocations": [
      {
        "invoiceNumber": "INV-002",
        "amount": 500.00,
        "status": "Paid"
      }
    ],
    "remainingUnallocated": 0,
    "totalAllocated": 500.00
  }
}
```

### Manual Allocation
```
POST /api/accounts/payments/allocate
```

**Parameters:**
- `customerId`: Customer ID (for customer payments)
- `vendorId`: Vendor ID (for vendor payments)
- `excessAmount`: Amount to allocate
- `originalInvoiceNumber`: Original invoice that had excess payment
- `paymentReference`: Reference for tracking
- `paymentType`: "CUSTOMER_PAYMENT" or "VENDOR_PAYMENT"

### Get Outstanding Invoices
```
GET /api/accounts/payments/allocate?customerId=123&paymentType=CUSTOMER_PAYMENT
```

**Response:**
```json
{
  "success": true,
  "outstandingInvoices": [
    {
      "invoiceNumber": "INV-002",
      "totalAmount": 1000.00,
      "remainingAmount": 500.00,
      "status": "Partial",
      "invoiceDate": "2024-01-15T00:00:00.000Z"
    }
  ]
}
```

## Database Changes

### New Utility Functions
- `allocateExcessPayment()`: Handles automatic allocation logic
- `processPaymentWithAllocation()`: Enhanced payment processing with allocation
- Updated `updateInvoiceBalance()`: Now updates existing transactions instead of creating new ones

### Transaction Records
- **Main Payment**: Original payment record for the target invoice
- **Allocation Payments**: Separate payment records for each allocated amount (for tracking)
- **Single Customer/Vendor Transaction**: One comprehensive transaction record covering the entire payment amount with detailed description
- **Journal Entries**: Proper accounting entries for all transactions

## Example Scenarios

### Scenario 1: Customer Overpayment
1. Customer has Invoice A ($500) and Invoice B ($300) outstanding
2. Customer pays $800 for Invoice A
3. System allocates:
   - $500 to Invoice A (fully paid)
   - $300 to Invoice B (fully paid)
4. Result: Both invoices marked as "Paid"
5. **Transaction Record**: Single credit transaction for $800 with description: "Payment for invoice 420010 and excess allocation to invoice 420005 (300.00)"

### Scenario 2: Partial Allocation
1. Customer has Invoice A ($500) and Invoice B ($1000) outstanding
2. Customer pays $800 for Invoice A
3. System allocates:
   - $500 to Invoice A (fully paid)
   - $300 to Invoice B (partial payment)
4. Result: Invoice A = "Paid", Invoice B = "Partial"
5. **Transaction Record**: Single credit transaction for $800 with description: "Payment for invoice 420010 and excess allocation to invoice 420005 (300.00)"

### Scenario 3: Vendor Overpayment
1. Company owes Vendor X for Invoice A ($400) and Invoice B ($600)
2. Company pays $800 for Invoice A
3. System allocates:
   - $400 to Invoice A (fully paid)
   - $400 to Invoice B (partial payment)
4. Result: Invoice A = "Paid", Invoice B = "Partial"
5. **Transaction Record**: Single credit transaction for $800 with description: "Payment for invoice 420010 and excess allocation to invoice 420005 (400.00)"

## Configuration

### Enable/Disable Automatic Allocation
```javascript
// Enable automatic allocation (default)
{
  "enableAllocation": true
}

// Disable automatic allocation
{
  "enableAllocation": false
}
```

### Manual Allocation Control
When automatic allocation is disabled, you can:
1. Process payments normally (excess becomes credit)
2. Use the manual allocation endpoint to allocate credits later
3. Have full control over which invoices receive allocations

## Benefits

1. **Improved Cash Flow**: Excess payments immediately reduce outstanding balances
2. **Better Customer/Vendor Relations**: Faster resolution of outstanding invoices
3. **Accurate Reporting**: Real-time invoice status updates
4. **Audit Trail**: Complete transaction history for all allocations
5. **Flexibility**: Can be enabled/disabled based on business needs
6. **Automation**: Reduces manual work in payment processing

## Integration with Frontend

The frontend can:
1. **Show allocation results**: Display which invoices were affected by excess payments
2. **Provide allocation options**: Show outstanding invoices for manual allocation
3. **Toggle allocation**: Allow users to enable/disable automatic allocation
4. **Display status updates**: Show real-time invoice status changes

## Error Handling

The system handles various error scenarios:
- Invalid invoice numbers
- Missing customer/vendor associations
- Insufficient outstanding invoices for allocation
- Database transaction failures
- Invalid payment amounts

All errors are properly logged and returned with meaningful error messages.
