
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   base: '/fish-management/',
    //   includeAssets: ['favicon.ico', 'favicon.svg', 'rio-fish-logo.png', 'rio-fish-logo.svg'],
    //   manifest: false,
    //   workbox: {
    //     globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg}'],
    //     globIgnores: ['**/manifest.webmanifest', '**/manifest.json'],
    //     runtimeCaching: [
    //       {
    //         urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
    //         handler: 'NetworkFirst',
    //         options: {
    //           cacheName: 'supabase-cache',
    //           expiration: {
    //             maxEntries: 100,
    //             maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
    //           },
    //           cacheableResponse: {
    //             statuses: [0, 200]
    //           }
    //         }
    //       },
    //       {
    //         urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
    //         handler: 'CacheFirst',
    //         options: {
    //           cacheName: 'google-fonts-cache',
    //           expiration: {
    //             maxEntries: 10,
    //             maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
    //           },
    //           cacheableResponse: {
    //             statuses: [0, 200]
    //           }
    //         }
    //       }
    //     ]
    //   },
    //   devOptions: {
    //     enabled: true
    //   }
    // })
  ],
    base: '/fish-management/',
    build: {
      target: 'esnext',
      outDir: 'build',
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          // Use consistent naming for all chunks
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          // Organize chunks logically to prevent circular dependencies
          manualChunks: (id) => {
            // All vendor libraries in one chunk
            if (id.includes('node_modules')) {
              return 'vendor';
            }
            
            // All application code in one chunk to avoid circular dependencies
            if (id.includes('src/')) {
              return 'app';
            }
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3001,
      open: true,
    },
  });