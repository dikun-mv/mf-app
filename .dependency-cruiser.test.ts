import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from '@rstest/core';

// Each boundary rule in .dependency-cruiser.cjs is proved to fail: a small repo with the same
// layout is built in a temp dir, one forbidden import is added, and the real depcruise CLI must
// exit non-zero naming that rule. A clean baseline (which includes the allowed cross-team
// imports) must pass, so the rules can't be satisfied by forbidding everything.

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const depcruiseBin = join(repoRoot, 'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs');
const config = join(repoRoot, '.dependency-cruiser.cjs');

type Files = Record<string, string>;

/**
 * Workspace packages: linked into node_modules the way pnpm links them. A service has no `src/`
 * (PocketBase loads its migrations and hooks itself), so its importable entry is a test file.
 */
const workspacePackages: Record<string, string> = {
  '@baseline/host-contract': 'packages/host-contract',
  '@baseline/people-contract': 'packages/people-contract',
  '@baseline/delivery-contract': 'packages/delivery-contract',
  '@baseline/people-domain': 'packages/people-domain',
  '@baseline/delivery-domain': 'packages/delivery-domain',
  '@baseline/ui': 'packages/ui',
  '@baseline/people-pb': 'services/people-pb',
  '@baseline/delivery-pb': 'services/delivery-pb',
};

const npmPackages = ['zod', 'react', 'react-dom', 'clsx', 'date-fns', 'pocketbase', 'lodash', '@rstest/core'];

/**
 * An app's Feature-Sliced Design layout (D28) that obeys the three FSD rules: every import goes down
 * a layer, through the slice's `index.ts`; slices reach inside their own folders freely; a shared
 * segment imports another shared segment through its `index.ts`.
 */
function fsdLayout(app: string): Files {
  const src = `apps/${app}/src`;
  return {
    [`${src}/app/main.ts`]: `import { Register } from '../pages/register';\nimport { api } from '../shared/api';\nexport const main = [Register, api];`,
    [`${src}/pages/register/index.ts`]: `export { Register } from './ui/Register';`,
    [`${src}/pages/register/ui/Register.ts`]: [
      `import { Table } from '../../../widgets/table';`,
      `import { Search } from '../../../features/search';`,
      `import { format } from '../model/format';`,
      `export const Register = [Table, Search, format];`,
    ].join('\n'),
    [`${src}/pages/register/model/format.ts`]: `export const format = 1;`,
    [`${src}/widgets/table/index.ts`]: `export { Table } from './ui/Table';`,
    [`${src}/widgets/table/ui/Table.ts`]: `import { Employee } from '../../../entities/employee';\nimport { util } from '../../../shared/lib';\nexport const Table = [Employee, util];`,
    [`${src}/widgets/chart/index.ts`]: `export const Chart = 1;`,
    [`${src}/features/search/index.ts`]: `export { Search } from './ui/Search';`,
    [`${src}/features/search/ui/Search.ts`]: `import { Employee } from '../../../entities/employee';\nexport const Search = Employee;`,
    [`${src}/features/filter/index.ts`]: `export const Filter = 1;`,
    [`${src}/entities/employee/index.ts`]: `export { Employee } from './model/employee';`,
    [`${src}/entities/employee/model/employee.ts`]: `import { api } from '../../../shared/api';\nexport const Employee = api;`,
    [`${src}/entities/rate/index.ts`]: `export const Rate = 1;`,
    [`${src}/shared/api/index.ts`]: `export { api } from './client';`,
    [`${src}/shared/api/client.ts`]: `export const api = 1;`,
    [`${src}/shared/lib/index.ts`]: `import { api } from '../api';\nexport const util = api;`,
  };
}

