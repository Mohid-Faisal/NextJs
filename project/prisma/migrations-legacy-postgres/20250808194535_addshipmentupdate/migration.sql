/*
  Warnings:

  - You are about to drop the column `selectedRecipient` on the `Shipment` table. All the data in the column will be lost.
  - You are about to drop the column `selectedSender` on the `Shipment` table. All the data in the column will be lost.
  - You are about to drop the column `shippingPrefix` on the `Shipment` table. All the data in the column will be lost.
  - You are about to drop the column `submissionTimestamp` on the `Shipment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Shipment" DROP COLUMN "selectedRecipient",
DROP COLUMN "selectedSender",
DROP COLUMN "shippingPrefix",
DROP COLUMN "submissionTimestamp";
