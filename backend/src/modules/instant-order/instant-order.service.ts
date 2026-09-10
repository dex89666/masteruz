// ============================================
// MasterUz — Instant Order Service
// ФотоЗаказ за 30 секунд — AI анализ + создание
// ============================================

import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import { balanceService } from '../balance/balance.service.js';
import { notificationService } from '../../services/notificationService.js';
import { toNum, moneyMul, moneyAdd, calculateCommission } from '../../utils/helpers.js';
import { OrderStatus } from '@prisma/client';
import {
  buildSmartVariants,
  applyQuantity,
  scaleVariantsToPriceHint,
  dropVisitFeeOnCheapVariant,
  MAX_UNIT_QUANTITY,
  TIER_LABELS,
  roundUnitPrice,
  type EstimateVariant,
  type PricedLine,
} from './pricing-catalog.js';
import { analyzeOrder, type AiAnalysisResult } from '../../services/aiAnalysisService.js';
import { buildVariantsFromPriceBook, buildVariantsFromJobs, attachPriceRanges } from './pricebook.service.js';
// Конвейер Vision общий с замером точности: гейт обязан проверять ровно то,
// что работает в продакшене.
import { runVisionAnalysis, buildAiContext } from './vision-pipeline.js';
import { config } from '../../config/index.js';

// Тип AI-уровня (AiTier будет доступен после prisma generate)
type AiTierType = 'GOOD' | 'BETTER' | 'BEST';

// ─── Конфигурация ─────────────────────────────
const DEFAULT_VISIT_FEE = 100000;
const VISIT_FEE_COMMISSION_RATE = 10;

// Безопасно парсит дату из строки. Пустые/невалидные значения → null.
const parseOptionalDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// ─── Коэффициенты для уровней AI ──────────────
const TIER_MULTIPLIERS: Record<string, { price: number; days: number; label: string }> = {
  GOOD: { price: 1.0, days: 1.3, label: 'Хороший — стандарт' },
  BETTER: { price: 1.15, days: 1.0, label: 'Отличный — оптимальный' },
  BEST: { price: 1.3, days: 0.8, label: 'Премиум — максимум качества' },
};

// Минимальный выезд мастера в Ташкенте (2026): даже простая услуга «под ключ»
// включает дорогу, инструмент, расходники и гарантию. Без этого голая ставка
// работы (minPrice задачи) даёт нереально низкую цену вроде 42 000 сум.
const MASTER_VISIT_FEE = 50_000;
// Минимальный чек заказа — ниже этой суммы мастер на выезд не поедет.
const MIN_VARIANT_PRICE = 90_000;

// Сколько задач максимум попадает в резервную смету. Ограничение не даёт
// собрать «пакет» из слабо связанных работ, которых клиент не просил.
const FALLBACK_MAX_TASKS = 3;
// Расходники мастера на одну работу: крепёж, герметик, изолента, перчатки.
const CONSUMABLES_PER_TASK = 15_000;
// Надбавка за класс комплектующих. Отличие уровней — в материале, не в объёме.
const MATERIAL_CLASS_UPLIFT: Record<'GOOD' | 'BETTER' | 'BEST', number> = {
  GOOD: 0,
  BETTER: 25_000,
  BEST: 60_000,
};

// ─── Минимальная длина внятного описания ──────
const MIN_CLEAR_DESCRIPTION_LEN = 25;

// ─── Шаблоны уточняющих вопросов ──────────────
// Если описание слишком общее или пересекается с несколькими категориями,
// отдаём пользователю наводящие вопросы вместо случайной категории.
type ClarifyingQuestion = {
  id: string;
  type: 'multiselect' | 'select' | 'text';
  question: string;
  hint?: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
};

const SCOPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'plumbing',       label: '🔧 Сантехника (трубы, краны, унитаз)' },
  { value: 'electrical',     label: '⚡ Электрика (розетки, проводка, свет)' },
  { value: 'painting',       label: '🎨 Покраска / обои / штукатурка' },
  { value: 'windows-doors',  label: '🪟 Окна / двери / балкон' },
  { value: 'furniture',      label: '🪑 Мебель (сборка, ремонт, кухня)' },
  { value: 'construction',   label: '🧱 Стены / кладка / стяжка' },
  { value: 'carpentry',      label: '🪵 Полы / паркет / ламинат' },
  { value: 'roofing',        label: '🏠 Крыша / кровля' },
  { value: 'cleaning',       label: '🧹 Уборка / клининг' },
  { value: 'conditioner',    label: '❄️ Кондиционер / вентиляция' },
  { value: 'appliances',     label: '🔌 Подключение бытовой техники' },
  { value: 'garden',         label: '🌳 Двор / газон / ландшафт' },
  { value: 'earthworks',     label: '🚜 Земляные работы / экскаватор' },
  { value: 'security',       label: '📹 Видеонаблюдение / сигнализация' },
  { value: 'design',         label: '✏️ Дизайн-проект интерьера' },
  { value: 'moving',         label: '🚚 Переезд / грузчики' },
];

function buildGenericClarifyingQuestions(): ClarifyingQuestion[] {
  return [
    {
      id: 'scope',
      type: 'multiselect',
      question: 'Какие направления работ нужны? (выберите все подходящие)',
      hint: 'Чем точнее перечислите, тем точнее будет смета',
      options: SCOPE_OPTIONS,
    },
    {
      id: 'rooms',
      type: 'multiselect',
      question: 'В каких помещениях будут работы?',
      options: [
        { value: 'bathroom',  label: 'Ванная / туалет' },
        { value: 'kitchen',   label: 'Кухня' },
        { value: 'living',    label: 'Жилая комната' },
        { value: 'hallway',   label: 'Прихожая / коридор' },
        { value: 'balcony',   label: 'Балкон / лоджия' },
        { value: 'outdoor',   label: 'Двор / улица / фасад' },
        { value: 'whole',     label: 'Вся квартира / дом' },
      ],
    },
    {
      id: 'urgency',
      type: 'select',
      question: 'Насколько срочно нужно выполнить?',
      options: [
        { value: 'today',  label: 'Сегодня — аварийная ситуация' },
        { value: 'week',   label: 'На этой неделе' },
        { value: 'month',  label: 'В течение месяца' },
        { value: 'flex',   label: 'Не срочно, гибкие сроки' },
      ],
    },
    {
      id: 'details',
      type: 'text',
      question: 'Опишите подробнее, что не работает или что нужно установить',
      placeholder: 'Например: течёт смеситель в ванной, не работает розетка на кухне, нужно покрасить две комнаты',
    },
  ];
}

// ─── Конкретные вопросы по slug категории ──────
// Цель: получить количественные параметры (м², точки, метры, кол-во) для расчёта объёма работ.
const CATEGORY_QUESTION_BANK: Record<string, ClarifyingQuestion[]> = {
  plumbing: [
    {
      id: 'plumbing_tasks',
      type: 'multiselect',
      question: 'Какие сантехнические работы нужны?',
      options: [
        { value: 'leak',         label: 'Устранить течь / протечку' },
        { value: 'install_sink', label: 'Установить раковину / умывальник' },
        { value: 'install_toilet', label: 'Установить / заменить унитаз' },
        { value: 'install_faucet', label: 'Заменить смеситель / кран' },
        { value: 'install_shower', label: 'Установить душевую кабину / поддон' },
        { value: 'install_bath',   label: 'Установить ванну' },
        { value: 'replace_pipes',  label: 'Заменить трубы (полная разводка)' },
        { value: 'install_heater', label: 'Установить водонагреватель / бойлер' },
        { value: 'unblock',        label: 'Прочистить засор' },
      ],
    },
    {
      id: 'plumbing_volume',
      type: 'text',
      question: 'Сколько точек / приборов нужно? И длина труб (если меняете)',
      placeholder: 'Например: 1 раковина + 1 унитаз + замена 6 м труб',
    },
  ],
  electrical: [
    {
      id: 'electrical_tasks',
      type: 'multiselect',
      question: 'Какие электромонтажные работы?',
      options: [
        { value: 'install_socket',  label: 'Установить / заменить розетки' },
        { value: 'install_switch',  label: 'Установить / заменить выключатели' },
        { value: 'install_light',   label: 'Подключить люстру / светильник' },
        { value: 'wiring',          label: 'Полная замена проводки' },
        { value: 'distribution',    label: 'Установить / заменить щит, автоматы' },
        { value: 'troubleshoot',    label: 'Найти неисправность (КЗ, не работает)' },
      ],
    },
    {
      id: 'electrical_volume',
      type: 'text',
      question: 'Сколько точек (розетки + выключатели + светильники)?',
      placeholder: 'Например: 8 розеток, 3 выключателя, 5 светильников',
    },
  ],
  painting: [
    {
      id: 'painting_volume',
      type: 'text',
      question: 'Площадь окраски (м²) и тип поверхности',
      placeholder: 'Например: стены 45 м² + потолок 18 м², побелка + покраска',
    },
    {
      id: 'painting_finish',
      type: 'select',
      question: 'Что наносим?',
      options: [
        { value: 'paint',   label: 'Краска (водоэмульсионная / акрил)' },
        { value: 'wallpaper', label: 'Обои' },
        { value: 'plaster', label: 'Штукатурка / шпаклёвка' },
        { value: 'decorative', label: 'Декоративная штукатурка / венецианка' },
      ],
    },
  ],
  'windows-doors': [
    {
      id: 'wd_count',
      type: 'text',
      question: 'Сколько окон / дверей и какие размеры?',
      placeholder: 'Например: 3 пластиковых окна 1.5×1.4 м + 1 межкомнатная дверь',
    },
    {
      id: 'wd_action',
      type: 'select',
      question: 'Что нужно сделать?',
      options: [
        { value: 'install', label: 'Установить новое' },
        { value: 'replace', label: 'Заменить старое' },
        { value: 'repair',  label: 'Отремонтировать (фурнитура, стеклопакет)' },
      ],
    },
  ],
  furniture: [
    {
      id: 'furniture_task',
      type: 'select',
      question: 'Что нужно с мебелью?',
      options: [
        { value: 'assemble', label: 'Собрать новую (из коробки)' },
        { value: 'custom',   label: 'Изготовить на заказ' },
        { value: 'repair',   label: 'Отремонтировать / реставрация' },
        { value: 'kitchen',  label: 'Кухонный гарнитур (установка + подгонка)' },
      ],
    },
    {
      id: 'furniture_count',
      type: 'text',
      question: 'Сколько единиц мебели и габариты?',
      placeholder: 'Например: 1 шкаф 2.4×0.6×2.5 м + кухня 4 пог. м',
    },
  ],
  construction: [
    {
      id: 'construction_scope',
      type: 'multiselect',
      question: 'Какие строительные работы?',
      options: [
        { value: 'masonry',   label: 'Кладка стен / перегородок' },
        { value: 'screed',    label: 'Стяжка пола' },
        { value: 'plastering', label: 'Штукатурка стен' },
        { value: 'demolition', label: 'Демонтаж старых конструкций' },
        { value: 'insulation', label: 'Утепление' },
        { value: 'capital',    label: 'Капитальный ремонт под ключ' },
      ],
    },
    {
      id: 'construction_area',
      type: 'text',
      question: 'Площадь и/или объём работ',
      placeholder: 'Например: 60 м² квартира под ключ, или стяжка 25 м², или 12 м перегородок',
    },
  ],
  carpentry: [
    {
      id: 'carpentry_area',
      type: 'text',
      question: 'Площадь пола (м²) и материал',
      placeholder: 'Например: 35 м² ламината + плинтус по периметру',
    },
  ],
  roofing: [
    {
      id: 'roofing_area',
      type: 'text',
      question: 'Площадь и тип кровли',
      placeholder: 'Например: 80 м² металлочерепицы, скатная крыша 2 ската',
    },
    {
      id: 'roofing_action',
      type: 'select',
      question: 'Что нужно сделать?',
      options: [
        { value: 'new',     label: 'Покрыть новую крышу' },
        { value: 'replace', label: 'Заменить старое покрытие' },
        { value: 'repair',  label: 'Отремонтировать (течь, локальный ремонт)' },
      ],
    },
  ],
  earthworks: [
    {
      id: 'earthworks_task',
      type: 'select',
      question: 'Какие земляные работы?',
      options: [
        { value: 'foundation_pit', label: 'Котлован под фундамент' },
        { value: 'trench',         label: 'Траншея (под коммуникации)' },
        { value: 'planning',       label: 'Планировка / выравнивание участка' },
        { value: 'demolition',     label: 'Снос / разбор строений' },
      ],
    },
    {
      id: 'earthworks_volume',
      type: 'text',
      question: 'Объём (м³) или размеры (Д × Ш × Г)',
      placeholder: 'Например: котлован 6×4×2 м, или 30 м³ грунта',
    },
  ],
  garden: [
    {
      id: 'garden_task',
      type: 'multiselect',
      question: 'Что нужно сделать на участке?',
      options: [
        { value: 'lawn',     label: 'Газон (рулонный / посевной)' },
        { value: 'planting', label: 'Посадка растений / деревьев' },
        { value: 'paving',   label: 'Тротуарная плитка / дорожки' },
        { value: 'fence',    label: 'Забор / ограждение' },
        { value: 'irrigation', label: 'Система полива' },
      ],
    },
    {
      id: 'garden_area',
      type: 'text',
      question: 'Площадь участка (соток / м²)',
      placeholder: 'Например: 6 соток, газон 200 м² + 30 м забора',
    },
  ],
  cleaning: [
    {
      id: 'cleaning_type',
      type: 'select',
      question: 'Тип уборки',
      options: [
        { value: 'general', label: 'Генеральная уборка' },
        { value: 'after_repair', label: 'После ремонта / стройки' },
        { value: 'regular', label: 'Поддерживающая' },
        { value: 'window', label: 'Мойка окон' },
      ],
    },
    {
      id: 'cleaning_area',
      type: 'text',
      question: 'Площадь помещения (м²)',
      placeholder: 'Например: квартира 60 м², 2 комнаты',
    },
  ],
  conditioner: [
    {
      id: 'conditioner_task',
      type: 'select',
      question: 'Что нужно с кондиционером?',
      options: [
        { value: 'install', label: 'Установить новый' },
        { value: 'service', label: 'Обслуживание / заправка фреоном' },
        { value: 'repair',  label: 'Ремонт' },
        { value: 'dismantle', label: 'Демонтаж' },
      ],
    },
    {
      id: 'conditioner_count',
      type: 'text',
      question: 'Сколько штук и мощность (BTU)?',
      placeholder: 'Например: 2 шт по 12000 BTU',
    },
  ],
};

