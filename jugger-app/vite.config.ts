import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const HISTORY_ROOT = '/home/mquade/Jugger/JuggerHistory'

const MIME: Record<string, string> = {
  '.pdf':  'application/pdf',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.gif':  'image/gif',
  '.doc':  'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls':  'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
  '.xlk':  'application/vnd.ms-excel',
  '.txt':  'text/plain',
  '.msg':  'application/vnd.ms-outlook',
}

function juggerHistoryPlugin() {
  return {
    name: 'jugger-history',
    configureServer(server: { middlewares: { use: (path: string, fn: (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; statusCode: number; end: (s?: string) => void }, next: () => void) => void) => void } }) {
      // GET /api/history-files → JSON tree: { "2006": ["file1.xls", ...], ... }
      server.middlewares.use('/api/history-files', (_req, res) => {
        const tree: Record<string, { name: string; size: number }[]> = {}
        try {
          const years = fs.readdirSync(HISTORY_ROOT)
            .filter(y => /^\d{4}$/.test(y))
            .sort()
          for (const year of years) {
            const dir = path.join(HISTORY_ROOT, year)
            const files = fs.readdirSync(dir)
              .filter(f => !f.startsWith('.') && !f.endsWith('.ini'))
              .sort()
              .map(f => {
                let size = 0
                try { size = fs.statSync(path.join(dir, f)).size } catch {}
                return { name: f, size }
              })
            if (files.length) tree[year] = files
          }
        } catch (e) {
          res.statusCode = 500
          res.end(String(e))
          return
        }
        res.setHeader('Content-Type', 'application/json')
        res.statusCode = 200
        res.end(JSON.stringify(tree))
      })

      // GET /api/history-file/:year/:filename → stream file
      server.middlewares.use('/api/history-file', (req, res, next) => {
        const urlPath = (req.url ?? '').split('?')[0]
        const parts   = urlPath.split('/').filter(Boolean)
        if (parts.length < 2) { next(); return }

        const year     = parts[0]
        const filename = decodeURIComponent(parts.slice(1).join('/'))
        const filePath = path.resolve(HISTORY_ROOT, year, filename)

        // Guard against path traversal
        if (!filePath.startsWith(HISTORY_ROOT) || !fs.existsSync(filePath)) {
          res.statusCode = 404
          res.end('Not found')
          return
        }

        const ext  = path.extname(filename).toLowerCase()
        const mime = MIME[ext] ?? 'application/octet-stream'
        // PDFs and images → inline (browser renders); everything else → download
        const viewable   = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.txt'].includes(ext)
        const disposition = viewable ? 'inline' : `attachment; filename="${filename}"`

        res.setHeader('Content-Type', mime)
        res.setHeader('Content-Disposition', disposition)
        res.statusCode = 200
        ;(fs.createReadStream(filePath) as unknown as { pipe: (r: typeof res) => void }).pipe(res)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), juggerHistoryPlugin()],
  server:  { port: 5173, open: true },
})
