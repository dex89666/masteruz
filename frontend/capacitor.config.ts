import type { CapacitorConfig } from '@capacitor/cli';

// Если задан CAP_SERVER_URL — нативная оболочка грузит фронт с сервера
// (Railway), а не из bundled-ассетов. Это включает обновления «по воздуху»:
// после деплоя фронта установленный APK получает свежий интерфейс без
// переустановки. Для локальной разработки можно указать http://192.168.x.x:5173.
const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'uz.masteruz.app',
  appName: 'MasterUz',
  webDir: 'dist',
  // В production-сборке APK будет использовать bundled assets + этот API URL
  // Для локальной разработки укажи server.url = 'http://192.168.X.X:5173'
  ...(serverUrl
    ? { server: { url: serverUrl, cleartext: serverUrl.startsWith('http://') } }
    : {}),
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
      overlaysWebView: false,
    },
    App: {
      // Не ставим launchUrl, работаем с bundled index.html
    },
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false, // true только для dev
    backgroundColor: '#0f172a',
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
    backgroundColor: '#0f172a',
  },
};

export default config;
