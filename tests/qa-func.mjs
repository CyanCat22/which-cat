/* 《你是哪只猫》功能验收（网页版，真 Chrome）
 * 用法: node tests/qa-func.mjs
 */
import { puppeteer, CHROME, ROOT_DIR } from './_puppeteer.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
const fails = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fails.push(name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(name, actual, expected) { ok(name + ' = ' + JSON.stringify(expected), JSON.stringify(actual) === JSON.stringify(expected), actual); }

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--hide-scrollbars', '--enable-unsafe-swiftshader'],
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2 },
});

const errors = [];
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
page.on('response', (r) => { if (r.status() >= 400) errors.push('http ' + r.status() + ': ' + r.url()); });
// 每次从干净缓存开始，避免上一次运行留下的图鉴影响断言
await page.evaluateOnNewDocument(() => { try { window.localStorage.clear(); } catch (e) {} });
await page.goto('file://' + encodeURI(ROOT_DIR + '/index.html'), { waitUntil: 'load' });
await page.waitForFunction('window.WHICH_READY === true', { timeout: 15000 });
await sleep(300);

console.log('\n[1] 启动与数据');
{
  const d = await page.evaluate(() => ({
    cats: WCFG.CATS.length,
    questions: WCFG.QUESTIONS.length,
    count: WCFG.COUNT,
    axes: WCFG.AXES.map((a) => a.key).join(''),
    screen: WHICH.screen(),
    hasStart: !!document.getElementById('btn-start'),
    hero: WHICH.heroIndex(),
    title: document.title,
    progress: WHICH.collection.progress(),
    items: WHICH.day().items.length,
    itemTexts: WHICH.day().items.map((i) => i.text),
    optCounts: WHICH.day().items.map((i) => i.options.length),
  }));
  eq('10 只结果猫', d.cats, 10);
  eq('20 道题库', d.questions, 20);
  eq('每天 10 道', d.count, 10);
  eq('五个维度', d.axes, 'EACIL');
  eq('首屏是首页', d.screen, 'intro');
  eq('今日 10 道题', d.items, 10);
  ok('每题 4 个选项', d.optCounts.every((n) => n === 4), d.optCounts);
  ok('题目不重复', new Set(d.itemTexts).size === 10);
  ok('页面标题含"你是哪只猫"', d.title.indexOf('你是哪只猫') >= 0, d.title);
  ok('初始图鉴 0/10', d.progress.unlocked === 0 && d.progress.total === 10, d.progress);
  ok('首页有开始按钮', d.hasStart);
  ok('今日猫下标合法', d.hero >= 0 && d.hero < 10, d.hero);
}

console.log('\n[2] 每日同题（确定性）');
{
  const d = await page.evaluate(() => {
    const a = WHICH.quiz.build('2026-10-26');
    const b = WHICH.quiz.build('2026-10-26');
    const c = WHICH.quiz.build('2026-10-27');
    const same = JSON.stringify(a.items) === JSON.stringify(b.items);
    return {
      same,
      codeA: a.code, codeB: b.code, codeC: c.code,
      differ: JSON.stringify(a.items) !== JSON.stringify(c.items),
      seedA: a.seed, seedB: b.seed,
      bankA: a.items.map((i) => i.bank),
      distinctBank: new Set(a.items.map((i) => i.bank)).size,
    };
  });
  ok('同一天两次组题完全一致', d.same);
  eq('同一天题号一致', d.codeA, d.codeB);
  ok('不同天题号不同', d.codeA !== d.codeC, [d.codeA, d.codeC]);
  ok('不同天题目组合不同', d.differ);
  ok('题号 6 位', /^[0-9a-z]{6}$/.test(d.codeA), d.codeA);
  eq('10 道题来自 10 个不同题号', d.distinctBank, 10);
}

