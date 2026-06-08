import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const filePath = urlPath === '/' || urlPath === '/harness'
        ? path.join(__dirname, 'move-tool-harness.html')
        : path.join(projectRoot, urlPath.replace(/^\//, ''));
    if (!filePath.startsWith(projectRoot)) {
        res.writeHead(403).end('forbidden');
        return;
    }
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404).end(String(err));
            return;
        }
        const ext = path.extname(filePath);
        const type = ext === '.js' ? 'text/javascript'
            : ext === '.css' ? 'text/css'
                : ext === '.html' ? 'text/html'
                    : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type }).end(data);
    });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const harnessUrl = `http://127.0.0.1:${port}/harness`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', (msg) => console.log('[page]', msg.text()));
page.on('pageerror', (err) => console.error('[pageerror]', err));
await page.goto(harnessUrl, { waitUntil: 'networkidle' });
console.log('cropper=', await page.evaluate(() => typeof window.Cropper));
console.log('selectionMoveLogic=', await page.evaluate(() => typeof window.VsimageSelectionMoveLogic));
console.log('image complete=', await page.evaluate(() => document.getElementById('image').complete));
console.log('image natural=', await page.evaluate(() => {
    const img = document.getElementById('image');
    return [img.naturalWidth, img.naturalHeight, img.currentSrc.slice(0, 40)];
}));
try {
    await page.waitForFunction(() => window.__harnessDone !== undefined, null, { timeout: 15000 });
} catch (error) {
    const text = await page.locator('#result').innerText().catch(() => '(no result)');
    console.error(text);
    throw error;
}
const done = await page.evaluate(() => window.__harnessDone);
const text = await page.locator('#result').innerText();
console.log(text);
await browser.close();
server.close();
process.exit(done ? 0 : 1);
