# Surf Chat — аудит и спринт-план

> Составлен по фактическому коду (каждый пункт привязан к `file:line`).
> Легенда статусов:
> - ✅ **проверено** — подтверждено в коде/конфиге.
> - 🔍 **нужна проверка на VPS** — из репозитория не видно, требуется зайти на сервер.
> - ⚠️ **противоречит / устарело** — пункт из плана Cursor, который на самом деле уже не так.

---

## 0. Калибровка: что Cursor выдал неточно

| Пункт Cursor | Реальность | Evidence |
|---|---|---|
| «Уменьшить page size 120 → 50–80» | **Частично неверно (поправка Cursor).** Дефолт `paginateToEvent` (jump) = `50`, НО скролл вверх `loadOlder` грузит по `120`. См. Sprint 2.4. | `pagination.ts:125` (50) vs `app/ChatShell.tsx:517` (120) |
| «VITE_CALLS_ENABLED=true если ещё false» | Уже `true` (и по договорённости всегда true). | `.env:3`, `apps/surf-chat-web/src/features/calls/callsEnabled.ts:3` |
| «localStorage + XSS — большой риск» | Реальный, но митигирован жёстким CSP, который Cursor не учёл. | `infra/foxhound/synapse-test/Caddyfile:47` |
| «Timeline пустой flash / loader» как P0-блокер | Реальное раздражение в daily use, но не P0-блокер → P1 (согласовано с Cursor). Скелетон вместо «Сообщений пока нет». | `Timeline.tsx:552` |
| Mobile (Sprint 4, 2–3 нед) в MVP-пути | Продукт desktop-first осознанно → отдельный milestone. | — |

---

## Sprint 0 — «Доверие» (P0, ~1 неделя)
Только то, что реально ломает доверие реального пользователя.

### 0.1 Ошибки отправки не видны пользователю ✅
Сейчас при ошибке только `console.error`, юзер думает «отправилось».
- [ ] Единый `Toast`/`ErrorToast` + контекст (своего нет вообще).
- [ ] Подключить к молчаливым местам:
  - `features/composer/Composer.tsx:285` (send-message), `:347` (send-media), `:594` (send-voice), `:628` (send-poll)
  - `features/threads/ThreadPanel.tsx:185` (thread-reply), `:199` (thread-media)
- [ ] Заменить ~13 `window.alert` на toast:
  - `app/ChatShell.tsx:588,597,662,705`; `app/useChatNavigation.ts:152,172`; `features/.../useDmCreation.ts:46`, `useChannelCreation.ts:60`, `useSpaceCreation.ts:106,124,142`, `useRoomSettings.ts:72`, `useDeepLink.ts:42`

### 0.2 Закрепы / jump-to-message — регрессионная проверка
Недавно много правили; держать под наблюдением.
- [ ] Сценарии: старый закреп не внизу, цикл 1/2→2/2, закреп из альбома, jump из правой панели, jump после deep-jump (reply/search), Safari+Chrome.
- [ ] Если падает — toast «Сообщение не найдено» (сейчас молча).

### 0.3 Изоляция аккаунтов: ключи не чистятся при logout ✅
`clearSecretStorageKeys()` существует, но **не вызывается** при выходе → recovery-ключи прошлого аккаунта остаются в памяти.
- [ ] Вызвать в `MatrixProvider.resetToLogin()` перед `setClient(null)`.
- Evidence: `packages/matrix-core/src/crypto/secretStorage.ts:10,24` (функция есть), `apps/surf-chat-web/src/app/providers/MatrixProvider.tsx` (logout её не зовёт).

### 0.4 Smoke после деплоя
- [ ] Post-deploy: `curl chat.foxhound.run/build-id.txt` + `/_matrix/client/versions`.
- [ ] Обновить устаревший `features/composer/README.md` (пишет «later», всё уже сделано).

---

## Sprint 1 — Безопасность и инфра (P0/P1, 1–2 недели)
**Сначала верификация на VPS (дёшево), потом фиксы.**

### 1.1 Runtime-аудит на сервере 🔍 (нельзя узнать из репо)
- [ ] `ufw status` / `netstat -tuln` / cloud firewall: открыты ли публично:
  - lk-jwt `:8080` (`infra/foxhound/matrix-rtc/docker-compose.yml:47` — `8080:8080` на всех интерфейсах)
  - LiveKit UDP `50000–50100` + TCP `7881` (нужны для звонков, но проверить scope)
