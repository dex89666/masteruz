// ============================================
// MasterUz — Reverse Geocoding
// Преобразование координат → город / район / улица / дом
// Использует Nominatim (OpenStreetMap) — бесплатно, без API-ключа.
// ============================================

import { UZBEKISTAN_REGIONS } from '../data/regions';

export interface ReverseGeocodeResult {
  cityKey?: string;
  districtKey?: string;
  street?: string;
  houseNumber?: string;
  rawCity?: string;
  rawDistrict?: string;
  displayName?: string;
}

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  footway?: string;
  cycleway?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  district?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  country?: string;
}

interface NominatimResponse {
  display_name?: string;
  address?: NominatimAddress;
}

/**
 * Сопоставить название города (на любом языке) с внутренним ключом.
 */
function matchCityKey(rawCity?: string): string | undefined {
  if (!rawCity) return undefined;
  const needle = rawCity.trim().toLowerCase();
  for (const region of UZBEKISTAN_REGIONS) {
    for (const city of region.cities) {
      const candidates = [city.key, city.nameRu, city.nameUz, city.nameEn]
        .map((s) => s.toLowerCase());
      if (candidates.some((c) => c === needle || needle.includes(c) || c.includes(needle))) {
        return city.key;
      }
    }
  }
  return undefined;
}

/**
 * Сопоставить название района с внутренним ключом для конкретного города.
 */
function matchDistrictKey(cityKey?: string, rawDistrict?: string): string | undefined {
  if (!cityKey || !rawDistrict) return undefined;
  const needle = rawDistrict.trim().toLowerCase();
  for (const region of UZBEKISTAN_REGIONS) {
    const city = region.cities.find((c) => c.key === cityKey);
    if (!city) continue;
    for (const d of city.districts) {
      const candidates = [d.key, d.nameRu, d.nameUz, d.nameEn].map((s) => s.toLowerCase());
      if (candidates.some((c) => c === needle || needle.includes(c) || c.includes(needle))) {
        return d.key;
      }
    }
  }
  return undefined;
}

/**
 * Обратное геокодирование через Nominatim.
 * Возвращает структурированный адрес или null при ошибке.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  language = 'ru',
): Promise<ReverseGeocodeResult | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', language);
    url.searchParams.set('zoom', '18');

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;

    const data: NominatimResponse = await res.json();
    const addr = data.address ?? {};

    const rawCity = addr.city ?? addr.town ?? addr.village ?? undefined;
    const rawDistrict = addr.city_district ?? addr.district ?? addr.suburb ?? addr.neighbourhood;
    const street = addr.road ?? addr.pedestrian ?? addr.footway ?? addr.cycleway;

    const cityKey = matchCityKey(rawCity);
    const districtKey = matchDistrictKey(cityKey, rawDistrict);

    return {
      cityKey,
      districtKey,
      street: street || undefined,
      houseNumber: addr.house_number || undefined,
      rawCity,
      rawDistrict,
      displayName: data.display_name,
    };
  } catch {
    return null;
  }
}
