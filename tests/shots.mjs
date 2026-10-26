/* 生成 README / 笔记用截图与分享图
 * 用法: node tests/shots.mjs  （先 node server.mjs 启动 5191 端口）
 */
import { puppeteer, CHROME, ROOT_DIR } from './_puppeteer.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.WHICH_BASE || 'http://127.0.0.1:5191/';
const OUT = path.join(ROOT_DIR, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function writeDataUrl(file, dataUrl) {
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  fs.writeFileSync(file, buf);
  console.log(' ', path.basename(file), (buf.length / 1024).toFixed(1) + ' KiB');
}

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--hide-scrollbars', '--enable-unsafe-swiftshader'],
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForFunction('window.WHICH_READY === true', { timeout: 15000 });
await sleep(500);
await page.screenshot({ path: path.join(OUT, '01-intro.png') });

// 答题中：第 3 题，已选第 2 个选项
await page.evaluate(() => {
  WHICH.start();
  document.querySelectorAll('#opt-list .opt')[0].click();
});
await sleep(320);
await page.evaluate(() => {
  document.querySelectorAll('#opt-list .opt')[1].click();
});
await sleep(320);
await page.evaluate(() => {
  WHICH.ui.options();
  // 停在第三题，把第二个选项点亮给截图看
  const el = document.querySelectorAll('#opt-list .opt')[1];
  el.classList.add('picked');
});
await sleep(200);
await page.screenshot({ path: path.join(OUT, '02-quiz.png') });

// 结果页：挑一组能得到「布偶糖·黏人精」的答案
const res = await page.evaluate(() => {
  const target = 1;
  const day = WHICH.day();
  let answers = WHICH.autoAnswer(17);
  for (let i = 0; i < 4000; i++) {
    const idx = WHICH.quiz.evaluate(answers, day.date).index;
    if (idx === target) break;
    answers = WHICH.quiz.evaluate(answers, day.date).ranked;
    answers = WHICH.autoAnswer(i * 31 + 7);
  }
  const r = WHICH.quiz.evaluate(answers, day.date);
  WHICH.answerAll(answers);
  return { index: r.index, name: r.cat.name + '·' + r.cat.tag, match: r.match };
});
console.log('  结果页猫:', res.name, res.match + '%');
await sleep(700);
await page.screenshot({ path: path.join(OUT, '03-result.png') });

// 图鉴：解锁 6 只
await page.evaluate(() => {
  const data = {};
  [0, 1, 2, 3, 5, 8].forEach((i, k) => { data[String(i)] = { n: k + 1, f: '2026-10-' + (16 + k * 2) }; });
  WHICH.collection._inject(data);
  WHICH.refreshIntro();
  WHICH.renderGallery();
  WHICH.showScreen('gallery');
});
await sleep(320);
await page.screenshot({ path: path.join(OUT, '04-gallery.png') });

// 挑战面板
await page.evaluate(() => {
  WHICH.showScreen('result');
  WHICH.openChallenge();
});
await sleep(500);
await page.screenshot({ path: path.join(OUT, '05-challenge.png') });

// 卡片原图 + 封面
const imgs = await page.evaluate(() => {
  const card = WHICH.cards.build();
  const cover = WHICH.cards.cover();
  return { card: card.toDataURL('image/png'), cover: cover.toDataURL('image/png') };
});
writeDataUrl(path.join(OUT, 'share-card.png'), imgs.card);
writeDataUrl(path.join(OUT, 'cover.png'), imgs.cover);

// 宽屏（桌面居中框）
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
await page.evaluate(() => { WHICH.showScreen('intro'); WHICH.refreshIntro(); });
await sleep(400);
await page.screenshot({ path: path.join(OUT, '06-wide.png') });

// 小屏
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 2 });
await page.evaluate(() => { WHICH.showScreen('intro'); WHICH.refreshIntro(); });
await sleep(350);
await page.screenshot({ path: path.join(OUT, '07-small.png') });

await browser.close();
console.log('截图完成 → shots/');
