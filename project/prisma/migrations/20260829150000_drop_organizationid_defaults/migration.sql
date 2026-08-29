-- Drop silent tenant-1 defaults so omitted organizationId cannot write into another org.
-- Safe to re-run only if the default still exists; apply via prisma migrate deploy.

ALTER TABLE `Shipment` ALTER COLUMN `organizationId` DROP DEFAULT;
ALTER TABLE `Customers` ALTER COLUMN `organizationId` DROP DEFAULT;
ALTER TABLE `Vendors` ALTER COLUMN `organizationId` DROP DEFAULT;
ALTER TABLE `Recipients` ALTER COLUMN `organizationId` DROP DEFAULT;
ALTER TABLE `DeliveryTime` ALTER COLUMN `organizationId` DROP DEFAULT;
ALTER TABLE `Agency` ALTER COLUMN `organizationId` DROP DEFAULT;
ALTER TABLE `Office` ALTER COLUMN `organizationId` DROP DEFAULT;
ALTER TABLE `DeliveryStatus` ALTER COLUMN `organizationId` DROP DEFAULT;
ALTER TABLE `ShippingMode` ALTER COLUMN `organizationId` DROP DEFAULT;
ALTER TABLE `PackagingType` ALTER COLUMN `organizationId` DROP DEFAULT;
ALTER TABLE `ServiceMode` ALTER COLUMN `organizationId` DROP DEFAULT;
ALTER TABLE `HsCode` ALTER COLUMN `organizationId` DROP DEFAULT;
ALTER TABLE `Zone` ALTER COLUMN `organizationId` DROP DEFAULT;
ALTER TABLE `ZoneUpload` ALTER COLUMN `organizationId` DROP DEFAULT;
ALTER TABLE `RemoteArea` ALTER COLUMN `organizationId` DROP DEFAULT;
ALTER TABLE `Rate` ALTER COLUMN `organizationId` DROP DEFAULT;
ALTER TABLE `filename` ALTER COLUMN `organizationId` DROP DEFAULT;
ALTER TABLE `CustomerTransaction` ALTER COLUMN `organizationId` DROP DEFAULT;
ALTER TABLE `VendorTransaction` ALTER COLUMN `organizationId` DROP DEFAULT;
ALTER TABLE `vendorservice` ALTER COLUMN `organizationId` DROP DEFAULT;
ALTER TABLE `ChartOfAccount` ALTER COLUMN `organizationId` DROP DEFAULT;
ALTER TABLE `FixedCharge` ALTER COLUMN `organizationId` DROP DEFAULT;
