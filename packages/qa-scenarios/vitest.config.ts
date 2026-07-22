import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@agent-deck/bridge-core': resolve(__dirname, '../bridge-core/src/index.ts'),
      '@agent-deck/bridge-database': resolve(__dirname, '../bridge-database/src/index.ts'),
      '@agent-deck/adapter-fake': resolve(__dirname, '../adapter-fake/src/index.ts'),
      '@agent-deck/adapter-contract': resolve(__dirname, '../adapter-contract/src/index.ts'),
      '@agent-deck/protocol': resolve(__dirname, '../protocol/src/index.ts'),
    },
  },
  test: {
    exclude: ['**/conformance/**', '**/node_modules/**'],
  },
});
