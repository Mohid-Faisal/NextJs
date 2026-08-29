/*
  Warnings:

  - A unique constraint covering the columns `[service,fileType]` on the table `filename` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "filename_service_fileType_key" ON "public"."filename"("service", "fileType");
