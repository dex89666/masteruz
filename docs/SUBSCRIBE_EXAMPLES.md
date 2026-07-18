# Примеры использования Payme Subscribe API (MasterUz)

Файл содержит примеры для привязки карт, списания средств и обработки ошибок.

---

## 1. FRONTEND — Привязка карты (SubscribeCardForm компонент)

Компонент `SubscribeCardForm` уже реализован в `frontend/src/components/SubscribeCardForm.tsx`.

Пример использования в React:

```tsx
function ProfileSettings() {
  const handleCardBound = (token?: string) => {
    if (!token) return;
    // Сохранить токен в профиле
    updateUserProfile({ savedCardToken: token });
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-4">Привязать карту</h1>
      <SubscribeCardForm onSuccess={handleCardBound} paymentId={undefined} />
    </div>
  );
}
```

---

## 2. Интеграция в CommissionPaymentModal

В `CommissionPaymentModal.tsx` можно добавить опцию оплаты сохранённой картой (см. текущую реализацию в проекте).

---

## 3. BACKEND — Пример endpoint для списания средств (`/payments/subscribe/charge`)

Пример server-side логики (псевдокод):

```ts
async function chargeCardForPayment(req, res) {
  const { paymentId, cardToken } = req.body;
  const userId = req.user?.id;
  // Валидация, проверка ownership, вызов subscribeService.chargeCard
  // Обновление статуса платежа в БД и возврат результата
}
```

---

## 4. HOLD → CHARGE (опционально)

Рекомендуется поддержать двухэтапную модель (hold затем charge) для большей безопасности и контроля.

---

## 5. Обработка ошибок Subscribe API

Типичные ошибки и маппинг к понятным сообщениям для пользователя.

```ts
const paymeErrorMap = {
  '-1': 'Карта отклонена банком',
  '-2': 'Недостаточно средств',
  // ...
};

function mapPaymeError(code) { return paymeErrorMap[String(code)] || 'Ошибка обработки платежа'; }
```

---

## 6. Prisma — модель для сохранённых карт (пример)

```prisma
model SavedCard {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  token       String
  lastFour    String
  expiryMonth Int
  expiryYear  Int

  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
}
```

---

## 7. Quick Pay — пример кнопки

Псевдокод для кнопки быстрой оплаты, использующей `/payments/subscribe/charge`.

```tsx
async function handleQuickPay(token, paymentId) {
  await api.post('/payments/subscribe/charge', { paymentId, cardToken: token });
}
```

---

## 8. Тестовые карты sandbox

```
valid_mastercard: pan: 5105105105105100, expiry: 1225, cvv: 123
visa_debit: pan: 4111111111111111, expiry: 1225, cvv: 123
```

---

Файл `SUBSCRIBE_EXAMPLES.ts` перемещён в документацию, чтобы исключить JSX/React-фрагменты из backend-компиляции.

