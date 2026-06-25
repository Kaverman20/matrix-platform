// Preload-скрипт: единственный безопасный мост между изолированным рендером и
// возможностями ОС. Работает в sandbox (contextIsolation:true), поэтому только
// CommonJS и ограниченный набор API.
//
// Пока мост намеренно минимален — отдаём лишь имя платформы. Нативные
// возможности (OS-keychain для ключей, пуши, биометрия, deep-links) будем
// добавлять сюда по одной, каждую — через contextBridge.exposeInMainWorld,
// без открытия рендеру прямого доступа к Node/Electron.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("surfDesktop", {
  isDesktop: true,
  platform: process.platform,

  // Поднять loopback-сервер и получить redirectUrl со state (для входа).
  beginSso: () => ipcRenderer.invoke("surf:begin-sso"),

  // Открыть SSO-страницу логина в системном браузере (main проверит, что https).
  openSso: (url) => ipcRenderer.invoke("surf:open-sso", url),

  // Подписка на возврат SSO-токена из браузера (loopback-колбэк).
  // Возвращает функцию отписки. Передаём наружу только loginToken — без события.
  onSsoCallback: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("surf:sso-callback", listener);
    return () => ipcRenderer.removeListener("surf:sso-callback", listener);
  },
});
