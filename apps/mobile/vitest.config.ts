import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Allow .js extensions in imports (TypeScript convention in this repo)
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
});
