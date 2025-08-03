/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `Zone` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Zone" DROP COLUMN "updatedAt";

-- CreateTable
CREATE TABLE "public"."ZoneUpload" (
    "id" SERIAL NOT NULL,
    "service" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZoneUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ZoneUpload_service_key" ON "public"."ZoneUpload"("service");
