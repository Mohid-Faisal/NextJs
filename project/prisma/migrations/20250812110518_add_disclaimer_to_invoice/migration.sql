-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "disclaimer" TEXT,
ADD COLUMN     "vendorId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
