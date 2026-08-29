-- CreateTable
CREATE TABLE "Vendors" (
    "id" TEXT NOT NULL,
    "Company" TEXT NOT NULL,
    "Address" TEXT NOT NULL,
    "City" TEXT NOT NULL,
    "Country" TEXT NOT NULL,
    "Contact" TEXT NOT NULL,
    "Email" TEXT NOT NULL,
    "ActiveStatus" TEXT NOT NULL,
    "SpecialInstructions" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vendors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vendors_Email_key" ON "Vendors"("Email");
