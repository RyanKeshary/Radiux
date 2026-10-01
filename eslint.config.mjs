import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * ESLint flat config.
 *
 * Next.js 16 removed `next lint`, so linting runs through the ESLint CLI directly.
 * `eslint-config-next@16` ships native flat-config arrays, so no `FlatCompat`
 * shim is required (using one fails schema validation).
 */
const eslintConfig = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.workspaces/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'scratch/**',
      'next-env.d.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      '@next/next/no-img-element': 'off',

      // Supabase/PostgREST responses and the workspace file model are dynamically
      // shaped, so `any` is used deliberately in many call sites. Kept as a warning so
      // it stays visible without failing CI.
      '@typescript-eslint/no-explicit-any': 'warn',

      /*
       * Advisory rules introduced with the React Compiler lint preset in Next 16.
       * They flag architectural patterns (state set inside effects, refs read during
       * render) rather than definite defects. Retargeting them is a behavioural refactor
       * with regression risk, so they are demoted to warnings and tracked rather than
       * silently suppressed or rushed.
       */
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/globals': 'warn',
      'react-hooks/unsupported-syntax': 'warn',
      'react-hooks/incompatible-library': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/use-memo': 'warn',
    },
  },
];

export default eslintConfig;