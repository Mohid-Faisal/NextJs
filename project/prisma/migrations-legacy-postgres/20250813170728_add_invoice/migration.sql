/*
  Warnings:

  - You are about to drop the column `awbNumber` on the `Shipment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[invoiceNumber]` on the table `Shipment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Shipment" DROP COLUMN "awbNumber",
ADD COLUMN     "invoiceNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_invoiceNumber_key" ON "public"."Shipment"("invoiceNumber");
