import { defineConfig } from '@rstest/core';

// Integration tests for the data services (T3.9): the real PocketBase instances, reached through
// the gateway with the pocketbase SDK. Start the stack and reset it first:
//
//   docker compose up -d --build --wait && infra/scripts/reset.sh && pnpm test:integration
//
// Each service's tests import their own `test/integration/setup.ts`, which puts the `eventsource`
// polyfill on globalThis. They are kept out of `pnpm test` (the `services` project in
// rstest.config.ts excludes `test/integration/`) because they need the running stack.
export default defineConfig({
  name: 'integration',
  testEnvironment: 'node',
  include: ['services/*/test/integration/**/*.test.ts'],
  // The files share two live databases, so they run one after another.
  pool: { maxWorkers: 1 },
  // Real HTTP calls and realtime waits.
  testTimeout: 30_000,
  hookTimeout: 30_000,
});
