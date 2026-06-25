// Preload-скрипт: единственный безопасный мост между изолированным рендером и
// возможностями ОС. Работает в sandbox (contextIsolation:true), поэтому только
// CommonJS и ограниченный набор API.
//
// Пока мост намеренно минимален — отдаём лишь имя платформы. Нативные
// возможности (OS-keychain для ключей, пуши, биометрия, deep-links) будем
// добавлять сюда по одной, каждую — через contextBridge.exposeInMainWorld,
// без открытия рендеру прямого доступа к Node/Electron.

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("surfDesktop", {
  isDesktop: true,
  platform: process.platform,
});
