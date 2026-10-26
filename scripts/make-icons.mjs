#!/usr/bin/env node
/* 生成图标（1024/512/192/180）：一只抬头看「？」的猫，全部用游戏内矢量绘制。
 * 用法: node scripts/make-icons.mjs
 */
import { puppeteer, CHROME, ROOT_DIR } from '../tests/_puppeteer.mjs';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(ROOT_DIR, 'assets');
const SIZES = [['icon-1024.png', 1024], ['icon-512.png', 512], ['icon-192.png', 192], ['icon-180.png', 180]];

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  defaultViewport: { width: 900, height: 900, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
await page.goto('file://' + path.join(ROOT_DIR, 'index.html'), { waitUntil: 'load' });
await page.waitForFunction('window.WHICH_READY === true', { timeout: 15000 });

const urls = await page.evaluate((sizes) => {
  const Scene = window.WhichArt;
  const Art = window.CatArt;
  const FONT = '"PingFang SC", "Hiragino Sans GB", sans-serif';

  function draw(size) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const k = size / 1024;

    const bg = ctx.createLinearGradient(0, 0, size * 0.4, size);
    bg.addColorStop(0, '#fffaf4');
    bg.addColorStop(0.6, '#ffe9d2');
    bg.addColorStop(1, '#ffd3ad');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    const glow = ctx.createRadialGradient(size * 0.5, size * 0.2, 0, size * 0.5, size * 0.3, size * 0.8);
    glow.addColorStop(0, 'rgba(255,250,225,0.95)');
    glow.addColorStop(1, 'rgba(255,250,225,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    Scene.paw(ctx, size * 0.14, size * 0.14, 26 * k, 'rgba(226,150,102,0.28)');
    Scene.paw(ctx, size * 0.86, size * 0.20, 20 * k, 'rgba(226,150,102,0.22)');

    // 猫
    const cx = size * 0.5;
    const cy = size * 0.54;
    const r = size * 0.30;
    Scene.podium(ctx, cx, cy + r * 0.86, r * 0.9);
    ctx.save();
    ctx.translate(cx, cy);
    Art.draw(ctx, { x: 0, y: 0, r: r, level: 1, face: 'normal', t: 0.5 });
    ctx.restore();

    // 问号气泡
    const bx = size * 0.755;
    const by = size * 0.245;
    const br = size * 0.115;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx - br * 0.55, by + br * 0.72);
    ctx.lineTo(bx - br * 0.9, by + br * 1.35);
    ctx.lineTo(bx - br * 0.02, by + br * 0.95);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff8a3d';
    ctx.font = '900 ' + Math.round(br * 1.5) + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', bx, by + br * 0.06);

    for (let i = 0; i < 4; i++) {
      const a = i * 1.6 + 0.4;
      Scene.sparkle(ctx, cx + Math.cos(a) * r * 1.7, cy + Math.sin(a) * r * 1.5, 12 * k,
        i % 2 ? 'rgba(255,205,120,0.9)' : 'rgba(255,255,255,0.95)', a);
    }
    return c.toDataURL('image/png');
  }

  const out = {};
  for (const [name, size] of sizes) out[name] = draw(size);
  return out;
}, SIZES);

fs.mkdirSync(OUT, { recursive: true });
for (const [name] of SIZES) {
  const buf = Buffer.from(urls[name].split(',')[1], 'base64');
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(name, (buf.length / 1024).toFixed(1) + ' KiB');
}
await browser.close();
