// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: "https://playlisttime.app",
  integrations: [react()],
  output: "static",
  vite: {
    build: {
      sourcemap: false,
      // Chunk splitting: separate TanStack libraries into their own chunk for faster loads
      rollupOptions: {
        output: {
          manualChunks: {
            "tanstack-table": ["@tanstack/react-table"],
            "tanstack-query": ["@tanstack/react-query"],
            "radix-ui": [
              "@radix-ui/react-accordion",
              "@radix-ui/react-popover",
              "@radix-ui/react-tooltip",
            ],
          },
        },
      },
    },
    server: {
      sourcemap: false,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8788",
          changeOrigin: false,
          configure: (proxy) => {
            proxy.on("error", () => {});
          },
        },
      },
    },
  },
});
