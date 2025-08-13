-- Remove awbNumber column and add invoiceNumber column
ALTER TABLE "Shipment" DROP COLUMN "awbNumber";
ALTER TABLE "Shipment" ADD COLUMN "invoiceNumber" TEXT NOT NULL;
CREATE UNIQUE INDEX "Shipment_invoiceNumber_key" ON "Shipment"("invoiceNumber");
