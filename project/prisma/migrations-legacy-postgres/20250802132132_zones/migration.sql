-- CreateTable
CREATE TABLE "public"."Zone" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "company" TEXT NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);
