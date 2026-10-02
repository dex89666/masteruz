// ============================================
// MasterUz — Hamkorbank: динамический QR (UzQR)
// Интернет-эквайринг Hamkorbank, единая платёжная система UzQR.
//
// Пока это MOCK: запрос к банку собирается, но не отправляется — вместо ответа
// банка возвращается заглушка. Формат запроса/ответа, адрес API и единицы суммы
// уточнить по документации Hamkorbank и заменить в местах с пометкой «СПЕЦИФИКАЦИЯ».
// ============================================

import crypto from 'crypto';
import { config } from '../../../config/index.js';
import { ApiError } from '../../../utils/ApiError.js';
import { logger } from '../../../utils/logger.js';

export interface CreateDynamicQrParams {
  /** Сумма в сумах (целое, > 0). */
  amount: number;
  /** ID заказа в MasterUz — вернётся в вебхуке банка. */
  orderId: string;
}

export interface DynamicQrResult {
  /** ID QR-кода/счёта на стороне банка — по нему сверяется вебхук. */
  qrId: string;
  /** Содержимое QR (строка UzQR), которую фронт рисует как QR-код. */
  qrPayload: string;
  /** Когда QR перестаёт приниматься к оплате. */
  expiresAt: string;
  mock: boolean;
}

/** Тело запроса в банк на создание динамического QR. */
export interface HamkorCreateQrRequest {
  merchant_id: string;
  terminal_id: string;
  order_id: string;
  /** СПЕЦИФИКАЦИЯ: предполагаем сумму в тийинах (сум × 100) — уточнить у банка. */
  amount: number;
  currency: 'UZS';
  /** Время жизни QR, секунд. */
  ttl: number;
  description: string;
}

const MAX_AMOUNT_SUM = 100_000_000; // 100 млн сум — защита от опечаток в сумме

export function buildCreateQrRequest(params: CreateDynamicQrParams): HamkorCreateQrRequest {
  const { amount, orderId } = params;
  if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT_SUM) {
    throw ApiError.badRequest('Сумма должна быть целым числом сумов больше нуля');
  }
  if (!/^[A-Za-z0-9-]{1,64}$/.test(orderId)) {
    throw ApiError.badRequest('Некорректный order_id');
  }
  return {
    merchant_id: config.hamkor.merchantId,
    terminal_id: config.hamkor.terminalId,
    order_id: orderId,
    amount: amount * 100,
    currency: 'UZS',
    ttl: config.hamkor.qrTtlSeconds,
    description: `MasterUz, заказ ${orderId}`,
  };
}

/**
 * Создаёт динамический QR-код на оплату заказа.
 * В mock-режиме (HAMKOR_MOCK не равен "false") в банк ничего не уходит.
 */
export async function createDynamicQr(params: CreateDynamicQrParams): Promise<DynamicQrResult> {
  const request = buildCreateQrRequest(params);

  if (config.hamkor.mock) {
    const qrId = `mock-${crypto.randomUUID()}`;
    logger.info({ orderId: request.order_id, amount: params.amount, qrId }, 'hamkor: mock — динамический QR');
    return {
      qrId,
      qrPayload: `UZQR-MOCK|${request.merchant_id || 'MERCHANT'}|${request.order_id}|${request.amount}`,
      expiresAt: new Date(Date.now() + request.ttl * 1000).toISOString(),
      mock: true,
    };
  }

  // СПЕЦИФИКАЦИЯ: здесь будет запрос к API банка:
  //   POST {HAMKOR_API_URL}/<метод создания QR>, авторизация по HAMKOR_API_KEY,
  //   тело — request, таймаут 10 с, разбор ответа в DynamicQrResult.
  // До получения документации боевой режим не включаем.
  throw ApiError.internal('Оплата через Hamkorbank ещё не подключена');
}
