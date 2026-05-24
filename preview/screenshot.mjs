import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/toolchains/.nvm/versions/node/v22.22.3/lib/node_modules/playwright');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = `file://${path.resolve(__dirname, 'ui-preview.html')}`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 2200 });
  await page.goto(htmlPath, { waitUntil: 'networkidle' });
  await page.screenshot({
    path: path.resolve(__dirname, 'sniperai-ui-preview.png'),
    fullPage: true,
  });
  console.log('Screenshot saved!');
  await browser.close();
})();