/**
 * Создаёт уточняющие вопросы под конкретные выбранные категории.
 * Если категории не переданы — возвращает generic-вопросы.
 */
function buildClarifyingQuestionsFor(categories: { slug: string; name: string }[]): ClarifyingQuestion[] {
  if (categories.length === 0) return buildGenericClarifyingQuestions();

  const result: ClarifyingQuestion[] = [];
  for (const cat of categories) {
    const bank = CATEGORY_QUESTION_BANK[cat.slug];
    if (!bank) continue;
    // Префиксуем id и текст вопроса именем категории — если несколько направлений
    for (const q of bank) {
      result.push({
        ...q,
        id: `${cat.slug}__${q.id}`,
        question: categories.length > 1 ? `[${cat.name}] ${q.question}` : q.question,
      });
    }
  }

  // Всегда финальный textarea на случай дополнительных пожеланий
  result.push({
    id: 'extra_details',
    type: 'text',
    question: 'Дополнительные пожелания / детали',
    placeholder: 'Что важно учесть? Сроки, материалы, предпочтения по бренду…',
  });

  // Если ни для одной выбранной категории нет шаблона — фоллбек на generic
  return result.length > 1 ? result : buildGenericClarifyingQuestions();
}

/**
 * Штучные работы — для них смета строится по простой формуле «цена × количество»,
 * метраж/м² не нужен. Если описание содержит такую работу и количество ≤ SIMPLE_MAX_QTY —
 * пропускаем шаг уточнений.
 */
const UNIT_WORK_KEYWORDS = [
  'розет', 'выключател', 'светильник', 'люстр', 'лампочк', 'лампу', 'ламп ',
  'смесител', 'кран ', 'кран,', 'кран.', 'кран\n', 'смесителя',
  'унитаз', 'раковин', 'мойк', 'ванн',
  'замок', 'замка', 'ручк', 'петл', 'петли', 'дверн', 'двер',
  'плинтус', 'карниз', 'крючок', 'полк',
  'точк',
  // Мебель / фурнитура — штучный ремонт
  'ящик', 'выдвижн', 'шкаф', 'дверц', 'фасад', 'фурнитур', 'направляющ',
  'комод', 'тумб', 'столешн', 'стул', 'кроват', 'диван',
  // Бытовая поломка одной единицы
  'починить', 'не работает', 'не открывается', 'не закрывается', 'сломал', 'заел', 'заедает',
  'подтекает', 'течёт', 'течет', 'капает',
  // Мелкий локальный ремонт (щели, трещины, локальная заделка)
  'щель', 'щел', 'трещин', 'дырк', 'дыр ', 'дыру', 'дыры',
  'заделать', 'замазать', 'затереть', 'подкрасить', 'подмазать',
  'герметик', 'силикон', 'шпаклев', 'шпатлев', 'затирк',
  'залить раствор', 'залить щель', 'залить цемент',
  'приклеить', 'прикрутить', 'повесить', 'установить',
];

const SIMPLE_MAX_QTY = 3;

// Существительные штучных работ. Число считается количеством ТОЛЬКО рядом с
// одним из них или с явным «шт». Прежний разбор брал любое число в тексте,
// из-за чего «течёт кран уже 2 дня» превращалось в две протечки и удваивало смету.
const COUNTABLE_NOUNS = [
  // Основы даны с учётом беглых гласных: «розеток» не начинается с «розетк».
  'розет', 'выключател', 'светильник', 'люстр', 'лампочк', 'ламп',
  'смесител', 'кран', 'сифон', 'унитаз', 'раковин', 'мойк', 'ванн',
  'замок', 'замк', 'ручк', 'ручек', 'петл', 'петел',
  'дверц', 'дверец', 'фасад', 'ящик', 'полк', 'полок', 'крючок', 'крючк',
  'карниз', 'плинтус', 'точк', 'точек', 'шкаф', 'комод', 'тумб',
  'стул', 'стуль', 'стол', 'окн', 'окон', 'двер',
  'радиатор', 'батаре', 'счетчик', 'кроват', 'диван', 'зеркал',
];

/** Количество единиц работы: 1..MAX_UNIT_QUANTITY, либо null если не названо. */
function clampUnitQuantity(n: number): number | null {
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(Math.floor(n), MAX_UNIT_QUANTITY);
}

/**
 * Извлекает количество штук из описания: «3 розетки», «две дверцы», «2 шт».
 *
 * Требует привязки числа к штучному предмету или к слову «шт» — иначе любые
 * числа в тексте (сроки, этаж, диаметр, «уже 2 дня») попадали бы в расчёт цены.
 *
 * Границы слов заданы явно: \b в JavaScript опирается на латиницу и с
 * кириллицей не работает — «5 шт» такому шаблону не соответствует.
 */
export function extractUnitQuantity(text: string): number | null {
  if (!text) return null;
  const lower = text.toLowerCase().replace(/ё/g, 'е');
  const nouns = COUNTABLE_NOUNS.join('|');

  // «2 шт», «3 штуки» — явная единица счёта, предмет называть не обязательно
  const explicit = lower.match(/(?:^|[^\d])(\d{1,2})\s*шт(?:\.|ук[аиу]?)?(?![а-я])/);
  if (explicit) return clampUnitQuantity(parseInt(explicit[1], 10));

  // «3 розетки», «2 новые дверцы» — число вплотную к предмету
  // (допускаем одно прилагательное между ними)
  const nearNoun = lower.match(new RegExp(`(?:^|[^\\d])(\\d{1,2})\\s+(?:[а-я]+\\s+)?(?:${nouns})`));
  if (nearNoun) return clampUnitQuantity(parseInt(nearNoun[1], 10));

  // Словесные числительные: «две розетки», «пару выключателей»
  const wordToNum: Record<string, number> = {
    'один': 1, 'одну': 1, 'одна': 1, 'одно': 1,
    'два': 2, 'две': 2, 'двух': 2, 'пару': 2, 'пара': 2,
    'три': 3, 'трех': 3, 'четыре': 4, 'пять': 5, 'шесть': 6,
  };
  for (const [w, n] of Object.entries(wordToNum)) {
    if (new RegExp(`(?:^|[^а-я])${w}\\s+(?:[а-я]+\\s+)?(?:${nouns})`).test(lower)) return n;
  }

  return null;
}

/**
 * Описание содержит штучную работу (розетка/выключатель/смеситель…).
 */
