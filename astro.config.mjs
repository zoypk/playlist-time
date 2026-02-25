// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: "https://yttime.pages.dev",
  integrations: [react()],
  output: "static",
  vite: {
    build: {
      sourcemap: false,
      cssCodeSplit: true,
      minify: "esbuild",
      // Chunk splitting: separate TanStack libraries into their own chunk for faster loads
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Vendor chunks for better caching
            if (id.includes("node_modules")) {
              if (id.includes("@tanstack/react-table")) {
                return "tanstack-table";
              }
              if (id.includes("@tanstack/react-query")) {
                return "tanstack-query";
              }
              if (id.includes("@radix-ui")) {
                return "radix-ui";
              }
              if (id.includes("react") || id.includes("react-dom")) {
                return "react";
              }
            }
          },
          // Optimize chunk names for better caching
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
            proxy.on("error", () => {});
          },
        },
      },
    },
  },
});
