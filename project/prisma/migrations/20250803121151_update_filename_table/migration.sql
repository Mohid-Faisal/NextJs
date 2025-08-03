/*
  Warnings:

  - Added the required column `fileType` to the `filename` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- First add the columns with default values
ALTER TABLE "public"."filename" ADD COLUMN     "fileType" TEXT DEFAULT 'rate',
ADD COLUMN     "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Update existing records to have fileType as 'rate' (assuming existing records are rate files)
UPDATE "public"."filename" SET "fileType" = 'rate' WHERE "fileType" IS NULL;

-- Make fileType NOT NULL after updating existing data
ALTER TABLE "public"."filename" ALTER COLUMN "fileType" SET NOT NULL;
