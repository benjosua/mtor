import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import vitePluginBundleObfuscator from 'vite-plugin-bundle-obfuscator';
import { VitePWA } from 'vite-plugin-pwa';

const obfuscatorConfig = {
  autoExcludeNodeModules: true,
  threadPool: true,
  options: {
    compact: true,
    controlFlowFlattening: true,
    stringArray: true,
    selfDefending: true,
    debugProtection: true,
    disableConsoleOutput: true
  }
};

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(), 
    vitePluginBundleObfuscator(obfuscatorConfig),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: true
      },
      
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      
      manifest: {
        name: 'mTOR',
        short_name: 'mTOR',
        description: 'A collaborative, real-time workout planner and tracker.',
        theme_color: '#18181b',
        background_color: '#18181b',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
      },
      
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        
        runtimeCaching: [
          {
            // It tries the network first for all navigation requests.
            // If offline, it falls back to the cached version.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              networkTimeoutSeconds: 5, // Fall back to cache if network is slow
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
        ],
      },
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  }
})