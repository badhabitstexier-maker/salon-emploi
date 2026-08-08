/*
  Petit serveur de fichiers statiques, sans dépendance supplémentaire —
  sert un dossier `dist` de build Astro pour les besoins de la recette E2E
  (voir global-setup.ts). Volontairement minimal : ce n'est pas un serveur de
  production, seulement un support de test local.
*/
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

export interface StaticServerHandle {
  ready: Promise<void>;
  close: () => Promise<void>;
}

export function startStaticServer(rootDir: string, port: number): StaticServerHandle {
  const root = path.resolve(rootDir);

  const server = http.createServer((req, res) => {
    try {
      const requestPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
      let filePath = path.join(root, requestPath);

      // Empêche toute sortie du dossier servi (traversal via `..`).
      if (!filePath.startsWith(root)) {
        res.writeHead(400);
        res.end('Bad request');
        return;
      }

      if (existsSync(filePath) && statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
      if (!existsSync(filePath) && !path.extname(filePath)) {
        // Astro génère des routes sans extension (ex. /exposants -> /exposants/index.html).
        const withIndex = path.join(root, requestPath, 'index.html');
        if (existsSync(withIndex)) filePath = withIndex;
      }

      if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
        const notFoundPage = path.join(root, '404.html');
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(existsSync(notFoundPage) ? readFileSync(notFoundPage) : '404 Not Found');
        return;
      }

      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream' });
      res.end(readFileSync(filePath));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`500 — ${(error as Error).message}`);
    }
  });

  const ready = new Promise<void>((resolve) => {
    server.listen(port, '127.0.0.1', resolve);
  });

  return {
    ready,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
