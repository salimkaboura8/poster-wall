import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';

// letterboxd.com sends no CORS headers, so the browser reads member RSS feeds through
// this same-origin proxy (dev and preview). Deployed builds can point
// VITE_LETTERBOXD_PROXY at any equivalent proxy (e.g. a tiny serverless function).
const letterboxd: Record<string, ProxyOptions> = {
  '/letterboxd': {
    target: 'https://letterboxd.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/letterboxd/, ''),
    headers: { 'User-Agent': 'PosterWall/0.2 (+https://github.com/salimkaboura8/poster-wall)' },
  },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5178, proxy: letterboxd },
  preview: { proxy: letterboxd },
});
