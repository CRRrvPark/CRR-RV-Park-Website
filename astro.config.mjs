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
// prerender = true;` at the top of each Astro page. Our public pages already
// pull their content from Supabase at request time, so we let the Netlify
// edge cache handle them (see netlify.toml Cache-Control headers).
export default defineConfig({
  site: 'https://www.crookedriverranchrv.com',
  output: 'server',
  adapter: netlify(),
  integrations: [react()],
  build: {
    assets: 'assets',
  },
  vite: {
    ssr: {
      noExternal: ['@tiptap/*'],
    },
    // Pre-optimize every Tiptap extension the RichTextEditor uses so Vite
    // doesn't try to optimize them on-demand at first page visit — that
    // on-demand path 504s when several extensions are requested in a single
    // tick. Listing them here means they're bundled into .vite/deps at
    // server startup and served as static files after that.
    optimizeDeps: {
      include: [
        '@tiptap/react',
        '@tiptap/starter-kit',
        '@tiptap/extension-link',
        '@tiptap/extension-image',
        '@tiptap/extension-underline',
        '@tiptap/extension-text-style',
        '@tiptap/extension-color',
        '@tiptap/extension-text-align',
        '@tiptap/extension-font-family',
        '@tiptap/extension-highlight',
        'rrule',
      ],
    },
    // Expose only PUBLIC_* vars to the browser bundle (default Vite
    // behavior, explicit here so it doesn't silently change if a plugin
    // mutates the prefix list).
    envPrefix: ['PUBLIC_', 'VITE_'],
    build: {
      // Admin pages legitimately ship ~2MB of Monaco / Puck JS — bumping
      // this limit keeps the build log clean without silencing warnings
      // on smaller bundles (public pages won't come anywhere near this).
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        output: {
          // Split the heaviest admin-only libraries into their own chunks
          // so browser cache can keep them across admin navigations and
          // so any accidental public-page import doesn't drag the whole
          // admin stack along.
          //
          // IMPORTANT: `vendor-react` must come first. Without an explicit
          // rule, React/ReactDOM get absorbed into whichever other vendor
          // chunk imports them first (empirically: vendor-puck). Then other
          // vendor chunks that also need React (vendor-tiptap, etc.) end up
          // reaching into vendor-puck for React symbols, creating a
          // circular chunk graph that throws TDZ errors at hydration
          // ("can't access lexical declaration 'ee' before initialization").
          // The isolated vendor-react chunk has no outbound deps, so every
          // other chunk can import React from it cleanly.
          //
          // Tiptap and prosemirror-* must be in the same chunk — they
          // reference each other's exports at top level, and splitting them
          // produces the same circular-init failure.
          manualChunks: (id) => {
            if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
            if (id.includes('monaco-editor')) return 'vendor-monaco';
            if (id.includes('@puckeditor')) return 'vendor-puck';
            if (id.includes('@tiptap') || id.includes('prosemirror')) return 'vendor-tiptap';
            if (id.includes('@supabase')) return 'vendor-supabase';
          },
        },
      },
    },
  },
});
