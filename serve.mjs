// Local preview: `npm run serve`, then open http://localhost:8080
// Serves dist/ with clean URLs, the same way GitHub Pages does.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'dist');
const PORT = Number(process.env.PORT || 8080);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.xml': 'application/xml', '.txt': 'text/plain',
};

createServer((req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  const tries = [join(OUT, path), join(OUT, path, 'index.html'), join(OUT, path + '.html')];
  const hit = tries.find((p) => existsSync(p) && statSync(p).isFile());
  if (!hit) {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(existsSync(join(OUT, '404.html')) ? readFileSync(join(OUT, '404.html')) : 'not found');
  }
  res.writeHead(200, { 'content-type': TYPES[extname(hit)] || 'application/octet-stream' });
  res.end(readFileSync(hit));
}).listen(PORT, () => console.log(`serving dist/ on http://localhost:${PORT}`));
