# Payment System Integration with Chart of Accounts and Journal System

## Overview
This document describes the integration of the payment system with the chart of accounts and journal entry system to ensure proper double-entry bookkeeping and financial tracking.

## Changes Made

### 1. Add Payment Page (`src/app/dashboard/accounts/payments/add/page.tsx`)
- **Added Chart of Accounts Integration**: 
  - Added fields for selecting debit and credit accounts
  - Fetches chart of accounts from the API
  - Sets default accounts based on transaction type
  - Validates that both debit and credit accounts are selected

- **Default Account Mapping**:
  - **Expense**: Debit Expense account (Fuel Costs/Operations), Credit Cash account
  - **Transfer**: Debit destination account (Bank), Credit source account (Cash)
  - **Return**: Debit Cash account, Credit Accounts Receivable

- **Form Updates**:
  - Added debit and credit account selection dropdowns
  - Updated payload to include `debitAccountId` and `creditAccountId`
  - Added validation for chart of accounts selection

### 2. Payment API (`src/app/api/accounts/payments/route.ts`)
- **Replaced Simple Transaction System**: 
  - Removed `addCompanyTransaction` calls
  - Added `createJournalEntryForPayment` function
  - Creates proper double-entry journal entries

- **Journal Entry Creation**:
  - Generates unique journal entry numbers (JE-0001, JE-0002, etc.)
  - Creates two journal entry lines: one debit, one credit
  - Auto-posts payment journal entries
  - Links journal entries to payments via reference field

- **Validation**:
  - Added validation for required debit and credit accounts
  - Ensures proper double-entry bookkeeping

### 3. Payment Process Page (`src/app/dashboard/accounts/payments/process/page.tsx`)
- **Added Chart of Accounts Integration**:
  - Added fields for selecting debit and credit accounts
  - Fetches chart of accounts from the API
  - Sets default accounts for invoice payments

- **Default Account Mapping for Invoice Payments**:
  - **Customer Payment**: Debit Accounts Receivable, Credit Cash
  - **Vendor Payment**: Debit appropriate expense account, Credit Cash

- **Form Updates**:
  - Added debit and credit account selection dropdowns
  - Updated payload to include chart of accounts information
  - Added validation for chart of accounts selection

### 4. Payment Process API (`src/app/api/accounts/payments/process/route.ts`)
- **Replaced Simple Transaction System**:
  - Removed `addCompanyTransaction` calls
  - Added `createJournalEntryForPaymentProcess` function
  - Creates proper double-entry journal entries for invoice payments

- **Journal Entry Creation**:
  - Generates unique journal entry numbers
  - Creates two journal entry lines: one debit, one credit
  - Auto-posts payment journal entries
  - Links journal entries to payments via reference field

### 5. Payments List Page (`src/app/dashboard/accounts/payments/page.tsx`)
- **Added Journal Entry Display**:
  - Added "Journal Entry" column to the payments table
  - Shows journal entry number for each payment
  - Clickable links to view related journal entries
  - Navigates to journal entries page with search filter

- **API Integration**:
  - Updated payments API to include journal entry information
  - Finds related journal entries by matching reference field
  - Displays journal entry numbers in the UI

## Database Schema Requirements

The integration relies on the following database models:

### Payment Model
```prisma
model Payment {
  id              Int              @id @default(autoincrement())
  transactionType TransactionType
  category        String
  date            DateTime
  amount          Float
  fromPartyType   PartyType
  fromCustomerId  Int?
  fromCustomer    String
  toPartyType     PartyType
  toVendorId      Int?
  toVendor        String
  mode            PaymentMode?
  reference       String?
  invoice         String?
  description     String?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
}
```

### JournalEntry Model
```prisma
model JournalEntry {
  id              Int      @id @default(autoincrement())
  entryNumber     String   @unique
  date            DateTime
  description     String
  reference       String?
  totalDebit      Float
  totalCredit     Float
  isPosted        Boolean  @default(false)
  postedAt        DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  lines           JournalEntryLine[]
}
```

### JournalEntryLine Model
```prisma
model JournalEntryLine {
  id              Int      @id @default(autoincrement())
  journalEntryId  Int
  accountId       Int
  debitAmount     Float    @default(0)
  creditAmount    Float    @default(0)
  description     String?
  reference       String?
  createdAt       DateTime @default(now())
  journalEntry    JournalEntry @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)
  account         ChartOfAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
}
```

### ChartOfAccount Model
```prisma
model ChartOfAccount {
  id          Int      @id @default(autoincrement())
  code        String   @unique
  accountName String
  category    String
  type        String
  debitRule   String
  creditRule  String
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  journalLines JournalEntryLine[]
}
```

## Key Features

### 1. Double-Entry Bookkeeping
- Every payment creates exactly two journal entry lines
- Total debits always equal total credits
- Proper account categorization based on transaction type

### 2. Automatic Journal Entry Creation
- Journal entries are created automatically when payments are processed
- Auto-posted to ensure immediate availability in financial reports
- Linked to payments via reference field for traceability

### 3. Default Account Mapping
- Intelligent default account selection based on transaction type
- Users can override defaults if needed
- Ensures proper accounting treatment

### 4. Traceability
- Payments are linked to journal entries via reference field
- Users can view related journal entries from payment list
- Full audit trail from payment to journal entry to chart of accounts

### 5. Validation
- Ensures both debit and credit accounts are selected
- Validates double-entry bookkeeping rules
- Prevents creation of unbalanced entries

## Usage Examples

### Creating an Expense Payment
1. Select transaction type: "Expense"
2. Choose debit account: "Fuel Costs" (4201)
3. Choose credit account: "Cash" (1101)
4. Enter amount and other details
5. System creates journal entry:
   - Debit: Fuel Costs $100
   - Credit: Cash $100

### Processing Customer Payment
1. Select invoice for customer payment
2. Choose debit account: "Accounts Receivable" (1102)
3. Choose credit account: "Cash" (1101)
4. Enter payment amount
5. System creates journal entry:
   - Debit: Accounts Receivable $500
   - Credit: Cash $500

### Transfer Between Accounts
1. Select transaction type: "Transfer"
2. Choose debit account: "Bank Account" (1101)
3. Choose credit account: "Cash" (1101)
4. Enter transfer amount
5. System creates journal entry:
   - Debit: Bank Account $1000
   - Credit: Cash $1000

## Benefits

1. **Proper Accounting**: Ensures all transactions follow double-entry bookkeeping principles
2. **Financial Reporting**: Enables accurate financial statements and reports
3. **Audit Trail**: Complete traceability from payment to journal entry
4. **Compliance**: Meets standard accounting requirements
5. **Flexibility**: Users can select appropriate accounts for each transaction
6. **Automation**: Reduces manual journal entry creation
7. **Integration**: Seamless integration with existing chart of accounts system

## Future Enhancements

1. **Account Balance Tracking**: Add real-time account balance updates
2. **Financial Reports**: Generate balance sheet, income statement, and cash flow reports
3. **Account Reconciliation**: Add bank reconciliation features
4. **Multi-Currency Support**: Support for multiple currencies in journal entries
5. **Audit Logging**: Enhanced audit trail with user tracking
6. **Batch Processing**: Support for batch payment processing
7. **Integration with External Systems**: Connect with accounting software like QuickBooks
