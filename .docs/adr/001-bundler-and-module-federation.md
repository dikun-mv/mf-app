# ADR 001: Bundler and Module Federation (D1)

Status: accepted

## Decision

Rsbuild/Rspack with `@module-federation/rsbuild-plugin`, `@rsbuild/plugin-react`, and the MF 2.0 runtime API from `@module-federation/enhanced/runtime` (`init`, `registerRemotes`, `loadRemote`).

## Alternative

Vite with `@module-federation/vite`.

## Why

MF is native to Rspack. Rsbuild bundles in dev too, so dev serves a real `remoteEntry.js` with the same sharing rules as production, which lowers the risk to the React-singleton requirement. CSS Modules and typed CSS Modules are first-party, and Rstest (ADR 014) reuses the Rsbuild config, so the app and its tests share one pipeline. Cost: less familiar than Vite.
