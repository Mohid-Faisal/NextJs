const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.update({
    where: { email: "eshansellsslaves@gmail.com" },
    data: { status: "ACTIVE" },
  });
  console.log("UPDATED USER RECORD IN DB:", JSON.stringify(user, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
