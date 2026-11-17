import { defineConfig } from 'vite';

// The game is a single-page Three.js app; it needs no code splitting for normal
// play, so the chunk-size warning is raised instead of splitting three.js.
export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // the sandbox preview is served from a proxied host name
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1400,
  },
});
