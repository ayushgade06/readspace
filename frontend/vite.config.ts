import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the API runs separately on port 4000,
// so /api requests are forwarded to it.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
