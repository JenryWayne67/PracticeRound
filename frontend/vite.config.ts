import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const backend = 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Pin IPv4: on Windows "localhost" can bind IPv6-only and be unreachable from some tools.
    host: '127.0.0.1',
    // The frontend always calls relative /api paths; in dev they are proxied to FastAPI.
    proxy: {
      '/api': { target: backend, changeOrigin: true, ws: true },
      '/uploads': { target: backend, changeOrigin: true },
    },
  },
})
