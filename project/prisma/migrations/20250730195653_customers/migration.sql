/*
  Warnings:

  - You are about to drop the column `Company` on the `Customers` table. All the data in the column will be lost.
  - You are about to drop the column `Contact` on the `Customers` table. All the data in the column will be lost.
  - You are about to drop the column `SpecialInstructions` on the `Customers` table. All the data in the column will be lost.
  - Added the required column `CompanyName` to the `Customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `DocumentNumber` to the `Customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `DocumentType` to the `Customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `FilePath` to the `Customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `PersonName` to the `Customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Phone` to the `Customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `State` to the `Customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Zip` to the `Customers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Customers" DROP COLUMN "Company",
DROP COLUMN "Contact",
DROP COLUMN "SpecialInstructions",
ADD COLUMN     "CompanyName" TEXT NOT NULL,
ADD COLUMN     "DocumentNumber" TEXT NOT NULL,
ADD COLUMN     "DocumentType" TEXT NOT NULL,
ADD COLUMN     "FilePath" TEXT NOT NULL,
ADD COLUMN     "PersonName" TEXT NOT NULL,
ADD COLUMN     "Phone" TEXT NOT NULL,
ADD COLUMN     "State" TEXT NOT NULL,
ADD COLUMN     "Zip" TEXT NOT NULL;
