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

