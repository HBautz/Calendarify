// Delete a user by email using Prisma
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const email = process.env.DELETE_EMAIL || 'admin@admin.com';
  try {
    // Prefer delete with unique where if email is unique (it is in schema)
    await prisma.user.delete({ where: { email } });
    console.log(`Deleted user ${email}`);
  } catch (err) {
    if (err.code === 'P2025') {
      console.log(`User not found: ${email}`);
    } else {
      console.error('Delete failed:', err);
    }
  } finally {
    await prisma.$disconnect();
  }
})();


