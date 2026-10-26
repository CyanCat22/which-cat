/* 你是哪只猫 · 战绩卡 / 封面绘制（1080×1440，3:4）
 * 全部用 Canvas 现场画，不依赖任何图片资源。
 */
(function () {
  'use strict';
  var CFG = window.WCFG;
  var Art = window.CatArt;
  var Scene = window.WhichArt;
  var W = 1080;
  var H = 1440;
  var FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system, sans-serif';

  function canvas() {
    var c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return c;
  }

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  function text(ctx, str, x, y, size, color, weight, align) {
    ctx.fillStyle = color || '#5b3b2e';
    ctx.font = (weight || 700) + ' ' + size + 'px ' + FONT;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function fitText(ctx, str, maxWidth, size, weight, color, x, y) {
    var s = size;
    var w = 0;
    ctx.font = (weight || 700) + ' ' + s + 'px ' + FONT;
    while (s > 18 && (w = ctx.measureText(str).width) > maxWidth) {
      s -= 2;
      ctx.font = (weight || 700) + ' ' + s + 'px ' + FONT;
    }
    text(ctx, str, x, y, s, color, weight);
    return s;
  }

  function chip(ctx, str, x, y, size, bg, fg) {
    ctx.font = '700 ' + size + 'px ' + FONT;
    var w = ctx.measureText(str).width + size * 1.5;
    var h = size * 1.95;
    roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fillStyle = bg;
    ctx.fill();
    text(ctx, str, x, y + 1, size, fg, 700);
    return w;
  }

  /* 五维条 */
  function bars(ctx, profile, x, y, w) {
    var labels = CFG.AXES;
    var rowH = 58;
    var barX = x + 150;
    var barW = w - 150;
    for (var i = 0; i < labels.length; i++) {
      var ax = labels[i];
      var cy = y + i * rowH;
      text(ctx, ax.label, x, cy, 30, 'rgba(120,86,66,0.95)', 600, 'left');
      var trackW = barW - 74;
      roundRect(ctx, barX, cy - 15, trackW, 30, 15);
      ctx.fillStyle = 'rgba(198,150,110,0.22)';
      ctx.fill();
      var v = Math.max(4, Math.min(100, Number(profile[ax.key]) || 0));
      roundRect(ctx, barX, cy - 15, Math.max(30, trackW * v / 100), 30, 15);
      var g = ctx.createLinearGradient(barX, 0, barX + trackW, 0);
      g.addColorStop(0, '#ffc477');
      g.addColorStop(1, '#ff9d5c');
      ctx.fillStyle = g;
      ctx.fill();
      text(ctx, String(Math.round(v)), barX + trackW + 42, cy, 28, 'rgba(150,104,72,0.9)', 600, 'center');
    }
  }

  function dots(ctx, unlocked, cx, y, r, gap) {
    var n = CFG.TOTAL;
    var totalW = (n - 1) * gap;
    for (var i = 0; i < n; i++) {
      var x = cx - totalW / 2 + i * gap;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      if (unlocked[i]) {
        ctx.fillStyle = i === CFG.TOTAL - 1 ? '#ffcf6a' : '#ff9d5c';
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(198,150,110,0.28)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  /* ---------- 结果卡 ---------- */
  function card(data) {
    var c = canvas();
    var ctx = c.getContext('2d');
    var cat = CFG.catOf(data.index);
    var profile = data.profile || {};
    var unlocked = data.unlocked || [];

    Scene.bg(ctx, W, H);

    // 顶部
    text(ctx, '你是哪只猫', W / 2, 92, 34, 'rgba(150,104,72,0.85)', 600);
    text(ctx, (data.date || '').replace(/-/g, ' / ') + '   ·   题号 ' + (data.code || '------'), W / 2, 136, 24, 'rgba(168,124,92,0.75)', 500);

    // 主猫
    var cx = W / 2;
    var cy = 420;
    Scene.podium(ctx, cx, cy + 172, 190);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.05);
    Art.draw(ctx, { x: 0, y: 0, r: 190, level: data.index, face: cat.face || 'happy', t: 0.6 });
    ctx.restore();
    for (var i = 0; i < 6; i++) {
      var a = i * 1.05 + 0.4;
      Scene.sparkle(ctx, cx + Math.cos(a) * 280, cy + Math.sin(a) * 230, 12 + (i % 3) * 5,
        i % 2 ? 'rgba(255,214,120,0.9)' : 'rgba(255,255,255,0.9)', a);
    }

    // 名字 / 标签
    text(ctx, '我是', W / 2, 682, 28, 'rgba(160,116,84,0.85)', 500);
    fitText(ctx, cat.name + '·' + cat.tag, W - 160, 86, 800, '#5b3b2e', W / 2, 736);
    text(ctx, cat.tagline, W / 2, 798, 29, 'rgba(140,96,68,0.9)', 500);

    // 关键词 chip
    var kws = cat.kw || [];
    var chipW = [];
    var size = 30;
    for (var k = 0; k < kws.length; k++) {
      ctx.font = '700 ' + size + 'px ' + FONT;
      chipW.push(ctx.measureText(kws[k]).width + size * 1.5);
    }
    var gap = 18;
    var totalChip = chipW.reduce(function (a, b) { return a + b; }, 0) + gap * (kws.length - 1);
    var sx = W / 2 - totalChip / 2;
    for (var m = 0; m < kws.length; m++) {
      chip(ctx, kws[m], sx + chipW[m] / 2, 866, size, 'rgba(255,255,255,0.78)', '#8a5a3c');
      sx += chipW[m] + gap;
    }

    // 匹配度
    text(ctx, '匹配度', W / 2 - 60, 940, 26, 'rgba(160,116,84,0.9)', 500);
    text(ctx, (data.match || 0) + '%', W / 2 + 32, 940, 40, '#ff8a4c', 800);

    // 五维
    bars(ctx, profile, 150, 992, W - 300);

    // 图鉴
    dots(ctx, unlocked, W / 2, 1262, 13, 44);
    var count = unlocked.filter(Boolean).length;
    text(ctx, '图鉴 ' + count + '/' + CFG.TOTAL + '  ·  ' + (count >= CFG.TOTAL ? '猫猫图鉴大师' : '猫猫观察员'), W / 2, 1312, 24, 'rgba(150,104,72,0.85)', 600);

    // 底部
    text(ctx, (data.nick || '路人猫') + '（' + (data.date || '') + '）', W / 2, 1372, 26, 'rgba(140,96,68,0.9)', 600);
    text(ctx, '同一天同一套题 · 评论区报你的猫', W / 2, 1412, 24, 'rgba(180,132,98,0.9)', 500);
    return c;
  }

  /* ---------- 封面（首页/笔记首图） ---------- */
  function cover() {
    var c = canvas();
    var ctx = c.getContext('2d');
    Scene.bg(ctx, W, H);

    text(ctx, '你是哪只猫', W / 2, 190, 96, '#5b3b2e', 800);
    text(ctx, '10 道题 · 测出你藏在身体里的那只猫', W / 2, 272, 32, 'rgba(150,104,72,0.9)', 500);
    chip(ctx, '今日同题 · 每天换一套', W / 2, 350, 26, 'rgba(255,255,255,0.8)', '#8a5a3c');

    // 三只猫并排（选三个有代表性的）
    var picks = [1, 3, 9];
    for (var i = 0; i < picks.length; i++) {
      var cx = W * (0.24 + i * 0.26);
      var cy = 600 + (i === 1 ? -30 : 0);
      var r = i === 1 ? 150 : 128;
      Scene.podium(ctx, cx, cy + r * 0.96, r * 0.9);
      ctx.save();
      ctx.translate(cx, cy);
      Art.draw(ctx, { x: 0, y: 0, r: r, level: picks[i], face: CFG.catOf(picks[i]).face || 'normal', t: 0.5 + i * 0.6 });
      ctx.restore();
    }

    // 十只猫小圆点
    for (var j = 0; j < CFG.TOTAL; j++) {
      var x = W / 2 + (j - (CFG.TOTAL - 1) / 2) * 88;
      var y = 900;
      ctx.save();
      ctx.translate(x, y);
      Art.draw(ctx, { x: 0, y: 0, r: 34, level: j, face: 'normal', t: 0, blink: false });
      ctx.restore();
    }

    var lines = ['测完会得到：', '一只猫 + 三个关键词 + 五维画像', '还能集齐 10 只猫的图鉴'];
    for (var k = 0; k < lines.length; k++) {
      text(ctx, lines[k], W / 2, 1040 + k * 62, k === 0 ? 30 : 34, k === 0 ? 'rgba(160,116,84,0.9)' : '#5b3b2e', k === 0 ? 500 : 700);
    }

    chip(ctx, '评论区报你的猫 · 看看谁是同款', W / 2, 1270, 28, 'rgba(255,255,255,0.82)', '#8a5a3c');
    text(ctx, '猫猫图鉴 · 收集 10 只', W / 2, 1360, 26, 'rgba(150,104,72,0.85)', 600);
    return c;
  }

  function save(cv) {
    var platform = window.WhichPlatform;
    if (platform && platform.canSave()) return platform.saveImage(cv);
    return Promise.reject(new Error('web'));
  }

  window.WhichShare = { card: card, cover: cover, save: save, W: W, H: H };
})();