console.log('\n[3] 答题流程');
{
  await page.evaluate(() => { WHICH.start(); });
  await sleep(150);
  const q1 = await page.evaluate(() => ({ screen: WHICH.screen(), now: WHICH.ui.qNow(), text: WHICH.ui.qText(), opts: WHICH.ui.options().length }));
  eq('进入答题页', q1.screen, 'quiz');
  eq('从第 1 题开始', q1.now, '1');
  eq('4 个选项渲染', q1.opts, 4);

  await page.evaluate(() => document.querySelectorAll('#opt-list .opt')[2].click());
  await sleep(320);
  const q2 = await page.evaluate(() => ({ now: WHICH.ui.qNow(), picked: !!document.querySelector('#opt-list .opt.picked') }));
  eq('选完自动到第 2 题', q2.now, '2');
  ok('新题没有残留选中态', !q2.picked);

  await page.evaluate(() => document.getElementById('btn-back').click());
  await sleep(120);
  eq('上一题可回退', await page.evaluate(() => WHICH.ui.qNow()), '1');
  eq('第 1 题时回退按钮隐藏', await page.evaluate(() => getComputedStyle(document.getElementById('btn-back')).visibility), 'hidden');

  const progress = await page.evaluate(() => {
    const w = [];
    for (let i = 0; i < 10; i++) {
      w.push(parseFloat(document.getElementById('q-fill').style.width) || 0);
      document.querySelectorAll('#opt-list .opt')[i % 4].click();
      // 等待自动翻页
      const t = Date.now(); while (Date.now() - t < 260) {}
    }
    return w;
  });
  ok('进度条单调递增', progress.every((v, i) => i === 0 || v >= progress[i - 1]), progress);
  await sleep(600);
  eq('答完 10 题进入结果页', await page.evaluate(() => WHICH.screen()), 'result');
}

console.log('\n[4] 结果与画像');
{
  const d = await page.evaluate(() => {
    const r = WHICH.state.result;
    return {
      name: WHICH.ui.resName(),
      match: parseInt(WHICH.ui.resMatch(), 10),
      kw: WHICH.ui.kw(),
      bars: WHICH.ui.bars(),
      barPx: [].slice.call(document.querySelectorAll('#res-bars .bar-row')).map((row) => ({
        trackW: Math.round(row.querySelector('.bar-track').getBoundingClientRect().width),
        fillW: Math.round(row.querySelector('.bar-fill').getBoundingClientRect().width),
      })),
      desc: WHICH.ui.resDesc().length,
      tagline: document.getElementById('res-tagline').textContent,
      index: r.index,
      profile: r.profile,
      z: r.z,
      unlock: WHICH.ui.unlock(),
      coll: WHICH.collection.progress(),
      guide: ['res-likes', 'res-hates', 'res-touch'].map((id) => document.getElementById(id).textContent),
      last: WHICH.storage.get('which-last'),
      cta: (() => { const r = document.getElementById('btn-card').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight }; })(),
      ctaVisible: (() => { const r = document.getElementById('btn-card').getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight + 1; })(),
      catName: WCFG.CATS[r.index].name,
    };
  });
  ok('结果名形如「猫名·标签」', /^[\u4e00-\u9fa5]{1,4}·[\u4e00-\u9fa5]{2,6}$/.test(d.name), d.name);
  ok('结果与内部 index 一致', d.name.indexOf(d.catName) === 0, [d.name, d.catName]);
  ok('匹配度 55~99', d.match >= 55 && d.match <= 99, d.match);
  eq('三个关键词', d.kw.length, 3);
  eq('五个维度条', d.bars.length, 5);
  ok('五维值都是 5~99', d.bars.every((b) => Number(b.v) >= 5 && Number(b.v) <= 99), d.bars.map((b) => b.v));
  ok('五维条宽度与数值一致', d.bars.every((b) => parseFloat(b.w) === Number(b.v)), d.bars);
  ok('五维条真的画出来了（宽度生效）', d.barPx.every((p) => p.fillW > 8 && p.fillW <= p.trackW + 0.5), d.barPx);
  ok('画像字段齐全 0~100', ['E', 'A', 'C', 'I', 'L'].every((k) => d.profile[k] >= 0 && d.profile[k] <= 100), d.profile);
  ok('z 值在 ±3 内', Object.values(d.z).every((v) => Math.abs(v) < 3), d.z);
  ok('有性格描述', d.desc > 20, d.desc);
  ok('有 tagline', d.tagline.length > 2, d.tagline);
  ok('相处说明书三行都有内容', d.guide.every((s) => s.length > 2), d.guide);
  ok('新解锁提示出现', d.unlock.indexOf('新图鉴解锁') === 0 || d.unlock.indexOf('集齐') >= 0, d.unlock);
  eq('图鉴变 1/10', d.coll.unlocked, 1);
  ok('上次结果已存盘', d.last && d.last.i === d.index, d.last);
  ok('生成挑战卡按钮常驻可见', d.ctaVisible, d.cta);
}

