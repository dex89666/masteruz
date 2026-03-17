import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  
  const store = await prisma.partnerStore.create({
    data: {
      name: 'MasterTools Pro',
      slug: 'mastertools-pro',
      description: 'Professional tools and equipment for construction and repair',
      contactPerson: 'Bobur Alimov',
      address: 'Tashkent, Chilanzar, Block 7',
      city: 'Tashkent',
      phone: '+998712345678',
      email: 'info@mastertools.uz',
      website: 'https://mastertools.uz',
      storeCategory: 'tools',
      isVerified: true,
      rating: 4.7,
      status: 'ACTIVE',
    },
  });
  console.log('Created store:', store.id, store.slug);

  const products = [
    { name: 'Bosch Professional Drill GSB 16 RE', price: 1250000, description: 'Professional impact drill 750W', category: 'power-tools', sortOrder: 1 },
    { name: 'Makita Angle Grinder GA5030', price: 890000, description: '720W angle grinder 125mm', category: 'power-tools', sortOrder: 2 },
    { name: 'Stanley Hammer Set (5 pcs)', price: 320000, description: 'Professional hammer set', category: 'hand-tools', sortOrder: 3 },
    { name: 'DeWalt Cordless Screwdriver', price: 2100000, description: '18V cordless screwdriver with 2 batteries', category: 'power-tools', sortOrder: 4 },
  ];

  for (const p of products) {
    await prisma.storeProduct.create({
      data: { ...p, storeId: store.id, isActive: true },
    });
  }
  console.log('Created', products.length, 'products');

  await prisma.$disconnect();
  console.log('Done!');
}

main().catch(console.error);