function hasUnitWorkKeyword(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return UNIT_WORK_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Описание явно требует расчёта метража/площади — без этих данных смету не построить.
 * Покраска, штукатурка, стяжка, ламинат, плитка, обои, утепление, кровля.
 */
const AREA_WORK_KEYWORDS = [
  'покрас', 'штукатур', 'шпатлёв', 'шпаклёв', 'шпаклев', 'стяжк',
  'ламинат', 'паркет', 'линолеум', 'плитк', 'кафел', 'обои', 'обоев',
  'утеплен', 'кровл', 'отделк', 'выравнивани',
];

function requiresAreaMetric(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return AREA_WORK_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Проверяет, содержит ли описание конкретные количественные параметры:
 * числа с единицами (м², м, шт, см, %), либо просто числа > 1 цифры.
 */
function descriptionHasMetrics(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  const patterns = [
    /\d+\s?(?:м²|кв\.?\s?м|м2|м\^?2)/,        // м²
    /\d+\s?(?:м3|м³|куб)/,                     // м³
    /\d+\s?(?:шт|штук|пог\.?\s?м|пм|метр)/,   // штуки, погонные
    /\d+\s?(?:см|мм)/,                         // см / мм
    /\d{2,}/,                                  // любые числа от 10
    /(?:^|\s)[2-9]\s+(?:розет|выключ|окн|двер|комнат|светильник|точк|раковин|унитаз|смесител|шкаф|ламп)/i,
  ];
  return patterns.some((re) => re.test(lower));
}

/**
 * Состав сметы в кодах позиций прайса — то, по чему закрытый заказ потом
 * раскладывается обратно и попадает в калибровку цен.
 *
 * Строки без кода (каталог в коде) просто не попадают в обучение: лучше
 * меньше наблюдений, чем наблюдения, привязанные не к той позиции.
 */
export function toPriceLines(variant: { works: PricedLine[]; materials: PricedLine[] }) {
  const lines = [
    ...variant.works.map((w) => ({ ...w, kind: 'LABOR' as const })),
    ...variant.materials.map((m) => ({ ...m, kind: 'MATERIAL' as const })),
  ];
  return lines
    .filter((l) => !!l.code)
    .map((l) => ({ code: l.code!, kind: l.kind, qty: l.qty, unitPrice: l.unitPrice, total: l.total }));
}

export type EscalationLevel = 'AUTO' | 'CONFIRM' | 'ON_SITE';

/** Ширина ценового разброса относительно середины: (max − min) / mid. */
export function priceSpreadRatio(hint?: { min: number; max: number } | null): number | null {
  if (!hint || hint.min <= 0 || hint.max < hint.min) return null;
  const mid = (hint.min + hint.max) / 2;
  if (mid <= 0) return null;
  return (hint.max - hint.min) / mid;
}

// Уверенность, при которой цену можно фиксировать сразу.
const AUTO_CONFIDENCE = 80;
// Разброс, при котором одна цифра ещё честна: 80–150 тыс фиксировать можно.
const AUTO_SPREAD = 0.3;
// Ниже этой уверенности смету не собираем даже с уточнениями.
const CONFIRM_CONFIDENCE = 60;
// Разброс шире этого означает, что мы не знаем объём: 400 тыс — 1,2 млн.
const CONFIRM_SPREAD = 0.6;
// Насколько узким должен быть разброс, чтобы перебить требование обмера.
const OVERRIDE_ONSITE_SPREAD = 0.15;

/**
 * Что делать со сметой: назвать цену, уточнить или ехать мерить.
 *
 * Решение принимается по двум осям, а не по одному флагу `needsOnSite`.
 * Ширина ценового разброса не менее важна, чем уверенность модели: можно
 * быть уверенным в категории «покраска» и при этом не знать, 600 тысяч
 * это или полтора миллиона. Фиксированная цена в такой ситуации — обещание,
 * которое мастер не сдержит.
 */
export function decideEscalation(input: {
  /** Уверенность AI в категории, 0..100. */
  confidence: number | null;
  /** Ширина ценового разброса, см. priceSpreadRatio. null — цены нет вовсе. */
  priceSpread: number | null;
  /** Модель считает, что нужны замеры на месте. */
  modelSaysOnSite: boolean;
  /**
   * Модель вернула перечень работ с кодами прайса.
   *
   * В этом случае цену считает реестр, а не модель, и ценового диапазона от
   * неё не приходит вовсе. Без этого признака отсутствие диапазона читалось
   * бы как «цены нет», и ни один заказ не получал бы мгновенную смету —
   * ровно та ситуация, ради которой контракт и менялся.
   */
  hasSpecPrice?: boolean;
}): EscalationLevel {
  const { confidence, priceSpread, modelSaysOnSite, hasSpecPrice } = input;

  // Цена из реестра: неопределённость здесь не в сумме, а в том, верно ли
  // распознан объём работ. Поэтому решает уверенность и признак обмера.
  if (hasSpecPrice) {
    if (confidence === null) return 'CONFIRM';
    if (modelSaysOnSite) return confidence >= AUTO_CONFIDENCE ? 'CONFIRM' : 'ON_SITE';
    if (confidence >= AUTO_CONFIDENCE) return 'AUTO';
    return confidence >= CONFIRM_CONFIDENCE ? 'CONFIRM' : 'ON_SITE';
  }

  // Цены нет — фиксировать нечего.
  if (priceSpread === null) return modelSaysOnSite ? 'ON_SITE' : 'CONFIRM';
  if (confidence === null) return 'CONFIRM';

  if (confidence >= AUTO_CONFIDENCE && priceSpread <= AUTO_SPREAD) {
    // Модель просит обмер, но сама назвала узкий диапазон — значит объём
    // ей понятен, и это перестраховка. Уступаем ей только при широком разбросе.
    if (modelSaysOnSite && priceSpread > OVERRIDE_ONSITE_SPREAD) return 'CONFIRM';
    return 'AUTO';
  }

  if (confidence >= CONFIRM_CONFIDENCE && priceSpread <= CONFIRM_SPREAD) {
    return modelSaysOnSite ? 'ON_SITE' : 'CONFIRM';
  }

  return 'ON_SITE';
}

/**
 * Уверенность в смете — из наблюдаемых сигналов, а не из константы.
 *
 * Раньше клиенту показывали 0.85 / 0.92 / 0.97 в зависимости от уровня
 * варианта: премиум якобы «вернее» базового. Это ничего не измеряло.
 * Теперь величина отражает то, что система действительно знает о заказе:
 * насколько уверен Vision в категории, нашлась ли проблема в каталоге
 * расценок, есть ли похожие закрытые заказы и известен ли объём работ.
 */
export function computeEstimateConfidence(input: {
  /** Уверенность AI в топ-категории, 0..100. null — анализ не проводился. */
  aiTopConfidence?: number | null;
  /** Проблема найдена в каталоге расценок (а не собрана fallback-путём). */
  matchedCatalog: boolean;
  /** Похожесть лучшего заказа из истории RAG, 0..1. */
  ragTopSimilarity?: number | null;
  /** Похожесть лучшего рецепта из базы знаний, 0..1. */
  knowledgeTopSimilarity?: number | null;
  /** Клиент назвал количество единиц работы. */
  quantityKnown?: boolean;
}): number {
  // Без AI-анализа (клиент выбрал категорию руками) база ниже: система знает
  // направление работ, но не видела объект.
  let c = typeof input.aiTopConfidence === 'number' ? input.aiTopConfidence / 100 : 0.55;

  // Fallback собирает смету из задач БД по совпадению слов — грубее каталога.
  if (!input.matchedCatalog) c *= 0.85;

  // Подтверждение историей: похожий закрытый заказ или проверенный рецепт.
  const support = Math.max(input.ragTopSimilarity ?? 0, input.knowledgeTopSimilarity ?? 0);
  if (support >= 0.8) c += 0.06;
  else if (support >= 0.7) c += 0.03;

  // Объём не назван — считаем по одной единице, риск промаха выше.
  if (input.quantityKnown === false) c -= 0.05;

  return Math.round(Math.min(Math.max(c, 0.35), 0.95) * 100) / 100;
}

/**
 * Определяет сложность заказа:
 *  - SIMPLE: штучная работа в малом количестве (≤ 3) — смета сразу
 *  - CLARIFY: можно уточнить деталями — показать вопросы
 *  - ON_SITE: требует метража, который клиент не назовёт по памяти — нужен выезд мастера
 */
type OrderComplexity = 'SIMPLE' | 'CLARIFY' | 'ON_SITE';

function classifyComplexity(text: string, hasDetectedCategory: boolean): OrderComplexity {
  if (!hasDetectedCategory) return 'CLARIFY';

  const isUnitWork = hasUnitWorkKeyword(text);
  const qty = extractUnitQuantity(text);
  const isAreaWork = requiresAreaMetric(text);
  const hasMetrics = descriptionHasMetrics(text);

  // Если упомянута штучная работа и количество понятно и небольшое — это SIMPLE
  if (isUnitWork && qty !== null && qty >= 1 && qty <= SIMPLE_MAX_QTY) return 'SIMPLE';

  // Если штучная работа без явного количества, но описание содержит «поменять/заменить/установить»
  // в единственном числе — считаем что 1 штука
  if (isUnitWork && qty === null && /\b(поменять|заменить|установить|починить|поставить)\b/i.test(text)) {
    return 'SIMPLE';
  }

  // Работа требует метража, но его нет → клиент сам не посчитает — нужен выезд
  if (isAreaWork && !hasMetrics) return 'ON_SITE';

  // Категория есть, метрики есть — норм, идём дальше без уточнений
  if (hasMetrics) return 'SIMPLE';

  return 'CLARIFY';
}

/** Есть ли у категории хотя бы одна активная задача (через подкатегории) */
function categoryHasTasks(c: any): boolean {
  return (c?.subcategories || []).some((s: any) => (s?.tasks || []).length > 0);
}

export class InstantOrderService {
  /**
   * Разворачивает родительские категории (без собственных задач) в их
   * дочерние «листья» с задачами. Категории-листья возвращаются как есть.
   * Дубликаты по id убираются, исходный порядок сохраняется.
   */
  private async expandLeafCategories(cats: any[], categoryInclude: any): Promise<any[]> {
    const result: any[] = [];
    const seen = new Set<string>();
    const push = (c: any) => {
      if (c && !seen.has(c.id)) { seen.add(c.id); result.push(c); }
    };

    for (const c of cats) {
      if (categoryHasTasks(c)) { push(c); continue; }
      // Родитель без задач → подтягиваем активных детей с задачами
      const children = await prisma.category.findMany({
        where: { parentId: c.id, isActive: true },
        include: categoryInclude,
        orderBy: { sortOrder: 'asc' },
      });
      children.filter(categoryHasTasks).forEach(push);
    }
    return result;
  }

  /**
   * AI-анализ фотографий и описания → 3 варианта (Good / Better / Best)
   */
  async analyzePhotos(userId: string, data: {
    images: string[];
    description?: string;
    voiceText?: string;
    categoryId?: string;
    categoryIds?: string[];
    latitude?: number;
    longitude?: number;
  }) {
    const { images, description, voiceText, categoryId, categoryIds } = data;
    // Нормализуем явный выбор категорий: единый массив без дублей
    const explicitIds = Array.from(
      new Set([...(categoryIds || []), ...(categoryId ? [categoryId] : [])].filter(Boolean))
    );

    if (!images || images.length === 0) {
      // Разрешаем без фото — если есть описание или выбраны категории
      const hasContext = (description?.length || 0) >= 5 || (voiceText?.length || 0) >= 5 || explicitIds.length > 0;
      if (!hasContext) {
        throw ApiError.badRequest('Добавьте фото, описание или выберите категорию');
      }
    }
    if (images.length > 10) {
      throw ApiError.badRequest('Максимум 10 фотографий');
    }

    // Объединяем описание из голоса и текста
    const combinedDescription = [voiceText, description].filter(Boolean).join('. ');

    // Заказ по одной фотографии без единого слова — основной сценарий продукта:
    // клиент снимает поломку и получает смету. Раньше такой запрос отклонялся,
    // и «Заказ за 30 секунд» на деле требовал описания.
    if (!combinedDescription && explicitIds.length === 0 && images.length === 0) {
      throw ApiError.badRequest('Добавьте фото или опишите, что нужно сделать');
    }

    // ═══════════════════════════════════════════════════════════════════
    // СТРАТЕГИЯ ОПРЕДЕЛЕНИЯ КАТЕГОРИЙ:
    //  • explicitIds (массив) передан → клиент выбрал N категорий вручную
    //  • описание длинное и keyword-detect нашёл ≥1 → одна или несколько категорий
    //  • описание короткое/мутное → возвращаем уточняющие вопросы (без вариантов)
    //  • найдено 0 категорий       → возвращаем уточняющие вопросы
    // ═══════════════════════════════════════════════════════════════════

    const categoryInclude = {
      subcategories: {
        where: { isActive: true },
        include: {
          tasks: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
        },
      },
    };

    let detectedCategories: any[] = [];
    let aiAnalysis: AiAnalysisResult | null = null;
    let allCategoriesActive: any[] = [];
    // Флаг: AI уверенно определил категорию (≥75%) → не задаём локальных уточнений,
    // даже если эвристика не нашла ключевых слов (типа «розетка», «м²»).
    let aiConfidentSkipClarify = false;

    if (explicitIds.length > 0) {
      const explicit = await prisma.category.findMany({
        where: { id: { in: explicitIds }, isActive: true },
        include: categoryInclude,
      });
      // Сохраняем порядок, в котором клиент перечислил категории
      const ordered = explicitIds
        .map((id) => explicit.find((c) => c.id === id))
        .filter(Boolean) as any[];
      // Родительские категории (без своих задач) разворачиваем в дочерние-листья
      detectedCategories = await this.expandLeafCategories(ordered, categoryInclude);
    } else {
      // ─── AI Vision: анализ фото + текста через OpenAI GPT-4o ──────
      allCategoriesActive = await prisma.category.findMany({
        where: { isActive: true },
        include: categoryInclude,
      });
      // AI должен видеть только «листовые» категории с задачами — иначе он
      // может выбрать родителя («Помощь по дому»), у которого нет услуг.
      const leafCategories = allCategoriesActive.filter(categoryHasTasks);

      aiAnalysis = await runVisionAnalysis({
        images,
        text: combinedDescription,
        availableCategories: leafCategories.map((c: any) => ({ slug: c.slug, name: c.name })),
      });

      // ─── Лестница эскалации ───────────────────────────────────────
      // Решение принимается по двум осям: уверенность модели и ширина
      // ценового разброса. Прежде хватало одного флага needsOnSite, из-за
      // чего система либо обещала точную цену там, где не знала объём,
      // либо гнала мастера на замер ради замены розетки.
      const aiTop = aiAnalysis.categories[0];
      const spread = priceSpreadRatio(aiAnalysis.priceHint);
      const escalation = decideEscalation({
        confidence: aiTop?.confidence ?? null,
        priceSpread: spread,
        modelSaysOnSite: aiAnalysis.needsOnSite,
        hasSpecPrice: aiAnalysis.jobs.length > 0,
      });

      logger.info(
        {
          topCat: aiTop?.slug,
          conf: aiTop?.confidence,
          spread: spread === null ? null : Math.round(spread * 100) / 100,
          jobs: aiAnalysis.jobs.length,
          modelSaysOnSite: aiAnalysis.needsOnSite,
          escalation,
        },
        'AI-анализ: уровень эскалации определён'
      );

      if (escalation === 'ON_SITE') {
        const partialMatches = aiAnalysis.categories
          .map((g) => allCategoriesActive.find((c: any) => c.slug === g.slug))
          .filter(Boolean)
          .slice(0, 8)
          .map((c: any) => ({ id: c.id, name: c.name, slug: c.slug }));

        return {
          needsClarification: false,
          needsOnSiteEstimation: true,
          complexity: 'ON_SITE' as const,
          escalation,
          aiSummary: aiAnalysis.summary,
          urgency: aiAnalysis.urgency,
          message:
            'Для точного расчёта нужны замеры на месте (площадь, объём работ). ' +
            'Можем вызвать мастера на бесплатную (или платную, по тарифу платформы) выездную оценку.',
          partialMatches,
        };
      }

      const CONFIDENT_THRESHOLD = 75; // ≥ 75 — берём одну категорию
      const POSSIBLE_THRESHOLD = 50;  // 50-74 — даём клиенту выбрать из топ-3
      const top = aiAnalysis.categories[0];

      if (top && top.confidence >= CONFIDENT_THRESHOLD) {
        const cat = allCategoriesActive.find((c: any) => c.slug === top.slug);
        if (cat) {
          detectedCategories = [cat];
          // Уточнения пропускаем только на уровне AUTO: модель уверена И
          // назвала узкий диапазон. На уровне CONFIRM клиент получит вопрос
          // об объёме — это дешевле, чем неверная цена в эскроу.
          aiConfidentSkipClarify = escalation === 'AUTO';
        }
      } else if (top && top.confidence >= POSSIBLE_THRESHOLD) {
        // Клиент должен подтвердить — возвращаем топ-3 с confidence
        const suggested = aiAnalysis.categories
          .map((g) => {
            const c = allCategoriesActive.find((cat: any) => cat.slug === g.slug);
            return c
              ? {
                  id: c.id,
                  slug: c.slug,
                  name: c.name,
                  nameUz: c.nameUz,
                  nameEn: c.nameEn,
                  icon: c.icon,
                  confidence: g.confidence,
                  reasoning: g.reasoning,
                }
              : null;
          })
          .filter(Boolean);

        logger.info(
          { count: suggested.length, topConf: top.confidence },
          'AI-анализ: средний confidence, нужно подтверждение категории'
        );

        return {
          needsClarification: false,
          needsCategoryConfirmation: true,
          complexity: 'CONFIRM' as const,
          aiSummary: aiAnalysis.summary,
          urgency: aiAnalysis.urgency,
          suggestedCategories: suggested,
          message:
            'AI определил несколько возможных направлений. Отметьте подходящие — соберём точную смету.',
        };
      }
      // < POSSIBLE_THRESHOLD → detectedCategories пуст → попадём в CLARIFY ниже
    }

    // ─── Классификация сложности заказа ──────────────────────
    //  SIMPLE   — штучная работа (1-3 розетки) или есть конкретные метрики → строим смету сразу
    //  CLARIFY  — категория есть, но непонятен объём → задаём уточняющие вопросы
    //  ON_SITE  — работа требует обмера (покраска/плитка/стяжка без площади) → выезд мастера
    //
    //  Если AI уверенно определил категорию (≥75%) — пропускаем CLARIFY и идём к смете.
    //  Принцип «макс. упрощения» для 30-секундного заказа: пусть AI сам анализирует.
    const rawComplexity = classifyComplexity(combinedDescription, detectedCategories.length > 0);
    const complexity: OrderComplexity = aiConfidentSkipClarify && rawComplexity === 'CLARIFY'
      ? 'SIMPLE'
      : rawComplexity;
    const tooShortWithoutExplicit =
      combinedDescription.length < MIN_CLEAR_DESCRIPTION_LEN && explicitIds.length === 0 && !aiConfidentSkipClarify;

    if (complexity === 'ON_SITE') {
      logger.info(
        { descriptionLen: combinedDescription.length, detected: detectedCategories.length },
        'AI-анализ: работа требует выезда мастера для обмера'
      );
      return {
        needsClarification: false,
        needsOnSiteEstimation: true,
        complexity: 'ON_SITE' as const,
        aiSummary: aiAnalysis?.summary,
        urgency: aiAnalysis?.urgency,
        message:
          'Для точного расчёта нужны замеры на месте (площадь, объём работ). ' +
          'Можем вызвать мастера на бесплатную (или платную, по тарифу платформы) выездную оценку.',
        partialMatches: detectedCategories.slice(0, 8).map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
        })),
      };
    }

    if (complexity === 'CLARIFY' || (detectedCategories.length === 0) || tooShortWithoutExplicit) {
      logger.info(
        {
          descriptionLen: combinedDescription.length,
          detected: detectedCategories.length,
          complexity,
          explicit: explicitIds.length,
        },
        'AI-анализ: недостаточно деталей → возвращаем уточняющие вопросы'
      );
      return {
        needsClarification: true,
        complexity: 'CLARIFY' as const,
        aiSummary: aiAnalysis?.summary,
        urgency: aiAnalysis?.urgency,
        clarifyingQuestions: buildClarifyingQuestionsFor(
          detectedCategories.map((c: any) => ({ slug: c.slug, name: c.name }))
        ),
        message:
          detectedCategories.length === 0
            ? 'Не удалось точно определить характер работ. Ответьте на пару вопросов — соберём точную смету.'
            : 'Чтобы рассчитать стоимость точно, уточните объём работ (площадь, количество, метраж).',
        partialMatches: detectedCategories.slice(0, 8).map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
        })),
      };
    }

    // complexity === 'SIMPLE' → идём строить смету

    // ─── Если найдено НЕСКОЛЬКО категорий → строим мульти-смету ────
    if (detectedCategories.length > 1) {
      return await this.buildMultiCategoryAnalysis(
        userId,
        detectedCategories,
        combinedDescription,
        images,
        aiAnalysis,
      );
    }

    // ─── Одна категория (классический путь) ─────────────────────────
    const category = detectedCategories[0];

    // ─── Собираем все доступные задачи (с инфо о подкатегории/категории) ─────
    const allTasks = (category.subcategories || []).flatMap((sub: any) =>
      (sub.tasks || []).map((t: any) => ({
        ...t,
        categoryId: category.id,
        categoryName: category.name,
        subcategoryName: sub.name,
      }))
    );

    if (allTasks.length === 0) {
      logger.warn({ categoryId: category.id, categoryName: category.name }, 'AI-анализ: в категории нет задач');
      throw ApiError.badRequest(
        `В категории "${category.name}" пока нет доступных услуг. ` +
        `Администратор должен добавить задачи в каталог. Попробуйте другую категорию.`
      );
    }

    // ─── УМНЫЙ AI-анализ: сначала каталог расценок, потом fallback ──
    // Количество единиц («заменить 3 розетки») теперь доходит до расчёта цены,
    // а не остаётся в классификаторе сложности.
    const unitQuantity = extractUnitQuantity(combinedDescription);
    const aiContext = buildAiContext(aiAnalysis);
    const estimateConfidence = computeEstimateConfidence({
      aiTopConfidence: aiAnalysis?.categories[0]?.confidence ?? null,
      matchedCatalog: true,
      ragTopSimilarity: aiAnalysis?.raw.ragTopSimilarity ?? null,
      knowledgeTopSimilarity: aiAnalysis?.raw.knowledgeTopSimilarity ?? null,
      quantityKnown: unitQuantity !== null,
    });

    const smartResult = buildSmartVariants(
      category.slug,
      category.name,
      combinedDescription,
      aiAnalysis?.priceHint ?? null,
      { quantity: unitQuantity, confidence: estimateConfidence, aiContext }
    );

    // ─── Прайс-реестр в БД: основной путь, когда включён ───────────
    // Реестр правится из админки и калибруется по реальным сделкам, поэтому
    // при готовности он имеет приоритет над каталогом в коде. Флаг снимается
    // после того, как прогон eval покажет паритет двух путей.
    // Спецификация от Vision — самый точный путь: коды работ и объём известны,
    // остаётся сложить по прайсу. Языковая модель в цене не участвует вовсе.
    const fromJobs = config.pricebook.enabled && (aiAnalysis?.jobs?.length ?? 0) > 0
      ? await buildVariantsFromJobs(aiAnalysis!.jobs, {
          categorySlug: category.slug,
          description: combinedDescription,
          confidence: estimateConfidence,
          urgency: aiAnalysis?.urgency,
        }).catch((err) => {
          logger.warn({ err: err?.message }, 'Смета по спецификации не собралась — идём обычным путём');
          return null;
        })
      : null;

    const fromPriceBook = !fromJobs && config.pricebook.enabled
      ? await buildVariantsFromPriceBook({
          categorySlug: category.slug,
          description: combinedDescription,
          quantity: unitQuantity,
          confidence: estimateConfidence,
          urgency: aiAnalysis?.urgency,
          aiPriceHint: aiAnalysis?.priceHint ?? null,
          aiContext,
        }).catch((err) => {
          logger.warn({ err: err?.message }, 'Прайс-реестр недоступен — считаем по каталогу в коде');
          return null;
        })
      : null;

    // Все пути дают одну и ту же форму сметы — расходятся только источником
    // позиций и привязкой к задачам БД.
    let variants: EstimateVariant[];
    let variantTaskIds: string[];
    let priceSource: 'JOBS' | 'PRICEBOOK' | 'CATALOG' | 'FALLBACK';

    if (fromJobs) {
      logger.info(
        {
          categorySlug: category.slug,
          problem: fromJobs.problemSlug,
          jobs: aiAnalysis!.jobs.map((j) => `${j.workCode}×${j.qty}`),
        },
        'AI-анализ: смета собрана по спецификации работ'
      );
      variants = fromJobs.variants;
      const matched = this.matchTasksToSolution(
        allTasks,
        fromJobs.variants[0]?.title ?? '',
        fromJobs.variants[0]?.description ?? '',
      );
      variantTaskIds = matched.length > 0 ? matched : [allTasks[0]?.id].filter(Boolean);
      priceSource = 'JOBS';
    } else if (fromPriceBook) {
      logger.info(
        { categorySlug: category.slug, problem: fromPriceBook.problemSlug, quantity: unitQuantity },
        'AI-анализ: смета собрана из прайс-реестра'
      );
      variants = fromPriceBook.variants;
      const matched = this.matchTasksToSolution(
        allTasks,
        fromPriceBook.variants[0]?.title ?? '',
        fromPriceBook.variants[0]?.description ?? '',
      );
      variantTaskIds = matched.length > 0 ? matched : [allTasks[0]?.id].filter(Boolean);
      priceSource = 'PRICEBOOK';
    } else if (smartResult) {
      // Умный каталог нашёл конкретную проблему → позиции с ценами Ташкента
      logger.info(
        { categorySlug: category.slug, problem: smartResult.problemName, quantity: unitQuantity },
        'AI-анализ: найдена проблема в каталоге расценок'
      );
      variants = smartResult.variants;
      const matched = this.matchTasksToSolution(
        allTasks,
        smartResult.variants[0]?.title ?? '',
        smartResult.variants[0]?.description ?? '',
      );
      variantTaskIds = matched.length > 0 ? matched : [allTasks[0]?.id].filter(Boolean);
      priceSource = 'CATALOG';
    } else {
      // Fallback: смета собирается из задач БД по совпадению с описанием
      logger.info(
        { categorySlug: category.slug, quantity: unitQuantity },
        'AI-анализ: проблема не найдена в каталоге, используем fallback'
      );
      const fb = this.generateVariantsFallback(category, allTasks, combinedDescription, {
        quantity: unitQuantity,
        aiContext,
        aiPriceHint: aiAnalysis?.priceHint ?? null,
        // Fallback грубее каталожного пути — уверенность ниже.
        confidence: computeEstimateConfidence({
          aiTopConfidence: aiAnalysis?.categories[0]?.confidence ?? null,
          matchedCatalog: false,
          ragTopSimilarity: aiAnalysis?.raw.ragTopSimilarity ?? null,
          knowledgeTopSimilarity: aiAnalysis?.raw.knowledgeTopSimilarity ?? null,
          quantityKnown: unitQuantity !== null,
        }),
      });
      variants = fb.variants;
      variantTaskIds = fb.taskIds;
      priceSource = 'FALLBACK';
    }

    // Диапазон по квартилям реальных сделок. Считается только для реестра:
    // у каталога в коде нет ни кодов позиций, ни статистики сделок.
    if (config.pricebook.enabled && (priceSource === 'JOBS' || priceSource === 'PRICEBOOK')) {
      variants = await attachPriceRanges(variants).catch((err) => {
        logger.warn({ err: err?.message }, 'Диапазон цены не посчитан — показываем одну сумму');
        return variants;
      });
    }

    const analysisResult = {
      variants: variants.map((v) => ({
        tier: v.tier,
        tierLabel: v.tierLabel,
        taskIds: variantTaskIds,
        materials: v.materials.map((m) => ({
          name: m.name,
          quantity: m.qty,
          unit: m.unit,
          unitPrice: m.unitPrice,
          total: m.total,
        })),
        works: v.works,
        priceLines: toPriceLines(v),
        estimatedPrice: v.estimatedPrice,
        priceRange: v.priceRange,
        priceIsFixed: v.priceIsFixed,
        estimatedDays: v.estimatedDays,
        confidence: v.confidence,
        description: `${v.title}. ${v.description}`,
      })),
    };

    // Сохраняем шаблоны в БД
    let templates;
    try {
      templates = await Promise.all(
        analysisResult.variants.map(async (variant: any) => {
          return prisma.aiOrderTemplate.create({
            data: {
              categoryId: category.id,
              tier: variant.tier as AiTierType,
              tierLabel: variant.tierLabel,
              taskIds: variant.taskIds,
              materials: variant.materials,
              priceLines: variant.priceLines ?? [],
              estimatedPrice: Math.min(Math.round(variant.estimatedPrice), 9_999_999_999),
              estimatedDays: variant.estimatedDays,
              confidence: variant.confidence,
              prompt: (combinedDescription || '').substring(0, 2000),
              imageAnalysis: {
                imageCount: images.length,
                description: (combinedDescription || '').substring(0, 500),
                ai: aiAnalysis
                  ? {
                      topCategory: aiAnalysis.categories[0]?.slug,
                      topConfidence: aiAnalysis.categories[0]?.confidence,
                      urgency: aiAnalysis.urgency,
                      summary: aiAnalysis.summary,
                      materials: aiAnalysis.materials,
                      priceHint: aiAnalysis.priceHint,
                      needsOnSite: aiAnalysis.needsOnSite,
                      model: aiAnalysis.raw.model,
                      latencyMs: aiAnalysis.raw.latencyMs,
                    }
                  : null,
              },
              description: (variant.description || '').substring(0, 2000),
              createdById: userId,
            },
          });
        })
      );
    } catch (dbError: any) {
      logger.error(
        { error: dbError?.message, code: dbError?.code, meta: dbError?.meta, stack: dbError?.stack?.substring(0, 500) },
        'Ошибка сохранения AI-шаблона в БД'
      );
      // Prisma P2021 = table does not exist, P2002 = unique constraint
      if (dbError?.code === 'P2021') {
        throw ApiError.badRequest('Таблица AI-шаблонов не создана. Необходимо выполнить миграцию БД.');
      }
      const detail = dbError?.meta?.cause || dbError?.code || dbError?.message || 'Unknown DB error';
      throw ApiError.badRequest(`Ошибка при создании вариантов (${detail}). Попробуйте ещё раз.`);
    }

    logger.info(
      { userId, categoryId: category.id, variantCount: templates.length, priceSource, quantity: unitQuantity },
      'AI-анализ завершён, варианты созданы'
    );

    return {
      category: {
        id: category.id,
        name: category.name,
        nameUz: category.nameUz,
        nameEn: category.nameEn,
        slug: category.slug,
      },
      detectedFromPhoto: explicitIds.length === 0,
      // Откуда взялась цена: реестр в БД, каталог в коде или резервный расчёт.
      // Нужно для сверки паритета путей на eval-наборе.
      priceSource,
      aiSummary: aiAnalysis?.summary,
      aiConfidence: aiAnalysis?.categories[0]?.confidence,
      urgency: aiAnalysis?.urgency,
      aiMaterials: aiAnalysis?.materials,
      aiPriceHint: aiAnalysis?.priceHint ?? undefined,
      detectedCategories: [
        {
          id: category.id,
          name: category.name,
          slug: category.slug,
          nameUz: category.nameUz,
          nameEn: category.nameEn,
          icon: category.icon,
          confidence: aiAnalysis?.categories[0]?.confidence,
        },
      ],
      variants: templates.map((t: any, i: number) => ({
        id: t.id,
        tier: t.tier,
        tierLabel: t.tierLabel,
        taskIds: t.taskIds,
        materials: t.materials,
        estimatedPrice: t.estimatedPrice,
        estimatedDays: t.estimatedDays,
        confidence: t.confidence,
        description: t.description,
        // Диапазон живёт в ответе, а не в шаблоне: он меняется вместе с
        // калибровкой, а шаблон фиксирует цену на момент показа.
        priceRange: analysisResult.variants[i]?.priceRange,
        priceIsFixed: analysisResult.variants[i]?.priceIsFixed,
      })),
      allTasks: allTasks.map((t: any) => ({
        id: t.id,
        name: t.name,
        nameUz: t.nameUz,
        nameEn: t.nameEn,
        minPrice: t.minPrice,
        estimatedTime: t.estimatedTime,
        categoryId: t.categoryId,
        categoryName: t.categoryName,
        subcategoryName: t.subcategoryName,
      })),
    };
  }

  /**
   * Публичная экспресс-оценка стоимости — БЕЗ авторизации и БЕЗ записи в БД.
   * Lead-magnet: аноним загружает фото / описывает задачу → получает примерный
   * диапазон цены. Чтобы оформить заказ и найти мастера — нужна регистрация.
   *
   * Отличия от analyzePhotos:
   *  • не требует userId;
   *  • не создаёт AiOrderTemplate (нечего хранить — это просто прикидка);
   *  • возвращает упрощённый ответ: категория + диапазон цены + варианты.
   */
  async publicEstimate(data: {
    images?: string[];
    description?: string;
    voiceText?: string;
  }) {
    const images = (data.images || []).filter(Boolean).slice(0, 5);
    const combinedDescription = [data.voiceText, data.description]
      .filter(Boolean)
      .join('. ')
      .trim();

    if (images.length === 0 && combinedDescription.length < 5) {
      throw ApiError.badRequest('Добавьте фото или опишите задачу (минимум несколько слов)');
    }

    const categoryInclude = {
      subcategories: {
        where: { isActive: true },
        include: {
          tasks: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
        },
      },
    };

    const allCategoriesActive = await prisma.category.findMany({
      where: { isActive: true },
      include: categoryInclude,
    });
    const leafCategories = allCategoriesActive.filter(categoryHasTasks);

    const aiAnalysis = await analyzeOrder({
      photoUrls: images,
      text: combinedDescription,
      availableCategories: leafCategories.map((c: any) => ({ slug: c.slug, name: c.name })),
    });

    const top = aiAnalysis.categories[0];
    const category = top
      ? allCategoriesActive.find((c: any) => c.slug === top.slug) ?? null
      : null;

    let variants: Array<{
      tier: string;
      tierLabel: string;
      title: string;
      estimatedPrice: number;
      estimatedDays: number;
    }> = [];
    let priceMin = 0;
    let priceMax = 0;

    if (category) {
      const smart = buildSmartVariants(
        category.slug,
        category.name,
        combinedDescription,
        aiAnalysis.priceHint ?? null,
        // Экспресс-оценка считается по тем же правилам, что и полная смета:
        // иначе анонимный калькулятор и авторизованный заказ дают разные цены.
        {
          quantity: extractUnitQuantity(combinedDescription),
          confidence: computeEstimateConfidence({
            aiTopConfidence: top?.confidence ?? null,
            matchedCatalog: true,
            ragTopSimilarity: aiAnalysis.raw.ragTopSimilarity,
            knowledgeTopSimilarity: aiAnalysis.raw.knowledgeTopSimilarity,
            quantityKnown: extractUnitQuantity(combinedDescription) !== null,
          }),
        }
      );
      if (smart) {
        variants = smart.variants.map((v) => ({
          tier: v.tier,
          tierLabel: v.tierLabel,
          title: v.title,
          estimatedPrice: Math.round(v.estimatedPrice),
          estimatedDays: v.estimatedDays,
        }));
        const prices = variants.map((v) => v.estimatedPrice).filter((p) => p > 0);
        if (prices.length > 0) {
          priceMin = Math.min(...prices);
          priceMax = Math.max(...prices);
        }
      }
    }

    // Fallback: если каталог расценок не нашёл точную проблему — берём прикидку AI
    if (priceMin === 0 && aiAnalysis.priceHint && aiAnalysis.priceHint.min > 0) {
      priceMin = Math.round(aiAnalysis.priceHint.min);
      priceMax = Math.round(aiAnalysis.priceHint.max);
    }

    const hasPrice = priceMin > 0 && priceMax >= priceMin;

    return {
      category: category
        ? { name: category.name, slug: category.slug, icon: category.icon }
        : null,
      confidence: top?.confidence ?? null,
      summary: aiAnalysis.summary,
      urgency: aiAnalysis.urgency,
      priceRange: hasPrice ? { min: priceMin, max: priceMax } : null,
      needsOnSite: !hasPrice,
      variants,
      materials: (aiAnalysis.materials || []).slice(0, 8),
    };
  }

  /**
   * Создание заказа из выбранного AI-варианта
   */
  async createFromTemplate(clientId: string, data: {
    templateId: string;
    title: string;
    description: string;
    additionalWishes?: string;
    voiceDescription?: string;
    address: string;
    city?: string;
    district?: string;
    region?: string;
    latitude?: number;
    longitude?: number;
    images: string[];
    deadline?: string;
    isUrgent?: boolean;
    offerAccepted: boolean;
  }) {
    // Проверяем оферту
    if (!data.offerAccepted) {
      throw ApiError.badRequest('Необходимо принять условия оферты');
    }

    // Загружаем шаблон
    const template = await prisma.aiOrderTemplate.findUnique({
      where: { id: data.templateId },
    });
    if (!template) {
      throw ApiError.notFound('AI-вариант не найден');
    }

    // Проверяем категорию
    const category = await prisma.category.findUnique({
      where: { id: template.categoryId },
    });
    if (!category || !category.isActive) {
      throw ApiError.badRequest('Категория не найдена или неактивна');
    }

    // Получаем конфигурацию платформы
    const [visitFeeConfig, visitFeeCommConfig, urgencyConfig] = await Promise.all([
      prisma.platformConfig.findUnique({ where: { key: 'visit_fee' } }),
      prisma.platformConfig.findUnique({ where: { key: 'visit_fee_commission_rate' } }),
      prisma.platformConfig.findUnique({ where: { key: 'urgency_multiplier' } }),
    ]);
    const visitFee = visitFeeConfig ? parseFloat(visitFeeConfig.value) : DEFAULT_VISIT_FEE;
    const visitFeeCommissionRate = visitFeeCommConfig ? parseFloat(visitFeeCommConfig.value) : VISIT_FEE_COMMISSION_RATE;

    // Обработка срочности (из настроек или по умолчанию 40%)
    const urgencyPercent = urgencyConfig ? parseFloat(urgencyConfig.value) : 40;
    const URGENT_MULTIPLIER = 1 + urgencyPercent / 100;
    const isUrgent = data.isUrgent === true;
    const urgentMultiplier = isUrgent ? URGENT_MULTIPLIER : 1.0;
    const effectivePrice = moneyMul(toNum(template.estimatedPrice), urgentMultiplier);

    // Ступенчатая комиссия от стоимости работ (растущая модель).
    // Мастер ещё не назначен → берём базовую ступень; надбавка за первый/повторный
    // заказ пары применится при назначении мастера в assignMaster.
    const { getTieredCommissionRate } = await import('../../services/platformConfigService.js');
    const commissionRate = await getTieredCommissionRate(effectivePrice);

    // Комиссии
    const workCommission = calculateCommission(effectivePrice, commissionRate);
    const visitFeeCommission = calculateCommission(visitFee, visitFeeCommissionRate);
    const commissionAmount = moneyAdd(workCommission, visitFeeCommission);

    // Сумма для эскроу
    const escrowAmount = effectivePrice + visitFee;

    // Проверка баланса и блокировка средств
    const clientBalance = await balanceService.getBalance(clientId);
    if (clientBalance < escrowAmount) {
      throw ApiError.badRequest(
        `Недостаточно средств. Баланс: ${clientBalance.toLocaleString('ru')} сум, ` +
        `необходимо: ${escrowAmount.toLocaleString('ru')} сум`
      );
    }

    await balanceService.holdFunds(clientId, escrowAmount, 'pending');

    // ─── Снимок прогноза AI (самообучение) ───────────────────────────
    // Фиксируем, что модель предсказала ДО начала работ. Факт (итоговая цена
    // и категория) уже хранится в самом заказе, поэтому дублировать его не
    // нужно — сравнение прогноза с результатом станет обычным SQL-запросом,
    // а обучающий набор соберётся сам по мере закрытия заказов.
    // Цену берём без надбавки за срочность: это прогноз стоимости РАБОТ,
    // а множитель — наша наценка, к качеству модели отношения не имеет.
    const aiSnapshot = (() => {
      const meta = (template.imageAnalysis as any)?.ai ?? null;
      return {
        aiPredictedPrice: toNum(template.estimatedPrice),
        aiPredictedCategoryId: template.categoryId,
        aiConfidence: template.confidence ?? null,
        aiNeedsOnSite: typeof meta?.needsOnSite === 'boolean' ? meta.needsOnSite : null,
        aiModel: meta?.model ?? null,
        aiPredictedAt: new Date(),
      };
    })();

    try {
      const order = await prisma.order.create({
        data: {
          clientId,
          categoryId: template.categoryId,
          ...aiSnapshot,
          title: data.title,
          description: data.description,
          price: effectivePrice,
          commissionRate,
          commissionAmount,
          visitFee,
          escrowAmount,
          offerAccepted: true,
          status: OrderStatus.PUBLISHED,
          isUrgent,
          urgentMultiplier,
          // AI-специфичные поля
          isInstantAiOrder: true,
          source: 'INSTANT_AI',
          aiTemplateId: template.id,
          additionalWishes: data.additionalWishes || null,
          moderationRequired: false,
          voiceDescription: data.voiceDescription || null,
          // Адрес
          address: data.address,
          city: data.city,
          district: data.district,
          region: data.region,
          latitude: data.latitude,
          longitude: data.longitude,
          images: data.images,
          deadline: parseOptionalDate(data.deadline),
          // Задачи из шаблона
          ...(template.taskIds.length > 0
            ? { orderTasks: { create: template.taskIds.map((taskId: string) => ({ taskId })) } }
            : {}),
        },
        include: {
          category: true,
          client: { include: { profile: true } },
          orderTasks: { include: { task: true } },
          aiTemplate: true,
        },
      });

      // Обновляем orderId в транзакции эскроу
      await prisma.balanceTransaction.updateMany({
        where: { userId: clientId, orderId: 'pending', type: 'ESCROW_HOLD' },
        data: { orderId: order.id },
      });

      logger.info(
        { orderId: order.id, clientId, tier: template.tier, price: effectivePrice },
        '🚀 Instant AI Order создан'
      );

      // Уведомляем мастеров о новом заказе
      notificationService.notifyMastersNewOrder(order.id).catch((err) => {
        logger.error({ error: err }, 'Ошибка уведомления мастеров');
      });

      return order;
    } catch (error) {
      // Откат эскроу при ошибке
      await prisma.user.update({
        where: { id: clientId },
        data: { balance: { increment: escrowAmount } },
      });
      throw error;
    }
  }

  /**
   * Получить шаблон по ID
   */
  async getTemplate(templateId: string) {
    const template = await prisma.aiOrderTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) throw ApiError.notFound('Шаблон не найден');
    return template;
  }

  /**
   * Получить все AI-заказы на модерации (для менеджера)
   */
  async getPendingModeration(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: {
          isInstantAiOrder: true,
          source: 'INSTANT_AI',
          moderationRequired: true,
          status: OrderStatus.MODERATION,
        },
        include: {
          category: true,
          client: { include: { profile: true } },
          orderTasks: { include: { task: true } },
          aiTemplate: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({
        where: {
          isInstantAiOrder: true,
          source: 'INSTANT_AI',
          moderationRequired: true,
          status: OrderStatus.MODERATION,
        },
      }),
    ]);

    return {
      data: orders,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Модерация AI-заказа менеджером (одобрить / отклонить)
   */
  async moderateOrder(orderId: string, moderatorId: string, approved: boolean, note?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { aiTemplate: true },
    });
    if (!order) throw ApiError.notFound('Заказ не найден');
    if (!order.isInstantAiOrder) throw ApiError.badRequest('Это не AI-заказ');
    if (order.status !== OrderStatus.MODERATION) {
      throw ApiError.badRequest('Заказ не на модерации');
    }

    if (approved) {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PUBLISHED },
      });

      notificationService.notifyMastersNewOrder(orderId).catch((err) => {
        logger.error({ error: err }, 'Ошибка уведомления мастеров');
      });

      logger.info({ orderId, moderatorId }, 'AI-заказ одобрен модератором');
    } else {
      // Отклонён — атомарно переводим в CANCELLED только из статуса MODERATION,
      // чтобы повторная модерация не вернула эскроу дважды.
      const claimed = await prisma.order.updateMany({
        where: { id: orderId, status: OrderStatus.MODERATION },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: note || 'Отклонено модератором',
          cancelledBy: moderatorId,
          cancelledAt: new Date(),
          escrowAmount: 0,
        },
      });

      // Возвращаем эскроу клиенту только если именно мы захватили заказ
      if (claimed.count > 0 && toNum(order.escrowAmount) > 0) {
        await prisma.user.update({
          where: { id: order.clientId },
          data: { balance: { increment: toNum(order.escrowAmount) } },
        });
      }

      logger.info({ orderId, moderatorId, note }, 'AI-заказ отклонён модератором');
    }

    return { orderId, approved, note };
  }

  // ─── Приватные методы ──────────────────────────

  /**
   * Сборка сметы для НЕСКОЛЬКИХ направлений сразу.
   *
   * Алгоритм:
   * 1. Для каждой найденной категории строим её собственный набор вариантов
   *    (через buildSmartVariants → fallback). Берём BEST per-категория для самой полной картины.
   * 2. Объединяем результаты в 3 уровня:
   *    GOOD    = сумма GOOD по всем категориям (стандартные комплектующие)
   *    BETTER  = сумма BETTER (комплектующие повышенного класса)
   *    BEST    = сумма BEST (премиум-комплектующие)
   *    Объём работ во всех трёх уровнях одинаковый — отличается класс исполнения.
   * 3. taskIds объединяются, materials конкатенируются.
   * 4. Сохраняем шаблоны в БД как обычно (categoryId — самая весомая = первая).
   */
  private async buildMultiCategoryAnalysis(
    userId: string,
    categories: any[],
    description: string,
    images: string[],
    aiAnalysis: AiAnalysisResult | null,
  ) {
    type SubVariant = {
      tier: AiTierType;
      tierLabel: string;
      taskIds: string[];
      materials: any[];
      priceLines: ReturnType<typeof toPriceLines>;
      estimatedPrice: number;
      estimatedDays: number;
      confidence: number;
      description: string;
    };
    type CategoryBundle = {
      category: any;
      taskIds: string[];
      variants: EstimateVariant[];
    };

    const unitQuantity = extractUnitQuantity(description);
    const bundles: CategoryBundle[] = [];

    // ─── Шаг 1: смета по каждому направлению БЕЗ ценового хинта ──────
    // Хинт AI относится ко всему заказу целиком, поэтому применить его
    // к каждой категории по отдельности значило бы умножить его на их число.
    for (const cat of categories) {
      const tasks = cat.subcategories?.flatMap((s: any) => s.tasks || []) || [];
      if (tasks.length === 0) continue;

      const confidence = computeEstimateConfidence({
        aiTopConfidence: aiAnalysis?.categories[0]?.confidence ?? null,
        matchedCatalog: true,
        ragTopSimilarity: aiAnalysis?.raw.ragTopSimilarity ?? null,
        knowledgeTopSimilarity: aiAnalysis?.raw.knowledgeTopSimilarity ?? null,
        quantityKnown: unitQuantity !== null,
      });

      const smart = buildSmartVariants(cat.slug, cat.name, description, null, {
        quantity: unitQuantity,
        confidence,
      });

      if (smart) {
        const matched = this.matchTasksToSolution(
          tasks,
          smart.variants[0]?.title ?? '',
          smart.variants[0]?.description ?? '',
        );
        bundles.push({
          category: cat,
          taskIds: matched.length > 0 ? matched : tasks[0] ? [tasks[0].id] : [],
          variants: smart.variants,
        });
      } else {
        const fb = this.generateVariantsFallback(cat, tasks, description, {
          quantity: unitQuantity,
          confidence: computeEstimateConfidence({
            aiTopConfidence: aiAnalysis?.categories[0]?.confidence ?? null,
            matchedCatalog: false,
            ragTopSimilarity: aiAnalysis?.raw.ragTopSimilarity ?? null,
            knowledgeTopSimilarity: aiAnalysis?.raw.knowledgeTopSimilarity ?? null,
            quantityKnown: unitQuantity !== null,
          }),
        });
        bundles.push({ category: cat, taskIds: fb.taskIds, variants: fb.variants });
      }
    }

    if (bundles.length === 0) {
      throw ApiError.badRequest('Не удалось построить смету — в выбранных направлениях пока нет услуг.');
    }

    const primary = bundles[0].category;

    // ─── Шаг 2: ценовой хинт AI распределяем по направлениям ─────────
    // Доля направления в общей смете = его вес в хинте. Раньше мульти-смета
    // считалась вообще без хинта, из-за чего один и тот же заказ стоил
    // по-разному в зависимости от того, одну категорию нашёл AI или две.
    const hint = aiAnalysis?.priceHint ?? null;
    if (hint && hint.min > 0 && hint.max >= hint.min) {
      const anchorOf = (vs: EstimateVariant[]) =>
        vs.find((v) => v.tier === 'BETTER') ?? vs[Math.floor(vs.length / 2)];
      const totalAnchor = bundles.reduce((s, b) => s + (anchorOf(b.variants)?.estimatedPrice ?? 0), 0);

      if (totalAnchor > 0) {
        for (const b of bundles) {
          const share = (anchorOf(b.variants)?.estimatedPrice ?? 0) / totalAnchor;
          if (share <= 0) continue;
          b.variants = scaleVariantsToPriceHint(b.variants, {
            min: hint.min * share,
            max: hint.max * share,
          });
        }
      }
    }

    // ─── Шаг 3: объединяем по уровням ───────────────────────────────
    const dirs = bundles.map((b) => b.category.name).join(', ');
    const merge = (tier: AiTierType): SubVariant => {
      const parts = bundles
        .map((b) => ({ bundle: b, variant: b.variants.find((v) => v.tier === tier) }))
        .filter((p): p is { bundle: CategoryBundle; variant: EstimateVariant } => !!p.variant);

      const taskIds = Array.from(new Set(parts.flatMap((p) => p.bundle.taskIds)));
      // Строки всех направлений складываются: калибровка потом разложит
      // фактическую цену по ним пропорционально их доле в смете.
      const priceLines = parts.flatMap((p) => toPriceLines(p.variant));
      const materials = parts.flatMap((p) =>
        p.variant.materials.map((m) => ({
          name: `${p.bundle.category.name}: ${m.name}`,
          quantity: m.qty,
          unit: m.unit,
          unitPrice: m.unitPrice,
          total: m.total,
        })),
      );
      const estimatedPrice = parts.reduce((sum, p) => sum + p.variant.estimatedPrice, 0);
      const estimatedDays = Math.max(1, ...parts.map((p) => p.variant.estimatedDays || 1));
      const confidence = parts.length
        ? parts.reduce((sum, p) => sum + p.variant.confidence, 0) / parts.length
        : 0.6;

      // Уровни отличаются классом исполнения, а не набором направлений:
      // объём работ во всех трёх одинаковый.
      const desc =
        tier === 'GOOD'
          ? `${bundles.length} ${this.pluralize(bundles.length, 'направление', 'направления', 'направлений')}: ${dirs}. Стандартные комплектующие.`
          : tier === 'BETTER'
          ? `${bundles.length} ${this.pluralize(bundles.length, 'направление', 'направления', 'направлений')}: ${dirs}. Комплектующие повышенного класса.`
          : `${bundles.length} ${this.pluralize(bundles.length, 'направление', 'направления', 'направлений')}: ${dirs}. Премиум-комплектующие и максимально тщательное исполнение.`;

      return {
        tier,
        tierLabel: TIER_MULTIPLIERS[tier].label,
        taskIds,
        materials,
        priceLines,
        estimatedPrice,
        estimatedDays,
        confidence: Math.round(confidence * 100) / 100,
        description: desc,
      };
    };

    const merged: SubVariant[] = [merge('GOOD'), merge('BETTER'), merge('BEST')];

    // ─── Сохраняем шаблоны (categoryId = primary) ────────────
    let templates;
    try {
      templates = await Promise.all(
        merged.map(async (variant) =>
          prisma.aiOrderTemplate.create({
            data: {
              categoryId: primary.id,
              tier: variant.tier as AiTierType,
              tierLabel: variant.tierLabel,
              taskIds: variant.taskIds,
              materials: variant.materials,
              priceLines: variant.priceLines,
              estimatedPrice: Math.min(Math.round(variant.estimatedPrice), 9_999_999_999),
              estimatedDays: variant.estimatedDays,
              confidence: variant.confidence,
              prompt: description.substring(0, 2000),
              imageAnalysis: {
                imageCount: images.length,
                description: description.substring(0, 500),
                multiCategory: true,
                categorySlugs: bundles.map((b) => b.category.slug),
              },
              description: variant.description.substring(0, 2000),
              createdById: userId,
            },
          })
        )
      );
    } catch (dbError: any) {
      logger.error({ err: dbError }, 'Ошибка сохранения мульти-AI-шаблона');
      throw ApiError.badRequest('Не удалось сохранить варианты, попробуйте ещё раз');
    }

    logger.info(
      { userId, count: bundles.length, slugs: bundles.map((b) => b.category.slug) },
      'AI-анализ: мульти-категория, сборка завершена'
    );

    const allTasks = bundles.flatMap((b) =>
      (b.category.subcategories || []).flatMap((s: any) =>
        (s.tasks || []).map((t: any) => ({
          ...t,
          categoryId: b.category.id,
          categoryName: b.category.name,
          subcategoryName: s.name,
        }))
      )
    );

    return {
      category: {
        id: primary.id,
        name: primary.name,
        nameUz: primary.nameUz,
        nameEn: primary.nameEn,
        slug: primary.slug,
      },
      detectedFromPhoto: true,
      detectedCategories: bundles.map((b) => ({
        id: b.category.id,
        name: b.category.name,
        slug: b.category.slug,
        nameUz: b.category.nameUz,
        nameEn: b.category.nameEn,
        icon: b.category.icon,
      })),
      variants: templates.map((t: any) => ({
        id: t.id,
        tier: t.tier,
        tierLabel: t.tierLabel,
        taskIds: t.taskIds,
        materials: t.materials,
        estimatedPrice: t.estimatedPrice,
        estimatedDays: t.estimatedDays,
        confidence: t.confidence,
        description: t.description,
      })),
      allTasks: allTasks.map((t: any) => ({
        id: t.id,
        name: t.name,
        nameUz: t.nameUz,
        nameEn: t.nameEn,
        minPrice: t.minPrice,
        estimatedTime: t.estimatedTime,
        categoryId: t.categoryId,
        categoryName: t.categoryName,
        subcategoryName: t.subcategoryName,
      })),
    };
  }


  /**
   * Определение ОДНОЙ категории — обёртка над detectCategories для обратной совместимости.
   */
  private detectCategory(description: string, categories: any[]): any | null {
    const list = this.detectCategories(description, categories);
    return list[0] || null;
  }

  /**
   * Определение ВСЕХ направлений работ, упомянутых в описании.
   * Возвращает массив категорий, отсортированный по убыванию score (≥ 1).
   *
   * Это позволяет поддержать сценарий, когда пользователь перечисляет
   * несколько проблем сразу: «сантехника, электрика, окно, мебель» → 4 категории.
   */
  private detectCategories(description: string, categories: any[]): any[] {
    const lower = description.toLowerCase();

    const keywords: Record<string, { exact: string[]; partial: string[] }> = {
      'plumbing': {
        exact: ['сантехник', 'сантехника', 'водопровод', 'канализация', 'унитаз', 'раковина', 'ванна', 'душевая', 'бойлер', 'радиатор', 'отопление', 'счётчик воды', 'фильтр воды', 'биде', 'джакузи', 'сифон', 'стиральная', 'посудомоечная'],
        partial: ['труб', 'кран', 'течь', 'течёт', 'потекл', 'протечк', 'засор', 'смесител', 'слив', 'водонагреват', 'тёплый пол', 'промывк', 'прочист'],
      },
      'electrical': {
        exact: ['электрик', 'электрика', 'проводка', 'розетка', 'выключатель', 'люстра', 'светильник', 'щиток', 'автомат', 'диммер', 'led', 'датчик движения'],
        partial: ['розетк', 'выключател', 'провод', 'свет', 'люстр', 'замыкан', 'счётчик', 'электр', 'ламп', 'точечн', 'кабель', 'подсветк', 'короткое', 'пробк', 'вырубил', 'пропал свет', 'не горит', 'не работает розетк'],
      },
      'furniture': {
        exact: ['мебель', 'мебельщик', 'шкаф', 'кухня', 'диван', 'кровать', 'комод', 'полка', 'стеллаж', 'тумба', 'гардероб'],
        partial: ['мебел', 'мебельщ', 'шкаф', 'стол', 'стул', 'кухн', 'полк', 'сборк', 'диван', 'кроват', 'ящик', 'фурнитур', 'петл', 'дверц', 'фасад'],
      },
      'construction': {
        exact: ['кладка', 'фундамент', 'стяжка', 'перегородка', 'газоблок', 'кирпич', 'бетон', 'арматура', 'опалубка', 'ремонт квартиры', 'ремонт дома', 'капитальный ремонт', 'косметический ремонт'],
        partial: ['стройк', 'кладк', 'стен', 'фундамент', 'бетон', 'кирпич', 'перегородк', 'газоблок', 'штукатурк', 'стяжк', 'демонтаж стен', 'снос', 'капремонт', 'ремонт квартир'],
      },
      'painting': {
        exact: ['покраска', 'штукатурка', 'шпаклёвка', 'шпатлёвка', 'обои', 'грунтовка', 'отделка', 'декоративная штукатурка'],
        partial: ['покраск', 'штукатурк', 'обо', 'шпаклёвк', 'шпатлёвк', 'отделк', 'грунтовк', 'потолок', 'побелк', 'краск', 'красить', 'поклеить', 'поклейк', 'выровнять стен'],
      },
      'windows-doors': {
        exact: ['окно', 'окна', 'дверь', 'двери', 'балкон', 'стеклопакет', 'москитная сетка', 'подоконник', 'откос', 'замок', 'ручка двери'],
        partial: ['окн', 'дверь', 'двер', 'балкон', 'стеклопакет', 'замок', 'петл', 'москитн', 'подоконник', 'откос', 'остеклен', 'заклинил', 'не открывается', 'не закрывается'],
      },
      'cleaning': {
        exact: ['уборка', 'клининг', 'дезинфекция', 'химчистка', 'мойка окон', 'генеральная уборка', 'уборка после ремонта'],
        partial: ['уборк', 'клининг', 'чистк', 'мойк', 'пыл', 'дезинфекц', 'химчистк', 'помыть', 'вымыть', 'отмыть', 'грязь', 'пятн'],
      },
      'carpentry': {
        exact: ['плотник', 'паркет', 'ламинат', 'вагонка', 'деревянный пол', 'лестница', 'беседка', 'терраса'],
        partial: ['плотник', 'дерев', 'доск', 'парк', 'ламинат', 'вагонк', 'лестниц', 'пол', 'настил', 'циклёвк', 'шлифовк'],
      },
      'roofing': {
        exact: ['крыша', 'кровля', 'кровельщик', 'кровельные работы', 'шифер', 'металлочерепица', 'профнастил', 'мягкая кровля'],
        partial: ['крыш', 'кровл', 'черепиц', 'шифер', 'профнастил', 'водосток', 'мансард', 'стропил'],
      },
      'conditioner': {
        exact: ['кондиционер', 'сплит-система', 'вентиляция', 'климат', 'фреон'],
        partial: ['кондиционер', 'сплит', 'вентиляц', 'климат', 'охлажд', 'фреон', 'дует', 'не охлаждает', 'заправк', 'холод'],
      },
      'appliances': {
        exact: ['стиральная машина', 'холодильник', 'духовка', 'плита', 'микроволновка', 'посудомоечная', 'бытовая техника'],
        partial: ['стиральн', 'холодильник', 'духовк', 'микроволнов', 'плит', 'машинк', 'техник', 'подключ'],
      },
      'garden': {
        exact: ['газон', 'ландшафт', 'ландшафтный дизайн', 'полив', 'забор', 'ворота', 'навес', 'беседка', 'сад', 'огород'],
        partial: ['газон', 'ландшафт', 'полив', 'забор', 'ворот', 'навес', 'садов', 'участ', 'террас', 'дренаж', 'озеленен'],
      },
      'earthworks': {
        exact: ['экскаватор', 'земляные работы', 'котлован', 'траншея', 'выемка грунта', 'погрузчик', 'бульдозер', 'самосвал'],
        partial: ['экскаватор', 'котлован', 'траншея', 'грунт', 'выемк', 'засыпк', 'планировк участка', 'спецтехник'],
      },
      'security': {
        exact: ['видеонаблюдение', 'домофон', 'сигнализация', 'камера', 'охрана', 'контроль доступа'],
        partial: ['видеонаблюд', 'домофон', 'сигнализац', 'камер', 'охран', 'контроль доступ', 'ip камер'],
      },
      'design': {
        exact: ['дизайн', 'дизайн-проект', 'интерьер', 'визуализация', '3d проект'],
        partial: ['дизайн', 'интерьер', 'визуализац', 'проект', 'планировк', '3d'],
      },
      'moving': {
        exact: ['переезд', 'грузчики', 'доставка мебели', 'транспортировка'],
        partial: ['переезд', 'грузчик', 'перевоз', 'перенос', 'доставк', 'погрузк'],
      },
    };

    const scored: { cat: any; score: number }[] = [];
    for (const cat of categories) {
      const cfg = keywords[cat.slug];
      if (!cfg) continue;
      let score = 0;
      for (const kw of cfg.exact) if (lower.includes(kw)) score += 3;
      for (const kw of cfg.partial) if (lower.includes(kw)) score += 1;
      if (score > 0) scored.push({ cat, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.cat);
  }

  /**
   * Подбор задач из БД-каталога, соответствующих решению из каталога расценок.
   * Используется для привязки реальных task IDs к smart-варианту.
   * 
   * Возвращает только 1 наиболее релевантную задачу (избегаем лишних).
   * Используем строгое совпадение: ищем ТОЧНЫЕ ключевые фразы, а не отдельные слова.
   */
  private matchTasksToSolution(allTasks: any[], solutionTitle: string, _solutionDesc: string): string[] {
    const title = solutionTitle.toLowerCase();
    
    // Извлекаем ключевые фразы из названия решения (целые осмысленные фразы)
    // Например: "Замена повреждённого участка трубы" → ключевая фраза "замен" + "труб"
    const keyPhrases: string[] = [];
    
    // Определяем ключевые слова-маркеры действия
    const actionWords = ['замен', 'ремонт', 'установк', 'монтаж', 'демонтаж', 'чистк', 'уборк', 'поклейк', 'покраск', 'штукатурк', 'укладк'];
    // Определяем ключевые объекты (что именно чинится)
    const objectWords = ['труб', 'кран', 'смесител', 'унитаз', 'сифон', 'канализац', 'розетк', 'выключател', 'проводк',
      'люстр', 'светильник', 'мебел', 'шкаф', 'кухн', 'дверь', 'двер', 'окн', 'стекл',
      'стен', 'потолок', 'потолк', 'пол', 'плитк', 'обо', 'ламинат',
      'стиральн', 'посудомо', 'холодильник', 'кондиционер',
      'газ', 'котёл', 'котел', 'бойлер', 'водонагреват'];
    
    // Находим какие объекты упоминаются в решении
    const matchedObjects = objectWords.filter(obj => title.includes(obj));
    
    if (matchedObjects.length === 0) {
      // Если объект не определён, используем всё название как фразу
      keyPhrases.push(title);
    } else {
      keyPhrases.push(...matchedObjects);
    }
    
    // Оцениваем задачи — но строго: задача должна содержать ТЕ ЖЕ объекты
    const scored = allTasks.map((task: any) => {
      const taskName = (task.name || '').toLowerCase();
      let score = 0;
      
      // Бонус за совпадение объектов — это ГЛАВНЫЙ критерий
      for (const phrase of keyPhrases) {
        if (taskName.includes(phrase)) score += 10;
      }
      
      // Штраф если задача содержит ДРУГИЕ объекты (не из нашего решения)
      const taskObjects = objectWords.filter(obj => taskName.includes(obj));
      for (const obj of taskObjects) {
        if (!matchedObjects.includes(obj) && matchedObjects.length > 0) {
          score -= 5; // Штраф за лишний объект — "Замена сифона" не подходит к "Замена трубы"
        }
      }
      
      return { id: task.id, name: taskName, score };
    });

    // Берём только ОДНУ лучшую задачу с положительным скором
    const best = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
    
    if (best.length > 0) {
      return [best[0].id];
    }
    
    return [];
  }

  /**
   * Резервный расчёт, когда проблема не нашлась в каталоге расценок:
   * смета собирается из задач БД, подходящих по описанию.
   *
   * Уровни отличаются КЛАССОМ исполнения, а не объёмом работ. Раньше GOOD
   * брал 1–2 задачи, а BEST — до пяти: клиенту с одной сломанной розеткой
   * в премиум-вариант докладывали работы, которых он не просил. Теперь все
   * три уровня закрывают один и тот же объём разными комплектующими.
   */
  private generateVariantsFallback(
    category: any,
    allTasks: any[],
    description: string,
    opts: {
      quantity?: number | null;
      confidence?: number;
      aiPriceHint?: { min: number; max: number } | null;
      /** Что увидел Vision — подключается, если слов клиента не хватило. */
      aiContext?: string;
    } = {},
  ): { variants: EstimateVariant[]; taskIds: string[] } {
    // Ранжируем по словам клиента; если их нет или они ничего не дали —
    // по тому, что увидел Vision. Иначе заказ по одной фотографии выбирал
    // просто самую дешёвую задачу категории.
    const matchText = description.trim() ? description : (opts.aiContext ?? '');
    const lower = matchText.toLowerCase();

    // Стемминг: обрезаем русские окончания для нечёткого поиска
    const stem = (word: string) => word.replace(/(ами|ями|ов|ев|ей|ой|ий|ый|ая|яя|ое|ее|ие|ые|ую|юю|ого|его|ому|ему|ость|ам|ям|ах|ях|ен|ан|у|ю|а|я|и|ы|о|е|ь)$/i, '');

    // ─── Ранжируем задачи по релевантности к описанию ─────
    const scored = allTasks.map((task: any) => {
      const taskName = (task.name || '').toLowerCase();
      const taskDesc = (task.description || '').toLowerCase();
      let relevance = 0;

      const descWords = lower.split(/\s+/).filter((w) => w.length > 2);
      for (const word of descWords) {
        const s = stem(word);
        if (s.length >= 3 && taskName.includes(s)) relevance += 3;
        if (s.length >= 3 && taskDesc.includes(s)) relevance += 1;
      }
      const taskWords = taskName.split(/\s+/).filter((w: string) => w.length > 3);
      for (const word of taskWords) {
        const s = stem(word);
        if (s.length >= 3 && lower.includes(s)) relevance += 2;
      }

      return { task, relevance, price: Number(task.minPrice) || 50000 };
    });

    scored.sort((a, b) => b.relevance - a.relevance || a.price - b.price);

    // Слова клиента ничего не выбрали — пробуем то, что увидел Vision.
    if (scored.every((s) => s.relevance === 0) && opts.aiContext && description.trim()) {
      const aiLower = opts.aiContext.toLowerCase();
      for (const entry of scored) {
        const taskName = (entry.task.name || '').toLowerCase();
        for (const word of aiLower.split(/\s+/).filter((w) => w.length > 3)) {
          const st = stem(word);
          if (st.length >= 3 && taskName.includes(st)) entry.relevance += 2;
        }
      }
      scored.sort((a, b) => b.relevance - a.relevance || a.price - b.price);
    }

    // ─── Объём работ: только то, что близко к лучшему совпадению ─────
    // Отсекаем «хвост» слабо связанных задач: они и создавали раздутый BEST.
    const relevant = scored.filter((s) => s.relevance > 0);
    const topRelevance = relevant[0]?.relevance ?? 0;
    const core = (relevant.length > 0
      ? relevant.filter((s) => s.relevance >= Math.max(1, topRelevance * 0.6))
      : scored.slice(0, 1)
    ).slice(0, FALLBACK_MAX_TASKS);

    const coreTasks = core.map((s) => s.task);

    // ─── Срок: суммарное время задач, 6 рабочих часов в дне ─────
    const calculateDays = (tasks: any[], multiplier: number) => {
      const totalHours = tasks.reduce((sum: number, t: any) => {
        const time = (t.estimatedTime || '1 час').toLowerCase();
        const hourMatch = time.match(/(\d+)(?:\s*-\s*(\d+))?\s*час/);
        const minMatch = time.match(/(\d+)(?:\s*-\s*(\d+))?\s*мин/);
        if (hourMatch) {
          const avg = hourMatch[2] ? (parseInt(hourMatch[1]) + parseInt(hourMatch[2])) / 2 : parseInt(hourMatch[1]);
          return sum + avg;
        }
        if (minMatch) {
          const avg = minMatch[2] ? (parseInt(minMatch[1]) + parseInt(minMatch[2])) / 2 : parseInt(minMatch[1]);
          return sum + avg / 60;
        }
        return sum + 1;
      }, 0);

      return Math.max(1, Math.ceil((totalHours / 6) * multiplier));
    };

    const TIER_SCOPE_NOTE: Record<AiTierType, string> = {
      GOOD: 'Стандартные комплектующие и расходники мастера.',
      BETTER: 'Комплектующие повышенного класса, аккуратная подгонка по месту.',
      BEST: 'Премиум-комплектующие и максимально тщательное исполнение.',
    };

    const buildVariant = (tier: AiTierType): EstimateVariant => {
      const mult = TIER_MULTIPLIERS[tier].price;

      // Выезд оплачивается один раз и не размножается количеством —
      // за это отвечает applyQuantity по имени строки.
      const works: PricedLine[] = [
        { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: MASTER_VISIT_FEE, total: MASTER_VISIT_FEE },
        ...coreTasks.map((t: any) => {
          const unitPrice = roundUnitPrice((Number(t.minPrice) || 50000) * mult);
          return {
            // Задачи каталога живут в реестре под кодом task.<slug> — благодаря
            // этому резервный путь тоже попадает в калибровку.
            code: t.slug ? `task.${t.slug}` : undefined,
            name: t.name as string,
            qty: 1,
            unit: 'услуга',
            unitPrice,
            total: unitPrice,
          };
        }),
      ];

      // Расходники — плоская величина на работу, а не процент от её стоимости.
      // Процент давал абсурд: крепёж «дорожал» вместе со ставкой мастера.
      // Полноценные материалы появятся вместе с прайс-реестром в БД.
      const materials: PricedLine[] = [
        {
          name: 'Расходники мастера (крепёж, герметик, изолента)',
          qty: coreTasks.length || 1,
          unit: 'работа',
          unitPrice: CONSUMABLES_PER_TASK,
          total: CONSUMABLES_PER_TASK * (coreTasks.length || 1),
        },
      ];
      const uplift = MATERIAL_CLASS_UPLIFT[tier];
      if (uplift > 0) {
        materials.push({
          name: tier === 'BEST' ? 'Комплектующие премиум-класса' : 'Комплектующие повышенного класса',
          qty: 1,
          unit: 'компл.',
          unitPrice: uplift,
          total: uplift,
        });
      }

      const estimatedPrice =
        works.reduce((s, w) => s + w.total, 0) + materials.reduce((s, m) => s + m.total, 0);

      return {
        tier,
        tierLabel: TIER_MULTIPLIERS[tier].label,
        title: `${category.name}: ${coreTasks.length} ${this.pluralize(coreTasks.length, 'работа', 'работы', 'работ')}`,
        description: TIER_SCOPE_NOTE[tier],
        works,
        materials,
        estimatedPrice,
        estimatedDays: calculateDays(coreTasks, TIER_MULTIPLIERS[tier].days),
        confidence: opts.confidence ?? 0.7,
      };
    };

    let variants: EstimateVariant[] = [buildVariant('GOOD'), buildVariant('BETTER'), buildVariant('BEST')];

    // Те же правила, что и для каталожного пути: раньше fallback шёл мимо них
    // и давал другую цену на тот же заказ.
    variants = applyQuantity(variants, opts.quantity);
    variants = scaleVariantsToPriceHint(variants, opts.aiPriceHint);
    variants = dropVisitFeeOnCheapVariant(variants);

    // Минимальный чек: ниже этой суммы мастер на выезд не поедет.
    variants = variants.map((v) =>
      v.estimatedPrice >= MIN_VARIANT_PRICE ? v : { ...v, estimatedPrice: MIN_VARIANT_PRICE },
    );

    // Уровни идут строго по возрастанию цены.
    for (let i = 1; i < variants.length; i++) {
      if (variants[i].estimatedPrice <= variants[i - 1].estimatedPrice) {
        variants[i] = {
          ...variants[i],
          estimatedPrice: Math.round(variants[i - 1].estimatedPrice * 1.08),
        };
      }
    }

    return { variants, taskIds: coreTasks.map((t: any) => t.id).filter(Boolean) };
  }

  /** Склонение числительных */
  private pluralize(n: number, one: string, few: string, many: string): string {
    const abs = Math.abs(n) % 100;
    const lastDigit = abs % 10;
    if (abs > 10 && abs < 20) return many;
    if (lastDigit > 1 && lastDigit < 5) return few;
    if (lastDigit === 1) return one;
    return many;
  }
}

export const instantOrderService = new InstantOrderService();
