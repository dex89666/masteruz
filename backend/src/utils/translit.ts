// ============================================
// MasterUz — транслитерация для поиска
// Имя в профиле приходит из Telegram как есть: «Марина» или «Marina».
// Поиск должен находить человека в любом написании, поэтому для слова
// строим несколько вариантов: кириллица ↔ латиница по распространённым
// схемам (русский паспортный/бытовой и узбекская латиница).
// ============================================

type Scheme = Record<string, string>;

// Общая часть для всех схем кириллица → латиница
const BASE: Scheme = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', з: 'z', и: 'i',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e',
  ю: 'yu', я: 'ya',
  // узбекские буквы кириллицы
  ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};

// Схемы отличаются спорными буквами
const CYR_TO_LAT_SCHEMES: Scheme[] = [
  // русская бытовая / паспортная: Khasanov, Zhanna, Yuliya
  { ...BASE, х: 'kh', ж: 'zh', й: 'y', ц: 'ts' },
  // упрощённая: Hasanov, Janna, Iuliia-подобные
  { ...BASE, х: 'h', ж: 'j', й: 'i', ц: 'c', ю: 'iu', я: 'ia' },
  // узбекская латиница: Xasanov, Jasur, Yo'ldosh
  { ...BASE, х: 'x', ж: 'j', й: 'y', ц: 's', ў: "o'", ғ: "g'" },
];

// Латиница → кириллица: сначала диграфы, потом одиночные буквы
const LAT_TO_CYR_MULTI: [string, string][] = [
  ['shch', 'щ'], ['sch', 'щ'], ['yo', 'ё'], ['yu', 'ю'], ['ya', 'я'], ['ye', 'е'],
  ['zh', 'ж'], ['kh', 'х'], ['ch', 'ч'], ['sh', 'ш'], ['ts', 'ц'],
  ["o'", 'ў'], ["g'", 'ғ'], ['iu', 'ю'], ['ia', 'я'],
];
const LAT_TO_CYR_SINGLE: Scheme = {
  a: 'а', b: 'б', c: 'ц', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и',
  j: 'ж', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'к', r: 'р',
  s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'х', y: 'й', z: 'з',
};

const CYR_RE = /[а-яёўқғҳ]/i;
const LAT_RE = /[a-z]/i;

function cyrToLat(word: string, scheme: Scheme): string {
  let out = '';
  for (const ch of word.toLowerCase()) out += scheme[ch] ?? ch;
  return out;
}

function latToCyr(word: string, yAsVowel: boolean): string {
  const s = word.toLowerCase().replace(/[ʻʼ`’]/g, "'");
  let out = '';
  for (let i = 0; i < s.length; ) {
    const multi = LAT_TO_CYR_MULTI.find(([lat]) => s.startsWith(lat, i));
    if (multi) {
      out += multi[1];
      i += multi[0].length;
      continue;
    }
    const ch = s[i];
    // Второй вариант: «y» после согласной читаем как «ы» (Ryzhov → Рыжов)
    if (ch === 'y' && yAsVowel && i > 0 && !/[aeiouy]/.test(s[i - 1])) out += 'ы';
    else out += LAT_TO_CYR_SINGLE[ch] ?? ch;
    i += 1;
  }
  return out;
}

/**
 * Варианты написания слова для поиска (включая исходное), без дублей.
 * «Марина» → [марина, marina]; «Marina» → [marina, марина];
 * «Хасан» → [хасан, khasan, hasan, xasan].
 */
export function searchVariants(word: string): string[] {
  const w = word.trim().toLowerCase();
  if (!w) return [];
  const variants = new Set<string>([w]);
  if (CYR_RE.test(w)) {
    for (const scheme of CYR_TO_LAT_SCHEMES) variants.add(cyrToLat(w, scheme));
  }
  if (LAT_RE.test(w) && !CYR_RE.test(w)) {
    variants.add(latToCyr(w, false));
    variants.add(latToCyr(w, true));
  }
  return [...variants].filter(Boolean).slice(0, 6);
}
