// ============================================
// MasterUz — Выгрузка eval-набора из реальных заказов
// ============================================
//
// Собирает завершённые заказы в формат, который понимает run-eval.ts:
// фото + описание клиента → эталонная категория и ФАКТИЧЕСКАЯ итоговая цена.
//
// Эталон цены берём из финального состояния заказа (после всех подтверждённых
// изменений цены), а не из первоначальной оценки — иначе мы бы сравнивали
// прогноз AI сам с собой.
//
// Запуск:
//   npx tsx scripts/eval/export-dataset.ts > scripts/eval/dataset.json
//   npx tsx scripts/eval/export-dataset.ts --limit 300 --min-price 50000

import { prisma } from '../../src/config/database.js';
import { toNum } from '../../src/utils/helpers.js';

async function main() {
  const args = process.argv.slice(2);
  const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : 500;
  const minPrice = args.includes('--min-price') ? Number(args[args.indexOf('--min-price') + 1]) : 0;

  const orders = await prisma.order.findMany({
    where: {
      status: 'COMPLETED',
      images: { isEmpty: false }, // без фото кейс бесполезен для Vision
    },
    take: limit,
    orderBy: { completedAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      voiceDescription: true,
      images: true,
      price: true,
      visitFee: true,
      completedAt: true,
      category: { select: { slug: true } },
      aiPredictedPrice: true,
      aiModel: true,
    },
  });

  const cases = orders
    .map((o) => {
      // Фактическая цена работ на момент закрытия — эталон для сравнения.
      const finalPrice = toNum(o.price);
      if (finalPrice < minPrice) return null;

      // Клиент мог описать текстом или голосом — модель получала и то, и другое.
      const text = [o.description, o.voiceDescription].filter(Boolean).join('. ').trim();

      return {
        id: o.id,
        photos: o.images,
        text,
        expectCategory: o.category?.slug,
        expectPrice: finalPrice,
        note: [
          o.title,
          o.aiPredictedPrice != null
            ? `AI оценивал: ${toNum(o.aiPredictedPrice).toLocaleString('ru')}${o.aiModel ? ` (${o.aiModel})` : ''}`
            : null,
          o.completedAt ? `закрыт ${o.completedAt.toISOString().slice(0, 10)}` : null,
        ]
          .filter(Boolean)
          .join(' | '),
      };
    })
    .filter(Boolean);

  // Датасет — в stdout, диагностика — в stderr, чтобы можно было делать `> dataset.json`.
  console.error(`Завершённых заказов с фото: ${orders.length}`);
  console.error(`Попало в набор: ${cases.length}`);
  if (cases.length < 30) {
    console.error(
      '\n⚠ Меньше 30 кейсов — статистика будет шумной.\n' +
        '  Пока данных мало, дополните набор экспертной разметкой вручную\n' +
        '  (см. scripts/eval/dataset.example.json).',
    );
  }

  console.log(JSON.stringify({ cases }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
