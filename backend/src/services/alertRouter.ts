// ============================================
// MasterUz — Alert Router
// ────────────────────────────────────────────
// Централизованная маршрутизация алертов по командным ролям.
// Получатели определяются по Telegram-никнеймам из ENV
// (ROLE_OWNER_USERNAMES, ROLE_DISPATCHER_USERNAMES, …).
//
// Принцип: код шлёт *тип события*, а не «всем админам».
// alertRouter сам решает, кто из команды должен это увидеть,
// дедуплицирует получателей и не зависит от роли в БД.
// ============================================

import { prisma } from '../config/database.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { sendTelegramMessage } from '../utils/telegramBot.js';

export type TeamRole = 'OWNER' | 'DISPATCHER' | 'SUPPORT' | 'FINANCE' | 'MODERATOR';

/**
 * Карта «тип алерта → роли-получатели».
 * Один тип может уйти нескольким ролям — alertRouter уберёт дубли по userId.
 */
const ALERT_ROUTING: Record<string, TeamRole[]> = {
  // Заказы и диспетчеризация
  order_stuck_no_master:     ['DISPATCHER'],
  order_master_overdue:      ['DISPATCHER'],
  order_master_not_departed: ['DISPATCHER'],
  order_cancelled_in_transit:['DISPATCHER'],

  // Поддержка / споры
  complaint_new:             ['SUPPORT'],
  dispute_escalated:         ['SUPPORT'],
  support_ticket_new:        ['SUPPORT'],

  // Финансы
  payment_failed:            ['FINANCE'],
  refund_large:              ['FINANCE'],
  chargeback_received:       ['FINANCE'],
  subscription_purchased:    ['FINANCE'],

  // Модерация
  chat_message_flagged:      ['MODERATOR'],
  photo_violation:           ['MODERATOR'],
  forum_report:              ['MODERATOR'],

  // Системные / владельцы
  ai_provider_issue:         ['OWNER'],
  redis_unavailable:         ['OWNER'],
  db_error:                  ['OWNER'],
  backup_failed:             ['OWNER'],
};

export type AlertType = keyof typeof ALERT_ROUTING;

interface AlertPayload {
  type: AlertType | string;
  title: string;
  message: string;
  data?: Record<string, unknown> | unknown;
  /** Принудительные роли — игнорирует карту маршрутизации. */
  forceRoles?: TeamRole[];
}

class AlertRouter {
  /** Получить уникальный список Telegram-никнеймов для набора ролей. */
  private usernamesForRoles(roles: TeamRole[]): string[] {
    const set = new Set<string>();
    for (const role of roles) {
      const list = this.usernamesForRole(role);
      for (const u of list) set.add(u);
    }
    return [...set];
  }

  private usernamesForRole(role: TeamRole): string[] {
    switch (role) {
      case 'OWNER':      return config.team.owner;
      case 'DISPATCHER': return config.team.dispatcher;
      case 'SUPPORT':    return config.team.support;
      case 'FINANCE':    return config.team.finance;
      case 'MODERATOR':  return config.team.moderator;
    }
  }

  /**
   * Отправить алерт. Создаёт in-app уведомление + Telegram push
   * каждому пользователю из настроенных ролей.
   * Никогда не падает — все ошибки логируются.
   */
  async dispatch(payload: AlertPayload): Promise<{ sent: number }> {
    const roles = payload.forceRoles ?? ALERT_ROUTING[payload.type] ?? [];
    if (roles.length === 0) {
      logger.warn({ type: payload.type }, 'alertRouter: тип алерта не имеет маршрута');
      return { sent: 0 };
    }

    const usernames = this.usernamesForRoles(roles);
    if (usernames.length === 0) {
      logger.warn({ type: payload.type, roles }, 'alertRouter: для ролей не задано ни одного username в ENV');
      return { sent: 0 };
    }

    // Находим зарегистрированных пользователей по username (lowercase сравнение).
    // Если человек ещё не входил в Mini App — пуш всё равно уйдёт по chat_id из БД,
    // но только если есть запись (нет username → нет chat_id, телеграм не отправится).
    const users = await prisma.user.findMany({
      where: {
        username: { in: usernames, mode: 'insensitive' },
        isActive: true,
      },
      select: { id: true, username: true, telegramId: true },
    });

    if (users.length === 0) {
      logger.warn(
        { type: payload.type, roles, usernames },
        'alertRouter: usernames из ENV не найдены среди активных пользователей',
      );
      return { sent: 0 };
    }

    let sent = 0;
    await Promise.allSettled(
      users.map(async (user) => {
        // In-app
        await prisma.notification
          .create({
            data: {
              userId: user.id,
              type: payload.type,
              title: payload.title,
              message: payload.message,
              data: (payload.data ?? undefined) as any,
            },
          })
          .catch((err) => logger.error({ err, userId: user.id, type: payload.type }, 'alertRouter: createNotification failed'));

        // Telegram push (best-effort)
        if (user.telegramId) {
          await sendTelegramMessage({
            chatId: user.telegramId,
            text: `<b>${payload.title}</b>\n\n${payload.message}`,
          }).catch(() => {});
        }
        sent++;
      }),
    );

    logger.info(
      { type: payload.type, roles, recipients: users.length },
      'alertRouter: алерт разослан',
    );
    return { sent };
  }
}

export const alertRouter = new AlertRouter();