/** A layout that obeys every rule, including the imports that are allowed to cross teams. */
const clean: Files = {
  'packages/host-contract/src/index.ts': `import { z } from 'zod';\nexport const IsoDate = z;`,
  'packages/people-contract/src/index.ts': `import { z } from 'zod';\nimport { IsoDate } from '@baseline/host-contract';\nexport const EmployeeId = [z, IsoDate];`,
  'packages/delivery-contract/src/index.ts': `import { EmployeeId } from '@baseline/people-contract';\nimport { IsoDate } from '@baseline/host-contract';\nexport const Load = [EmployeeId, IsoDate];`,
  'packages/people-domain/src/index.ts': `import { EmployeeId } from '@baseline/people-contract';\nexport const rateHistory = EmployeeId;`,
  'packages/delivery-domain/src/index.ts': `import { addDays } from 'date-fns';\nimport { Load } from '@baseline/delivery-contract';\nimport { EmployeeId } from '@baseline/people-contract';\nexport const pricing = [addDays, Load, EmployeeId];`,
  'packages/ui/src/index.ts': `import { createElement } from 'react';\nimport clsx from 'clsx';\nexport const Button = [createElement, clsx];`,
  // ui's tests and test helpers may import the test libraries (here @rstest/core); its product code may not.
  'packages/ui/src/components/Button/Button.test.tsx': `import { expect } from '@rstest/core';\nimport { Button } from '../../index';\nexport const t = [expect, Button];`,
  'packages/ui/src/testing/setup.ts': `import { afterEach } from '@rstest/core';\nexport const s = afterEach;`,
  // A service's tests may use its own team's domain and contracts, and the SDK.
  'services/people-pb/test/index.ts': `import PocketBase from 'pocketbase';\nimport { rateHistory } from '@baseline/people-domain';\nimport { Load } from '@baseline/delivery-contract';\nexport const client = [PocketBase, rateHistory, Load];`,
  'services/delivery-pb/test/index.ts': `import PocketBase from 'pocketbase';\nimport { pricing } from '@baseline/delivery-domain';\nimport { EmployeeId } from '@baseline/people-contract';\nexport const client = [PocketBase, pricing, EmployeeId];`,
  'apps/people/src/index.ts': [
    `import { Button } from '@baseline/ui';`,
    `import { rateHistory } from '@baseline/people-domain';`,
    `import { Load } from '@baseline/delivery-contract';`,
    `import { IsoDate } from '@baseline/host-contract';`,
    `export const view = [Button, rateHistory, Load, IsoDate];`,
  ].join('\n'),
  'apps/delivery/src/index.ts': [
    `import { Button } from '@baseline/ui';`,
    `import { pricing } from '@baseline/delivery-domain';`,
    `import { EmployeeId } from '@baseline/people-contract';`,
    `export const view = [Button, pricing, EmployeeId];`,
  ].join('\n'),
  'apps/shell/src/index.ts': `import { Button } from '@baseline/ui';\nimport { IsoDate } from '@baseline/host-contract';\nexport const shell = [Button, IsoDate];`,
  ...fsdLayout('people'),
  ...fsdLayout('shell'),
};

const tempDirs: string[] = [];

