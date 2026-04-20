const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCREENSHOT_DIR = path.join(ROOT, 'screenshots');

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

async function captureScreenshot(target, filename) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const screenshotPath = path.join(SCREENSHOT_DIR, filename);
  await target.screenshot({ path: screenshotPath });
  assert.equal(fs.existsSync(screenshotPath), true);
  assert.equal(fs.statSync(screenshotPath).size > 0, true);
}

async function checkFullSurface() {
  await withPage(async ({ goto, page, assertNoBrowserErrors }) => {
    const response = await goto('/demos/full-surface.html');
    assert.equal(response.status(), 200);

    await page.waitForSelector('.sf-header', { timeout: 10000 });
    await page.waitForSelector('.sf-statusbar', { timeout: 10000 });
    await page.waitForSelector('.sf-tabs-container', { timeout: 10000 });
    await page.waitForSelector('.sf-table', { timeout: 10000 });
    await page.waitForSelector('.sf-rail-timeline', { timeout: 10000 });
    await page.waitForSelector('.sf-footer', { timeout: 10000 });

    await page.getByRole('tab', { name: /gantt/i }).click({ timeout: 10000 });
    await page.waitForSelector('.sf-gantt-split', { timeout: 10000 });

    await page.getByRole('tab', { name: /api/i }).click({ timeout: 10000 });
    await page.waitForSelector('.sf-api-guide', { timeout: 10000 });

    const title = await page.locator('.sf-header-title').textContent();
    assert.equal(title, 'Planner123');

    const timelineCount = await page.locator('.sf-rail-timeline').count();
    const ganttRows = await page.locator('.sf-gantt-row').count();
    assert.equal(timelineCount, 1);
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

async function checkTimelineDemo() {
  await withPage(async ({ goto, page, assertNoBrowserErrors }) => {
    await page.setViewportSize({ width: 1400, height: 1200 });

    const response = await goto('/demos/timeline.html');
    assert.equal(response.status(), 200);

    await page.waitForSelector('.sf-rail-timeline', { timeout: 10000 });
    await page.waitForSelector('.sf-rail-timeline-item--cluster', { timeout: 10000 });

    const timelineCount = await page.locator('.sf-rail-timeline').count();
    const clusterCount = await page.locator('.sf-rail-timeline-item--cluster').count();
    const weekendBandCount = await page.locator('.sf-rail-timeline-weekend-band').count();
    const summaryPillCount = await page.locator('.sf-rail-timeline-summary-pill').count();

    assert.equal(timelineCount, 1);
    assert.equal(clusterCount >= 2, true);
    assert.equal(weekendBandCount > 0, true);
    assert.equal(summaryPillCount > 0, true);

    const layoutMetrics = await page.locator('.sf-rail-timeline').evaluate((root) => {
      const header = root.querySelector('.sf-rail-timeline-header-viewport');
      const body = root.querySelector('.sf-rail-timeline-body-viewport');
      const styles = getComputedStyle(root);
      const labelWidth = Number.parseFloat(styles.getPropertyValue('--sf-rail-label-width'));
      const viewportDuration = Number(root.dataset.viewportDurationMinutes);
      const timelineSpan = Number(root.dataset.timelineSpanMinutes);
      const visibleTrackWidth = body.clientWidth - labelWidth;
      const scale = timelineSpan > 0 && viewportDuration > 0
        ? timelineSpan / viewportDuration
        : 1;
      const expectedContentWidth = labelWidth + Math.max(
        Math.round(visibleTrackWidth * scale),
        visibleTrackWidth,
        480
      );
      return {
        bodyClientWidth: body.clientWidth,
        bodyScrollWidth: body.scrollWidth,
        expectedContentWidth,
        headerClientWidth: header.clientWidth,
        headerScrollWidth: header.scrollWidth,
        labelWidth,
      };
    });

    assert.equal(Math.abs(layoutMetrics.bodyScrollWidth - layoutMetrics.expectedContentWidth) <= 1, true);
    assert.equal(layoutMetrics.bodyScrollWidth > layoutMetrics.bodyClientWidth, true);
    assert.equal(layoutMetrics.headerScrollWidth > layoutMetrics.headerClientWidth, true);

    await page.locator('.sf-rail-timeline-body-viewport').evaluate((body) => {
      body.scrollLeft = 240;
      body.dispatchEvent(new Event('scroll'));
    });

    const syncedScroll = await page.locator('.sf-rail-timeline').evaluate((root) => {
      const header = root.querySelector('.sf-rail-timeline-header-viewport');
      const body = root.querySelector('.sf-rail-timeline-body-viewport');
      return {
        bodyScrollLeft: body.scrollLeft,
        headerScrollLeft: header.scrollLeft,
        viewportStartMinute: Number(root.dataset.viewportStartMinute),
      };
    });

    assert.equal(syncedScroll.bodyScrollLeft, 240);
    assert.equal(syncedScroll.headerScrollLeft, 240);
    assert.notEqual(syncedScroll.viewportStartMinute, 0);

    await page.locator('.sf-rail-timeline-item--cluster').first().focus();

    const focusTooltip = await page.locator('.sf-rail-timeline').evaluate((root) => {
      const tooltip = root.querySelector('.sf-rail-timeline-tooltip');
      const block = root.querySelector('.sf-rail-timeline-item--cluster');
      return {
        describedBy: block.getAttribute('aria-describedby'),
        tooltipId: tooltip.id,
        tooltipVisible: tooltip.classList.contains('visible'),
        tooltipHiddenAttr: tooltip.getAttribute('aria-hidden'),
      };
    });

    assert.equal(focusTooltip.describedBy, focusTooltip.tooltipId);
    assert.equal(focusTooltip.tooltipVisible, true);
    assert.equal(focusTooltip.tooltipHiddenAttr, 'false');

    await captureScreenshot(page.locator('.sf-rail-timeline-row').first(), 'rail-timeline-overview.png');

    const baselineDetailCount = await page.locator('.sf-rail-timeline-item--detail').count();

    await page.locator('.sf-rail-timeline-item--cluster').first().click();

    const expandedClusterState = await page.locator('.sf-rail-timeline').evaluate((root) => {
      const cluster = root.querySelector('.sf-rail-timeline-item--cluster');
      return {
        actionText: cluster ? cluster.textContent : '',
        ariaExpanded: cluster ? cluster.getAttribute('aria-expanded') : null,
        detailCount: root.querySelectorAll('.sf-rail-timeline-item--detail').length,
      };
    });

    assert.equal(expandedClusterState.ariaExpanded, 'true');
    assert.equal(expandedClusterState.actionText.includes('Enter to collapse'), true);

    const detailCount = await page.locator('.sf-rail-timeline-item--detail').count();
    assert.equal(detailCount > baselineDetailCount, true);

    await page.locator('.sf-rail-timeline-item--cluster').first().click();

    const collapsedClusterState = await page.locator('.sf-rail-timeline').evaluate((root) => {
      const cluster = root.querySelector('.sf-rail-timeline-item--cluster');
      return {
        actionText: cluster ? cluster.textContent : '',
        ariaExpanded: cluster ? cluster.getAttribute('aria-expanded') : null,
        detailCount: root.querySelectorAll('.sf-rail-timeline-item--detail').length,
      };
    });

    assert.equal(collapsedClusterState.ariaExpanded, 'false');
    assert.equal(collapsedClusterState.actionText.includes('Enter to inspect'), true);
    assert.equal(collapsedClusterState.detailCount, baselineDetailCount);

    await page.locator('.sf-rail-timeline-item--cluster').first().click();

    await captureScreenshot(page.locator('.sf-rail-timeline-row').first(), 'rail-timeline-expanded.png');
    await captureScreenshot(page.locator('.sf-rail-timeline-row').nth(2), 'rail-timeline-detailed.png');

    await page.setViewportSize({ width: 700, height: 1200 });
    await page.waitForFunction(() => {
      const root = document.querySelector('.sf-rail-timeline');
      if (!root) return false;
      const labelWidth = Number.parseFloat(getComputedStyle(root).getPropertyValue('--sf-rail-label-width'));
      return labelWidth > 0 && labelWidth < 280;
    }, { timeout: 10000 });
    await captureScreenshot(page.locator('.sf-rail-timeline'), 'rail-timeline-narrow.png');

    assertNoBrowserErrors();
  });
}

async function checkDenseTimelineDemo() {
  await withPage(async ({ goto, page, assertNoBrowserErrors }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });

    const response = await goto('/demos/timeline-dense.html');
    assert.equal(response.status(), 200);

    await page.waitForSelector('.sf-rail-timeline-row', { timeout: 10000 });
    await page.waitForFunction(() => {
      return window.__denseTimelineMetrics && window.__denseTimelineMetrics.laneCount === 100;
    }, { timeout: 10000 });

    const metrics = await page.evaluate(() => window.__denseTimelineMetrics);
    const denseCounts = await page.locator('.sf-rail-timeline').evaluate((root) => ({
      clusterCount: root.querySelectorAll('.sf-rail-timeline-item--cluster').length,
      rowCount: root.querySelectorAll('.sf-rail-timeline-row').length,
      summaryPillCount: root.querySelectorAll('.sf-rail-timeline-summary-pill').length,
    }));

    assert.equal(metrics.laneCount, 100);
    assert.equal(metrics.itemCount, 1500);
    assert.equal(Number.isFinite(metrics.renderMs), true);
    assert.equal(denseCounts.rowCount, 100);
    assert.equal(denseCounts.clusterCount > 0, true);
    assert.equal(denseCounts.summaryPillCount > 0, true);

    assertNoBrowserErrors();
  });
}

async function checkTimelineDemoWithoutResizeObserver() {
  await withPage(async ({ goto, page, assertNoBrowserErrors }) => {
    await page.addInitScript(() => {
      delete window.ResizeObserver;
    });
    await page.setViewportSize({ width: 1400, height: 1200 });

    const response = await goto('/demos/timeline.html');
    assert.equal(response.status(), 200);

    await page.waitForSelector('.sf-rail-timeline-row', { timeout: 10000 });

    const initialMetrics = await page.locator('.sf-rail-timeline').evaluate((root) => ({
      headerCells: root.querySelector('.sf-rail-timeline-header-row').children.length,
      labelWidth: Number.parseFloat(getComputedStyle(root).getPropertyValue('--sf-rail-label-width')),
      rowCount: root.querySelectorAll('.sf-rail-timeline-row').length,
    }));

    assert.equal(initialMetrics.headerCells, 2);
    assert.equal(initialMetrics.rowCount > 0, true);
    assert.equal(initialMetrics.labelWidth, 280);

    await page.setViewportSize({ width: 700, height: 1200 });
    await page.waitForFunction(() => {
      const root = document.querySelector('.sf-rail-timeline');
      if (!root) return false;
      const labelWidth = Number.parseFloat(getComputedStyle(root).getPropertyValue('--sf-rail-label-width'));
      return labelWidth > 0 && labelWidth < 280;
    }, { timeout: 10000 });

    const resizedMetrics = await page.locator('.sf-rail-timeline').evaluate((root) => ({
      labelWidth: Number.parseFloat(getComputedStyle(root).getPropertyValue('--sf-rail-label-width')),
      supportedViewportWidth: root.dataset.supportedViewportWidth,
    }));

    assert.equal(resizedMetrics.labelWidth < 280, true);
    assert.equal(resizedMetrics.supportedViewportWidth, 'true');

    assertNoBrowserErrors();
  });
}

(async function main() {
  try {
    await runCheck('full-surface demo', checkFullSurface);
    await runCheck('timeline demo', checkTimelineDemo);
    await runCheck('dense timeline demo', checkDenseTimelineDemo);
    await runCheck('timeline demo without ResizeObserver', checkTimelineDemoWithoutResizeObserver);
    await runCheck('rail demo', checkRailDemo);
  } catch (error) {
    process.exit(1);
  }
})();
