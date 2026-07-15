---
name: firebase-testing
description: Write or review fastify-playground Vitest coverage for Firebase Admin, Firebase Authentication, Firestore health checks, plugin lifecycle, credentials, emulators, and security failures without contacting live services.
---

# Firebase testing

Read `AGENTS.md`, `app/tests/AGENTS.md`, the affected Firebase plugin or route, `app/tests/mocks/firebase.ts`, and neighboring tests before adding mocks.

## Isolation

- Never use real credentials, project IDs, tokens, Firebase projects, or network access in unit tests.
- Reuse `createFirebaseAppMock`, `createFirebaseAuthMock`, `createFirestoreMock`, and `resetFirebaseMocks`.
- Mock `firebase-admin/app`, `firebase-admin/auth`, and `firebase-admin/firestore` before dynamically importing code that binds those modules.
- Reset modules only when import-time state requires it. Let Vitest clear, reset, and restore ordinary mocks automatically.
- Keep fixtures synthetic and free of PII.

## Contracts to cover

For authentication, cover missing and malformed bearer headers, valid tokens, revoked tokens, verification dependency failures, `checkRevoked`, and `request.user` assignment. Assert safe Problem Details and relevant headers without reproducing token values.

For Firebase lifecycle, cover reuse of an existing app, zero-argument initialization through Application Default Credentials, Fastify decorators, Firestore health checks, shutdown termination, and failure propagation. The application must not import or parse service-account JSON itself. Use emulator tests only when the task explicitly requires real SDK semantics and the emulator environment is available.

Do not add production test flags, fake credentials, environment backdoors, sleeps, or catch-all mocks that make unexpected calls pass.

Run the focused test, then `just test-unit`, `just typing`, and `just test`.
