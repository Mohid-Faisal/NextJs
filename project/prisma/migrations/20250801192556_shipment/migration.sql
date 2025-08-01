/*
  Warnings:

  - You are about to drop the column `ActiveStatus` on the `Recipients` table. All the data in the column will be lost.
  - You are about to drop the column `Company` on the `Recipients` table. All the data in the column will be lost.
  - You are about to drop the column `Contact` on the `Recipients` table. All the data in the column will be lost.
  - You are about to drop the column `SpecialInstructions` on the `Recipients` table. All the data in the column will be lost.
  - You are about to drop the column `ActiveStatus` on the `Vendors` table. All the data in the column will be lost.
  - You are about to drop the column `Company` on the `Vendors` table. All the data in the column will be lost.
  - You are about to drop the column `Contact` on the `Vendors` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[CompanyName]` on the table `Customers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[CompanyName]` on the table `Recipients` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[CompanyName]` on the table `Vendors` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `CompanyName` to the `Recipients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `PersonName` to the `Recipients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Phone` to the `Recipients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `State` to the `Recipients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Zip` to the `Recipients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CompanyName` to the `Vendors` table without a default value. This is not possible if the table is not empty.
  - Added the required column `PersonName` to the `Vendors` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Phone` to the `Vendors` table without a default value. This is not possible if the table is not empty.
  - Added the required column `State` to the `Vendors` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Zip` to the `Vendors` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Recipients" DROP COLUMN "ActiveStatus",
DROP COLUMN "Company",
DROP COLUMN "Contact",
DROP COLUMN "SpecialInstructions",
ADD COLUMN     "CompanyName" TEXT NOT NULL,
ADD COLUMN     "PersonName" TEXT NOT NULL,
ADD COLUMN     "Phone" TEXT NOT NULL,
ADD COLUMN     "State" TEXT NOT NULL,
ADD COLUMN     "Zip" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Vendors" DROP COLUMN "ActiveStatus",
DROP COLUMN "Company",
DROP COLUMN "Contact",
ADD COLUMN     "CompanyName" TEXT NOT NULL,
ADD COLUMN     "PersonName" TEXT NOT NULL,
ADD COLUMN     "Phone" TEXT NOT NULL,
ADD COLUMN     "State" TEXT NOT NULL,
ADD COLUMN     "Zip" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Customers_CompanyName_key" ON "public"."Customers"("CompanyName");

-- CreateIndex
CREATE UNIQUE INDEX "Recipients_CompanyName_key" ON "public"."Recipients"("CompanyName");

-- CreateIndex
CREATE UNIQUE INDEX "Vendors_CompanyName_key" ON "public"."Vendors"("CompanyName");
