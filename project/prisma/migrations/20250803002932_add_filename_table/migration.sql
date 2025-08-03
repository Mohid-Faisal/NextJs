-- CreateTable
CREATE TABLE "public"."filename" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "service" TEXT NOT NULL,

    CONSTRAINT "filename_pkey" PRIMARY KEY ("id")
);
