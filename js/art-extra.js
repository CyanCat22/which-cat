/* 你是哪只猫 · 场景绘制（背景 / 光斑 / 星星 / 爪子 / 锁定剪影）
 * 只负责画面，不碰逻辑。
 */
(function () {
  'use strict';
  var TAU = Math.PI * 2;

  function bg(ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, w * 0.35, h);
    g.addColorStop(0, '#fffaf4');
    g.addColorStop(0.55, '#fdeedd');
    g.addColorStop(1, '#f6dfc9');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 顶部暖光
    var sun = ctx.createRadialGradient(w * 0.72, h * 0.06, 0, w * 0.72, h * 0.06, w * 0.75);
    sun.addColorStop(0, 'rgba(255,246,214,0.95)');
    sun.addColorStop(0.45, 'rgba(255,240,200,0.35)');
    sun.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);

    // 地板一条浅浅的分界
    ctx.fillStyle = 'rgba(214,164,124,0.16)';
    ctx.fillRect(0, h * 0.72, w, h * 0.28);
    ctx.strokeStyle = 'rgba(199,148,108,0.20)';
    ctx.lineWidth = Math.max(1, h * 0.002);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.72);
    ctx.lineTo(w, h * 0.72);
    ctx.stroke();

    // 地板木纹
    ctx.strokeStyle = 'rgba(190,140,100,0.10)';
    for (var i = 1; i < 5; i++) {
      var y = h * (0.72 + i * 0.06);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + h * 0.01);
      ctx.stroke();
    }

    // 爪印贴纸
    paw(ctx, w * 0.12, h * 0.10, w * 0.028, 'rgba(226,150,102,0.24)');
    paw(ctx, w * 0.90, h * 0.16, w * 0.022, 'rgba(226,150,102,0.20)');
    paw(ctx, w * 0.86, h * 0.66, w * 0.02, 'rgba(226,150,102,0.16)');
    paw(ctx, w * 0.08, h * 0.60, w * 0.024, 'rgba(226,150,102,0.16)');
  }

  function podium(ctx, cx, cy, r) {
    var g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 1.5);
    g.addColorStop(0, 'rgba(196,138,96,0.28)');
    g.addColorStop(0.6, 'rgba(196,138,96,0.12)');
    g.addColorStop(1, 'rgba(196,138,96,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.5, r * 1.5, 0, 0, TAU);
    ctx.fill();
  }

  function paw(ctx, x, y, r, color) {
    ctx.save();
    ctx.fillStyle = color || 'rgba(226,150,102,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.35, r * 0.62, r * 0.52, 0, 0, TAU);
    ctx.fill();
    var offs = [[-0.62, -0.42], [-0.22, -0.66], [0.22, -0.66], [0.62, -0.42]];
    for (var i = 0; i < offs.length; i++) {
      ctx.beginPath();
      ctx.ellipse(x + offs[i][0] * r, y + offs[i][1] * r, r * 0.24, r * 0.30, offs[i][0] * 0.3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function star(ctx, x, y, r, color, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.fillStyle = color || '#ffd257';
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var rad = i % 2 === 0 ? r : r * 0.44;
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var px = Math.cos(a) * rad;
      var py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function heart(ctx, x, y, r, rot, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.fillStyle = color || '#ff8fb0';
    ctx.beginPath();
    ctx.moveTo(0, r * 0.75);
    ctx.bezierCurveTo(-r * 1.25, -r * 0.15, -r * 0.55, -r * 1.05, 0, -r * 0.35);
    ctx.bezierCurveTo(r * 0.55, -r * 1.05, r * 1.25, -r * 0.15, 0, r * 0.75);
    ctx.fill();
    ctx.restore();
  }

  function fish(ctx, x, y, r, rot, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.fillStyle = '#ffd08a';
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, 0);
    ctx.lineTo(-r * 1.25, -r * 0.6);
    ctx.lineTo(-r * 1.05, 0);
    ctx.lineTo(-r * 1.25, r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8a5a2b';
    ctx.beginPath();
    ctx.arc(r * 0.45, -r * 0.12, r * 0.10, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function sparkle(ctx, x, y, r, color, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.fillStyle = color || 'rgba(255,214,120,0.95)';
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r * 0.18, -r * 0.18, r, 0);
    ctx.quadraticCurveTo(r * 0.18, r * 0.18, 0, r);
    ctx.quadraticCurveTo(-r * 0.18, r * 0.18, -r, 0);
    ctx.quadraticCurveTo(-r * 0.18, -r * 0.18, 0, -r);
    ctx.fill();
    ctx.restore();
  }

  /* 未解锁的图鉴格：剪影 + 问号 */
  function catLocked(ctx, x, y, r, index) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(120,96,82,0.28)';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    // 耳朵
    for (var s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.74, -r * 0.52);
      ctx.lineTo(s * r * 1.02, -r * 1.02);
      ctx.lineTo(s * r * 0.34, -r * 0.86);
      ctx.closePath();
      ctx.fill();
    }
    // 眼睛：两条横线（"还没见过"）
    ctx.strokeStyle = 'rgba(255,250,244,0.75)';
    ctx.lineWidth = Math.max(2, r * 0.09);
    ctx.lineCap = 'round';
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      ctx.beginPath();
      ctx.moveTo(s2 * r * 0.20 - r * 0.16, -r * 0.06);
      ctx.lineTo(s2 * r * 0.20 + r * 0.16, -r * 0.06);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(90,66,56,0.55)';
    ctx.font = '700 ' + Math.round(r * 0.66) + 'px -apple-system, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, r * 0.42);
    ctx.restore();
  }

  /* 星星雨：结算/解锁时的点缀 */
  function confetti(ctx, w, h, t, seed) {
    ctx.save();
    for (var i = 0; i < 18; i++) {
      var fx = ((seed + i * 7919) % 1000) / 1000;
      var fy = ((seed + i * 104729) % 1000) / 1000;
      var x = w * (0.08 + fx * 0.84);
      var y = h * (0.06 + fy * 0.5) + Math.sin(t * 0.9 + i) * h * 0.012;
      var rr = w * (0.006 + ((i % 5) * 0.004));
      if (i % 3 === 0) star(ctx, x, y, rr, 'rgba(255,205,110,0.9)', t * 0.6 + i);
      else if (i % 3 === 1) heart(ctx, x, y, rr * 0.9, Math.sin(t + i) * 0.4, 'rgba(255,150,176,0.75)');
      else sparkle(ctx, x, y, rr * 1.1, 'rgba(255,255,255,0.9)', i);
    }
    ctx.restore();
  }

  window.WhichArt = {
    bg: bg,
    podium: podium,
    paw: paw,
    star: star,
    heart: heart,
    fish: fish,
    sparkle: sparkle,
    catLocked: catLocked,
    confetti: confetti,
  };
})();
