# Auth

Login, SSO redirect handling, session restore UI, and logout entry points.

Current scope:

- password login
- access-token login
- SSO provider discovery and redirect

Session restore and client boot live in `src/app/providers/MatrixProvider.tsx`.
