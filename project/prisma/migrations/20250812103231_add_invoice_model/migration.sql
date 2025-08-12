-- CreateTable
CREATE TABLE "public"."Invoice" (
    "id" SERIAL NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "receiptNumber" TEXT,
    "trackingNumber" TEXT,
    "referenceNumber" TEXT,
    "destination" TEXT NOT NULL,
    "dayWeek" TEXT,
    "weight" DOUBLE PRECISION NOT NULL,
    "profile" TEXT NOT NULL,
    "fscCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineItems" JSONB NOT NULL,
    "customerId" INTEGER,
    "shipmentId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "public"."Invoice"("invoiceNumber");

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "public"."Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
