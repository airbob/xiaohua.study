import fs from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { renderSeoPages } from './scripts/seo-pages.mjs'

// Dev only: the word-list pages (/words/, /words/p1/ …) are static HTML that
// `npm run build` writes into dist/. Serve the same pages from the dev server so the
// home page's 词语表 links work under `npm run dev` (re-rendered on every request).
const seoPagesInDev = {
  name: 'seo-pages-dev',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = (req.url || '').split('?')[0]
      if (!url.startsWith('/words')) return next()
      const words = JSON.parse(fs.readFileSync(new URL('./src/data/words.json', import.meta.url), 'utf8'))
      const { pages } = renderSeoPages(words)
      const key = url.endsWith('/') ? url : `${url}/`
      if (!pages.has(key)) return next()
      if (key !== url) {
        res.statusCode = 301
        res.setHeader('Location', key)
        return res.end()
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(pages.get(key))
    })
  },
}

// /api/* is the Worker: run `npx wrangler dev` (port 8787) alongside `npm run dev`.
export default defineConfig({
  plugins: [react(), seoPagesInDev],
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
