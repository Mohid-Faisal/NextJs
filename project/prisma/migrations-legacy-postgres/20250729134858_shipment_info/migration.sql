/*
  Warnings:

  - The primary key for the `Customers` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Customers` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Recipients` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Recipients` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Shipment` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `paymentMethod` on the `Shipment` table. All the data in the column will be lost.
  - The `id` column on the `Shipment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Vendors` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Vendors` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Customers" DROP CONSTRAINT "Customers_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Customers_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Recipients" DROP CONSTRAINT "Recipients_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Recipients_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_pkey",
DROP COLUMN "paymentMethod",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Vendors" DROP CONSTRAINT "Vendors_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Vendors_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "DeliveryTime" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryStatus" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingMode" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingMode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackagingType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackagingType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierCompany" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourierCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceMode" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceMode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryTime_name_key" ON "DeliveryTime"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_name_key" ON "PaymentMethod"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryStatus_name_key" ON "DeliveryStatus"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingMode_name_key" ON "ShippingMode"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PackagingType_name_key" ON "PackagingType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CourierCompany_name_key" ON "CourierCompany"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceMode_name_key" ON "ServiceMode"("name");
