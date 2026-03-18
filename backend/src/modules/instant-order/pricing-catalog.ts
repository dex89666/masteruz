// ============================================
// MasterUz — Smart Pricing Catalog
// Реальные расценки Ташкента 2026 г.
// AI-анализ проблем → точный подбор работ и цен
// ============================================

/**
 * Справочник решений проблем по категориям.
 * 
 * Ключевая логика:
 * 1. Пользователь описывает ПРОБЛЕМУ (текст + фото)
 * 2. AI определяет КАТЕГОРИЮ → затем КОНКРЕТНУЮ проблему
 * 3. Для каждой проблемы подбирается решение с реальной ценой
 * 4. Варианты: GOOD (минимальный ремонт), BETTER (оптимальный), BEST (капитальный)
 */

// ─── Типы ──────────────────────────────────────

export interface PricingUnit {
  /** Единица измерения: шт, м.п., м², точка, комплект и т.д. */
  unit: string;
  /** Цена за единицу (сум) */
  pricePerUnit: number;
  /** Минимальный объём */
  minQty: number;
  /** Описание */
  label: string;
}

export interface ProblemSolution {
  /** Ключевые слова для обнаружения проблемы */
  keywords: string[];
  /** Название проблемы */
  problemName: string;
  /** Варианты решения */
  solutions: {
    tier: 'GOOD' | 'BETTER' | 'BEST';
    /** Название решения */
    title: string;
    /** Описание работ */
    description: string;
    /** Работы с ценами */
    works: { name: string; qty: number; unit: string; unitPrice: number }[];
    /** Материалы с ценами */
    materials: { name: string; qty: number; unit: string; unitPrice: number }[];
    /** Срок (дни) */
    days: number;
  }[];
}

export interface CategoryPricing {
  slug: string;
  name: string;
  /** Проблемы, которые может решить эта категория */
  problems: ProblemSolution[];
  /** Fallback расценки, если конкретная проблема не определена */
  defaultUnit: PricingUnit;
}

// ─── СПРАВОЧНИК РАСЦЕНОК ПО ТАШКЕНТУ 2026 ──────