- [ ] Доступен ли `admin.foxhound.run` (ketesa) без auth снаружи?
- [ ] Есть ли на VPS не-root пользователи; только ли ключи для SSH?

### 1.2 Закрыть публичные admin-поверхности ✅
- [ ] `/_synapse/admin/*` — IP-allowlist/VPN (token-gated, но наружу торчит). `Caddyfile:28`
- [ ] `admin.foxhound.run → ketesa:8080` — basic_auth/allowlist + security-заголовки (сейчас НЕТ ни HSTS, ни CSP, ни X-Frame-Options). `Caddyfile:33-35`

### 1.3 Пин образов ✅
- [ ] `matrixdotorg/synapse:latest` → точная версия. `infra/foxhound/synapse-test/docker-compose.yml:19`
- [ ] `ghcr.io/etkecc/ketesa:latest` → точная версия. `:33`
- [ ] (P2) `postgres:16-alpine`, `caddy:2`, `python:3.11-slim` → digest.
- LiveKit/lk-jwt уже запинены ✅ (`matrix-rtc/docker-compose.yml:16,27`).

### 1.4 Деплой и CI ✅
- [ ] Деплой не от `root@109.172.38.60` — отдельный deploy-user + scoped path. `.github/workflows/ci.yml` (deploy-web)
- [ ] `pnpm audit` + gitleaks/secret-scan в CI (есть только `pip-audit` для python). `ci.yml:45`
- [ ] Branch protection на `main` (PR не должны получать `VPS_SSH_KEY`).

### 1.5 Секреты ✅/🔍
- [ ] Ротация LiveKit API key/secret — в ADR прямо написано «светились в чате, ротировать до прода». `docs/decisions/0002-...md:99`
- Хорошее, не трогать: `.env` только публичные `VITE_*`, в `.gitignore`; PostgreSQL только внутренний; CSP/HSTS сильные. ✅

---

## Sprint 2 — Перф и архитектура matrix-core (P1, ~1 неделя)

### 2.1 Глобальная подписка на state-события всех комнат ✅
`client.on(RoomStateEvent.Events, onChange)` без фильтра по roomId → любое изменение состояния в ЛЮБОЙ комнате форс-ребилдит таймлайн текущей (O(n) на 100 комнат).
- [ ] Room-scoped подписка или фильтр `event.getRoomId() === roomId`.
- Evidence: `timeline/subscribeTimeline.ts:23`, `rooms/subscribeRoomGroups.ts:45`, `rooms/pinned.ts:99` (тут фильтр есть, но post-hoc).

### 2.2 jump-to-message делает лишние O(n) ребилды ✅
`paginateToEvent` зовёт `isMessageInUiTimeline` (полный `buildTimelineMessages`) 2–10× за прыжок, хотя рядом есть дешёвый `isEventInTimeline`.
- [ ] Заменить на `isEventInTimeline`. Evidence: `timeline/pagination.ts:31-42` (есть, но не используется), `:90-136`.

### 2.3 Единый стиль обработки ошибок ✅
- [ ] `setTyping` (`timeline/typing.ts:21`) и `markReadUpToEvent` (`rooms/readReceipts.ts:71`) глушат ошибки — привести к единому контракту (re-throw или `Promise<boolean>`).
- [ ] (P3) Убрать лишний `as string` в `rooms/pinned.ts:74-81`; задокументировать пачку `as never` (31 шт, в основном `rooms/createRoom.ts`).

### 2.4 Preload и page size ✅ (пункт Cursor, подтверждён)
- [ ] Preload греет таймлайны **всех** комнат — заскоупить до активной + N недавних. Сейчас idle-scheduled (не eager), но всё равно строит каждую комнату. Evidence: `app/ChatShell.tsx:180,195` (`allRoomIds` → `usePreloadTimelineMessages`), `features/timeline/useTimelineMessages.ts:79`.
- [ ] (P3, тюнинг) Скролл вверх `loadOlder` грузит по `120` — рассмотреть `50–80` (меньше рендера за раз). Evidence: `app/ChatShell.tsx:517`. Не баг — баланс round-trips vs объём рендера.

---

## Sprint 3 — a11y + UX-полировка (desktop) (P1/P2, 1–2 недели)

