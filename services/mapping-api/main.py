"""
mapping-api — FastAPI сервис для управления маппингом Keycloak групп → Matrix Space/Room

ПЕРЕНЕСЕНО из старого воркспейса «Matrix x Element/mapping-api» как базовая
реализация. Готовое: CRUD правил (mapping_rules + mapping_targets, мульти-таргет),
список групп Keycloak, список Space/Room из Synapse, sync trigger/status/logs.

АДАПТАЦИЯ (см. docs/access-mapping-design.md):
  1. AUTH ✅ admin-гейт: Matrix OpenID → @mxid → членство в ADMIN_GROUP (Keycloak).
     verify_admin + /api/v1/whoami.
  4. CORS ✅ same-origin по умолчанию; CHAT_ORIGIN если фронт на другом origin.
  ROLE ✅ роль в mapping_targets (user|moderator|admin) → Matrix power level.

  ОСТАЛОСЬ:
  2. CREATE SPACE: добавить POST /spaces — создание спейса/каналов ботом sync-bot.
  3. SYNC TRIGGER: заглушка под K8s → подключить к docker sync.py. TODO(adapt:sync).
  5. SYNC.PY: перевести matrix-keycloak-sync на чтение mapping_rules из этой БД
     (+ импорт текущего mapping.yaml; + проставление power level по role).
     Прод-выдачу не ломать.
"""
import json
import os
import uuid
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from urllib.parse import quote

import httpx
from fastapi import FastAPI, HTTPException, Depends, Header, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import asyncpg

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
log = logging.getLogger("mapping-api")

# ──────────────────────── Конфиг ────────────────────────────
KEYCLOAK_URL         = os.environ["KEYCLOAK_URL"]
KEYCLOAK_REALM       = os.environ["KEYCLOAK_REALM"]
KEYCLOAK_CLIENT_ID   = os.environ["KEYCLOAK_CLIENT_ID"]
KEYCLOAK_CLIENT_SECRET = os.environ["KEYCLOAK_CLIENT_SECRET"]
MATRIX_HOMESERVER_URL = os.environ["MATRIX_HOMESERVER_URL"]
MATRIX_ADMIN_TOKEN   = os.environ["MATRIX_ADMIN_TOKEN"]
DATABASE_URL         = os.environ["DATABASE_URL"]
KEYCLOAK_CACHE_TTL   = int(os.getenv("KEYCLOAK_CACHE_TTL", "300"))
# Группа Keycloak, дающая доступ к админ-странице «Доступы».
ADMIN_GROUP          = os.getenv("ADMIN_GROUP", "/GR_chat_admin")
# Витрина браузера для CORS (same-origin развёртывание → можно не задавать).
CHAT_ORIGIN          = os.getenv("CHAT_ORIGIN", "")
# Легаси server-to-server секрет (опц.; пользовательские эндпоинты теперь за admin-гейтом).
API_SECRET_TOKEN     = os.getenv("API_SECRET_TOKEN", "")
# Токен sync-bot для создания спейсов/каналов. Если у бота отдельный токен —
# задать BOT_ACCESS_TOKEN; иначе используем admin-токен (уточнить на VPS).
BOT_ACCESS_TOKEN     = os.getenv("BOT_ACCESS_TOKEN", MATRIX_ADMIN_TOKEN)

# ──────────────────────── DB Pool ───────────────────────────
db_pool: asyncpg.Pool = None

async def _init_connection(conn: asyncpg.Connection) -> None:
    # asyncpg по умолчанию отдаёт json/jsonb как строку — регистрируем кодек,
    # чтобы json_agg(...) (targets правил) и jsonb-поля приходили dict/list.
    await conn.set_type_codec(
        "json", encoder=json.dumps, decoder=json.loads, schema="pg_catalog"
    )
    await conn.set_type_codec(
        "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog"
    )

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_pool
    db_pool = await asyncpg.create_pool(
        DATABASE_URL, min_size=2, max_size=10, init=_init_connection
    )
    await init_db()
    log.info("Подключение к БД установлено")
    yield
    await db_pool.close()
    log.info("Подключение к БД закрыто")

