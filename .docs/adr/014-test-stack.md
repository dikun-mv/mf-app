# ADR 014: Test stack (D14)

Status: accepted; amended 2026-10-08 (Playwright E2E dropped, see the end)

## Decision

Rstest (`@rstest/core`) for the domain, contracts, services, client adapters and components; `fast-check` (property tests); `expect-type` and `@ts-expect-error` (type-level tests); `@testing-library/react`, `user-event` and `jest-dom` (components, jsdom); Playwright (E2E, in its Docker image).

## Alternative

Vitest.

## Why

Rstest reuses each app's Rsbuild config, so components are tested through the same CSS Modules and React transforms as the app. Its API is Jest-compatible. The domain tests use only the core runner API, so moving them to Vitest would only mean changing the import.

## Verified in T0.3 (Rstest 0.12.3)

Checked in a scratch project with the pinned versions. All of these work:

- **Multi-project config.** Inline `projects` entries, each with its own `name`, `include` and `testEnvironment`.
- **jsdom.** As a per-project `testEnvironment`.
- **Reuse of the Rsbuild config.** Each component project uses `extends: withRsbuildConfig({ cwd: 'apps/<app>' })` from `@rstest/adapter-rsbuild`. `pluginReact` and the app's CSS Modules settings apply.
- **Coverage.** The istanbul provider (`@rstest/coverage-istanbul`).
- **`jest-dom` matchers.** Registered with `expect.extend(matchers)` from `@testing-library/jest-dom/matchers`.

Two workarounds are needed:

1. **Matcher types.** The `jest-dom` matchers are not typed by default. The `components` project needs a declaration file:

   ```ts
   import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';
   declare module '@rstest/core' {
     interface Assertion<T = any> extends TestingLibraryMatchers<unknown, T> {}
   }
   ```

   `T = any` must mirror Rstest's own declaration, so this one line carries a lint suppression for `no-explicit-any`, with a comment.

2. **Coverage `include`.** Keep it to `*.ts`/`*.tsx`. A glob that also matches `*.module.css` prints a harmless "can not generate coverage" warning per CSS file.

## Phase 1 additions

`pnpm test:coverage` runs the istanbul provider over `packages/*/src`. Property tests read `FC_RUNS` for the number of runs (default 300 to 400), so `FC_RUNS=5000 pnpm test` runs them much harder.

## Phase 0 layout

Projects `domain`, `services` and `tooling` (the dependency-rule fixtures in `.dependency-cruiser.test.ts`). The jsdom `components` project is added with T2.3a.

_Since T2.3a (2026-10-06) and T4.6 (2026-10-07): there is one jsdom `components-<app>` project per app instead, each extending that app's Rsbuild config ([ADR 030](030-module-federation-skeleton.md)), plus `components-ui` for `packages/ui`'s tests on the shell's config. Integration tests against the running stack have their own config, `rstest.integration.config.ts`._

## Amended 2026-10-08

Playwright E2E is dropped: T8.1 is out of scope. The cross-app scenarios were checked by hand in a browser (Phase 7, and the plan §5 checklist in T8.4) with the `playwright-cli` skill, and no E2E suite or `e2e` compose profile exists.
