/* 小工具包验收：解压真实 zip → headless Chrome 里注入假 window.xhs 容器
 * 覆盖：缓存恢复 / 图鉴合并 / 挑战卡 / 存相册 / 发笔记 / 评论区挑战(snapshot) / 版本降级 / 无容器降级
 * 用法: node tests/minitool.mjs
 */
import { puppeteer, CHROME, ROOT_DIR } from './_puppeteer.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ZIP = path.join(ROOT_DIR, 'which-cat-minitool.zip');

let pass = 0;
const fails = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fails.push(name + (extra !== undefined ? '  → ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : '')); console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(name, actual, expected) { ok(name + ' = ' + JSON.stringify(expected), JSON.stringify(actual) === JSON.stringify(expected), actual); }

if (!fs.existsSync(ZIP)) {
  console.error('先运行 node scripts/build-minitool.mjs 生成 zip');
  process.exit(2);
}
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'which-minitool-'));
execFileSync('unzip', ['-o', '-q', ZIP, '-d', tmpDir]);
const entry = path.join(tmpDir, 'index.html');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}
const allFiles = walk(tmpDir).map((f) => path.relative(tmpDir, f).split(path.sep).join('/'));

console.log('\n[0] zip 结构');
ok('zip 根目录直接是 index.html', allFiles.includes('index.html'));
ok('只有允许的文件类型', !allFiles.some((f) => !/\.(html|css|js|png|jpe?g|gif|webp|svg|woff2?|json)$/i.test(f)), allFiles.join(','));
ok('无开发垃圾文件', !allFiles.some((f) => /node_modules|\.map$|\.DS_Store|vite\.config|webpack/.test(f)));
ok('图标已打进包内', allFiles.includes('assets/icon-192.png') && allFiles.includes('assets/icon-180.png'));
ok('包含全部脚本', ['compat', 'config', 'art', 'art-extra', 'audio', 'xhs', 'challenge', 'collection', 'quiz', 'card', 'main'].every((n) => allFiles.includes('js/' + n + '.js')));
ok('zip 体积 < 2 MiB', fs.statSync(ZIP).size < 2 * 1024 * 1024, (fs.statSync(ZIP).size / 1024).toFixed(1) + ' KiB');

const today = new Date();
const pad = (n) => (n < 10 ? '0' + n : '' + n);
const todayStr = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
const rivalSnap = JSON.stringify({ v: 1, g: 'which', r: 6, d: todayStr, n: '布偶糖主人', k: 'r1v4l9' });

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--hide-scrollbars', '--enable-unsafe-swiftshader'],
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2 },
});

async function openContainer(buildVersion, opts) {
  const o = opts || {};
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) errors.push('http ' + r.status() + ': ' + r.url()); });

  await page.evaluateOnNewDocument((cfg) => {
    try { window.localStorage.clear(); } catch (e) {}
    const calls = (window.__XHS = []);
    const store = Object.assign({}, cfg.store);
    const miniTool = {
      getLaunchOptions: () => Promise.resolve(cfg.launch),
      setStorage: (x) => { calls.push({ api: 'setStorage', key: x.key, data: x.data }); store[x.key] = x.data; return Promise.resolve({ errMsg: 'setStorage:ok' }); },
      getStorage: (x) => {
        calls.push({ api: 'getStorage', key: x.key });
        if (store[x.key] === undefined) return Promise.reject({ errMsg: 'getStorage:fail data not found' });
        return Promise.resolve({ data: store[x.key], errMsg: 'getStorage:ok' });
      },
      writeTempFile: (x) => { calls.push({ api: 'writeTempFile', bytes: (x.data || '').length }); return Promise.resolve({ filePath: 'xhs-temp://which-card.png' }); },
      saveImageToPhotosAlbum: (x) => { calls.push({ api: 'saveImageToPhotosAlbum', filePath: x.filePath }); return Promise.resolve({ errMsg: 'ok' }); },
      postNote: (x) => {
        calls.push({ api: 'postNote', title: x.title, content: x.content, media: x.mediaInfo });
        return Promise.resolve({ errMsg: 'ok' });
      },
      interactionOpenApi: (x) => { calls.push({ api: 'interactionOpenApi', payload: x.payload }); return Promise.resolve({ routed: true, errMsg: 'ok' }); },
      vibrateShort: (x) => { calls.push({ api: 'vibrateShort', type: x && x.type }); return Promise.resolve({ errMsg: 'ok' }); },
    };
    if (cfg.noComment) delete miniTool.interactionOpenApi;
    if (cfg.noVibrate) delete miniTool.vibrateShort;
    if (cfg.noStorage) { delete miniTool.setStorage; delete miniTool.getStorage; }
    window.xhs = {
      launchOptions: { miniToolEnv: { buildVersion: cfg.buildVersion, userDataPath: '/tmp/xhs' }, miniToolSnapshotInfo: cfg.snapshot },
      miniTool,
    };
  }, {
    buildVersion,
    noComment: !!o.noComment,
    noVibrate: !!o.noVibrate,
    noStorage: !!o.noStorage,
    snapshot: o.rival === false ? undefined : rivalSnap,
    store: {
      'which-coll': JSON.stringify(o.coll || { '2': { n: 2, f: '2026-10-20' } }),
      'which-nick': JSON.stringify(o.nick || '布偶糖主人'),
      'which-last': JSON.stringify(o.last || { i: 4, d: todayStr }),
    },
  });

  await page.goto('file://' + entry, { waitUntil: 'load' });
  await page.waitForFunction('window.WHICH_READY === true', { timeout: 15000 });
  await sleep(600);
  return { page, errors };
}

