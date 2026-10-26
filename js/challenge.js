/* 评论区挑战赛 · 通用模块（约定见 we/GAME-CONVENTIONS.md）
 * 这个游戏比的是"你是哪只猫"，所以 snapshot 带的是结果编号 r，而不是分数。
 */
(function () {
  'use strict';
  var CFG = window.WCFG;
  var GAME_ID = 'which';
  var NICK_KEY = 'which-nick';
  var RIVAL_KEY = 'which-rival';
  var SNAP_KEY = 'which-challenge';
  var MAX_NICK = 8;
  var DEFAULT_NICK = '路人猫';

  function base36(n, len) {
    var s = (n >>> 0).toString(36);
    while (s.length < (len || 6)) s = '0' + s;
    return s.slice(-(len || 6));
  }

  function todaySeed(dateStr) {
    var date = dateStr || CFG.today();
    var seed = CFG.dailySeed(date);
    return { date: date, seed: seed, code: base36(seed, 6) };
  }

  function sanitizeNick(input) {
    var s = String(input == null ? '' : input).replace(/\s+/g, '').slice(0, MAX_NICK);
    return s || DEFAULT_NICK;
  }

  function readNick() {
    try {
      var raw = localStorage.getItem(NICK_KEY);
      return sanitizeNick(raw == null ? '' : JSON.parse(raw));
    } catch (err) {
      return DEFAULT_NICK;
    }
  }

  function writeNick(nick) {
    var n = sanitizeNick(nick);
    try { localStorage.setItem(NICK_KEY, JSON.stringify(n)); } catch (err) {}
    return n;
  }

  function catLabel(index) {
    var cat = CFG.catOf(index);
    return cat.name + '·' + cat.tag;
  }

  /* ---------- snapshot ---------- */
  function encodeSnapshot(info) {
    var d = todaySeed(info && info.date);
    var r = Math.round(Number(info && info.result));
    if (!isFinite(r)) r = -1;
    var snap = {
      v: 1,
      g: GAME_ID,
      r: r,
      d: d.date,
      n: sanitizeNick(info && info.nick),
      k: d.code,
    };
    if (info && typeof info.collection === 'number') snap.c = info.collection;
    var json = JSON.stringify(snap);
    if (json.length > 2048) {
      delete snap.c;
      json = JSON.stringify(snap);
    }
    return { json: json, data: snap };
  }

  function decodeSnapshot(obj) {
    if (!obj || typeof obj !== 'object') return null;
    if (obj.v !== 1 && obj.v !== '1') return null;
    if (obj.g && obj.g !== GAME_ID) return null;
    var r = Number(obj.r);
    if (!isFinite(r) || r < 0 || r >= CFG.TOTAL) return null;
    return {
      result: Math.round(r),
      cat: CFG.catOf(Math.round(r)),
      label: catLabel(Math.round(r)),
      date: String(obj.d || ''),
      nick: sanitizeNick(obj.n),
      code: String(obj.k || ''),
      collection: typeof obj.c === 'number' ? obj.c : null,
    };
  }

  /* ---------- 文案 ---------- */
  var COMMENT_TAILS = [
    '今天十道题是同一套，你也来测测？',
    '同一天同一套题，评论区报你的猫。',
    '我认了，评论区谁跟我同款？',
    '不敢一个人被叫这个名字，你也来试试。',
  ];

  function pickLine(list, seedNum) {
    var i = Math.abs(Math.floor(seedNum)) % list.length;
    return list[i];
  }

  function commentText(info) {
    var index = Number(info && info.result);
    var cat = CFG.catOf(isFinite(index) ? index : 0);
    var seed = (info && info.seed) || todaySeed().seed;
    var tail = pickLine(COMMENT_TAILS, seed >>> 5);
    var kw = (cat.kw || []).slice(0, 2).join('、');
    var text = '我测出来是「' + cat.name + '·' + cat.tag + '」' + (kw ? '（' + kw + '）' : '') + '，' + tail;
    return text.slice(0, 120);
  }

  function noteTitle(info) {
    var index = Number(info && info.result);
    var cat = CFG.catOf(isFinite(index) ? index : 0);
    var t = '我是' + cat.name + '·' + cat.tag + '，你是什么猫';
    return t.slice(0, 20);
  }

  function noteContent(info) {
    var index = Number(info && info.result);
    var cat = CFG.catOf(isFinite(index) ? index : 0);
    var day = todaySeed(info && info.date);
    var lines = [
      '今天做了 10 道题，测出来是「' + cat.name + '·' + cat.tag + '」。',
      cat.tagline,
      '关键词：' + (cat.kw || []).join(' / '),
      cat.desc,
      '同一天所有人的题都是同一套（题号 ' + day.code + '），所以结果能直接对着看。',
      '你也来测测你是哪只猫？测完在评论区报一下，我看看谁是同款。',
    ];
    return lines.join('\n').slice(0, 1000);
  }

  /* ---------- 被挑战记录 ---------- */
  function readRival() {
    try {
      var raw = localStorage.getItem(RIVAL_KEY);
      return raw == null ? null : decodeSnapshot(JSON.parse(raw));
    } catch (err) { return null; }
  }

  function writeRival(snap) {
    if (!snap) return null;
    var payload = {
      v: 1, g: GAME_ID, r: snap.result, d: snap.date,
      n: sanitizeNick(snap.nick), k: snap.code || '',
    };
    try { localStorage.setItem(RIVAL_KEY, JSON.stringify(payload)); } catch (err) {}
    return payload;
  }

  function clearRival() {
    try { localStorage.removeItem(RIVAL_KEY); } catch (err) {}
  }

  /* 结果对比文案：同款 / 不同款 */
  function compareText(rival, myIndex) {
    var mine = CFG.catOf(myIndex);
    if (!rival) return '';
    var same = rival.result === myIndex;
    if (same) return '你和' + rival.nick + '是同一只猫：' + mine.name + '·' + mine.tag + '。';
    return rival.nick + '是「' + rival.label + '」，你是「' + mine.name + '·' + mine.tag + '」。';
  }

  window.Challenge = {
    GAME_ID: GAME_ID,
    MAX_NICK: MAX_NICK,
    DEFAULT_NICK: DEFAULT_NICK,
    todaySeed: todaySeed,
    sanitizeNick: sanitizeNick,
    readNick: readNick,
    writeNick: writeNick,
    catLabel: catLabel,
    encodeSnapshot: encodeSnapshot,
    decodeSnapshot: decodeSnapshot,
    commentText: commentText,
    noteTitle: noteTitle,
    noteContent: noteContent,
    readRival: readRival,
    writeRival: writeRival,
    clearRival: clearRival,
    compareText: compareText,
    SNAP_KEY: SNAP_KEY,
  };
})();
