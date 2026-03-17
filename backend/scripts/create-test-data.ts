import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  
  // 1. Create partner request
  const partnerReq = await prisma.partnerRequest.create({
    data: {
      storeName: 'StroyMarket Tashkent',
      contactPerson: 'Alisher Karimov',
      phone: '+998901234567',
      email: 'info@stroymarket.uz',
      message: 'Major building materials store in Tashkent. 10 years on the market.',
      address: 'Tashkent, Sergeli district, Yangi Sergeli 12',
      city: 'Tashkent',
      storeCategory: 'building-materials',
    },
  });
  console.log('Created partner request:', partnerReq.id);

  // 2. Create second partner request
  const partnerReq2 = await prisma.partnerRequest.create({
    data: {
      storeName: 'ElektroWorld',
      contactPerson: 'Rustam Ismoilov',
      phone: '+998935556677',
      email: 'sales@elektroworld.uz',
      message: 'Electrical supplies wholesale and retail.',
      address: 'Samarkand, Gagarin 45',
      city: 'Samarkand',
      storeCategory: 'electrical',
    },
  });
  console.log('Created partner request 2:', partnerReq2.id);

  // 3. Create turnkey project
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) { console.log('No admin user!'); return; }

  const project = await prisma.turnkeyProject.create({
    data: {
      clientId: admin.id,
      title: 'Ремонт 3-комнатной квартиры',
      description: 'Полный ремонт квартиры в новостройке, включая дизайн-проект и мебель',
      propertyType: 'apartment',
      area: 85,
      rooms: 3,
      budgetMin: 50000000,
      budgetMax: 100000000,
      address: 'Tashkent, Yunusabad 19',
      city: 'Tashkent',
      district: 'Yunusabad',
      designIncluded: true,
      furnitureIncluded: true,
      status: 'IN_PROGRESS',
      totalPrice: 75000000,
      estimatedDays: 60,
      actualStartDate: new Date('2026-01-15'),
    },
  });

  // Create stages
  const stages = [
    { name: 'Consultation & measurement', sortOrder: 1, status: 'COMPLETED', progress: 100, startDate: new Date('2026-01-15'), endDate: new Date('2026-01-17') },
    { name: 'Design project', sortOrder: 2, status: 'COMPLETED', progress: 100, startDate: new Date('2026-01-18'), endDate: new Date('2026-01-28') },
    { name: 'Demolition works', sortOrder: 3, status: 'COMPLETED', progress: 100, startDate: new Date('2026-01-29'), endDate: new Date('2026-02-03') },
    { name: 'Rough finishing', sortOrder: 4, status: 'IN_PROGRESS', progress: 65, startDate: new Date('2026-02-04') },
    { name: 'Fine finishing', sortOrder: 5, status: 'PENDING', progress: 0 },
    { name: 'Furniture installation', sortOrder: 6, status: 'PENDING', progress: 0 },
    { name: 'Final cleanup & handover', sortOrder: 7, status: 'PENDING', progress: 0 },
  ];

  for (const s of stages) {
    await prisma.turnkeyStage.create({
      data: {
        projectId: project.id,
        name: s.name,
        sortOrder: s.sortOrder,
        status: s.status,
        progress: s.progress,
        startDate: s.startDate || null,
        endDate: s.endDate || null,
      },
    });
  }
  console.log('Created turnkey project:', project.id, 'with', stages.length, 'stages');

  // 4. Create a partner store
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

  // 5. Create some products for the store
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
  console.log('Done! Test data created successfully.');
}

main().catch(console.error);