/* ---------------- 1. 9.49 容器 ---------------- */
console.log('\n[1] 容器 9.49+（完整端能力）');
{
  const { page, errors } = await openContainer(9490001, { rival: true });
  const boot = await page.evaluate(() => ({
    inContainer: WHICH.platform.inContainer(),
    canSave: WHICH.platform.canSave(),
    canPost: WHICH.platform.canPost(),
    canCommentSync: WHICH.platform.canCommentSync(),
    canVibrate: WHICH.platform.canVibrate(),
    coll: WHICH.collection.progress(),
    coll2: WHICH.collection.countOf(2),
    nick: WHICH.state.nick,
    last: WHICH.state.last,
    rivalShown: WHICH.ui.rivalShown(),
    rivalName: document.getElementById('rival-name').textContent,
    rivalCat: WHICH.ui.rivalCat(),
    screen: WHICH.screen(),
  }));
  ok('识别为容器环境', boot.inContainer);
  ok('可存相册', boot.canSave);
  ok('可发笔记', boot.canPost);
  ok('可评论区挑战（同步判断）', boot.canCommentSync);
  ok('可震动', boot.canVibrate);
  ok('图鉴从容器缓存恢复', boot.coll.unlocked >= 1, boot.coll);
  ok('图鉴次数恢复', boot.coll2 >= 2, boot.coll2);
  eq('昵称从容器恢复', boot.nick, '布偶糖主人');
  eq('上次结果恢复', boot.last, 4);
  ok('被挑战快照恢复', boot.rivalShown, boot);
  eq('挑战者昵称', boot.rivalName, '布偶糖主人');
  eq('挑战者猫名', boot.rivalCat, '银渐层·高冷总裁');
  eq('仍停在首页', boot.screen, 'intro');

  // 走完一局
  const res = await page.evaluate(async () => {
    WHICH.start();
    const answers = WHICH.autoAnswer(99);
    WHICH.answerAll(answers);
    await new Promise((r) => setTimeout(r, 800));
    return {
      screen: WHICH.screen(),
      index: WHICH.state.result.index,
      name: WHICH.ui.resName(),
      match: WHICH.ui.resMatch(),
      coll: WHICH.collection.progress(),
      unlock: WHICH.ui.unlock(),
      compare: WHICH.ui.compare(),
    };
  });
  eq('结果页打开', res.screen, 'result');
  ok('结果编号合法', res.index >= 0 && res.index < 10, res.index);
  ok('结果名带猫名', /·/.test(res.name), res.name);
  ok('图鉴计数增加', res.coll.unlocked >= 2, res.coll);
  ok('有被挑战对比文案', res.compare.length > 5, res.compare);

  // 存相册
  const saved = await page.evaluate(async () => {
    WHICH.openChallenge();
    await new Promise((r) => setTimeout(r, 400));
    document.getElementById('btn-save').click();
    await new Promise((r) => setTimeout(r, 700));
    const calls = window.__XHS.filter((c) => c.api === 'writeTempFile' || c.api === 'saveImageToPhotosAlbum');
    return { calls, tip: document.getElementById('challenge-tip').textContent };
  });
  ok('存相册：先写临时文件再保存', saved.calls.length >= 2, saved.calls.map((c) => c.api));
  ok('写临时文件带 base64 数据', saved.calls.some((c) => c.api === 'writeTempFile' && c.bytes > 10000), saved.calls);
  ok('保存用的是容器给的 filePath', saved.calls.some((c) => c.api === 'saveImageToPhotosAlbum' && /xhs-temp:/.test(c.filePath)), saved.calls);
  ok('存相册后有反馈', saved.tip.indexOf('已保存') >= 0, saved.tip);

  // 发笔记
  const note = await page.evaluate(async () => {
    document.getElementById('btn-note').click();
    await new Promise((r) => setTimeout(r, 700));
    const c = window.__XHS.filter((x) => x.api === 'postNote').pop();
    return { call: c, tip: document.getElementById('challenge-tip').textContent };
  });
  ok('发笔记调用了 postNote', !!note.call, note.tip);
  if (note.call) {
    ok('笔记标题 ≤ 20 字', note.call.title.length <= 20, [note.call.title, note.call.title.length]);
    ok('笔记标题含"猫"', note.call.title.indexOf('猫') >= 0, note.call.title);
    ok('笔记正文 ≤ 1000 字', note.call.content.length <= 1000, note.call.content.length);
    ok('笔记正文含同题提示', note.call.content.indexOf('同一套') >= 0);
    ok('笔记带 1 张图', note.call.media && note.call.media.image_resources.length === 1, note.call.media);
    ok('笔记图是 PNG dataURL 或容器临时文件', /^(data:image\/png;base64,|xhs-temp:)/.test(note.call.media.image_resources[0].url), note.call.media.image_resources[0].url.slice(0, 32));
  }

  // 评论区挑战
  const cmt = await page.evaluate(async () => {
    document.getElementById('btn-comment').click();
    await new Promise((r) => setTimeout(r, 900));
    const c = window.__XHS.filter((x) => x.api === 'interactionOpenApi').pop();
    return { call: c, tip: document.getElementById('challenge-tip').textContent };
  });
  ok('评论区挑战调用了 interactionOpenApi', !!cmt.call, cmt.tip);
  if (cmt.call) {
    const p = cmt.call.payload;
    eq('动作是 post_comment', p.action, 'post_comment');
    ok('评论正文 ≤ 120 字', p.content.length <= 120, p.content.length);
    ok('评论正文喊人对比', p.content.indexOf('你') >= 0, p.content);
    ok('评论带 1 张图', p.media_bean && p.media_bean.length === 1, p.media_bean);
    eq('图片类型是 image', p.media_bean[0].media_type, 'image');
    ok('图片是 PNG dataURL 或容器临时文件', /^(data:image\/png;base64,|xhs-temp:)/.test(p.media_bean[0].cover_image_url), p.media_bean[0].cover_image_url.slice(0, 32));
    ok('snapshot ≤ 2048 字节', (p.miniToolSnapshotInfo || '').length <= 2048, (p.miniToolSnapshotInfo || '').length);
    const snap = JSON.parse(p.miniToolSnapshotInfo);
    eq('snapshot 游戏标识', snap.g, 'which');
    ok('snapshot 带结果编号', typeof snap.r === 'number' && snap.r >= 0 && snap.r < 10, snap.r);
    ok('snapshot 带昵称', snap.n === '布偶糖主人', snap.n);
    ok('snapshot 带 6 位题号', /^[0-9a-z]{6}$/.test(snap.k), snap.k);
  }

  // 容器缓存写入
  const writes = await page.evaluate(() => window.__XHS.filter((c) => c.api === 'setStorage').map((c) => c.key));
  ok('图鉴写回容器 Storage', writes.indexOf('which-coll') >= 0, writes);
  ok('成绩写回容器 Storage', writes.indexOf('which-last') >= 0, writes);

  // 震动：9.49 还没开放
  const vib = await page.evaluate(async () => {
    const r = await WHICH.platform.vibrate('light');
    return { r, calls: window.__XHS.filter((c) => c.api === 'vibrateShort').length };
  });
  ok('9.49 不调用 vibrateShort（版本门槛）', vib.r === false && vib.calls === 0, vib);
  ok('9.49 全程无报错', errors.length === 0, errors.slice(0, 3));
  await page.close();
}

