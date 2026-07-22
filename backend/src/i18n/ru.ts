// ============================================
// MasterUz — Тексты уведомлений (русский, эталон)
// ============================================
// Плейсхолдеры вида {name} подставляются через translator().
// Telegram-тексты поддерживают HTML-разметку (<b>, <s>).

const ru = {
  common: {
    currency: 'сум',
    client: 'Клиент',
    master: 'Мастер',
    order: 'Заказ',
  },

  notify: {
    // Заказ одобрен, комиссия оплачена
    orderApproved: {
      title: '✅ Заказ одобрен — можете приступать!',
      message: 'Заказ "{title}" одобрен. Комиссия оплачена. Контакты клиента доступны в заказе.',
    },

    // Отклик мастера выбран клиентом
    responseAccepted: {
      title: '🎉 Ваш отклик выбран!',
      message: 'Клиент выбрал вас для заказа "{title}". Оплатите комиссию, чтобы получить контакты клиента.',
    },

    // Заказ авто-отменён (никто не принял за 72ч)
    // Мастер долго не находится — предлагаем клиенту вернуть деньги
    orderStaleNoMaster: {
      title: '⏳ Мастер пока не найден',
      message: 'По заказу «{title}» за {days} дн. не откликнулся ни один мастер. Заблокировано {amount} {currency}. Вы можете подождать ещё или отменить заказ и вернуть деньги.',
      tg: '⏳ <b>Мастер пока не найден</b>\n\nПо заказу «{title}» за {days} дн. не откликнулся ни один мастер.\nЗаблокировано: <b>{amount} {currency}</b>\n\nОткройте заказ, чтобы подождать ещё или отменить и вернуть деньги.',
    },

    orderAutoCancelled: {
      title: '⏱ Заказ отменён — средства возвращены',
      message:
        'К сожалению, ни один мастер не принял ваш заказ "{title}" за 72 часа. ' +
        'Заказ автоматически отменён, {amount} {currency} возвращены на баланс.',
      tg:
        '⏱ <b>Заказ отменён</b>\n\n' +
        'Ваш заказ <b>"{title}"</b> не был принят ни одним мастером в течение 72 часов.\n' +
        'Заказ автоматически отменён, <b>{amount} {currency}</b> возвращены на ваш баланс.\n\n' +
        'Попробуйте создать заказ повторно — возможно, стоит уточнить описание или изменить сумму.',
    },

    // Мастер выехал
    masterDeparted: {
      titleToClient: '🚗 {master} выехал к вам',
      titleForMaterial: '🛒 {master} поехал за материалом',
      messageToClient: 'Прибудет примерно к {eta}.',
      messageForMaterial: 'Сначала закупит материал, затем приедет к вам. Ориентир: к {eta}.',
      etaWithinHour: 'в течение часа',
      eta90min: '90 мин',
      tg: '<b>{title}</b>\n{message}\n\nЗаказ: {order}',
    },

    // Мастеру: подтвердите выезд
    confirmDeparture: {
      title: '⏰ Подтвердите выезд по заказу',
      message:
        'Заказ «{title}» принят, но статус не обновлён. ' +
        'Нажмите «Выехал за материалом» или «Выехал к клиенту», ' +
        'чтобы клиент видел, что работа началась.',
    },

    // Опоздание мастера
    transitOverdue: {
      masterTitle: '⚠️ Вы опаздываете по заказу',
      masterMessage:
        'По заказу «{title}» вы обещали прибыть, но статус не обновлён ' +
        '(прошло уже {minutes} мин после ETA). ' +
        'Свяжитесь с клиентом или нажмите «Я приехал».',
      clientTitle: '⏳ Мастер задерживается',
      clientMessage:
        'По вашему заказу «{title}» мастер опаздывает на {minutes} мин. ' +
        'Мы напомнили ему — следите за статусом в приложении.',
    },

    // Ожидание доплаты остатка
    awaitingRemainder: {
      title: '✅ Мастер завершил работу',
      message:
        'Подтвердите завершение и выберите способ доплаты: наличными мастеру или картой ({amount} {currency}).',
      tg:
        '<b>✅ Мастер завершил работу по заказу «{title}»</b>\n\n' +
        'Остаток к доплате: <b>{amount} {currency}</b>\n' +
        'Откройте приложение и выберите способ оплаты — наличными или картой.',
    },

    // ─── Изменение цены по ходу работ ───
    priceChange: {
      pendingTitleUp: '📈 Мастер предлагает новую цену',
      pendingTitleDown: '📉 Мастер снизил стоимость',
      pendingMessage:
        '{title}: работы {oldPrice} → {newPrice} {currency}. ' +
        'Итого с выездом: {total} {currency}. Подтвердите или отклоните.',
      pendingTg:
        '<b>{title}</b>\n\n' +
        'Заказ: «{order}»\n' +
        'Работы: <s>{oldPrice}</s> → <b>{newPrice} {currency}</b>\n' +
        'Выезд: {visitFee} {currency}\n' +
        '<b>Итого: {total} {currency}</b>\n\n' +
        'Причина: {reason}\n\n' +
        'Откройте заказ, чтобы подтвердить или отклонить.',

      moderationRejectedTitle: '🚫 Модератор отклонил изменение цены',
      moderationRejectedMessage: '{title}: заявка на {amount} {currency} отклонена.',
      moderationRejectedReason: ' Причина: {note}',
      moderationRejectedTg:
        '<b>🚫 Модератор отклонил изменение цены</b>\n\n' +
        'Заказ: «{order}»\n' +
        'Заявленная сумма: {amount} {currency}\n' +
        '{noteLine}' +
        '\nРаботайте по действующей цене или свяжитесь с поддержкой.',
      moderationRejectedTgNote: 'Причина: {note}\n',

      approvedTitle: '✅ Клиент подтвердил новую цену',
      approvedSettlementTitle: '✅ Клиент подтвердил расчёт',
      approvedMessage: '{title}: сумма {total} {currency} (вкл. выезд) подтверждена.',

      rejectedTitle: '❌ Клиент отклонил новую цену',
      rejectedSettlementTitle: '⚠️ Клиент не согласен с расчётом',
      rejectedMessage:
        '{title}: работайте по прежней цене либо укажите фактически выполненный объём.',
      rejectedSettlementMessage: '{title}: открыт спор — решение примет администратор.',

      respondedTgApproved: 'Итого: <b>{total} {currency}</b> (вкл. выезд {visitFee} {currency})',
      respondedTgSettlementRejected: 'Администратор рассмотрит спор и определит итоговую сумму.',
      respondedTgRejected:
        'Вы можете продолжить по прежней цене или заявить фактически выполненный объём — ' +
        'выезд {visitFee} {currency} оплачивается в любом случае.',
      respondedTg: '<b>{title}</b>\n\nЗаказ: «{order}»\n{body}',
    },

    // ─── Telegram-шаблоны (telegramBot.ts) ───
    tg: {
      notSpecified: 'Не указан',
      tasksNotSpecified: '  Не указаны',
      urgentBadge: '🚨 СРОЧНЫЙ ЗАКАЗ',
      urgentPrefix: '🚨 СРОЧНЫЙ ',
      urgentSurcharge: '⚡ <i>Включена надбавка за срочность (+40%)</i>',
      openOrder: '📋 Открыть заказ',
      confirmRequest: '✅ Подтвердить заявку',
      viewOrder: '📋 Посмотреть заказ',
      orderApproved:
        '✅ <b>Заказ одобрен! Можете приступать</b>\n{urgent}\n\n' +
        '📋 <b>{title}</b>\n\n' +
        '💰 <b>Стоимость:</b> {price} {currency}\n{surcharge}\n\n' +
        '🔧 <b>Что нужно сделать:</b>\n{tasks}\n\n' +
        '📍 <b>Адрес:</b> {address}\n\n' +
        '📞 <b>Телефон клиента:</b> {phone}\n' +
        '👤 <b>Клиент:</b> {clientName}\n\n' +
        '🔗 Открыть заказ',
      newOrder:
        '🆕 <b>{urgent}Новый заказ в вашем районе!</b>\n\n' +
        '📋 <b>{title}</b>\n' +
        '🏷 <b>Категория:</b> {category}\n' +
        '💰 <b>Бюджет:</b> {price} {currency}\n' +
        '📍 <b>Местоположение:</b> {location}{distance}\n\n' +
        '👉 Нажмите кнопку ниже, чтобы подтвердить заявку',
      newOrderDistance: '\n📏 <b>Расстояние:</b> {km} км от вас',
      responseAccepted:
        '🎉 <b>Ваш отклик выбран!</b>\n\n' +
        '📋 <b>{title}</b>\n' +
        '💰 <b>Стоимость:</b> {price} {currency}\n\n' +
        'Оплатите комиссию платформы, чтобы получить контакты клиента и приступить к работе.',
    },
  },
} as const;

export type NotificationKeys = typeof ru;
export default ru;
