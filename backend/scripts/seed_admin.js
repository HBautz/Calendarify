const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@admin.com';
  const name = 'admin';
  const password = 'admin';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { email, name, password: hashed } });
    console.log('Created default admin user');
  } else {
    console.log('Default admin user already exists');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
