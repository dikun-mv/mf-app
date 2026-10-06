# ADR 026: TypeScript 6, not 7

Status: accepted (not one of the plan's D1-D25; found during Phase 0)

## Decision

The workspace pins `typescript@^6.0.3`, not the current `latest` (7.0.x, the native compiler).

## Why

dependency-cruiser 18.5 needs the JavaScript compiler API to read `.ts` files. With TypeScript 7 it prints `missing-typescript-transpiler` and cruises 0 modules, so every boundary rule would pass vacuously. With TypeScript 6 it reads the sources. Rslint doesn't depend on the installed `typescript` package, because it ships its own native type checker.

## Revisit

When dependency-cruiser supports TypeScript 7, move to it. The pin is in the root `package.json`; it is the only place to change.
