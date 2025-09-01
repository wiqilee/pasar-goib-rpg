// client/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repoName = 'pasar-goib-rpg' 

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  
  base: mode === 'production' ? `/${repoName}/` : '/',
  // Proxy hanya aktif saat dev
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
}))
