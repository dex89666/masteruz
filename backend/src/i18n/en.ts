// ============================================
// MasterUz — Notification texts (English)
// ============================================

const en = {
  common: {
    currency: 'UZS',
    client: 'Client',
    master: 'Master',
    order: 'Order',
  },

  notify: {
    orderApproved: {
      title: '✅ Order approved — you can start!',
      message: 'Order "{title}" has been approved. The commission is paid. Client contacts are available in the order.',
    },

    responseAccepted: {
      title: '🎉 Your offer was selected!',
      message: 'The client chose you for order "{title}". Pay the commission to get the client contacts.',
    },

    orderStaleNoMaster: {
      title: '⏳ No master found yet',
      message: 'No master has responded to order "{title}" in {days} days. {amount} {currency} is on hold. You can keep waiting or cancel the order and get your money back.',
      tg: '⏳ <b>No master found yet</b>\n\nNo master has responded to order "{title}" in {days} days.\nOn hold: <b>{amount} {currency}</b>\n\nOpen the order to keep waiting or cancel and get a refund.',
    },

    orderAutoCancelled: {
      title: '⏱ Order cancelled — funds returned',
      message:
        'Unfortunately, no master accepted your order "{title}" within 72 hours. ' +
        'The order was cancelled automatically, {amount} {currency} returned to your balance.',
      tg:
        '⏱ <b>Order cancelled</b>\n\n' +
        'Your order <b>"{title}"</b> was not accepted by any master within 72 hours.\n' +
        'The order was cancelled automatically, <b>{amount} {currency}</b> returned to your balance.\n\n' +
        'Try creating the order again — you may want to clarify the description or adjust the amount.',
    },

    masterDeparted: {
      titleToClient: '🚗 {master} is on the way to you',
      titleForMaterial: '🛒 {master} went to get materials',
      messageToClient: 'Expected to arrive around {eta}.',
      messageForMaterial: 'Will buy materials first, then come to you. Estimated: by {eta}.',
      etaWithinHour: 'within an hour',
      eta90min: '90 min',
      tg: '<b>{title}</b>\n{message}\n\nOrder: {order}',
    },

    confirmDeparture: {
      title: '⏰ Confirm your departure for the order',
      message:
        'Order "{title}" is accepted, but the status has not been updated. ' +
        'Tap "Left for materials" or "On the way to client" ' +
        'so the client can see that work has started.',
    },

    transitOverdue: {
      masterTitle: '⚠️ You are running late on the order',
      masterMessage:
        'You promised to arrive for order "{title}", but the status has not been updated ' +
        '({minutes} min have passed since the ETA). ' +
        'Contact the client or tap "I have arrived".',
      clientTitle: '⏳ The master is delayed',
      clientMessage:
        'The master is {minutes} min late for your order "{title}". ' +
        'We have reminded them — follow the status in the app.',
    },

    awaitingRemainder: {
      title: '✅ The master has finished the work',
      message:
        'Confirm completion and choose how to pay the rest: cash to the master or by card ({amount} {currency}).',
      tg:
        '<b>✅ The master finished the work on order "{title}"</b>\n\n' +
        'Remaining balance: <b>{amount} {currency}</b>\n' +
        'Open the app and choose a payment method — cash or card.',
    },

    priceChange: {
      pendingTitleUp: '📈 The master proposes a new price',
      pendingTitleDown: '📉 The master reduced the price',
      pendingMessage:
        '{title}: works {oldPrice} → {newPrice} {currency}. ' +
        'Total with visit fee: {total} {currency}. Approve or reject.',
      pendingTg:
        '<b>{title}</b>\n\n' +
        'Order: "{order}"\n' +
        'Works: <s>{oldPrice}</s> → <b>{newPrice} {currency}</b>\n' +
        'Visit fee: {visitFee} {currency}\n' +
        '<b>Total: {total} {currency}</b>\n\n' +
        'Reason: {reason}\n\n' +
        'Open the order to approve or reject.',

      moderationRejectedTitle: '🚫 The moderator rejected the price change',
      moderationRejectedMessage: '{title}: the request for {amount} {currency} was rejected.',
      moderationRejectedReason: ' Reason: {note}',
      moderationRejectedTg:
        '<b>🚫 The moderator rejected the price change</b>\n\n' +
        'Order: "{order}"\n' +
        'Requested amount: {amount} {currency}\n' +
        '{noteLine}' +
        '\nContinue at the current price or contact support.',
      moderationRejectedTgNote: 'Reason: {note}\n',

      approvedTitle: '✅ The client approved the new price',
      approvedSettlementTitle: '✅ The client approved the settlement',
      approvedMessage: '{title}: the amount {total} {currency} (incl. visit fee) is confirmed.',

      rejectedTitle: '❌ The client rejected the new price',
      rejectedSettlementTitle: '⚠️ The client disagrees with the settlement',
      rejectedMessage:
        '{title}: continue at the previous price or declare the work actually completed.',
      rejectedSettlementMessage: '{title}: a dispute has been opened — an administrator will decide.',

      respondedTgApproved: 'Total: <b>{total} {currency}</b> (incl. visit fee {visitFee} {currency})',
      respondedTgSettlementRejected: 'An administrator will review the dispute and set the final amount.',
      respondedTgRejected:
        'You can continue at the previous price or declare the work actually completed — ' +
        'the visit fee {visitFee} {currency} is charged in any case.',
      respondedTg: '<b>{title}</b>\n\nOrder: "{order}"\n{body}',
    },

    // ─── Telegram templates ───
    tg: {
      notSpecified: 'Not specified',
      tasksNotSpecified: '  Not specified',
      urgentBadge: '🚨 URGENT ORDER',
      urgentPrefix: '🚨 URGENT ',
      urgentSurcharge: '⚡ <i>Urgency surcharge included (+40%)</i>',
      openOrder: '📋 Open order',
      confirmRequest: '✅ Confirm request',
      viewOrder: '📋 View order',
      orderApproved:
        '✅ <b>Order approved! You can start</b>\n{urgent}\n\n' +
        '📋 <b>{title}</b>\n\n' +
        '💰 <b>Price:</b> {price} {currency}\n{surcharge}\n\n' +
        '🔧 <b>What needs to be done:</b>\n{tasks}\n\n' +
        '📍 <b>Address:</b> {address}\n\n' +
        '📞 <b>Client phone:</b> {phone}\n' +
        '👤 <b>Client:</b> {clientName}\n\n' +
        '🔗 Open order',
      newOrder:
        '🆕 <b>{urgent}New order in your area!</b>\n\n' +
        '📋 <b>{title}</b>\n' +
        '🏷 <b>Category:</b> {category}\n' +
        '💰 <b>Budget:</b> {price} {currency}\n' +
        '📍 <b>Location:</b> {location}{distance}\n\n' +
        '👉 Tap the button below to confirm the request',
      newOrderDistance: '\n📏 <b>Distance:</b> {km} km from you',
      responseAccepted:
        '🎉 <b>Your offer was selected!</b>\n\n' +
        '📋 <b>{title}</b>\n' +
        '💰 <b>Price:</b> {price} {currency}\n\n' +
        'Pay the platform commission to get the client contacts and start working.',
    },
  },
} as const;

export default en;
