/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_TELEGRAM_BOT_NAME: string;
  readonly VITE_YANDEX_MAPS_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Идентификатор сборки, инжектируется Vite (define). Сравнивается с
// /version.json, чтобы понять, что на сервере вышла новая версия.
declare const __BUILD_ID__: string;
