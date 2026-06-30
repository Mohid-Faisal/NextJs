import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "settings_role_permissions" }
    });

    if (setting) {
      let data = JSON.parse(setting.value);
      if (data.Driver && !data.Vendor) {
        data.Vendor = data.Driver;
        delete data.Driver;
        
        await prisma.appSetting.update({
          where: { key: "settings_role_permissions" },
          data: { value: JSON.stringify(data) }
        });
        console.log("Successfully migrated 'Driver' role to 'Vendor' in settings_role_permissions.");
      } else {
        console.log("No migration needed, 'Vendor' already exists or 'Driver' not found.");
      }
    } else {
      console.log("settings_role_permissions key not found in AppSetting.");
    }
  } catch (error) {
    console.error("Error migrating role permissions:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
