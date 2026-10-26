/* 你是哪只猫 · 题目组装与画像计算
 * 同一天 = 同一套题、同一套选项顺序（日期种子 + mulberry32，可复现）。
 */
(function () {
  'use strict';
  var CFG = window.WCFG;
  var AXES = CFG.AXES;

  function base36(n, len) {
    var s = (n >>> 0).toString(36);
    while (s.length < (len || 6)) s = '0' + s;
    return s.slice(-(len || 6));
  }

  function shuffle(list, rng) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  /* 当天题目：抽题 + 选项顺序都钉死在种子上 */
  function build(dateStr) {
    var date = dateStr || CFG.today();
    var seed = CFG.dailySeed(date);
    var rng = CFG.rngOf(seed);
    var order = shuffle(CFG.QUESTIONS.map(function (q, i) { return i; }), rng);
    var picked = order.slice(0, CFG.COUNT);
    var items = picked.map(function (qi, idx) {
      var q = CFG.QUESTIONS[qi];
      var r2 = CFG.rngOf((seed ^ (qi + 1) * 2654435761) >>> 0);   // 每题独立的选项顺序
      var opts = shuffle(q.o.map(function (o, i) { return i; }), r2).map(function (oi) {
        return { text: q.o[oi].t, w: q.o[oi].w };
      });
      return { no: idx + 1, bank: qi, text: q.t, options: opts };
    });
    return { date: date, seed: seed, code: base36(seed, 6), items: items };
  }

  /* 每道题、每个维度的均值与标准差：把原始分标准化成 z 值，
   * 这样"凑巧抽到的题偏某一边"不会影响结果，10 道题也能分出层次。 */
  function ranges(items) {
    var out = {};
    AXES.forEach(function (ax) {
      var lo = 0;
      var hi = 0;
      items.forEach(function (it) {
        var vals = it.options.map(function (o) { return Number(o.w[ax.key]) || 0; });
        lo += Math.min.apply(null, vals);
        hi += Math.max.apply(null, vals);
      });
      out[ax.key] = { lo: lo, hi: hi };
    });
    return out;
  }

  function statsOf(items) {
    var out = {};
    AXES.forEach(function (ax) {
      var mean = 0;
      var varr = 0;
      items.forEach(function (it) {
        var vals = it.options.map(function (o) { return Number(o.w[ax.key]) || 0; });
        var m = 0;
        for (var i = 0; i < vals.length; i++) m += vals[i];
        m /= vals.length;
        var v = 0;
        for (var j = 0; j < vals.length; j++) v += (vals[j] - m) * (vals[j] - m);
        v /= vals.length;
        mean += m;
        varr += v;
      });
      out[ax.key] = { mean: mean, sd: Math.sqrt(varr) || 1 };
    });
    return out;
  }

  /* 原始权重和 → 标准化 z 值（均值 0、方差 1）+ 0~100 的展示值 */
  function profileOf(items, answers) {
    var sums = {};
    AXES.forEach(function (ax) { sums[ax.key] = 0; });
    items.forEach(function (it, i) {
      var pick = answers[i];
      var opt = it.options[pick];
      if (!opt) return;
      AXES.forEach(function (ax) {
        sums[ax.key] += Number(opt.w[ax.key]) || 0;
      });
    });
    var st = statsOf(items);
    var z = {};
    var display = {};
    AXES.forEach(function (ax) {
      var v = (sums[ax.key] - st[ax.key].mean) / st[ax.key].sd;
      z[ax.key] = Math.round(v * 1000) / 1000;
      display[ax.key] = Math.round(CFG.clamp(50 + v * 17, 5, 99));
    });
    return { sums: sums, z: z, display: display };
  }

  /* z 距离 → 结果 + 匹配度 */
  function rank(profile) {
    var z = profile.z;
    var list = CFG.CATS.map(function (cat, i) {
      var d = 0;
      AXES.forEach(function (ax) {
        var diff = (z[ax.key] - cat.z[ax.key]) / 2.2;   // 2.2σ 约等于满格
        d += diff * diff;
      });
      return { index: i, dist: Math.sqrt(d / AXES.length), cat: cat };
    });
    list.sort(function (a, b) { return a.dist - b.dist || a.index - b.index; });
    var best = list[0];
    var match = Math.round(CFG.clamp(99 - best.dist * 42, 55, 99));
    return { index: best.index, cat: best.cat, match: match, ranked: list };
  }

  function evaluate(answers, dateStr) {
    var day = build(dateStr);
    var prof = profileOf(day.items, answers);
    var r = rank(prof);
    return {
      date: day.date,
      code: day.code,
      answers: answers.slice(),
      profile: prof.display,
      z: prof.z,
      index: r.index,
      cat: r.cat,
      match: r.match,
    };
  }

  window.Quiz = {
    build: build,
    ranges: ranges,
    statsOf: statsOf,
    profileOf: profileOf,
    rank: rank,
    evaluate: evaluate,
  };
})();
