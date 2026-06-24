import type { MatrixClient } from "matrix-js-sdk";

// База mapping-api. По умолчанию same-origin путём на chat-домен (Caddy роутит
// /api/mapping/* в контейнер), поэтому без CORS. Можно переопределить env'ом.
const BASE = import.meta.env.VITE_MAPPING_API_BASE ?? "/api/mapping";

export type Whoami = { mxid: string; is_admin: boolean };

export type KeycloakGroupRaw = {
  id: string;
  name: string;
  path: string;
  subGroups?: KeycloakGroupRaw[];
};
export type KeycloakGroup = { id: string; name: string; path: string };

export type MatrixRoom = {
  room_id: string;
  name: string;
  type: "space" | "room";
  joined_members: number;
};

export type AccessRole = "user" | "moderator" | "admin";

export type Target = {
  matrix_id: string;
  target_type: "space" | "room";
  display_name?: string | null;
  role: AccessRole;
};

export type Rule = {
  id: string;
  keycloak_group: string;
  rule_name?: string | null;
  is_active: boolean;
  targets: Target[];
};

export type RuleCreate = {
  keycloak_group: string;
  rule_name?: string;
  targets: Target[];
};

export type SyncStatus = {
  status: string;
  finished_at?: string | null;
  started_at?: string | null;
  joins_made?: number;
  kicks_made?: number;
  errors?: number;
};

export type SpaceCreate = {
  name: string;
  is_public: boolean;
  channels: { name: string; is_private: boolean }[];
};

// Matrix OpenID-токен короткоживущий — кэшируем с запасом и обновляем по 401.
let tokenCache: { token: string; exp: number } | null = null;

async function openIdToken(client: MatrixClient): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.exp > now + 30_000) return tokenCache.token;

  const userId = client.getUserId();
  const accessToken = client.getAccessToken();
  if (!userId || !accessToken) throw new Error("Нет активной сессии Matrix");

  const hsUrl = client.getHomeserverUrl().replace(/\/$/, "");
  const path = `/_matrix/client/v3/user/${encodeURIComponent(userId)}/openid/request_token`;
  const res = await fetch(`${hsUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error(`OpenID token: HTTP ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  tokenCache = { token: data.access_token, exp: now + (data.expires_in ?? 3600) * 1000 };
  return tokenCache.token;
}

async function call<T>(
  client: MatrixClient,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await openIdToken(client);
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    tokenCache = null;
    throw new Error("Сессия истекла — обновите страницу");
  }
  if (res.status === 403) throw new Error("Нужны права администратора");
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { detail?: string; error?: string };
      detail = j.detail ?? j.error ?? "";
    } catch {
      // тело не JSON
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Keycloak отдаёт дерево групп с subGroups — разворачиваем в плоский список. */
export function flattenGroups(raw: KeycloakGroupRaw[]): KeycloakGroup[] {
  const out: KeycloakGroup[] = [];
  const walk = (groups: KeycloakGroupRaw[]) => {
    for (const g of groups) {
      out.push({ id: g.id, name: g.name, path: g.path });
      if (g.subGroups?.length) walk(g.subGroups);
    }
  };
  walk(raw);
  return out;
}

export const accessApi = {
  whoami: (c: MatrixClient) => call<Whoami>(c, "GET", "/api/v1/whoami"),
  groups: async (c: MatrixClient) =>
    flattenGroups((await call<{ groups: KeycloakGroupRaw[] }>(c, "GET", "/api/v1/keycloak/groups")).groups),
  spaces: async (c: MatrixClient) =>
    (await call<{ rooms: MatrixRoom[] }>(c, "GET", "/api/v1/matrix/rooms?type=space")).rooms,
  listRules: async (c: MatrixClient) =>
    (await call<{ rules: Rule[] }>(c, "GET", "/api/v1/rules")).rules,
  createRule: (c: MatrixClient, body: RuleCreate) =>
    call<Rule>(c, "POST", "/api/v1/rules", body),
  deleteRule: (c: MatrixClient, id: string) =>
    call<void>(c, "DELETE", `/api/v1/rules/${encodeURIComponent(id)}`),
  createSpace: (c: MatrixClient, body: SpaceCreate) =>
    call<{ space_id: string; name: string }>(c, "POST", "/api/v1/spaces", body),
  triggerSync: (c: MatrixClient) =>
    call<{ status: string }>(c, "POST", "/api/v1/sync/trigger"),
  syncStatus: (c: MatrixClient) => call<SyncStatus>(c, "GET", "/api/v1/sync/status"),
};
