---
name: firebase-testing
description: Write or review fastify-playground Vitest coverage for Firebase Admin Authentication, app ownership, plugin lifecycle, credentials, emulators, and security failures without contacting live services.
---

# Firebase testing

Read `AGENTS.md`, `app/tests/AGENTS.md`, the affected authentication or Firebase plugin, `app/tests/mocks/firebase.ts`, and neighboring tests. Apply `$adversarial-testing` before changing coverage.

## Mock boundary

- Never use real credentials, project IDs, tokens, Firebase projects, or network access in unit tests.
- Reuse `createFirebaseAppMock` and `createFirebaseAuthMock`.
- Mock `firebase-admin/app` and `firebase-admin/auth` before dynamically importing code that binds those modules.
- Reset modules only when import-time binding requires it; rely on the configured Vitest mock cleanup otherwise.
- Keep fixtures synthetic and free of PII.

## Authentication contract

- Prove strict `Bearer <non-whitespace-token>` parsing before Firebase is called.
- Prove successful verification uses revocation checks and assigns the expected `request.user` fields.
- Prove invalid, expired, and revoked identity failures map to 401.
- Prove configuration, transport, internal, and unknown provider failures map to 503.
- Assert controlled Problem Details and the absence of token or provider-detail leakage.

## App lifecycle contract

- Distinguish the `[DEFAULT]` app from unrelated named apps.
- Prove reuse without deletion, zero-argument initialization through Application Default Credentials, deletion only when the plugin owns the app, and cleanup failure propagation.
- Do not add service-account parsing, Firestore, production test flags, fake credentials, environment backdoors, sleeps, or catch-all mocks.
- Use an emulator only when the task requires real SDK semantics and the emulator environment is explicitly available.

Run the focused test first, then `just check` and `pnpm --dir app build`.
