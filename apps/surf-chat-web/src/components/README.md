# Components

Shared app-level UI components. These components must not depend on Matrix SDK
details (that boundary lives in `@matrix-platform/matrix-core`).

- `EmojiPicker` — lazily-loaded emoji-mart wrapper (keeps the ~510 kB emoji set
  off the initial bundle; loaded only when a picker opens).
