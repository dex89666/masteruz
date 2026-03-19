// ============================================
// MasterUz — Полный каталог услуг (v4 — Расширенный handyman 2026)
// 14 категорий, 60+ подкатегорий, 300+ задач
// Цены: минимальные для рынка Ташкента 2026 (UZS)
// Золотое правило: "Мы не говорим НЕТ. Мы можем ВСЁ."
// ============================================

export interface TaskDef {
  slug: string;
  name: string;
  nameUz: string;
  nameEn: string;
  description: string;
  descriptionUz: string;
  descriptionEn: string;
  estimatedTime: string;
  estimatedTimeUz: string;
  estimatedTimeEn: string;
  minPrice: number; // Минимальная цена в сумах (UZS)
}

export interface SubcategoryDef {
  slug: string;
  name: string;
  nameUz: string;
  nameEn: string;
  icon: string;
  tasks: TaskDef[];
}

export interface CategoryDef {
  slug: string;
  name: string;
  nameUz: string;
  nameEn: string;
  icon: string;
  subcategories: SubcategoryDef[];
  /** Slug родительской категории (если есть — это дочерняя категория) */
  parentSlug?: string;
}

/**
 * 6 родительских категорий (naimi.kz-style)
 * Не содержат subcategories — только группируют дочерние категории
 */
export const PARENT_CATEGORIES: CategoryDef[] = [
  { slug: 'repair-finishing',         name: 'Ремонт и отделка',              nameUz: 'Taʼmir va pardozlash',            nameEn: 'Repair & finishing',           icon: 'Hammer', subcategories: [] },
  { slug: 'construction-building',    name: 'Строительство и монтаж',        nameUz: 'Qurilish va montaj',              nameEn: 'Construction & installation',  icon: 'HardHat', subcategories: [] },
  { slug: 'home-help',                name: 'Помощь по дому',                nameUz: 'Uyga yordam',                     nameEn: 'Home help',                    icon: 'Home', subcategories: [] },
  { slug: 'crafts-manufacturing',     name: 'Изготовление и ремесло',        nameUz: 'Ishlab chiqarish va hunarmandchilik', nameEn: 'Crafts & manufacturing',   icon: 'Armchair', subcategories: [] },
  { slug: 'tech-equipment',           name: 'Техника и оборудование',        nameUz: 'Texnika va uskunalar',            nameEn: 'Tech & equipment',             icon: 'Zap', subcategories: [] },
  { slug: 'transport-logistics',      name: 'Перевозки и грузчики',          nameUz: 'Tashish va yukchilar',            nameEn: 'Transport & movers',           icon: 'Truck', subcategories: [] },
];

// Стоимость выезда мастера (платформенная константа)
export const VISIT_FEE = 100000; // 100 000 сум

