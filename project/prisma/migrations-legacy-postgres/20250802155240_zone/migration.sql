/*
  Warnings:

  - You are about to drop the column `company` on the `Zone` table. All the data in the column will be lost.
  - Added the required column `service` to the `Zone` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Zone" DROP COLUMN "company",
ADD COLUMN     "service" TEXT NOT NULL;
