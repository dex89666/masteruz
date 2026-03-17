// ============================================
// MasterUz — Регионы и районы Узбекистана
// Полная карта покрытия для заказов
// ============================================

export interface Region {
  key: string;
  nameRu: string;
  nameUz: string;
  nameEn: string;
  cities: CityDistrict[];
  center: { lat: number; lng: number };
}

export interface CityDistrict {
  key: string;
  nameRu: string;
  nameUz: string;
  nameEn: string;
  districts: District[];
}

export interface District {
  key: string;
  nameRu: string;
  nameUz: string;
  nameEn: string;
}

export const UZBEKISTAN_REGIONS: Region[] = [
  {
    key: 'tashkent_region',
    nameRu: 'Ташкентская область',
    nameUz: 'Toshkent viloyati',
    nameEn: 'Tashkent Region',
    center: { lat: 41.2995, lng: 69.2401 },
    cities: [
      {
        key: 'Tashkent',
        nameRu: 'Ташкент',
        nameUz: 'Toshkent',
        nameEn: 'Tashkent',
        districts: [
          { key: 'mirzo_ulugbek', nameRu: 'Мирзо-Улугбекский', nameUz: 'Mirzo Ulug\'bek', nameEn: 'Mirzo Ulugbek' },
          { key: 'chilanzar', nameRu: 'Чиланзарский', nameUz: 'Chilonzor', nameEn: 'Chilanzar' },
          { key: 'yakkasaray', nameRu: 'Яккасарайский', nameUz: 'Yakkasaroy', nameEn: 'Yakkasaray' },
          { key: 'yunusabad', nameRu: 'Юнусабадский', nameUz: 'Yunusobod', nameEn: 'Yunusabad' },
          { key: 'sergeli', nameRu: 'Сергелийский', nameUz: 'Sergeli', nameEn: 'Sergeli' },
          { key: 'bektemir', nameRu: 'Бектемирский', nameUz: 'Bektemir', nameEn: 'Bektemir' },
          { key: 'shaykhantahur', nameRu: 'Шайхантахурский', nameUz: 'Shayxontohur', nameEn: 'Shaykhantahur' },
          { key: 'almazar', nameRu: 'Алмазарский', nameUz: 'Olmazor', nameEn: 'Almazar' },
          { key: 'uchtepa', nameRu: 'Учтепинский', nameUz: 'Uchtepa', nameEn: 'Uchtepa' },
          { key: 'mirabad', nameRu: 'Мирабадский', nameUz: 'Mirobod', nameEn: 'Mirabad' },
          { key: 'yashnabad', nameRu: 'Яшнабадский', nameUz: 'Yashnobod', nameEn: 'Yashnabad' },
          { key: 'yangihayat', nameRu: 'Янгихаятский', nameUz: 'Yangi Hayot', nameEn: 'Yangihayat' },
        ],
      },
    ],
  },
  {
    key: 'samarkand_region',
    nameRu: 'Самаркандская область',
    nameUz: 'Samarqand viloyati',
    nameEn: 'Samarkand Region',
    center: { lat: 39.6542, lng: 66.9597 },
    cities: [
      {
        key: 'Samarkand',
        nameRu: 'Самарканд',
        nameUz: 'Samarqand',
        nameEn: 'Samarkand',
        districts: [
          { key: 'samarkand_center', nameRu: 'Центральный', nameUz: 'Markaz', nameEn: 'Central' },
          { key: 'siab', nameRu: 'Сиабский', nameUz: 'Siob', nameEn: 'Siab' },
          { key: 'bagishamol', nameRu: 'Багишамальский', nameUz: 'Bog\'ishamol', nameEn: 'Bagishamol' },
        ],
      },
    ],
  },
  {
    key: 'bukhara_region',
    nameRu: 'Бухарская область',
    nameUz: 'Buxoro viloyati',
    nameEn: 'Bukhara Region',
    center: { lat: 39.7747, lng: 64.4286 },
    cities: [
      {
        key: 'Bukhara',
        nameRu: 'Бухара',
        nameUz: 'Buxoro',
        nameEn: 'Bukhara',
        districts: [
          { key: 'bukhara_center', nameRu: 'Центральный', nameUz: 'Markaz', nameEn: 'Central' },
        ],
      },
    ],
  },
  {
    key: 'namangan_region',
    nameRu: 'Наманганская область',
    nameUz: 'Namangan viloyati',
    nameEn: 'Namangan Region',
    center: { lat: 40.9983, lng: 71.6726 },
    cities: [
      {
        key: 'Namangan',
        nameRu: 'Наманган',
        nameUz: 'Namangan',
        nameEn: 'Namangan',
        districts: [
          { key: 'namangan_center', nameRu: 'Центральный', nameUz: 'Markaz', nameEn: 'Central' },
        ],
      },
    ],
  },
  {
    key: 'andijan_region',
    nameRu: 'Андижанская область',
    nameUz: 'Andijon viloyati',
    nameEn: 'Andijan Region',
    center: { lat: 40.7821, lng: 72.3442 },
    cities: [
      {
        key: 'Andijan',
        nameRu: 'Андижан',
        nameUz: 'Andijon',
        nameEn: 'Andijan',
        districts: [
          { key: 'andijan_center', nameRu: 'Центральный', nameUz: 'Markaz', nameEn: 'Central' },
        ],
      },
    ],
  },
  {
    key: 'fergana_region',
    nameRu: 'Ферганская область',
    nameUz: 'Farg\'ona viloyati',
    nameEn: 'Fergana Region',
    center: { lat: 40.3842, lng: 71.7889 },
    cities: [
      {
        key: 'Fergana',
        nameRu: 'Фергана',
        nameUz: 'Farg\'ona',
        nameEn: 'Fergana',
        districts: [
          { key: 'fergana_center', nameRu: 'Центральный', nameUz: 'Markaz', nameEn: 'Central' },
        ],
      },
    ],
  },
  {
    key: 'karakalpakstan',
    nameRu: 'Каракалпакстан',
    nameUz: 'Qoraqalpog\'iston',
    nameEn: 'Karakalpakstan',
    center: { lat: 42.4601, lng: 59.6003 },
    cities: [
      {
        key: 'Nukus',
        nameRu: 'Нукус',
        nameUz: 'Nukus',
        nameEn: 'Nukus',
        districts: [
          { key: 'nukus_center', nameRu: 'Центральный', nameUz: 'Markaz', nameEn: 'Central' },
        ],
      },
    ],
  },
  {
    key: 'kashkadarya_region',
    nameRu: 'Кашкадарьинская область',
    nameUz: 'Qashqadaryo viloyati',
    nameEn: 'Kashkadarya Region',
    center: { lat: 38.8606, lng: 65.8003 },
    cities: [
      {
        key: 'Karshi',
        nameRu: 'Карши',
        nameUz: 'Qarshi',
        nameEn: 'Karshi',
        districts: [
          { key: 'karshi_center', nameRu: 'Центральный', nameUz: 'Markaz', nameEn: 'Central' },
        ],
      },
    ],
  },
];

/**
 * Получить все города из всех регионов
 */
export function getAllCities() {
  return UZBEKISTAN_REGIONS.flatMap((r) => r.cities);
}

/**
 * Получить районы для города
 */
export function getDistrictsForCity(cityKey: string) {
  for (const region of UZBEKISTAN_REGIONS) {
    const city = region.cities.find((c) => c.key === cityKey);
    if (city) return city.districts;
  }
  return [];
}

/**
 * Получить регион по городу
 */
export function getRegionByCity(cityKey: string) {
  return UZBEKISTAN_REGIONS.find((r) => r.cities.some((c) => c.key === cityKey));
}

/**
 * Получить локализованное имя по ключу
 */
export function getLocalizedRegionName(item: { nameRu: string; nameUz: string; nameEn: string }, lang: string) {
  if (lang === 'uz') return item.nameUz;
  if (lang === 'en') return item.nameEn;
  return item.nameRu;
}