### 3.1 a11y sweep ✅
- [ ] `aria-label` на icon-кнопки: `ChatMainHeader.tsx:63-108` (view/threads/phone/video/info), `Composer.tsx:834,941,992` (скрепка/эмодзи/мик), `Lightbox.tsx:138-202` (стрелки/зум), `Timeline.tsx:601` (new-messages pill).
- [ ] Lightbox: `role="dialog"`/`aria-modal`/focus-trap (сейчас нет). `Lightbox.tsx:130`
- [ ] Focus-trap для модалок (`MediaPreviewModal`, `CreatePollModal` — role есть, ловушки нет).
- [ ] Landmarks: `<nav>`/`<main>`/`<aside>` в `ChatShell` (сейчас div'ы).
- [ ] `aria-live="polite"` на typing/presence. `ChatMainHeader.tsx:53`
- Уже хорошо ✅: Escape-стек (`useChatShellKeyboard.ts`), форматирование-шорткаты, фокус композера, `ReactionPill` с `aria-pressed`, `CallPanel` уже `role="dialog"`.

### 3.2 Звонки — раскрытие и доступность
- [ ] **E2EE-дисклеймер**: нигде не сказано, что медиа звонка НЕ E2EE (SFU видит). Добавить плашку/иконку у кнопки звонка или one-time баннер. (нет ни одного упоминания в `features/calls`)
- [ ] `aria-label` на answer/decline/hangup. `CallPanel.tsx:272-330` (есть только `title`).

### 3.3 Закрепы — TG-parity (косметика)
- [ ] Превью-thumbnail медиа в pinned-bar (сейчас только текст). `PinnedBar.tsx:28-34`
- [ ] Полный список закрепов по тапу (сейчас только цикл).
- [ ] Порядок: новый закреп первым (как TG).

---

## Sprint 4 — Тесты как страховка (P0/P1 по риску, ~1 неделя, дальше ongoing)
Web-приложение ~13% покрытия (18/136 файлов); самые опасные пути не покрыты.

### 4.1 P0 — критические нетестируемые места ✅
- [ ] `Timeline.tsx` scroll / firstItemIndex / scrollToIndex (недавно баг-прон) — **именно scroll-jump integration**: prepend-anchoring при `loadOlder`, отсутствие ремаунта на jump, data-index vs firstItemIndex-base.
- [ ] `ChatShell.focusMessageWithPagination` (paginate→resolve→scroll, токены отмены).
- [ ] `MessageBody.tsx` DOMPurify (XSS-вектора + экранирование searchQuery). `MessageBody.tsx:23`
- [ ] `util/escapeHtml` — барьер XSS, 0 тестов. `packages/matrix-core/src/util/`
- [ ] `MatrixProvider` session restore/logout (+ loginToken из URL).

### 4.2 P1
- [ ] `useTimelineMessages` (WeakMap-кэш, 7 подписок), `subscribeTimeline` cleanup, `readReceipts`, `mapTimeline` (альбомы/реакции/опросы/пины), `auth` (sso/tokenLogin), Composer error-paths.

### 4.3 Гейты CI
- [ ] Coverage-threshold для matrix-core и для timeline/jump-модулей web (сейчас порога нет). `ci.yml`

---

## Sprint 5 — Фичи (P1+, по необходимости)
- [ ] **Групповые звонки** (сейчас жёстко DM-only). `ChatMainHeader.tsx:42` (`room.kind === "dm"`), `incomingCallRooms.ts:21,26`. Архитектура MatrixRTC многоучастниковая — это UI-гейт.
- [ ] ThreadComposer ≈ main Composer (emoji/voice/mentions/polls), виртуализация панелей тредов.
- [ ] Per-room mute, звуки, push (service worker) — отдельный epic.

---

## Backlog (P2/P3)
- **Mobile milestone** (отдельно от MVP): `100vh`→`100dvh`, брейкпоинты, overlay-панели, long-press, swipe в Lightbox. Evidence: `chat-shell.css:3,12`, `tokens.css` фикс-ширины.
- **Tech debt**: разбить `ChatShell.tsx` (1207 строк), извлечь `useAbortableAsync()` (повтор в 4 search-хуках), объединить `useSpaceCreation`/`useChannelCreation`, типизировать обёртки вместо `as never`.
- **i18n** (вынести строки), keyboard-shortcuts help.

---

## DoD «MVP к реальным пользователям»
- [ ] Sprint 0 (ошибки видны + закрепы стабильны + ключи чистятся).
- [ ] Sprint 1.1–1.2 (runtime-аудит + закрыты admin-поверхности).
- [ ] Sprint 1.5 (ротация LiveKit-секретов).
- [ ] Sprint 4.1 (тесты на jump/timeline/sanitize).
- [ ] Smoke на деплое.

Mobile и групповые звонки — отдельные milestone'ы после MVP.
