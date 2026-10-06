/**
 * Boundary rules (D23). Three owners, by path:
 *   People team:   apps/people,   services/people-api,   packages/people-domain,   packages/people-contract
 *   Delivery team: apps/delivery, services/delivery-api, packages/delivery-domain, packages/delivery-contract
 *   Platform:      apps/shell, packages/ui, packages/host-contract
 * Only `*-contract` packages and `ui` may cross a team line. Each rule is proved to fail by
 * infra/dependency-rules/rules.test.ts.
 */

const PEOPLE = '^(apps/people|services/people-api|packages/people-domain|packages/people-contract)/';
const DELIVERY = '^(apps/delivery|services/delivery-api|packages/delivery-domain|packages/delivery-contract)/';
const PEOPLE_INTERNALS = '^(apps/people|services/people-api|packages/people-domain)/';
const DELIVERY_INTERNALS = '^(apps/delivery|services/delivery-api|packages/delivery-domain)/';

/** Resolved path of an installed npm package, whether flat or inside pnpm's virtual store. */
const npmPackage = (names) => `(^|/)node_modules/(${names.join('|')})/`;

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-cross-app',
      comment: 'An app never imports another app. Apps meet only at runtime, through Module Federation.',
      severity: 'error',
      from: { path: '^apps/([^/]+)/' },
      to: { path: '^apps/', pathNot: '^apps/$1/' },
    },
    {
      name: 'no-cross-team-internals-people',
      comment:
        "People never imports Delivery's app, service or domain. Only *-contract packages and ui cross team lines.",
      severity: 'error',
      from: { path: PEOPLE },
      to: { path: DELIVERY_INTERNALS },
    },
    {
      name: 'no-cross-team-internals-delivery',
      comment:
        "Delivery never imports People's app, service or domain. Only *-contract packages and ui cross team lines.",
      severity: 'error',
      from: { path: DELIVERY },
      to: { path: PEOPLE_INTERNALS },
    },
    {
      name: 'shell-no-team-internals',
      comment:
        'The shell imports no team app, service or domain package. It loads remotes at runtime through Module Federation.',
      severity: 'error',
      from: { path: '^apps/shell/' },
      to: { path: '^(apps/(people|delivery)|services|packages/(people|delivery)-domain)/' },
    },
    {
      name: 'app-to-own-service-types-only',
      comment: "An app may import its own team's service only as a type (Hono's typed client), never at runtime.",
      severity: 'error',
      from: { path: '^apps/' },
      to: { path: '^services/', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'contracts-are-leaves',
      comment:
        'A *-contract package imports only zod and other contract packages: no domain, service, app, ui or other npm package.',
      severity: 'error',
      from: { path: '^packages/[^/]+-contract/' },
      to: { pathNot: ['^packages/[^/]+-contract/', npmPackage(['zod'])] },
    },
    {
      name: 'domain-is-framework-free',
      comment: 'A *-domain package is plain TypeScript: no react, ui, app or service.',
      severity: 'error',
      from: { path: '^packages/[^/]+-domain/' },
      to: { path: [npmPackage(['react', 'react-dom']), '^(apps|services)/', '^packages/ui/'] },
    },
    {
      name: 'services-no-ui',
      comment: 'A service never imports an app or the ui package.',
      severity: 'error',
      from: { path: '^services/' },
      to: { path: ['^apps/', '^packages/ui/'] },
    },
    {
      name: 'ui-deps',
      comment: 'ui is presentational: it imports nothing but itself, react, react-dom and clsx (no workspace package).',
      severity: 'error',
      from: { path: '^packages/ui/' },
      to: {
        pathNot: ['^packages/ui/', npmPackage(['react', 'react-dom', 'clsx', '@types/react', '@types/react-dom'])],
      },
    },
    {
      name: 'no-circular',
      comment: 'No import cycles anywhere.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      comment: 'Every import resolves.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Needed to see `import type` (type-only) and to resolve through pnpm's workspace symlinks
    // to real packages/… paths.
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    skipAnalysisNotInRules: true,
  },
};
