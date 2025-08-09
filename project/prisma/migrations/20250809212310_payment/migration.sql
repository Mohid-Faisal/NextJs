-- CreateEnum
CREATE TYPE "public"."TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "public"."PartyType" AS ENUM ('US', 'CUSTOMER', 'VENDOR');

-- CreateEnum
CREATE TYPE "public"."PaymentMode" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'CHEQUE');

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" SERIAL NOT NULL,
    "transactionType" "public"."TransactionType" NOT NULL,
    "category" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "fromPartyType" "public"."PartyType" NOT NULL,
    "fromCustomerId" INTEGER,
    "fromCustomer" TEXT NOT NULL,
    "toPartyType" "public"."PartyType" NOT NULL,
    "toVendorId" INTEGER,
    "toVendor" TEXT NOT NULL,
    "mode" "public"."PaymentMode",
    "reference" TEXT,
    "dueDate" TIMESTAMP(3),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
