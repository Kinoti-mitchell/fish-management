
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
  ],
  base: '/fish-management/',
  build: {
    target: 'esnext',
    outDir: 'build',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Use consistent naming for all chunks
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
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