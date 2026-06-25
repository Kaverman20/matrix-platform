// Мост, который десктоп-оболочка (Electron, apps/surf-chat-desktop) выставляет
// в window через preload. В вебе он отсутствует — поэтому поле опциональное.
export {};

declare global {
  interface SurfDesktopBridge {
    readonly isDesktop: true;
    readonly platform: NodeJS.Platform | string;
    /** Поднять loopback-сервер; возвращает redirectUrl со state для SSO. */
    beginSso: () => Promise<string>;
    /** Открыть SSO-страницу логина в системном браузере. */
    openSso: (url: string) => Promise<boolean>;
    /** Подписка на возврат SSO-токена (deep-link). Возвращает функцию отписки. */
    onSsoCallback: (callback: (data: { loginToken: string }) => void) => () => void;
  }

  interface Window {
    surfDesktop?: SurfDesktopBridge;
  }
}
