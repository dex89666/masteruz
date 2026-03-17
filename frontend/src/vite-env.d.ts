/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_TELEGRAM_BOT_NAME: string;
  readonly VITE_YANDEX_MAPS_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
