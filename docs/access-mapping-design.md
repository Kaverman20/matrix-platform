# Страница «Доступы» (Keycloak-группа → Matrix-спейс) — дизайн

Визуальная админ-страница выдачи доступов: матчим Keycloak-группу со спейсом в чате,
создаём управляемые спейсы. Поверх существующего `matrix-keycloak-sync`.

## Решения (зафиксированы)
- **Источник правды:** БД в `mapping-api` (не статичный `mapping.yaml`). Чисто для UI-редактирования, конкурентных правок, audit-log.
- **Admin-гейт:** `mapping-api` валидирует Matrix OpenID-token и проверяет членство в админ-группе Keycloak. Переиспользует паттерн звонков, не трогает логин-флоу.
- **Правило = группа → несколько спейсов, с пер-канальным выбором и ролью.** Спейс — мульти-селект; у каждого выбранного спейса можно отметить подмножество каналов или «все», и выбрать роль (user/moderator/admin). Модель: `group_path → [ { space_id, channels: "all" | [room_ids], role } ]`.
- **Роль = Matrix power level** (admin=100, moderator=50, user=0), проставляется `sync.py` в спейсе/каналах Synapse. Это та самая роль-модель из прототипа Ketesa (`AccessMapping.defaultRole` + `RoleMapping`). Поток: `Чат → mapping-api → sync.py → Synapse`. **Ketesa в потоке НЕ участвует** (обычная админка Synapse, только читает; не форкаем, не пушим в неё).
- Каскад: членство в спейсе уже открывает приватные дочерние каналы (restricted-rooms). «Все каналы» = только членство в спейсе. Подмножество = членство в спейсе + точечная синхронизация выбранных каналов (а невыбранные приватные при необходимости делаем не restricted-от-спейса, чтобы они НЕ открывались автоматически — уточнить на этапе sync.py).
- **Создание спейсов — только ботом** `@sync-bot:matrix.foxhound.run` (иначе бот не сможет управлять членством).

## Архитектура
```
Браузер (Settings → «Доступы», только если is_admin)
   │  Matrix OpenID-token (как fetchLiveKitJwt.ts)
   ▼
mapping-api (FastAPI, сервер — сейчас заглушка services/mapping-api/)
   ├─ Keycloak Admin API (client matrix-keycloak-sync) → список групп
   ├─ Matrix как sync-bot → создание спейсов/каналов, членство
   └─ БД правил (group_path → space_id [+ room_ids], created_by, ts) + audit
        ▼
   sync.py — применяет членство (читает правила из mapping-api/БД вместо YAML)
```

## Компоненты к постройке

### A. mapping-api (новый сервис, FastAPI)
Эндпоинты (все под admin-гейтом, кроме whoami, который его и реализует):
- `GET  /access/whoami` — валидирует OpenID-token → `@mxid` → Keycloak admin-группа → `{ is_admin, mxid }`.
- `GET  /access/groups` — группы Keycloak (admin-client).
- `GET  /access/spaces` — известные спейсы (через бота / из правил).
- `GET  /access/rules` — список правил.
- `POST /access/rules` — создать правило `{ group_path, space_id }`.
- `DELETE /access/rules/{id}` — удалить правило.
- `POST /access/spaces` — создать спейс **ботом** `{ name, type, channels? }` → space_id (PL100, приватные каналы restricted, админ авто-добавлен).
- `POST /access/sync` — «Применить сейчас» (триггер синка).
- БД: `rules`, `audit` (кто/что/когда выдал).
- Креды: Keycloak client + токен sync-bot — только серверные.

### B. sync.py (правка)
- Читать правила из mapping-api/БД вместо статичного `mapping.yaml`. YAML оставить как fallback/миграцию.
- Логику членства/force-join/revoke не трогаем — она готова.

### C. Frontend (surf-chat-web)
- Вкладка **«Доступы»** в `features/settings/SettingsModal.tsx:13` (TABS) + тип в `settingsTabs.ts:1`. Рендер только при `is_admin` (из `GET /access/whoami`).
- Компонент страницы: список правил (удаление), форма «группа↔спейс» (два селектора), «Создать спейс», «Применить сейчас» + статус.
- Мелкий api-клиент с OpenID-token авторизацией (по образцу `features/calls/fetchLiveKitJwt.ts:30`).

### D. Инфра
- `mapping-api` в docker-compose рядом с sync; за Caddy, **admin-only / internal** (не публичный без нужды).
- Env: Keycloak client/secret, sync-bot Matrix token, homeserver URL, имя админ-группы.
- Audit-log + жёсткий гейт — это control-plane привилегий.

## Входные данные (получены)
1. **Админ-группа Keycloak:** `GR_chat_admin` (в путях с ведущим слешем: `/GR_chat_admin`).
2. **Старая реализация `mapping-api`:** найдена в «Matrix x Element/mapping-api», перенесена в `services/mapping-api/` (FastAPI + Postgres, почти готовая — CRUD правил с мульти-таргетом, groups, rooms, sync status/logs). Адаптация — в шапке `main.py`.
3. **sync-bot:** права есть (в `sync.py` уже используется Synapse admin API).
4. **Хостинг:** тот же VPS `109.172.38.60`, docker-compose рядом с `matrix-keycloak-sync`. БД — переиспользовать Postgres Synapse (отдельная база). **Сеть:** повесить путём `chat.foxhound.run/api/mapping/*` (same-origin → без CORS и без отдельного сертификата), каждый эндпоинт за admin-гейтом.

## План работ
- **Фаза 0 (сделано):** перенос базовой реализации в `services/mapping-api/`.
- **Фаза 1:** adapt:auth (admin-гейт), adapt:cors, `POST /spaces` (создание ботом), adapt:sync (триггер docker sync.py). Деплой `mapping-api` за Caddy. Прод-синк (`mapping.yaml`) не трогаем.
- **Фаза 2:** перевод `sync.py` на чтение `mapping_rules` из БД + одноразовый импорт текущего `mapping.yaml`. Только после этого YAML уходит.
- **Фаза 3 (фронт):** вкладка «Доступы» в `SettingsModal` под `is_admin`, форма группа↔спейсы(мульти)+каналы, список правил, «Применить сейчас».

## Грубая оценка
- mapping-api (auth + CRUD + create-space + sync-trigger): ~основная часть работы.
- sync.py переключение на БД: небольшое.
- Frontend страница: небольшое (паттерны есть).
- Инфра/деплой/гейт: небольшое, но критично по безопасности.

v2 (после): пер-канальные тумблеры, поиск по группам/спейсам, история выдач в UI.
