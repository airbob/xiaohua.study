import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// /api/* is the Worker: run `npx wrangler dev` (port 8787) alongside `npm run dev`.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        // the Worker rejects cross-origin writes; the dev proxy is same-site in practice
        configure: (proxy) => proxy.on('proxyReq', (req) => req.removeHeader('origin')),
      },
    },
  },
})
