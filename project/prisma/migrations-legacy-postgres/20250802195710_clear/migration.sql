/*
  Warnings:

  - You are about to drop the column `vendors` on the `Rate` table. All the data in the column will be lost.
  - Added the required column `service` to the `Rate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vendor` to the `Rate` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Rate" DROP COLUMN "vendors",
ADD COLUMN     "service" TEXT NOT NULL,
ADD COLUMN     "vendor" TEXT NOT NULL;