function write(root: string, path: string, content: string): void {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function buildRepo(extra: Files): string {
  const root = mkdtempSync(join(tmpdir(), 'depcruise-rules-'));
  tempDirs.push(root);
  copyFileSync(join(repoRoot, 'tsconfig.base.json'), join(root, 'tsconfig.base.json'));

  for (const [name, dir] of Object.entries(workspacePackages)) {
    const entry = dir.startsWith('services/') ? './test/index.ts' : './src/index.ts';
    write(root, `${dir}/package.json`, JSON.stringify({ name, exports: { '.': entry } }));
    const link = join(root, 'node_modules', name);
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(relative(dirname(link), join(root, dir)), link);
  }
  for (const name of npmPackages) {
    write(root, `node_modules/${name}/package.json`, JSON.stringify({ name, main: 'index.js' }));
    write(root, `node_modules/${name}/index.js`, 'module.exports = {};');
  }
  for (const [path, content] of Object.entries({ ...clean, ...extra })) {
    write(root, path, content);
  }
  return root;
}

function lintDeps(root: string): { status: number | null; output: string } {
  const result = spawnSync(
    process.execPath,
    [depcruiseBin, 'apps', 'packages', 'services', '--config', config, '--output-type', 'err'],
    { cwd: root, encoding: 'utf8' },
  );
  return { status: result.status, output: result.stdout + result.stderr };
}

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

describe('dependency boundary rules', () => {
  it('passes on a layout that obeys every rule', () => {
    const { status, output } = lintDeps(buildRepo({}));
    expect(output).toContain('no dependency violations found');
    expect(status).toBe(0);
  });

  const violations: Array<{ rule: string; description: string; files: Files }> = [
    {
      rule: 'no-cross-app',
      description: 'people app imports the delivery app',
      files: { 'apps/people/src/leak.ts': `import '../../delivery/src/index';` },
    },
    {
      rule: 'no-cross-team-internals-people',
      description: 'people app imports delivery-domain',
      files: { 'apps/people/src/leak.ts': `import '@baseline/delivery-domain';` },
    },
    {
      rule: 'no-cross-team-internals-people',
      description: 'people service imports the delivery service',
      files: { 'services/people-pb/test/leak.ts': `import '@baseline/delivery-pb';` },
    },
    {
      rule: 'no-cross-team-internals-delivery',
      description: 'delivery app imports people-domain',
      files: { 'apps/delivery/src/leak.ts': `import '@baseline/people-domain';` },
    },
    {
      rule: 'no-cross-team-internals-delivery',
      description: 'delivery service imports people-domain',
      files: { 'services/delivery-pb/test/leak.ts': `import '@baseline/people-domain';` },
    },
    {
      rule: 'shell-no-team-internals',
      description: 'shell imports a team domain package',
      files: { 'apps/shell/src/leak.ts': `import '@baseline/people-domain';` },
    },
    {
      rule: 'shell-no-team-internals',
      description: 'shell imports a service, even type-only',
      files: {
        'apps/shell/src/leak.ts': `import type { client } from '@baseline/delivery-pb';\nexport type { client };`,
      },
    },
    {
      rule: 'apps-no-services',
      description: 'app imports its own service at runtime',
      files: {
        'apps/people/src/leak.ts': `import { client } from '@baseline/people-pb';\nexport { client };`,
      },
    },
    {
      rule: 'apps-no-services',
      description: 'app imports its own service, even type-only',
      files: {
        'apps/delivery/src/leak.ts': `import type { client } from '@baseline/delivery-pb';\nexport type { client };`,
      },
    },
    {
      rule: 'apps-no-services',
      description: "app imports the other team's service",
      files: {
        'apps/people/src/leak.ts': `import { client } from '@baseline/delivery-pb';\nexport { client };`,
      },
    },
    {
      rule: 'contracts-are-leaves',
      description: 'contract imports a domain package',
      files: { 'packages/people-contract/src/leak.ts': `import '@baseline/people-domain';` },
    },
    {
      rule: 'contracts-are-leaves',
      description: 'contract imports an npm package other than zod',
      files: { 'packages/people-contract/src/leak.ts': `import 'lodash';` },
    },
    {
      rule: 'contracts-are-leaves',
      description: 'contract imports ui',
      files: { 'packages/delivery-contract/src/leak.ts': `import '@baseline/ui';` },
    },
    {
      rule: 'contract-tests-are-leaves',
      description: 'contract test imports a domain package',
      files: { 'packages/people-contract/src/index.test.ts': `import '@baseline/people-domain';` },
    },
    {
      rule: 'contract-tests-are-leaves',
      description: 'contract test imports an npm package outside zod and the test tools',
      files: { 'packages/people-contract/src/index.test.ts': `import 'lodash';` },
    },
    {
      rule: 'domain-is-framework-free',
      description: 'domain imports react',
      files: { 'packages/people-domain/src/leak.ts': `import 'react';` },
    },
    {
      rule: 'domain-is-framework-free',
      description: 'domain imports a service',
      files: { 'packages/delivery-domain/src/leak.ts': `import '@baseline/delivery-pb';` },
    },
    {
      rule: 'services-no-ui',
      description: 'service imports ui',
      files: { 'services/people-pb/test/leak.ts': `import '@baseline/ui';` },
    },
    {
      rule: 'services-no-ui',
      description: 'service imports an app',
      files: { 'services/delivery-pb/test/leak.ts': `import '../../../apps/delivery/src/index';` },
    },
    {
      rule: 'ui-deps',
      description: 'ui imports an npm package outside react/react-dom/clsx',
      files: { 'packages/ui/src/leak.ts': `import 'lodash';` },
    },
    {
      rule: 'ui-deps',
      description: 'ui product code imports a test library',
      files: { 'packages/ui/src/leak.ts': `import '@rstest/core';` },
    },
    {
      rule: 'ui-deps',
      description: 'ui imports a workspace package',
      files: { 'packages/ui/src/leak.ts': `import '@baseline/host-contract';` },
    },
    // Feature-Sliced Design (D28). The fixtures import through index.ts wherever the rule under test
    // isn't the public-API one, so only the named rule can be the one that fires.
    {
      rule: 'fsd-layers-import-down',
      description: 'shared imports a widget',
      files: { 'apps/people/src/shared/lib/leak.ts': `import '../../widgets/table';` },
    },
    {
      rule: 'fsd-layers-import-down',
      description: 'an entity imports a feature',
      files: { 'apps/people/src/entities/employee/model/leak.ts': `import '../../../features/search';` },
    },
    {
      rule: 'fsd-layers-import-down',
      description: 'a feature imports a page',
      files: { 'apps/people/src/features/search/ui/leak.ts': `import '../../../pages/register';` },
    },
    {
      rule: 'fsd-layers-import-down',
      description: 'a widget imports the app layer',
      files: { 'apps/people/src/widgets/table/ui/leak.ts': `import '../../../app/main';` },
    },
    {
      rule: 'fsd-layers-import-down',
      description: 'shared imports an entity, type-only',
      files: {
        'apps/people/src/shared/lib/leak.ts': `import type { Employee } from '../../entities/employee';\nexport type { Employee };`,
      },
    },
    {
      rule: 'fsd-layers-import-down',
      description: 'shared imports a widget in the shell too',
      files: { 'apps/shell/src/shared/lib/leak.ts': `import '../../widgets/table';` },
    },
    {
      rule: 'fsd-no-cross-slice',
      description: 'a widget imports another widget, through its index.ts',
      files: { 'apps/people/src/widgets/table/ui/leak.ts': `import '../../chart';` },
    },
    {
      rule: 'fsd-no-cross-slice',
      description: 'a feature imports another feature',
      files: { 'apps/people/src/features/search/ui/leak.ts': `import '../../filter';` },
    },
    {
      rule: 'fsd-no-cross-slice',
      description: 'an entity imports another entity (no @x cross-imports)',
      files: { 'apps/people/src/entities/employee/model/leak.ts': `import '../../rate';` },
    },
    {
      rule: 'fsd-no-cross-slice',
      description: 'a page imports another page',
      files: {
        'apps/people/src/pages/other/index.ts': `export const Other = 1;`,
        'apps/people/src/pages/register/ui/leak.ts': `import '../../other';`,
      },
    },
    {
      rule: 'fsd-no-cross-slice',
      description: 'a widget imports another widget, type-only',
      files: {
        'apps/shell/src/widgets/chart/index.ts': `export type Chart = 1;`,
        'apps/shell/src/widgets/table/ui/leak.ts': `import type { Chart } from '../../chart';\nexport type { Chart };`,
      },
    },
    {
      rule: 'fsd-public-api',
      description: 'a page reaches into a widget’s folders',
      files: { 'apps/people/src/pages/register/ui/leak.ts': `import '../../../widgets/table/ui/Table';` },
    },
    {
      rule: 'fsd-public-api',
      description: 'a widget reaches into an entity’s model',
      files: { 'apps/people/src/widgets/table/ui/leak.ts': `import '../../../entities/employee/model/employee';` },
    },
    {
      rule: 'fsd-public-api',
      description: 'the app layer reaches into a page',
      files: { 'apps/people/src/app/leak.ts': `import '../pages/register/ui/Register';` },
    },
    {
      rule: 'fsd-public-api',
      description: 'the app layer reaches into a shared segment',
      files: { 'apps/people/src/app/leak.ts': `import '../shared/api/client';` },
    },
    {
      rule: 'fsd-public-api',
      description: 'a shared segment reaches into another shared segment',
      files: { 'apps/people/src/shared/lib/leak.ts': `import '../api/client';` },
    },
    {
      rule: 'fsd-public-api',
      description: 'a deep import, type-only',
      files: {
        'apps/shell/src/app/leak.ts': `import type { Table } from '../widgets/table/ui/Table';\nexport type { Table };`,
        'apps/shell/src/widgets/table/ui/Table.ts': `export type Table = 1;`,
      },
    },
    {
      rule: 'no-circular',
      description: 'two contracts import each other',
      files: {
        // delivery-contract already imports people-contract, so this closes the loop.
        'packages/people-contract/src/index.ts': `import '@baseline/delivery-contract';\nexport const EmployeeId = 1;`,
      },
    },
    {
      rule: 'not-to-unresolvable',
      description: 'import of a missing file',
      files: { 'apps/shell/src/leak.ts': `import './does-not-exist';` },
    },
  ];

  it('lets a contract’s own tests import the test tools, while its production code stays held to the rule', () => {
    const tools = buildRepo({
      'packages/people-contract/src/index.test.ts': `import '@rstest/core';\nimport { EmployeeId } from './index';\nexport const spec = EmployeeId;`,
    });
    expect(lintDeps(tools).status).toBe(0);

    const production = buildRepo({ 'packages/people-contract/src/helper.ts': `import '@rstest/core';` });
    expect(lintDeps(production).output).toContain('contracts-are-leaves');
  });

  it.each(violations)('$rule fails when $description', ({ rule, files }) => {
    const { status, output } = lintDeps(buildRepo(files));
    expect(output).toContain(rule);
    expect(status).not.toBe(0);
  });
});
