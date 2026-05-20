# MasterUz — Релизы и обновления

Документ описывает, как устроена доставка мобильных приложений
и система автообновлений.

## Архитектура релизов

```
GitHub Actions          GitHub Releases           Бэкенд            Мобильное приложение
─────────────────       ─────────────────         ──────────        ──────────────────
push в main      ─►     android-vN тег       ◄─  /api/app/version  ─►  UpdateChecker
                        MasterUz-android.apk      (кэш 5 мин)           показывает модал
```

**Единственный источник истины — GitHub Releases.**
Бэкенд не хранит версии в БД, а на лету читает последний релиз через GitHub API.
Это даёт автоматический откат: удалил релиз → клиенты перестали видеть его как «новый».

## Версионирование

| Поле          | Значение                                        | Где задаётся                             |
| ------------- | ----------------------------------------------- | ---------------------------------------- |
| `versionName` | `<package.json#version>.<github.run_number>`    | CI: `android-build.yml` (`steps.ver`)    |
| `versionCode` | `github.run_number`                             | CI: `android-build.yml` (`steps.ver`)    |
| Тег релиза    | `android-v<versionCode>`                        | CI: `softprops/action-gh-release`        |
| Asset         | `MasterUz-android.apk`                          | CI: всегда одно имя для стабильной ссылки |

`versionCode` — целое число, строго возрастающее. Android требует, чтобы
каждая новая сборка имела больший `versionCode`, иначе установка обновления
будет отклонена системой.

## Постоянная ссылка для скачивания

```
https://github.com/<owner>/<repo>/releases/latest/download/MasterUz-android.apk
```

Эта ссылка **никогда не меняется** — GitHub автоматически редиректит на последний релиз.
Используется в `frontend/src/pages/DownloadAppPage.tsx`.

## Автообновление в приложении

1. При запуске приложения `UpdateChecker` дёргает `GET /api/app/version`.
2. Хук `useInstalledAppInfo` через `@capacitor/app` отдаёт установленный `versionCode`.
3. Если `latest.versionCode > installed.versionCode` — показывается модал.
4. «Обновить сейчас» → `window.open(downloadUrl, '_system')` → системный браузер качает APK → пользователь устанавливает.
5. «Позже» → код сохраняется в `localStorage`, модал больше не показывается до следующей версии.
6. Если `mandatory=true` (старее `ANDROID_MIN_SUPPORTED_CODE`) — кнопка «Позже» скрыта.

## Обязательные обновления

Установить минимальную поддерживаемую сборку:

```bash
# Railway → Backend → Variables
ANDROID_MIN_SUPPORTED_CODE=42
```

Все клиенты со сборкой < 42 получат `mandatory: true` и заблокирующий модал.

## Подписной keystore (release APK)

Без keystore CI собирает **debug-подписанный** APK — его можно ставить, но Google
Play такой не примет, а пользователь увидит предупреждение «небезопасное приложение».

### Создать keystore локально

```bash
keytool -genkeypair -v \
  -keystore masteruz-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias masteruz \
  -storepass <strong-password> \
  -keypass <strong-password> \
  -dname "CN=MasterUz, O=MasterUz, C=UZ"

# Закодировать в base64 для GitHub Secrets
base64 -w0 masteruz-release.jks > masteruz-release.jks.base64
cat masteruz-release.jks.base64
```

### Добавить секреты в GitHub

`Settings → Secrets and variables → Actions`:

| Имя секрета                 | Значение                                  |
| --------------------------- | ----------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | содержимое `masteruz-release.jks.base64`  |
| `ANDROID_KEYSTORE_PASSWORD` | пароль хранилища                          |
| `ANDROID_KEY_ALIAS`         | `masteruz`                                |
| `ANDROID_KEY_PASSWORD`      | пароль ключа                              |

После добавления секретов CI автоматически переключится со сборки `assembleDebug`
на подписанную `assembleRelease`.

> ⚠️ **Сохрани keystore в надёжном месте.** Без него выпустить обновление с тем же
> `applicationId` (`uz.masteruz.app`) будет невозможно — Android отвергнет установку.

### (Опционально) Сброс кэша бэкенда после релиза

Бэкенд кэширует ответ GitHub на 5 минут. Чтобы новая версия появилась мгновенно:

