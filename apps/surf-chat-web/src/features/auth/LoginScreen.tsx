import { useEffect, useState } from "react";
import { Building2, LogIn } from "lucide-react";
import {
  getSsoIdentityProviders,
  type SsoIdentityProvider,
} from "@matrix-platform/matrix-core";
import { useMatrix } from "../../app/providers/MatrixContext";
import "./auth.css";

export function LoginScreen() {
  const {
    defaultHomeserver,
    error,
    loginAccessToken,
    loginPassword,
    loginSso,
    status,
  } = useMatrix();
  const [mode, setMode] = useState<"password" | "token">("password");
  const [homeserver, setHomeserver] = useState(defaultHomeserver);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [ssoProviders, setSsoProviders] = useState<SsoIdentityProvider[]>([]);
  const [showManualLogin, setShowManualLogin] = useState(false);

  const busy = status === "connecting";

  useEffect(() => {
    const value = homeserver.trim();
    let cancelled = false;

    const timer = window.setTimeout(() => {
      if (!value) {
        setSsoProviders([]);
        return;
      }

      void getSsoIdentityProviders(value)
        .then((providers) => {
          if (!cancelled) setSsoProviders(providers);
        })
        .catch(() => {
          if (!cancelled) setSsoProviders([]);
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [homeserver]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    if (mode === "token") {
      const token = accessToken.trim();
      if (token) void loginAccessToken(homeserver, token);
      return;
    }

    if (user.trim() && password) {
      void loginPassword(homeserver, user.trim(), password);
    }
  };

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-card__mark">S</div>
        <h1>Surf Chat</h1>
        <p>Войдите в свой Matrix аккаунт</p>

        <label className="field">
          <span>Домашний сервер</span>
          <input
            value={homeserver}
            onChange={(e) => setHomeserver(e.target.value)}
            placeholder="https://matrix.org"
            autoCapitalize="none"
          />
        </label>

        {ssoProviders.length > 0 && (
          <div className="auth-card__sso">
            {ssoProviders.map((provider) => (
              <button
                key={provider.id}
                type="button"
                className="auth-card__submit auth-card__submit--sso"
                disabled={busy}
                onClick={() => void loginSso(homeserver.trim(), provider.id)}
              >
                <Building2 size={18} />
                {busy ? "Подключаемся..." : `Войти через ${provider.name}`}
              </button>
            ))}
            <button
              type="button"
              className="auth-card__switch"
              onClick={() => setShowManualLogin((value) => !value)}
            >
              {showManualLogin ? "Скрыть другой способ" : "Другой способ входа"}
            </button>
          </div>
        )}

        {(ssoProviders.length === 0 || showManualLogin) && (
          <>
            {mode === "password" ? (
              <>
                <label className="field">
                  <span>Имя пользователя</span>
                  <input
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="username"
                    autoCapitalize="none"
                  />
                </label>
                <label className="field">
                  <span>Пароль</span>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="••••••••"
                  />
                </label>
              </>
            ) : (
              <label className="field">
                <span>Access token</span>
                <input
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="syt_..."
                  autoCapitalize="none"
                />
              </label>
            )}

            <button
              type="button"
              className="auth-card__switch"
              onClick={() => setMode(mode === "password" ? "token" : "password")}
            >
              {mode === "password" ? "Войти по токену доступа" : "Войти по логину и паролю"}
            </button>

            <button className="auth-card__submit" type="submit" disabled={busy}>
              <LogIn size={18} />
              {busy ? "Подключаемся..." : "Войти"}
            </button>
          </>
        )}

        {error && <div className="auth-card__error">{error}</div>}
      </form>
    </main>
  );
}