console.log('\n[5] 画像打分（纯逻辑）');
{
  const d = await page.evaluate(() => {
    const day = WHICH.quiz.build('2026-10-26');
    const r1 = WHICH.quiz.evaluate([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], '2026-10-26');
    const r2 = WHICH.quiz.evaluate([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], '2026-10-26');
    const r3 = WHICH.quiz.evaluate([3, 3, 3, 3, 3, 3, 3, 3, 3, 3], '2026-10-26');
    return {
      same: JSON.stringify(r1) === JSON.stringify(r2),
      base: r1.profile,
      other: r3.profile,
      changed: JSON.stringify(r1.profile) !== JSON.stringify(r3.profile),
      items: day.items.length,
      stat: WHICH.quiz.statsOf(day.items),
      // 极端作答也要在范围内
      all: [0, 1, 2, 3].map((k) => WHICH.quiz.evaluate(new Array(10).fill(k), '2026-10-26').profile),
    };
  });
  ok('同样答案结果完全一致', d.same);
  ok('全选 A 与全选 D 画像不同', d.changed);
  ok('所有极端作答画像都在 0~100', d.all.every((p) => Object.values(p).every((v) => v >= 0 && v <= 100)), d.all);
  ok('每维标准差 > 0', ['E', 'A', 'C', 'I', 'L'].every((k) => d.stat[k].sd > 0), d.stat);
}

console.log('\n[6] 结果分布（10 只猫都要能被测到）');
{
  const d = await page.evaluate(() => {
    const day = WHICH.quiz.build('2026-10-26');
    const N = 4000;
    let s = 20261026;
    const counts = new Array(WCFG.CATS.length).fill(0);
    for (let i = 0; i < N; i++) {
      const ans = day.items.map(() => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return Math.floor(s / 4294967296 * 4);
      });
      counts[WHICH.quiz.evaluate(ans, '2026-10-26').index]++;
    }
    const pct = counts.map((c) => c / N * 100);
    return { pct, min: Math.min(...pct), max: Math.max(...pct), zero: counts.filter((c) => c === 0).length };
  });
  ok('每只猫都能被测到', d.zero === 0, d.pct);
  ok('最少的猫占比 > 4%', d.min > 4, d.pct.map((v) => v.toFixed(1)));
  ok('最多的猫占比 < 20%', d.max < 20, d.pct.map((v) => v.toFixed(1)));
}

console.log('\n[7] 图鉴');
{
  const d = await page.evaluate(() => {
    WHICH.collection._inject({ '0': { n: 2, f: '2026-10-20' }, '4': { n: 1, f: '2026-10-25' }, '9': { n: 3, f: '2026-10-26' } });
    WHICH.refreshIntro();
    WHICH.renderGallery();
    WHICH.showScreen('gallery');
    const cells = [].slice.call(document.querySelectorAll('.gal-cell'));
    return {
      total: cells.length,
      locked: cells.filter((c) => c.classList.contains('locked')).length,
      names: cells.map((c) => c.querySelector('.gal-name').textContent),
      count: document.getElementById('gal-count').textContent,
      title: document.getElementById('gal-title-text').textContent,
      remain: document.getElementById('coll-remain').textContent,
      progress: WHICH.collection.progress(),
      lockedName: WHICH.collection.isUnlocked(2),
      titleOf: WHICH.collection.title(),
      first: WHICH.collection.get(0),
      data: WHICH.collection._raw(),
    };
  });
  eq('图鉴 10 格', d.total, 10);
  eq('已解锁 3 格', d.locked, 7);
  eq('图鉴计数文案', d.count, '3');
  eq('称号未集齐', d.title, '猫猫观察员');
  ok('未集齐提示还差几只', d.remain.indexOf('还差 7 只') >= 0, d.remain);
  eq('锁定格显示？？？', d.names[2], '？？？');
  ok('解锁格显示猫名', /·/.test(d.names[0]), d.names[0]);
  ok('未解锁判断正确', !d.lockedName);
  ok('首次日期保留', d.first.f === '2026-10-20', d.first);
  ok('次数保留', d.first.n === 2, d.first);
  ok('注入的脏数据被过滤', Object.keys(d.data).length === 3, Object.keys(d.data));
}

