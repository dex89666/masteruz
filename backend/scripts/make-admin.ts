import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Найти всех пользователей
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      role: true,
      telegramId: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });
  
  console.log('=== Все пользователи ===');
  users.forEach(u => {
    console.log(`ID: ${u.id} | @${u.username} | ${u.profile?.firstName ?? '—'} ${u.profile?.lastName ?? ''} | Role: ${u.role} | TG: ${u.telegramId}`);
  });

  // Найти sustanon250
  const target = users.find(u => u.username === 'sustanon250' || u.profile?.firstName === 'Vladimir');
  if (target) {
    console.log('\n=== Обновляю роль на ADMIN ===');
    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { role: 'ADMIN' },
    });
    console.log(`✅ @${updated.username} теперь ADMIN`);
  } else {
    console.log('\n❌ Пользователь sustanon250/Vladimir не найден');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
