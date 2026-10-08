import { defineConfig, globalIgnores, js, jsxA11yPlugin, reactHooksPlugin, rstestPlugin, ts } from '@rslint/core';

/**
 * What PocketBase's JS engine puts in scope for migrations and hooks (ADR 033). Only what the services'
 * files use: add a name when a file needs it, so a typo still fails `no-undef`.
 */
const POCKETBASE_GLOBALS = {
  // Migrations.
  migrate: 'readonly',
  Collection: 'readonly',
  TextField: 'readonly',
  NumberField: 'readonly',
  BoolField: 'readonly',
  RelationField: 'readonly',
  Record: 'readonly',
  // Migrations and hooks.
  $os: 'readonly',
  __hooks: 'readonly',
  // Hooks: wired in a `*.pb.js`, run with the request or model event.
  onRecordCreateRequest: 'readonly',
  onRecordUpdateRequest: 'readonly',
  onRecordCreate: 'readonly',
  onRecordUpdate: 'readonly',
  onRecordDelete: 'readonly',
} as const;

// Code-level rules only (D24). Import boundaries belong to dependency-cruiser
// (D23) and formatting to Prettier, so neither has rules here.
export default defineConfig([
  globalIgnores(['**/dist/**', '**/coverage/**', '**/node_modules/**', '.docs/**']),

  js.configs.recommended,
  ...ts.configs.strictTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      // Each workspace package is type-checked against its own tsconfig.json.
      parserOptions: { projectService: true },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
    },
  },

  {
    files: ['**/*.{ts,tsx}'],
    ...reactHooksPlugin.configs.recommended,
    rules: {
      ...reactHooksPlugin.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },

  { files: ['**/*.tsx'], ...jsxA11yPlugin.configs.recommended },

  // The services' PocketBase JS (migrations, hooks, hooks/lib) is CommonJS run by PocketBase, not a
  // bundle. `js.configs.recommended` leaves `no-undef` off, so turn it on here: the declared globals
  // are then the whole list of what these files may use, and the other rules stay as they are.
  {
    files: ['services/*/pb_migrations/**/*.js', 'services/*/pb_hooks/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...POCKETBASE_GLOBALS, console: 'readonly' },
    },
    rules: {
      'no-undef': 'error',
      // PocketBase's JS engine has no ES modules: `require` is how a hook loads `pb_hooks/lib`.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  {
    files: ['**/*.test.{ts,tsx}'],
    ...rstestPlugin.configs.recommended,
    rules: {
      ...rstestPlugin.configs.recommended.rules,
      // Property tests assert inside fast-check, and shared helpers wrap `expect`.
      'rstest/expect-expect': ['warn', { assertFunctionNames: ['expect', 'expect*', 'fc.assert'] }],
    },
  },
]);
