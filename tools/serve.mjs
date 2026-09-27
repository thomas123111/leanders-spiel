// Kleiner Entwicklungs-Server ohne Abhängigkeiten: node tools/serve.mjs [port]
// Liefert das Repo statisch aus, ohne Browser-Cache, damit Änderungen sofort sichtbar sind.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || process.env.PORT || 8123);
const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
    // Nur für die Entwicklung: PNG-Symbole aus dem Browser speichern (PUT /__save/icons/<name>.png)
    if (req.method === 'PUT' && req.url.startsWith('/__save/icons/')) {
        const name = path.basename(decodeURIComponent(req.url.slice('/__save/icons/'.length)));
        if (!/^[\w-]+\.png$/.test(name)) {
            res.writeHead(400).end('ungültiger Name');
            return;
        }
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
            fs.writeFile(path.join(root, 'icons', name), Buffer.concat(chunks), err => {
                res.writeHead(err ? 500 : 200).end(err ? String(err) : 'gespeichert');
            });
        });
        return;
    }
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(root, rel);
    if (!file.startsWith(root) || file.includes(`${path.sep}.git${path.sep}`)) {
        res.writeHead(403).end('verboten');
        return;
    }
    fs.readFile(file, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('nicht gefunden');
            return;
        }
        res.writeHead(200, {
            'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-store',
        });
        res.end(data);
    });
}).listen(port, '127.0.0.1', () => {
    console.log(`Spiel läuft auf http://127.0.0.1:${port}/`);
});
