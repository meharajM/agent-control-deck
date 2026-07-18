import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@agent-deck/bridge-database': resolve(__dirname, '../bridge-database/src/index.ts'),
    },
  },
});
