import { createRequire } from 'node:module';
import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginTypedCSSModules } from '@rsbuild/plugin-typed-css-modules';

const NAME = 'shell';

// The installed version decides the range, so this can't drift from the pnpm catalog.
const reactVersion = (createRequire(import.meta.url)('react/package.json') as { version: string }).version;
const singleton = { singleton: true, requiredVersion: `^${reactVersion}` } as const;

export default defineConfig({
  plugins: [
    pluginReact(),
    pluginTypedCSSModules(),
    pluginModuleFederation({
      name: NAME,
      // No `remotes`: they are registered at runtime from /config.json (T2.4).
      shared: { react: singleton, 'react-dom': singleton },
      dts: false,
    }),
  ],
  source: { entry: { index: './src/index.ts' } },
  output: {
    // Absolute asset URLs, so a reload on a deep link such as /people/emp-003 still finds its scripts and CSS.
    assetPrefix: '/',
    cssModules: {
      localIdentName: `bl-${NAME}-[local]-[hash:base64:5]`,
      exportLocalsConvention: 'camelCaseOnly',
    },
  },
  html: { title: 'Baseline' },
  dev: { assetPrefix: '/' },
  server: { port: 3000, strictPort: true },
});
