const bcrypt = require("bcryptjs");
const prisma = require("../src/lib/prisma");


async function main() {
  const username =
    process.argv[2];

  const password =
    process.argv[3];


  if (!username || !password) {
    console.log(
      "Usage: node scripts/createAdmin.js <username> <password>"
    );

    process.exit(1);
  }


  if (password.length < 8) {
    console.log(
      "Password must be at least 8 characters."
    );

    process.exit(1);
  }


  const normalizedUsername =
    username
      .trim()
      .toLowerCase();


  const existing =
    await prisma.admin.findUnique({
      where: {
        username: normalizedUsername,
      },
    });


  if (existing) {
    console.log(
      "Admin username already exists."
    );

    process.exit(1);
  }


  const passwordHash =
    await bcrypt.hash(
      password,
      12
    );


  const admin =
    await prisma.admin.create({
      data: {
        username:
          normalizedUsername,

        passwordHash,

        status: "ACTIVE",
      },
    });


  console.log(
    `Admin created successfully: ${admin.username}`
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

//node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
// node scripts/createAdmin.js username "eg"