async def init_db():
    """Создать таблицы если не существуют."""
    async with db_pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS mapping_rules (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                keycloak_group  TEXT NOT NULL,
                rule_name       TEXT,
                resolve_nested  BOOLEAN DEFAULT FALSE,
                is_active       BOOLEAN DEFAULT TRUE,
                created_at      TIMESTAMPTZ DEFAULT NOW(),
                updated_at      TIMESTAMPTZ DEFAULT NOW(),
                created_by      TEXT
            );

            CREATE TABLE IF NOT EXISTS mapping_targets (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                rule_id         UUID NOT NULL REFERENCES mapping_rules(id) ON DELETE CASCADE,
                matrix_id       TEXT NOT NULL,
                target_type     TEXT NOT NULL CHECK (target_type IN ('space', 'room')),
                display_name    TEXT,
                role            TEXT NOT NULL DEFAULT 'user'
                                CHECK (role IN ('user', 'moderator', 'admin')),
                UNIQUE(rule_id, matrix_id)
            );

            CREATE TABLE IF NOT EXISTS sync_state (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                mxid            TEXT NOT NULL,
                matrix_id       TEXT NOT NULL,
                rule_id         UUID REFERENCES mapping_rules(id) ON DELETE SET NULL,
                synced_at       TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(mxid, matrix_id)
            );

            CREATE TABLE IF NOT EXISTS sync_log (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                started_at      TIMESTAMPTZ DEFAULT NOW(),
                finished_at     TIMESTAMPTZ,
                trigger_type    TEXT NOT NULL,
                trigger_mxid    TEXT,
                users_processed INTEGER DEFAULT 0,
                joins_made      INTEGER DEFAULT 0,
                kicks_made      INTEGER DEFAULT 0,
                errors          INTEGER DEFAULT 0,
                status          TEXT DEFAULT 'running',
                error_details   JSONB
            );

            CREATE INDEX IF NOT EXISTS idx_mapping_rules_group ON mapping_rules(keycloak_group);
            CREATE INDEX IF NOT EXISTS idx_sync_state_mxid ON sync_state(mxid);
            CREATE INDEX IF NOT EXISTS idx_sync_log_started ON sync_log(started_at DESC);
        """)

# ──────────────────────── Приложение ────────────────────────
app = FastAPI(title="mapping-api", version="1.0.0", lifespan=lifespan)

# При same-origin развёртывании (путём на chat.foxhound.run) CORS не нужен.
# Если фронт на другом origin — задать CHAT_ORIGIN, тогда разрешаем только его.
if CHAT_ORIGIN:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[CHAT_ORIGIN],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
        allow_headers=["Authorization", "Content-Type"],
    )

# ──────────────────────── Auth (admin-гейт) ──────────────────
# Фронт шлёт Matrix OpenID-token (как в звонках). Мы валидируем его через
# federation /openid/userinfo → получаем @mxid, затем проверяем в Keycloak,
# что пользователь состоит в ADMIN_GROUP. Иначе 403.

async def _resolve_mxid(authorization: str) -> str:
    """Matrix OpenID access_token → @mxid (через federation userinfo)."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    openid_token = authorization.split(" ", 1)[1]
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{MATRIX_HOMESERVER_URL}/_matrix/federation/v1/openid/userinfo",
            params={"access_token": openid_token})
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Matrix OpenID token")
    sub = resp.json().get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="No subject in OpenID userinfo")
    return sub


async def _is_admin(mxid: str) -> bool:
    """Состоит ли @mxid в ADMIN_GROUP.

    sync.py строит mxid как localpart = username.lower() (mxid_from_username),
    поэтому ищем юзера по localpart и сверяем username без учёта регистра —
    не полагаемся на exact-match по регистру в Keycloak.
    """
    localpart = mxid.lstrip("@").split(":", 1)[0]
    token = await get_keycloak_token()
    async with httpx.AsyncClient(timeout=10) as client:
        users = await client.get(
            f"{KEYCLOAK_URL}/admin/realms/{KEYCLOAK_REALM}/users",
            headers={"Authorization": f"Bearer {token}"},
            params={"username": localpart, "max": 50})
        users.raise_for_status()
        match = next(
            (u for u in users.json() if (u.get("username") or "").lower() == localpart),
            None)
        if not match:
            return False
        groups = await client.get(
            f"{KEYCLOAK_URL}/admin/realms/{KEYCLOAK_REALM}/users/{match['id']}/groups",
            headers={"Authorization": f"Bearer {token}"})
        groups.raise_for_status()
    return ADMIN_GROUP in {g.get("path") for g in groups.json()}


async def verify_admin(authorization: str = Header(...)) -> str:
    """FastAPI-зависимость: пускает только админов, возвращает их @mxid."""
    mxid = await _resolve_mxid(authorization)
    if not await _is_admin(mxid):
        raise HTTPException(status_code=403, detail="Admin access required")
    return mxid

