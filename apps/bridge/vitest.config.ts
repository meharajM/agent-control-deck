import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@agent-deck/adapter-contract': resolve(__dirname, '../../packages/adapter-contract/src/index.ts'),
      '@agent-deck/adapter-fake': resolve(__dirname, '../../packages/adapter-fake/src/index.ts'),
      '@agent-deck/bridge-core': resolve(__dirname, '../../packages/bridge-core/src/index.ts'),
      '@agent-deck/bridge-database': resolve(__dirname, '../../packages/bridge-database/src/index.ts'),
      '@agent-deck/protocol': resolve(__dirname, '../../packages/protocol/src/index.ts'),
    },
  },
});
