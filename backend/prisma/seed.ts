// ============================================
// MasterUz — Database Seed (v5)
// 6 родительских категорий + 15 дочерних, 70+ подкатегорий, 300+ задач
// + Партнёрские магазины, Ремонт под ключ, Перевозки
// ============================================

import { PrismaClient } from '@prisma/client';
import { SERVICE_CATALOG, PARENT_CATEGORIES } from '../../shared/services-catalog.js';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Начинаю заполнение базы данных...');

  // ─── Проход 1: Родительские категории (6 шт) ───
  const parentMap = new Map<string, string>(); // slug → id
  for (let i = 0; i < PARENT_CATEGORIES.length; i++) {
    const pDef = PARENT_CATEGORIES[i];
    const parent = await prisma.category.upsert({
      where: { slug: pDef.slug },
      update: {
        name: pDef.name,
        nameUz: pDef.nameUz,
        nameEn: pDef.nameEn,
        icon: pDef.icon,
        sortOrder: i + 1,
        parentId: null,
      },
      create: {
        name: pDef.name,
        nameUz: pDef.nameUz,
        nameEn: pDef.nameEn,
        slug: pDef.slug,
        icon: pDef.icon,
        sortOrder: i + 1,
      },
    });
    parentMap.set(pDef.slug, parent.id);
  }
  console.log(`✅ Создано ${parentMap.size} родительских категорий`);

  // ─── Проход 2: Дочерние категории + подкатегории + задачи ───
  let totalCategories = 0;
  let totalSubcategories = 0;
  let totalTasks = 0;

  for (let ci = 0; ci < SERVICE_CATALOG.length; ci++) {
    const catDef = SERVICE_CATALOG[ci];
    const parentId = catDef.parentSlug ? parentMap.get(catDef.parentSlug) || null : null;

    const category = await prisma.category.upsert({
      where: { slug: catDef.slug },
      update: {
        name: catDef.name,
        nameUz: catDef.nameUz,
        nameEn: catDef.nameEn,
        icon: catDef.icon,
        sortOrder: ci + 1,
        parentId,
      },
      create: {
        name: catDef.name,
        nameUz: catDef.nameUz,
        nameEn: catDef.nameEn,
        slug: catDef.slug,
        icon: catDef.icon,
        sortOrder: ci + 1,
        parentId,
      },
    });
    totalCategories++;

    for (let si = 0; si < catDef.subcategories.length; si++) {
      const subDef = catDef.subcategories[si];
      const subcategory = await prisma.subcategory.upsert({
        where: { slug: subDef.slug },
        update: {
          name: subDef.name,
          nameUz: subDef.nameUz,
          nameEn: subDef.nameEn,
          icon: subDef.icon,
          sortOrder: si + 1,
          categoryId: category.id,
        },
        create: {
          categoryId: category.id,
          name: subDef.name,
          nameUz: subDef.nameUz,
          nameEn: subDef.nameEn,
          slug: subDef.slug,
          icon: subDef.icon,
          sortOrder: si + 1,
        },
      });
      totalSubcategories++;

      for (let ti = 0; ti < subDef.tasks.length; ti++) {
        const taskDef = subDef.tasks[ti];
        await prisma.task.upsert({
          where: { slug: taskDef.slug },
          update: {
            name: taskDef.name,
            nameUz: taskDef.nameUz,
            nameEn: taskDef.nameEn,
            description: taskDef.description,
            descriptionUz: taskDef.descriptionUz,
            descriptionEn: taskDef.descriptionEn,
            estimatedTime: taskDef.estimatedTime,
            estimatedTimeUz: taskDef.estimatedTimeUz,
            estimatedTimeEn: taskDef.estimatedTimeEn,
            minPrice: taskDef.minPrice,
            sortOrder: ti + 1,
            subcategoryId: subcategory.id,
            isActive: true,
          },
          create: {
            subcategoryId: subcategory.id,
            name: taskDef.name,
            nameUz: taskDef.nameUz,
            nameEn: taskDef.nameEn,
            description: taskDef.description,
            descriptionUz: taskDef.descriptionUz,
            descriptionEn: taskDef.descriptionEn,
            estimatedTime: taskDef.estimatedTime,
            estimatedTimeUz: taskDef.estimatedTimeUz,
            estimatedTimeEn: taskDef.estimatedTimeEn,
            minPrice: taskDef.minPrice,
            slug: taskDef.slug,
            sortOrder: ti + 1,
          },
        });
        totalTasks++;
      }
    }
  }

  console.log(`✅ Создано ${totalCategories} категорий`);
  console.log(`✅ Создано ${totalSubcategories} подкатегорий`);
  console.log(`✅ Создано ${totalTasks} задач`);

  // ─── Деактивация старых/тестовых категорий без parentId ───
  const knownSlugs = [
    ...PARENT_CATEGORIES.map(p => p.slug),
    ...SERVICE_CATALOG.map(c => c.slug),
  ];
  const deactivated = await prisma.category.updateMany({
    where: {
      slug: { notIn: knownSlugs },
      isActive: true,
    },
    data: { isActive: false },
  });
  if (deactivated.count > 0) {
    console.log(`🧹 Деактивировано ${deactivated.count} старых/тестовых категорий`);
  }

  // ─── Конфигурация платформы ───────────────
  const configs = await Promise.all([
    prisma.platformConfig.upsert({
      where: { key: 'commission_rate' },
      update: {},
      create: {
        key: 'commission_rate',
        value: '15',
        description: 'Комиссия платформы с каждого заказа (%)',
      },
    }),
    prisma.platformConfig.upsert({
      where: { key: 'referral_master_bonus_rate' },
      update: {},
      create: {
        key: 'referral_master_bonus_rate',
        value: '5',
        description: 'Бонус рефереру за привлечённого мастера (%)',
      },
    }),
    prisma.platformConfig.upsert({
      where: { key: 'referral_client_discount_rate' },
      update: {},
      create: {
        key: 'referral_client_discount_rate',
        value: '3',
        description: 'Скидка рефереру за привлечённого клиента (%)',
      },
    }),
    prisma.platformConfig.upsert({
      where: { key: 'min_order_price' },
      update: {},
      create: {
        key: 'min_order_price',
        value: '10000',
        description: 'Минимальная стоимость заказа (сум)',
      },
    }),
    prisma.platformConfig.upsert({
      where: { key: 'max_response_time_hours' },
      update: {},
      create: {
        key: 'max_response_time_hours',
        value: '24',
        description: 'Максимальное время на отклик мастера (часы)',
      },
    }),
    prisma.platformConfig.upsert({
      where: { key: 'newbie_max_price_ratio' },
      update: {},
      create: {
        key: 'newbie_max_price_ratio',
        value: '0.7',
        description: 'Максимальный процент от средней цены для новичков',
      },
    }),
    prisma.platformConfig.upsert({
      where: { key: 'visit_fee' },
      update: { value: '100000' },
      create: {
        key: 'visit_fee',
        value: '100000',
        description: 'Стоимость выезда мастера (сум)',
      },
    }),
    prisma.platformConfig.upsert({
      where: { key: 'visit_fee_commission_rate' },
      update: {},
      create: {
        key: 'visit_fee_commission_rate',
        value: '10',
        description: 'Комиссия платформы с выезда мастера (%)',
      },
    }),
    prisma.platformConfig.upsert({
      where: { key: 'guarantee_duration_days' },
      update: {},
      create: {
        key: 'guarantee_duration_days',
        value: '30',
        description: 'Срок гарантии на выполненные работы (дней)',
      },
    }),
    // ─── Ступенчатая комиссия (РАСТУЩАЯ анти-обход модель) ───
    // Дешёвые заказы → НИЗКИЙ % (невыгодно уводить в наличку),
    // крупные → выше (ценность эскроу-защиты растёт с суммой).
    prisma.platformConfig.upsert({
      where: { key: 'commission_tier_small' },
      update: { value: '10' },
      create: { key: 'commission_tier_small', value: '10', description: 'Комиссия для заказов < 100k сум (%)' },
    }),
    prisma.platformConfig.upsert({
      where: { key: 'commission_tier_mid' },
      update: { value: '12' },
      create: { key: 'commission_tier_mid', value: '12', description: 'Комиссия для заказов 100k–300k сум (%)' },
    }),
    prisma.platformConfig.upsert({
      where: { key: 'commission_tier_large' },
      update: { value: '14' },
      create: { key: 'commission_tier_large', value: '14', description: 'Комиссия для заказов 300k–800k сум (%)' },
    }),
    prisma.platformConfig.upsert({
      where: { key: 'commission_tier_xl' },
      update: { value: '15' },
      create: { key: 'commission_tier_xl', value: '15', description: 'Комиссия для заказов ≥ 800k сум (%)' },
    }),
    prisma.platformConfig.upsert({
      where: { key: 'commission_tier_small_max' },
      update: {},
      create: { key: 'commission_tier_small_max', value: '100000', description: 'Верхняя граница ступени «малый заказ» (сум)' },
    }),
    prisma.platformConfig.upsert({
      where: { key: 'commission_tier_mid_max' },
      update: {},
      create: { key: 'commission_tier_mid_max', value: '300000', description: 'Верхняя граница ступени «средний заказ» (сум)' },
    }),
    prisma.platformConfig.upsert({
      where: { key: 'commission_tier_large_max' },
      update: {},
      create: { key: 'commission_tier_large_max', value: '800000', description: 'Верхняя граница ступени «крупный заказ» (сум)' },
    }),
  ]);

  console.log(`✅ Создано ${configs.length} параметров конфигурации`);

  // ─── Курсы школы мастеров ────────────────
  const plumbing = await prisma.category.findUnique({ where: { slug: 'plumbing' } });
  const electrical = await prisma.category.findUnique({ where: { slug: 'electrical' } });

  const courses = await Promise.all([
    prisma.schoolCourse.upsert({
      where: { id: 'course-intro' },
      update: {},
      create: {
        id: 'course-intro',
        title: 'Введение в платформу MasterUz',
        titleUz: 'MasterUz platformasiga kirish',
        titleEn: 'Introduction to MasterUz',
        description: 'Узнайте, как работает платформа и как получать заказы',
        descriptionUz: 'Platforma qanday ishlashini va buyurtmalarni qanday olishni bilib oling',
        descriptionEn: 'Learn how the platform works and how to get orders',
        videoUrl: 'https://youtube.com/watch?v=placeholder-intro',
        durationMinutes: 10,
        sortOrder: 1,
        isRequired: true,
      },
    }),
    prisma.schoolCourse.upsert({
      where: { id: 'course-safety' },
      update: {},
      create: {
        id: 'course-safety',
        title: 'Техника безопасности',
        titleUz: 'Xavfsizlik texnikasi',
        titleEn: 'Safety guidelines',
        description: 'Правила безопасности при выполнении работ',
        descriptionUz: 'Ishlarni bajarishda xavfsizlik qoidalari',
        descriptionEn: 'Safety rules when performing work',
        videoUrl: 'https://youtube.com/watch?v=placeholder-safety',
        durationMinutes: 15,
        sortOrder: 2,
        isRequired: true,
      },
    }),
    prisma.schoolCourse.upsert({
      where: { id: 'course-client-communication' },
      update: {},
      create: {
        id: 'course-client-communication',
        title: 'Общение с клиентом',
        titleUz: 'Mijoz bilan muloqot',
        titleEn: 'Client communication',
        description: 'Как профессионально общаться с заказчиками',
        descriptionUz: 'Buyurtmachilar bilan professional muloqot',
        descriptionEn: 'How to communicate professionally with clients',
        videoUrl: 'https://youtube.com/watch?v=placeholder-comm',
        durationMinutes: 12,
        sortOrder: 3,
        isRequired: true,
      },
    }),
    prisma.schoolCourse.upsert({
      where: { id: 'course-plumbing-basics' },
      update: {},
      create: {
        id: 'course-plumbing-basics',
        categoryId: plumbing?.id,
        title: 'Основы сантехнических работ',
        titleUz: 'Santexnika ishlarining asoslari',
        titleEn: 'Plumbing basics',
        description: 'Базовые навыки сантехника',
        descriptionUz: 'Santexnikning asosiy koʻnikmalari',
        descriptionEn: 'Basic plumbing skills',
        videoUrl: 'https://youtube.com/watch?v=placeholder-plumbing',
        durationMinutes: 20,
        sortOrder: 10,
        isRequired: false,
      },
    }),
    prisma.schoolCourse.upsert({
      where: { id: 'course-electrical-basics' },
      update: {},
      create: {
        id: 'course-electrical-basics',
        categoryId: electrical?.id,
        title: 'Основы электромонтажных работ',
        titleUz: 'Elektr montaj ishlarining asoslari',
        titleEn: 'Electrical basics',
        description: 'Базовые навыки электрика',
        descriptionUz: 'Elektrikning asosiy koʻnikmalari',
        descriptionEn: 'Basic electrical skills',
        videoUrl: 'https://youtube.com/watch?v=placeholder-electrical',
        durationMinutes: 25,
        sortOrder: 11,
        isRequired: false,
      },
    }),
  ]);

  console.log(`✅ Создано ${courses.length} курсов`);
  console.log('\n🎉 Заполнение базы данных завершено!');
}

seed()
  .catch((e) => {
    console.error('❌ Ошибка заполнения:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
