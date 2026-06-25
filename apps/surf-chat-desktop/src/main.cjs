// Главный процесс Electron для Surf Chat (десктоп).
// Принцип: оболочка не дублирует UI — грузит собранный веб (apps/surf-chat-web/dist)
// и отдаёт его через собственную защищённую схему app://, чтобы у приложения был
// стабильный secure-origin (нужен для WebCrypto/E2EE), изолированное хранилище и
// корректная работа CSP — в отличие от хрупкого file://.

const { app, BrowserWindow, shell, protocol, net, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

// Каталог собранного веба. __dirname = apps/surf-chat-desktop/src
const WEB_DIST = path.resolve(__dirname, "..", "..", "surf-chat-web", "dist");
const APP_ORIGIN = "app://surfchat";

// Схему регистрируем как привилегированную ДО app.ready: standard + secure даёт
// нормальный origin (secure context), supportFetchAPI — работу fetch/WebCrypto.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

// Внутренним считаем только наш собственный origin (не «поддомены» app://*).
function isInternalUrl(url) {
  return url === `${APP_ORIGIN}/` || url.startsWith(`${APP_ORIGIN}/`);
}

// Внешнюю ссылку открываем в системном браузере только если это строго https.
// Парсим через URL, чтобы не повестись на строки вида "https:evil".
function openExternalIfHttps(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "https:") {
      void shell.openExternal(rawUrl);
    }
  } catch {
    // невалидный URL — игнорируем
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 600,
    title: "Surf Chat",
    backgroundColor: "#f4ece2",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      // Харденинг: рендер не имеет доступа к Node, изолирован и в песочнице.
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      // Запрещаем выполнение удалённого контента вне нашего origin.
      allowRunningInsecureContent: false,
      // Явный запрет тега <webview> (по умолчанию выключен, фиксируем намеренно).
      webviewTag: false,
    },
  });

  // Загружаем веб из локальной сборки через app://.
  void win.loadURL(`${APP_ORIGIN}/`);

  return win;
}

// Единые правила навигации/окон/webview для ВСЕХ web-contents (главное окно и
// любые дочерние) — чтобы будущие вложенные contents не унаследовали слабые
// настройки.
function hardenWebContents() {
  app.on("web-contents-created", (_event, contents) => {
    // Новые окна не открываем во встроенном вебвью; внешние https — в браузер.
    contents.setWindowOpenHandler(({ url }) => {
      openExternalIfHttps(url);
      return { action: "deny" };
    });

    // Навигация разрешена только внутри нашего origin; внешнее — в браузер.
    contents.on("will-navigate", (event, url) => {
      if (isInternalUrl(url)) return;
      event.preventDefault();
      openExternalIfHttps(url);
    });

    // Жёстко запрещаем подключение <webview> в любом виде.
    contents.on("will-attach-webview", (event) => {
      event.preventDefault();
    });
  });
}

// Permission-запросы: по умолчанию запрещаем всё, разрешаем media (камера/микрофон
// для звонков LiveKit) только нашему собственному origin.
function setupPermissions() {
  const ses = session.defaultSession;

  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = details?.requestingUrl
      ? safeOrigin(details.requestingUrl)
      : safeOrigin(webContents?.getURL?.() ?? "");
    const allowed = permission === "media" && origin === APP_ORIGIN;
    callback(allowed);
  });

  // Синхронная проверка (например, перед getUserMedia) — та же политика.
  ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    return permission === "media" && requestingOrigin === APP_ORIGIN;
  });
}

function safeOrigin(rawUrl) {
  try {
    return new URL(rawUrl).origin;
  } catch {
    return "";
  }
}

// Обработчик схемы app:// — отдаёт файлы из WEB_DIST с SPA-фолбэком на index.html.
function registerAppProtocol() {
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    let relPath = decodeURIComponent(url.pathname);
    if (relPath === "/" || relPath === "") {
      relPath = "/index.html";
    }

    const target = path.normalize(path.join(WEB_DIST, relPath));

    // Защита от path traversal: target обязан лежать строго внутри WEB_DIST.
    // path.relative даёт "" для самого каталога и не начинается с ".." для вложенных.
    const rel = path.relative(WEB_DIST, target);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      return new Response("Forbidden", { status: 403 });
    }

    // SPA-фолбэк: путь без расширения и без файла → отдаём index.html.
    let filePath = target;
    if (!fs.existsSync(filePath) && !path.extname(filePath)) {
      filePath = path.join(WEB_DIST, "index.html");
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });
}

app.whenReady().then(() => {
  hardenWebContents();
  setupPermissions();
  registerAppProtocol();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // macOS: приложение принято держать живым до Cmd+Q.
  if (process.platform !== "darwin") {
    app.quit();
  }
});
