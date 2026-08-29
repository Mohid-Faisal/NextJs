/*
  Warnings:

  - You are about to drop the column `paymentMethod` on the `Shipment` table. All the data in the column will be lost.
  - You are about to drop the `PaymentMethod` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Shipment" DROP COLUMN "paymentMethod",
ADD COLUMN     "invoiceStatus" TEXT;

-- DropTable
DROP TABLE "public"."PaymentMethod";

-- CreateTable
CREATE TABLE "public"."InvoiceStatus" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceStatus_name_key" ON "public"."InvoiceStatus"("name");
