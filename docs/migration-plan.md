# Migration Plan

The old `Matrix x Element/surf-chat` project is a donor and reference, not a source
to copy wholesale.

## Rules

- Do not move the old `App.tsx` into the new workspace.
- Keep `packages/matrix-core` free of React UI and Vite-specific globals.
- Keep `packages/ui` Matrix-agnostic.
- Put product workflows in `apps/surf-chat-web/src/features/*`.
- Put app orchestration in `apps/surf-chat-web/src/app/*`.
- Run `pnpm verify` after every migration step.

## Order

1. Design foundation: tokens, base styles, motion presets.
2. Matrix core: session, auth, SSO, client startup.
3. React providers: Matrix context and app status.
4. Auth feature: login by password, token, SSO.
5. Chat shell: rail, room list, timeline, right panel.
6. Composer and message actions.
7. Media, voice, forward, selection, threads, spaces.

## Donor Sources

- `surf-chat/src/styles/tokens.css`
- `surf-chat/src/styles/motion.ts`
- `surf-chat/src/matrix/*`
- Focused pieces from `surf-chat/src/App.tsx`, extracted by behavior.

## Phase 2 (P2) — Roadmap  ✅ done (2026-06-16)

P1 закрыт: Matrix SDK изолирован в `packages/matrix-core` (value-импорт в `apps/`
запрещён ESLint), мёртвый код убран, core покрыт 71 unit-тестом. Остаточные
пункты исходного аудита идут фазой P2 в порядке риск/усилие. Все четыре пункта
завершены — детали и обоснования в `docs/DECISIONS.md`.

### P2.1 — Тесты web-слоя
`apps/surf-chat-web` сейчас без тестов (`test` = заглушка). Настраиваем Vitest +
React Testing Library + jsdom и покрываем сначала логику, а не пиксели:
- хуки: `useChatNavigation`, `useFirstUnread`, `useRoomCreation`, `useRoomListLayout`;
- поведенческие куски `Timeline` (read-up-to, first-unread) и `RoomList`.
Цель — поймать регрессии в самых сложных файлах (Timeline 799, RoomList 693,
ChatShell 676 строк).

### P2.2 — Code splitting
`dist/assets/index-*.js` — один монолит ~1.8 MB. Вводим `build.rollupOptions.
output.manualChunks` (vendor: `react`/`react-dom`, `matrix-js-sdk`, `emoji-mart`,
`framer-motion`) и `React.lazy` для тяжёлых модалок (создание комнат/спейсов,
настройки, account). Цель — уменьшить вес начального чанка и распараллелить загрузку.

### P2.3 — crypto-wasm из dist
`matrix_sdk_crypto_wasm_bg-*.wasm` (~5.5 MB) и `rust-crypto-*.js` лежат в `dist`,
но в рантайм не грузятся (E2EE отложен, `enableEncryption` не вызывается —
см. DECISIONS.md). Это штраф на размер деплоя, не на скорость. Исключаем crypto
из сборки (external/resolve-stub), пока E2EE не понадобится. Обратимо.

### P2.4 — Dual CI
Репозиторий живёт на GitHub; `.gitlab-ci.yml` — наследие. Решаем: удалить или
задокументировать назначение (зеркало/раннеры). GitHub Actions (`pnpm verify`)
остаётся основным.

