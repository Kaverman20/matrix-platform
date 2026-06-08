# Matrix Core

Shared Matrix protocol boundary for client apps.

This package should contain SDK wrappers, domain operations, and protocol-specific
types. UI packages and app features should not talk to `matrix-js-sdk` directly
unless there is a deliberate exception.

## Current Modules

```txt
src/
  auth/       Password login, access-token login, SSO helpers
  client/     Matrix client startup
  discovery/  Homeserver .well-known resolution
  rooms/      Room and Space summaries
  session/    Session type and storage helpers
  timeline/   Message summaries and send operations
```

`matrix-core` deliberately avoids React and Vite globals. Web-specific storage,
redirects, and provider state belong in `apps/surf-chat-web`.
