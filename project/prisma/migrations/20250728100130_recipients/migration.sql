/*
  Warnings:

  - You are about to drop the column `SpecialInstructions` on the `Vendors` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Vendors" DROP COLUMN "SpecialInstructions";

-- CreateTable
CREATE TABLE "Recipients" (
    "id" TEXT NOT NULL,
    "Company" TEXT NOT NULL,
    "Address" TEXT NOT NULL,
    "City" TEXT NOT NULL,
    "Country" TEXT NOT NULL,
    "Contact" TEXT NOT NULL,
    "Email" TEXT NOT NULL,
    "ActiveStatus" TEXT NOT NULL,
    "SpecialInstructions" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Recipients_Email_key" ON "Recipients"("Email");