console.log('\n[8] 图鉴详情与交互');
{
  const d = await page.evaluate(() => {
    const locked = document.querySelector('.gal-cell.locked');
    locked.click();
    const screenAfterLocked = WHICH.screen();
    const toast = document.getElementById('toast').textContent;
    const unlocked = document.querySelector('.gal-cell:not(.locked)');
    unlocked.click();
    return {
      screenAfterLocked,
      screen: WHICH.screen(),
      toast,
      detailName: document.getElementById('detail-name').textContent,
      detailDesc: document.getElementById('detail-desc').textContent.length,
      meta: document.getElementById('detail-meta').textContent,
    };
  });
  eq('点未解锁格仍停留在图鉴', d.screenAfterLocked, 'gallery');
  ok('点未解锁格有提示', d.toast.indexOf('还没见过') >= 0, d.toast);
  eq('点已解锁格进详情', d.screen, 'detail');
  ok('详情有猫名', /·/.test(d.detailName), d.detailName);
  ok('详情有描述', d.detailDesc > 20);
  ok('详情显示测出次数', d.meta.indexOf('测出') === 0, d.meta);
}

console.log('\n[9] 重测与收集累加');
{
  const d = await page.evaluate(async () => {
    WHICH.showScreen('intro');
    WHICH.start();
    const same = WHICH.state.result ? WHICH.state.result.index : -1;
    WHICH.answerAll(new Array(10).fill(1));
    const first = WHICH.state.result.index;
    const n1 = WHICH.collection.countOf(first);
    WHICH.start();
    WHICH.answerAll(new Array(10).fill(1));
    const second = WHICH.state.result.index;
    const n2 = WHICH.collection.countOf(second);
    return { same: first === second, first, second, n1, n2, unlock: WHICH.ui.unlock(), coll: WHICH.collection.progress() };
  });
  ok('同答案两次结果一致', d.same, [d.first, d.second]);
  ok('同结果第二次不再算新解锁', d.unlock === '', d.unlock);
  ok('测出次数累加', d.n2 === d.n1 + 1, [d.n1, d.n2]);
}

console.log('\n[10] 挑战赛数据');
{
  const d = await page.evaluate(() => {
    const info = { result: 3, date: '2026-10-26', nick: '小橘', collection: 4 };
    const snap = WHICH.challenge.encodeSnapshot(info);
    const back = WHICH.challenge.decodeSnapshot(JSON.parse(snap.json));
    const noteTitle = WHICH.challenge.noteTitle(info);
    const noteContent = WHICH.challenge.noteContent(info);
    const comment = WHICH.challenge.commentText(info);
    const bad1 = WHICH.challenge.decodeSnapshot({ v: 1, g: 'whack', r: 3 });
    const bad2 = WHICH.challenge.decodeSnapshot({ v: 1, g: 'which', r: 99 });
    const bad3 = WHICH.challenge.decodeSnapshot(null);
    const nick = WHICH.challenge.sanitizeNick('  小 橘 大 王 是 我 啦  ');
    const cmpSame = WHICH.challenge.compareText({ result: 3, nick: '小橘', label: '三花姐·社交名媛' }, 3);
    const cmpDiff = WHICH.challenge.compareText({ result: 5, nick: '小橘', label: '狸花侠·独行侠' }, 3);
    return {
      json: snap.json, bytes: snap.json.length, data: snap.data, back,
      noteTitle, noteContent, comment, bad1, bad2, bad3, nick,
      cmpSame, cmpDiff,
      catLabel: WHICH.challenge.catLabel(3),
    };
  });
  ok('snapshot 是合法 JSON', typeof d.data === 'object');
  eq('snapshot 游戏标识', d.data.g, 'which');
  eq('snapshot 带结果编号', d.data.r, 3);
  eq('snapshot 带日期', d.data.d, '2026-10-26');
  eq('snapshot 带猫名', d.data.n, '小橘');
  ok('snapshot ≤ 2048 字节', d.bytes <= 2048, d.bytes);
  ok('snapshot 可解回', d.back && d.back.result === 3, d.back);
  eq('解回的猫标签', d.back.label, '三花姐·社交名媛');
  ok('id 为 6 位', /^[0-9a-z]{6}$/.test(d.data.k), d.data.k);
  ok('笔记标题 ≤ 20 字', d.noteTitle.length <= 20, [d.noteTitle, d.noteTitle.length]);
  ok('笔记内容 ≤ 1000 字', d.noteContent.length <= 1000, d.noteContent.length);
  ok('笔记内容含猫名', d.noteContent.indexOf('三花姐') >= 0);
  ok('笔记内容说明同题', d.noteContent.indexOf('同一套') >= 0);
  ok('评论文案 ≤ 120 字', d.comment.length <= 120, [d.comment, d.comment.length]);
  ok('评论文案含猫名', d.comment.indexOf('三花姐') >= 0);
  ok('评论文案邀请对方', d.comment.indexOf('你') >= 0);
  ok('别的游戏的 snapshot 被拒', d.bad1 === null);
  ok('超出范围的结果被拒', d.bad2 === null);
  ok('空 snapshot 被拒', d.bad3 === null);
  ok('昵称去空格且截断到 8', d.nick === '小橘大王是我啦', d.nick);
  ok('同款对比文案', d.cmpSame.indexOf('同一只猫') >= 0, d.cmpSame);
  ok('不同款对比文案', d.cmpDiff.indexOf('三花姐') >= 0 && d.cmpDiff.indexOf('狸花侠') >= 0, d.cmpDiff);
  eq('猫标签格式', d.catLabel, '三花姐·社交名媛');
}

