import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const targetUsername = process.argv[2];

if (!targetUsername) {
  console.error('Использование: npx ts-node scripts/make-admin.ts <username>');
  process.exit(1);
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { username: targetUsername },
    select: { id: true, username: true, role: true },
  });

  if (!user) {
    console.error(`❌ Пользователь @${targetUsername} не найден`);
    process.exit(1);
  }

  if (user.role === 'ADMIN') {
    console.log(`ℹ️ @${user.username} уже ADMIN`);
    return;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: 'ADMIN' },
  });
  console.log(`✅ @${updated.username} теперь ADMIN`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
