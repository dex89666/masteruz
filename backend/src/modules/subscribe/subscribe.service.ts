import { config } from '../../config/index';
import { logger } from '../../utils/logger';
import { ApiError } from '../../utils/ApiError';
import { SUBSCRIBE_ALLOWED_METHODS } from './subscribe.schema';

/**
 * Прокси к Payme Subscribe API (Cards + Receipts).
 *
 * Реальные методы протокола Payme (developer.help.paycom.uz/metody-subscribe-api):
 * - cards.create          → создать токен карты { card: { number, expire }, save }
 * - cards.get_verify_code → отправить SMS-код на номер владельца карты { token }
 * - cards.verify          → подтвердить карту SMS-кодом { token, code }
 * - cards.check           → проверить состояние токена { token }
 * - cards.remove          → удалить токен { token }
 * - receipts.create       → создать чек { amount, account, detail }
 * - receipts.pay          → оплатить чек привязанной картой { id, token }
 *
 * ВАЖНО: Payme Subscribe API НЕ принимает CVV. Карта подтверждается по SMS.
 * `expire` — строка формата "MMYY" (например, "0399").
 */
export class SubscribeService {
  async rpcForward(method: string, params: any) {
    if (!(SUBSCRIBE_ALLOWED_METHODS as readonly string[]).includes(method)) {
      throw ApiError.badRequest('Method not allowed');
    }

    const merchantId = config.payme.useSandbox ? (config.payme.sandboxMerchantId || config.payme.merchantId) : config.payme.merchantId;
    const merchantKey = config.payme.useSandbox ? (config.payme.sandboxMerchantKey || config.payme.merchantKey) : config.payme.merchantKey;

    if (!merchantId || !merchantKey) {
      logger.warn({ method }, 'Payme subscribe: missing credentials');
      throw ApiError.internal('Payme credentials are not configured');
    }

    const baseUrl = config.payme.useSandbox ? 'https://checkout.test.paycom.uz/api' : 'https://checkout.paycom.uz/api';

    const body = {
      id: Date.now(),
      method,
      params,
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const _fetch = (globalThis as any).fetch as (u: string, init?: any) => Promise<{ ok: boolean; json: () => Promise<any>; text?: () => Promise<string> }>;
      const res = await _fetch(baseUrl, {
        method: 'POST',
        headers: {
          'X-Auth': `${merchantId}:${merchantKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = res.text ? await res.text() : '<no body>';
        logger.warn({ method, status: res.ok, text }, 'Payme subscribe: non-OK response');
        throw ApiError.internal('Payme returned non-OK response');
      }

      const json = await res.json();
      if (json?.error) {
        logger.warn({ method, error: json.error }, 'Payme subscribe returned error');
        // Пробрасываем ошибку провайдера клиенту как 400
        throw ApiError.badRequest(json.error);
      }

      return json;
    } catch (err: any) {
      logger.error({ err, method }, 'Payme subscribe.rpcForward failed');
      if (err?.statusCode) throw err;
      throw ApiError.internal('Failed to call Payme Subscribe API');
    }
  }

  /**
   * Создаёт токен карты (cards.create).
   * @param number  16 цифр PAN
   * @param expire  срок действия в формате "MMYY" (например, "0399")
   * @param save    сохранять ли токен для повторного использования
   * Возвращает токен, требующий подтверждения по SMS (verify:false).
   */
  async createCard(params: { number: string; expire: string; save?: boolean }) {
    return this.rpcForward('cards.create', {
      card: { number: params.number, expire: params.expire },
      save: params.save ?? true,
    });
  }

  /** Отправляет SMS-код на номер владельца карты (cards.get_verify_code). */
  async getVerifyCode(token: string) {
    return this.rpcForward('cards.get_verify_code', { token });
  }

  /** Подтверждает карту SMS-кодом (cards.verify). */
  async verifyCard(token: string, code: string) {
    return this.rpcForward('cards.verify', { token, code });
  }

  /** Проверяет состояние токена карты (cards.check). */
  async checkCard(token: string) {
    return this.rpcForward('cards.check', { token });
  }

  /** Удаляет токен карты (cards.remove). */
  async removeCard(token: string) {
    return this.rpcForward('cards.remove', { token });
  }

  /**
   * Создаёт чек (receipts.create).
   * @param amount   сумма в тийинах
   * @param account  реквизиты заказа, например { order_id }
   * @param detail   фискальные данные (receipt_type, items)
   */
  async createReceipt(params: { amount: number; account: Record<string, any>; detail?: any }) {
    return this.rpcForward('receipts.create', params);
  }

  /** Оплачивает чек привязанной картой (receipts.pay). */
  async payReceipt(receiptId: string, token: string) {
    return this.rpcForward('receipts.pay', { id: receiptId, token });
  }
}

export const subscribeService = new SubscribeService();