console.log('\n[11] 被挑战与昵称');
const WCFG_NAME_7 = await page.evaluate(() => WCFG.CATS[7].name);
{
  const d = await page.evaluate(async () => {
    const snap = { v: 1, g: 'which', r: 7, d: '2026-10-26', n: '布丁主人', k: 'abc123' };
    WHICH.challenge.writeRival(WHICH.challenge.decodeSnapshot(snap));
    const read = WHICH.challenge.readRival();
    WHICH.state.rival = read;
    WHICH.state.last = 4;
    WHICH.refreshIntro();
    const banner = !document.getElementById('rival-banner').classList.contains('hidden');
    const rivalCat = document.getElementById('rival-cat').textContent;
    const nickname = WHICH.challenge.writeNick('布丁主人');
    return { read, banner, rivalCat, nickname, raw: WHICH.storage.get('which-rival'), storedNick: WHICH.storage.get('which-nick') };
  });
  ok('被挑战记录能读回', d.read && d.read.result === 7, d.read);
  ok('首页显示挑战横幅', d.banner);
  eq('横幅显示对方猫名', d.rivalCat, WCFG_NAME_7 + '·' + (await page.evaluate(() => WCFG.CATS[7].tag)));
  eq('昵称写入', d.nickname, '布丁主人');
  ok('昵称存到 which-nick', d.storedNick === '布丁主人', d.storedNick);
  ok('挑战记录存到 which-rival', d.raw && d.raw.r === 7, d.raw);
}

console.log('\n[12] 战绩卡与封面');
{
  const d = await page.evaluate(() => {
    const stats = (cv) => {
      const ctx = cv.getContext('2d');
      const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let ink = 0, colors = {};
      for (let i = 0; i < data.length; i += 4 * 97) {
        if (data[i + 3] < 8) continue;
        ink++;
        const k = (data[i] >> 5) + ',' + (data[i + 1] >> 5) + ',' + (data[i + 2] >> 5);
        colors[k] = (colors[k] || 0) + 1;
      }
      return { ink, tones: Object.keys(colors).length };
    };
    const c1 = WHICH.cards.build();
    const c2 = WHICH.cards.build();
    const cover = WHICH.cards.cover();
    const a = stats(c1), b = stats(c2), cv = stats(cover);
    const url1 = c1.toDataURL('image/png');
    return {
      size: [c1.width, c1.height],
      coverSize: [cover.width, cover.height],
      ink: a.ink, tones: a.tones, coverInk: cv.ink, coverTones: cv.tones,
      deterministic: url1 === c2.toDataURL('image/png'),
      bytes: Math.round(url1.length * 0.75 / 1024),
    };
  });
  eq('战绩卡 1080×1440', d.size, [1080, 1440]);
  eq('封面 1080×1440', d.coverSize, [1080, 1440]);
  ok('战绩卡不是白板', d.ink > 5000, d.ink);
  ok('战绩卡颜色层次丰富', d.tones > 30, d.tones);
  ok('封面不是白板', d.coverInk > 5000, d.coverInk);
  ok('同样数据画出的卡一致', d.deterministic);
  ok('PNG 在合理体积内', d.bytes > 40 && d.bytes < 1600, d.bytes);
}

