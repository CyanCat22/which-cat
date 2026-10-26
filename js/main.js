/* 你是哪只猫 · 主流程
 * 画面大多是 DOM，Canvas 只负责猫和战绩卡。
 */
(function () {
  'use strict';
  var CFG = window.WCFG;
  var Art = window.CatArt;
  var Scene = window.WhichArt;
  var Audio = window.WhichAudio;
  var Share = window.WhichShare;
  var Quiz = window.Quiz;
  var Coll = window.Collection;
  var Challenge = window.Challenge;
  var platform = window.WhichPlatform;

  var $ = function (id) { return document.getElementById(id); };

  var state = {
    screen: 'intro',
    day: null,
    answers: [],
    idx: 0,
    result: null,
    record: null,
    card: null,
    rival: null,
    nick: '路人猫',
    last: -1,
  };

  var toastTimer = 0;
  function toast(text, ms) {
    var el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, Math.max(900, ms || 2200));
  }

  var SCREENS = ['intro', 'quiz', 'result', 'gallery', 'challenge', 'detail'];
  function showScreen(name) {
    for (var i = 0; i < SCREENS.length; i++) {
      var el = $(SCREENS[i]);
      el.classList.toggle('show', SCREENS[i] === name);
    }
    state.screen = name;
    if (name === 'result') startCatAnimation();
    if (name === 'detail') startDetailAnimation();
  }

  /* ---------------- DPR 画布 ---------------- */
  function sizeCanvas(cv) {
    var cssW = cv.clientWidth || parseInt(cv.getAttribute('width'), 10) || 200;
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssW * dpr);
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, size: cssW };
  }

  function drawCatInto(cv, index, t) {
    var o = sizeCanvas(cv);
    var r = o.size * 0.40;
    o.ctx.clearRect(0, 0, o.size, o.size);
    Scene.podium(o.ctx, o.size / 2, o.size * 0.56, r * 0.95);
    o.ctx.save();
    o.ctx.translate(o.size / 2, o.size * 0.48);
    Art.draw(o.ctx, {
      x: 0, y: 0, r: r, level: index,
      face: CFG.catOf(index).face || 'normal',
      t: t || 0.5,
      blink: (t || 0) % 4.2 > 3.95,
    });
    o.ctx.restore();
    var cat = CFG.catOf(index);
    for (var i = 0; i < 3; i++) {
      var a = i * 2.1 + 0.5;
      Scene.sparkle(o.ctx, o.size / 2 + Math.cos(a) * o.size * 0.40, o.size * 0.44 + Math.sin(a) * o.size * 0.26,
        o.size * 0.028, i % 2 ? 'rgba(255,205,120,0.85)' : 'rgba(255,255,255,0.9)', a + (t || 0));
    }
    return cat;
  }

  /* ---------------- 首页的今日猫 ---------------- */
  var heroIndex = 0;
  var heroAnim = 0;
  var heroStart = 0;
  function drawHero(t) {
    var cv = $('intro-cat');
    var o = sizeCanvas(cv);
    var r = o.size * 0.36;
    o.ctx.clearRect(0, 0, o.size, o.size);
    Scene.podium(o.ctx, o.size / 2, o.size * 0.58, r * 0.9);
    o.ctx.save();
    o.ctx.translate(o.size / 2, o.size * 0.50);
    o.ctx.rotate(Math.sin((t || 0) * 1.1) * 0.035);
    Art.draw(o.ctx, {
      x: 0, y: 0, r: r, level: heroIndex,
      face: CFG.catOf(heroIndex).face || 'normal',
      t: t || 0.5,
      blink: (t || 0) % 4.6 > 4.34,
    });
    o.ctx.restore();
    for (var i = 0; i < 3; i++) {
      var a = i * 2.0 + 0.6;
      Scene.sparkle(o.ctx, o.size / 2 + Math.cos(a) * o.size * 0.40, o.size * 0.42 + Math.sin(a) * o.size * 0.22,
        o.size * 0.026, i % 2 ? 'rgba(255,205,120,0.8)' : 'rgba(255,255,255,0.85)', a + (t || 0) * 0.5);
    }
  }
  function startHero() {
    cancelAnimationFrame(heroAnim);
    heroStart = 0;
    function step(now) {
      if (!heroStart) heroStart = now;
      drawHero((now - heroStart) / 1000);
      heroAnim = requestAnimationFrame(step);
    }
    heroAnim = requestAnimationFrame(step);
  }

  /* ---------------- 猫猫动画 ---------------- */
  var animId = 0;
  var animStart = 0;
  function animate(cv, index) {
    cancelAnimationFrame(animId);
    animStart = 0;
    function step(now) {
      if (!animStart) animStart = now;
      var t = (now - animStart) / 1000;
      drawCatInto(cv, index, t);
      animId = requestAnimationFrame(step);
    }
    animId = requestAnimationFrame(step);
  }
  function startCatAnimation() {
    if (state.result) animate($('result-cat'), state.result.index);
  }
  function startDetailAnimation() {
    if (state.detailIndex != null) animate($('detail-cat'), state.detailIndex);
  }
  function stopAnimations() { cancelAnimationFrame(animId); }

  /* ---------------- 首页 ---------------- */
  function refreshIntro() {
    var day = state.day || Quiz.build();
    state.day = day;
    $('daily-chip').textContent = '今日同题 · ' + day.date.replace(/-/g, ' / ') + ' · 每天换一套';
    $('day-code').textContent = day.code;
    syncCollLabels();

    var lastLine = $('last-line');
    if (state.last >= 0) {
      lastLine.classList.remove('hidden');
      $('last-cat').textContent = CFG.catOf(state.last).name + '·' + CFG.catOf(state.last).tag;
    } else {
      lastLine.classList.add('hidden');
    }

    var banner = $('rival-banner');
    var r = state.rival;
    if (r) {
      banner.classList.remove('hidden');
      $('rival-name').textContent = r.nick;
      $('rival-cat').textContent = r.label;
    } else {
      banner.classList.add('hidden');
    }
    $('nick').value = state.nick === Challenge.DEFAULT_NICK ? '' : state.nick;
  }

  function syncCollLabels() {
    var p = Coll.progress();
    $('coll-count').textContent = p.unlocked;
    $('coll-fill').style.width = Math.round(p.unlocked / p.total * 100) + '%';
    $('coll-title-text').textContent = Coll.title();
    $('coll-remain').textContent = Coll.remain() > 0 ? '还差 ' + Coll.remain() + ' 只集齐' : '已经集齐啦';
    if ($('res-coll-count')) {
      $('res-coll-count').textContent = p.unlocked;
      $('res-coll-fill').style.width = Math.round(p.unlocked / p.total * 100) + '%';
      $('res-coll-title').textContent = Coll.title();
    }
    if ($('gal-count')) {
      $('gal-count').textContent = p.unlocked;
      $('gal-title-text').textContent = Coll.title();
    }
  }

  /* ---------------- 答题 ---------------- */
  function startQuiz() {
    Audio.init();
    state.day = Quiz.build();
    state.answers = [];
    state.idx = 0;
    state.result = null;
    renderQuestion();
    showScreen('quiz');
  }

  function renderQuestion() {
    var items = state.day.items;
    var it = items[state.idx];
    $('q-now').textContent = String(state.idx + 1);
    $('q-total').textContent = String(items.length);
    $('q-fill').style.width = Math.round(state.idx / items.length * 100) + '%';
    $('q-text').textContent = it.text;
    var list = $('opt-list');
    list.innerHTML = '';
    for (var i = 0; i < it.options.length; i++) {
      var btn = document.createElement('button');
      btn.className = 'opt';
      btn.type = 'button';
      btn.textContent = it.options[i].text;
      btn.setAttribute('data-i', String(i));
      btn.addEventListener('click', onPick);
      list.appendChild(btn);
    }
    $('btn-back').style.visibility = state.idx === 0 ? 'hidden' : 'visible';
  }

  function onPick(e) {
    var btn = e.currentTarget;
    var i = Number(btn.getAttribute('data-i'));
    var list = $('opt-list');
    list.classList.add('locked');
    var kids = list.childNodes;
    for (var k = 0; k < kids.length; k++) {
      if (kids[k].classList) kids[k].classList.add('dim');
    }
    btn.classList.remove('dim');
    btn.classList.add('picked');
    state.answers[state.idx] = i;
    Audio.pick();

    setTimeout(function () {
      list.classList.remove('locked');
      state.idx += 1;
      if (state.idx >= state.day.items.length) finish();
      else { Audio.next(); renderQuestion(); }
    }, 210);
  }

  function backQuestion() {
    if (state.idx === 0) return;
    state.idx -= 1;
    renderQuestion();
  }

  /* ---------------- 结果 ---------------- */
  function finish() {
    var r = Quiz.evaluate(state.answers, state.day.date);
    state.result = r;
    state.card = null;
    state.record = Coll.record(r.index, r.date);
    state.last = r.index;
    try { localStorage.setItem('which-last', JSON.stringify({ i: r.index, d: r.date })); } catch (e) {}
    if (platform) platform.save('which-last', { i: r.index, d: r.date });

    renderResult();
    showScreen('result');
    Audio.reveal();
    if (state.record.isNew) {
      setTimeout(function () { Audio.unlock(); }, 420);
      $('unlock-banner').classList.remove('hidden');
      $('unlock-banner').textContent = state.record.complete
        ? '集齐 10 只！称号升级：猫猫图鉴大师'
        : '新图鉴解锁：' + r.cat.name + '·' + r.cat.tag + '（' + state.record.unlocked + '/' + state.record.total + '）';
      if (state.record.complete) setTimeout(function () { Audio.complete(); }, 900);
    } else {
      $('unlock-banner').classList.add('hidden');
    }
  }

  function renderResult() {
    var r = state.result;
    var cat = r.cat;
    $('res-name').textContent = cat.name + '·' + cat.tag;
    $('res-tagline').textContent = cat.tagline;
    $('res-match').textContent = r.match + '%';
    var kw = $('res-kw');
    kw.innerHTML = '';
    for (var i = 0; i < cat.kw.length; i++) {
      var s = document.createElement('span');
      s.className = 'kw';
      s.textContent = cat.kw[i];
      kw.appendChild(s);
    }
    var bars = $('res-bars');
    bars.innerHTML = '';
    for (var j = 0; j < CFG.AXES.length; j++) {
      var ax = CFG.AXES[j];
      var row = document.createElement('div');
      row.className = 'bar-row';
      row.innerHTML = '<span class="bar-k">' + ax.label + '</span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + r.profile[ax.key] + '%"></span></span>' +
        '<span class="bar-v">' + r.profile[ax.key] + '</span>';
      bars.appendChild(row);
    }
    $('res-desc').textContent = cat.desc;
    $('res-likes').textContent = cat.likes;
    $('res-hates').textContent = cat.hates;
    $('res-touch').textContent = cat.touch;
    syncCollLabels();
    var cmp = $('res-compare');
    if (state.rival) {
      cmp.classList.remove('hidden');
      cmp.textContent = Challenge.compareText(state.rival, r.index);
    } else {
      cmp.classList.add('hidden');
    }
  }

  /* ---------------- 图鉴 ---------------- */
  function renderGallery() {
    var grid = $('gal-grid');
    var all = Coll.all();
    grid.innerHTML = '';
    for (var i = 0; i < all.length; i++) {
      var it = all[i];
      var cell = document.createElement('div');
      cell.className = 'gal-cell' + (it.unlocked ? '' : ' locked');
      cell.setAttribute('data-i', String(i));
      var cv = document.createElement('canvas');
      cv.width = 148;
      cv.height = 148;
      cell.appendChild(cv);
      var name = document.createElement('div');
      name.className = 'gal-name';
      name.textContent = it.unlocked ? it.cat.name + '·' + it.cat.tag : '？？？';
      cell.appendChild(name);
      var meta = document.createElement('div');
      meta.className = 'gal-meta';
      meta.textContent = it.unlocked ? ('测出 ' + it.count + ' 次' + (it.first ? ' · ' + it.first.slice(5) : '')) : '还没测出来';
      cell.appendChild(meta);
      cell.addEventListener('click', onGalleryCell);
      grid.appendChild(cell);

      var c2 = cv.getContext('2d');
      c2.clearRect(0, 0, 148, 148);
      c2.save();
      c2.translate(74, 70);
      if (it.unlocked) Art.draw(c2, { x: 0, y: 0, r: 58, level: i, face: CFG.catOf(i).face || 'normal', t: 0.4 });
      else Scene.catLocked(c2, 0, 0, 58, i);
      c2.restore();
    }
    syncCollLabels();
  }

  function openGallery() {
    renderGallery();
    Audio.open();
    showScreen('gallery');
  }

  function onGalleryCell(e) {
    var i = Number(e.currentTarget.getAttribute('data-i'));
    if (!Coll.isUnlocked(i)) {
      toast('这只猫还没见过，多测几次或换个答法试试');
      return;
    }
    openDetail(i);
  }

  function openDetail(i) {
    state.detailIndex = i;
    var cat = CFG.catOf(i);
    $('detail-name').textContent = cat.name + '·' + cat.tag;
    $('detail-tagline').textContent = cat.tagline;
    $('detail-desc').textContent = cat.desc;
    $('detail-likes').textContent = cat.likes;
    $('detail-hates').textContent = cat.hates;
    $('detail-touch').textContent = cat.touch;
    var item = Coll.get(i);
    $('detail-meta').textContent = '测出 ' + Coll.countOf(i) + ' 次' + (item && item.f ? ' · 首次 ' + item.f : '');
    showScreen('detail');
  }

  /* ---------------- 挑战卡 ---------------- */
  function buildCard() {
    if (!state.result) return null;
    var all = Coll.all();
    var unlocked = [];
    for (var i = 0; i < all.length; i++) unlocked.push(all[i].unlocked);
    return Share.card({
      index: state.result.index,
      match: state.result.match,
      profile: state.result.profile,
      date: state.result.date,
      code: state.result.code,
      nick: state.nick,
      unlocked: unlocked,
    });
  }

  function openChallenge() {
    if (!state.result) return;
    if (!state.card) state.card = buildCard();
    $('challenge-img').src = state.card.toDataURL('image/png');
    var can = platform && platform.canSave();
    $('btn-save').disabled = !can;
    $('challenge-tip').classList.remove('show-text');
    var tip = can ? '发笔记或贴评论，叫朋友来测同一套题' : '网页版：长按保存图片，或查看文案';
    var canCommentNow = platform && platform.canCommentSync ? platform.canCommentSync() : false;
    $('btn-comment').disabled = !canCommentNow;
    if (!canCommentNow && platform && platform.inContainer()) {
      tip = '当前客户端不支持评论区挑战，可发笔记代替';
    } else if (canCommentNow && platform.canComment) {
      platform.canComment().then(function (ok) {
        $('btn-comment').disabled = !ok;
        if (!ok) $('challenge-tip').textContent = '客户端版本低于 9.49，评论区挑战不可用，可发笔记代替';
      });
    }
    $('challenge-tip').textContent = tip;
    showScreen('challenge');
  }

  function challengeInfo() {
    var r = state.result || {};
    var day = state.day || Challenge.todaySeed();
    return {
      result: typeof r.index === 'number' ? r.index : 0,
      date: day.date,
      seed: day.seed,
      nick: state.nick,
      collection: Coll.unlockedCount(),
    };
  }

  function showText(text) {
    var tip = $('challenge-tip');
    tip.textContent = text;
    tip.classList.add('show-text');
  }

  function postNote() {
    if (!state.card) return;
    var info = challengeInfo();
    var title = Challenge.noteTitle(info);
    var content = Challenge.noteContent(info);
    if (!platform || !platform.canPost()) {
      showText(content);
      toast('网页版不能直接发笔记，已展开文案供长按复制');
      return;
    }
    $('btn-note').disabled = true;
    $('challenge-tip').textContent = '正在打开发布页…';
    platform.postNote(state.card, { title: title, content: content }).then(function () {
      $('challenge-tip').textContent = '已打开发布页，编辑后发送';
      toast('已打开发布页');
    }, function () {
      $('challenge-tip').textContent = '打开发布页失败，可改用「贴到评论区」或存相册';
    }).then(function () { $('btn-note').disabled = false; });
  }

  function postComment() {
    if (!state.card) return;
    var info = challengeInfo();
    var snap = Challenge.encodeSnapshot(info);
    var content = Challenge.commentText(info);
    // 容器会先关掉小工具再拉起评论区：调用前先落盘
    if (platform) {
      platform.save('which-last', { i: info.result, d: info.date });
      platform.save(Challenge.SNAP_KEY, { r: info.result, d: info.date, n: info.nick, k: Challenge.todaySeed(info.date).code });
    }
    try {
      localStorage.setItem('which-last', JSON.stringify({ i: info.result, d: info.date }));
      localStorage.setItem(Challenge.SNAP_KEY, JSON.stringify({ r: info.result, d: info.date, n: info.nick }));
    } catch (e) {}
    if (!platform || !platform.postComment) {
      showText(content + '\n\n' + Challenge.noteContent(info));
      toast('网页版不能发评论，已展开文案供长按复制');
      return;
    }
    $('btn-comment').disabled = true;
    $('challenge-tip').textContent = '正在拉起评论区…';
    platform.postComment(state.card, { content: content, snapshot: snap.data }).then(function (res) {
      var ok = res && (res.routed || res.errMsg === undefined);
      $('challenge-tip').textContent = ok ? '评论区已拉起，发送后会带上你的猫猫卡' : '拉起评论区失败，可改用「发挑战笔记」';
      toast(ok ? '去评论区发送吧' : '拉起失败');
    }, function () {
      $('challenge-tip').textContent = '拉起评论区失败，可改用「发挑战笔记」';
    }).then(function () { $('btn-comment').disabled = false; });
  }

  function saveCard() {
    if (!state.card) return;
    if (!platform || !platform.canSave()) { toast('网页版：长按图片即可保存'); return; }
    $('btn-save').disabled = true;
    $('challenge-tip').textContent = '正在保存…';
    platform.saveImage(state.card).then(function () {
      $('challenge-tip').textContent = '已保存到相册';
      toast('已保存到相册');
    }, function () {
      $('challenge-tip').textContent = '保存失败，可截图或改用发笔记';
    }).then(function () { $('btn-save').disabled = false; });
  }

  /* ---------------- 事件 ---------------- */
  function bind() {
    $('btn-start').addEventListener('click', startQuiz);
    $('intro-cat').addEventListener('click', function () {
      heroIndex = (heroIndex + 1 + Math.floor(Math.random() * 3)) % CFG.TOTAL;
      var cat = CFG.catOf(heroIndex);
      toast('「' + cat.name + '·' + cat.tag + '」？测完才知道你是不是它');
      Audio.init();
      Audio.pick();
    });
    $('btn-rival').addEventListener('click', startQuiz);
    $('btn-again').addEventListener('click', startQuiz);
    $('btn-quit-quiz').addEventListener('click', function () {
      stopAnimations();
      showScreen('intro');
      refreshIntro();
    });
    $('btn-back').addEventListener('click', backQuestion);
    $('btn-card').addEventListener('click', openChallenge);
    $('btn-gallery').addEventListener('click', openGallery);
    $('btn-gallery2').addEventListener('click', openGallery);
    $('btn-close-gallery').addEventListener('click', function () {
      showScreen(state.result && state.screen === 'gallery' ? 'result' : 'intro');
      if (state.screen === 'intro') refreshIntro();
    });
    $('btn-close-detail').addEventListener('click', function () { showScreen('gallery'); });
    $('btn-close-challenge').addEventListener('click', function () { showScreen('result'); });
    $('btn-note').addEventListener('click', postNote);
    $('btn-comment').addEventListener('click', postComment);
    $('btn-save').addEventListener('click', saveCard);
    $('btn-copy').addEventListener('click', function () {
      var info = challengeInfo();
      showText(Challenge.noteContent(info));
      toast('长按下方文字即可复制');
    });
    $('nick').addEventListener('change', function () {
      state.nick = Challenge.writeNick($('nick').value);
      if (platform) platform.save('which-nick', state.nick);
      $('nick').value = state.nick === Challenge.DEFAULT_NICK ? '' : state.nick;
      toast('猫名已保存：' + state.nick);
    });
    $('btn-mute').addEventListener('click', function () {
      Audio.init();
      var m = Audio.toggleMute();
      $('btn-mute').textContent = m ? '🔇' : '🔊';
      if (platform) platform.save('which-muted', m);
    });
    // 图鉴返回时按来源回到对应界面
    $('btn-close-gallery').addEventListener('click', function () {
      showScreen(state.fromResult ? 'result' : 'intro');
      if (!state.fromResult) refreshIntro();
    });
    window.addEventListener('resize', function () {
      if (state.screen === 'result' && state.result) drawCatInto($('result-cat'), state.result.index, 0.6);
      if (state.screen === 'detail' && state.detailIndex != null) drawCatInto($('detail-cat'), state.detailIndex, 0.6);
    });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    state.day = Quiz.build();
    bind();

    state.nick = Challenge.readNick();
    state.rival = Challenge.readRival();
    try {
      var raw = localStorage.getItem('which-last');
      if (raw) {
        var obj = JSON.parse(raw);
        if (obj && typeof obj.i === 'number' && obj.i >= 0 && obj.i < CFG.TOTAL) state.last = obj.i;
      }
    } catch (e) {}

    Coll.init().then(function () {
      syncCollLabels();
      refreshIntro();
    });
    refreshIntro();

    var stop = false;
    if (platform && platform.load) {
      platform.load('which-nick').then(function (v) {
        if (typeof v === 'string' && v) {
          state.nick = Challenge.writeNick(v);
          if ($('nick')) $('nick').value = state.nick === Challenge.DEFAULT_NICK ? '' : state.nick;
        }
      });
      platform.load('which-last').then(function (v) {
        if (v && typeof v.i === 'number' && v.i >= 0 && v.i < CFG.TOTAL) {
          state.last = v.i;
          refreshIntro();
        }
      });
      platform.load('which-muted').then(function (v) {
        if (v === true) { Audio.muted = true; $('btn-mute').textContent = '🔇'; }
      });
      if (platform.readSnapshot) {
        platform.readSnapshot().then(function (snapObj) {
          var snap = Challenge.decodeSnapshot(snapObj);
          if (!snap) return;
          state.rival = snap;
          Challenge.writeRival(snap);
          refreshIntro();
          toast('有人向你发起挑战：' + snap.nick + ' 测出了「' + snap.label + '」');
        });
      }
    }
    if (!state.rival) state.rival = Challenge.readRival();
    if (Audio.muted) $('btn-mute').textContent = '🔇';
    refreshIntro();
    heroIndex = (state.day.seed >>> 3) % CFG.TOTAL;
    startHero();
    showScreen('intro');
    window.WHICH_READY = true;
  }

  /* ---------------- 测试接口 ---------------- */
  window.WHICH = {
    state: state,
    quiz: Quiz,
    collection: Coll,
    challenge: Challenge,
    platform: platform,
    audio: Audio,
    art: Art,
    scene: Scene,
    day: function () { return state.day; },
    today: function () { return Quiz.build(); },
    start: function () { startQuiz(); return state.screen; },
    screen: function () { return state.screen; },
    showScreen: showScreen,
    pick: function (i) { onPick({ currentTarget: $('opt-list').childNodes[i] }); },
    answerAll: function (answers) {
      state.answers = answers.slice();
      state.idx = state.day.items.length;
      finish();
      return state.result;
    },
    autoAnswer: function (seed) {
      var s = (Number(seed) || 1) >>> 0;
      var out = [];
      for (var i = 0; i < state.day.items.length; i++) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        out.push(Math.floor(s / 4294967296 * 4));
      }
      return out;
    },
    evaluate: function (answers, date) { return Quiz.evaluate(answers, date); },
    restart: startQuiz,
    renderGallery: renderGallery,
    galleryCount: function () { return $('gal-grid').querySelectorAll('.gal-cell').length; },
    lockedCount: function () { return $('gal-grid').querySelectorAll('.gal-cell.locked').length; },
    openDetail: openDetail,
    openChallenge: openChallenge,
    card: function () { return state.card || (state.result ? buildCard() : null); },
    cover: function () { return Share.cover(); },
    refreshIntro: refreshIntro,
    heroIndex: function () { return heroIndex; },
    setHero: function (i) { heroIndex = ((Number(i) || 0) % CFG.TOTAL + CFG.TOTAL) % CFG.TOTAL; drawHero(0.4); },
    nick: function () { return state.nick; },
    ui: {
      qText: function () { return $('q-text').textContent; },
      qNow: function () { return $('q-now').textContent; },
      options: function () {
        var out = [];
        var list = $('opt-list').childNodes;
        for (var i = 0; i < list.length; i++) out.push(list[i].textContent);
        return out;
      },
      resName: function () { return $('res-name').textContent; },
      resMatch: function () { return $('res-match').textContent; },
      resDesc: function () { return $('res-desc').textContent; },
      bars: function () {
        var out = [];
        var rows = $('res-bars').querySelectorAll('.bar-row');
        for (var i = 0; i < rows.length; i++) {
          out.push({
            k: rows[i].querySelector('.bar-k').textContent,
            v: rows[i].querySelector('.bar-v').textContent,
            w: rows[i].querySelector('.bar-fill').style.width,
          });
        }
        return out;
      },
      kw: function () {
        var out = [];
        var els = $('res-kw').querySelectorAll('.kw');
        for (var i = 0; i < els.length; i++) out.push(els[i].textContent);
        return out;
      },
      unlock: function () {
        var el = $('unlock-banner');
        return el.classList.contains('hidden') ? '' : el.textContent;
      },
      compare: function () {
        var el = $('res-compare');
        return el.classList.contains('hidden') ? '' : el.textContent;
      },
      rivalShown: function () { return !$('rival-banner').classList.contains('hidden'); },
      rivalCat: function () { return $('rival-cat').textContent; },
      collCount: function () { return $('coll-count').textContent; },
      toast: function () { return $('toast').textContent; },
      challengeImg: function () { var img = $('challenge-img'); return { src: img.src || '', complete: img.complete }; },
      galleryTip: function () { return $('gal-tip').textContent; },
    },
    storage: {
      get: function (k) { try { var v = localStorage.getItem(k); return v == null ? null : JSON.parse(v); } catch (e) { return null; } },
      set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
      keys: function () { var out = []; for (var i = 0; i < localStorage.length; i++) out.push(localStorage.key(i)); return out; },
    },
    cards: {
      build: buildCard,
      cover: function () { return Share.cover(); },
    },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
