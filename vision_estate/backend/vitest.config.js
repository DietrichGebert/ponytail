import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        globals: true,
        root: './',
        include: ['**/*.spec.ts'],
    },
});
//# sourceMappingURL=vitest.config.js.map