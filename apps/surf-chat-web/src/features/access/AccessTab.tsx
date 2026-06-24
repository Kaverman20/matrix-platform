import { useCallback, useEffect, useMemo, useState } from "react";
import { Key, Layers, Plus, RefreshCw, Search, ShieldCheck, Trash2, Users } from "lucide-react";
import { useMatrix } from "../../app/providers/MatrixContext";
import { SearchSelect } from "./SearchSelect";
import {
  accessApi,
  type AccessRole,
  type KeycloakGroup,
  type MatrixRoom,
  type Rule,
  type SyncStatus,
} from "./accessApi";
import "./access.css";

const ROLES: { value: AccessRole; label: string }[] = [
  { value: "user", label: "Участник" },
  { value: "moderator", label: "Модератор" },
  { value: "admin", label: "Админ" },
];
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

  // Форма правила.
  const [groupPath, setGroupPath] = useState("");
  const [spaceIds, setSpaceIds] = useState<string[]>([]);
  const [role, setRole] = useState<AccessRole>("user");
  const [spaceQuery, setSpaceQuery] = useState("");
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

  const groupOptions = useMemo(
    () => groups.map((g) => ({ value: g.path, label: g.path })),
    [groups],
  );
  const filteredSpaces = useMemo(() => {
    const q = spaceQuery.trim().toLowerCase();
    return q
      ? spaces.filter((s) => (s.name || s.room_id).toLowerCase().includes(q))
      : spaces;
  }, [spaces, spaceQuery]);

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
      setSpaceQuery("");
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
    setFormError(null);
    try {
      const channels = channelsText
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({ name, is_private: !spacePublic }));
      await accessApi.createSpace(client, {
        name: spaceName.trim(),
        is_public: spacePublic,
        channels,
      });
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
    <div className="settings-tab access-tab">
      <h2 className="settings-tab__title">
        <Key size={20} style={{ verticalAlign: "-3px", marginRight: 8 }} />
        Доступы
        <span className="access-tab__badge" style={{ marginLeft: 10 }}>
          <ShieldCheck size={12} /> только админ
        </span>
      </h2>

      {loading && <p className="access-muted">Загрузка…</p>}
      {loadError && !loading && <p className="access-error">{loadError}</p>}

      {!loading && !loadError && (
        <>
          {/* Добавить правило */}
          <section className="access-card">
            <div className="access-card__title">Добавить правило</div>

            <div className="settings-field">
              <label className="settings-field__label">Группа Keycloak</label>
              <SearchSelect
                value={groupPath}
                options={groupOptions}
                onChange={setGroupPath}
                placeholder="— выберите группу —"
                searchPlaceholder="Поиск группы…"
                ariaLabel="Группа Keycloak"
              />
            </div>

            <div className="settings-field">
              <label className="settings-field__label">
                Спейсы{spaceIds.length > 0 ? ` · выбрано ${spaceIds.length}` : ""}
              </label>
              <div className="access-spaces">
                <div className="access-search">
                  <Search size={15} />
                  <input
                    value={spaceQuery}
                    onChange={(e) => setSpaceQuery(e.target.value)}
                    placeholder="Поиск спейса…"
                    aria-label="Поиск спейса"
                  />
                </div>
                <div className="access-spaces__list">
                  {filteredSpaces.length === 0 && (
                    <div className="access-spaces__empty">
                      {spaces.length === 0 ? "Спейсов нет — создайте ниже." : "Ничего не найдено."}
                    </div>
                  )}
                  {filteredSpaces.map((s) => (
                    <label key={s.room_id} className="access-spaces__row">
                      <input
                        type="checkbox"
                        checked={spaceIds.includes(s.room_id)}
                        onChange={() => toggleSpace(s.room_id)}
                      />
                      <Layers size={15} style={{ color: "var(--color-text-muted)", flex: "none" }} />
                      <span className="access-spaces__name">{s.name || s.room_id}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="settings-field">
              <label className="settings-field__label">Роль</label>
              <div className="access-roles">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    className={role === r.value ? "is-active" : undefined}
                    onClick={() => setRole(r.value)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="access-actions">
              <button
                type="button"
                className="surf-btn surf-btn--primary"
                disabled={saving}
                onClick={saveRule}
              >
                {saving ? "Сохраняю…" : "Сохранить правило"}
              </button>
              {formError && <span className="access-error">{formError}</span>}
            </div>
          </section>

          {/* Список правил */}
          <section>
            <div className="access-section__title" style={{ marginBottom: "var(--space-3)" }}>
              Правила доступа
            </div>
            {rules.length === 0 ? (
              <p className="access-muted">Правил пока нет.</p>
            ) : (
              <div className="access-rules">
                {rules.map((rule) => (
                  <div key={rule.id} className="access-rule">
                    <span className="access-rule__group">
                      <Users size={14} /> {rule.keycloak_group}
                    </span>
                    <span className="access-rule__arrow">→</span>
                    {rule.targets.map((t) => (
                      <span key={t.matrix_id} className="access-chip">
                        <Layers size={12} />
                        {t.display_name || t.matrix_id} · {ROLE_LABEL[t.role] ?? t.role}
                      </span>
                    ))}
                    <button
                      type="button"
                      className="surf-btn surf-btn--ghost access-rule__del"
                      aria-label="Удалить правило"
                      onClick={() => removeRule(rule.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Создание спейса + применить */}
          <div className="access-footer">
            <button
              type="button"
              className="surf-btn surf-btn--secondary"
              onClick={() => setShowCreate((v) => !v)}
            >
              <Plus size={16} /> Создать спейс
            </button>
            <span className="access-hint">создаётся от @sync-bot</span>
            <div className="access-footer__right">
              {status && <span className="access-hint">синк: {status.status}</span>}
              <button
                type="button"
                className="surf-btn surf-btn--secondary"
                disabled={applying}
                onClick={applyNow}
              >
                <RefreshCw size={16} /> {applying ? "Запускаю…" : "Применить сейчас"}
              </button>
            </div>
          </div>

          {showCreate && (
            <section className="access-card">
              <div className="settings-field">
                <label className="settings-field__label">Название спейса</label>
                <input
                  className="surf-input"
                  value={spaceName}
                  onChange={(e) => setSpaceName(e.target.value)}
                  placeholder="Например, Отдел продаж"
                />
              </div>
              <div className="settings-field">
                <label className="settings-field__label">Каналы (через запятую или с новой строки)</label>
                <textarea
                  className="surf-input"
                  style={{ height: "auto", minHeight: 72, padding: "10px 12px", resize: "vertical" }}
                  rows={3}
                  value={channelsText}
                  onChange={(e) => setChannelsText(e.target.value)}
                  placeholder="general, анонсы, поддержка"
                />
              </div>
              <label className="access-spaces__row" style={{ padding: 0 }}>
                <input
                  type="checkbox"
                  checked={spacePublic}
                  onChange={(e) => setSpacePublic(e.target.checked)}
                />
                Публичный спейс
              </label>
              <div className="access-actions">
                <button
                  type="button"
                  className="surf-btn surf-btn--primary"
                  disabled={creating || !spaceName.trim()}
                  onClick={createSpace}
                >
                  {creating ? "Создаю…" : "Создать (ботом)"}
                </button>
                <span className="access-hint">Создаётся от @sync-bot</span>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
