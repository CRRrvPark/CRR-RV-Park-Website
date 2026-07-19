import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import react from '@astrojs/react';

// https://astro.build/config
//
// CRITICAL: output is 'server' (not 'static').
//
// Why: the /admin/* React islands call /api/* endpoints that MUST run as
// Netlify Functions. With output: 'static', Astro prerenders every page at
// build-time and API routes are never emitted — login fails on Netlify with
// 404s even though the .env has valid values.
//
// Marketing pages opt back into static prerendering via `export const
// prerender = true;` when they can. Data-backed detail routes and operational
// surfaces remain SSR so current Supabase records appear without a rebuild.
export default defineConfig({
  site: 'https://crookedriverranchrv.com',
  output: 'server',
  adapter: netlify(),
  integrations: [react()],
  build: {
    assets: 'assets',
  },
  vite: {
    optimizeDeps: {
      include: [
        'rrule',
      ],
    },
    // Expose only PUBLIC_* vars to the browser bundle (default Vite
    // behavior, explicit here so it doesn't silently change if a plugin
    // mutates the prefix list).
    envPrefix: ['PUBLIC_', 'VITE_'],
    build: {
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
            if (id.includes('@supabase')) return 'vendor-supabase';
          },
        },
      },
    },
  },
});
