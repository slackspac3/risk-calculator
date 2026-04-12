#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const playwrightCli = require.resolve('@playwright/test/cli');
const forwardedArgs = process.argv.slice(2);

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2']
]);

function resolveRequestPath(requestUrl = '/') {
  const url = new URL(requestUrl, 'http://127.0.0.1');
  const pathname = decodeURIComponent(url.pathname || '/');
  const safePath = pathname === '/'
    ? 'index.html'
    : pathname.replace(/^\/+/, '');
  const resolved = path.resolve(root, safePath);
  return resolved.startsWith(root) ? resolved : null;
}

function shouldServeIndexHtml(requestUrl = '/', headers = {}) {
  const url = new URL(requestUrl, 'http://127.0.0.1');
  const pathname = String(url.pathname || '/');
  if (pathname === '/' || pathname.endsWith('/')) return true;
  if (path.extname(pathname)) return false;
  return String(headers.accept || '').includes('text/html');
}

function writeResponse(res, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': contentType
  });
  res.end(body);
}

function serveStatic(req, res) {
  if (!req || !res) return;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    writeResponse(res, 405, 'Method Not Allowed');
    return;
  }
  const resolvedPath = resolveRequestPath(req.url);
  const fallbackToIndex = shouldServeIndexHtml(req.url, req.headers || {});
  const candidatePaths = [];
  if (resolvedPath) candidatePaths.push(resolvedPath);
  if (fallbackToIndex) candidatePaths.push(path.join(root, 'index.html'));

  for (const candidatePath of candidatePaths) {
    if (!candidatePath || !candidatePath.startsWith(root)) continue;
    if (!fs.existsSync(candidatePath) || fs.statSync(candidatePath).isDirectory()) continue;
    const extension = path.extname(candidatePath).toLowerCase();
    const contentType = MIME_TYPES.get(extension) || 'application/octet-stream';
    res.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': contentType
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(candidatePath).pipe(res);
    return;
  }

  writeResponse(res, 404, 'Not Found');
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer(serveStatic);
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address !== 'object') {
        reject(new Error('Static server did not expose a usable address.'));
        return;
      }
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`
      });
    });
  });
}

function closeServer(server) {
  if (!server) return Promise.resolve();
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

async function main() {
  const env = { ...process.env };
  let server = null;
  let baseUrl = String(env.PLAYWRIGHT_BASE_URL || '').trim();

  if (!baseUrl) {
    const started = await startStaticServer();
    server = started.server;
    baseUrl = started.baseUrl;
    env.PLAYWRIGHT_BASE_URL = baseUrl;
    process.stdout.write(`[playwright] Managed static server: ${baseUrl}\n`);
  } else {
    process.stdout.write(`[playwright] External base URL: ${baseUrl}\n`);
  }

  const child = spawn(process.execPath, [playwrightCli, 'test', ...forwardedArgs], {
    cwd: root,
    env,
    stdio: 'inherit'
  });

  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    await closeServer(server);
  };

  const forwardSignal = (signal) => {
    if (!child.killed) child.kill(signal);
  };

  process.once('SIGINT', () => forwardSignal('SIGINT'));
  process.once('SIGTERM', () => forwardSignal('SIGTERM'));

  child.once('error', async (error) => {
    await cleanup();
    throw error;
  });

  child.once('exit', async (code, signal) => {
    await cleanup();
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(typeof code === 'number' ? code : 1);
  });
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