console.log('\n[13] 挑战面板（网页降级）');
{
  const d = await page.evaluate(async () => {
    WHICH.showScreen('result');
    WHICH.openChallenge();
    const img = WHICH.ui.challengeImg();
    const saveDisabled = document.getElementById('btn-save').disabled;
    document.getElementById('btn-copy').click();
    const tip = document.getElementById('challenge-tip');
    return {
      screen: WHICH.screen(),
      src: img.src.slice(0, 22),
      saveDisabled,
      textShown: tip.classList.contains('show-text'),
      text: tip.textContent.slice(0, 20),
      commentDisabled: document.getElementById('btn-comment').disabled,
    };
  });
  eq('打开挑战面板', d.screen, 'challenge');
  ok('挑战图是 PNG dataURL', d.src === 'data:image/png;base64,', d.src);
  ok('网页版禁用存相册', d.saveDisabled);
  ok('查看文案展开文本', d.textShown);
  ok('文案可选中复制内容', d.text.length > 5, d.text);
  ok('网页版评论区按钮禁用', d.commentDisabled);
}

console.log('\n[14] 布局与样式（不溢出、不互相遮挡）');
{
  const probes = [];
  for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 320, height: 568 }]) {
    await page.setViewport(vp);
    await sleep(160);
    const r = await page.evaluate(() => {
      WHICH.showScreen('intro');
      WHICH.refreshIntro();
      const box = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height, bottom: b.bottom };
      };
      const intro = box('#intro');
      const start = box('#btn-start');
      const gallery = box('#btn-gallery');
      const mute = box('#btn-mute');
      const hero = box('#intro-cat');
      const overflow = document.getElementById('intro').scrollHeight > window.innerHeight + 2;
      const overlap = (a, b) => !!(a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h);
      const hidden = document.querySelector('.hidden');
      const hiddenDisplay = hidden ? getComputedStyle(hidden).display : 'none';
      const cells = document.querySelectorAll('.gal-cell');
      const cellW = cells.length ? [cells[0].getBoundingClientRect(), cells[1].getBoundingClientRect()] : null;
      return {
        vw: window.innerWidth, vh: window.innerHeight,
        overflow, startBottom: start.bottom, galleryBottom: gallery.bottom, mute,
        heroVisible: hero && hero.h > 40,
        muteOverlaps: overlap(mute, start) || overlap(mute, gallery),
        hiddenDisplay,
        twoCol: cellW ? (Math.abs(cellW[0].y - cellW[1].y) < 2) : null,
        gap: document.documentElement.className,
      };
    });
    probes.push(r);
  }
  ok('三档分辨率都不溢出', probes.every((p) => !p.overflow), probes.map((p) => p.overflow));
  ok('按钮都在视口内', probes.every((p) => p.startBottom <= p.vh + 1 && p.galleryBottom <= p.vh + 1), probes.map((p) => [p.galleryBottom, p.vh]));
  ok('静音键不与按钮重叠', probes.every((p) => !p.muteOverlaps));
  ok('首页猫可见', probes.every((p) => p.heroVisible));
  ok('图鉴两列并排', probes.every((p) => p.twoCol === true));
  ok('.hidden 真的隐藏', probes.every((p) => p.hiddenDisplay === 'none'), probes.map((p) => p.hiddenDisplay));
  ok('增强类已挂到 html', probes.every((p) => p.gap.indexOf('supports-flex-gap') >= 0), probes[0].gap);
  await page.setViewport({ width: 390, height: 844 });
}

console.log('\n[15] 静态资源与零依赖');
{
  const d = await page.evaluate(() => {
    const scripts = [].slice.call(document.querySelectorAll('script[src]')).map((s) => s.getAttribute('src'));
    const inline = [].slice.call(document.querySelectorAll('script:not([src])')).filter((s) => s.textContent.trim()).length;
    const hooks = [].slice.call(document.querySelectorAll('[onclick],[onchange],[ontouchstart]')).length;
    return { scripts, inline, hooks, ready: !!window.WHICH_READY, api: !!window.WHICH, quiz: !!window.Quiz };
  });
  ok('所有脚本都是外链', d.scripts.length >= 9 && d.scripts.every((s) => /^js\//.test(s)), d.scripts);
  eq('没有内联脚本', d.inline, 0);
  eq('没有行内事件', d.hooks, 0);
  ok('测试接口就绪', d.ready && d.api && d.quiz);
}

console.log('\n[16] 无控制台报错');
ok('全程无 JS 报错 / 资源 404', errors.length === 0, errors.slice(0, 4));

await browser.close();

console.log('\n' + '='.repeat(52));
if (fails.length) {
  console.log(`✗ 失败 ${fails.length} 项 / 通过 ${pass} 项`);
  for (const f of fails) console.log('  - ' + f);
  process.exit(1);
}
console.log(`✓ 全部通过：${pass} 项`);
