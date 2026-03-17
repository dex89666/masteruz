import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

async function main() {
  const prisma = new PrismaClient();
  
  // Check for existing admin
  let admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        telegramId: 999999999,
        username: 'admin_test',
        role: 'ADMIN',
        isVerified: true,
        referralCode: 'ADMIN' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        profile: {
          create: {
            firstName: 'Admin',
            lastName: 'MasterUz',
          }
        }
      }
    });
    console.log('Created admin user:', admin.id);
  } else {
    console.log('Found existing admin user:', admin.id);
  }
  
  // Generate JWT
  const secret = process.env.JWT_SECRET || 'default-secret';
  const token = jwt.sign(
    { userId: admin.id, role: admin.role },
    secret,
    { expiresIn: '7d' }
  );
  
  console.log('ADMIN_TOKEN=' + token);
  
  await prisma.$disconnect();
}

main().catch(console.error);
