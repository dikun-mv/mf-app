import { defineConfig } from '@rstest/core';

// Separate projects (D14). The jsdom `components` project arrives with the first
// routed view (T2.3a), reusing each app's Rsbuild config.
export default defineConfig({
  // Until Phase 1 lands, only the tooling project has tests.
  passWithNoTests: true,
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
      include: ['infra/**/*.test.ts'],
    },
  ],
});
