// ============================================
// MasterUz — Заготовка eval-набора из существующих заказов
// ============================================
//
// Берёт заказы с фотографиями (в любом статусе, не только закрытые),
// выкладывает изображения в файлы и собирает черновик датасета.
//
// Зачем отдельно от export-dataset.ts: тот выгружает ТОЛЬКО закрытые заказы,
// где фактическая цена уже известна. Пока закрытых нет, эталон приходится
// проставлять руками — а для этого фото нужно видеть, а не хранить в base64.
//
// Поля expectPrice/expectCategory предзаполнены тем, что выдал AI, и помечены
// "_review": true. Это ЧЕРНОВИК, а не эталон: пока вы не проверили цену
// глазами, метрика будет сравнивать модель сама с собой и покажет 100%.
//
// Запуск:
//   npx tsx scripts/eval/seed-dataset.ts
//   npx tsx scripts/eval/seed-dataset.ts --out scripts/eval/dataset.draft.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../../src/config/database.js';
import { toNum } from '../../src/utils/helpers.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Определяет расширение по data-URL. */
function extFromDataUrl(dataUrl: string): string {
  const m = dataUrl.match(/^data:image\/([a-z0-9.+-]+);base64,/i);
  const raw = (m?.[1] ?? 'jpeg').toLowerCase();
  return raw === 'jpeg' ? 'jpg' : raw;
}

async function main() {
  const args = process.argv.slice(2);
  const outPath = args.includes('--out')
    ? path.resolve(args[args.indexOf('--out') + 1])
    : path.join(HERE, 'dataset.draft.json');

  const samplesDir = path.join(HERE, 'samples');
  fs.mkdirSync(samplesDir, { recursive: true });

  const orders = await prisma.order.findMany({
    where: { images: { isEmpty: false } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      voiceDescription: true,
      images: true,
      price: true,
      status: true,
      aiPredictedPrice: true,
      category: { select: { slug: true } },
    },
  });

  console.error(`Заказов с фото: ${orders.length}`);

  const cases: any[] = [];
  let savedPhotos = 0;

  for (const o of orders) {
    const photoPaths: string[] = [];

    o.images.forEach((img, idx) => {
      if (!img.startsWith('data:image/')) {
        // Внешняя ссылка — оставляем как есть, run-eval умеет их скачивать.
        photoPaths.push(img);
        return;
      }
      const ext = extFromDataUrl(img);
      const base64 = img.slice(img.indexOf(',') + 1);
      const fileName = `${o.id.slice(0, 8)}-${idx + 1}.${ext}`;
      fs.writeFileSync(path.join(samplesDir, fileName), Buffer.from(base64, 'base64'));
      photoPaths.push(`./samples/${fileName}`);
      savedPhotos++;
    });

    if (!photoPaths.length) continue;

    const text = [o.description, o.voiceDescription].filter(Boolean).join('. ').trim();
    // Что выдал AI — как отправная точка для проверки, а не как истина.
    const aiPrice = o.aiPredictedPrice != null ? toNum(o.aiPredictedPrice) : toNum(o.price);

    cases.push({
      id: o.id.slice(0, 8),
      _review: true,
      _hint: `[${o.status}] ${o.title ?? ''} — проверьте цену и категорию глазами`,
      photos: photoPaths,
      text,
      expectCategory: o.category?.slug ?? null,
      expectPrice: Math.round(aiPrice),
    });
  }

  fs.writeFileSync(outPath, JSON.stringify({ cases }, null, 2), 'utf-8');

  console.error(`Сохранено изображений: ${savedPhotos} → ${samplesDir}`);
  console.error(`Черновик датасета:     ${outPath}`);
  console.error(`Кейсов:                ${cases.length}`);
  console.error('');
  console.error('ЧТО ДЕЛАТЬ ДАЛЬШЕ:');
  console.error(`  1. Откройте папку samples/ и посмотрите фото.`);
  console.error(`  2. В ${path.basename(outPath)} для каждого кейса проставьте:`);
  console.error(`       expectCategory — правильный slug категории`);
  console.error(`       expectPrice    — справедливая цена работ (сум)`);
  console.error(`     и уберите "_review": true.`);
  console.error(`  3. Кейсы-мусор (нечитаемое фото, бессмысленный текст) не удаляйте —`);
  console.error(`     они проверяют, что модель НЕ выдумывает смету на пустом месте.`);
  console.error(`     Для них ставьте expectPrice: 0 и ожидайте низкий confidence.`);
  console.error(`  4. Запустите: npm run eval scripts/eval/${path.basename(outPath)}`);
  console.error('');
  if (cases.length < 20) {
    console.error(
      `⚠ Кейсов всего ${cases.length}. Этого хватит, чтобы поймать грубые провалы,\n` +
        `  но НЕ хватит, чтобы сравнивать модели между собой — разница в 5-10%\n` +
        `  утонет в шуме. Доснимите 20-40 типичных проблем и положите фото\n` +
        `  в samples/, добавив кейсы в тот же файл.`,
    );
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
