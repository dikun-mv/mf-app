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

/** A layout that obeys every rule, including the imports that are allowed to cross teams. */
const clean: Files = {
  'packages/host-contract/src/index.ts': `import { z } from 'zod';\nexport const IsoDate = z;`,
  'packages/people-contract/src/index.ts': `import { z } from 'zod';\nimport { IsoDate } from '@baseline/host-contract';\nexport const EmployeeId = [z, IsoDate];`,
  'packages/delivery-contract/src/index.ts': `import { EmployeeId } from '@baseline/people-contract';\nimport { IsoDate } from '@baseline/host-contract';\nexport const Load = [EmployeeId, IsoDate];`,
  'packages/people-domain/src/index.ts': `import { EmployeeId } from '@baseline/people-contract';\nexport const rateHistory = EmployeeId;`,
  'packages/delivery-domain/src/index.ts': `import { addDays } from 'date-fns';\nimport { Load } from '@baseline/delivery-contract';\nimport { EmployeeId } from '@baseline/people-contract';\nexport const pricing = [addDays, Load, EmployeeId];`,
  'packages/ui/src/index.ts': `import { createElement } from 'react';\nimport clsx from 'clsx';\nexport const Button = [createElement, clsx];`,
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
      description: 'ui imports a workspace package',
      files: { 'packages/ui/src/leak.ts': `import '@baseline/host-contract';` },
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