# ──────────────────────── Pydantic модели ───────────────────
class MappingTarget(BaseModel):
    matrix_id: str
    target_type: str  # 'space' или 'room'
    display_name: Optional[str] = None
    role: str = "user"  # 'user' | 'moderator' | 'admin' → Matrix power level

class MappingTargetOut(MappingTarget):
    id: str

class MappingRuleCreate(BaseModel):
    keycloak_group: str
    rule_name: Optional[str] = None
    resolve_nested: bool = False
    targets: list[MappingTarget] = Field(default_factory=list)

class MappingRuleOut(BaseModel):
    id: str
    keycloak_group: str
    rule_name: Optional[str]
    resolve_nested: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    targets: list[MappingTargetOut] = []

class ChannelCreate(BaseModel):
    name: str
    is_private: bool = True  # приватный → restricted к спейсу; публичный → public

class SpaceCreate(BaseModel):
    name: str
    is_public: bool = False
    channels: list[ChannelCreate] = Field(default_factory=list)

class SyncLogOut(BaseModel):
    id: str
    started_at: datetime
    finished_at: Optional[datetime]
    trigger_type: str
    trigger_mxid: Optional[str]
    users_processed: int
    joins_made: int
    kicks_made: int
    errors: int
    status: str

# ──────────────────────── Endpoints ─────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/v1/whoami")
async def whoami(authorization: str = Header(...)):
    """Кто я и админ ли — для показа/скрытия вкладки «Доступы» на фронте.
    Возвращает 200 в обоих случаях (в отличие от защищённых эндпоинтов с 403)."""
    mxid = await _resolve_mxid(authorization)
    return {"mxid": mxid, "is_admin": await _is_admin(mxid)}


# ── Правила маппинга ──────────────────────────────────────

@app.get("/api/v1/rules", response_model=dict, dependencies=[Depends(verify_admin)])
async def list_rules():
    async with db_pool.acquire() as conn:
        rules = await conn.fetch("""
            SELECT r.*, json_agg(
                json_build_object('id', t.id, 'matrix_id', t.matrix_id,
                                  'target_type', t.target_type, 'display_name', t.display_name,
                                  'role', t.role)
                ORDER BY t.target_type, t.matrix_id
            ) FILTER (WHERE t.id IS NOT NULL) as targets
            FROM mapping_rules r
            LEFT JOIN mapping_targets t ON t.rule_id = r.id
            GROUP BY r.id
            ORDER BY r.created_at DESC
        """)
    result = []
    for row in rules:
        r = dict(row)
        r['id'] = str(r['id'])
        r['targets'] = r['targets'] or []
        for t in r['targets']:
            t['id'] = str(t['id'])
        result.append(r)
    return {"rules": result, "total": len(result)}


@app.post("/api/v1/rules", response_model=MappingRuleOut,
          status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_admin)])
async def create_rule(body: MappingRuleCreate):
    async with db_pool.acquire() as conn:
        async with conn.transaction():
            rule = await conn.fetchrow("""
                INSERT INTO mapping_rules (keycloak_group, rule_name, resolve_nested)
                VALUES ($1, $2, $3) RETURNING *
            """, body.keycloak_group,
                body.rule_name or body.keycloak_group.split("/")[-1],
                body.resolve_nested)

            targets = []
            for t in body.targets:
                tgt = await conn.fetchrow("""
                    INSERT INTO mapping_targets (rule_id, matrix_id, target_type, display_name, role)
                    VALUES ($1, $2, $3, $4, $5) RETURNING *
                """, rule['id'], t.matrix_id, t.target_type, t.display_name, t.role)
                targets.append(dict(tgt))

    r = dict(rule)
    r['id'] = str(r['id'])
    r['targets'] = [{**t, 'id': str(t['id'])} for t in targets]
    return r


@app.get("/api/v1/rules/{rule_id}", dependencies=[Depends(verify_admin)])
async def get_rule(rule_id: str):
    async with db_pool.acquire() as conn:
        rule = await conn.fetchrow(
            "SELECT * FROM mapping_rules WHERE id = $1", uuid.UUID(rule_id))
        if not rule:
            raise HTTPException(404, "Rule not found")
        targets = await conn.fetch(
            "SELECT * FROM mapping_targets WHERE rule_id = $1", uuid.UUID(rule_id))
    r = dict(rule)
    r['id'] = str(r['id'])
    r['targets'] = [{**dict(t), 'id': str(t['id'])} for t in targets]
    return r


