import { withRsbuildConfig, type WithRsbuildConfigOptions } from '@rstest/adapter-rsbuild';
import { defineConfig } from '@rstest/core';

// The adapter's own type for the Rsbuild config: the root doesn't depend on @rsbuild/core.
type RsbuildConfig = Parameters<NonNullable<WithRsbuildConfigOptions['modifyRsbuildConfig']>>[0];

const COMPONENT_APPS = ['shell', 'people', 'delivery'] as const;

const MODULE_FEDERATION_PLUGIN = 'rsbuild:module-federation-enhanced';

/**
 * Federation stays out of component tests: it turns `react` into a shared module, and Testing Library
 * would then render with a different React than the components under test ("Multiple copies of react").
 * The React plugin, CSS Modules and the rest of the app's Rsbuild config still apply.
 */
function withoutModuleFederation(config: RsbuildConfig): RsbuildConfig {
  const isFederation = (plugin: unknown): boolean =>
    typeof plugin === 'object' && plugin !== null && 'name' in plugin && plugin.name === MODULE_FEDERATION_PLUGIN;
  return { ...config, plugins: (config.plugins ?? []).filter((plugin) => !isFederation(plugin)) };
}

// Separate projects (D14): Node projects for logic, jsdom projects for components.
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
    // One jsdom project per app, each reusing that app's Rsbuild config, so the React plugin and that
    // app's CSS Modules settings apply (ADR 014). Tests next to the code; `src/data/` adapters run in `domain`.
    ...COMPONENT_APPS.map((app) => ({
      name: `components-${app}`,
      extends: withRsbuildConfig({ cwd: `apps/${app}`, modifyRsbuildConfig: withoutModuleFederation }),
      testEnvironment: 'jsdom' as const,
      include: [`apps/${app}/src/**/*.test.{ts,tsx}`],
      exclude: [`apps/${app}/src/data/**`],
      setupFiles: [`apps/${app}/src/test-setup.ts`],
    })),
  ],
});