```bash
# Railway → Backend → Variables
BACKEND_REFRESH_TOKEN=<JWT_админа>

# GitHub → Secrets
BACKEND_REFRESH_TOKEN=<тот же JWT>
BACKEND_URL=https://masteruz-backend-production.up.railway.app
```

CI после публикации релиза дёргает `POST /api/app/version/refresh`.

## Авторизация через Telegram в APK (deep-link OAuth)

В мобильном APK обычный Telegram Login Widget не работает — он встроен в iframe от `telegram.org`
и валидирует `origin`, а в WebView Capacitor origin = `https://localhost`, не разрешённый в BotFather
(ошибка «Bot domain invalid»). Поэтому в native APK используется внешний OAuth-flow с deep-link:

```
APK             Внешний браузер        Telegram OAuth       Backend                       APK
──              ───────────────        ──────────────       ───────                       ──
Кнопка       →  oauth.telegram.org  →  user OK           →  /api/auth/telegram-callback →  uz.masteruz.app://auth
«Войти                                                       302 на deep-link               Capacitor App.appUrlOpen
через                                                                                       сохраняет токены → /
Telegram»
```

### Что нужно настроить вручную (один раз)

1. **BotFather → `/setdomain`** → указать домен бэкенда `masteruz-backend-production.up.railway.app`
   (это `origin` и `return_to` в OAuth-URL — Telegram требует совпадения с зарегистрированным доменом).
2. **GitHub Secrets** (для CI Android):
   - `VITE_TELEGRAM_BOT_ID` — численный ID бота (показывает `@BotFather`, команда `/mybots → бот → API Token` — первое число до `:`).
   - `VITE_TELEGRAM_OAUTH_ORIGIN` — `https://masteruz-backend-production.up.railway.app` (необязательно, есть default).
3. **Railway → Backend Variables** (необязательно):
   - `MOBILE_DEEPLINK_SCHEME` — по умолчанию `uz.masteruz.app`.

### Custom URL scheme

- Android: intent-filter в `frontend/android/app/src/main/AndroidManifest.xml` (`<data android:scheme="uz.masteruz.app" />`).
- iOS: `CFBundleURLTypes` в `frontend/ios/App/App/Info.plist`.

### Локальный тест

```bash
# Из терминала на подключённом Android-устройстве:
adb shell am start -a android.intent.action.VIEW \
  -d "uz.masteruz.app://auth?access=fakejwt&refresh=fakejwt&new=0"
```

## iOS

Скаффолд создан в `frontend/ios/`. Сборка `.ipa` требует:

- macOS (CI можно настроить на `runs-on: macos-14`)
- Xcode 15+
- Apple Developer account (`$99/год`)
- Certificate + Provisioning Profile

Команды для разработчика на Mac:

```bash
cd frontend
npm run ios:build      # билд React + cap sync ios
npm run cap:open:ios   # открыть проект в Xcode
# В Xcode: выбрать команду, Product → Archive → Distribute App → App Store Connect / Ad Hoc
```

В этом репозитории iOS-workflow не создаётся — добавим, когда будет
Apple Developer аккаунт и кастомные сертификаты в GitHub Secrets.

## Локальная сборка APK (для тестов)

Нужен Android SDK + Java 17/21.

```bash
cd frontend
npm install
npm run build:android
npx cap sync android
cd android
./gradlew assembleDebug   # debug APK без подписи
# или
./gradlew assembleRelease -PversionCode=99 -PversionName=test \
  -Pandroid.injected.signing.store.file=$(pwd)/app/masteruz-release.jks \
  -Pandroid.injected.signing.store.password=… \
  -Pandroid.injected.signing.key.alias=masteruz \
  -Pandroid.injected.signing.key.password=…
```

APK будет в `frontend/android/app/build/outputs/apk/(debug|release)/`.

## Тестирование UpdateChecker

В деве на native устройстве:

1. Установи APK с `versionCode=10`.
2. Подсунь бэку фейковый ответ или временно опубликуй новый GitHub Release.
3. Перезапусти приложение → модал должен появиться через ~1 секунду.

Принудительно сбросить «позже»:

```js
localStorage.removeItem('mu:update-dismissed-code');
```
