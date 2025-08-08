/*
  Warnings:

  - You are about to drop the column `invoiceStatus` on the `Shipment` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Shipment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Shipment" DROP COLUMN "invoiceStatus",
DROP COLUMN "status";
