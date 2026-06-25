// Главный процесс Electron для Surf Chat (десктоп).
// Принцип: оболочка не дублирует UI — грузит собранный веб (apps/surf-chat-web/dist)
// и отдаёт его через собственную защищённую схему app://, чтобы у приложения был
// стабильный secure-origin (нужен для WebCrypto/E2EE), изолированное хранилище и
// корректная работа CSP — в отличие от хрупкого file://.

const { app, BrowserWindow, shell, protocol, net, session, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");

// Каталог собранного веба. __dirname = apps/surf-chat-desktop/src
const WEB_DIST = path.resolve(__dirname, "..", "..", "surf-chat-web", "dist");
const APP_ORIGIN = "app://surfchat";

// SSO-возврат через loopback (RFC 8252): локальный http-сервер на 127.0.0.1
// принимает loginToken после логина в системном браузере. Custom-схему не
// используем — её может перехватить чужое приложение в ОС.
const SSO_LOOPBACK_PORT = 17656; // фиксирован, прописан в client_whitelist Synapse
const SSO_CALLBACK_PATH = "/auth-callback";
const SSO_TIMEOUT_MS = 5 * 60 * 1000; // дольше держать слушающий порт не нужно

let mainWindow = null;
let ssoServer = null;
let ssoExpectedState = null;
let ssoTimeout = null;

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

  mainWindow = win;
  return win;
}

// Поднимаем окно на передний план при возврате из браузера.
function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// Простая HTML-страница, которую видит пользователь в браузере после возврата.
function ssoResultPage(message) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<title>Surf Chat</title></head>
<body style="font-family:system-ui;background:#f4ece2;color:#2b2b2b;display:flex;
min-height:100vh;align-items:center;justify-content:center;margin:0">
<div style="text-align:center"><h2>Surf Chat</h2><p>${message}</p></div>
</body></html>`;
}

// Останавливаем loopback-сервер и забываем ожидаемый state.
function closeSsoServer() {
  if (ssoTimeout) {
    clearTimeout(ssoTimeout);
    ssoTimeout = null;
  }
  if (ssoServer) {
    ssoServer.close();
    ssoServer = null;
  }
  ssoExpectedState = null;
}

// Запускаем loopback-сервер на 127.0.0.1 и возвращаем redirectUrl со свежим
// state. Synapse дополнит его параметром loginToken и отправит сюда после входа.
function beginSso() {
  return new Promise((resolve, reject) => {
    closeSsoServer();
    ssoExpectedState = crypto.randomBytes(16).toString("hex");

    ssoServer = http.createServer((req, res) => {
      const reqUrl = new URL(req.url, `http://127.0.0.1:${SSO_LOOPBACK_PORT}`);
      if (reqUrl.pathname !== SSO_CALLBACK_PATH) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const state = reqUrl.searchParams.get("state");
      const loginToken = reqUrl.searchParams.get("loginToken");

      // Защита от login-CSRF: принимаем токен только при совпадении state,
      // который мы сами сгенерировали перед открытием браузера.
      const ok = Boolean(state) && state === ssoExpectedState && Boolean(loginToken);

      res.writeHead(ok ? 200 : 400, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        ssoResultPage(
          ok
            ? "Вход выполнен. Вернитесь в приложение Surf Chat — эту вкладку можно закрыть."
            : "Не удалось завершить вход. Закройте вкладку и попробуйте снова.",
        ),
      );

      if (ok) {
        focusMainWindow();
        mainWindow?.webContents.send("surf:sso-callback", { loginToken });
        closeSsoServer();
      }
      // При невалидном запросе сервер НЕ закрываем: иначе сторонний GET с неверным
      // state сорвал бы текущую попытку входа (DoS). Очистит таймаут SSO_TIMEOUT_MS.
    });

    ssoServer.on("error", (err) => {
      closeSsoServer();
      reject(err);
    });

    // Слушаем ТОЛЬКО loopback-интерфейс — порт недоступен из сети.
    ssoServer.listen(SSO_LOOPBACK_PORT, "127.0.0.1", () => {
      // Не держим открытый порт дольше необходимого.
      ssoTimeout = setTimeout(closeSsoServer, SSO_TIMEOUT_MS);
      resolve(
        `http://127.0.0.1:${SSO_LOOPBACK_PORT}${SSO_CALLBACK_PATH}?state=${ssoExpectedState}`,
      );
    });
  });
}

// IPC для SSO:
//  - begin-sso: поднять loopback и выдать redirectUrl со state;
//  - open-sso: открыть собранный SSO-URL в СИСТЕМНОМ браузере (только https).
function setupSsoIpc() {
  ipcMain.handle("surf:begin-sso", () => beginSso());

  ipcMain.handle("surf:open-sso", (_event, rawUrl) => {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === "https:") {
        void shell.openExternal(rawUrl);
        return true;
      }
    } catch {
      // невалидный URL
    }
    return false;
  });
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
  setupSsoIpc();
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

// Не оставляем висящий loopback-порт при выходе.
app.on("before-quit", closeSsoServer);