@app.put("/api/v1/rules/{rule_id}", dependencies=[Depends(verify_admin)])
async def update_rule(rule_id: str, body: MappingRuleCreate):
    async with db_pool.acquire() as conn:
        async with conn.transaction():
            rule = await conn.fetchrow("""
                UPDATE mapping_rules SET
                    keycloak_group = $1, rule_name = $2,
                    resolve_nested = $3, updated_at = NOW()
                WHERE id = $4 RETURNING *
            """, body.keycloak_group,
                body.rule_name or body.keycloak_group.split("/")[-1],
                body.resolve_nested, uuid.UUID(rule_id))
            if not rule:
                raise HTTPException(404, "Rule not found")

            # Пересоздать targets
            await conn.execute(
                "DELETE FROM mapping_targets WHERE rule_id = $1", uuid.UUID(rule_id))
            targets = []
            for t in body.targets:
                tgt = await conn.fetchrow("""
                    INSERT INTO mapping_targets (rule_id, matrix_id, target_type, display_name, role)
                    VALUES ($1, $2, $3, $4, $5) RETURNING *
                """, rule['id'], t.matrix_id, t.target_type, t.display_name, t.role)
                targets.append(dict(tgt))

    r = dict(rule)
    r['id'] = str(r['id'])
    r['targets'] = [{**t, 'id': str(t['id'])} for t in targets]
    return r


@app.delete("/api/v1/rules/{rule_id}", status_code=204, dependencies=[Depends(verify_admin)])
async def delete_rule(rule_id: str):
    async with db_pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM mapping_rules WHERE id = $1", uuid.UUID(rule_id))
    if result == "DELETE 0":
        raise HTTPException(404, "Rule not found")


@app.patch("/api/v1/rules/{rule_id}/toggle", dependencies=[Depends(verify_admin)])
async def toggle_rule(rule_id: str):
    async with db_pool.acquire() as conn:
        rule = await conn.fetchrow("""
            UPDATE mapping_rules SET is_active = NOT is_active, updated_at = NOW()
            WHERE id = $1 RETURNING id, is_active
        """, uuid.UUID(rule_id))
    if not rule:
        raise HTTPException(404, "Rule not found")
    return {"id": str(rule['id']), "is_active": rule['is_active']}


# ── Keycloak и Matrix данные для UI ──────────────────────────

_keycloak_token_cache: dict = {"token": None, "expires_at": 0}

async def get_keycloak_token() -> str:
    import time
    if (_keycloak_token_cache["token"] and
            time.time() < _keycloak_token_cache["expires_at"] - 60):
        return _keycloak_token_cache["token"]
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token",
            data={"client_id": KEYCLOAK_CLIENT_ID,
                  "client_secret": KEYCLOAK_CLIENT_SECRET,
                  "grant_type": "client_credentials"})
        resp.raise_for_status()
        data = resp.json()
        import time
        _keycloak_token_cache["token"] = data["access_token"]
        _keycloak_token_cache["expires_at"] = time.time() + data["expires_in"]
    return _keycloak_token_cache["token"]


@app.get("/api/v1/keycloak/groups", dependencies=[Depends(verify_admin)])
async def get_keycloak_groups():
    """Список всех групп из Keycloak (с кэшем)."""
    token = await get_keycloak_token()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{KEYCLOAK_URL}/admin/realms/{KEYCLOAK_REALM}/groups",
            headers={"Authorization": f"Bearer {token}"},
            params={"briefRepresentation": "false"})
        resp.raise_for_status()
    return {"groups": resp.json()}


@app.get("/api/v1/matrix/rooms", dependencies=[Depends(verify_admin)])
async def get_matrix_rooms(type: Optional[str] = None):
    """Список Space и Room из Synapse."""
    async with httpx.AsyncClient() as client:
        params = {"limit": 500}
        resp = await client.get(
            f"{MATRIX_HOMESERVER_URL}/_synapse/admin/v1/rooms",
            headers={"Authorization": f"Bearer {MATRIX_ADMIN_TOKEN}"},
            params=params)
        resp.raise_for_status()
        rooms = resp.json().get("rooms", [])

    if type == "space":
        rooms = [r for r in rooms if r.get("room_type") == "m.space"]
    elif type == "room":
        rooms = [r for r in rooms if r.get("room_type") != "m.space"]

    return {"rooms": [
        {"room_id": r["room_id"],
         "name": r.get("name", r["room_id"]),
         "type": "space" if r.get("room_type") == "m.space" else "room",
         "joined_members": r.get("joined_members", 0)}
        for r in rooms
    ]}


# ── Создание спейсов/каналов (от лица sync-bot) ─────────────

