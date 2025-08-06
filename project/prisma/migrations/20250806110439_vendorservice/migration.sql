-- CreateTable
CREATE TABLE "public"."vendorservice" (
    "id" SERIAL NOT NULL,
    "vendor" TEXT NOT NULL,
    "service" TEXT NOT NULL,

    CONSTRAINT "vendorservice_pkey" PRIMARY KEY ("id")
);
