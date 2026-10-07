// Minimal statisk server for lokal kjøring. Ingen avhengigheter, ingen backend.
// Bruk: npm start  (bygger først)  ->  http://localhost:8080
// Uten Claude-artefaktmiljøet finnes ingen delt database og ingen connectorer: Salong kjører i lokal demomodus
// (data lagres bare i nettleseren) og research/Apollo er «ikke tilkoblet». Se docs/architecture.md.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', 'dist'), port = Number(process.env.PORT) || 8080;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(root, path.normalize(p));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Ikke funnet'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log('Salong kjører på http://localhost:' + port));
