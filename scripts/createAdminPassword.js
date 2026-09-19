const bcrypt = require("bcryptjs");
const prisma = require("../src/lib/prisma");

async function main() {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!username || !password) {
    console.log(
      "Usage: node scripts/changeAdminPassword.js <username> <password>"
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.log("Password must be at least 8 characters.");
    process.exit(1);
  }

  const normalizedUsername = username.trim().toLowerCase();

  const existing = await prisma.admin.findUnique({
    where: {
      username: normalizedUsername,
    },
  });

  if (!existing) {
    console.log("Admin username does not exist.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.admin.update({
    where: {
      username: normalizedUsername,
    },
    data: {
      passwordHash,
    },
  });

  console.log(
    `Admin password changed successfully: ${normalizedUsername}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