/* ---------------- 1b. 9.50 容器：震动 ---------------- */
console.log('\n[1b] 容器 9.50（新增 vibrateShort）');
{
  const { page, errors } = await openContainer(9500001, { rival: false });
  const d = await page.evaluate(async () => {
    const r = await WHICH.platform.vibrate('light');
    return { r, calls: window.__XHS.filter((c) => c.api === 'vibrateShort').length };
  });
  ok('9.50 震动走平台 vibrateShort', d.r === true && d.calls >= 1, d);
  ok('9.50 无报错', errors.length === 0, errors.slice(0, 3));
  await page.close();
}

/* ---------------- 2. 9.46 容器（没有评论区能力） ---------------- */
console.log('\n[2] 容器 9.46（无 interactionOpenApi）');
{
  const { page, errors } = await openContainer(9460001, { noComment: true, rival: false });
  const d = await page.evaluate(() => ({
    canCommentSync: WHICH.platform.canCommentSync(),
    canPost: WHICH.platform.canPost(),
    canSave: WHICH.platform.canSave(),
    rivalShown: WHICH.ui.rivalShown(),
    coll: WHICH.collection.progress(),
    nick: WHICH.state.nick,
  }));
  ok('识别为容器环境', d.canSave && d.canPost);
  ok('无评论区能力时 canCommentSync=false', d.canCommentSync === false, d.canCommentSync);
  ok('没有挑战快照时不显示横幅', d.rivalShown === false);
  ok('缓存仍然恢复', d.coll.unlocked >= 1);
  await page.evaluate(async () => {
    WHICH.start();
    WHICH.answerAll(WHICH.autoAnswer(3));
    await new Promise((r) => setTimeout(r, 500));
    WHICH.openChallenge();
    await new Promise((r) => setTimeout(r, 500));
  });
  const ui = await page.evaluate(() => ({
    commentDisabled: document.getElementById('btn-comment').disabled,
    tip: document.getElementById('challenge-tip').textContent,
  }));
  ok('评论区按钮直接禁用', ui.commentDisabled === true);
  ok('提示说明不支持', /9\.49|不支持|发笔记/.test(ui.tip), ui.tip);
  ok('9.46 全程无报错', errors.length === 0, errors.slice(0, 3));
  await page.close();
}

