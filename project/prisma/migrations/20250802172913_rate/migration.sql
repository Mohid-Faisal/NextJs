-- CreateTable
CREATE TABLE "public"."Rate" (
    "id" SERIAL NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "vendors" TEXT NOT NULL,
    "zone" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "docType" TEXT NOT NULL,

    CONSTRAINT "Rate_pkey" PRIMARY KEY ("id")
);
