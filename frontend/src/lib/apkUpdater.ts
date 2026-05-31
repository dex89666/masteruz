// ============================================
// MasterUz — APK Updater
// Скачивает новый APK прямо в приложении и открывает системный
// установщик. Подпись APK постоянным release-ключом → Android ставит
// обновление ПОВЕРХ старой версии, сохраняя вход и данные пользователя.
// При любой ошибке вызывающий код откатывается на скачивание в браузере.
// ============================================

import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';

const APK_MIME = 'application/vnd.android.package-archive';
const APK_FILE = 'masteruz-update.apk';

/** Превращает Blob в чистый base64 (без data-URL префикса) для Filesystem. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Скачивает APK с отслеживанием прогресса (0..1) и запускает установщик.
 * Бросает исключение при сбое сети/записи/открытия — вызывающий делает fallback.
 */
export async function downloadAndInstallApk(
  url: string,
  onProgress: (ratio: number) => void,
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Скачивание APK не удалось: HTTP ${response.status}`);
  }

  const total = Number(response.headers.get('content-length')) || 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) onProgress(Math.min(received / total, 1));
  }
  onProgress(1);

  const base64 = await blobToBase64(new Blob(chunks as BlobPart[], { type: APK_MIME }));

  // Перезаписываем прошлый файл, чтобы кэш не разрастался.
  await Filesystem.writeFile({
    path: APK_FILE,
    data: base64,
    directory: Directory.Cache,
  });

  const { uri } = await Filesystem.getUri({ path: APK_FILE, directory: Directory.Cache });

  // Открывает системный диалог установки. Android увидит совпадение подписи
  // и предложит «Обновить», сохранив данные приложения.
  await FileOpener.open({ filePath: uri, contentType: APK_MIME });
}
