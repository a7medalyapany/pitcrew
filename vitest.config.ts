import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Filesystem-heavy integration tests can exceed Vitest's 5s default on slower CI runners.
    testTimeout: 15_000,
    clearMocks: true,
    restoreMocks: true,
  },
});