export const PRICING_CATALOG: CategoryPricing[] = [

  // ════════════════════════════════════════════
  // 1. САНТЕХНИКА
  // ════════════════════════════════════════════
  {
    slug: 'plumbing',
    name: 'Сантехника',
    defaultUnit: { unit: 'точка', pricePerUnit: 100_000, minQty: 1, label: 'Сантехническая точка' },
    problems: [
      {
        keywords: ['прорвал', 'прорыв', 'прорвало', 'течь', 'течёт', 'течет', 'протечка', 'протекает', 'капает', 'лужа', 'вода на полу', 'потоп', 'затопил', 'залило'],
        problemName: 'Протечка / прорыв трубы',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Устранение протечки (точечный ремонт)',
            description: 'Герметизация места протечки, установка хомута или замена фитинга. Быстрое решение.',
            works: [
              { name: 'Диагностика и выезд мастера', qty: 1, unit: 'выезд', unitPrice: 50_000 },
              { name: 'Устранение протечки (хомут/герметик)', qty: 1, unit: 'точка', unitPrice: 80_000 },
            ],
            materials: [
              { name: 'Хомут/герметик/фум-лента', qty: 1, unit: 'компл.', unitPrice: 15_000 },
            ],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Замена повреждённого участка трубы (1 м)',
            description: 'Замена повреждённого участка ПП-трубы с 2 пайками. Надёжное решение.',
            works: [
              { name: 'Диагностика и выезд мастера', qty: 1, unit: 'выезд', unitPrice: 50_000 },
              { name: 'Демонтаж повреждённого участка', qty: 1, unit: 'точка', unitPrice: 30_000 },
              { name: 'Пайка ПП-трубы Ø20-25 мм', qty: 2, unit: 'пайка', unitPrice: 55_000 },
            ],
            materials: [
              { name: 'ПП-труба армированная (1 м)', qty: 1, unit: 'м.п.', unitPrice: 30_000 },
              { name: 'Фитинги (муфты, уголки)', qty: 2, unit: 'шт.', unitPrice: 8_000 },
            ],
            days: 1,
          },
          {
            tier: 'BEST',
            title: 'Замена участка трубопровода (до 3 м)',
            description: 'Полная замена проблемного участка с установкой запорной арматуры.',
            works: [
              { name: 'Диагностика и выезд мастера', qty: 1, unit: 'выезд', unitPrice: 50_000 },
              { name: 'Демонтаж старых труб', qty: 3, unit: 'м.п.', unitPrice: 20_000 },
              { name: 'Пайка ПП-трубы Ø20-25 мм', qty: 4, unit: 'пайка', unitPrice: 55_000 },
              { name: 'Установка шарового крана', qty: 1, unit: 'шт.', unitPrice: 40_000 },
            ],
            materials: [
              { name: 'ПП-труба армированная', qty: 3, unit: 'м.п.', unitPrice: 30_000 },
              { name: 'Фитинги (муфты, уголки, тройники)', qty: 5, unit: 'шт.', unitPrice: 8_000 },
              { name: 'Шаровый кран Ø20-25 мм', qty: 1, unit: 'шт.', unitPrice: 25_000 },
            ],
            days: 1,
          },
        ],
      },
      {
        keywords: ['засор', 'засорил', 'забил', 'не уходит', 'плохо уходит', 'вода стоит', 'канализация', 'раковина забилась', 'унитаз забился', 'ванна забилась', 'запах', 'воняет'],
        problemName: 'Засор канализации',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Прочистка вантузом / тросом',
            description: 'Механическая прочистка засора сантехническим тросом.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 50_000 },
              { name: 'Прочистка тросом', qty: 1, unit: 'точка', unitPrice: 100_000 },
            ],
            materials: [
              { name: 'Средство для прочистки', qty: 1, unit: 'шт.', unitPrice: 10_000 },
            ],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Гидродинамическая прочистка',
            description: 'Профессиональная прочистка аппаратом высокого давления.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 50_000 },
              { name: 'Гидродинамическая прочистка', qty: 1, unit: 'точка', unitPrice: 200_000 },
              { name: 'Видеодиагностика трубы', qty: 1, unit: 'услуга', unitPrice: 50_000 },
            ],
            materials: [
              { name: 'Средство для профилактики', qty: 1, unit: 'шт.', unitPrice: 15_000 },
            ],
            days: 1,
          },
          {
            tier: 'BEST',
            title: 'Прочистка + замена сифона/гофры',
            description: 'Полная прочистка, замена сифона и гофры, профилактика.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 50_000 },
              { name: 'Гидродинамическая прочистка', qty: 1, unit: 'точка', unitPrice: 200_000 },
              { name: 'Замена сифона', qty: 1, unit: 'шт.', unitPrice: 60_000 },
              { name: 'Замена гофры', qty: 1, unit: 'шт.', unitPrice: 40_000 },
            ],
            materials: [
              { name: 'Сифон новый', qty: 1, unit: 'шт.', unitPrice: 35_000 },
              { name: 'Гофра канализационная', qty: 1, unit: 'шт.', unitPrice: 15_000 },
            ],
            days: 1,
          },
        ],
      },
      {
        keywords: ['кран', 'смеситель', 'вентиль', 'кранбукса', 'капает кран', 'не закрывается', 'сломался кран', 'замена крана'],
        problemName: 'Ремонт / замена крана (смесителя)',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Ремонт крана (замена картриджа/прокладки)',
            description: 'Замена картриджа или прокладки в существующем смесителе.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 50_000 },
              { name: 'Ремонт смесителя', qty: 1, unit: 'шт.', unitPrice: 50_000 },
            ],
            materials: [
              { name: 'Картридж / прокладки', qty: 1, unit: 'компл.', unitPrice: 20_000 },
            ],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Замена смесителя (стандарт)',
            description: 'Демонтаж старого и установка нового смесителя средней ценовой категории.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 50_000 },
              { name: 'Демонтаж старого смесителя', qty: 1, unit: 'шт.', unitPrice: 20_000 },
              { name: 'Установка нового смесителя', qty: 1, unit: 'шт.', unitPrice: 80_000 },
            ],
            materials: [
              { name: 'Подводка гибкая (2 шт.)', qty: 1, unit: 'компл.', unitPrice: 20_000 },
              { name: 'Фум-лента, герметик', qty: 1, unit: 'компл.', unitPrice: 5_000 },
            ],
            days: 1,
          },
          {
            tier: 'BEST',
            title: 'Замена смесителя с подводкой',
            description: 'Полная замена смесителя, подводки, запорных кранов.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 50_000 },
              { name: 'Демонтаж старого смесителя', qty: 1, unit: 'шт.', unitPrice: 20_000 },
              { name: 'Установка нового смесителя', qty: 1, unit: 'шт.', unitPrice: 80_000 },
              { name: 'Замена подводки', qty: 2, unit: 'шт.', unitPrice: 25_000 },
              { name: 'Замена запорных кранов', qty: 2, unit: 'шт.', unitPrice: 40_000 },
            ],
            materials: [
              { name: 'Подводка гибкая', qty: 2, unit: 'шт.', unitPrice: 15_000 },
              { name: 'Шаровые краны', qty: 2, unit: 'шт.', unitPrice: 25_000 },
              { name: 'Фум-лента, герметик', qty: 1, unit: 'компл.', unitPrice: 5_000 },
            ],
            days: 1,
          },
        ],
      },
      {
        keywords: ['унитаз', 'бачок', 'не сливает', 'не набирает', 'сломался унитаз', 'установка унитаза', 'шатается'],
        problemName: 'Ремонт / установка унитаза',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Ремонт сливного механизма',
            description: 'Замена арматуры сливного бачка.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 50_000 },
              { name: 'Замена арматуры бачка', qty: 1, unit: 'шт.', unitPrice: 60_000 },
            ],
            materials: [
              { name: 'Арматура сливного бачка', qty: 1, unit: 'компл.', unitPrice: 45_000 },
            ],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Замена унитаза (демонтаж + монтаж)',
            description: 'Демонтаж старого, установка нового унитаза с подключением.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 50_000 },
              { name: 'Демонтаж старого унитаза', qty: 1, unit: 'шт.', unitPrice: 50_000 },
              { name: 'Установка нового унитаза', qty: 1, unit: 'шт.', unitPrice: 150_000 },
            ],
            materials: [
              { name: 'Гофра, болты крепления, герметик', qty: 1, unit: 'компл.', unitPrice: 25_000 },
            ],
            days: 1,
          },
          {
            tier: 'BEST',
            title: 'Установка унитаза + инсталляция',
            description: 'Установка подвесного унитаза с инсталляцией.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 50_000 },
              { name: 'Демонтаж старого унитаза', qty: 1, unit: 'шт.', unitPrice: 50_000 },
              { name: 'Монтаж инсталляции', qty: 1, unit: 'шт.', unitPrice: 250_000 },
              { name: 'Установка подвесного унитаза', qty: 1, unit: 'шт.', unitPrice: 150_000 },
            ],
            materials: [
              { name: 'Крепёж, подводка, герметик', qty: 1, unit: 'компл.', unitPrice: 35_000 },
            ],
            days: 2,
          },
        ],
      },
      {
        keywords: ['бойлер', 'водонагреватель', 'нет горячей воды', 'колонка', 'котёл', 'котел', 'отопление', 'радиатор', 'батарея'],
        problemName: 'Водонагреватель / отопление',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Диагностика и мелкий ремонт',
            description: 'Диагностика бойлера/котла, замена ТЭНа или анода.',
            works: [
              { name: 'Выезд и диагностика', qty: 1, unit: 'выезд', unitPrice: 80_000 },
              { name: 'Мелкий ремонт (замена ТЭНа/анода)', qty: 1, unit: 'шт.', unitPrice: 100_000 },
            ],
            materials: [
              { name: 'ТЭН / анод', qty: 1, unit: 'шт.', unitPrice: 60_000 },
            ],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Установка водонагревателя',
            description: 'Демонтаж старого и установка нового бойлера 50-80 литров.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 50_000 },
              { name: 'Демонтаж старого', qty: 1, unit: 'шт.', unitPrice: 40_000 },
              { name: 'Установка нового водонагревателя', qty: 1, unit: 'шт.', unitPrice: 150_000 },
              { name: 'Подключение к водопроводу', qty: 1, unit: 'точка', unitPrice: 60_000 },
            ],
            materials: [
              { name: 'Подводка, краны, тройники', qty: 1, unit: 'компл.', unitPrice: 40_000 },
            ],
            days: 1,
          },
          {
            tier: 'BEST',
            title: 'Установка бойлера + разводка',
            description: 'Установка бойлера с новой разводкой горячей воды.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 50_000 },
              { name: 'Демонтаж старого', qty: 1, unit: 'шт.', unitPrice: 40_000 },
              { name: 'Установка нового водонагревателя', qty: 1, unit: 'шт.', unitPrice: 150_000 },
              { name: 'Разводка горячей воды (3 точки)', qty: 3, unit: 'точка', unitPrice: 80_000 },
            ],
            materials: [
              { name: 'ПП-трубы', qty: 5, unit: 'м.п.', unitPrice: 25_000 },
              { name: 'Фитинги', qty: 8, unit: 'шт.', unitPrice: 8_000 },
              { name: 'Краны, подводка', qty: 1, unit: 'компл.', unitPrice: 50_000 },
            ],
            days: 2,
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════
  // 2. ЭЛЕКТРИКА
  // ════════════════════════════════════════════
  {
    slug: 'electrical',
    name: 'Электрика',
    defaultUnit: { unit: 'точка', pricePerUnit: 60_000, minQty: 1, label: 'Электрическая точка' },
    problems: [
      {
        keywords: ['розетка', 'розетки', 'сломалась розетка', 'искрит', 'не работает розетка', 'выпала розетка', 'нет электричества'],
        problemName: 'Ремонт / замена розетки',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Замена розетки (1 шт.)',
            description: 'Замена одной неисправной розетки.',
            works: [
              { name: 'Выезд электрика', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Замена розетки', qty: 1, unit: 'шт.', unitPrice: 35_000 },
            ],
            materials: [
              { name: 'Розетка (Schneider/Legrand)', qty: 1, unit: 'шт.', unitPrice: 25_000 },
            ],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Замена блока розеток (2-3 шт.)',
            description: 'Замена группы розеток с проверкой проводки.',
            works: [
              { name: 'Выезд электрика', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Замена розеток', qty: 3, unit: 'шт.', unitPrice: 35_000 },
              { name: 'Проверка проводки в линии', qty: 1, unit: 'линия', unitPrice: 30_000 },
            ],
            materials: [
              { name: 'Розетки', qty: 3, unit: 'шт.', unitPrice: 25_000 },
              { name: 'Провод ПВС 3×2.5', qty: 2, unit: 'м.п.', unitPrice: 8_000 },
            ],
            days: 1,
          },
          {
            tier: 'BEST',
            title: 'Замена розеток + новая линия',
            description: 'Замена розеток с прокладкой новой линии от щитка.',
            works: [
              { name: 'Выезд электрика', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Замена розеток', qty: 4, unit: 'шт.', unitPrice: 35_000 },
              { name: 'Штробление стены', qty: 3, unit: 'м.п.', unitPrice: 25_000 },
              { name: 'Прокладка кабеля', qty: 5, unit: 'м.п.', unitPrice: 15_000 },
              { name: 'Установка автомата в щиток', qty: 1, unit: 'шт.', unitPrice: 40_000 },
            ],
            materials: [
              { name: 'Розетки', qty: 4, unit: 'шт.', unitPrice: 25_000 },
              { name: 'Кабель ВВГнг 3×2.5', qty: 5, unit: 'м.п.', unitPrice: 12_000 },
              { name: 'Автомат 16А', qty: 1, unit: 'шт.', unitPrice: 30_000 },
              { name: 'Гофра, коробки', qty: 1, unit: 'компл.', unitPrice: 15_000 },
            ],
            days: 2,
          },
        ],
      },
      {
        keywords: ['свет', 'лампа', 'люстра', 'освещение', 'не горит', 'темно', 'светильник', 'бра', 'выключатель', 'потолочный свет'],
        problemName: 'Проблемы с освещением',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Замена выключателя / светильника',
            description: 'Замена неисправного выключателя или подключение светильника.',
            works: [
              { name: 'Выезд электрика', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Замена выключателя / подключение', qty: 1, unit: 'шт.', unitPrice: 40_000 },
            ],
            materials: [
              { name: 'Выключатель', qty: 1, unit: 'шт.', unitPrice: 20_000 },
            ],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Установка люстры / светильника',
            description: 'Демонтаж старого и установка нового потолочного светильника.',
            works: [
              { name: 'Выезд электрика', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Демонтаж старого', qty: 1, unit: 'шт.', unitPrice: 20_000 },
              { name: 'Установка люстры/светильника', qty: 1, unit: 'шт.', unitPrice: 80_000 },
            ],
            materials: [
              { name: 'Крепёж потолочный', qty: 1, unit: 'компл.', unitPrice: 10_000 },
            ],
            days: 1,
          },
          {
            tier: 'BEST',
            title: 'Монтаж освещения (несколько точек)',
            description: 'Установка 3-5 точек освещения с прокладкой провода.',
            works: [
              { name: 'Выезд электрика', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Установка точечных светильников', qty: 4, unit: 'шт.', unitPrice: 40_000 },
              { name: 'Прокладка провода', qty: 8, unit: 'м.п.', unitPrice: 12_000 },
              { name: 'Установка диммера/выключателя', qty: 1, unit: 'шт.', unitPrice: 40_000 },
            ],
            materials: [
              { name: 'Провод ПВС', qty: 8, unit: 'м.п.', unitPrice: 6_000 },
              { name: 'Распредкоробки', qty: 2, unit: 'шт.', unitPrice: 8_000 },
              { name: 'Крепёж', qty: 1, unit: 'компл.', unitPrice: 10_000 },
            ],
            days: 2,
          },
        ],
      },
      {
        keywords: ['проводка', 'автомат', 'щиток', 'выбивает', 'короткое замыкание', 'перегорел', 'пробки', 'электросеть', 'кабель'],
        problemName: 'Проблемы с проводкой / щитком',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Замена автомата / УЗО',
            description: 'Замена выбивающего автомата или установка УЗО.',
            works: [
              { name: 'Выезд и диагностика', qty: 1, unit: 'выезд', unitPrice: 50_000 },
              { name: 'Замена автомата', qty: 1, unit: 'шт.', unitPrice: 40_000 },
            ],
            materials: [
              { name: 'Автомат/УЗО', qty: 1, unit: 'шт.', unitPrice: 40_000 },
            ],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Ревизия щитка + замена автоматов',
            description: 'Полная проверка щитка, замена автоматов, маркировка линий.',
            works: [
              { name: 'Выезд и диагностика', qty: 1, unit: 'выезд', unitPrice: 50_000 },
              { name: 'Ревизия щитка', qty: 1, unit: 'щиток', unitPrice: 80_000 },
              { name: 'Замена автоматов', qty: 4, unit: 'шт.', unitPrice: 30_000 },
            ],
            materials: [
              { name: 'Автоматы', qty: 4, unit: 'шт.', unitPrice: 35_000 },
              { name: 'Шины, клеммы, маркировка', qty: 1, unit: 'компл.', unitPrice: 20_000 },
            ],
            days: 1,
          },
          {
            tier: 'BEST',
            title: 'Сборка нового щитка',
            description: 'Сборка нового электрощита на 12-18 модулей с УЗО.',
            works: [
              { name: 'Выезд и диагностика', qty: 1, unit: 'выезд', unitPrice: 50_000 },
              { name: 'Демонтаж старого щитка', qty: 1, unit: 'шт.', unitPrice: 30_000 },
              { name: 'Сборка нового щитка', qty: 1, unit: 'шт.', unitPrice: 200_000 },
            ],
            materials: [
              { name: 'Щиток на 18 модулей', qty: 1, unit: 'шт.', unitPrice: 80_000 },
              { name: 'Автоматы + УЗО', qty: 8, unit: 'шт.', unitPrice: 40_000 },
              { name: 'Шины, клеммы, DIN-рейка', qty: 1, unit: 'компл.', unitPrice: 30_000 },
            ],
            days: 2,
          },
        ],
      },
      {
        keywords: ['кондиционер', 'сплит', 'сплит-система', 'охлаждение', 'климат', 'жарко', 'установка кондиционера'],
        problemName: 'Установка / ремонт кондиционера',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Чистка и обслуживание кондиционера',
            description: 'Промывка фильтров, чистка внутреннего и внешнего блока.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Чистка и обслуживание', qty: 1, unit: 'шт.', unitPrice: 100_000 },
            ],
            materials: [
              { name: 'Очиститель, дезинфектант', qty: 1, unit: 'компл.', unitPrice: 15_000 },
            ],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Установка сплит-системы (стандарт)',
            description: 'Установка сплит-системы с бурением 1 отверстия, трасса до 3 м.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Монтаж внутреннего блока', qty: 1, unit: 'шт.', unitPrice: 100_000 },
              { name: 'Монтаж внешнего блока', qty: 1, unit: 'шт.', unitPrice: 80_000 },
              { name: 'Бурение отверстия в стене', qty: 1, unit: 'шт.', unitPrice: 80_000 },
              { name: 'Прокладка трассы (до 3 м)', qty: 3, unit: 'м.п.', unitPrice: 30_000 },
              { name: 'Вакуумирование и заправка', qty: 1, unit: 'услуга', unitPrice: 50_000 },
            ],
            materials: [
              { name: 'Медная трасса', qty: 3, unit: 'м.п.', unitPrice: 40_000 },
              { name: 'Кронштейны, крепёж', qty: 1, unit: 'компл.', unitPrice: 30_000 },
              { name: 'Дренажная трубка', qty: 3, unit: 'м.п.', unitPrice: 5_000 },
            ],
            days: 1,
          },
          {
            tier: 'BEST',
            title: 'Установка сплит-системы (удлинённая трасса)',
            description: 'Установка с трассой до 7 м, декоративный короб.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Монтаж внутреннего блока', qty: 1, unit: 'шт.', unitPrice: 100_000 },
              { name: 'Монтаж внешнего блока', qty: 1, unit: 'шт.', unitPrice: 80_000 },
              { name: 'Бурение отверстия', qty: 1, unit: 'шт.', unitPrice: 80_000 },
              { name: 'Прокладка трассы (до 7 м)', qty: 7, unit: 'м.п.', unitPrice: 30_000 },
              { name: 'Вакуумирование и заправка', qty: 1, unit: 'услуга', unitPrice: 50_000 },
              { name: 'Декоративный короб', qty: 7, unit: 'м.п.', unitPrice: 15_000 },
            ],
            materials: [
              { name: 'Медная трасса', qty: 7, unit: 'м.п.', unitPrice: 40_000 },
              { name: 'Кронштейны, крепёж', qty: 1, unit: 'компл.', unitPrice: 30_000 },
              { name: 'Декоративный короб', qty: 7, unit: 'м.п.', unitPrice: 12_000 },
              { name: 'Дренажная трубка', qty: 7, unit: 'м.п.', unitPrice: 5_000 },
            ],
            days: 2,
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════
  // 3. МЕБЕЛЬ
  // ════════════════════════════════════════════
  {
    slug: 'furniture',
    name: 'Сборка и ремонт мебели',
    defaultUnit: { unit: 'шт.', pricePerUnit: 100_000, minQty: 1, label: 'Единица мебели' },
    problems: [
      {
        keywords: ['шкаф', 'собрать', 'сборка', 'комод', 'стеллаж', 'купе', 'полка', 'гардероб', 'ikea', 'икеа'],
        problemName: 'Сборка мебели',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Сборка 1 предмета (стеллаж/комод)',
            description: 'Сборка одного предмета мебели из комплекта.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 30_000 },
              { name: 'Сборка мебели', qty: 1, unit: 'шт.', unitPrice: 100_000 },
            ],
            materials: [],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Сборка шкафа-купе / гарнитура',
            description: 'Сборка крупного предмета мебели (шкаф, кухня и т.д.).',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 30_000 },
              { name: 'Сборка крупной мебели', qty: 1, unit: 'шт.', unitPrice: 250_000 },
              { name: 'Навеска зеркал/полок', qty: 2, unit: 'шт.', unitPrice: 20_000 },
            ],
            materials: [
              { name: 'Дополнительный крепёж', qty: 1, unit: 'компл.', unitPrice: 10_000 },
            ],
            days: 1,
          },
          {
            tier: 'BEST',
            title: 'Сборка комплекта мебели (2-3 предмета)',
            description: 'Сборка нескольких предметов: шкаф + комод + кровать и т.п.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 30_000 },
              { name: 'Сборка мебели', qty: 3, unit: 'шт.', unitPrice: 120_000 },
              { name: 'Навеска на стену', qty: 2, unit: 'шт.', unitPrice: 30_000 },
            ],
            materials: [
              { name: 'Крепёж, дюбели', qty: 1, unit: 'компл.', unitPrice: 15_000 },
            ],
            days: 2,
          },
        ],
      },
      {
        keywords: ['сломал', 'петля', 'ручка', 'фасад', 'дверца', 'ящик', 'направляющие', 'скрипит', 'шатается', 'ремонт мебели', 'провисла'],
        problemName: 'Ремонт мебели',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Мелкий ремонт (петли/ручки)',
            description: 'Замена петель, ручек, регулировка дверец.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 30_000 },
              { name: 'Замена петель/ручек', qty: 2, unit: 'шт.', unitPrice: 20_000 },
            ],
            materials: [
              { name: 'Петли / ручки', qty: 2, unit: 'шт.', unitPrice: 15_000 },
            ],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Ремонт с заменой фурнитуры',
            description: 'Замена направляющих, петель, доводчиков.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 30_000 },
              { name: 'Замена направляющих', qty: 2, unit: 'шт.', unitPrice: 40_000 },
              { name: 'Замена петель', qty: 4, unit: 'шт.', unitPrice: 15_000 },
              { name: 'Регулировка', qty: 1, unit: 'шт.', unitPrice: 20_000 },
            ],
            materials: [
              { name: 'Направляющие (пара)', qty: 2, unit: 'пара', unitPrice: 25_000 },
              { name: 'Петли с доводчиком', qty: 4, unit: 'шт.', unitPrice: 12_000 },
            ],
            days: 1,
          },
          {
            tier: 'BEST',
            title: 'Капитальный ремонт мебели',
            description: 'Полная замена фурнитуры, ремонт каркаса, замена фасадов.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 30_000 },
              { name: 'Ремонт каркаса', qty: 1, unit: 'шт.', unitPrice: 100_000 },
              { name: 'Замена всей фурнитуры', qty: 1, unit: 'компл.', unitPrice: 80_000 },
              { name: 'Замена фасада', qty: 2, unit: 'шт.', unitPrice: 50_000 },
            ],
            materials: [
              { name: 'Фурнитура (петли, ручки, направляющие)', qty: 1, unit: 'компл.', unitPrice: 80_000 },
              { name: 'ДСП для ремонта', qty: 1, unit: 'лист', unitPrice: 50_000 },
            ],
            days: 2,
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════
  // 4. СТРОИТЕЛЬСТВО И РЕМОНТ
  // ════════════════════════════════════════════
  {
    slug: 'construction',
    name: 'Строительство и ремонт',
    defaultUnit: { unit: 'м²', pricePerUnit: 60_000, minQty: 1, label: 'Квадратный метр' },
    problems: [
      {
        keywords: ['стена', 'трещина', 'дырка', 'дыра', 'отверстие', 'штукатурка', 'обвалилась', 'осыпалась', 'выровнять', 'стены'],
        problemName: 'Ремонт стен',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Заделка отверстия / трещины',
            description: 'Заделка 1-2 отверстий или трещин в стене.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Заделка отверстий/трещин', qty: 2, unit: 'шт.', unitPrice: 30_000 },
            ],
            materials: [
              { name: 'Шпаклёвка, грунтовка', qty: 1, unit: 'компл.', unitPrice: 20_000 },
            ],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Выравнивание стены (до 5 м²)',
            description: 'Штукатурка и выравнивание участка стены.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Штукатурка стен', qty: 5, unit: 'м²', unitPrice: 40_000 },
              { name: 'Шпаклёвка', qty: 5, unit: 'м²', unitPrice: 25_000 },
            ],
            materials: [
              { name: 'Штукатурная смесь (25 кг)', qty: 2, unit: 'мешок', unitPrice: 35_000 },
              { name: 'Шпаклёвка (5 кг)', qty: 1, unit: 'ведро', unitPrice: 30_000 },
              { name: 'Грунтовка', qty: 1, unit: 'л', unitPrice: 15_000 },
            ],
            days: 2,
          },
          {
            tier: 'BEST',
            title: 'Штукатурка + шпаклёвка комнаты',
            description: 'Полное выравнивание стен в комнате (до 15 м²).',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Штукатурка стен', qty: 15, unit: 'м²', unitPrice: 40_000 },
              { name: 'Шпаклёвка под покраску', qty: 15, unit: 'м²', unitPrice: 30_000 },
              { name: 'Грунтовка', qty: 15, unit: 'м²', unitPrice: 5_000 },
            ],
            materials: [
              { name: 'Штукатурная смесь (25 кг)', qty: 6, unit: 'мешок', unitPrice: 35_000 },
              { name: 'Шпаклёвка (20 кг)', qty: 2, unit: 'ведро', unitPrice: 55_000 },
              { name: 'Грунтовка (5 л)', qty: 2, unit: 'шт.', unitPrice: 25_000 },
            ],
            days: 5,
          },
        ],
      },
      {
        keywords: ['пол', 'ламинат', 'линолеум', 'плитка на пол', 'стяжка', 'скрипит пол', 'выровнять пол', 'паркет'],
        problemName: 'Ремонт / укладка пола',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Мелкий ремонт пола (до 3 м²)',
            description: 'Замена повреждённых плиток/ламината на участке.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Ремонт участка пола', qty: 3, unit: 'м²', unitPrice: 35_000 },
            ],
            materials: [
              { name: 'Ламинат/плитка (запас)', qty: 3, unit: 'м²', unitPrice: 40_000 },
              { name: 'Клей/подложка', qty: 1, unit: 'компл.', unitPrice: 20_000 },
            ],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Укладка пола в комнате (до 12 м²)',
            description: 'Укладка ламината или линолеума в одной комнате.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Подготовка основания', qty: 12, unit: 'м²', unitPrice: 10_000 },
              { name: 'Укладка ламината/линолеума', qty: 12, unit: 'м²', unitPrice: 30_000 },
              { name: 'Установка плинтуса', qty: 14, unit: 'м.п.', unitPrice: 8_000 },
            ],
            materials: [
              { name: 'Подложка', qty: 12, unit: 'м²', unitPrice: 6_000 },
              { name: 'Плинтус', qty: 14, unit: 'м.п.', unitPrice: 10_000 },
            ],
            days: 2,
          },
          {
            tier: 'BEST',
            title: 'Стяжка + укладка пола (до 15 м²)',
            description: 'Выравнивающая стяжка и укладка покрытия.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Стяжка пола', qty: 15, unit: 'м²', unitPrice: 45_000 },
              { name: 'Укладка покрытия', qty: 15, unit: 'м²', unitPrice: 30_000 },
              { name: 'Установка плинтуса', qty: 16, unit: 'м.п.', unitPrice: 8_000 },
            ],
            materials: [
              { name: 'Смесь для стяжки (25 кг)', qty: 8, unit: 'мешок', unitPrice: 30_000 },
              { name: 'Подложка', qty: 15, unit: 'м²', unitPrice: 6_000 },
              { name: 'Плинтус', qty: 16, unit: 'м.п.', unitPrice: 10_000 },
            ],
            days: 4,
          },
        ],
      },
      {
        keywords: ['потолок', 'натяжной', 'гипсокартон', 'подвесной', 'побелка', 'трещина потолок', 'протекает потолок'],
        problemName: 'Ремонт потолка',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Мелкий ремонт потолка',
            description: 'Заделка трещин, подкраска потолка.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Ремонт и покраска потолка', qty: 5, unit: 'м²', unitPrice: 20_000 },
            ],
            materials: [
              { name: 'Шпаклёвка, краска', qty: 1, unit: 'компл.', unitPrice: 30_000 },
            ],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Шпаклёвка и покраска потолка',
            description: 'Полная шпаклёвка и покраска в одной комнате (до 15 м²).',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Шпаклёвка потолка', qty: 15, unit: 'м²', unitPrice: 25_000 },
              { name: 'Покраска (2 слоя)', qty: 15, unit: 'м²', unitPrice: 15_000 },
            ],
            materials: [
              { name: 'Шпаклёвка (20 кг)', qty: 1, unit: 'ведро', unitPrice: 55_000 },
              { name: 'Краска потолочная (5 л)', qty: 1, unit: 'ведро', unitPrice: 40_000 },
              { name: 'Грунтовка', qty: 1, unit: 'л', unitPrice: 15_000 },
            ],
            days: 3,
          },
          {
            tier: 'BEST',
            title: 'Монтаж гипсокартонного потолка',
            description: 'Одноуровневый ГКЛ потолок с покраской (до 15 м²).',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Монтаж каркаса', qty: 15, unit: 'м²', unitPrice: 30_000 },
              { name: 'Монтаж ГКЛ', qty: 15, unit: 'м²', unitPrice: 25_000 },
              { name: 'Шпаклёвка и покраска', qty: 15, unit: 'м²', unitPrice: 20_000 },
            ],
            materials: [
              { name: 'Гипсокартон (лист 1.2×2.5)', qty: 5, unit: 'лист', unitPrice: 55_000 },
              { name: 'Профиль, подвесы, крепёж', qty: 1, unit: 'компл.', unitPrice: 120_000 },
              { name: 'Шпаклёвка, серпянка, краска', qty: 1, unit: 'компл.', unitPrice: 80_000 },
            ],
            days: 4,
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════
  // 5. МАЛЯРНЫЕ И ОТДЕЛОЧНЫЕ РАБОТЫ
  // ════════════════════════════════════════════
  {
    slug: 'painting',
    name: 'Малярные и отделочные работы',
    defaultUnit: { unit: 'м²', pricePerUnit: 25_000, minQty: 1, label: 'Квадратный метр' },
    problems: [
      {
        keywords: ['покрасить', 'покраска', 'краска', 'перекрасить', 'цвет', 'стены покрасить', 'облезла'],
        problemName: 'Покраска стен',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Покраска участка стены (до 5 м²)',
            description: 'Подкраска одного участка стены.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 30_000 },
              { name: 'Покраска (2 слоя)', qty: 5, unit: 'м²', unitPrice: 15_000 },
            ],
            materials: [
              { name: 'Краска интерьерная (1 л)', qty: 1, unit: 'шт.', unitPrice: 35_000 },
              { name: 'Валик, кисть, малярный скотч', qty: 1, unit: 'компл.', unitPrice: 15_000 },
            ],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Покраска комнаты (до 40 м²)',
            description: 'Покраска стен в одной комнате с подготовкой.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 30_000 },
              { name: 'Подготовка (грунтовка, мелкий ремонт)', qty: 40, unit: 'м²', unitPrice: 5_000 },
              { name: 'Покраска (2 слоя)', qty: 40, unit: 'м²', unitPrice: 15_000 },
            ],
            materials: [
              { name: 'Краска интерьерная (10 л)', qty: 1, unit: 'ведро', unitPrice: 150_000 },
              { name: 'Грунтовка (5 л)', qty: 1, unit: 'шт.', unitPrice: 25_000 },
              { name: 'Расходники (валики, скотч, плёнка)', qty: 1, unit: 'компл.', unitPrice: 25_000 },
            ],
            days: 2,
          },
          {
            tier: 'BEST',
            title: 'Покраска квартиры (2-3 комнаты)',
            description: 'Полная покраска с выравниванием и подготовкой.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 30_000 },
              { name: 'Подготовка стен', qty: 100, unit: 'м²', unitPrice: 8_000 },
              { name: 'Покраска (2 слоя)', qty: 100, unit: 'м²', unitPrice: 15_000 },
            ],
            materials: [
              { name: 'Краска интерьерная (20 л)', qty: 2, unit: 'ведро', unitPrice: 150_000 },
              { name: 'Грунтовка (10 л)', qty: 1, unit: 'канистра', unitPrice: 45_000 },
              { name: 'Шпаклёвка', qty: 1, unit: 'ведро', unitPrice: 55_000 },
              { name: 'Расходники', qty: 1, unit: 'компл.', unitPrice: 40_000 },
            ],
            days: 5,
          },
        ],
      },
      {
        keywords: ['обои', 'поклейка', 'поклеить', 'переклеить', 'отходят обои', 'отклеились'],
        problemName: 'Поклейка обоев',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Подклейка / замена полосы обоев',
            description: 'Подклейка отошедших обоев или замена 1-2 полос.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 30_000 },
              { name: 'Подклейка/замена', qty: 2, unit: 'полоса', unitPrice: 20_000 },
            ],
            materials: [
              { name: 'Клей обойный', qty: 1, unit: 'упак.', unitPrice: 15_000 },
            ],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Оклейка комнаты обоями (до 15 м²)',
            description: 'Полная оклейка стен обоями в одной комнате.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 30_000 },
              { name: 'Снятие старых обоев', qty: 40, unit: 'м²', unitPrice: 5_000 },
              { name: 'Грунтовка стен', qty: 40, unit: 'м²', unitPrice: 3_000 },
              { name: 'Поклейка обоев', qty: 40, unit: 'м²', unitPrice: 18_000 },
            ],
            materials: [
              { name: 'Клей обойный', qty: 2, unit: 'упак.', unitPrice: 15_000 },
              { name: 'Грунтовка', qty: 1, unit: 'л', unitPrice: 15_000 },
            ],
            days: 2,
          },
          {
            tier: 'BEST',
            title: 'Оклейка квартиры обоями (2-3 комнаты)',
            description: 'Полная оклейка с выравниванием стен.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 30_000 },
              { name: 'Снятие старых обоев', qty: 100, unit: 'м²', unitPrice: 5_000 },
              { name: 'Выравнивание стен', qty: 100, unit: 'м²', unitPrice: 10_000 },
              { name: 'Поклейка обоев', qty: 100, unit: 'м²', unitPrice: 18_000 },
            ],
            materials: [
              { name: 'Клей обойный', qty: 5, unit: 'упак.', unitPrice: 15_000 },
              { name: 'Шпаклёвка', qty: 2, unit: 'ведро', unitPrice: 55_000 },
              { name: 'Грунтовка', qty: 2, unit: 'л', unitPrice: 15_000 },
            ],
            days: 5,
          },
        ],
      },
      {
        keywords: ['плитка', 'кафель', 'керамогранит', 'класть плитку', 'положить плитку', 'отвалилась плитка', 'ванная плитка'],
        problemName: 'Укладка / ремонт плитки',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Замена 1-3 плиток',
            description: 'Замена отвалившихся или треснувших плиток.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 30_000 },
              { name: 'Демонтаж + укладка плиток', qty: 3, unit: 'шт.', unitPrice: 25_000 },
            ],
            materials: [
              { name: 'Плиточный клей', qty: 1, unit: 'кг', unitPrice: 5_000 },
              { name: 'Затирка', qty: 1, unit: 'кг', unitPrice: 8_000 },
            ],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Укладка плитки (до 5 м²)',
            description: 'Укладка плитки на пол или стену (фартук/экран).',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 30_000 },
              { name: 'Подготовка поверхности', qty: 5, unit: 'м²', unitPrice: 15_000 },
              { name: 'Укладка плитки', qty: 5, unit: 'м²', unitPrice: 60_000 },
              { name: 'Затирка швов', qty: 5, unit: 'м²', unitPrice: 10_000 },
            ],
            materials: [
              { name: 'Плиточный клей (25 кг)', qty: 1, unit: 'мешок', unitPrice: 35_000 },
              { name: 'Затирка (2 кг)', qty: 1, unit: 'упак.', unitPrice: 20_000 },
              { name: 'Крестики, СВП', qty: 1, unit: 'компл.', unitPrice: 10_000 },
            ],
            days: 2,
          },
          {
            tier: 'BEST',
            title: 'Облицовка ванной плиткой (до 15 м²)',
            description: 'Полная облицовка стен и пола в ванной.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 30_000 },
              { name: 'Демонтаж старой плитки', qty: 15, unit: 'м²', unitPrice: 15_000 },
              { name: 'Выравнивание поверхности', qty: 15, unit: 'м²', unitPrice: 20_000 },
              { name: 'Укладка плитки', qty: 15, unit: 'м²', unitPrice: 60_000 },
              { name: 'Затирка швов', qty: 15, unit: 'м²', unitPrice: 10_000 },
            ],
            materials: [
              { name: 'Плиточный клей (25 кг)', qty: 4, unit: 'мешок', unitPrice: 35_000 },
              { name: 'Затирка (5 кг)', qty: 1, unit: 'упак.', unitPrice: 40_000 },
              { name: 'Грунтовка, СВП, крестики', qty: 1, unit: 'компл.', unitPrice: 25_000 },
            ],
            days: 5,
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════
  // 6. ОКНА И ДВЕРИ
  // ════════════════════════════════════════════
  {
    slug: 'windows-doors',
    name: 'Окна и двери',
    defaultUnit: { unit: 'шт.', pricePerUnit: 80_000, minQty: 1, label: 'Единица (окно/дверь)' },
    problems: [
      {
        keywords: ['окно', 'стеклопакет', 'дует', 'продувает', 'регулировка', 'пластиковое окно', 'фурнитура окна', 'разбилось'],
        problemName: 'Ремонт / регулировка окна',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Регулировка окна + замена уплотнителя',
            description: 'Регулировка створок, замена уплотнительной резинки.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 30_000 },
              { name: 'Регулировка фурнитуры', qty: 1, unit: 'створка', unitPrice: 40_000 },
              { name: 'Замена уплотнителя', qty: 4, unit: 'м.п.', unitPrice: 10_000 },
            ],
            materials: [
              { name: 'Уплотнитель', qty: 4, unit: 'м.п.', unitPrice: 5_000 },
              { name: 'Смазка фурнитуры', qty: 1, unit: 'шт.', unitPrice: 8_000 },
            ],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Замена фурнитуры окна',
            description: 'Замена ручки, ножничного механизма.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 30_000 },
              { name: 'Замена фурнитуры', qty: 1, unit: 'створка', unitPrice: 80_000 },
              { name: 'Регулировка', qty: 1, unit: 'створка', unitPrice: 30_000 },
            ],
            materials: [
              { name: 'Фурнитура (ручка, ножницы)', qty: 1, unit: 'компл.', unitPrice: 60_000 },
            ],
            days: 1,
          },
          {
            tier: 'BEST',
            title: 'Замена стеклопакета',
            description: 'Замена стеклопакета в существующей раме.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 30_000 },
              { name: 'Демонтаж старого стеклопакета', qty: 1, unit: 'шт.', unitPrice: 30_000 },
              { name: 'Установка нового стеклопакета', qty: 1, unit: 'шт.', unitPrice: 60_000 },
            ],
            materials: [
              { name: 'Стеклопакет двухкамерный', qty: 1, unit: 'шт.', unitPrice: 200_000 },
              { name: 'Штапики, уплотнитель', qty: 1, unit: 'компл.', unitPrice: 15_000 },
            ],
            days: 1,
          },
        ],
      },
      {
        keywords: ['дверь', 'замок', 'петли двери', 'скрипит дверь', 'не закрывается дверь', 'установить дверь', 'межкомнатная'],
        problemName: 'Ремонт / установка двери',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Ремонт двери (замок/петли)',
            description: 'Замена замка или петель, регулировка.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 30_000 },
              { name: 'Замена замка/петель', qty: 1, unit: 'шт.', unitPrice: 50_000 },
            ],
            materials: [
              { name: 'Замок / петли', qty: 1, unit: 'компл.', unitPrice: 40_000 },
            ],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Установка межкомнатной двери',
            description: 'Установка двери в готовый проём с фурнитурой.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 30_000 },
              { name: 'Установка дверной коробки', qty: 1, unit: 'шт.', unitPrice: 100_000 },
              { name: 'Навеска полотна', qty: 1, unit: 'шт.', unitPrice: 50_000 },
              { name: 'Установка наличников', qty: 1, unit: 'компл.', unitPrice: 40_000 },
              { name: 'Установка замка/ручки', qty: 1, unit: 'шт.', unitPrice: 30_000 },
            ],
            materials: [
              { name: 'Монтажная пена', qty: 1, unit: 'баллон', unitPrice: 15_000 },
              { name: 'Крепёж', qty: 1, unit: 'компл.', unitPrice: 10_000 },
            ],
            days: 1,
          },
          {
            tier: 'BEST',
            title: 'Установка двери с расширением проёма',
            description: 'Расширение/подготовка проёма + установка двери.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 30_000 },
              { name: 'Подготовка / расширение проёма', qty: 1, unit: 'проём', unitPrice: 80_000 },
              { name: 'Установка дверной коробки', qty: 1, unit: 'шт.', unitPrice: 100_000 },
              { name: 'Навеска полотна', qty: 1, unit: 'шт.', unitPrice: 50_000 },
              { name: 'Наличники + доборы', qty: 1, unit: 'компл.', unitPrice: 60_000 },
              { name: 'Установка замка/ручки', qty: 1, unit: 'шт.', unitPrice: 30_000 },
            ],
            materials: [
              { name: 'Монтажная пена', qty: 2, unit: 'баллон', unitPrice: 15_000 },
              { name: 'Доборы', qty: 1, unit: 'компл.', unitPrice: 40_000 },
              { name: 'Крепёж', qty: 1, unit: 'компл.', unitPrice: 15_000 },
            ],
            days: 2,
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════
  // 7. БЫТОВАЯ ТЕХНИКА
  // ════════════════════════════════════════════
  {
    slug: 'appliance-install',
    name: 'Установка бытовой техники',
    defaultUnit: { unit: 'шт.', pricePerUnit: 80_000, minQty: 1, label: 'Единица техники' },
    problems: [
      {
        keywords: ['стиральная', 'посудомоечная', 'машина', 'подключить', 'установить технику', 'встройка', 'газовая', 'плита', 'духовка', 'варочная'],
        problemName: 'Установка бытовой техники',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Подключение техники (к готовым выводам)',
            description: 'Подключение стиральной/посудомоечной машины к существующим выводам.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Подключение к выводам', qty: 1, unit: 'шт.', unitPrice: 50_000 },
              { name: 'Проверка и тестирование', qty: 1, unit: 'шт.', unitPrice: 20_000 },
            ],
            materials: [
              { name: 'Шланги, хомуты', qty: 1, unit: 'компл.', unitPrice: 15_000 },
            ],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Установка с подводкой коммуникаций',
            description: 'Установка техники с прокладкой подводки воды/слива.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Подводка воды (тройник)', qty: 1, unit: 'точка', unitPrice: 60_000 },
              { name: 'Подключение слива', qty: 1, unit: 'точка', unitPrice: 40_000 },
              { name: 'Установка и тест', qty: 1, unit: 'шт.', unitPrice: 50_000 },
            ],
            materials: [
              { name: 'Тройник, кран, подводка', qty: 1, unit: 'компл.', unitPrice: 30_000 },
              { name: 'Сифон с отводом', qty: 1, unit: 'шт.', unitPrice: 20_000 },
            ],
            days: 1,
          },
          {
            tier: 'BEST',
            title: 'Полная установка встраиваемой техники',
            description: 'Встройка техники в мебель + все коммуникации.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Врезка в столешницу/мебель', qty: 1, unit: 'шт.', unitPrice: 80_000 },
              { name: 'Подводка воды и слива', qty: 1, unit: 'компл.', unitPrice: 80_000 },
              { name: 'Электроподключение', qty: 1, unit: 'точка', unitPrice: 50_000 },
              { name: 'Тестирование', qty: 1, unit: 'шт.', unitPrice: 20_000 },
            ],
            materials: [
              { name: 'Коммуникации (трубы, шланги)', qty: 1, unit: 'компл.', unitPrice: 40_000 },
              { name: 'Силикон, крепёж', qty: 1, unit: 'компл.', unitPrice: 10_000 },
            ],
            days: 1,
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════
  // 8. ПЛОТНИЦКИЕ РАБОТЫ
  // ════════════════════════════════════════════
  {
    slug: 'carpentry',
    name: 'Плотницкие работы',
    defaultUnit: { unit: 'м.п.', pricePerUnit: 50_000, minQty: 1, label: 'Погонный метр' },
    problems: [
      {
        keywords: ['забор', 'ворота', 'калитка', 'навес', 'беседка', 'терраса', 'крыльцо', 'перила', 'лестница'],
        problemName: 'Наружные деревянные конструкции',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Мелкий ремонт (до 3 м.п.)',
            description: 'Ремонт повреждённых участков забора/перил.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Ремонт деревянных конструкций', qty: 3, unit: 'м.п.', unitPrice: 40_000 },
            ],
            materials: [
              { name: 'Доска / брус', qty: 3, unit: 'м.п.', unitPrice: 20_000 },
              { name: 'Крепёж', qty: 1, unit: 'компл.', unitPrice: 10_000 },
            ],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Замена секции забора (до 5 м.п.)',
            description: 'Замена повреждённой секции деревянного забора.',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Демонтаж старого участка', qty: 5, unit: 'м.п.', unitPrice: 15_000 },
              { name: 'Монтаж нового забора', qty: 5, unit: 'м.п.', unitPrice: 50_000 },
            ],
            materials: [
              { name: 'Доска / штакетник', qty: 5, unit: 'м.п.', unitPrice: 25_000 },
              { name: 'Брус для каркаса', qty: 3, unit: 'шт.', unitPrice: 30_000 },
              { name: 'Крепёж, пропитка', qty: 1, unit: 'компл.', unitPrice: 20_000 },
            ],
            days: 2,
          },
          {
            tier: 'BEST',
            title: 'Строительство навеса / беседки',
            description: 'Строительство деревянного навеса до 6 м².',
            works: [
              { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 40_000 },
              { name: 'Установка столбов', qty: 4, unit: 'шт.', unitPrice: 50_000 },
              { name: 'Монтаж каркаса', qty: 6, unit: 'м²', unitPrice: 60_000 },
              { name: 'Монтаж кровли', qty: 6, unit: 'м²', unitPrice: 40_000 },
            ],
            materials: [
              { name: 'Брус 100×100', qty: 4, unit: 'шт.', unitPrice: 60_000 },
              { name: 'Доска для каркаса', qty: 10, unit: 'м.п.', unitPrice: 20_000 },
              { name: 'Поликарбонат / профлист', qty: 6, unit: 'м²', unitPrice: 40_000 },
              { name: 'Крепёж, пропитка', qty: 1, unit: 'компл.', unitPrice: 30_000 },
            ],
            days: 3,
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════
  // 9. КЛИНИНГ
  // ════════════════════════════════════════════
  {
    slug: 'cleaning',
    name: 'Клининг и уборка',
    defaultUnit: { unit: 'м²', pricePerUnit: 5_000, minQty: 20, label: 'Квадратный метр площади' },
    problems: [
      {
        keywords: ['уборка', 'убрать', 'грязно', 'генеральная', 'помыть', 'почистить', 'пыль', 'мусор'],
        problemName: 'Уборка помещения',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Стандартная уборка (до 50 м²)',
            description: 'Влажная уборка, пылесос, протирка поверхностей.',
            works: [
              { name: 'Стандартная уборка', qty: 50, unit: 'м²', unitPrice: 3_000 },
            ],
            materials: [
              { name: 'Моющие средства', qty: 1, unit: 'компл.', unitPrice: 20_000 },
            ],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Генеральная уборка (до 70 м²)',
            description: 'Глубокая уборка с мытьём окон, санузлов, кухни.',
            works: [
              { name: 'Генеральная уборка', qty: 70, unit: 'м²', unitPrice: 5_000 },
              { name: 'Мытьё окон', qty: 4, unit: 'шт.', unitPrice: 20_000 },
            ],
            materials: [
              { name: 'Профессиональные средства', qty: 1, unit: 'компл.', unitPrice: 35_000 },
            ],
            days: 1,
          },
          {
            tier: 'BEST',
            title: 'Генеральная уборка + химчистка',
            description: 'Полная уборка с химчисткой мебели и ковров.',
            works: [
              { name: 'Генеральная уборка', qty: 80, unit: 'м²', unitPrice: 5_000 },
              { name: 'Мытьё окон', qty: 6, unit: 'шт.', unitPrice: 20_000 },
              { name: 'Химчистка мебели', qty: 3, unit: 'предмет', unitPrice: 60_000 },
              { name: 'Химчистка ковров', qty: 10, unit: 'м²', unitPrice: 15_000 },
            ],
            materials: [
              { name: 'Профессиональные средства', qty: 1, unit: 'компл.', unitPrice: 50_000 },
            ],
            days: 1,
          },
        ],
      },
      {
        keywords: ['после ремонта', 'строительная пыль', 'послеремонтная', 'цемент', 'побелка пыль'],
        problemName: 'Уборка после ремонта',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Уборка после ремонта (1 комната)',
            description: 'Уборка строительной пыли и мусора из одной комнаты.',
            works: [
              { name: 'Уборка после ремонта', qty: 20, unit: 'м²', unitPrice: 8_000 },
              { name: 'Вынос строительного мусора', qty: 1, unit: 'услуга', unitPrice: 50_000 },
            ],
            materials: [
              { name: 'Мусорные мешки, средства', qty: 1, unit: 'компл.', unitPrice: 15_000 },
            ],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Уборка после ремонта (квартира до 60 м²)',
            description: 'Комплексная уборка после ремонта всей квартиры.',
            works: [
              { name: 'Уборка после ремонта', qty: 60, unit: 'м²', unitPrice: 8_000 },
              { name: 'Мытьё окон', qty: 4, unit: 'шт.', unitPrice: 20_000 },
              { name: 'Вынос мусора', qty: 1, unit: 'услуга', unitPrice: 80_000 },
            ],
            materials: [
              { name: 'Профессиональные средства', qty: 1, unit: 'компл.', unitPrice: 30_000 },
            ],
            days: 2,
          },
          {
            tier: 'BEST',
            title: 'Уборка после ремонта (квартира 80+ м²)',
            description: 'Полная послеремонтная уборка большой квартиры/дома.',
            works: [
              { name: 'Уборка после ремонта', qty: 100, unit: 'м²', unitPrice: 8_000 },
              { name: 'Мытьё окон', qty: 8, unit: 'шт.', unitPrice: 20_000 },
              { name: 'Химчистка', qty: 1, unit: 'услуга', unitPrice: 100_000 },
              { name: 'Вынос мусора', qty: 1, unit: 'услуга', unitPrice: 100_000 },
            ],
            materials: [
              { name: 'Профессиональные средства', qty: 1, unit: 'компл.', unitPrice: 50_000 },
            ],
            days: 2,
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════
  // 10. САДОВОДСТВО
  // ════════════════════════════════════════════
  {
    slug: 'garden-outdoor',
    name: 'Садоводство и наружные работы',
    defaultUnit: { unit: 'м²', pricePerUnit: 10_000, minQty: 10, label: 'Квадратный метр участка' },
    problems: [
      {
        keywords: ['газон', 'трава', 'стричь', 'косить', 'покос', 'сад', 'деревья', 'кусты', 'обрезка', 'полив'],
        problemName: 'Уход за садом / газоном',
        solutions: [
          {
            tier: 'GOOD',
            title: 'Покос газона (до 200 м²)',
            description: 'Стрижка газона с уборкой скошенной травы.',
            works: [
              { name: 'Покос газона', qty: 200, unit: 'м²', unitPrice: 500 },
              { name: 'Уборка травы', qty: 1, unit: 'услуга', unitPrice: 30_000 },
            ],
            materials: [],
            days: 1,
          },
          {
            tier: 'BETTER',
            title: 'Обрезка деревьев + покос',
            description: 'Обрезка 3-5 деревьев и стрижка газона.',
            works: [
              { name: 'Покос газона', qty: 200, unit: 'м²', unitPrice: 500 },
              { name: 'Обрезка деревьев', qty: 4, unit: 'шт.', unitPrice: 40_000 },
              { name: 'Уборка территории', qty: 1, unit: 'услуга', unitPrice: 50_000 },
            ],
            materials: [],
            days: 1,
          },
          {
            tier: 'BEST',
            title: 'Комплексный уход за участком',
            description: 'Покос, обрезка, прополка, уборка территории.',
            works: [
              { name: 'Покос газона', qty: 300, unit: 'м²', unitPrice: 500 },
              { name: 'Обрезка деревьев и кустов', qty: 8, unit: 'шт.', unitPrice: 40_000 },
              { name: 'Прополка клумб', qty: 10, unit: 'м²', unitPrice: 5_000 },
              { name: 'Уборка территории', qty: 1, unit: 'услуга', unitPrice: 80_000 },
            ],
            materials: [
              { name: 'Мешки для мусора', qty: 1, unit: 'компл.', unitPrice: 10_000 },
            ],
            days: 2,
          },
        ],
      },
    ],
  },
];

// ═══════════════════════════════════════════════
// ФУНКЦИИ РАСЧЁТА ЦЕН
// ═══════════════════════════════════════════════

/**
 * Найти подходящую проблему по описанию в каталоге расценок
 */
export function findProblemByDescription(
  categorySlug: string,
  description: string
): ProblemSolution | null {
  const catalog = PRICING_CATALOG.find(c => c.slug === categorySlug);
  if (!catalog) return null;

  const lower = description.toLowerCase();
  // Простой стемминг: обрезаем русские окончания (розетку/розетки/розеткой → розетк)
  const stem = (w: string) => w.replace(/(ами|ями|ов|ев|ей|ой|ий|ый|ая|яя|ое|ее|ие|ые|ую|юю|ого|его|ому|ему|ость|ам|ям|ах|ях|ен|ан|\u0443|ю|а|я|и|ы|о|е|ь)$/i, '');

  let bestMatch: ProblemSolution | null = null;
  let bestScore = 0;

  for (const problem of catalog.problems) {
    let score = 0;
    for (const kw of problem.keywords) {
      const kwLower = kw.toLowerCase();
      // Точное совпадение
      if (lower.includes(kwLower)) {
        score += kw.length;
        continue;
      }
      // Нечёткое: сравниваем корни слов
      const kwStem = stem(kwLower);
      if (kwStem.length >= 3) {
        const descWords = lower.split(/\s+/);
        for (const dw of descWords) {
          const dwStem = stem(dw);
          if (dwStem.length >= 3 && (dwStem.startsWith(kwStem) || kwStem.startsWith(dwStem))) {
            score += kwStem.length;
            break;
          }
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = problem;
    }
  }

  return bestMatch;
}

/**
 * Рассчитать итоговую стоимость для решения
 */
export function calculateSolutionPrice(
  solution: ProblemSolution['solutions'][0]
): { workTotal: number; materialsTotal: number; total: number } {
  const workTotal = solution.works.reduce((sum, w) => sum + w.qty * w.unitPrice, 0);
  const materialsTotal = solution.materials.reduce((sum, m) => sum + m.qty * m.unitPrice, 0);
  return { workTotal, materialsTotal, total: workTotal + materialsTotal };
}

/**
 * Построить 3 варианта (GOOD / BETTER / BEST) из каталога расценок
 */
export function buildSmartVariants(
  categorySlug: string,
  categoryName: string,
  description: string
): {
  problemName: string;
  variants: {
    tier: 'GOOD' | 'BETTER' | 'BEST';
    tierLabel: string;
    title: string;
    description: string;
    works: { name: string; qty: number; unit: string; unitPrice: number; total: number }[];
    materials: { name: string; qty: number; unit: string; unitPrice: number; total: number }[];
    estimatedPrice: number;
    estimatedDays: number;
    confidence: number;
  }[];
} | null {
  const problem = findProblemByDescription(categorySlug, description);
  if (!problem) return null;

  const TIER_LABELS: Record<string, string> = {
    GOOD: 'Хороший — быстрое решение',
    BETTER: 'Отличный — оптимальный',
    BEST: 'Премиум — капитальное решение',
  };
  const TIER_CONFIDENCE: Record<string, number> = {
    GOOD: 0.85,
    BETTER: 0.92,
    BEST: 0.97,
  };

  const variants = problem.solutions.map(sol => {
    const pricing = calculateSolutionPrice(sol);
    return {
      tier: sol.tier,
      tierLabel: TIER_LABELS[sol.tier] || sol.tier,
      title: sol.title,
      description: sol.description,
      works: sol.works.map(w => ({
        name: w.name,
        qty: w.qty,
        unit: w.unit,
        unitPrice: w.unitPrice,
        total: w.qty * w.unitPrice,
      })),
      materials: sol.materials.map(m => ({
        name: m.name,
        qty: m.qty,
        unit: m.unit,
        unitPrice: m.unitPrice,
        total: m.qty * m.unitPrice,
      })),
      estimatedPrice: pricing.total,
      estimatedDays: sol.days,
      confidence: TIER_CONFIDENCE[sol.tier] || 0.85,
    };
  });

  return { problemName: problem.problemName, variants };
}
