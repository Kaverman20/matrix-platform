import { useCallback, useEffect, useState } from "react";
import { Key, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useMatrix } from "../../app/providers/MatrixContext";
import {
  accessApi,
  type AccessRole,
  type KeycloakGroup,
  type MatrixRoom,
  type Rule,
  type SyncStatus,
} from "./accessApi";

const ROLE_LABEL: Record<AccessRole, string> = {
  user: "Участник",
  moderator: "Модератор",
  admin: "Админ",
};

export function AccessTab() {
  const { client } = useMatrix();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [groups, setGroups] = useState<KeycloakGroup[]>([]);
  const [spaces, setSpaces] = useState<MatrixRoom[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [status, setStatus] = useState<SyncStatus | null>(null);

  // Форма добавления правила.
  const [groupPath, setGroupPath] = useState("");
  const [spaceIds, setSpaceIds] = useState<string[]>([]);
  const [role, setRole] = useState<AccessRole>("user");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Создание спейса.
  const [showCreate, setShowCreate] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const [spacePublic, setSpacePublic] = useState(false);
  const [channelsText, setChannelsText] = useState("");
  const [creating, setCreating] = useState(false);

  const [applying, setApplying] = useState(false);

  const refreshRules = useCallback(async () => {
    if (!client) return;
    const [r, st] = await Promise.all([accessApi.listRules(client), accessApi.syncStatus(client)]);
    setRules(r);
    setStatus(st);
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    // async-IIFE: setState не синхронно в теле эффекта (правило React Compiler).
    void (async () => {
      if (!client) {
        if (!cancelled) {
          setLoading(false);
          setLoadError("Нет активной сессии");
        }
        return;
      }
      if (!cancelled) setLoading(true);
      try {
        const [g, sp, r, st] = await Promise.all([
          accessApi.groups(client),
          accessApi.spaces(client),
          accessApi.listRules(client),
          accessApi.syncStatus(client).catch(() => null),
        ]);
        if (cancelled) return;
        setGroups(g);
        setSpaces(sp);
        setRules(r);
        setStatus(st);
        setLoadError(null);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Ошибка загрузки");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  const toggleSpace = (id: string) =>
    setSpaceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const saveRule = async () => {
    if (!client || !groupPath || spaceIds.length === 0) {
      setFormError("Выберите группу и хотя бы один спейс");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await accessApi.createRule(client, {
        keycloak_group: groupPath,
        targets: spaceIds.map((id) => ({
          matrix_id: id,
          target_type: "space" as const,
          display_name: spaces.find((s) => s.room_id === id)?.name,
          role,
        })),
      });
      setGroupPath("");
      setSpaceIds([]);
      setRole("user");
      await refreshRules();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const removeRule = async (id: string) => {
    if (!client) return;
    try {
      await accessApi.deleteRule(client, id);
      await refreshRules();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Не удалось удалить");
    }
  };

  const createSpace = async () => {
    if (!client || !spaceName.trim()) return;
    setCreating(true);
    try {
      const channels = channelsText
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({ name, is_private: !spacePublic }));
      await accessApi.createSpace(client, { name: spaceName.trim(), is_public: spacePublic, channels });
      setSpaceName("");
      setChannelsText("");
      setSpacePublic(false);
      setShowCreate(false);
      setSpaces(await accessApi.spaces(client));
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Не удалось создать спейс");
    } finally {
      setCreating(false);
    }
  };

  const applyNow = async () => {
    if (!client) return;
    setApplying(true);
    try {
      await accessApi.triggerSync(client);
      setStatus(await accessApi.syncStatus(client));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Не удалось запустить синхронизацию");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="settings-tab">
      <h2 className="settings-tab__title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Key size={20} />
        Доступы
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            color: "var(--color-text-muted)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            padding: "2px 8px",
          }}
        >
          <ShieldCheck size={12} /> только админ
        </span>
      </h2>

      {loading && <p style={{ color: "var(--color-text-muted)" }}>Загрузка…</p>}

      {loadError && !loading && (
        <p style={{ color: "var(--color-danger, #c0392b)" }}>{loadError}</p>
      )}

      {!loading && !loadError && (
        <>
          {/* Добавить правило */}
          <div
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              padding: 16,
              marginBottom: 18,
            }}
          >
            <p style={{ fontWeight: 500, margin: "0 0 12px" }}>Добавить правило</p>

            <label style={{ display: "block", fontSize: 13, color: "var(--color-text-muted)" }}>
              Группа Keycloak
              <select
                value={groupPath}
                onChange={(e) => setGroupPath(e.target.value)}
                style={{ display: "block", width: "100%", maxWidth: 360, marginTop: 4 }}
              >
                <option value="">— выберите группу —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.path}>
                    {g.path}
                  </option>
                ))}
              </select>
            </label>

            <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "12px 0 6px" }}>
              Спейсы
            </p>
            <div
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                maxHeight: 200,
                overflow: "auto",
              }}
            >
              {spaces.length === 0 && (
                <p style={{ padding: 10, margin: 0, color: "var(--color-text-muted)", fontSize: 13 }}>
                  Спейсов нет — создайте ниже.
                </p>
              )}
              {spaces.map((s) => (
                <label
                  key={s.room_id}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", fontSize: 14 }}
                >
                  <input
                    type="checkbox"
                    checked={spaceIds.includes(s.room_id)}
                    onChange={() => toggleSpace(s.room_id)}
                  />
                  {s.name || s.room_id}
                </label>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
              <label style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                Роль
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as AccessRole)}
                  style={{ display: "block", marginTop: 4 }}
                >
                  <option value="user">Участник</option>
                  <option value="moderator">Модератор</option>
                  <option value="admin">Админ</option>
                </select>
              </label>
              <button
                type="button"
                disabled={saving}
                onClick={saveRule}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--color-text)",
                  color: "var(--color-bg)",
                  cursor: "pointer",
                }}
              >
                {saving ? "Сохраняю…" : "Сохранить правило"}
              </button>
              {formError && <span style={{ color: "var(--color-danger, #c0392b)", fontSize: 13 }}>{formError}</span>}
            </div>
          </div>

          {/* Список правил */}
          <p style={{ fontWeight: 500, margin: "0 0 10px" }}>Правила доступа</p>
          {rules.length === 0 && (
            <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>Правил пока нет.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rules.map((rule) => (
              <div
                key={rule.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              >
                <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{rule.keycloak_group}</span>
                <span style={{ color: "var(--color-text-muted)" }}>→</span>
                {rule.targets.map((t) => (
                  <span
                    key={t.matrix_id}
                    style={{
                      fontSize: 12,
                      background: "var(--color-bg-subtle)",
                      borderRadius: 8,
                      padding: "3px 9px",
                    }}
                  >
                    {t.display_name || t.matrix_id} · {ROLE_LABEL[t.role] ?? t.role}
                  </span>
                ))}
                <button
                  type="button"
                  aria-label="Удалить правило"
                  onClick={() => removeRule(rule.id)}
                  style={{
                    marginLeft: "auto",
                    border: "none",
                    background: "transparent",
                    color: "var(--color-text-muted)",
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          {/* Создание спейса + применить */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              borderTop: "1px solid var(--color-border)",
              marginTop: 18,
              paddingTop: 16,
            }}
          >
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-subtle)",
                color: "var(--color-text)",
                cursor: "pointer",
              }}
            >
              <Plus size={16} /> Создать спейс
            </button>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
              {status && (
                <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  синк: {status.status}
                </span>
              )}
              <button
                type="button"
                disabled={applying}
                onClick={applyNow}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-bg-subtle)",
                  color: "var(--color-text)",
                  cursor: "pointer",
                }}
              >
                <RefreshCw size={16} /> {applying ? "Запускаю…" : "Применить сейчас"}
              </button>
            </div>
          </div>

          {showCreate && (
            <div
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                padding: 16,
                marginTop: 12,
              }}
            >
              <label style={{ display: "block", fontSize: 13, color: "var(--color-text-muted)" }}>
                Название спейса
                <input
                  value={spaceName}
                  onChange={(e) => setSpaceName(e.target.value)}
                  style={{ display: "block", width: "100%", maxWidth: 360, marginTop: 4 }}
                />
              </label>
              <label style={{ display: "block", fontSize: 13, color: "var(--color-text-muted)", marginTop: 10 }}>
                Каналы (через запятую или с новой строки)
                <textarea
                  value={channelsText}
                  onChange={(e) => setChannelsText(e.target.value)}
                  rows={3}
                  style={{ display: "block", width: "100%", maxWidth: 360, marginTop: 4 }}
                />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 14 }}>
                <input type="checkbox" checked={spacePublic} onChange={(e) => setSpacePublic(e.target.checked)} />
                Публичный спейс
              </label>
              <button
                type="button"
                disabled={creating || !spaceName.trim()}
                onClick={createSpace}
                style={{
                  marginTop: 12,
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--color-text)",
                  color: "var(--color-bg)",
                  cursor: "pointer",
                }}
              >
                {creating ? "Создаю…" : "Создать (ботом)"}
              </button>
              <span style={{ marginLeft: 10, fontSize: 12, color: "var(--color-text-muted)" }}>
                Создаётся от @sync-bot
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