export const SERVICE_CATALOG: CategoryDef[] = [
  // ═══════════════════════════════════════════
  // 1. САНТЕХНИКА
  // ═══════════════════════════════════════════
  {
    slug: 'plumbing',
    name: 'Сантехника',
    nameUz: 'Santexnika',
    nameEn: 'Plumbing',
    icon: 'Wrench',
    parentSlug: 'repair-finishing',
    subcategories: [
      {
        slug: 'plumbing-faucets',
        name: 'Установка и ремонт кранов/смесителей',
        nameUz: 'Kran/aralashtirgich oʻrnatish va taʼmirlash',
        nameEn: 'Faucet installation & repair',
        icon: 'Droplets',
        tasks: [
          { slug: 'install-faucet', name: 'Установка нового крана/смесителя', nameUz: 'Yangi kran/aralashtirgich oʻrnatish', nameEn: 'Install new faucet/mixer', description: 'Монтаж на раковину/ванну, подключение шлангов, проверка на протечки', descriptionUz: 'Lavabo/vannaga oʻrnatish, shlanglarni ulash, oqish tekshirish', descriptionEn: 'Mount on sink/bath, connect hoses, check for leaks', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 150000 },
          { slug: 'repair-faucet-leak', name: 'Ремонт протечки крана', nameUz: 'Kran oqishini taʼmirlash', nameEn: 'Fix faucet leak', description: 'Замена прокладок, картриджа, уплотнителей', descriptionUz: 'Prokladkalar, kartridj, zichlagichlarni almashtirish', descriptionEn: 'Replace gaskets, cartridge, seals', estimatedTime: '20-40 мин', estimatedTimeUz: '20-40 daq', estimatedTimeEn: '20-40 min', minPrice: 100000 },
          { slug: 'replace-siphon', name: 'Замена сифона', nameUz: 'Sifonni almashtirish', nameEn: 'Replace siphon', description: 'Демонтаж старого, установка нового под раковину/ванну', descriptionUz: 'Eskisini demontaj qilish, lavabo/vanna ostiga yangisini oʻrnatish', descriptionEn: 'Remove old, install new under sink/bath', estimatedTime: '30 мин', estimatedTimeUz: '30 daq', estimatedTimeEn: '30 min', minPrice: 80000 },
          { slug: 'install-water-filter', name: 'Установка фильтров для воды', nameUz: 'Suv filtri oʻrnatish', nameEn: 'Install water filters', description: 'Монтаж под раковину или на трубу', descriptionUz: 'Lavabo ostiga yoki trubaga oʻrnatish', descriptionEn: 'Mount under sink or on pipe', estimatedTime: '45-90 мин', estimatedTimeUz: '45-90 daq', estimatedTimeEn: '45-90 min', minPrice: 120000 },
          { slug: 'demontazh-plumbing-faucets', name: 'Демонтаж крана/смесителя', nameUz: 'Kran/aralashtirgichni demontaj qilish', nameEn: 'Remove faucet/mixer', description: 'Снятие старого смесителя, заглушка труб', descriptionUz: 'Eski aralashtirgichni olib tashlash, trubalarni berkitish', descriptionEn: 'Remove old faucet, plug pipes', estimatedTime: '15-30 мин', estimatedTimeUz: '15-30 daq', estimatedTimeEn: '15-30 min', minPrice: 60000 },
        ],
      },
      {
        slug: 'plumbing-pipes',
        name: 'Ремонт труб и канализации',
        nameUz: 'Truba va kanalizatsiya taʼmiri',
        nameEn: 'Pipe & drain repair',
        icon: 'Pipette',
        tasks: [
          { slug: 'unclog-drain', name: 'Прочистка засора', nameUz: 'Tiqilib qolishni tozalash', nameEn: 'Unclog drain', description: 'Использование троса или химии для труб, сифонов', descriptionUz: 'Truba, sifonlar uchun tros yoki kimyoviy moddalar', descriptionEn: 'Use snake or chemicals for pipes, siphons', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 250000 },
          { slug: 'replace-pipes', name: 'Замена труб', nameUz: 'Trubalarni almashtirish', nameEn: 'Replace pipes', description: 'Пластиковые/металлические трубы, пайка/соединение', descriptionUz: 'Plastik/metall trubalar, payvandlash/ulash', descriptionEn: 'Plastic/metal pipes, soldering/connecting', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 200000 },
          { slug: 'install-water-meter', name: 'Установка счётчиков воды', nameUz: 'Suv hisoblagich oʻrnatish', nameEn: 'Install water meters', description: 'Монтаж горячего/холодного счётчика, опломбировка', descriptionUz: 'Issiq/sovuq hisoblagich oʻrnatish, plombalash', descriptionEn: 'Mount hot/cold meters, sealing', estimatedTime: '1 час', estimatedTimeUz: '1 soat', estimatedTimeEn: '1 hour', minPrice: 150000 },
          { slug: 'repair-sewage', name: 'Ремонт канализации', nameUz: 'Kanalizatsiyani taʼmirlash', nameEn: 'Repair sewage', description: 'Устранение течи, замена колен/труб', descriptionUz: 'Oqishni bartaraf etish, tirsak/truba almashtirish', descriptionEn: 'Fix leaks, replace elbows/pipes', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 200000 },
          { slug: 'demontazh-plumbing-pipes', name: 'Демонтаж труб', nameUz: 'Trubalarni demontaj qilish', nameEn: 'Remove pipes', description: 'Снятие старых труб, заглушка', descriptionUz: 'Eski trubalarni olib tashlash, berkitish', descriptionEn: 'Remove old pipes, plug', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 100000 },
        ],
      },
      {
        slug: 'plumbing-install',
        name: 'Установка сантехники',
        nameUz: 'Santexnika oʻrnatish',
        nameEn: 'Plumbing fixture installation',
        icon: 'ShowerHead',
        tasks: [
          { slug: 'install-toilet', name: 'Монтаж унитаза', nameUz: 'Unitaz oʻrnatish', nameEn: 'Install toilet', description: 'Установка на пол, подключение к канализации/воде', descriptionUz: 'Polga oʻrnatish, kanalizatsiya/suvga ulash', descriptionEn: 'Mount on floor, connect to sewage/water', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 200000 },
          { slug: 'install-bath-shower', name: 'Установка ванны/душевой кабины', nameUz: 'Vanna/dush kabinasi oʻrnatish', nameEn: 'Install bath/shower cabin', description: 'Монтаж, герметизация, подключение', descriptionUz: 'Oʻrnatish, germetizatsiya, ulash', descriptionEn: 'Mount, seal, connect', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 300000 },
          { slug: 'install-sink', name: 'Установка раковины/мойки', nameUz: 'Lavabo/yuvgich oʻrnatish', nameEn: 'Install sink', description: 'Крепление, подключение сифона/крана', descriptionUz: 'Mahkamlash, sifon/kran ulash', descriptionEn: 'Mount, connect siphon/faucet', estimatedTime: '45-90 мин', estimatedTimeUz: '45-90 daq', estimatedTimeEn: '45-90 min', minPrice: 150000 },
          { slug: 'install-bidet', name: 'Монтаж биде', nameUz: 'Bide oʻrnatish', nameEn: 'Install bidet', description: 'Установка, подключение', descriptionUz: 'Oʻrnatish, ulash', descriptionEn: 'Install, connect', estimatedTime: '1 час', estimatedTimeUz: '1 soat', estimatedTimeEn: '1 hour', minPrice: 200000 },
          { slug: 'install-jacuzzi', name: 'Установка гидромассажной ванны/джакузи', nameUz: 'Gidromassaj vanna/jakuzi oʻrnatish', nameEn: 'Install jacuzzi/whirlpool', description: 'Монтаж, подключение электро и водоснабжения', descriptionUz: 'Oʻrnatish, elektr va suv taʼminotiga ulash', descriptionEn: 'Mount, connect electrical and water supply', estimatedTime: '3-6 часов', estimatedTimeUz: '3-6 soat', estimatedTimeEn: '3-6 hours', minPrice: 500000 },
          { slug: 'demontazh-plumbing-install', name: 'Демонтаж сантехники', nameUz: 'Santexnikani demontaj qilish', nameEn: 'Remove plumbing fixtures', description: 'Снятие унитаза/раковины/ванны', descriptionUz: 'Unitaz/lavabo/vannani olib tashlash', descriptionEn: 'Remove toilet/sink/bath', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 100000 },
        ],
      },
      {
        slug: 'plumbing-heating',
        name: 'Отопление и водонагреватели',
        nameUz: 'Isitish va suv isitgichlar',
        nameEn: 'Heating & water heaters',
        icon: 'Flame',
        tasks: [
          { slug: 'install-radiator', name: 'Установка радиаторов', nameUz: 'Radiator oʻrnatish', nameEn: 'Install radiators', description: 'Монтаж, подключение к системе', descriptionUz: 'Oʻrnatish, tizimga ulash', descriptionEn: 'Mount, connect to system', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 200000 },
          { slug: 'repair-boiler', name: 'Ремонт котлов/бойлеров', nameUz: 'Qozon/boyler taʼmiri', nameEn: 'Repair boilers', description: 'Чистка, замена элементов', descriptionUz: 'Tozalash, elementlarni almashtirish', descriptionEn: 'Clean, replace elements', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 250000 },
          { slug: 'flush-heating', name: 'Промывка системы отопления', nameUz: 'Isitish tizimini yuvish', nameEn: 'Flush heating system', description: 'Удаление накипи, воздуха', descriptionUz: 'Qatlam, havoni tozalash', descriptionEn: 'Remove scale, air', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 300000 },
          { slug: 'install-water-heater', name: 'Установка электрического водонагревателя', nameUz: 'Elektr suv isitgich oʻrnatish', nameEn: 'Install electric water heater', description: 'Монтаж на стену, подключение', descriptionUz: 'Devorga oʻrnatish, ulash', descriptionEn: 'Wall mount, connect', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 150000 },
          { slug: 'install-boiler-new', name: 'Установка нового бойлера', nameUz: 'Yangi boyler oʻrnatish', nameEn: 'Install new boiler', description: 'Монтаж настенного/напольного бойлера с подключением', descriptionUz: 'Devorga/polga boyler oʻrnatish va ulash', descriptionEn: 'Mount wall/floor boiler with connection', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 250000 },
          { slug: 'install-warm-floor-water', name: 'Монтаж тёплого пола (водяного)', nameUz: 'Issiq pol oʻrnatish (suvli)', nameEn: 'Install underfloor heating (water)', description: 'Укладка труб, подключение к коллектору', descriptionUz: 'Trubalarni yotqizish, kollektorga ulash', descriptionEn: 'Lay pipes, connect to manifold', estimatedTime: '4-8 часов', estimatedTimeUz: '4-8 soat', estimatedTimeEn: '4-8 hours', minPrice: 150000 },
          { slug: 'demontazh-plumbing-heating', name: 'Демонтаж радиаторов/бойлера', nameUz: 'Radiator/boylerni demontaj qilish', nameEn: 'Remove radiators/boiler', description: 'Снятие радиатора или водонагревателя', descriptionUz: 'Radiator yoki suv isitgichni olib tashlash', descriptionEn: 'Remove radiator or water heater', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 100000 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // 2. ЭЛЕКТРИКА
  // ═══════════════════════════════════════════
  {
    slug: 'electrical',
    name: 'Электрика',
    nameUz: 'Elektrika',
    nameEn: 'Electrical',
    icon: 'Zap',
    parentSlug: 'repair-finishing',
    subcategories: [
      {
        slug: 'electrical-wiring', name: 'Проводка и розетки', nameUz: 'Simlar va rozetkalar', nameEn: 'Wiring & outlets', icon: 'Cable',
        tasks: [
          { slug: 'install-outlet', name: 'Установка розеток', nameUz: 'Rozetka oʻrnatish', nameEn: 'Install outlets', description: 'Монтаж новой розетки в стену, подключение', descriptionUz: 'Devorga yangi rozetka oʻrnatish, ulash', descriptionEn: 'Mount new outlet in wall, connect', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 50000 },
          { slug: 'replace-outlet', name: 'Замена розеток', nameUz: 'Rozetkalarni almashtirish', nameEn: 'Replace outlets', description: 'Демонтаж старой, установка новой', descriptionUz: 'Eskisini olib tashlash, yangisini oʻrnatish', descriptionEn: 'Remove old, install new', estimatedTime: '20-40 мин', estimatedTimeUz: '20-40 daq', estimatedTimeEn: '20-40 min', minPrice: 40000 },
          { slug: 'install-switch', name: 'Установка выключателей', nameUz: 'Oʻchirgich oʻrnatish', nameEn: 'Install switches', description: 'Монтаж одноклавишного/двухклавишного', descriptionUz: 'Bir/ikki tugmali oʻchirgich oʻrnatish', descriptionEn: 'Mount single/double switch', estimatedTime: '30 мин', estimatedTimeUz: '30 daq', estimatedTimeEn: '30 min', minPrice: 40000 },
          { slug: 'replace-switch', name: 'Замена выключателей', nameUz: 'Oʻchirgichlarni almashtirish', nameEn: 'Replace switches', description: 'Снятие старого, установка нового выключателя', descriptionUz: 'Eski oʻchirgichni olib tashlash, yangisini oʻrnatish', descriptionEn: 'Remove old, install new switch', estimatedTime: '20-30 мин', estimatedTimeUz: '20-30 daq', estimatedTimeEn: '20-30 min', minPrice: 40000 },
          { slug: 'install-usb-outlet', name: 'Установка USB-розеток', nameUz: 'USB-rozetka oʻrnatish', nameEn: 'Install USB outlets', description: 'Монтаж розетки с USB-портами для зарядки', descriptionUz: 'Zaryadlash uchun USB-portli rozetka oʻrnatish', descriptionEn: 'Mount outlet with USB charging ports', estimatedTime: '30-45 мин', estimatedTimeUz: '30-45 daq', estimatedTimeEn: '30-45 min', minPrice: 60000 },
          { slug: 'install-dimmer', name: 'Установка диммера', nameUz: 'Dimmer oʻrnatish', nameEn: 'Install dimmer switch', description: 'Регулятор яркости освещения', descriptionUz: 'Yoritish yorqinligini rostlagich', descriptionEn: 'Light brightness controller', estimatedTime: '30 мин', estimatedTimeUz: '30 daq', estimatedTimeEn: '30 min', minPrice: 50000 },
          { slug: 'lay-cable', name: 'Прокладка кабеля', nameUz: 'Kabel yotqizish', nameEn: 'Lay cable', description: 'Штробление стены, укладка провода, заделка', descriptionUz: 'Devorni shtrobash, sim yotqizish, yopish', descriptionEn: 'Chase wall, lay wire, seal', estimatedTime: '1-4 часа', estimatedTimeUz: '1-4 soat', estimatedTimeEn: '1-4 hours', minPrice: 50000 },
          { slug: 'repair-wiring', name: 'Ремонт проводки', nameUz: 'Simlarni taʼmirlash', nameEn: 'Repair wiring', description: 'Поиск и устранение короткого замыкания', descriptionUz: 'Qisqa tutashuvni topish va bartaraf etish', descriptionEn: 'Find and fix short circuit', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 100000 },
          { slug: 'install-motion-sensor', name: 'Установка датчика движения', nameUz: 'Harakat sensori oʻrnatish', nameEn: 'Install motion sensor', description: 'Монтаж датчика для автоматического освещения', descriptionUz: 'Avtomatik yoritish uchun sensor oʻrnatish', descriptionEn: 'Mount sensor for automatic lighting', estimatedTime: '30-45 мин', estimatedTimeUz: '30-45 daq', estimatedTimeEn: '30-45 min', minPrice: 60000 },
          { slug: 'demontazh-electrical-wiring', name: 'Демонтаж розеток/выключателей', nameUz: 'Rozetka/oʻchirgichlarni demontaj qilish', nameEn: 'Remove outlets/switches', description: 'Снятие старой проводки, розеток', descriptionUz: 'Eski simlar, rozetkalarni olib tashlash', descriptionEn: 'Remove old wiring, outlets', estimatedTime: '20-40 мин', estimatedTimeUz: '20-40 daq', estimatedTimeEn: '20-40 min', minPrice: 25000 },
        ],
      },
      {
        slug: 'electrical-lighting', name: 'Освещение', nameUz: 'Yoritish', nameEn: 'Lighting', icon: 'Lightbulb',
        tasks: [
          { slug: 'mount-chandelier', name: 'Монтаж люстр', nameUz: 'Lyustra oʻrnatish', nameEn: 'Mount chandeliers', description: 'Крепление к потолку, подключение', descriptionUz: 'Shiftga mahkamlash, ulash', descriptionEn: 'Fix to ceiling, connect', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 80000 },
          { slug: 'install-fixtures', name: 'Установка светильников', nameUz: 'Chiroq oʻrnatish', nameEn: 'Install light fixtures', description: 'Встраиваемые/накладные, включая споты', descriptionUz: 'Oʻrnatma/ustiga, spotlar ham', descriptionEn: 'Recessed/surface, including spots', estimatedTime: '20-40 мин', estimatedTimeUz: '20-40 daq', estimatedTimeEn: '20-40 min', minPrice: 50000 },
          { slug: 'mount-led-strip', name: 'Монтаж LED-лент', nameUz: 'LED-lenta oʻrnatish', nameEn: 'Mount LED strips', description: 'Установка подсветки, подключение трансформатора', descriptionUz: 'Yoritma oʻrnatish, transformator ulash', descriptionEn: 'Install backlighting, connect transformer', estimatedTime: '45-90 мин', estimatedTimeUz: '45-90 daq', estimatedTimeEn: '45-90 min', minPrice: 100000 },
          { slug: 'repair-lighting', name: 'Ремонт освещения', nameUz: 'Yoritishni taʼmirlash', nameEn: 'Repair lighting', description: 'Замена ламп, ремонт цепи', descriptionUz: 'Lampalarni almashtirish, zanjir taʼmiri', descriptionEn: 'Replace bulbs, fix circuit', estimatedTime: '30 мин', estimatedTimeUz: '30 daq', estimatedTimeEn: '30 min', minPrice: 40000 },
          { slug: 'mount-outdoor-lighting', name: 'Монтаж уличного освещения', nameUz: 'Koʻcha yoritish oʻrnatish', nameEn: 'Mount outdoor lighting', description: 'Фонари, прожекторы, солнечные фонари', descriptionUz: 'Fonarlar, projektorlar, quyosh fonarlari', descriptionEn: 'Lanterns, floodlights, solar lights', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 100000 },
          { slug: 'demontazh-electrical-lighting', name: 'Демонтаж осветительных приборов', nameUz: 'Yoritish asboblarini demontaj qilish', nameEn: 'Remove lighting fixtures', description: 'Снятие люстр, светильников', descriptionUz: 'Lyustra, chiroqlarni olib tashlash', descriptionEn: 'Remove chandeliers, fixtures', estimatedTime: '15-30 мин', estimatedTimeUz: '15-30 daq', estimatedTimeEn: '15-30 min', minPrice: 30000 },
        ],
      },
      {
        slug: 'electrical-appliances', name: 'Подключение бытовой техники', nameUz: 'Maishiy texnikani ulash', nameEn: 'Appliance connection', icon: 'Refrigerator',
        tasks: [
          { slug: 'connect-washer', name: 'Подключение стиральной машины', nameUz: 'Kir yuvish mashinasini ulash', nameEn: 'Connect washing machine', description: 'Установка, подключение к воде/электрике/канализации', descriptionUz: 'Oʻrnatish, suv/elektr/kanalizatsiyaga ulash', descriptionEn: 'Install, connect to water/power/drain', estimatedTime: '45-90 мин', estimatedTimeUz: '45-90 daq', estimatedTimeEn: '45-90 min', minPrice: 80000 },
          { slug: 'connect-fridge', name: 'Подключение холодильника', nameUz: 'Muzlatgichni ulash', nameEn: 'Connect refrigerator', description: 'Установка, выравнивание, подключение', descriptionUz: 'Oʻrnatish, tekislash, ulash', descriptionEn: 'Install, level, connect', estimatedTime: '30 мин', estimatedTimeUz: '30 daq', estimatedTimeEn: '30 min', minPrice: 50000 },
          { slug: 'connect-oven', name: 'Подключение духового шкафа', nameUz: 'Pechni ulash', nameEn: 'Connect oven', description: 'Монтаж в мебель, подключение к сети', descriptionUz: 'Mebelga oʻrnatish, tarmoqqa ulash', descriptionEn: 'Mount in furniture, connect to power', estimatedTime: '45 мин', estimatedTimeUz: '45 daq', estimatedTimeEn: '45 min', minPrice: 100000 },
          { slug: 'connect-dishwasher', name: 'Подключение посудомоечной машины', nameUz: 'Idish yuvish mashinasini ulash', nameEn: 'Connect dishwasher', description: 'Установка, подключение к воде/канализации', descriptionUz: 'Oʻrnatish, suv/kanalizatsiyaga ulash', descriptionEn: 'Install, connect to water/drain', estimatedTime: '45-90 мин', estimatedTimeUz: '45-90 daq', estimatedTimeEn: '45-90 min', minPrice: 100000 },
          { slug: 'connect-cooktop', name: 'Подключение варочной поверхности', nameUz: 'Pishirish panelini ulash', nameEn: 'Connect cooktop', description: 'Газовая/электрическая/индукционная, встройка в столешницу', descriptionUz: 'Gaz/elektr/induksion, stoleshnitsa ichiga oʻrnatish', descriptionEn: 'Gas/electric/induction, fit into countertop', estimatedTime: '45-60 мин', estimatedTimeUz: '45-60 daq', estimatedTimeEn: '45-60 min', minPrice: 100000 },
          { slug: 'connect-coffee-machine', name: 'Подключение кофе-машины', nameUz: 'Kofe mashinasini ulash', nameEn: 'Connect coffee machine', description: 'Встроенная кофемашина, подключение воды/электрики', descriptionUz: 'Oʻrnatilgan kofe mashinasi, suv/elektr ulash', descriptionEn: 'Built-in coffee machine, connect water/power', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 80000 },
          { slug: 'connect-microwave', name: 'Установка микроволновой печи', nameUz: 'Mikrotoʻlqinli pech oʻrnatish', nameEn: 'Install microwave', description: 'Встроенная/настольная, крепление', descriptionUz: 'Oʻrnatilgan/stol ustiga, mahkamlash', descriptionEn: 'Built-in/countertop, mount', estimatedTime: '20-30 мин', estimatedTimeUz: '20-30 daq', estimatedTimeEn: '20-30 min', minPrice: 40000 },
          { slug: 'connect-dryer', name: 'Монтаж сушильной машины', nameUz: 'Quritish mashinasini oʻrnatish', nameEn: 'Install dryer', description: 'Установка, подключение к электрике/вентиляции', descriptionUz: 'Oʻrnatish, elektr/ventilyatsiyaga ulash', descriptionEn: 'Install, connect to power/vent', estimatedTime: '45-60 мин', estimatedTimeUz: '45-60 daq', estimatedTimeEn: '45-60 min', minPrice: 80000 },
          { slug: 'demontazh-electrical-appliances', name: 'Демонтаж бытовой техники', nameUz: 'Maishiy texnikani demontaj qilish', nameEn: 'Disconnect appliances', description: 'Отключение и демонтаж техники', descriptionUz: 'Texnikani uzish va olib tashlash', descriptionEn: 'Disconnect and remove appliances', estimatedTime: '20-40 мин', estimatedTimeUz: '20-40 daq', estimatedTimeEn: '20-40 min', minPrice: 40000 },
        ],
      },
      {
        slug: 'electrical-panels', name: 'Счётчики и щитки', nameUz: 'Hisoblagichlar va shchitlar', nameEn: 'Meters & panels', icon: 'Settings',
        tasks: [
          { slug: 'install-electric-meter', name: 'Установка электросчётчиков', nameUz: 'Elektr hisoblagich oʻrnatish', nameEn: 'Install electric meters', description: 'Монтаж однофазного/трёхфазного', descriptionUz: 'Bir/uch fazali oʻrnatish', descriptionEn: 'Mount single/three phase', estimatedTime: '1 час', estimatedTimeUz: '1 soat', estimatedTimeEn: '1 hour', minPrice: 150000 },
          { slug: 'assemble-panel', name: 'Сборка электрощитка', nameUz: 'Elektr shchit yigʻish', nameEn: 'Assemble electrical panel', description: 'Установка автоматов, УЗО', descriptionUz: 'Avtomatlar, UZO oʻrnatish', descriptionEn: 'Install breakers, RCD', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 200000 },
          { slug: 'grounding', name: 'Заземление', nameUz: 'Yerga ulash', nameEn: 'Grounding', description: 'Прокладка контура, подключение', descriptionUz: 'Kontur yotqizish, ulash', descriptionEn: 'Lay grounding loop, connect', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 150000 },
          { slug: 'electrical-diagnostics', name: 'Диагностика электросети', nameUz: 'Elektr tarmoq diagnostikasi', nameEn: 'Electrical diagnostics', description: 'Проверка напряжения, поиск неисправностей', descriptionUz: 'Kuchlanishni tekshirish, nosozliklarni topish', descriptionEn: 'Check voltage, find faults', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 80000 },
          { slug: 'install-stabilizer', name: 'Установка стабилизатора напряжения', nameUz: 'Kuchlanish stabilizatori oʻrnatish', nameEn: 'Install voltage stabilizer', description: 'Монтаж и подключение стабилизатора', descriptionUz: 'Stabilizatorni oʻrnatish va ulash', descriptionEn: 'Mount and connect stabilizer', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 80000 },
          { slug: 'install-generator-connection', name: 'Подключение генератора', nameUz: 'Generator ulash', nameEn: 'Connect generator', description: 'Установка переключателя, подключение к сети', descriptionUz: 'Oʻzgartgich oʻrnatish, tarmoqqa ulash', descriptionEn: 'Install transfer switch, connect to grid', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 200000 },
          { slug: 'demontazh-electrical-panels', name: 'Демонтаж щитка/счётчика', nameUz: 'Shchit/hisoblagichni demontaj qilish', nameEn: 'Remove panel/meter', description: 'Снятие старого электрощитка или счётчика', descriptionUz: 'Eski elektr shchit yoki hisoblagichni olib tashlash', descriptionEn: 'Remove old panel or meter', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 80000 },
        ],
      },
      {
        slug: 'electrical-smart', name: 'Умный дом и безопасность', nameUz: 'Aqlli uy va xavfsizlik', nameEn: 'Smart home & security', icon: 'Shield',
        tasks: [
          { slug: 'setup-smart-home', name: 'Настройка умного дома', nameUz: 'Aqlli uy sozlash', nameEn: 'Setup smart home', description: 'Подключение хаба, датчиков, сценарии автоматизации', descriptionUz: 'Hub, sensorlar ulash, avtomatlashtirish stsenariyalari', descriptionEn: 'Connect hub, sensors, automation scenarios', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 200000 },
          { slug: 'install-smart-lock', name: 'Установка умного замка', nameUz: 'Aqlli qulf oʻrnatish', nameEn: 'Install smart lock', description: 'Электронный замок с управлением через телефон', descriptionUz: 'Telefon orqali boshqariladigan elektron qulf', descriptionEn: 'Electronic lock with phone control', estimatedTime: '45-90 мин', estimatedTimeUz: '45-90 daq', estimatedTimeEn: '45-90 min', minPrice: 100000 },
          { slug: 'install-alarm-system', name: 'Установка сигнализации', nameUz: 'Signalizatsiya oʻrnatish', nameEn: 'Install alarm system', description: 'Монтаж датчиков, сирены, подключение к пульту', descriptionUz: 'Sensorlar, sirena oʻrnatish, pultga ulash', descriptionEn: 'Mount sensors, siren, connect to panel', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 300000 },
          { slug: 'install-video-doorbell', name: 'Установка видеодомофона', nameUz: 'Videodomofon oʻrnatish', nameEn: 'Install video doorbell', description: 'Монтаж панели, монитора, прокладка кабеля', descriptionUz: 'Panel, monitor oʻrnatish, kabel yotqizish', descriptionEn: 'Mount panel, monitor, lay cable', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 150000 },
          { slug: 'install-cctv', name: 'Установка видеонаблюдения', nameUz: 'Videokuzatuv oʻrnatish', nameEn: 'Install CCTV', description: 'Камеры, регистратор, настройка удалённого доступа', descriptionUz: 'Kameralar, registrator, masofaviy kirishni sozlash', descriptionEn: 'Cameras, DVR, remote access setup', estimatedTime: '3-6 часов', estimatedTimeUz: '3-6 soat', estimatedTimeEn: '3-6 hours', minPrice: 300000 },
          { slug: 'install-electric-warm-floor', name: 'Монтаж электрического тёплого пола', nameUz: 'Elektr issiq pol oʻrnatish', nameEn: 'Install electric underfloor heating', description: 'Укладка мата/кабеля, подключение термостата', descriptionUz: 'Mat/kabel yotqizish, termostat ulash', descriptionEn: 'Lay mat/cable, connect thermostat', estimatedTime: '3-6 часов', estimatedTimeUz: '3-6 soat', estimatedTimeEn: '3-6 hours', minPrice: 120000 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // 3. СБОРКА И РЕМОНТ МЕБЕЛИ
  // ═══════════════════════════════════════════
  {
    slug: 'furniture',
    name: 'Сборка и ремонт мебели',
    nameUz: 'Mebel yigʻish va taʼmirlash',
    nameEn: 'Furniture assembly & repair',
    icon: 'Armchair',
    parentSlug: 'crafts-manufacturing',
    subcategories: [
      {
        slug: 'furniture-assembly', name: 'Сборка мебели', nameUz: 'Mebel yigʻish', nameEn: 'Furniture assembly', icon: 'Hammer',
        tasks: [
          { slug: 'assemble-wardrobe', name: 'Сборка шкафа', nameUz: 'Shkaf yigʻish', nameEn: 'Assemble wardrobe', description: 'Монтаж корпусного шкафа-купе', descriptionUz: 'Korpusli shkaf-kupe yigʻish', descriptionEn: 'Assemble sliding door wardrobe', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 200000 },
          { slug: 'assemble-bed', name: 'Сборка кровати', nameUz: 'Karavot yigʻish', nameEn: 'Assemble bed', description: 'Установка каркаса, матраса', descriptionUz: 'Karkasni, matrasni oʻrnatish', descriptionEn: 'Set up frame, mattress', estimatedTime: '45-90 мин', estimatedTimeUz: '45-90 daq', estimatedTimeEn: '45-90 min', minPrice: 100000 },
          { slug: 'assemble-kitchen', name: 'Сборка кухонного гарнитура', nameUz: 'Oshxona garnituri yigʻish', nameEn: 'Assemble kitchen set', description: 'Монтаж модулей, столешницы', descriptionUz: 'Modullar, stoleshnitsa oʻrnatish', descriptionEn: 'Install modules, countertop', estimatedTime: '2-5 часов', estimatedTimeUz: '2-5 soat', estimatedTimeEn: '2-5 hours', minPrice: 300000 },
          { slug: 'assemble-table-chair', name: 'Сборка стола/стула', nameUz: 'Stol/stul yigʻish', nameEn: 'Assemble table/chair', description: 'Сборка обеденного/офисного', descriptionUz: 'Ovqatlanish/ofis stolini yigʻish', descriptionEn: 'Assemble dining/office', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 50000 },
          { slug: 'assemble-children-furniture', name: 'Сборка детской мебели', nameUz: 'Bolalar mebelini yigʻish', nameEn: 'Assemble children furniture', description: 'Кроватка, пеленальный столик, шкаф', descriptionUz: 'Beshik, oʻrash stoli, shkaf', descriptionEn: 'Crib, changing table, wardrobe', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 100000 },
          { slug: 'assemble-office-furniture', name: 'Сборка офисной мебели', nameUz: 'Ofis mebelini yigʻish', nameEn: 'Assemble office furniture', description: 'Рабочий стол, кресло, тумба, стеллаж', descriptionUz: 'Ish stoli, kreslo, tumba, stellaj', descriptionEn: 'Desk, chair, cabinet, shelving', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 150000 },
          { slug: 'assemble-shelving', name: 'Сборка стеллажей', nameUz: 'Stellaj yigʻish', nameEn: 'Assemble shelving unit', description: 'Металлический/деревянный стеллаж', descriptionUz: 'Metall/yogʻoch stellaj', descriptionEn: 'Metal/wooden shelving', estimatedTime: '45-90 мин', estimatedTimeUz: '45-90 daq', estimatedTimeEn: '45-90 min', minPrice: 80000 },
          { slug: 'demontazh-furniture-assembly', name: 'Демонтаж/разборка мебели', nameUz: 'Mebelni demontaj/yechish', nameEn: 'Disassemble furniture', description: 'Полная разборка шкафа/кухни', descriptionUz: 'Shkaf/oshxonani toʻliq yechish', descriptionEn: 'Full disassembly of wardrobe/kitchen', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 100000 },
        ],
      },
      {
        slug: 'furniture-repair', name: 'Ремонт мебели', nameUz: 'Mebel taʼmiri', nameEn: 'Furniture repair', icon: 'Wrench',
        tasks: [
          { slug: 'replace-hardware', name: 'Замена фурнитуры', nameUz: 'Furnitura almashtirish', nameEn: 'Replace hardware', description: 'Петли, ручки, направляющие', descriptionUz: 'Ilgaklar, tutqichlar, yoʻnaltiruvchilar', descriptionEn: 'Hinges, handles, guides', estimatedTime: '20-40 мин', estimatedTimeUz: '20-40 daq', estimatedTimeEn: '20-40 min', minPrice: 50000 },
          { slug: 'repair-wardrobe-doors', name: 'Ремонт дверей шкафа', nameUz: 'Shkaf eshiklarini taʼmirlash', nameEn: 'Repair wardrobe doors', description: 'Регулировка, замена роликов', descriptionUz: 'Rostlash, roliklarni almashtirish', descriptionEn: 'Adjust, replace rollers', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 80000 },
          { slug: 'reupholster', name: 'Перетяжка обивки', nameUz: 'Qoplama almashtirish', nameEn: 'Reupholster', description: 'Смена ткани на диване/кресле', descriptionUz: 'Divan/kreslo matosini almashtirish', descriptionEn: 'Replace fabric on sofa/chair', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 300000 },
          { slug: 'fix-squeak', name: 'Устранение скрипа', nameUz: 'Gʻichirlashni bartaraf etish', nameEn: 'Fix squeak', description: 'Смазка, подтяжка', descriptionUz: 'Moylash, tortish', descriptionEn: 'Lubricate, tighten', estimatedTime: '30 мин', estimatedTimeUz: '30 daq', estimatedTimeEn: '30 min', minPrice: 40000 },
          { slug: 'repair-laminate-chipboard', name: 'Ремонт ламината/ДСП мебели', nameUz: 'Laminat/DSP mebel taʼmiri', nameEn: 'Repair laminate/chipboard furniture', description: 'Заделка сколов, царапин, вздутий', descriptionUz: 'Sinishlar, tirnalishlar, shishishlarni tuzatish', descriptionEn: 'Fix chips, scratches, swelling', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 60000 },
        ],
      },
      {
        slug: 'furniture-mounting', name: 'Установка мебели', nameUz: 'Mebel oʻrnatish', nameEn: 'Furniture mounting', icon: 'Ruler',
        tasks: [
          { slug: 'mount-shelves', name: 'Крепление полок', nameUz: 'Javon oʻrnatish', nameEn: 'Mount shelves', description: 'На стену, регулировка', descriptionUz: 'Devorga, rostlash', descriptionEn: 'Wall mount, adjust', estimatedTime: '20-40 мин', estimatedTimeUz: '20-40 daq', estimatedTimeEn: '20-40 min', minPrice: 50000 },
          { slug: 'mount-mirror', name: 'Установка зеркал', nameUz: 'Koʻzgu oʻrnatish', nameEn: 'Mount mirrors', description: 'Крепление на стену/дверь', descriptionUz: 'Devor/eshikka mahkamlash', descriptionEn: 'Fix to wall/door', estimatedTime: '30 мин', estimatedTimeUz: '30 daq', estimatedTimeEn: '30 min', minPrice: 50000 },
          { slug: 'mount-curtain-rod', name: 'Монтаж карнизов', nameUz: 'Karniz oʻrnatish', nameEn: 'Mount curtain rods', description: 'Для штор, жалюзи', descriptionUz: 'Parda, jalyuzi uchun', descriptionEn: 'For curtains, blinds', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 60000 },
          { slug: 'mount-wall-cabinets', name: 'Навесные шкафы', nameUz: 'Osma shkaflar', nameEn: 'Wall cabinets', description: 'Крепление кухонных/ванных', descriptionUz: 'Oshxona/hammom shkaflarini mahkamlash', descriptionEn: 'Mount kitchen/bathroom cabinets', estimatedTime: '45-90 мин', estimatedTimeUz: '45-90 daq', estimatedTimeEn: '45-90 min', minPrice: 100000 },
          { slug: 'mount-clothes-dryer', name: 'Установка сушилки для белья', nameUz: 'Kir quritgich oʻrnatish', nameEn: 'Install clothes drying rack', description: 'Настенная/потолочная сушилка', descriptionUz: 'Devor/shiftga oʻrnatiladigan quritgich', descriptionEn: 'Wall/ceiling drying rack', estimatedTime: '30-45 мин', estimatedTimeUz: '30-45 daq', estimatedTimeEn: '30-45 min', minPrice: 50000 },
          { slug: 'demontazh-furniture-mounting', name: 'Демонтаж навесных конструкций', nameUz: 'Osma konstruksiyalarni demontaj qilish', nameEn: 'Remove wall-mounted items', description: 'Снятие полок, карнизов, зеркал', descriptionUz: 'Javon, karniz, koʻzgularni olib tashlash', descriptionEn: 'Remove shelves, rods, mirrors', estimatedTime: '15-30 мин', estimatedTimeUz: '15-30 daq', estimatedTimeEn: '15-30 min', minPrice: 30000 },
        ],
      },
      {
        slug: 'furniture-disassembly', name: 'Разборка/перестановка', nameUz: 'Yechish/koʻchirish', nameEn: 'Disassembly/relocation', icon: 'Package',
        tasks: [
          { slug: 'disassemble-for-move', name: 'Разборка для переезда', nameUz: 'Koʻchish uchun yechish', nameEn: 'Disassemble for moving', description: 'Демонтаж мебели', descriptionUz: 'Mebelni demontaj qilish', descriptionEn: 'Disassemble furniture', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 100000 },
          { slug: 'rearrange-room', name: 'Перестановка в комнате', nameUz: 'Xonada qayta joylashtirish', nameEn: 'Rearrange room', description: 'Перенос, сборка', descriptionUz: 'Koʻchirish, yigʻish', descriptionEn: 'Move, assemble', estimatedTime: '30-90 мин', estimatedTimeUz: '30-90 daq', estimatedTimeEn: '30-90 min', minPrice: 80000 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // 4. СТРОИТЕЛЬСТВО И РЕМОНТ
  // ═══════════════════════════════════════════
  {
    slug: 'construction',
    name: 'Строительство и ремонт',
    nameUz: 'Qurilish va taʼmirlash',
    nameEn: 'Construction & renovation',
    icon: 'HardHat',
    parentSlug: 'construction-building',
    subcategories: [
      {
        slug: 'construction-walls', name: 'Стены и перегородки', nameUz: 'Devorlar va toʻsiqlar', nameEn: 'Walls & partitions', icon: 'BrickWall',
        tasks: [
          { slug: 'build-walls', name: 'Возведение стен', nameUz: 'Devor qurish', nameEn: 'Build walls', description: 'Кирпич/блоки (за м²)', descriptionUz: 'Gʻisht/bloklar (m² uchun)', descriptionEn: 'Brick/blocks (per m²)', estimatedTime: '4-8 часов', estimatedTimeUz: '4-8 soat', estimatedTimeEn: '4-8 hours', minPrice: 80000 },
          { slug: 'mount-drywall', name: 'Монтаж гипсокартона', nameUz: 'Gipskarton oʻrnatish', nameEn: 'Mount drywall', description: 'Каркас, обшивка (за м²)', descriptionUz: 'Karkas, qoplash (m² uchun)', descriptionEn: 'Frame, cladding (per m²)', estimatedTime: '2-5 часов', estimatedTimeUz: '2-5 soat', estimatedTimeEn: '2-5 hours', minPrice: 80000 },
          { slug: 'demolish-walls', name: 'Демонтаж стен', nameUz: 'Devorlarni buzish', nameEn: 'Demolish walls', description: 'Снос перегородок (за м²)', descriptionUz: 'Toʻsiqlarni buzish (m² uchun)', descriptionEn: 'Demolish partitions (per m²)', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 50000 },
          { slug: 'insulate-walls', name: 'Утепление стен', nameUz: 'Devorlarni izolyatsiyalash', nameEn: 'Insulate walls', description: 'Монтаж изоляции (за м²)', descriptionUz: 'Izolyatsiya oʻrnatish (m² uchun)', descriptionEn: 'Install insulation (per m²)', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 60000 },
          { slug: 'repair-cracks-walls', name: 'Ремонт трещин в стенах', nameUz: 'Devordagi yoriqlarni taʼmirlash', nameEn: 'Repair wall cracks', description: 'Заделка трещин, армирование сеткой', descriptionUz: 'Yoriqlarni yopish, toʻr bilan mustahkamlash', descriptionEn: 'Fill cracks, reinforce with mesh', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 50000 },
        ],
      },
      {
        slug: 'construction-floors', name: 'Полы', nameUz: 'Pollar', nameEn: 'Floors', icon: 'Layers',
        tasks: [
          { slug: 'lay-laminate', name: 'Укладка ламината', nameUz: 'Laminat yotqizish', nameEn: 'Lay laminate', description: 'Подготовка, монтаж (за м²)', descriptionUz: 'Tayyorlash, oʻrnatish (m² uchun)', descriptionEn: 'Prepare, install (per m²)', estimatedTime: '2-6 часов', estimatedTimeUz: '2-6 soat', estimatedTimeEn: '2-6 hours', minPrice: 50000 },
          { slug: 'lay-floor-tiles', name: 'Укладка плитки на пол', nameUz: 'Polga plitka yotqizish', nameEn: 'Lay floor tiles', description: 'Подготовка, затирка (за м²)', descriptionUz: 'Tayyorlash, fugalash (m² uchun)', descriptionEn: 'Prepare, grout (per m²)', estimatedTime: '3-8 часов', estimatedTimeUz: '3-8 soat', estimatedTimeEn: '3-8 hours', minPrice: 100000 },
          { slug: 'lay-linoleum', name: 'Укладка линолеума', nameUz: 'Linoleum yotqizish', nameEn: 'Lay linoleum', description: 'Подготовка основания, раскрой, монтаж (за м²)', descriptionUz: 'Asosni tayyorlash, kesish, oʻrnatish (m² uchun)', descriptionEn: 'Prepare base, cut, install (per m²)', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 40000 },
          { slug: 'repair-parquet', name: 'Ремонт паркета', nameUz: 'Parket taʼmiri', nameEn: 'Repair parquet', description: 'Циклёвка, лакировка', descriptionUz: 'Tsiklyovka, laklash', descriptionEn: 'Sand, varnish', estimatedTime: '4-6 часов', estimatedTimeUz: '4-6 soat', estimatedTimeEn: '4-6 hours', minPrice: 80000 },
          { slug: 'repair-laminate-floor', name: 'Ремонт ламината', nameUz: 'Laminatni taʼmirlash', nameEn: 'Repair laminate flooring', description: 'Замена повреждённых досок, устранение скрипа', descriptionUz: 'Shikastlangan taxtalarni almashtirish, gʻichirlashni bartaraf etish', descriptionEn: 'Replace damaged boards, fix squeaks', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 60000 },
          { slug: 'pour-screed', name: 'Заливка стяжки', nameUz: 'Styajka quyish', nameEn: 'Pour floor screed', description: 'Цементная/самовыравнивающаяся (за м²)', descriptionUz: 'Sement/oʻz-oʻzidan tekislanadigan (m² uchun)', descriptionEn: 'Cement/self-leveling (per m²)', estimatedTime: '3-6 часов', estimatedTimeUz: '3-6 soat', estimatedTimeEn: '3-6 hours', minPrice: 60000 },
          { slug: 'demontazh-construction-floors', name: 'Демонтаж полов', nameUz: 'Pollarni demontaj qilish', nameEn: 'Remove flooring', description: 'Снятие старого покрытия (за м²)', descriptionUz: 'Eski qoplamani olib tashlash (m² uchun)', descriptionEn: 'Remove old covering (per m²)', estimatedTime: '1-4 часа', estimatedTimeUz: '1-4 soat', estimatedTimeEn: '1-4 hours', minPrice: 40000 },
        ],
      },
      {
        slug: 'construction-ceilings', name: 'Потолки', nameUz: 'Shiftlar', nameEn: 'Ceilings', icon: 'ArrowBigUp',
        tasks: [
          { slug: 'mount-stretch-ceiling', name: 'Монтаж натяжных потолков', nameUz: 'Tortma shift oʻrnatish', nameEn: 'Mount stretch ceilings', description: 'Профиль, полотно (за м²)', descriptionUz: 'Profil, matoʻ (m² uchun)', descriptionEn: 'Profile, canvas (per m²)', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 80000 },
          { slug: 'paint-ceiling', name: 'Покраска потолков', nameUz: 'Shiftni boʻyash', nameEn: 'Paint ceilings', description: 'Подготовка, нанесение (за м²)', descriptionUz: 'Tayyorlash, surish (m² uchun)', descriptionEn: 'Prepare, apply (per m²)', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 40000 },
          { slug: 'repair-ceiling-cracks', name: 'Ремонт трещин потолка', nameUz: 'Shift yoriqlarini taʼmirlash', nameEn: 'Repair ceiling cracks', description: 'Заделка трещин, шпаклёвка, выравнивание', descriptionUz: 'Yoriqlarni yopish, shpaklyovka, tekislash', descriptionEn: 'Fill cracks, putty, leveling', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 50000 },
          { slug: 'putty-ceiling', name: 'Шпаклёвка потолка', nameUz: 'Shiftni shpaklyovka qilish', nameEn: 'Putty ceiling', description: 'Нанесение шпаклёвки, шлифовка (за м²)', descriptionUz: 'Shpaklyovka surish, jilolash (m² uchun)', descriptionEn: 'Apply putty, sand (per m²)', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 40000 },
          { slug: 'mount-ceiling-moldings', name: 'Установка потолочных молдингов', nameUz: 'Shift moldinglarini oʻrnatish', nameEn: 'Install ceiling moldings', description: 'Монтаж плинтусов, молдингов, багетов', descriptionUz: 'Plintuslar, moldinglar, bagetlar oʻrnatish', descriptionEn: 'Mount baseboards, moldings, cornices', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 50000 },
          { slug: 'demontazh-construction-ceilings', name: 'Демонтаж потолочных конструкций', nameUz: 'Shift konstruksiyalarini demontaj qilish', nameEn: 'Remove ceiling structures', description: 'Снятие натяжного потолка, молдингов', descriptionUz: 'Tortma shift, moldinglarni olib tashlash', descriptionEn: 'Remove stretch ceiling, moldings', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 40000 },
        ],
      },
      {
        slug: 'construction-general', name: 'Общие строительные работы', nameUz: 'Umumiy qurilish ishlari', nameEn: 'General construction', icon: 'Warehouse',
        tasks: [
          { slug: 'plaster-walls', name: 'Штукатурка стен', nameUz: 'Devorlarni suvaqlash', nameEn: 'Plaster walls', description: 'Нанесение, выравнивание (за м²)', descriptionUz: 'Surish, tekislash (m² uchun)', descriptionEn: 'Apply, level (per m²)', estimatedTime: '3-6 часов', estimatedTimeUz: '3-6 soat', estimatedTimeEn: '3-6 hours', minPrice: 50000 },
          { slug: 'putty-walls', name: 'Шпаклёвка стен', nameUz: 'Devorlarni shpaklyovka qilish', nameEn: 'Putty walls', description: 'Финишная шпаклёвка, шлифовка (за м²)', descriptionUz: 'Tugatish shpaklyovka, jilolash (m² uchun)', descriptionEn: 'Finish putty, sanding (per m²)', estimatedTime: '2-5 часов', estimatedTimeUz: '2-5 soat', estimatedTimeEn: '2-5 hours', minPrice: 40000 },
          { slug: 'surface-prep-wallpaper', name: 'Подготовка поверхности под обои', nameUz: 'Devor qogʻozi uchun sirt tayyorlash', nameEn: 'Surface prep for wallpaper', description: 'Грунтовка, выравнивание (за м²)', descriptionUz: 'Gruntovka, tekislash (m² uchun)', descriptionEn: 'Prime, level (per m²)', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 30000 },
          { slug: 'demolish-old', name: 'Демонтаж старых конструкций', nameUz: 'Eski konstruksiyalarni buzish', nameEn: 'Demolish old structures', description: 'Полы/стены (за м²)', descriptionUz: 'Pollar/devorlar (m² uchun)', descriptionEn: 'Floors/walls (per m²)', estimatedTime: '1-4 часа', estimatedTimeUz: '1-4 soat', estimatedTimeEn: '1-4 hours', minPrice: 50000 },
          { slug: 'waterproofing', name: 'Гидроизоляция', nameUz: 'Gidroizolyatsiya', nameEn: 'Waterproofing', description: 'Ванная, душевая, балкон (за м²)', descriptionUz: 'Hammom, dush, balkon (m² uchun)', descriptionEn: 'Bathroom, shower, balcony (per m²)', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 60000 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // 5. МАЛЯРНЫЕ И ОТДЕЛОЧНЫЕ РАБОТЫ
  // ═══════════════════════════════════════════
  {
    slug: 'painting',
    name: 'Малярные и отделочные работы',
    nameUz: 'Boʻyoqchilik va pardozlash ishlari',
    nameEn: 'Painting & finishing',
    icon: 'Paintbrush',
    parentSlug: 'repair-finishing',
    subcategories: [
      {
        slug: 'painting-walls', name: 'Покраска', nameUz: 'Boʻyash', nameEn: 'Painting', icon: 'PaintBucket',
        tasks: [
          { slug: 'paint-walls', name: 'Покраска стен', nameUz: 'Devorlarni boʻyash', nameEn: 'Paint walls', description: 'Нанесение 2-3 слоёв (за м²)', descriptionUz: '2-3 qatlam surish (m² uchun)', descriptionEn: 'Apply 2-3 coats (per m²)', estimatedTime: '2-5 часов', estimatedTimeUz: '2-5 soat', estimatedTimeEn: '2-5 hours', minPrice: 40000 },
          { slug: 'paint-doors-windows', name: 'Покраска дверей/окон', nameUz: 'Eshik/derazalarni boʻyash', nameEn: 'Paint doors/windows', description: 'Подготовка, нанесение', descriptionUz: 'Tayyorlash, surish', descriptionEn: 'Prepare, apply', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 30000 },
          { slug: 'paint-radiators', name: 'Покраска радиаторов', nameUz: 'Radiatorlarni boʻyash', nameEn: 'Paint radiators', description: 'Зачистка, грунтовка, покраска термостойкой краской', descriptionUz: 'Tozalash, gruntovka, issiqlikka chidamli boʻyoq bilan boʻyash', descriptionEn: 'Strip, prime, paint with heat-resistant paint', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 50000 },
          { slug: 'paint-ceiling-only', name: 'Покраска потолка', nameUz: 'Shiftni boʻyash', nameEn: 'Paint ceiling', description: 'Подготовка, покраска (за м²)', descriptionUz: 'Tayyorlash, boʻyash (m² uchun)', descriptionEn: 'Prepare, paint (per m²)', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 40000 },
          { slug: 'demontazh-painting-walls', name: 'Снятие старой краски', nameUz: 'Eski boʻyoqni olib tashlash', nameEn: 'Remove old paint', description: 'Очистка стен от старого покрытия', descriptionUz: 'Devorlarni eski qoplamadan tozalash', descriptionEn: 'Clean walls from old coating', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 25000 },
        ],
      },
      {
        slug: 'painting-wallpaper', name: 'Обои', nameUz: 'Devor qogʻozi', nameEn: 'Wallpaper', icon: 'ScrollText',
        tasks: [
          { slug: 'hang-wallpaper', name: 'Поклейка обоев', nameUz: 'Devor qogʻozi yopishtirish', nameEn: 'Hang wallpaper', description: 'Подготовка, нанесение (за м²)', descriptionUz: 'Tayyorlash, yopishtirish (m² uchun)', descriptionEn: 'Prepare, apply (per m²)', estimatedTime: '2-6 часов', estimatedTimeUz: '2-6 soat', estimatedTimeEn: '2-6 hours', minPrice: 50000 },
          { slug: 'remove-wallpaper', name: 'Удаление старых обоев', nameUz: 'Eski devor qogʻozini olib tashlash', nameEn: 'Remove old wallpaper', description: 'Отмачивание, соскоб', descriptionUz: 'Ivitish, qirish', descriptionEn: 'Soak, scrape', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 25000 },
        ],
      },
      {
        slug: 'painting-tiles', name: 'Плитка', nameUz: 'Plitka', nameEn: 'Tiling', icon: 'Grid3x3',
        tasks: [
          { slug: 'tile-walls', name: 'Укладка кафеля на стены', nameUz: 'Devorlarga kafel yotqizish', nameEn: 'Tile walls', description: 'Резка, затирка (за м²)', descriptionUz: 'Kesish, fugalash (m² uchun)', descriptionEn: 'Cut, grout (per m²)', estimatedTime: '3-7 часов', estimatedTimeUz: '3-7 soat', estimatedTimeEn: '3-7 hours', minPrice: 100000 },
          { slug: 'tile-mosaic', name: 'Укладка мозаики', nameUz: 'Mozaika yotqizish', nameEn: 'Install mosaic tiles', description: 'Мозаичная плитка на стену/пол', descriptionUz: 'Devor/polga mozaik plitka', descriptionEn: 'Mosaic tiles on wall/floor', estimatedTime: '3-6 часов', estimatedTimeUz: '3-6 soat', estimatedTimeEn: '3-6 hours', minPrice: 120000 },
          { slug: 'grout-joints', name: 'Затирка швов', nameUz: 'Choklanrishni fugalash', nameEn: 'Grout joints', description: 'Нанесение, очистка', descriptionUz: 'Surish, tozalash', descriptionEn: 'Apply, clean', estimatedTime: '1 час', estimatedTimeUz: '1 soat', estimatedTimeEn: '1 hour', minPrice: 30000 },
          { slug: 'demontazh-painting-tiles', name: 'Демонтаж плитки', nameUz: 'Plitkani demontaj qilish', nameEn: 'Remove tiles', description: 'Снятие старого кафеля', descriptionUz: 'Eski kafelni olib tashlash', descriptionEn: 'Remove old tiles', estimatedTime: '1-4 часа', estimatedTimeUz: '1-4 soat', estimatedTimeEn: '1-4 hours', minPrice: 40000 },
        ],
      },
      {
        slug: 'painting-decor', name: 'Декор', nameUz: 'Dekor', nameEn: 'Decor', icon: 'Sparkles',
        tasks: [
          { slug: 'install-baseboards', name: 'Установка плинтусов', nameUz: 'Plintus oʻrnatish', nameEn: 'Install baseboards', description: 'Пластик/дерево/МДФ', descriptionUz: 'Plastik/yogʻoch/MDF', descriptionEn: 'Plastic/wood/MDF', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 30000 },
          { slug: 'install-moldings', name: 'Установка молдингов', nameUz: 'Molding oʻrnatish', nameEn: 'Install moldings', description: 'Декоративные планки на стены/потолок', descriptionUz: 'Devor/shiftga dekorativ plankalar', descriptionEn: 'Decorative strips on walls/ceiling', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 50000 },
          { slug: 'decorative-plaster', name: 'Нанесение декоративной штукатурки', nameUz: 'Dekorativ suvaq surish', nameEn: 'Apply decorative plaster', description: 'Текстура (за м²)', descriptionUz: 'Tekstura (m² uchun)', descriptionEn: 'Texture (per m²)', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 80000 },
          { slug: 'install-wall-panels', name: 'Установка стеновых панелей', nameUz: 'Devor panellarini oʻrnatish', nameEn: 'Install wall panels', description: 'МДФ/пластик/деревянные панели (за м²)', descriptionUz: 'MDF/plastik/yogʻoch panellar (m² uchun)', descriptionEn: 'MDF/plastic/wood panels (per m²)', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 60000 },
          { slug: 'demontazh-painting-decor', name: 'Демонтаж плинтусов/декора', nameUz: 'Plintus/dekorni demontaj qilish', nameEn: 'Remove baseboards/decor', description: 'Снятие старых плинтусов, молдингов', descriptionUz: 'Eski plintuslar, moldinglarni olib tashlash', descriptionEn: 'Remove old baseboards, moldings', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 20000 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // 6. УСТАНОВКА И РЕМОНТ ОКОН/ДВЕРЕЙ
  // ═══════════════════════════════════════════
  {
    slug: 'windows-doors',
    name: 'Установка и ремонт окон/дверей',
    nameUz: 'Deraza/eshik oʻrnatish va taʼmirlash',
    nameEn: 'Windows & doors',
    icon: 'DoorOpen',
    parentSlug: 'repair-finishing',
    subcategories: [
      {
        slug: 'wd-windows', name: 'Окна', nameUz: 'Derazalar', nameEn: 'Windows', icon: 'AppWindow',
        tasks: [
          { slug: 'install-pvc-window', name: 'Установка пластиковых окон', nameUz: 'Plastik deraza oʻrnatish', nameEn: 'Install PVC windows', description: 'Монтаж рамы, стеклопакета', descriptionUz: 'Rama, steklopaket oʻrnatish', descriptionEn: 'Mount frame, glass unit', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 200000 },
          { slug: 'repair-window-hardware', name: 'Ремонт фурнитуры окон', nameUz: 'Deraza furniturasi taʼmiri', nameEn: 'Repair window hardware', description: 'Регулировка ручек/петель', descriptionUz: 'Tutqich/ilgaklar rostlash', descriptionEn: 'Adjust handles/hinges', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 50000 },
          { slug: 'replace-glass', name: 'Замена стекла', nameUz: 'Oynani almashtirish', nameEn: 'Replace glass', description: 'Демонтаж, установка', descriptionUz: 'Demontaj, oʻrnatish', descriptionEn: 'Remove, install', estimatedTime: '1 час', estimatedTimeUz: '1 soat', estimatedTimeEn: '1 hour', minPrice: 80000 },
          { slug: 'insulate-windows', name: 'Утепление окон', nameUz: 'Derazalarni izolyatsiyalash', nameEn: 'Insulate windows', description: 'Уплотнители, герметизация швов, замена резинок', descriptionUz: 'Zichlagichlar, chok germetizatsiyasi, rezinkalarni almashtirish', descriptionEn: 'Seals, joint sealing, replace rubber strips', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 40000 },
          { slug: 'install-windowsill', name: 'Установка подоконника', nameUz: 'Deraza tokchasi oʻrnatish', nameEn: 'Install windowsill', description: 'Монтаж нового подоконника', descriptionUz: 'Yangi deraza tokchasi oʻrnatish', descriptionEn: 'Mount new windowsill', estimatedTime: '45-90 мин', estimatedTimeUz: '45-90 daq', estimatedTimeEn: '45-90 min', minPrice: 80000 },
          { slug: 'demontazh-wd-windows', name: 'Демонтаж окон', nameUz: 'Derazalarni demontaj qilish', nameEn: 'Remove windows', description: 'Снятие старых оконных рам', descriptionUz: 'Eski deraza ramalarini olib tashlash', descriptionEn: 'Remove old window frames', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 80000 },
        ],
      },
      {
        slug: 'wd-doors', name: 'Двери', nameUz: 'Eshiklar', nameEn: 'Doors', icon: 'DoorOpen',
        tasks: [
          { slug: 'install-entry-door', name: 'Монтаж входных дверей', nameUz: 'Kirish eshigini oʻrnatish', nameEn: 'Install entry doors', description: 'Установка металлических/деревянных', descriptionUz: 'Metall/yogʻoch oʻrnatish', descriptionEn: 'Install metal/wooden', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 150000 },
          { slug: 'install-interior-door', name: 'Монтаж межкомнатных дверей', nameUz: 'Xonalararo eshik oʻrnatish', nameEn: 'Install interior doors', description: 'Крепление, замок', descriptionUz: 'Mahkamlash, qulf', descriptionEn: 'Fix, lock', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 150000 },
          { slug: 'install-lock', name: 'Установка замков', nameUz: 'Qulf oʻrnatish', nameEn: 'Install locks', description: 'Врезка, замена', descriptionUz: 'Oʻrnatish, almashtirish', descriptionEn: 'Mortise, replace', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 80000 },
          { slug: 'adjust-doors', name: 'Регулировка дверей', nameUz: 'Eshiklarni rostlash', nameEn: 'Adjust doors', description: 'Регулировка петель, устранение трения, перекосов', descriptionUz: 'Ilgaklarni rostlash, ishqalanish, qiyshayishni bartaraf etish', descriptionEn: 'Adjust hinges, fix friction, misalignment', estimatedTime: '20-40 мин', estimatedTimeUz: '20-40 daq', estimatedTimeEn: '20-40 min', minPrice: 30000 },
          { slug: 'install-door-closer', name: 'Установка доводчика', nameUz: 'Dovodchik oʻrnatish', nameEn: 'Install door closer', description: 'Монтаж доводчика на дверь', descriptionUz: 'Eshikga dovodchik oʻrnatish', descriptionEn: 'Mount door closer', estimatedTime: '30-45 мин', estimatedTimeUz: '30-45 daq', estimatedTimeEn: '30-45 min', minPrice: 50000 },
          { slug: 'demontazh-wd-doors', name: 'Демонтаж дверей', nameUz: 'Eshiklarni demontaj qilish', nameEn: 'Remove doors', description: 'Снятие старых дверей с коробкой', descriptionUz: 'Eski eshiklarni quti bilan olib tashlash', descriptionEn: 'Remove old doors with frame', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 60000 },
        ],
      },
      {
        slug: 'wd-balcony', name: 'Балконы и лоджии', nameUz: 'Balkonlar va lojiyalar', nameEn: 'Balconies & loggias', icon: 'Building',
        tasks: [
          { slug: 'glaze-balcony', name: 'Остекление балкона', nameUz: 'Balkonni oynalash', nameEn: 'Glaze balcony', description: 'Монтаж рам', descriptionUz: 'Ramalar oʻrnatish', descriptionEn: 'Mount frames', estimatedTime: '4-8 часов', estimatedTimeUz: '4-8 soat', estimatedTimeEn: '4-8 hours', minPrice: 500000 },
          { slug: 'insulate-balcony', name: 'Утепление балкона', nameUz: 'Balkonni izolyatsiyalash', nameEn: 'Insulate balcony', description: 'Изоляция, обшивка', descriptionUz: 'Izolyatsiya, qoplash', descriptionEn: 'Insulation, cladding', estimatedTime: '3-6 часов', estimatedTimeUz: '3-6 soat', estimatedTimeEn: '3-6 hours', minPrice: 300000 },
          { slug: 'repair-balcony', name: 'Ремонт балкона', nameUz: 'Balkonni taʼmirlash', nameEn: 'Repair balcony', description: 'Восстановление плиты, ограждения, пола, стен', descriptionUz: 'Plita, toʻsiq, pol, devorlarni tiklash', descriptionEn: 'Restore slab, railing, floor, walls', estimatedTime: '4-8 часов', estimatedTimeUz: '4-8 soat', estimatedTimeEn: '4-8 hours', minPrice: 300000 },
          { slug: 'demontazh-wd-balcony', name: 'Демонтаж остекления балкона', nameUz: 'Balkon oynalashini demontaj qilish', nameEn: 'Remove balcony glazing', description: 'Снятие старых рам', descriptionUz: 'Eski ramalarni olib tashlash', descriptionEn: 'Remove old frames', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 200000 },
        ],
      },
      {
        slug: 'wd-blinds', name: 'Жалюзи/рольшторы', nameUz: 'Jalyuzi/roletlar', nameEn: 'Blinds/roller shutters', icon: 'SlidersHorizontal',
        tasks: [
          { slug: 'install-blinds', name: 'Установка жалюзи', nameUz: 'Jalyuzi oʻrnatish', nameEn: 'Install blinds', description: 'Крепление на окно', descriptionUz: 'Derazaga mahkamlash', descriptionEn: 'Mount on window', estimatedTime: '30 мин', estimatedTimeUz: '30 daq', estimatedTimeEn: '30 min', minPrice: 40000 },
          { slug: 'install-roller-blinds', name: 'Установка рольштор/ролет', nameUz: 'Rolet oʻrnatish', nameEn: 'Install roller blinds', description: 'Монтаж рулонных штор, ролет', descriptionUz: 'Rulon pardalar, roletlar oʻrnatish', descriptionEn: 'Mount roller blinds, shutters', estimatedTime: '30-45 мин', estimatedTimeUz: '30-45 daq', estimatedTimeEn: '30-45 min', minPrice: 40000 },
          { slug: 'install-curtain-rods', name: 'Монтаж карнизов', nameUz: 'Karniz oʻrnatish', nameEn: 'Mount curtain rods', description: 'Для штор', descriptionUz: 'Pardalar uchun', descriptionEn: 'For curtains', estimatedTime: '20-40 мин', estimatedTimeUz: '20-40 daq', estimatedTimeEn: '20-40 min', minPrice: 40000 },
          { slug: 'demontazh-wd-blinds', name: 'Демонтаж жалюзи/карнизов', nameUz: 'Jalyuzi/karnizni demontaj qilish', nameEn: 'Remove blinds/rods', description: 'Снятие старых жалюзи, карнизов', descriptionUz: 'Eski jalyuzi, karnizlarni olib tashlash', descriptionEn: 'Remove old blinds, rods', estimatedTime: '15-30 мин', estimatedTimeUz: '15-30 daq', estimatedTimeEn: '15-30 min', minPrice: 20000 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // 7. УСТАНОВКА БЫТОВОЙ ТЕХНИКИ И КЛИМАТ
  // ═══════════════════════════════════════════
  {
    slug: 'appliance-install',
    name: 'Установка бытовой техники',
    nameUz: 'Maishiy texnika oʻrnatish',
    nameEn: 'Appliance installation',
    icon: 'Plug',
    parentSlug: 'tech-equipment',
    subcategories: [
      {
        slug: 'appliance-kitchen', name: 'Кухонная техника', nameUz: 'Oshxona texnikasi', nameEn: 'Kitchen appliances', icon: 'CookingPot',
        tasks: [
          { slug: 'install-stove', name: 'Установка плиты', nameUz: 'Plita oʻrnatish', nameEn: 'Install stove', description: 'Газовой/электрической', descriptionUz: 'Gaz/elektr', descriptionEn: 'Gas/electric', estimatedTime: '45 мин', estimatedTimeUz: '45 daq', estimatedTimeEn: '45 min', minPrice: 100000 },
          { slug: 'install-hood', name: 'Установка вытяжки', nameUz: 'Soʻrgich oʻrnatish', nameEn: 'Install range hood', description: 'Крепление, вентиляция', descriptionUz: 'Mahkamlash, ventilyatsiya', descriptionEn: 'Mount, ventilation', estimatedTime: '45-90 мин', estimatedTimeUz: '45-90 daq', estimatedTimeEn: '45-90 min', minPrice: 100000 },
          { slug: 'install-builtin-oven', name: 'Монтаж встраиваемой духовки', nameUz: 'Oʻrnatiladigan pechni oʻrnatish', nameEn: 'Install built-in oven', description: 'Встройка в кухонную мебель, подключение', descriptionUz: 'Oshxona mebeliga oʻrnatish, ulash', descriptionEn: 'Fit into kitchen furniture, connect', estimatedTime: '45-60 мин', estimatedTimeUz: '45-60 daq', estimatedTimeEn: '45-60 min', minPrice: 100000 },
          { slug: 'install-cooktop-surface', name: 'Установка варочной поверхности', nameUz: 'Pishirish panelini oʻrnatish', nameEn: 'Install cooktop surface', description: 'Газовая/электрическая/индукционная, врезка в столешницу', descriptionUz: 'Gaz/elektr/induksion, stoleshnitsa ichiga oʻrnatish', descriptionEn: 'Gas/electric/induction, fit into countertop', estimatedTime: '45-90 мин', estimatedTimeUz: '45-90 daq', estimatedTimeEn: '45-90 min', minPrice: 120000 },
          { slug: 'install-dishwasher-kitchen', name: 'Установка посудомоечной машины', nameUz: 'Idish yuvish mashinasini oʻrnatish', nameEn: 'Install dishwasher', description: 'Встроенная/отдельная, подключение к воде и канализации', descriptionUz: 'Oʻrnatilgan/alohida, suv va kanalizatsiyaga ulash', descriptionEn: 'Built-in/freestanding, connect to water and drain', estimatedTime: '45-90 мин', estimatedTimeUz: '45-90 daq', estimatedTimeEn: '45-90 min', minPrice: 100000 },
          { slug: 'install-garbage-disposal', name: 'Установка диспоузера', nameUz: 'Dispouzer oʻrnatish', nameEn: 'Install garbage disposal', description: 'Монтаж под раковину, подключение', descriptionUz: 'Lavabo ostiga oʻrnatish, ulash', descriptionEn: 'Mount under sink, connect', estimatedTime: '45-60 мин', estimatedTimeUz: '45-60 daq', estimatedTimeEn: '45-60 min', minPrice: 80000 },
          { slug: 'install-freezer', name: 'Установка морозильника', nameUz: 'Muzlatgich oʻrnatish', nameEn: 'Install freezer', description: 'Подключение, выравнивание, проверка температуры', descriptionUz: 'Ulash, tekislash, harorat tekshirish', descriptionEn: 'Connect, level, check temperature', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 60000 },
          { slug: 'install-wine-cooler', name: 'Установка винного шкафа', nameUz: 'Vino shkafi oʻrnatish', nameEn: 'Install wine cooler', description: 'Встроенный/отдельный, подключение к электросети', descriptionUz: 'Oʻrnatilgan/alohida, elektr tarmogʻiga ulash', descriptionEn: 'Built-in/freestanding, connect to power', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 80000 },
          { slug: 'install-ice-maker', name: 'Установка ледогенератора', nameUz: 'Muz generatori oʻrnatish', nameEn: 'Install ice maker', description: 'Подключение к водоснабжению и электросети', descriptionUz: 'Suv taʼminoti va elektr tarmogʻiga ulash', descriptionEn: 'Connect to water supply and power', estimatedTime: '45-90 мин', estimatedTimeUz: '45-90 daq', estimatedTimeEn: '45-90 min', minPrice: 100000 },
          { slug: 'install-multicooker', name: 'Подключение мультиварки/пароварки', nameUz: 'Multivarka/parovarka ulash', nameEn: 'Connect multicooker/steamer', description: 'Установка, проверка работы, настройка', descriptionUz: 'Oʻrnatish, ishlashni tekshirish, sozlash', descriptionEn: 'Install, test, setup', estimatedTime: '15-30 мин', estimatedTimeUz: '15-30 daq', estimatedTimeEn: '15-30 min', minPrice: 30000 },
          { slug: 'install-water-purifier', name: 'Установка системы очистки воды', nameUz: 'Suv tozalash tizimini oʻrnatish', nameEn: 'Install water purification system', description: 'Обратный осмос, фильтры под мойку', descriptionUz: 'Teskari osmos, yuvgich ostiga filtrlar', descriptionEn: 'Reverse osmosis, under-sink filters', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 150000 },
          { slug: 'repair-kitchen-appliance', name: 'Ремонт кухонной техники', nameUz: 'Oshxona texnikasi taʼmiri', nameEn: 'Repair kitchen appliance', description: 'Диагностика и ремонт плиты, духовки, вытяжки', descriptionUz: 'Plita, pech, soʻrgich diagnostikasi va taʼmiri', descriptionEn: 'Diagnose and repair stove, oven, hood', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 150000 },
          { slug: 'demontazh-appliance-kitchen', name: 'Демонтаж кухонной техники', nameUz: 'Oshxona texnikasini demontaj qilish', nameEn: 'Remove kitchen appliances', description: 'Снятие плиты, вытяжки, духовки, посудомойки', descriptionUz: 'Plita, soʻrgich, pech, idish yuvgichni olib tashlash', descriptionEn: 'Remove stove, hood, oven, dishwasher', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 50000 },
        ],
      },
      {
        slug: 'appliance-climate', name: 'Климат и отопление', nameUz: 'Iqlim va isitish', nameEn: 'Climate & heating', icon: 'Snowflake',
        tasks: [
          { slug: 'install-ac', name: 'Монтаж настенного кондиционера', nameUz: 'Devorga konditsioner oʻrnatish', nameEn: 'Install wall AC', description: 'Сплит-система: внутренний и внешний блок', descriptionUz: 'Split-tizim: ichki va tashqi blok', descriptionEn: 'Split system: indoor and outdoor unit', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 300000 },
          { slug: 'install-floor-ac', name: 'Установка напольного кондиционера', nameUz: 'Polga konditsioner oʻrnatish', nameEn: 'Install floor AC', description: 'Напольная/колонная сплит-система', descriptionUz: 'Pol/kolonna split-tizim', descriptionEn: 'Floor/column split system', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 400000 },
          { slug: 'install-ceiling-ac', name: 'Установка потолочного кондиционера', nameUz: 'Shiftga konditsioner oʻrnatish', nameEn: 'Install ceiling AC', description: 'Потолочная сплит-система', descriptionUz: 'Shift split-tizim', descriptionEn: 'Ceiling split system', estimatedTime: '3-5 часов', estimatedTimeUz: '3-5 soat', estimatedTimeEn: '3-5 hours', minPrice: 500000 },
          { slug: 'install-cassette-ac', name: 'Установка кассетного кондиционера', nameUz: 'Kassetali konditsioner oʻrnatish', nameEn: 'Install cassette AC', description: 'Встраивается в подвесной потолок', descriptionUz: 'Osma shiftga oʻrnatiladigan', descriptionEn: 'Built into suspended ceiling', estimatedTime: '3-6 часов', estimatedTimeUz: '3-6 soat', estimatedTimeEn: '3-6 hours', minPrice: 600000 },
          { slug: 'install-ducted-ac', name: 'Установка канального кондиционера', nameUz: 'Kanalli konditsioner oʻrnatish', nameEn: 'Install ducted AC', description: 'Канальная система с воздуховодами', descriptionUz: 'Havo yoʻllari bilan kanalli tizim', descriptionEn: 'Ducted system with air ducts', estimatedTime: '4-8 часов', estimatedTimeUz: '4-8 soat', estimatedTimeEn: '4-8 hours', minPrice: 800000 },
          { slug: 'install-multi-split', name: 'Установка мульти-сплит системы', nameUz: 'Multi-split tizim oʻrnatish', nameEn: 'Install multi-split system', description: 'Один внешний блок на несколько внутренних', descriptionUz: 'Bir tashqi blok bir necha ichki blokka', descriptionEn: 'One outdoor unit for multiple indoor units', estimatedTime: '4-8 часов', estimatedTimeUz: '4-8 soat', estimatedTimeEn: '4-8 hours', minPrice: 700000 },
          { slug: 'service-ac', name: 'Чистка/обслуживание кондиционера', nameUz: 'Konditsionerni tozalash/texnik xizmat', nameEn: 'AC cleaning/maintenance', description: 'Чистка фильтров, дозаправка фреона', descriptionUz: 'Filtrlarni tozalash, freon qoʻshish', descriptionEn: 'Clean filters, recharge freon', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 150000 },
          { slug: 'repair-ac', name: 'Ремонт кондиционера', nameUz: 'Konditsioner taʼmiri', nameEn: 'Repair AC', description: 'Диагностика неисправностей, замена компрессора, платы', descriptionUz: 'Nosozlikni diagnostikasi, kompressor, plata almashtirish', descriptionEn: 'Diagnose faults, replace compressor, board', estimatedTime: '1-4 часа', estimatedTimeUz: '1-4 soat', estimatedTimeEn: '1-4 hours', minPrice: 200000 },
          { slug: 'install-air-curtain', name: 'Установка тепловой завесы', nameUz: 'Issiqlik pardasi oʻrnatish', nameEn: 'Install air curtain', description: 'Над дверным проёмом, подключение к электросети', descriptionUz: 'Eshik ustiga, elektr tarmogʻiga ulash', descriptionEn: 'Above doorway, connect to power', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 200000 },
          { slug: 'install-fan', name: 'Установка вентилятора', nameUz: 'Ventilyator oʻrnatish', nameEn: 'Install fan', description: 'Потолочного/настенного', descriptionUz: 'Shiftga/devorga', descriptionEn: 'Ceiling/wall', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 60000 },
          { slug: 'install-heater', name: 'Монтаж обогревателя', nameUz: 'Isitgich oʻrnatish', nameEn: 'Install heater', description: 'Настенный/напольный, электрический/газовый', descriptionUz: 'Devorga/polga, elektr/gaz', descriptionEn: 'Wall/floor, electric/gas', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 60000 },
          { slug: 'install-humidifier', name: 'Установка увлажнителя воздуха', nameUz: 'Havo namlagich oʻrnatish', nameEn: 'Install humidifier', description: 'Подключение стационарного увлажнителя', descriptionUz: 'Statsionar namlagichni ulash', descriptionEn: 'Connect stationary humidifier', estimatedTime: '30 мин', estimatedTimeUz: '30 daq', estimatedTimeEn: '30 min', minPrice: 40000 },
          { slug: 'install-dehumidifier', name: 'Установка осушителя воздуха', nameUz: 'Havo quritgich oʻrnatish', nameEn: 'Install dehumidifier', description: 'Промышленный/бытовой осушитель', descriptionUz: 'Sanoat/maishiy quritgich', descriptionEn: 'Industrial/household dehumidifier', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 50000 },
          { slug: 'install-air-purifier', name: 'Установка очистителя воздуха', nameUz: 'Havo tozalagich oʻrnatish', nameEn: 'Install air purifier', description: 'Канальный/настенный очиститель с HEPA-фильтром', descriptionUz: 'Kanalli/devorga HEPA-filtrli tozalagich', descriptionEn: 'Ducted/wall air purifier with HEPA filter', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 60000 },
          { slug: 'install-recuperator', name: 'Установка рекуператора', nameUz: 'Rekuperator oʻrnatish', nameEn: 'Install heat recovery ventilator', description: 'Приточно-вытяжная вентиляция с рекуперацией тепла', descriptionUz: 'Issiqlik qayta tiklash bilan kiritma-chiqarma ventilyatsiya', descriptionEn: 'Supply-exhaust ventilation with heat recovery', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 300000 },
          { slug: 'install-ventilation-system', name: 'Монтаж вентиляционной системы', nameUz: 'Ventilyatsiya tizimini oʻrnatish', nameEn: 'Install ventilation system', description: 'Проектирование и монтаж приточно-вытяжной вентиляции', descriptionUz: 'Kiritma-chiqarma ventilyatsiya loyihalash va oʻrnatish', descriptionEn: 'Design and install supply-exhaust ventilation', estimatedTime: '4-8 часов', estimatedTimeUz: '4-8 soat', estimatedTimeEn: '4-8 hours', minPrice: 500000 },
          { slug: 'demontazh-appliance-climate', name: 'Демонтаж кондиционера', nameUz: 'Konditsionerni demontaj qilish', nameEn: 'Remove AC unit', description: 'Снятие внутреннего/внешнего блока любого типа', descriptionUz: 'Har qanday turdagi ichki/tashqi blokni olib tashlash', descriptionEn: 'Remove indoor/outdoor unit of any type', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 150000 },
        ],
      },
      {
        slug: 'appliance-av', name: 'Аудио/видео и IT', nameUz: 'Audio/video va IT', nameEn: 'Audio/video & IT', icon: 'Monitor',
        tasks: [
          { slug: 'mount-tv', name: 'Установка ТВ', nameUz: 'TV oʻrnatish', nameEn: 'Mount TV', description: 'Крепление на стену', descriptionUz: 'Devorga mahkamlash', descriptionEn: 'Wall mount', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 60000 },
          { slug: 'setup-smart-tv', name: 'Настройка Smart TV', nameUz: 'Smart TV sozlash', nameEn: 'Setup Smart TV', description: 'Подключение к WiFi, установка приложений, настройка каналов', descriptionUz: 'WiFi-ga ulash, ilovalar oʻrnatish, kanallarni sozlash', descriptionEn: 'Connect to WiFi, install apps, tune channels', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 40000 },
          { slug: 'setup-home-theater', name: 'Монтаж акустики', nameUz: 'Akustika oʻrnatish', nameEn: 'Setup home theater', description: 'Домашний кинотеатр, саундбар', descriptionUz: 'Uy kinoteatri, soundbar', descriptionEn: 'Home theater, soundbar', estimatedTime: '1 час', estimatedTimeUz: '1 soat', estimatedTimeEn: '1 hour', minPrice: 100000 },
          { slug: 'install-router', name: 'Установка роутера', nameUz: 'Router oʻrnatish', nameEn: 'Install router', description: 'Монтаж, настройка WiFi, пароль, диапазоны', descriptionUz: 'Oʻrnatish, WiFi sozlash, parol, diapazonlar', descriptionEn: 'Mount, setup WiFi, password, bands', estimatedTime: '30-45 мин', estimatedTimeUz: '30-45 daq', estimatedTimeEn: '30-45 min', minPrice: 40000 },
          { slug: 'lay-internet-cable', name: 'Прокладка интернет-кабеля', nameUz: 'Internet kabelini yotqizish', nameEn: 'Lay internet cable', description: 'Ethernet кабель по квартире/дому, обжимка', descriptionUz: 'Kvartira/uy boʻylab Ethernet kabel, siqish', descriptionEn: 'Ethernet cable throughout apartment/house, crimping', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 80000 },
          { slug: 'demontazh-appliance-av', name: 'Демонтаж ТВ/акустики', nameUz: 'TV/akustikani demontaj qilish', nameEn: 'Remove TV/audio', description: 'Снятие со стены, отключение', descriptionUz: 'Devordan olib tashlash, uzish', descriptionEn: 'Remove from wall, disconnect', estimatedTime: '15-30 мин', estimatedTimeUz: '15-30 daq', estimatedTimeEn: '15-30 min', minPrice: 30000 },
        ],
      },
      {
        slug: 'appliance-bathroom', name: 'Техника для санузла', nameUz: 'Sanuzl texnikasi', nameEn: 'Bathroom appliances', icon: 'Bath',
        tasks: [
          { slug: 'install-heated-towel-rail', name: 'Установка полотенцесушителя', nameUz: 'Sochiq quritgich oʻrnatish', nameEn: 'Install heated towel rail', description: 'Электрический или водяной полотенцесушитель', descriptionUz: 'Elektr yoki suvli sochiq quritgich', descriptionEn: 'Electric or water heated towel rail', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 100000 },
          { slug: 'install-bathroom-fan', name: 'Установка вытяжного вентилятора', nameUz: 'Soʻrgich ventilyator oʻrnatish', nameEn: 'Install exhaust fan', description: 'Монтаж вентилятора в ванную/туалет', descriptionUz: 'Hammom/hojatxonaga ventilyator oʻrnatish', descriptionEn: 'Mount fan in bathroom/toilet', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 60000 },
          { slug: 'install-bathroom-mirror-cabinet', name: 'Установка зеркала-шкафа', nameUz: 'Koʻzgu-shkaf oʻrnatish', nameEn: 'Install mirror cabinet', description: 'Зеркальный шкафчик с подсветкой', descriptionUz: 'Yoritishli koʻzgu shkafcha', descriptionEn: 'Mirror cabinet with lighting', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 60000 },
          { slug: 'install-boiler', name: 'Установка бойлера/водонагревателя', nameUz: 'Boyler/suv isitgich oʻrnatish', nameEn: 'Install water heater/boiler', description: 'Накопительный или проточный водонагреватель', descriptionUz: 'Toʻplovchi yoki oqar suv isitgich', descriptionEn: 'Storage or tankless water heater', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 150000 },
          { slug: 'install-shower-cabin', name: 'Установка душевой кабины', nameUz: 'Dush kabinasi oʻrnatish', nameEn: 'Install shower cabin', description: 'Сборка и подключение душевой кабины', descriptionUz: 'Dush kabinasini yigʻish va ulash', descriptionEn: 'Assemble and connect shower cabin', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 200000 },
          { slug: 'install-jacuzzi', name: 'Установка джакузи/гидромассажной ванны', nameUz: 'Jakuzi/gidromassaj vannasi oʻrnatish', nameEn: 'Install jacuzzi/hot tub', description: 'Монтаж, подключение воды и электрики', descriptionUz: 'Oʻrnatish, suv va elektr ulash', descriptionEn: 'Mount, connect water and electricity', estimatedTime: '3-6 часов', estimatedTimeUz: '3-6 soat', estimatedTimeEn: '3-6 hours', minPrice: 400000 },
          { slug: 'install-bidet', name: 'Установка биде', nameUz: 'Bide oʻrnatish', nameEn: 'Install bidet', description: 'Отдельное биде или крышка-биде на унитаз', descriptionUz: 'Alohida bide yoki unitazga bide qopqogʻi', descriptionEn: 'Standalone bidet or bidet seat', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 100000 },
          { slug: 'install-hygienic-shower', name: 'Установка гигиенического душа', nameUz: 'Gigiyenik dush oʻrnatish', nameEn: 'Install hygienic shower', description: 'Монтаж гигиенического душа с смесителем', descriptionUz: 'Aralashtirgichli gigiyenik dush oʻrnatish', descriptionEn: 'Mount hygienic shower with mixer', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 80000 },
          { slug: 'install-bathroom-shelf', name: 'Монтаж полок и аксессуаров', nameUz: 'Tokcha va aksessuarlar oʻrnatish', nameEn: 'Install shelves and accessories', description: 'Полки, держатели, крючки в санузле', descriptionUz: 'Tokchalar, tutqichlar, ilgaklar', descriptionEn: 'Shelves, holders, hooks in bathroom', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 40000 },
          { slug: 'install-bathroom-hand-dryer', name: 'Установка сушилки для рук', nameUz: 'Qoʻl quritgich oʻrnatish', nameEn: 'Install hand dryer', description: 'Электрическая сушилка для рук', descriptionUz: 'Elektr qoʻl quritgich', descriptionEn: 'Electric hand dryer', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 50000 },
          { slug: 'install-bathroom-lighting', name: 'Установка подсветки в санузле', nameUz: 'Sanuzlda yoritish oʻrnatish', nameEn: 'Install bathroom lighting', description: 'LED-подсветка зеркала, ниши, потолка', descriptionUz: 'Koʻzgu, tokcha, shift LED-yoritishi', descriptionEn: 'LED lighting for mirror, niche, ceiling', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 80000 },
          { slug: 'repair-bathroom-appliance', name: 'Ремонт техники санузла', nameUz: 'Sanuzl texnikasini taʼmiri', nameEn: 'Repair bathroom appliance', description: 'Бойлер, кабина, полотенцесушитель', descriptionUz: 'Boyler, kabina, sochiq quritgich', descriptionEn: 'Boiler, cabin, towel rail', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 100000 },
          { slug: 'demontazh-appliance-bathroom', name: 'Демонтаж техники санузла', nameUz: 'Sanuzl texnikasini demontaj qilish', nameEn: 'Remove bathroom appliances', description: 'Снятие бойлера, кабины, полотенцесушителя', descriptionUz: 'Boyler, kabina, sochiq quritgichni olib tashlash', descriptionEn: 'Remove boiler, cabin, towel rail', estimatedTime: '20-60 мин', estimatedTimeUz: '20-60 daq', estimatedTimeEn: '20-60 min', minPrice: 40000 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // 8. ПЛОТНИЦКИЕ И СТОЛЯРНЫЕ РАБОТЫ
  // ═══════════════════════════════════════════
  {
    slug: 'carpentry',
    name: 'Плотницкие и столярные работы',
    nameUz: 'Duradgorlik va stolyarlik ishlari',
    nameEn: 'Carpentry & woodwork',
    icon: 'TreePine',
    parentSlug: 'construction-building',
    subcategories: [
      {
        slug: 'carpentry-woodwork', name: 'Деревообработка', nameUz: 'Yogʻoch ishlov berish', nameEn: 'Woodwork', icon: 'Axe',
        tasks: [
          { slug: 'make-shelves', name: 'Изготовление полок', nameUz: 'Javon yasash', nameEn: 'Make shelves', description: 'Простые деревянные', descriptionUz: 'Oddiy yogʻoch', descriptionEn: 'Simple wooden', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 100000 },
          { slug: 'repair-wood-structures', name: 'Ремонт деревянных конструкций', nameUz: 'Yogʻoch konstruksiyalar taʼmiri', nameEn: 'Repair wooden structures', description: 'Двери/окна/рамы', descriptionUz: 'Eshiklar/derazalar/ramalar', descriptionEn: 'Doors/windows/frames', estimatedTime: '45 мин', estimatedTimeUz: '45 daq', estimatedTimeEn: '45 min', minPrice: 80000 },
          { slug: 'wood-cutting', name: 'Резка дерева', nameUz: 'Yogʻoch kesish', nameEn: 'Wood cutting', description: 'Распил досок, бруса по размеру', descriptionUz: 'Taxta, brusni oʻlchamga kesish', descriptionEn: 'Cut boards, timber to size', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 30000 },
          { slug: 'wood-carving', name: 'Резьба по дереву / декор', nameUz: 'Yogʻochga oʻymakorlik / dekor', nameEn: 'Wood carving / decoration', description: 'Декоративная резьба, узоры', descriptionUz: 'Dekorativ oʻymakorlik, naqshlar', descriptionEn: 'Decorative carving, patterns', estimatedTime: '2-6 часов', estimatedTimeUz: '2-6 soat', estimatedTimeEn: '2-6 hours', minPrice: 150000 },
          { slug: 'install-wood-panels', name: 'Монтаж деревянных панелей', nameUz: 'Yogʻoch panellar oʻrnatish', nameEn: 'Install wooden panels', description: 'Вагонка, панели на стены/потолок (за м²)', descriptionUz: 'Vagonka, devor/shiftga panellar (m² uchun)', descriptionEn: 'Wainscoting, panels on walls/ceiling (per m²)', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 80000 },
          { slug: 'repair-stairs', name: 'Ремонт лестниц', nameUz: 'Zinapoyani taʼmirlash', nameEn: 'Repair stairs', description: 'Замена ступеней, перил, укрепление', descriptionUz: 'Poyapoʻnalar, panjaralar almashtirish, mustahkamlash', descriptionEn: 'Replace steps, railings, reinforce', estimatedTime: '2-6 часов', estimatedTimeUz: '2-6 soat', estimatedTimeEn: '2-6 hours', minPrice: 200000 },
          { slug: 'demontazh-carpentry-woodwork', name: 'Демонтаж деревянных конструкций', nameUz: 'Yogʻoch konstruksiyalarni demontaj qilish', nameEn: 'Remove wooden structures', description: 'Снятие старых полок, обшивки, панелей', descriptionUz: 'Eski javonlar, qoplama, panellarni olib tashlash', descriptionEn: 'Remove old shelves, cladding, panels', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 40000 },
        ],
      },
      {
        slug: 'carpentry-outdoor', name: 'Наружные работы', nameUz: 'Tashqi ishlar', nameEn: 'Outdoor work', icon: 'Fence',
        tasks: [
          { slug: 'install-wooden-fence', name: 'Установка заборов', nameUz: 'Devor oʻrnatish', nameEn: 'Install fences', description: 'Деревянных', descriptionUz: 'Yogʻoch', descriptionEn: 'Wooden', estimatedTime: '4-8 часов', estimatedTimeUz: '4-8 soat', estimatedTimeEn: '4-8 hours', minPrice: 500000 },
          { slug: 'build-gazebo', name: 'Монтаж беседок', nameUz: 'Ayvon qurish', nameEn: 'Build gazebo', description: 'Сборка', descriptionUz: 'Yigʻish', descriptionEn: 'Assembly', estimatedTime: '3-6 часов', estimatedTimeUz: '3-6 soat', estimatedTimeEn: '3-6 hours', minPrice: 500000 },
          { slug: 'repair-wood-floor', name: 'Ремонт деревянных полов', nameUz: 'Yogʻoch pol taʼmiri', nameEn: 'Repair wooden floors', description: 'Замена досок', descriptionUz: 'Taxtalarni almashtirish', descriptionEn: 'Replace boards', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 150000 },
          { slug: 'build-deck-terrace', name: 'Монтаж террасы/настила', nameUz: 'Terrasa/yogʻoch pol oʻrnatish', nameEn: 'Build deck/terrace', description: 'Деревянный настил, террасная доска', descriptionUz: 'Yogʻoch pol, terrasa taxtasi', descriptionEn: 'Wooden decking, terrace board', estimatedTime: '4-8 часов', estimatedTimeUz: '4-8 soat', estimatedTimeEn: '4-8 hours', minPrice: 300000 },
          { slug: 'paint-fence', name: 'Покраска забора', nameUz: 'Devorni boʻyash', nameEn: 'Paint fence', description: 'Подготовка, покраска/лакировка', descriptionUz: 'Tayyorlash, boʻyash/laklash', descriptionEn: 'Prepare, paint/varnish', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 150000 },
          { slug: 'demontazh-carpentry-outdoor', name: 'Демонтаж забора/беседки', nameUz: 'Devor/ayvonni demontaj qilish', nameEn: 'Remove fence/gazebo', description: 'Разборка старых конструкций', descriptionUz: 'Eski konstruksiyalarni yechish', descriptionEn: 'Disassemble old structures', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 200000 },
        ],
      },
      {
        slug: 'carpentry-custom', name: 'Мебель на заказ', nameUz: 'Buyurtma mebel', nameEn: 'Custom furniture', icon: 'Armchair',
        tasks: [
          { slug: 'custom-bookshelf', name: 'Книжный шкаф на заказ', nameUz: 'Buyurtma kitob shkafi', nameEn: 'Custom bookshelf', description: 'Изготовление по размерам', descriptionUz: 'Oʻlchamlar boʻyicha yasash', descriptionEn: 'Made to measure', estimatedTime: '8-16 часов', estimatedTimeUz: '8-16 soat', estimatedTimeEn: '8-16 hours', minPrice: 500000 },
          { slug: 'custom-table', name: 'Стол на заказ', nameUz: 'Buyurtma stol', nameEn: 'Custom table', description: 'Обеденный/рабочий из дерева/фанеры', descriptionUz: 'Ovqatlanish/ish stoli yogʻoch/fanera', descriptionEn: 'Dining/work table from wood/plywood', estimatedTime: '6-12 часов', estimatedTimeUz: '6-12 soat', estimatedTimeEn: '6-12 hours', minPrice: 400000 },
          { slug: 'custom-kitchen-island', name: 'Кухонный остров на заказ', nameUz: 'Buyurtma oshxona oroli', nameEn: 'Custom kitchen island', description: 'Столешница, полки, выдвижные ящики', descriptionUz: 'Stoleshnitsa, javonlar, tortma quti', descriptionEn: 'Countertop, shelves, drawers', estimatedTime: '10-20 часов', estimatedTimeUz: '10-20 soat', estimatedTimeEn: '10-20 hours', minPrice: 800000 },
        ],
      },
      {
        slug: 'carpentry-carving', name: 'Резьба и декор', nameUz: 'Oʻymakorlik va dekor', nameEn: 'Carving & decor', icon: 'Shapes',
        tasks: [
          { slug: 'carving-ornament', name: 'Декоративный орнамент', nameUz: 'Dekorativ ornament', nameEn: 'Decorative ornament', description: 'Резьба узоров, узбекские мотивы', descriptionUz: 'Naqshlar oʻyishi, oʻzbek motivlari', descriptionEn: 'Pattern carving, Uzbek motifs', estimatedTime: '4-8 часов', estimatedTimeUz: '4-8 soat', estimatedTimeEn: '4-8 hours', minPrice: 200000 },
          { slug: 'carving-door-frame', name: 'Резная дверная рама', nameUz: 'Oʻyma eshik romasi', nameEn: 'Carved door frame', description: 'Ручная резьба на дверной коробке', descriptionUz: 'Eshik qutisida qoʻlda oʻyma', descriptionEn: 'Hand carving on door frame', estimatedTime: '6-12 часов', estimatedTimeUz: '6-12 soat', estimatedTimeEn: '6-12 hours', minPrice: 300000 },
          { slug: 'wood-restoration', name: 'Реставрация деревянных изделий', nameUz: 'Yogʻoch buyumlarni qayta tiklash', nameEn: 'Wood item restoration', description: 'Восстановление антикварной мебели, деталей', descriptionUz: 'Antik mebel, detallarni tiklash', descriptionEn: 'Restore antique furniture, details', estimatedTime: '4-10 часов', estimatedTimeUz: '4-10 soat', estimatedTimeEn: '4-10 hours', minPrice: 250000 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // 9. КЛИНИНГ И УБОРКА
  // ═══════════════════════════════════════════
  {
    slug: 'cleaning',
    name: 'Клининг и уборка',
    nameUz: 'Tozalash va yigʻishtirish',
    nameEn: 'Cleaning',
    icon: 'SprayCan',
    parentSlug: 'home-help',
    subcategories: [
      {
        slug: 'cleaning-general', name: 'Генеральная уборка', nameUz: 'Umumiy tozalash', nameEn: 'Deep cleaning', icon: 'Home',
        tasks: [
          { slug: 'clean-apartment', name: 'Генеральная уборка квартиры', nameUz: 'Kvartira umumiy tozalash', nameEn: 'Deep clean apartment', description: 'Полная уборка всех помещений', descriptionUz: 'Barcha xonalarni toʻliq tozalash', descriptionEn: 'Full cleaning of all rooms', estimatedTime: '3-6 часов', estimatedTimeUz: '3-6 soat', estimatedTimeEn: '3-6 hours', minPrice: 200000 },
          { slug: 'wash-windows', name: 'Мытьё окон', nameUz: 'Derazalarni yuvish', nameEn: 'Wash windows', description: 'Внутри/снаружи', descriptionUz: 'Ichki/tashqi', descriptionEn: 'Inside/outside', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 100000 },
          { slug: 'clean-bathroom', name: 'Уборка санузла', nameUz: 'Sanuzl tozalash', nameEn: 'Clean bathroom', description: 'Дезинфекция', descriptionUz: 'Dezinfeksiya', descriptionEn: 'Disinfection', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 80000 },
          { slug: 'clean-kitchen-deep', name: 'Глубокая уборка кухни', nameUz: 'Oshxonani chuqur tozalash', nameEn: 'Deep clean kitchen', description: 'Чистка плиты, духовки, вытяжки, шкафов', descriptionUz: 'Plita, pech, soʻrgich, shkaflarni tozalash', descriptionEn: 'Clean stove, oven, hood, cabinets', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 150000 },
          { slug: 'clean-floors-walls', name: 'Уборка полов и стен', nameUz: 'Pol va devorlarni tozalash', nameEn: 'Clean floors & walls', description: 'Мытьё, дезинфекция полов и стен', descriptionUz: 'Pol va devorlarni yuvish, dezinfeksiya', descriptionEn: 'Wash, disinfect floors and walls', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 150000 },
          { slug: 'dust-removal', name: 'Удаление пыли', nameUz: 'Changni tozalash', nameEn: 'Dust removal', description: 'Тщательная очистка всех поверхностей от пыли', descriptionUz: 'Barcha sirtlarni changdan sinchkovlik bilan tozalash', descriptionEn: 'Thorough dust cleaning of all surfaces', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 80000 },
          { slug: 'organize-declutter', name: 'Организация и сортировка вещей', nameUz: 'Narsalarni tartibga solish va saralash', nameEn: 'Organize & declutter', description: 'Разбор вещей, организация хранения', descriptionUz: 'Narsalarni ajratish, saqlashni tashkil etish', descriptionEn: 'Sort items, organize storage', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 100000 },
        ],
      },
      {
        slug: 'cleaning-post-renovation', name: 'После ремонта', nameUz: 'Taʼmirdan keyin', nameEn: 'Post-renovation', icon: 'Construction',
        tasks: [
          { slug: 'remove-debris', name: 'Уборка строительного мусора', nameUz: 'Qurilish axlatini tozalash', nameEn: 'Remove construction debris', description: 'Вынос мусора, пыли', descriptionUz: 'Axlat, changni chiqarish', descriptionEn: 'Remove debris, dust', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 200000 },
          { slug: 'clean-surfaces-renovation', name: 'Чистка после ремонта', nameUz: 'Taʼmirdan keyin tozalash', nameEn: 'Post-renovation cleaning', description: 'От краски/штукатурки/клея', descriptionUz: 'Boʻyoq/suvaq/yelimdan', descriptionEn: 'From paint/plaster/glue', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 300000 },
        ],
      },
      {
        slug: 'cleaning-specialized', name: 'Специализированная уборка', nameUz: 'Maxsus tozalash', nameEn: 'Specialized cleaning', icon: 'Sparkles',
        tasks: [
          { slug: 'clean-carpets', name: 'Чистка ковров', nameUz: 'Gilam tozalash', nameEn: 'Clean carpets', description: 'Сухая/влажная', descriptionUz: 'Quruq/hoʻl', descriptionEn: 'Dry/wet', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 150000 },
          { slug: 'clean-upholstery', name: 'Чистка мебели', nameUz: 'Mebel tozalash', nameEn: 'Clean upholstery', description: 'Обивка диванов, кресел', descriptionUz: 'Divan, kresel qoplamasi', descriptionEn: 'Sofa, chair upholstery', estimatedTime: '45 мин', estimatedTimeUz: '45 daq', estimatedTimeEn: '45 min', minPrice: 100000 },
          { slug: 'clean-garage-balcony', name: 'Уборка гаража/балкона/подвала', nameUz: 'Garaj/balkon/yertola tozalash', nameEn: 'Clean garage/balcony/basement', description: 'Полная уборка подсобных помещений', descriptionUz: 'Yordamchi xonalarni toʻliq tozalash', descriptionEn: 'Full cleaning of utility rooms', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 150000 },
          { slug: 'clean-facade', name: 'Мойка фасада/водостоков', nameUz: 'Fasad/suv tushiruvchilarni yuvish', nameEn: 'Wash facade/gutters', description: 'Мойка высокого давления', descriptionUz: 'Yuqori bosimli yuvish', descriptionEn: 'Pressure washing', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 200000 },
        ],
      },
      {
        slug: 'cleaning-organization', name: 'Организация пространства', nameUz: 'Makonni tartibga solish', nameEn: 'Space organization', icon: 'PackageOpen',
        tasks: [
          { slug: 'organize-closets', name: 'Организация шкафов/гардеробной', nameUz: 'Shkaflar/garderobni tartibga solish', nameEn: 'Organize closets/wardrobe', description: 'Разбор, сортировка, системы хранения', descriptionUz: 'Ajratish, saralash, saqlash tizimlari', descriptionEn: 'Sort, organize, storage systems', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 100000 },
          { slug: 'organize-pantry', name: 'Организация кладовой/подвала', nameUz: 'Omborxona/yertolani tartibga solish', nameEn: 'Organize pantry/basement', description: 'Полки, контейнеры, маркировка', descriptionUz: 'Javonlar, idishlar, belgilash', descriptionEn: 'Shelves, containers, labeling', estimatedTime: '2-3 часа', estimatedTimeUz: '2-3 soat', estimatedTimeEn: '2-3 hours', minPrice: 80000 },
          { slug: 'clean-yard-territory', name: 'Уборка территории/двора', nameUz: 'Hudud/hovli tozalash', nameEn: 'Yard/territory cleanup', description: 'Подметание, мойка, уборка мусора на участке (кросс-категория: Сад/Двор)', descriptionUz: 'Supurish, yuvish, hududda axlat tozalash', descriptionEn: 'Sweeping, washing, trash removal on property', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 120000 },
          { slug: 'clean-pool', name: 'Чистка бассейна', nameUz: 'Hovuzni tozalash', nameEn: 'Pool cleaning', description: 'Чистка стен, дна, фильтрация (кросс-категория: Сад/Двор)', descriptionUz: 'Devor, tub, filtratsiyani tozalash', descriptionEn: 'Clean walls, bottom, filtration', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 200000 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // 10. САДОВОДСТВО И НАРУЖНЫЕ РАБОТЫ
  // ═══════════════════════════════════════════
  {
    slug: 'garden-outdoor',
    name: 'Садоводство и наружные работы',
    nameUz: 'Bogʻdorchilik va tashqi ishlar',
    nameEn: 'Garden & outdoor work',
    icon: 'Leaf',
    parentSlug: 'home-help',
    subcategories: [
      {
        slug: 'garden-care', name: 'Уход за садом', nameUz: 'Bogʻ parvarishi', nameEn: 'Garden care', icon: 'Sprout',
        tasks: [
          { slug: 'mow-lawn', name: 'Стрижка газона / уборка участка', nameUz: 'Maysazorni qirqish / yer tozalash', nameEn: 'Mow lawn / yard cleanup', description: 'Косилка, уборка', descriptionUz: 'Oʻroq mashinasi, tozalash', descriptionEn: 'Mower, cleanup', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 100000 },
          { slug: 'plant-flowers', name: 'Посадка растений', nameUz: 'Oʻsimlik ekish', nameEn: 'Plant flowers/trees', description: 'Цветы/деревья/кусты', descriptionUz: 'Gullar/daraxtlar/butalar', descriptionEn: 'Flowers/trees/shrubs', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 80000 },
          { slug: 'prune-trees', name: 'Обрезка деревьев/кустарников', nameUz: 'Daraxtlar/butalarni kesish', nameEn: 'Prune trees/shrubs', description: 'Формирование кроны, санитарная обрезка', descriptionUz: 'Toj shakllantirish, sanitariya kesish', descriptionEn: 'Shape crown, sanitary pruning', estimatedTime: '1-4 часа', estimatedTimeUz: '1-4 soat', estimatedTimeEn: '1-4 hours', minPrice: 100000 },
          { slug: 'watering-fertilizing', name: 'Полив и удобрение', nameUz: 'Sugʻorish va oʻgʻitlash', nameEn: 'Watering & fertilizing', description: 'Полив, подкормка, мульчирование', descriptionUz: 'Sugʻorish, oziqlantirish, mulchalash', descriptionEn: 'Water, feed, mulch', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 60000 },
          { slug: 'install-irrigation', name: 'Установка системы полива', nameUz: 'Sugʻorish tizimini oʻrnatish', nameEn: 'Install irrigation system', description: 'Капельный/автоматический полив', descriptionUz: 'Tomchilatib/avtomatik sugʻorish', descriptionEn: 'Drip/automatic irrigation', estimatedTime: '3-6 часов', estimatedTimeUz: '3-6 soat', estimatedTimeEn: '3-6 hours', minPrice: 200000 },
          { slug: 'demontazh-garden-care', name: 'Выкорчёвывание/уборка', nameUz: 'Ildiz bilan sugʻurib olish/tozalash', nameEn: 'Uproot/cleanup', description: 'Удаление старых растений', descriptionUz: 'Eski oʻsimliklarni olib tashlash', descriptionEn: 'Remove old plants', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 60000 },
        ],
      },
      {
        slug: 'garden-landscape', name: 'Ландшафт', nameUz: 'Landshaft', nameEn: 'Landscaping', icon: 'Trees',
        tasks: [
          { slug: 'build-pathways', name: 'Укладка садовых дорожек', nameUz: 'Bogʻ yoʻlakchalarini yotqizish', nameEn: 'Build garden pathways', description: 'Тротуарная плитка, камень, бетон', descriptionUz: 'Trotuvar plitka, tosh, beton', descriptionEn: 'Paving tiles, stone, concrete', estimatedTime: '4-8 часов', estimatedTimeUz: '4-8 soat', estimatedTimeEn: '4-8 hours', minPrice: 300000 },
          { slug: 'install-drainage', name: 'Установка дренажа', nameUz: 'Drenaj oʻrnatish', nameEn: 'Install drainage', description: 'Отвод воды, дренажные трубы', descriptionUz: 'Suvni olib chiqish, drenaj trubalari', descriptionEn: 'Water drainage, drain pipes', estimatedTime: '4-8 часов', estimatedTimeUz: '4-8 soat', estimatedTimeEn: '4-8 hours', minPrice: 250000 },
          { slug: 'install-lawn', name: 'Укладка рулонного газона', nameUz: 'Rulon maysazor yotqizish', nameEn: 'Install sod/turf', description: 'Подготовка почвы, укладка рулонного газона', descriptionUz: 'Tuproqni tayyorlash, rulon maysazor yotqizish', descriptionEn: 'Prepare soil, lay sod/turf', estimatedTime: '3-6 часов', estimatedTimeUz: '3-6 soat', estimatedTimeEn: '3-6 hours', minPrice: 150000 },
          { slug: 'build-retaining-wall', name: 'Возведение подпорной стенки', nameUz: 'Tirgovuch devor qurish', nameEn: 'Build retaining wall', description: 'Камень/бетон/блоки', descriptionUz: 'Tosh/beton/bloklar', descriptionEn: 'Stone/concrete/blocks', estimatedTime: '4-8 часов', estimatedTimeUz: '4-8 soat', estimatedTimeEn: '4-8 hours', minPrice: 300000 },
        ],
      },
      {
        slug: 'garden-exterior-repair', name: 'Наружный ремонт', nameUz: 'Tashqi taʼmir', nameEn: 'Exterior repair', icon: 'HardHat',
        tasks: [
          { slug: 'repair-roof', name: 'Ремонт крыши', nameUz: 'Tom taʼmiri', nameEn: 'Repair roof', description: 'Замена черепицы, устранение протечек', descriptionUz: 'Cherepitsani almashtirish, oqishni bartaraf etish', descriptionEn: 'Replace tiles, fix leaks', estimatedTime: '4-8 часов', estimatedTimeUz: '4-8 soat', estimatedTimeEn: '4-8 hours', minPrice: 500000 },
          { slug: 'paint-facade', name: 'Покраска фасада', nameUz: 'Fasadni boʻyash', nameEn: 'Paint facade', description: 'Нанесение', descriptionUz: 'Surish', descriptionEn: 'Apply', estimatedTime: '3-6 часов', estimatedTimeUz: '3-6 soat', estimatedTimeEn: '3-6 hours', minPrice: 500000 },
          { slug: 'install-fence', name: 'Установка оград', nameUz: 'Toʻsiq oʻrnatish', nameEn: 'Install fences', description: 'Металл/дерево/профнастил', descriptionUz: 'Metall/yogʻoch/profnastil', descriptionEn: 'Metal/wood/profiled sheet', estimatedTime: '4-8 часов', estimatedTimeUz: '4-8 soat', estimatedTimeEn: '4-8 hours', minPrice: 500000 },
          { slug: 'clean-gutters', name: 'Чистка водостоков', nameUz: 'Suv tushiruvchilarni tozalash', nameEn: 'Clean gutters', description: 'Очистка от мусора и листьев', descriptionUz: 'Axlat va barglardan tozalash', descriptionEn: 'Clear debris and leaves', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 80000 },
          { slug: 'demontazh-garden-exterior', name: 'Демонтаж кровли/обшивки', nameUz: 'Yopish/qoplamani demontaj qilish', nameEn: 'Remove roofing/cladding', description: 'Снятие старого покрытия', descriptionUz: 'Eski qoplamani olib tashlash', descriptionEn: 'Remove old covering', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 200000 },
        ],
      },
      {
        slug: 'garden-seasonal', name: 'Сезонные работы', nameUz: 'Mavsumiy ishlar', nameEn: 'Seasonal work', icon: 'CloudSun',
        tasks: [
          { slug: 'snow-removal', name: 'Уборка снега', nameUz: 'Qor tozalash', nameEn: 'Snow removal', description: 'Расчистка территории от снега', descriptionUz: 'Hududni qordan tozalash', descriptionEn: 'Clear area from snow', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 80000 },
          { slug: 'leaf-removal', name: 'Уборка листьев', nameUz: 'Barglarni tozalash', nameEn: 'Leaf removal', description: 'Сбор и вынос листьев', descriptionUz: 'Barglarni yigʻish va chiqarish', descriptionEn: 'Collect and remove leaves', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 60000 },
          { slug: 'winterize-garden', name: 'Подготовка к зиме', nameUz: 'Qishga tayyorlash', nameEn: 'Winterize garden', description: 'Укрытие растений, подготовка системы полива', descriptionUz: 'Oʻsimliklarni yopish, sugʻorish tizimini tayyorlash', descriptionEn: 'Cover plants, prepare irrigation system', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 100000 },
          { slug: 'spring-garden-prep', name: 'Весенняя подготовка сада', nameUz: 'Bahorgi bogʻ tayyorlash', nameEn: 'Spring garden prep', description: 'Уборка, перекопка, удобрение, обрезка', descriptionUz: 'Tozalash, chopish, oʻgʻitlash, kesish', descriptionEn: 'Cleanup, dig, fertilize, prune', estimatedTime: '3-6 часов', estimatedTimeUz: '3-6 soat', estimatedTimeEn: '3-6 hours', minPrice: 150000 },
          { slug: 'garden-yard-cleanup', name: 'Уборка двора и территории', nameUz: 'Hovli va hududni tozalash', nameEn: 'Yard & territory cleanup', description: 'Подметание, мусор, листва (кросс-категория: Клининг)', descriptionUz: 'Supurish, axlat, barglar (kross-kategoriya: Tozalash)', descriptionEn: 'Sweeping, trash, foliage (cross-category: Cleaning)', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 100000 },
          { slug: 'garden-pool-maintenance', name: 'Обслуживание бассейна', nameUz: 'Hovuz xizmati', nameEn: 'Pool maintenance', description: 'Чистка, химия, подготовка к сезону (кросс-категория: Клининг)', descriptionUz: 'Tozalash, kimyo, mavsumga tayyorlash', descriptionEn: 'Clean, chemicals, season prep (cross-category: Cleaning)', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 150000 },
        ],
      },
      {
        slug: 'garden-aquaristics', name: 'Аквариумистика', nameUz: 'Akvariumistika', nameEn: 'Aquaristics', icon: 'Fish',
        tasks: [
          { slug: 'aquarium-cleaning', name: 'Чистка аквариума', nameUz: 'Akvariumni tozalash', nameEn: 'Aquarium cleaning', description: 'Чистка стёкол, грунта, декораций', descriptionUz: 'Oynalar, grunt, dekoratsiyalarni tozalash', descriptionEn: 'Clean glass, substrate, decorations', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 80000 },
          { slug: 'aquarium-water-change', name: 'Замена воды в аквариуме', nameUz: 'Akvariumda suv almashtirish', nameEn: 'Aquarium water change', description: 'Подмена воды, подготовка и кондиционирование', descriptionUz: 'Suv almashtirish, tayyorlash va konditsionerlash', descriptionEn: 'Water replacement, preparation and conditioning', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 50000 },
          { slug: 'aquarium-design', name: 'Дизайн аквариума (акваскейпинг)', nameUz: 'Akvarium dizayni (akvaskeyping)', nameEn: 'Aquarium design (aquascaping)', description: 'Создание тематического дизайна: растения, камни, коряги', descriptionUz: 'Tematik dizayn yaratish: oʻsimliklar, toshlar, yogʻochlar', descriptionEn: 'Create themed design: plants, rocks, driftwood', estimatedTime: '2-5 часов', estimatedTimeUz: '2-5 soat', estimatedTimeEn: '2-5 hours', minPrice: 200000 },
          { slug: 'aquarium-measurements', name: 'Замеры параметров воды', nameUz: 'Suv parametrlarini oʻlchash', nameEn: 'Water parameter measurements', description: 'pH, аммиак, нитриты, нитраты, жёсткость', descriptionUz: 'pH, ammiak, nitritlar, nitratlar, qattiqlik', descriptionEn: 'pH, ammonia, nitrites, nitrates, hardness', estimatedTime: '30 мин', estimatedTimeUz: '30 daq', estimatedTimeEn: '30 min', minPrice: 40000 },
          { slug: 'aquarium-manufacturing', name: 'Изготовление аквариума на заказ', nameUz: 'Buyurtma boʻyicha akvarium yasash', nameEn: 'Custom aquarium manufacturing', description: 'По индивидуальным размерам, любая форма', descriptionUz: 'Individual oʻlchamlar boʻyicha, istalgan shakl', descriptionEn: 'Custom dimensions, any shape', estimatedTime: '3-10 дней', estimatedTimeUz: '3-10 kun', estimatedTimeEn: '3-10 days', minPrice: 500000 },
          { slug: 'aquarium-disinfection', name: 'Дезинфекция аквариума', nameUz: 'Akvariumni dezinfektsiya qilish', nameEn: 'Aquarium disinfection', description: 'Обработка от паразитов и болезнетворных организмов', descriptionUz: 'Parazit va kasallik tarqatuvchi organizmlardan ishlov berish', descriptionEn: 'Treatment against parasites and pathogens', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 80000 },
          { slug: 'aquarium-filter-service', name: 'Обслуживание фильтров аквариума', nameUz: 'Akvarium filtrlari xizmati', nameEn: 'Aquarium filter service', description: 'Чистка, замена наполнителей, настройка', descriptionUz: 'Tozalash, toʻldirgichlar almashtirish, sozlash', descriptionEn: 'Clean, replace media, adjust', estimatedTime: '30-60 мин', estimatedTimeUz: '30-60 daq', estimatedTimeEn: '30-60 min', minPrice: 50000 },
          { slug: 'aquarium-fish-treatment', name: 'Лечение рыб', nameUz: 'Baliqlarni davolash', nameEn: 'Fish treatment', description: 'Диагностика болезней и медикаментозное лечение', descriptionUz: 'Kasalliklarni diagnostikasi va dorivor davolash', descriptionEn: 'Disease diagnosis and medication treatment', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 100000 },
          { slug: 'aquarium-fish-selection', name: 'Подбор рыб и растений', nameUz: 'Baliq va oʻsimliklarni tanlash', nameEn: 'Fish & plant selection', description: 'Консультация по совместимости, покупка и запуск', descriptionUz: 'Moslik boʻyicha maslahat, sotib olish va ishga tushirish', descriptionEn: 'Compatibility consultation, purchase and launch', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 100000 },
          { slug: 'aquarium-full-setup', name: 'Запуск аквариума «под ключ»', nameUz: 'Akvariumni «kalit topshiriq» ishga tushirish', nameEn: 'Full aquarium setup', description: 'Установка, дизайн, запуск азотного цикла, заселение', descriptionUz: 'Oʻrnatish, dizayn, azot tsiklini ishga tushirish, joylash', descriptionEn: 'Setup, design, nitrogen cycle start, stocking', estimatedTime: '1-3 дня', estimatedTimeUz: '1-3 kun', estimatedTimeEn: '1-3 days', minPrice: 400000 },
          { slug: 'aquarium-regular-service', name: 'Регулярное обслуживание аквариума', nameUz: 'Akvariumni muntazam xizmatlash', nameEn: 'Regular aquarium maintenance', description: 'Еженедельный/ежемесячный уход по абонементу', descriptionUz: 'Haftalik/oylik abonement boʻyicha parvarish', descriptionEn: 'Weekly/monthly subscription care', estimatedTime: '1-2 часа', estimatedTimeUz: '1-2 soat', estimatedTimeEn: '1-2 hours', minPrice: 100000 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // 11. РЕМОНТ ПОД КЛЮЧ
  // ═══════════════════════════════════════════
  {
    slug: 'turnkey-renovation',
    name: 'Ремонт под ключ',
    nameUz: 'Kalit topshiriq taʼmir',
    nameEn: 'Turnkey renovation',
    icon: 'Building2',
    parentSlug: 'repair-finishing',
    subcategories: [
      {
        slug: 'turnkey-apartment', name: 'Ремонт квартир', nameUz: 'Kvartira taʼmiri', nameEn: 'Apartment renovation', icon: 'Building2',
        tasks: [
          { slug: 'turnkey-studio', name: 'Ремонт студии/1-комнатной', nameUz: 'Studiya/1-xonali taʼmir', nameEn: 'Studio/1-room renovation', description: 'Полный ремонт от демонтажа до чистовой отделки', descriptionUz: 'Demontajdan sof pardozgacha toʻliq taʼmir', descriptionEn: 'Complete renovation from demolition to finishing', estimatedTime: '15-30 дней', estimatedTimeUz: '15-30 kun', estimatedTimeEn: '15-30 days', minPrice: 15000000 },
          { slug: 'turnkey-2room', name: 'Ремонт 2-комнатной', nameUz: '2-xonali taʼmir', nameEn: '2-room renovation', description: 'Полный комплексный ремонт', descriptionUz: 'Toʻliq kompleks taʼmir', descriptionEn: 'Full comprehensive renovation', estimatedTime: '25-45 дней', estimatedTimeUz: '25-45 kun', estimatedTimeEn: '25-45 days', minPrice: 25000000 },
          { slug: 'turnkey-3room', name: 'Ремонт 3-комнатной', nameUz: '3-xonali taʼmir', nameEn: '3-room renovation', description: 'Комплексный ремонт больших квартир', descriptionUz: 'Katta kvartiralarni kompleks taʼmir', descriptionEn: 'Complex renovation of large apartments', estimatedTime: '35-60 дней', estimatedTimeUz: '35-60 kun', estimatedTimeEn: '35-60 days', minPrice: 40000000 },
          { slug: 'turnkey-luxury', name: 'Элитный ремонт', nameUz: 'Elit taʼmir', nameEn: 'Luxury renovation', description: 'Премиум материалы и авторский дизайн', descriptionUz: 'Premium materiallar va mualliflik dizayni', descriptionEn: 'Premium materials and designer approach', estimatedTime: '45-90 дней', estimatedTimeUz: '45-90 kun', estimatedTimeEn: '45-90 days', minPrice: 80000000 },
        ],
      },
      {
        slug: 'turnkey-house', name: 'Ремонт домов', nameUz: 'Uy taʼmiri', nameEn: 'House renovation', icon: 'Home',
        tasks: [
          { slug: 'turnkey-house-partial', name: 'Частичный ремонт дома', nameUz: 'Qisman uy taʼmiri', nameEn: 'Partial house renovation', description: 'Ремонт отдельных комнат/зон', descriptionUz: 'Alohida xonalar/zonalar taʼmiri', descriptionEn: 'Renovation of individual rooms/zones', estimatedTime: '10-25 дней', estimatedTimeUz: '10-25 kun', estimatedTimeEn: '10-25 days', minPrice: 10000000 },
          { slug: 'turnkey-house-full', name: 'Полный ремонт дома', nameUz: 'Toʻliq uy taʼmiri', nameEn: 'Full house renovation', description: 'Капитальный ремонт всего дома', descriptionUz: 'Butun uyni kapital taʼmiri', descriptionEn: 'Major renovation of entire house', estimatedTime: '30-90 дней', estimatedTimeUz: '30-90 kun', estimatedTimeEn: '30-90 days', minPrice: 50000000 },
          { slug: 'turnkey-cottage', name: 'Ремонт коттеджа', nameUz: 'Kottej taʼmiri', nameEn: 'Cottage renovation', description: 'Премиальный ремонт загородных домов', descriptionUz: 'Zagarod uylarni premium taʼmiri', descriptionEn: 'Premium renovation of country houses', estimatedTime: '45-120 дней', estimatedTimeUz: '45-120 kun', estimatedTimeEn: '45-120 days', minPrice: 80000000 },
        ],
      },
      {
        slug: 'turnkey-commercial', name: 'Коммерческий ремонт', nameUz: 'Tijorat taʼmiri', nameEn: 'Commercial renovation', icon: 'Store',
        tasks: [
          { slug: 'turnkey-office', name: 'Ремонт офиса', nameUz: 'Ofis taʼmiri', nameEn: 'Office renovation', description: 'Офисные помещения любой площади', descriptionUz: 'Har qanday maydondagi ofis xonalari', descriptionEn: 'Office spaces of any size', estimatedTime: '15-45 дней', estimatedTimeUz: '15-45 kun', estimatedTimeEn: '15-45 days', minPrice: 20000000 },
          { slug: 'turnkey-shop', name: 'Ремонт магазина/бутика', nameUz: 'Doʻkon/butik taʼmiri', nameEn: 'Shop/boutique renovation', description: 'Торговые площади, витрины', descriptionUz: 'Savdo maydonchalari, vitrinalar', descriptionEn: 'Retail spaces, shop windows', estimatedTime: '15-40 дней', estimatedTimeUz: '15-40 kun', estimatedTimeEn: '15-40 days', minPrice: 25000000 },
          { slug: 'turnkey-restaurant', name: 'Ремонт кафе/ресторана', nameUz: 'Kafe/restoran taʼmiri', nameEn: 'Cafe/restaurant renovation', description: 'HoReCa объекты', descriptionUz: 'HoReCa obyektlari', descriptionEn: 'HoReCa establishments', estimatedTime: '20-60 дней', estimatedTimeUz: '20-60 kun', estimatedTimeEn: '20-60 days', minPrice: 30000000 },
        ],
      },
      {
        slug: 'turnkey-stages', name: 'Этапы ремонта', nameUz: 'Taʼmir bosqichlari', nameEn: 'Renovation stages', icon: 'ClipboardList',
        tasks: [
          { slug: 'turnkey-demolition', name: 'Демонтажные работы', nameUz: 'Demontaj ishlari', nameEn: 'Demolition works', description: 'Снос стен, снятие покрытий, вынос мусора', descriptionUz: 'Devorlarni buzish, qoplamalarni olib tashlash', descriptionEn: 'Wall demolition, covering removal, debris disposal', estimatedTime: '2-7 дней', estimatedTimeUz: '2-7 kun', estimatedTimeEn: '2-7 days', minPrice: 3000000 },
          { slug: 'turnkey-rough-finish', name: 'Черновая отделка', nameUz: 'Qoralama pardoz', nameEn: 'Rough finishing', description: 'Штукатурка, стяжка, электрика, сантехника', descriptionUz: 'Suvoq, styajka, elektrika, santexnika', descriptionEn: 'Plastering, screed, electrical, plumbing', estimatedTime: '7-20 дней', estimatedTimeUz: '7-20 kun', estimatedTimeEn: '7-20 days', minPrice: 8000000 },
          { slug: 'turnkey-fine-finish', name: 'Чистовая отделка', nameUz: 'Sof pardoz', nameEn: 'Fine finishing', description: 'Поклейка обоев, укладка плитки, покраска', descriptionUz: 'Oboylarni yopishtirish, plitka yotqizish, boʻyash', descriptionEn: 'Wallpapering, tiling, painting', estimatedTime: '7-15 дней', estimatedTimeUz: '7-15 kun', estimatedTimeEn: '7-15 days', minPrice: 5000000 },
          { slug: 'turnkey-finishing-touches', name: 'Финишные работы', nameUz: 'Yakuniy ishlar', nameEn: 'Finishing touches', description: 'Установка сантехники, розетки, плинтуса, уборка', descriptionUz: 'Santexnika, rozetka, plintus oʻrnatish, tozalash', descriptionEn: 'Install fixtures, outlets, baseboards, cleanup', estimatedTime: '3-7 дней', estimatedTimeUz: '3-7 kun', estimatedTimeEn: '3-7 days', minPrice: 3000000 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // 12. ДИЗАЙН ИНТЕРЬЕРА
  // ═══════════════════════════════════════════
  {
    slug: 'interior-design',
    name: 'Дизайн интерьера',
    nameUz: 'Interer dizayni',
    nameEn: 'Interior design',
    icon: 'Palette',
    parentSlug: 'repair-finishing',
    subcategories: [
      {
        slug: 'design-project', name: 'Дизайн-проект', nameUz: 'Dizayn-loyiha', nameEn: 'Design project', icon: 'PenTool',
        tasks: [
          { slug: 'design-measurement', name: 'Замер и техническое задание', nameUz: 'Oʻlchash va texnik topshiriq', nameEn: 'Measurement & brief', description: 'Выезд на объект, обмеры, составление ТЗ', descriptionUz: 'Obyektga chiqish, oʻlchash, TT tuzish', descriptionEn: 'Site visit, measurements, brief creation', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 500000 },
          { slug: 'design-concept', name: 'Концепция / мудборд', nameUz: 'Kontseptsiya / mudboard', nameEn: 'Concept / moodboard', description: 'Разработка стиля, подбор цветовой палитры', descriptionUz: 'Uslub ishlab chiqish, rang palitrasini tanlash', descriptionEn: 'Style development, color palette selection', estimatedTime: '3-5 дней', estimatedTimeUz: '3-5 kun', estimatedTimeEn: '3-5 days', minPrice: 1500000 },
          { slug: 'design-layout', name: 'Планировочное решение', nameUz: 'Rejalashtirish yechimi', nameEn: 'Layout planning', description: '2-3 варианта планировки, зонирование', descriptionUz: '2-3 ta rejalashtirish varianti, zonalashtirish', descriptionEn: '2-3 layout options, zoning', estimatedTime: '3-5 дней', estimatedTimeUz: '3-5 kun', estimatedTimeEn: '3-5 days', minPrice: 2000000 },
          { slug: 'design-3d-visualization', name: '3D-визуализация', nameUz: '3D-vizualizatsiya', nameEn: '3D visualization', description: 'Фотореалистичные рендеры интерьера', descriptionUz: 'Fotorealistik interer renderlari', descriptionEn: 'Photorealistic interior renders', estimatedTime: '5-10 дней', estimatedTimeUz: '5-10 kun', estimatedTimeEn: '5-10 days', minPrice: 3000000 },
          { slug: 'design-full-project', name: 'Полный дизайн-проект', nameUz: 'Toʻliq dizayn-loyiha', nameEn: 'Full design project', description: 'Чертежи, спецификации, ведомости материалов', descriptionUz: 'Chizmalar, spetsifikatsiyalar, material roʻyxati', descriptionEn: 'Drawings, specifications, material lists', estimatedTime: '10-25 дней', estimatedTimeUz: '10-25 kun', estimatedTimeEn: '10-25 days', minPrice: 5000000 },
        ],
      },
      {
        slug: 'design-supervision', name: 'Авторский надзор', nameUz: 'Mualliflik nazorati', nameEn: 'Design supervision', icon: 'Eye',
        tasks: [
          { slug: 'design-author-supervision', name: 'Авторский надзор за ремонтом', nameUz: 'Taʼmir ustidan mualliflik nazorati', nameEn: 'Author supervision of renovation', description: 'Контроль соответствия проекту', descriptionUz: 'Loyihaga muvofiqlikni nazorat qilish', descriptionEn: 'Project compliance control', estimatedTime: 'На весь период', estimatedTimeUz: 'Butun davr mobaynida', estimatedTimeEn: 'Entire period', minPrice: 5000000 },
          { slug: 'design-material-selection', name: 'Подбор материалов', nameUz: 'Materiallarni tanlash', nameEn: 'Material selection', description: 'Комплектация по дизайн-проекту', descriptionUz: 'Dizayn-loyiha boʻyicha komplektatsiya', descriptionEn: 'Procurement per design project', estimatedTime: '3-7 дней', estimatedTimeUz: '3-7 kun', estimatedTimeEn: '3-7 days', minPrice: 1500000 },
          { slug: 'design-furniture-selection', name: 'Подбор мебели и декора', nameUz: 'Mebel va dekor tanlash', nameEn: 'Furniture & decor selection', description: 'Подбор мебели, светильников, текстиля', descriptionUz: 'Mebel, chiroqlar, toʻqimachililik tanlash', descriptionEn: 'Select furniture, lighting, textiles', estimatedTime: '3-7 дней', estimatedTimeUz: '3-7 kun', estimatedTimeEn: '3-7 days', minPrice: 1500000 },
        ],
      },
      {
        slug: 'design-styles', name: 'Стили дизайна', nameUz: 'Dizayn uslublari', nameEn: 'Design styles', icon: 'Brush',
        tasks: [
          { slug: 'design-modern', name: 'Современный / Минимализм', nameUz: 'Zamonaviy / Minimalizm', nameEn: 'Modern / Minimalism', description: 'Лаконичный современный интерьер', descriptionUz: 'Lakonik zamonaviy interer', descriptionEn: 'Concise modern interior', estimatedTime: 'По проекту', estimatedTimeUz: 'Loyiha boʻyicha', estimatedTimeEn: 'Per project', minPrice: 3000000 },
          { slug: 'design-classic', name: 'Классика / Неоклассика', nameUz: 'Klassik / Neoklassik', nameEn: 'Classic / Neoclassic', description: 'Элегантный классический интерьер', descriptionUz: 'Nafis klassik interer', descriptionEn: 'Elegant classic interior', estimatedTime: 'По проекту', estimatedTimeUz: 'Loyiha boʻyicha', estimatedTimeEn: 'Per project', minPrice: 4000000 },
          { slug: 'design-loft', name: 'Лофт / Индустриальный', nameUz: 'Loft / Sanoat', nameEn: 'Loft / Industrial', description: 'Кирпич, металл, открытые коммуникации', descriptionUz: 'Gʻisht, metall, ochiq kommunikatsiyalar', descriptionEn: 'Brick, metal, exposed utilities', estimatedTime: 'По проекту', estimatedTimeUz: 'Loyiha boʻyicha', estimatedTimeEn: 'Per project', minPrice: 3500000 },
          { slug: 'design-eastern', name: 'Восточный / Узбекский', nameUz: 'Sharqona / Oʻzbek', nameEn: 'Eastern / Uzbek', description: 'Национальные мотивы, орнаменты', descriptionUz: 'Milliy naqshlar, ornamentlar', descriptionEn: 'National motifs, ornaments', estimatedTime: 'По проекту', estimatedTimeUz: 'Loyiha boʻyicha', estimatedTimeEn: 'Per project', minPrice: 4000000 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // 13. МЕБЕЛЬ НА ЗАКАЗ
  // ═══════════════════════════════════════════
  {
    slug: 'custom-furniture',
    name: 'Мебель на заказ',
    nameUz: 'Buyurtma mebel',
    nameEn: 'Custom furniture',
    icon: 'Sofa',
    parentSlug: 'crafts-manufacturing',
    subcategories: [
      {
        slug: 'furniture-kitchen', name: 'Кухонная мебель', nameUz: 'Oshxona mebeli', nameEn: 'Kitchen furniture', icon: 'ChefHat',
        tasks: [
          { slug: 'custom-kitchen-design', name: 'Проектирование кухни', nameUz: 'Oshxonani loyihalash', nameEn: 'Kitchen design', description: 'Замер, 3D-модель, чертежи кухонного гарнитура', descriptionUz: 'Oʻlchash, 3D-model, oshxona garnitur chizmalari', descriptionEn: 'Measurement, 3D model, kitchen cabinet drawings', estimatedTime: '3-5 дней', estimatedTimeUz: '3-5 kun', estimatedTimeEn: '3-5 days', minPrice: 1000000 },
          { slug: 'custom-kitchen-manufacture', name: 'Изготовление кухонного гарнитура', nameUz: 'Oshxona garniturasini tayyorlash', nameEn: 'Kitchen cabinet manufacturing', description: 'Производство по индивидуальным размерам', descriptionUz: 'Individual oʻlchamlar boʻyicha ishlab chiqarish', descriptionEn: 'Custom-size manufacturing', estimatedTime: '10-20 дней', estimatedTimeUz: '10-20 kun', estimatedTimeEn: '10-20 days', minPrice: 8000000 },
          { slug: 'custom-kitchen-install', name: 'Установка кухонного гарнитура', nameUz: 'Oshxona garniturasini oʻrnatish', nameEn: 'Kitchen cabinet installation', description: 'Монтаж, подключение техники, настройка', descriptionUz: 'Montaj, texnika ulash, sozlash', descriptionEn: 'Assembly, appliance connection, adjustment', estimatedTime: '1-3 дня', estimatedTimeUz: '1-3 kun', estimatedTimeEn: '1-3 days', minPrice: 2000000 },
        ],
      },
      {
        slug: 'furniture-wardrobes', name: 'Шкафы и гардеробные', nameUz: 'Shkaflar va garderoblar', nameEn: 'Wardrobes & closets', icon: 'DoorClosed',
        tasks: [
          { slug: 'custom-wardrobe-design', name: 'Проектирование шкафа/гардеробной', nameUz: 'Shkaf/garderob loyihalash', nameEn: 'Wardrobe/closet design', description: 'Замер, 3D-модель, подбор наполнения', descriptionUz: 'Oʻlchash, 3D-model, ichki toʻldiruvchini tanlash', descriptionEn: 'Measurement, 3D model, interior selection', estimatedTime: '2-4 дня', estimatedTimeUz: '2-4 kun', estimatedTimeEn: '2-4 days', minPrice: 800000 },
          { slug: 'custom-wardrobe-manufacture', name: 'Изготовление шкафа-купе', nameUz: 'Shkaf-kupe tayyorlash', nameEn: 'Sliding wardrobe manufacturing', description: 'Шкаф-купе по индивидуальным размерам', descriptionUz: 'Individual oʻlchamlar boʻyicha shkaf-kupe', descriptionEn: 'Custom-size sliding wardrobe', estimatedTime: '7-14 дней', estimatedTimeUz: '7-14 kun', estimatedTimeEn: '7-14 days', minPrice: 5000000 },
          { slug: 'custom-walkin-closet', name: 'Гардеробная комната', nameUz: 'Garderobxona', nameEn: 'Walk-in closet', description: 'Полная система хранения', descriptionUz: 'Toʻliq saqlash tizimi', descriptionEn: 'Full storage system', estimatedTime: '7-14 дней', estimatedTimeUz: '7-14 kun', estimatedTimeEn: '7-14 days', minPrice: 6000000 },
        ],
      },
      {
        slug: 'furniture-living', name: 'Мебель для гостиной/спальни', nameUz: 'Mehmonxona/yotoqxona mebeli', nameEn: 'Living room/bedroom furniture', icon: 'BedDouble',
        tasks: [
          { slug: 'custom-tv-wall', name: 'ТВ-стенка / медиа-зона', nameUz: 'TV-devor / media-zona', nameEn: 'TV wall / media zone', description: 'Стенка под ТВ с полками и подсветкой', descriptionUz: 'Javonlar va yoritish bilan TV devori', descriptionEn: 'TV wall unit with shelves and lighting', estimatedTime: '5-10 дней', estimatedTimeUz: '5-10 kun', estimatedTimeEn: '5-10 days', minPrice: 4000000 },
          { slug: 'custom-bed-headboard', name: 'Кровать / изголовье на заказ', nameUz: 'Karavot / bosh qismi buyurtma', nameEn: 'Custom bed / headboard', description: 'Индивидуальный дизайн спального места', descriptionUz: 'Individual uxlash joyi dizayni', descriptionEn: 'Custom bedroom design', estimatedTime: '7-14 дней', estimatedTimeUz: '7-14 kun', estimatedTimeEn: '7-14 days', minPrice: 4000000 },
          { slug: 'custom-shelving', name: 'Стеллажи и полки', nameUz: 'Stellajlar va javonlar', nameEn: 'Shelving units', description: 'Открытые стеллажи, книжные полки', descriptionUz: 'Ochiq stellajlar, kitob javonlari', descriptionEn: 'Open shelving, bookcases', estimatedTime: '3-7 дней', estimatedTimeUz: '3-7 kun', estimatedTimeEn: '3-7 days', minPrice: 2000000 },
        ],
      },
      {
        slug: 'furniture-office', name: 'Офисная мебель', nameUz: 'Ofis mebeli', nameEn: 'Office furniture', icon: 'Briefcase',
        tasks: [
          { slug: 'custom-desk', name: 'Рабочий стол / компьютерный стол', nameUz: 'Ish stoli / kompyuter stoli', nameEn: 'Work desk / computer desk', description: 'Стол по индивидуальным размерам', descriptionUz: 'Individual oʻlchamlar boʻyicha stol', descriptionEn: 'Custom-size desk', estimatedTime: '5-10 дней', estimatedTimeUz: '5-10 kun', estimatedTimeEn: '5-10 days', minPrice: 2500000 },
          { slug: 'custom-office-storage', name: 'Офисные системы хранения', nameUz: 'Ofis saqlash tizimlari', nameEn: 'Office storage systems', description: 'Архивные шкафы, тумбы, полки', descriptionUz: 'Arxiv shkaflari, tumba, javonlar', descriptionEn: 'Filing cabinets, pedestals, shelves', estimatedTime: '5-10 дней', estimatedTimeUz: '5-10 kun', estimatedTimeEn: '5-10 days', minPrice: 3000000 },
          { slug: 'custom-reception', name: 'Ресепшн / стойка администратора', nameUz: 'Resepshn / administrator stendi', nameEn: 'Reception desk', description: 'Стойка ресепшн под ваш интерьер', descriptionUz: 'Intereringizga mos resepshn stendi', descriptionEn: 'Reception desk matching your interior', estimatedTime: '7-14 дней', estimatedTimeUz: '7-14 kun', estimatedTimeEn: '7-14 days', minPrice: 5000000 },
        ],
      },
      {
        slug: 'furniture-installation', name: 'Установка и монтаж мебели', nameUz: 'Mebel oʻrnatish va montaji', nameEn: 'Furniture installation', icon: 'Wrench',
        tasks: [
          { slug: 'install-kitchen-furniture', name: 'Установка кухонной мебели', nameUz: 'Oshxona mebelini oʻrnatish', nameEn: 'Install kitchen furniture', description: 'Монтаж навесных и напольных шкафов', descriptionUz: 'Osma va pol shkaflari montaji', descriptionEn: 'Mount wall and floor cabinets', estimatedTime: '4-8 часов', estimatedTimeUz: '4-8 soat', estimatedTimeEn: '4-8 hours', minPrice: 1000000 },
          { slug: 'install-wardrobe-furniture', name: 'Сборка/установка шкафов', nameUz: 'Shkaflarni yigʻish/oʻrnatish', nameEn: 'Assemble/install wardrobes', description: 'Сборка и установка любых шкафов', descriptionUz: 'Har qanday shkaflarni yigʻish va oʻrnatish', descriptionEn: 'Assemble and install any wardrobes', estimatedTime: '2-6 часов', estimatedTimeUz: '2-6 soat', estimatedTimeEn: '2-6 hours', minPrice: 500000 },
          { slug: 'install-countertop', name: 'Установка столешницы', nameUz: 'Stol ustini oʻrnatish', nameEn: 'Install countertop', description: 'Кухонная / ванная столешница', descriptionUz: 'Oshxona / hammom stol usti', descriptionEn: 'Kitchen / bathroom countertop', estimatedTime: '2-4 часа', estimatedTimeUz: '2-4 soat', estimatedTimeEn: '2-4 hours', minPrice: 500000 },
          { slug: 'furniture-repair-custom', name: 'Реставрация/ремонт мебели', nameUz: 'Mebel taʼmiri/restavratsiyasi', nameEn: 'Furniture restoration/repair', description: 'Ремонт, покраска, замена фурнитуры', descriptionUz: 'Taʼmir, boʻyash, furnitura almashtirish', descriptionEn: 'Repair, painting, hardware replacement', estimatedTime: '2-8 часов', estimatedTimeUz: '2-8 soat', estimatedTimeEn: '2-8 hours', minPrice: 300000 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // 14. ПАРТНЁРСКИЕ МАГАЗИНЫ (СТРОЙМАТЕРИАЛЫ)
  // ═══════════════════════════════════════════
  {
    slug: 'building-materials',
    name: 'Стройматериалы',
    nameUz: 'Qurilish materiallari',
    nameEn: 'Building materials',
    icon: 'Blocks',
    parentSlug: 'construction-building',
    subcategories: [
      {
        slug: 'materials-finishing', name: 'Отделочные материалы', nameUz: 'Pardoz materiallari', nameEn: 'Finishing materials', icon: 'Palette',
        tasks: [
          { slug: 'mat-paint-wallpaper', name: 'Краска / обои / декоративная штукатурка', nameUz: 'Boʻyoq / oboy / dekorativ suvoq', nameEn: 'Paint / wallpaper / decorative plaster', description: 'Широкий выбор отделочных материалов', descriptionUz: 'Pardoz materiallarining keng tanlovi', descriptionEn: 'Wide selection of finishing materials', estimatedTime: 'Доставка 1-3 дня', estimatedTimeUz: 'Yetkazib berish 1-3 kun', estimatedTimeEn: 'Delivery 1-3 days', minPrice: 50000 },
          { slug: 'mat-tiles-ceramic', name: 'Плитка / керамогранит', nameUz: 'Plitka / keramogranit', nameEn: 'Tiles / porcelain', description: 'Напольная и настенная плитка', descriptionUz: 'Pol va devor plitkalari', descriptionEn: 'Floor and wall tiles', estimatedTime: 'Доставка 1-3 дня', estimatedTimeUz: 'Yetkazib berish 1-3 kun', estimatedTimeEn: 'Delivery 1-3 days', minPrice: 80000 },
          { slug: 'mat-flooring', name: 'Напольные покрытия', nameUz: 'Pol qoplamalari', nameEn: 'Flooring', description: 'Ламинат, линолеум, паркет', descriptionUz: 'Laminat, linoleum, parket', descriptionEn: 'Laminate, linoleum, parquet', estimatedTime: 'Доставка 1-3 дня', estimatedTimeUz: 'Yetkazib berish 1-3 kun', estimatedTimeEn: 'Delivery 1-3 days', minPrice: 60000 },
        ],
      },
      {
        slug: 'materials-construction', name: 'Строительные материалы', nameUz: 'Qurilish materiallari', nameEn: 'Construction materials', icon: 'Warehouse',
        tasks: [
          { slug: 'mat-cement-mix', name: 'Цемент / смеси / гипсокартон', nameUz: 'Sement / aralashmalar / gipsokartton', nameEn: 'Cement / mixes / drywall', description: 'Базовые строительные материалы', descriptionUz: 'Asosiy qurilish materiallari', descriptionEn: 'Basic construction materials', estimatedTime: 'Доставка 1-2 дня', estimatedTimeUz: 'Yetkazib berish 1-2 kun', estimatedTimeEn: 'Delivery 1-2 days', minPrice: 40000 },
          { slug: 'mat-plumbing-supplies', name: 'Сантехника и трубы', nameUz: 'Santexnika va trubalar', nameEn: 'Plumbing & pipes', description: 'Трубы, фитинги, запорная арматура', descriptionUz: 'Trubalar, fitinglar, toʻsiq armaturasi', descriptionEn: 'Pipes, fittings, shut-off valves', estimatedTime: 'Доставка 1-2 дня', estimatedTimeUz: 'Yetkazib berish 1-2 kun', estimatedTimeEn: 'Delivery 1-2 days', minPrice: 30000 },
          { slug: 'mat-electrical-supplies', name: 'Электрика и освещение', nameUz: 'Elektrika va yoritish', nameEn: 'Electrical & lighting', description: 'Провода, автоматы, светильники, розетки', descriptionUz: 'Simlar, avtomatlar, chiroqlar, rozetkalar', descriptionEn: 'Wires, breakers, lights, outlets', estimatedTime: 'Доставка 1-2 дня', estimatedTimeUz: 'Yetkazib berish 1-2 kun', estimatedTimeEn: 'Delivery 1-2 days', minPrice: 25000 },
        ],
      },
      {
        slug: 'materials-tools', name: 'Инструменты', nameUz: 'Asboblar', nameEn: 'Tools', icon: 'Hammer',
        tasks: [
          { slug: 'mat-hand-tools', name: 'Ручной инструмент', nameUz: 'Qoʻl asboblari', nameEn: 'Hand tools', description: 'Молотки, ключи, отвёртки, уровни', descriptionUz: 'Bolʻgalar, kalitlar, tornavidalar, darajalar', descriptionEn: 'Hammers, wrenches, screwdrivers, levels', estimatedTime: 'Доставка 1-2 дня', estimatedTimeUz: 'Yetkazib berish 1-2 kun', estimatedTimeEn: 'Delivery 1-2 days', minPrice: 20000 },
          { slug: 'mat-power-tools', name: 'Электроинструмент', nameUz: 'Elektr asboblar', nameEn: 'Power tools', description: 'Дрели, шуруповёрты, болгарки, перфораторы', descriptionUz: 'Drellar, shurupovertlar, bolgarkalar, perforatorlar', descriptionEn: 'Drills, drivers, grinders, rotary hammers', estimatedTime: 'Доставка 1-3 дня', estimatedTimeUz: 'Yetkazib berish 1-3 kun', estimatedTimeEn: 'Delivery 1-3 days', minPrice: 100000 },
          { slug: 'mat-safety-equipment', name: 'Средства защиты', nameUz: 'Himoya vositalari', nameEn: 'Safety equipment', description: 'Каски, перчатки, очки, респираторы', descriptionUz: 'Kaskalar, qoʻlqoplar, koʻzoynaklar, respiratorlar', descriptionEn: 'Helmets, gloves, goggles, respirators', estimatedTime: 'Доставка 1 день', estimatedTimeUz: 'Yetkazib berish 1 kun', estimatedTimeEn: 'Delivery 1 day', minPrice: 15000 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // 15. ГРУЗОПЕРЕВОЗКИ И ПЕРЕЕЗДЫ
  // ═══════════════════════════════════════════
  {
    slug: 'freight-moving',
    name: 'Грузоперевозки и переезды',
    nameUz: 'Yuk tashish va koʻchish',
    nameEn: 'Freight & moving',
    icon: 'Truck',
    parentSlug: 'transport-logistics',
    subcategories: [
      {
        slug: 'transport-freight', name: 'Грузоперевозки', nameUz: 'Yuk tashish', nameEn: 'Freight transport', icon: 'Truck',
        tasks: [
          { slug: 'freight-city', name: 'Доставка по городу', nameUz: 'Shahar boʻylab yetkazib berish', nameEn: 'City delivery', description: 'Перевозка грузов по Ташкенту', descriptionUz: 'Toshkent boʻylab yuk tashish', descriptionEn: 'Cargo transport within Tashkent', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 200000 },
          { slug: 'freight-intercity', name: 'Междугородние перевозки', nameUz: 'Shaharlararo tashish', nameEn: 'Intercity transport', description: 'Перевозки между городами Узбекистана', descriptionUz: 'Oʻzbekiston shaharlari oʻrtasida tashish', descriptionEn: 'Transport between Uzbekistan cities', estimatedTime: '4-12 часов', estimatedTimeUz: '4-12 soat', estimatedTimeEn: '4-12 hours', minPrice: 500000 },
          { slug: 'freight-furniture', name: 'Перевозка мебели', nameUz: 'Mebel tashish', nameEn: 'Furniture transport', description: 'Аккуратная перевозка мебели с упаковкой', descriptionUz: 'Mebelni ehtiyotkorlik bilan qadoqlash va tashish', descriptionEn: 'Careful furniture transport with packing', estimatedTime: '2-5 часов', estimatedTimeUz: '2-5 soat', estimatedTimeEn: '2-5 hours', minPrice: 300000 },
          { slug: 'freight-construction', name: 'Доставка стройматериалов', nameUz: 'Qurilish materiallarini yetkazish', nameEn: 'Construction material delivery', description: 'Цемент, песок, кирпич, арматура', descriptionUz: 'Sement, qum, gʻisht, armatura', descriptionEn: 'Cement, sand, bricks, rebar', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 250000 },
        ],
      },
      {
        slug: 'transport-moving', name: 'Переезды', nameUz: 'Koʻchish', nameEn: 'Moving', icon: 'PackageCheck',
        tasks: [
          { slug: 'move-apartment', name: 'Переезд квартиры', nameUz: 'Kvartira koʻchishi', nameEn: 'Apartment moving', description: 'Упаковка, погрузка, перевозка, разгрузка', descriptionUz: 'Qadoqlash, yuklash, tashish, tushirish', descriptionEn: 'Packing, loading, transport, unloading', estimatedTime: '4-8 часов', estimatedTimeUz: '4-8 soat', estimatedTimeEn: '4-8 hours', minPrice: 500000 },
          { slug: 'move-office', name: 'Переезд офиса', nameUz: 'Ofis koʻchishi', nameEn: 'Office moving', description: 'Перевозка офисной мебели и техники', descriptionUz: 'Ofis mebeli va texnikasini tashish', descriptionEn: 'Office furniture and equipment moving', estimatedTime: '6-12 часов', estimatedTimeUz: '6-12 soat', estimatedTimeEn: '6-12 hours', minPrice: 800000 },
          { slug: 'move-house', name: 'Переезд дома', nameUz: 'Uy koʻchishi', nameEn: 'House moving', description: 'Полный переезд частного дома', descriptionUz: 'Xususiy uyning toʻliq koʻchishi', descriptionEn: 'Full private house moving', estimatedTime: '6-16 часов', estimatedTimeUz: '6-16 soat', estimatedTimeEn: '6-16 hours', minPrice: 1000000 },
        ],
      },
      {
        slug: 'transport-loaders', name: 'Грузчики', nameUz: 'Yukchilar', nameEn: 'Loaders', icon: 'Dumbbell',
        tasks: [
          { slug: 'loaders-hourly', name: 'Грузчики (почасовая)', nameUz: 'Yukchilar (soatbay)', nameEn: 'Loaders (hourly)', description: 'Погрузка/разгрузка, подъём на этаж', descriptionUz: 'Yuklash/tushirish, qavatga koʻtarish', descriptionEn: 'Loading/unloading, carrying up floors', estimatedTime: 'от 1 часа', estimatedTimeUz: '1 soatdan', estimatedTimeEn: 'from 1 hour', minPrice: 100000 },
          { slug: 'loaders-heavy', name: 'Подъём тяжёлых грузов', nameUz: 'Ogʻir yuklarni koʻtarish', nameEn: 'Heavy lifting', description: 'Пианино, сейфы, станки, холодильники', descriptionUz: 'Pianino, seyflar, stanokllar, muzlatgichlar', descriptionEn: 'Pianos, safes, machines, refrigerators', estimatedTime: '1-4 часа', estimatedTimeUz: '1-4 soat', estimatedTimeEn: '1-4 hours', minPrice: 200000 },
          { slug: 'loaders-trash-removal', name: 'Вывоз мусора/хлама', nameUz: 'Axlat/eskini chiqarish', nameEn: 'Trash/junk removal', description: 'Вынос из квартиры, погрузка, вывоз', descriptionUz: 'Kvartiradan chiqarish, yuklash, olib ketish', descriptionEn: 'Remove from apartment, load, haul away', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 150000 },
        ],
      },
      {
        slug: 'transport-courier', name: 'Курьерские услуги', nameUz: 'Kuryer xizmatlari', nameEn: 'Courier services', icon: 'Bike',
        tasks: [
          { slug: 'courier-documents', name: 'Доставка документов', nameUz: 'Hujjatlarni yetkazish', nameEn: 'Document delivery', description: 'Срочная доставка документов по городу', descriptionUz: 'Shahar boʻylab tezkor hujjat yetkazish', descriptionEn: 'Urgent document delivery within city', estimatedTime: '30-90 мин', estimatedTimeUz: '30-90 daq', estimatedTimeEn: '30-90 min', minPrice: 50000 },
          { slug: 'courier-parcels', name: 'Доставка посылок', nameUz: 'Posilkalarni yetkazish', nameEn: 'Parcel delivery', description: 'Забрать и доставить посылку/покупку', descriptionUz: 'Posilka/xaridni olib yetkazish', descriptionEn: 'Pick up and deliver parcel/purchase', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 40000 },
          { slug: 'courier-shopping', name: 'Покупка и доставка товаров', nameUz: 'Tovarlarni sotib olish va yetkazish', nameEn: 'Shopping & delivery', description: 'Купить по списку и доставить', descriptionUz: 'Roʻyxat boʻyicha sotib olish va yetkazish', descriptionEn: 'Buy from list and deliver', estimatedTime: '1-3 часа', estimatedTimeUz: '1-3 soat', estimatedTimeEn: '1-3 hours', minPrice: 60000 },
        ],
      },
    ],
  },
];
