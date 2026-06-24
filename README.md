# Matrix Platform — Surf Chat

Корпоративный мессенджер на базе [Matrix](https://matrix.org) (Synapse) для Surf Coffee:
веб-клиент, доменные пакеты поверх matrix-js-sdk, сервисы выдачи доступов
(Keycloak → Matrix) и инфраструктура развёртывания.

Монорепозиторий на pnpm workspaces (Node 24, pnpm 10).

## Структура

```txt
apps/
  surf-chat-web/            Веб-клиент (React + Vite + react-virtuoso) → chat.foxhound.run
packages/
  matrix-core/              Обёртка matrix-js-sdk и доменные операции
  ui/                       Общие UI-примитивы
services/
  mapping-api/              FastAPI: правила доступа (Keycloak-группа → спейс/канал + роль)
  matrix-keycloak-sync/     Python-синк: применяет правила и членство в Matrix
infra/
  foxhound/                 Манифесты боевого VPS (docker-compose, Caddyfile)
docs/
  architecture.md           Обзор архитектуры
  access-mapping-design.md  Дизайн фичи «Доступы»
  foxhound-infrastructure.md Раскладка VPS и деплой
  audit-sprints.md          Аудит безопасности/инфры (P0 + backlog)
  DECISIONS.md, decisions/  Журнал инженерных решений и ADR
scripts/
  verify.sh                 lint + typecheck + test + build
```

## Быстрый старт

Нужны Node 24 (версия CI; 20+ обычно тоже работает) и pnpm 10.

```sh
pnpm install
cp .env.example .env        # Vite читает env из корня репо (envDir: "../..")

# Дев-сервер веб-клиента
pnpm --filter surf-chat-web dev

# Прод-сборка веб-клиента
pnpm --filter surf-chat-web build
```

`.env` задаёт `VITE_DEFAULT_HOMESERVER` (домашний сервер по умолчанию на экране
входа; пользователь может переопределить) и `VITE_APP_NAME`. Все реальные секреты
(`config.env`, `mapping-api.env`, `mapping.yaml`) живут **только на VPS** — в репо
лежат лишь `*.example`.

## Сервисы доступов

Поток выдачи доступов: админ на странице «Доступы» в чате матчит группу Keycloak
со спейсами/каналами Matrix и ролью (power level):

```
Чат (вкладка «Доступы») → mapping-api (правила в БД) → matrix-keycloak-sync → Synapse
```

- `services/mapping-api` — FastAPI + Postgres, CRUD правил, admin-гейт через Matrix
  OpenID-токен + членство в Keycloak-группе `GR_chat_admin`. Развёрнут за
  `chat.foxhound.run/api/mapping/*`.
- `services/matrix-keycloak-sync` — синк членства и power level. Источник правил
  переключается через `RULES_SOURCE` (`yaml` | `db`).

Подробности — [docs/access-mapping-design.md](docs/access-mapping-design.md).

## Проверка

Перед пушем прогоняйте полный набор (lint, typecheck, тесты, сборка):

```sh
pnpm verify    # или: scripts/verify.sh
```

## Развёртывание

Веб-клиент раздаётся Caddy как статика на боевом VPS (`chat.foxhound.run`).
Сервисы доступов крутятся в docker-стеке `synapse-test` рядом с Synapse, Postgres
и Caddy. Полная раскладка VPS, домены и процедура деплоя —
[docs/foxhound-infrastructure.md](docs/foxhound-infrastructure.md).

## Репозитории

Основной remote — корпоративный GitLab (`origin`):
`gitlab.surfcoffee.ru/o.ananevsky/matrix-platform`. GitHub
(`Kaverman20/matrix-platform`) оставлен запасной зеркалкой.
