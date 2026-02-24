// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://playlisttime.app',
  integrations: [react()],
  output: 'static',
  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: false,
          configure: (proxy) => {
            proxy.on('error', () => {});
          }
        }
      }
    }
  }
});
