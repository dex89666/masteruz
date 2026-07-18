// ============================================
// MasterUz — Bildirishnoma matnlari (o‘zbekcha)
// ============================================

const uz = {
  common: {
    currency: 'so‘m',
    client: 'Mijoz',
    master: 'Usta',
    order: 'Buyurtma',
  },

  notify: {
    orderApproved: {
      title: '✅ Buyurtma tasdiqlandi — ishni boshlashingiz mumkin!',
      message: '"{title}" buyurtmasi tasdiqlandi. Komissiya to‘langan. Mijoz kontaktlari buyurtmada mavjud.',
    },

    responseAccepted: {
      title: '🎉 Sizning taklifingiz tanlandi!',
      message: 'Mijoz "{title}" buyurtmasi uchun sizni tanladi. Mijoz kontaktlarini olish uchun komissiyani to‘lang.',
    },

    orderAutoCancelled: {
      title: '⏱ Buyurtma bekor qilindi — mablag‘ qaytarildi',
      message:
        'Afsuski, "{title}" buyurtmangizni 72 soat ichida birorta usta qabul qilmadi. ' +
        'Buyurtma avtomatik bekor qilindi, {amount} {currency} balansingizga qaytarildi.',
      tg:
        '⏱ <b>Buyurtma bekor qilindi</b>\n\n' +
        '<b>"{title}"</b> buyurtmangizni 72 soat ichida birorta usta qabul qilmadi.\n' +
        'Buyurtma avtomatik bekor qilindi, <b>{amount} {currency}</b> balansingizga qaytarildi.\n\n' +
        'Buyurtmani qayta yaratib ko‘ring — tavsifni aniqlashtirish yoki summani o‘zgartirish kerak bo‘lishi mumkin.',
    },

    masterDeparted: {
      titleToClient: '🚗 {master} sizga yo‘lga chiqdi',
      titleForMaterial: '🛒 {master} material olib kelish uchun chiqdi',
      messageToClient: 'Taxminan {eta} ga yetib keladi.',
      messageForMaterial: 'Avval material sotib oladi, keyin sizga keladi. Taxminan: {eta} ga.',
      etaWithinHour: 'bir soat ichida',
      eta90min: '90 daqiqa',
      tg: '<b>{title}</b>\n{message}\n\nBuyurtma: {order}',
    },

    confirmDeparture: {
      title: '⏰ Buyurtma bo‘yicha chiqqaningizni tasdiqlang',
      message:
        '«{title}» buyurtmasi qabul qilindi, lekin holat yangilanmadi. ' +
        '«Material uchun chiqdim» yoki «Mijozga chiqdim» tugmasini bosing — ' +
        'shunda mijoz ish boshlanganini ko‘radi.',
    },

    transitOverdue: {
      masterTitle: '⚠️ Siz buyurtma bo‘yicha kechikyapsiz',
      masterMessage:
        '«{title}» buyurtmasi bo‘yicha yetib kelishga va’da bergansiz, lekin holat yangilanmadi ' +
        '(ETA dan keyin {minutes} daqiqa o‘tdi). ' +
        'Mijoz bilan bog‘laning yoki «Yetib keldim» tugmasini bosing.',
      clientTitle: '⏳ Usta kechikmoqda',
      clientMessage:
        '«{title}» buyurtmangiz bo‘yicha usta {minutes} daqiqaga kechikmoqda. ' +
        'Biz unga eslatdik — ilovada holatni kuzatib boring.',
    },

    awaitingRemainder: {
      title: '✅ Usta ishni yakunladi',
      message:
        'Yakunlanishini tasdiqlang va to‘lov usulini tanlang: ustaga naqd yoki karta orqali ({amount} {currency}).',
      tg:
        '<b>✅ Usta «{title}» buyurtmasi bo‘yicha ishni yakunladi</b>\n\n' +
        'To‘lanadigan qoldiq: <b>{amount} {currency}</b>\n' +
        'Ilovani oching va to‘lov usulini tanlang — naqd yoki karta.',
    },

    priceChange: {
      pendingTitleUp: '📈 Usta yangi narx taklif qilmoqda',
      pendingTitleDown: '📉 Usta narxni pasaytirdi',
      pendingMessage:
        '{title}: ishlar {oldPrice} → {newPrice} {currency}. ' +
        'Chiqish bilan jami: {total} {currency}. Tasdiqlang yoki rad eting.',
      pendingTg:
        '<b>{title}</b>\n\n' +
        'Buyurtma: «{order}»\n' +
        'Ishlar: <s>{oldPrice}</s> → <b>{newPrice} {currency}</b>\n' +
        'Chiqish: {visitFee} {currency}\n' +
        '<b>Jami: {total} {currency}</b>\n\n' +
        'Sabab: {reason}\n\n' +
        'Tasdiqlash yoki rad etish uchun buyurtmani oching.',

      moderationRejectedTitle: '🚫 Moderator narx o‘zgarishini rad etdi',
      moderationRejectedMessage: '{title}: {amount} {currency} miqdoridagi ariza rad etildi.',
      moderationRejectedReason: ' Sabab: {note}',
      moderationRejectedTg:
        '<b>🚫 Moderator narx o‘zgarishini rad etdi</b>\n\n' +
        'Buyurtma: «{order}»\n' +
        'Talab qilingan summa: {amount} {currency}\n' +
        '{noteLine}' +
        '\nAmaldagi narx bo‘yicha ishlang yoki qo‘llab-quvvatlash xizmatiga murojaat qiling.',
      moderationRejectedTgNote: 'Sabab: {note}\n',

      approvedTitle: '✅ Mijoz yangi narxni tasdiqladi',
      approvedSettlementTitle: '✅ Mijoz hisob-kitobni tasdiqladi',
      approvedMessage: '{title}: {total} {currency} summa (chiqish bilan) tasdiqlandi.',

      rejectedTitle: '❌ Mijoz yangi narxni rad etdi',
      rejectedSettlementTitle: '⚠️ Mijoz hisob-kitob bilan rozi emas',
      rejectedMessage:
        '{title}: avvalgi narx bo‘yicha ishlang yoki haqiqatda bajarilgan hajmni ko‘rsating.',
      rejectedSettlementMessage: '{title}: nizo ochildi — qarorni administrator qabul qiladi.',

      respondedTgApproved: 'Jami: <b>{total} {currency}</b> (chiqish {visitFee} {currency} bilan)',
      respondedTgSettlementRejected: 'Administrator nizoni ko‘rib chiqadi va yakuniy summani belgilaydi.',
      respondedTgRejected:
        'Avvalgi narx bo‘yicha davom etishingiz yoki haqiqatda bajarilgan hajmni ko‘rsatishingiz mumkin — ' +
        'chiqish {visitFee} {currency} har qanday holatda to‘lanadi.',
      respondedTg: '<b>{title}</b>\n\nBuyurtma: «{order}»\n{body}',
    },

    // ─── Telegram shablonlari ───
    tg: {
      notSpecified: 'Ko‘rsatilmagan',
      tasksNotSpecified: '  Ko‘rsatilmagan',
      urgentBadge: '🚨 SHOSHILINCH BUYURTMA',
      urgentPrefix: '🚨 SHOSHILINCH ',
      urgentSurcharge: '⚡ <i>Shoshilinchlik uchun ustama qo‘shilgan (+40%)</i>',
      openOrder: '📋 Buyurtmani ochish',
      confirmRequest: '✅ Arizani tasdiqlash',
      viewOrder: '📋 Buyurtmani ko‘rish',
      orderApproved:
        '✅ <b>Buyurtma tasdiqlandi! Ishni boshlashingiz mumkin</b>\n{urgent}\n\n' +
        '📋 <b>{title}</b>\n\n' +
        '💰 <b>Narxi:</b> {price} {currency}\n{surcharge}\n\n' +
        '🔧 <b>Nima qilish kerak:</b>\n{tasks}\n\n' +
        '📍 <b>Manzil:</b> {address}\n\n' +
        '📞 <b>Mijoz telefoni:</b> {phone}\n' +
        '👤 <b>Mijoz:</b> {clientName}\n\n' +
        '🔗 Buyurtmani ochish',
      newOrder:
        '🆕 <b>{urgent}Sizning hududingizda yangi buyurtma!</b>\n\n' +
        '📋 <b>{title}</b>\n' +
        '🏷 <b>Kategoriya:</b> {category}\n' +
        '💰 <b>Byudjet:</b> {price} {currency}\n' +
        '📍 <b>Joylashuv:</b> {location}{distance}\n\n' +
        '👉 Arizani tasdiqlash uchun quyidagi tugmani bosing',
      newOrderDistance: '\n📏 <b>Masofa:</b> sizdan {km} km',
      responseAccepted:
        '🎉 <b>Sizning taklifingiz tanlandi!</b>\n\n' +
        '📋 <b>{title}</b>\n' +
        '💰 <b>Narxi:</b> {price} {currency}\n\n' +
        'Mijoz kontaktlarini olish va ishni boshlash uchun platforma komissiyasini to‘lang.',
    },
  },
} as const;

export default uz;
