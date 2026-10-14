import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    // Browser QA profiles contain locked files and must not trigger hot reloads.
    watch: { ignored: ['**/.artifacts/**'] },
  },
});
