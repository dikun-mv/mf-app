import { defineConfig } from '@rstest/core';

// Separate projects (D14). The jsdom `components` project arrives with the first
// routed view (T2.3a), reusing each app's Rsbuild config.
export default defineConfig({
  // Run with `pnpm test:coverage`. Phase 1's exit check is about 100% of delivery-domain's branches.
  coverage: {
    provider: 'istanbul',
    include: ['packages/*/src/**/*.ts'],
    // errors.ts and the index files hold only types and re-exports.
    exclude: ['**/*.test.ts', '**/testing/**', '**/index.ts', '**/errors.ts'],
    reporters: ['text', 'html', 'lcov'],
  },
  projects: [
    {
      name: 'domain',
      testEnvironment: 'node',
      include: ['packages/*/src/**/*.test.ts', 'apps/*/src/data/**/*.test.ts'],
    },
    {
      name: 'services',
      testEnvironment: 'node',
      include: ['services/*/src/**/*.test.ts'],
    },
    {
      name: 'tooling',
      testEnvironment: 'node',
      include: ['.dependency-cruiser.test.ts'],
    },
  ],
});
