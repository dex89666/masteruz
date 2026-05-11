import { getConfigBool, PLATFORM_CONFIG_KEYS } from '../services/platformConfigService';

/**
 * Маскирует телефон до формы +998 ** *** ** 12.
 * Используется как переходная мера до подключения SIP-провайдера
 * с настоящими виртуальными номерами.
 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  const last2 = digits.slice(-2);
  // Сохраняем код страны/оператора, если есть
  if (digits.length >= 9) {
    return `+${digits.slice(0, 3)} ** *** ** ${last2}`;
  }
  return `*** ${last2}`;
}

/**
 * Применять ли маскировку — зависит от настройки админа.
 * Кеш на запрос не нужен: вызовов мало, конфиг тонкий.
 */
export async function shouldMaskPhones(): Promise<boolean> {
  return await getConfigBool(PLATFORM_CONFIG_KEYS.virtualNumbersEnabled, false);
}
