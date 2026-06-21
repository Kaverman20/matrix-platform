import type { ReactNode } from "react";
import { PreferencesContext, usePreferencesStore } from "./usePreferences";

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const store = usePreferencesStore();
  return <PreferencesContext.Provider value={store}>{children}</PreferencesContext.Provider>;
}
