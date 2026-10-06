import { defineConfig, globalIgnores, js, jsxA11yPlugin, reactHooksPlugin, rstestPlugin, ts } from '@rslint/core';

// Code-level rules only (D24). Import boundaries belong to dependency-cruiser
// (D23) and formatting to Prettier, so neither has rules here.
export default defineConfig([
  globalIgnores(['**/dist/**', '**/coverage/**', '**/node_modules/**', 'docs/**']),

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

  { files: ['**/*.test.{ts,tsx}'], ...rstestPlugin.configs.recommended },
]);
