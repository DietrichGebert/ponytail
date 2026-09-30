import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        globals: true,
        root: './',
        include: ['**/*.e2e-spec.ts'],
    },
});
//# sourceMappingURL=vitest.config.e2e.js.map