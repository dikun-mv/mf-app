/**
 * Boundary rules (D23). Three owners, by path:
 *   People team:   apps/people,   services/people-pb,   packages/people-domain,   packages/people-contract
 *   Delivery team: apps/delivery, services/delivery-pb, packages/delivery-domain, packages/delivery-contract
 *   Platform:      apps/shell, packages/ui, packages/host-contract
 * Only `*-contract` packages and `ui` may cross a team line. Inside each app, three Feature-Sliced
 * Design rules (D28) keep the layers one-way. Each rule is proved to fail by .dependency-cruiser.test.ts.
 */

const PEOPLE = '^(apps/people|services/people-pb|packages/people-domain|packages/people-contract)/';
const DELIVERY = '^(apps/delivery|services/delivery-pb|packages/delivery-domain|packages/delivery-contract)/';
const PEOPLE_INTERNALS = '^(apps/people|services/people-pb|packages/people-domain)/';
const DELIVERY_INTERNALS = '^(apps/delivery|services/delivery-pb|packages/delivery-domain)/';

/**
 * The Feature-Sliced Design layers of an app's `src/` (D28), highest first. A layer imports only the
 * layers below it. `app` and `shared` have segments (`shared/api`, `shared/lib`, …) rather than
 * slices, but a shared segment is imported through its `index.ts` like a slice is.
 */
const FSD_LAYERS = ['app', 'pages', 'widgets', 'features', 'entities', 'shared'];
/** The layers that hold slices: `<layer>/<slice>/…`. */
const SLICED_LAYERS = FSD_LAYERS.filter((layer) => layer !== 'app' && layer !== 'shared');
const oneOf = (names) => `(${names.join('|')})`;
/** A slice's `index.ts`, the only file other code may import. */
const SLICE_INDEX = '^apps/[^/]+/src/[^/]+/[^/]+/index\\.ts$';

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
      name: 'apps-no-services',
      comment:
        'An app never imports anything under services/. PocketBase services have no TypeScript to import: an app reaches its data over HTTP, with the pocketbase SDK and the contract packages (ADR 032).',
      severity: 'error',
      from: { path: '^apps/' },
      to: { path: '^services/' },
    },
    {
      name: 'contracts-are-leaves',
      comment:
        'A *-contract package imports only zod and other contract packages: no domain, service, app, ui or other npm package.',
      severity: 'error',
      from: { path: '^packages/[^/]+-contract/', pathNot: '\\.test\\.ts$' },
      to: { pathNot: ['^packages/[^/]+-contract/', npmPackage(['zod'])] },
    },
    {
      name: 'contract-tests-are-leaves',
      comment: 'A contract package’s tests follow the same rule, and may also import the test tools.',
      severity: 'error',
      from: { path: '^packages/[^/]+-contract/.*\\.test\\.ts$' },
      to: { pathNot: ['^packages/[^/]+-contract/', npmPackage(['zod', '@rstest/core', 'fast-check', 'expect-type'])] },
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
      comment:
        'ui is presentational: it imports nothing but itself, react, react-dom and clsx (no workspace package). Only its component tests and src/testing/ may also import the test libraries.',
      severity: 'error',
      from: { path: '^packages/ui/', pathNot: ['\\.test\\.tsx$', '^packages/ui/src/testing/'] },
      to: {
        pathNot: ['^packages/ui/', npmPackage(['react', 'react-dom', 'clsx', '@types/react', '@types/react-dom'])],
      },
    },
    {
      name: 'ui-test-deps',
      comment:
        'ui’s component tests and src/testing/ follow the same rule, and may also import the test tools (Rstest and Testing Library).',
      severity: 'error',
      from: { path: ['^packages/ui/.*\\.test\\.tsx$', '^packages/ui/src/testing/'] },
      to: {
        pathNot: [
          '^packages/ui/',
          npmPackage([
            'react',
            'react-dom',
            'clsx',
            '@types/react',
            '@types/react-dom',
            '@rstest/core',
            '@testing-library/[^/]+',
          ]),
        ],
      },
    },
    // Feature-Sliced Design (D28), inside each app: `^apps/([^/]+)/src/…` scopes every rule to one app.
    // One rule per layer, all named alike: a layer must not import any layer above it.
    ...FSD_LAYERS.slice(1).map((layer, index) => ({
      name: 'fsd-layers-import-down',
      comment: `The ${layer} layer imports only layers below it (app, pages, widgets, features, entities, shared, top to bottom).`,
      severity: 'error',
      from: { path: `^apps/([^/]+)/src/${layer}/` },
      to: { path: `^apps/$1/src/${oneOf(FSD_LAYERS.slice(0, index + 1))}/` },
    })),
    {
      name: 'fsd-no-cross-slice',
      comment:
        'Slices of one layer never import each other, not even through an index.ts, and there are no @x cross-imports: entities are combined in features and widgets.',
      severity: 'error',
      from: { path: `^apps/([^/]+)/src/${oneOf(SLICED_LAYERS)}/([^/]+)/` },
      to: { path: '^apps/$1/src/$2/', pathNot: '^apps/$1/src/$2/$3/' },
    },
    {
      name: 'fsd-public-api',
      comment:
        'Code outside a slice (or a shared segment) imports it only through its index.ts: another layer, and another shared segment, never reach into its folders.',
      severity: 'error',
      from: { path: '^apps/([^/]+)/src/([^/]+)/' },
      to: {
        path: `^apps/$1/src/${oneOf([...SLICED_LAYERS, 'shared'])}/[^/]+/`,
        // The importing layer is left to the cross-slice rule (same layer) and the segment rule below.
        pathNot: ['^apps/$1/src/$2/', SLICE_INDEX],
      },
    },
    {
      name: 'fsd-public-api',
      comment: 'A shared segment imports another shared segment only through its index.ts.',
      severity: 'error',
      from: { path: '^apps/([^/]+)/src/shared/([^/]+)/' },
      to: { path: '^apps/$1/src/shared/[^/]+/', pathNot: ['^apps/$1/src/shared/$2/', SLICE_INDEX] },
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
