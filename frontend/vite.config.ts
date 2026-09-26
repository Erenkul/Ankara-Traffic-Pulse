import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
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
})
