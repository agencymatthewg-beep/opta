const { test } = require('@playwright/test');

test('debug center node', async ({ page }) => {
  await page.goto('http://127.0.0.1:4174/', { waitUntil: 'networkidle' });
  const counts = await page.evaluate(() => {
    const center = document.querySelectorAll('.center-code-node').length;
    const scene = document.querySelectorAll('.scene-node').length;
    const satellites = document.querySelectorAll('.satellite-node').length;
    const centerEl = document.querySelector('.center-code-node');
    return {
      center,
      scene,
      satellites,
      centerStyle: centerEl ? centerEl.getAttribute('style') : null,
      centerRect: centerEl ? centerEl.getBoundingClientRect().toJSON() : null,
      ids: Array.from(document.querySelectorAll('.scene-node .tooltip-title')).map((el) => el.textContent),
    };
  });
  console.log(JSON.stringify(counts, null, 2));
});
