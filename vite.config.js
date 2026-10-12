import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createApiMiddleware } from './server/apiMiddleware.js'

function apiPlugin() {
  return {
    name: 'technova-api-middleware',
    configureServer(server) {
      server.middlewares.use(createApiMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createApiMiddleware());
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    apiPlugin(),
  ],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('pdf-lib') || id.includes('jspdf') || id.includes('html2canvas') || id.includes('canvg')) {
              return 'vendor-pdf';
            }
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('qrcode') || id.includes('canvas-confetti') || id.includes('bcryptjs')) {
              return 'vendor-utils';
            }
            return 'vendor-misc';
          }
        }
      }
    }
  }
})

