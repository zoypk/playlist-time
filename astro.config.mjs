// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: "https://playlist-time.pages.dev",
  integrations: [react()],
  output: "static",
  vite: {
    build: {
      sourcemap: false,
      cssCodeSplit: false,
      minify: "esbuild",
      // Single bundle strategy for SPA - all components on one page
      rollupOptions: {
        output: {
          // Optimize file names for caching
          chunkFileNames: "assets/[name]-[hash].js",
          entryFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
        },
      },
    },
    server: {
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8788",
          changeOrigin: false,
          configure: (proxy) => {
            const proxyEvents =
              /** @type {{ on?: (event: "error", listener: () => void) => void }} */ (proxy);
            proxyEvents.on?.("error", () => {});
          },
        },
      },
    },
  },
});