async def _matrix(method: str, path: str, json_body: Optional[dict] = None) -> dict:
    """Запрос к Matrix CS API от лица бота (BOT_ACCESS_TOKEN)."""
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.request(
            method, f"{MATRIX_HOMESERVER_URL}{path}",
            headers={"Authorization": f"Bearer {BOT_ACCESS_TOKEN}"},
            json=json_body)
    if resp.status_code >= 300:
        raise HTTPException(status_code=502,
                            detail=f"Matrix {method} {path}: {resp.status_code} {resp.text}")
    return resp.json() if resp.content else {}


@app.post("/api/v1/spaces", status_code=status.HTTP_201_CREATED)
async def create_space(body: SpaceCreate, admin_mxid: str = Depends(verify_admin)):
    """Создаёт спейс и каналы ботом; вызвавший админ получает PL100.
    Приватные каналы — restricted к спейсу (членство в спейсе → доступ к каналу)."""
    pl_override = {"users": {admin_mxid: 100}} if admin_mxid else {}

    space = await _matrix("POST", "/_matrix/client/v3/createRoom", {
        "name": body.name,
        "creation_content": {"type": "m.space"},
        "preset": "public_chat" if body.is_public else "private_chat",
        **({"visibility": "public"} if body.is_public else {}),
        **({"invite": [admin_mxid]} if admin_mxid else {}),
        "power_level_content_override": pl_override,
    })
    space_id = space["room_id"]
    server = space_id.split(":", 1)[1] if ":" in space_id else ""

    created_channels = []
    for ch in body.channels:
        create_body: dict = {
            "name": ch.name,
            "preset": "private_chat" if ch.is_private else "public_chat",
            "power_level_content_override": pl_override,
        }
        if ch.is_private:
            # restricted-room (MSC3083) требует room version >= 8.
            create_body["room_version"] = "10"
            create_body["initial_state"] = [{
                "type": "m.room.join_rules", "state_key": "",
                "content": {
                    "join_rule": "restricted",
                    "allow": [{"type": "m.room_membership", "room_id": space_id}],
                },
            }]
        room = await _matrix("POST", "/_matrix/client/v3/createRoom", create_body)
        room_id = room["room_id"]
        # Двусторонняя связь спейс ↔ канал (m.space.child / m.space.parent).
        await _matrix("PUT",
            f"/_matrix/client/v3/rooms/{quote(space_id)}/state/m.space.child/{quote(room_id)}",
            {"via": [server]})
        await _matrix("PUT",
            f"/_matrix/client/v3/rooms/{quote(room_id)}/state/m.space.parent/{quote(space_id)}",
            {"via": [server], "canonical": True})
        created_channels.append({"room_id": room_id, "name": ch.name})

    return {"space_id": space_id, "name": body.name, "channels": created_channels}


# ── Синхронизация ──────────────────────────────────────────

@app.post("/api/v1/sync/trigger")
async def trigger_sync(admin_mxid: str = Depends(verify_admin)):
    """Ставит прогон синхронизации в очередь (sync_log status='requested').
    Реальный запуск (cron/one-shot sync.py) подхватывает запрос — см. TODO(adapt:sync)."""
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO sync_log (trigger_type, trigger_mxid, status)
            VALUES ('manual', $1, 'requested') RETURNING id
        """, admin_mxid)
    log.info("Запрошена синхронизация админом %s", admin_mxid)
    # Реализовано в matrix-keycloak-sync/sync.py (Фаза 2): прогон в RULES_SOURCE=db
    # пишет sync_log и помечает строки status='requested' как обработанные.
    # Запуск самого прогона — по расписанию cron/one-shot на VPS.
    return {"status": "queued", "request_id": str(row["id"])}


@app.get("/api/v1/sync/status", dependencies=[Depends(verify_admin)])
async def sync_status():
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT * FROM sync_log ORDER BY started_at DESC LIMIT 1
        """)
    if not row:
        return {"status": "never_run", "last_sync": None}
    r = dict(row)
    r['id'] = str(r['id'])
    return r


@app.get("/api/v1/sync/logs", dependencies=[Depends(verify_admin)])
async def sync_logs(page: int = 1, per_page: int = 25):
    offset = (page - 1) * per_page
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT * FROM sync_log ORDER BY started_at DESC LIMIT $1 OFFSET $2
        """, per_page, offset)
        total = await conn.fetchval("SELECT COUNT(*) FROM sync_log")
    return {
        "logs": [{**dict(r), 'id': str(r['id'])} for r in rows],
        "total": total,
        "page": page,
        "per_page": per_page
    }
