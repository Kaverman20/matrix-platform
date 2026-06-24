import { useEffect, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import { accessApi } from "./accessApi";

/**
 * Спрашивает у mapping-api, админ ли текущий пользователь (membership в
 * ADMIN_GROUP). Используется, чтобы показать/скрыть вкладку «Доступы».
 * Любая ошибка (нет backend, не админ) → isAdmin=false, вкладка скрыта.
 */
export function useAccessAdmin(client: MatrixClient | null): { isAdmin: boolean; loading: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // async-IIFE: setState уходит в микротаску, а не синхронно в теле эффекта
    // (правило React Compiler против синхронного setState в эффекте).
    void (async () => {
      if (!client) {
        if (!cancelled) setLoading(false);
        return;
      }
      if (!cancelled) setLoading(true);
      try {
        const who = await accessApi.whoami(client);
        if (!cancelled) setIsAdmin(who.is_admin);
      } catch {
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  return { isAdmin, loading };
}
