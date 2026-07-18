import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@agent-deck/adapter-contract': resolve(__dirname, '../adapter-contract/src/index.ts'),
    },
  },
});
