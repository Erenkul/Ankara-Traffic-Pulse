import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  // Alt dizinde yayın için (ör. /projects/ankara-traffic-pulse/): VITE_BASE_PATH
  base: loadEnv(mode, '.', 'VITE_').VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Büyük harita kütüphanelerini ayrı chunk'lara böl → daha iyi tarayıcı önbelleği
        manualChunks: {
          maplibre: ['maplibre-gl', 'react-map-gl'],
          deckgl: ['@deck.gl/react', '@deck.gl/layers', '@deck.gl/aggregation-layers'],
        },
      },
    },
    chunkSizeWarningLimit: 1200,
  },
}))
