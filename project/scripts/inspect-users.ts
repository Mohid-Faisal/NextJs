import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      include: {
        memberships: true
      }
    });
    console.log("USERS AND MEMBERSHIPS:\n", JSON.stringify(users, null, 2));

    const settings = await prisma.appSetting.findMany();
    console.log("APP SETTINGS:\n", JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
