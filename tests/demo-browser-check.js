const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function contentTypeFor(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'application/octet-stream';
  }
}

function mapRequestPath(requestPath) {
  const decodedPath = decodeURIComponent(requestPath).replace(/^\/+/, '');
  if (decodedPath.startsWith('sf/')) {
    return path.join('static', decodedPath);
  }
  return decodedPath;
}

function createStaticServer(rootDir) {
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    const requestPath = new URL(req.url, 'http://127.0.0.1').pathname;
    const relativePath = mapRequestPath(requestPath);
    const targetPath = path.resolve(rootDir, relativePath || 'index.html');

    if (!targetPath.startsWith(rootDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    let filePath = targetPath;
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    res.writeHead(200, {
      'Connection': 'close',
      'Content-Type': contentTypeFor(filePath),
    });
    fs.createReadStream(filePath).pipe(res);
  });

  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        close: () => new Promise((done) => {
          sockets.forEach((socket) => socket.destroy());
          if (typeof server.closeAllConnections === 'function') {
            server.closeAllConnections();
          }
          server.close(done);
        }),
        origin: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

async function withPage(callback) {
  let playwright;
  try {
    playwright = require('playwright');
  } catch (error) {
    throw new Error('Playwright is not installed. Run `make browser-setup` first.');
  }

  const server = await createStaticServer(ROOT);
  let browser;

  try {
    browser = await playwright.chromium.launch({ headless: true });
  } catch (error) {
    await server.close();
    throw new Error('Chromium for Playwright is not installed. Run `make browser-setup` first.');
  }

  const page = await browser.newPage();
  const pageErrors = [];
  const requestFailures = [];
  const consoleErrors = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  page.on('requestfailed', (request) => {
    requestFailures.push(`${request.method()} ${request.url()} :: ${request.failure().errorText}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    await callback({
      assertNoBrowserErrors() {
        assert.deepEqual(pageErrors, [], `Page errors: ${pageErrors.join(' | ')}`);
        assert.deepEqual(requestFailures, [], `Request failures: ${requestFailures.join(' | ')}`);
        assert.deepEqual(consoleErrors, [], `Console errors: ${consoleErrors.join(' | ')}`);
      },
      goto: (relativePath) => page.goto(`${server.origin}${relativePath}`, { waitUntil: 'load' }),
      page,
    });
  } finally {
    await page.close();
    await browser.close();
    await server.close();
  }
}

async function runCheck(name, fn) {
  try {
    await fn();
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    process.stderr.write(`FAIL ${name}\n${error.stack || error.message}\n`);
    throw error;
  }
}

async function checkFullSurface() {
  await withPage(async ({ goto, page, assertNoBrowserErrors }) => {
    const response = await goto('/demos/full-surface.html');
    assert.equal(response.status(), 200);

    await page.waitForSelector('.sf-header', { timeout: 10000 });
    await page.waitForSelector('.sf-statusbar', { timeout: 10000 });
    await page.waitForSelector('.sf-tabs-container', { timeout: 10000 });
    await page.waitForSelector('.sf-table', { timeout: 10000 });
    await page.waitForSelector('.sf-rail', { timeout: 10000 });
    await page.waitForSelector('.sf-footer', { timeout: 10000 });

    await page.getByRole('tab', { name: /gantt/i }).click({ timeout: 10000 });
    await page.waitForSelector('.sf-gantt-split', { timeout: 10000 });

    await page.getByRole('tab', { name: /api/i }).click({ timeout: 10000 });
    await page.waitForSelector('.sf-api-guide', { timeout: 10000 });

    const title = await page.locator('.sf-header-title').textContent();
    assert.equal(title, 'Planner123');

    const ganttRows = await page.locator('.sf-gantt-row').count();
    assert.equal(ganttRows, 3);

    const apiSections = await page.locator('.sf-api-section').count();
    assert.equal(apiSections, 2);

    assertNoBrowserErrors();
  });
}

async function checkRailDemo() {
  await withPage(async ({ goto, page, assertNoBrowserErrors }) => {
    const response = await goto('/demos/rail.html');
    assert.equal(response.status(), 200);

    await page.waitForSelector('#app', { timeout: 10000 });
    await page.waitForSelector('.sf-rail', { timeout: 10000 });

    const railCount = await page.locator('.sf-rail').count();
    const blockCount = await page.locator('.sf-block').count();
    const gaugeCount = await page.locator('.sf-gauge-row').count();

    assert.equal(railCount, 2);
    assert.equal(blockCount, 4);
    assert.equal(gaugeCount, 4);

    const furnaceLabels = await page.locator('.sf-resource-name').allTextContents();
    assert.deepEqual(furnaceLabels, ['FORNO 1', 'FORNO 2']);

    assertNoBrowserErrors();
  });
}

(async function main() {
  try {
    await runCheck('full-surface demo', checkFullSurface);
    await runCheck('rail demo', checkRailDemo);
  } catch (error) {
    process.exit(1);
  }
})();