/* ---------------- 3. 9.46 且没有 Storage ---------------- */
console.log('\n[3] 老容器（无平台 Storage）');
{
  const { page, errors } = await openContainer(9440001, { noStorage: true, noComment: true, noVibrate: true, rival: false });
  const d = await page.evaluate(async () => {
    const before = WHICH.collection.progress();
    WHICH.start();
    WHICH.answerAll(WHICH.autoAnswer(11));
    await new Promise((r) => setTimeout(r, 600));
    const after = WHICH.collection.progress();
    if (WHICH.platform.canVibrate()) await WHICH.platform.vibrate('light');
    return { before, after, local: WHICH.storage.get('which-coll'), vibrate: WHICH.platform.canVibrate() };
  });
  ok('无 Storage 也能正常开局', d.before.total === 10);
  ok('本地 localStorage 兜底记录图鉴', d.local && Object.keys(d.local).length >= 1, d.local);
  ok('图鉴计数在本地生效', d.after.unlocked >= 1, d.after);
  ok('无 vibrateShort 时不报错', d.vibrate === false);
  ok('老容器全程无报错', errors.length === 0, errors.slice(0, 3));
  await page.close();
}

/* ---------------- 4. 普通浏览器打开（无容器） ---------------- */
console.log('\n[4] 无容器降级（直接开网页）');
{
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.evaluateOnNewDocument(() => { try { window.localStorage.clear(); } catch (e) {} });
  await page.goto('file://' + path.join(ROOT_DIR, 'index.html'), { waitUntil: 'load' });
  await page.waitForFunction('window.WHICH_READY === true');
  await sleep(300);
  const d = await page.evaluate(async () => {
    WHICH.start();
    WHICH.answerAll(WHICH.autoAnswer(5));
    await new Promise((r) => setTimeout(r, 500));
    WHICH.openChallenge();
    await new Promise((r) => setTimeout(r, 300));
    const tip0 = document.getElementById('challenge-tip').textContent;
    document.getElementById('btn-note').click();
    await new Promise((r) => setTimeout(r, 200));
    return {
      inContainer: WHICH.platform.inContainer(),
      canSave: WHICH.platform.canSave(),
      canPost: WHICH.platform.canPost(),
      canCommentSync: WHICH.platform.canCommentSync(),
      saveDisabled: document.getElementById('btn-save').disabled,
      commentDisabled: document.getElementById('btn-comment').disabled,
      tip0,
      textShown: document.getElementById('challenge-tip').classList.contains('show-text'),
      imgOk: (document.getElementById('challenge-img').src || '').indexOf('data:image/png') === 0,
    };
  });
  ok('非容器环境识别正确', d.inContainer === false);
  ok('非容器不能存相册', d.canSave === false && d.saveDisabled === true);
  ok('非容器不能发笔记', d.canPost === false);
  ok('非容器不能发评论', d.canCommentSync === false && d.commentDisabled === true);
  ok('挑战卡仍然生成', d.imgOk);
  ok('降级提示引导长按保存', /长按|网页版|复制/.test(d.tip0 + (d.textShown ? 'show-text' : '')), d.tip0);
  ok('无容器全程无报错', errors.length === 0, errors.slice(0, 3));
  await page.close();
}

await browser.close();

console.log('\n' + '='.repeat(52));
if (fails.length) {
  console.log(`✗ 失败 ${fails.length} 项 / 通过 ${pass} 项`);
  for (const f of fails) console.log('  - ' + f);
  process.exit(1);
}
console.log(`✓ 全部通过：${pass} 项`);
