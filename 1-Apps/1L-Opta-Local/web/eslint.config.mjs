import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  // Global ignores (standalone object — no other keys)
  {
    ignores: [
      '.next/**',
      'next-env.d.ts',
      'playwright-report/**',
    ],
  },
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // React compiler lint rules are too strict for the current codebase.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/incompatible-library': 'off',
    },
  },
];

export default config;
