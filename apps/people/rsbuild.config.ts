import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginTypedCSSModules } from '@rsbuild/plugin-typed-css-modules';
import { version as reactVersion } from 'react';

const NAME = 'people';
const DEV_PORT = 3010;
const GATEWAY_ORIGIN = 'http://localhost:8080';

// The installed version decides the range, so this can't drift from the pnpm catalog.
const singleton = { singleton: true, requiredVersion: `^${reactVersion}` } as const;

export default defineConfig(({ command }) => {
  const isDev = command === 'dev';
  return {
    plugins: [
      pluginReact(),
      pluginTypedCSSModules(),
      pluginModuleFederation({
        name: NAME,
        filename: 'remoteEntry.js',
        // `./App` is what the shell loads (D10); `./mount` is the framework-agnostic seam the standalone page uses.
        exposes: { './App': './src/app/App.tsx', './mount': './src/app/mount.tsx' },
        // react-router is deliberately not shared: each app bundles its own copy (D22).
        shared: { react: singleton, 'react-dom': singleton },
        dts: false,
      }),
    ],
    source: { entry: { index: './src/app/index.ts' } },
    output: {
      // Chunks and CSS resolve against wherever remoteEntry.js was loaded from, not a build-time prefix.
      assetPrefix: 'auto',
      cssModules: {
        localIdentName: `bl-${NAME}-[local]-[hash:base64:5]`,
        exportLocalsConvention: 'camelCaseOnly',
      },
    },
    html: {
      title: 'Baseline: People',
      // The standalone page's only place that names its path (ADR 029 §10). The dev server serves from `/`;
      // the container entrypoint rewrites the built value when BASE_PATH is set.
      tags: [{ tag: 'base', attrs: { href: isDev ? '/' : `/remotes/${NAME}/` }, head: true, append: false }],
    },
    dev: { assetPrefix: `http://localhost:${String(DEV_PORT)}/` },
    server: {
      port: DEV_PORT,
      strictPort: true,
      // Only the shell's dev server may load this dev build cross-origin.
      cors: { origin: 'http://localhost:3000' },
      // The app reads PocketBase at `/api/people` and `/api/delivery` on its own origin; in dev the gateway
      // answers them, so dev talks to the same PocketBase as Docker (T5.0a).
      proxy: { '/api': GATEWAY_ORIGIN },
    },
  };
});
