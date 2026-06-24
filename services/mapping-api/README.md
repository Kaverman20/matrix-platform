# mapping-api

FastAPI-сервис управления правилами доступа: Keycloak-группа → Matrix Space/Room.
Бэкенд для админ-страницы «Доступы» в surf-chat-web. Полный дизайн —
[docs/access-mapping-design.md](../../docs/access-mapping-design.md).

## Статус

Перенесена базовая реализация из старого воркспейса «Matrix x Element/mapping-api».
**Ещё не задеплоена и не подключена** — требует адаптации (см. шапку `main.py`).

Работает уже сейчас (из коробки старого кода):
- CRUD правил: `mapping_rules` + `mapping_targets` (мульти-таргет: группа → несколько Space/Room).
- `GET /api/v1/keycloak/groups` — список групп Keycloak (client_credentials).
- `GET /api/v1/matrix/rooms?type=space|room` — Space/Room из Synapse admin API.
- `GET/POST/PUT/DELETE /api/v1/rules`, `PATCH .../toggle`.
- `POST /api/v1/sync/trigger`, `GET /api/v1/sync/status`, `GET /api/v1/sync/logs`.

## Прогресс адаптации (TODO(adapt:*) в main.py)

- ✅ **auth** — admin-гейт: Matrix OpenID → `@mxid` → членство в `ADMIN_GROUP` (Keycloak).
  `verify_admin` на всех эндпоинтах + `GET /api/v1/whoami` (для показа вкладки на фронте).
- ✅ **role** — поле `role` (`user|moderator|admin`) в `mapping_targets` → Matrix power level.
- ✅ **create space** — `POST /api/v1/spaces`: спейс + каналы ботом (`BOT_ACCESS_TOKEN`),
  приватные каналы restricted к спейсу, вызвавший админ получает PL100.
- ✅ **cors** — выключен по умолчанию (same-origin); `CHAT_ORIGIN` если фронт на другом origin.
- ⏳ **sync trigger** — `POST /sync/trigger` ставит запрос в очередь (`sync_log` status=`requested`);
  реальный запуск должен подхватывать cron/one-shot `sync.py` (TODO(adapt:sync)).
- ⏳ **sync.py** — перевести `matrix-keycloak-sync` на чтение `mapping_rules` из этой БД
  (импорт текущего `mapping.yaml` + проставление power level по `role`). **Прод-выдачу не ломать.**

## ВАЖНО: не путать с работающим синком

Текущая автоматическая выдача спейсов работает на `services/matrix-keycloak-sync/sync.py`
(читает `mapping.yaml`, без БД). `mapping-api` — отдельный новый сервис; его добавление
прод не трогает. Переключение `sync.py` на БД (п.5) — единственный шаг, касающийся
рабочего пути; делать его аккуратно, после импорта текущего YAML в БД.

## Env (из main.py)

Обязательные: `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`,
`KEYCLOAK_CLIENT_SECRET`, `MATRIX_HOMESERVER_URL`, `MATRIX_ADMIN_TOKEN`, `DATABASE_URL`.

Опциональные: `ADMIN_GROUP` (по умолч. `/GR_chat_admin`), `BOT_ACCESS_TOKEN`
(токен sync-bot для создания спейсов; по умолч. = `MATRIX_ADMIN_TOKEN`),
`CHAT_ORIGIN` (для CORS, если фронт на другом origin), `KEYCLOAK_CACHE_TTL`,
`API_SECRET_TOKEN` (легаси).

## Локальный запуск

```
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Нужен Postgres (`DATABASE_URL`); таблицы создаются на старте (`init_db`).
