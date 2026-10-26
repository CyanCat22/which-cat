/* 你是哪只猫 · WebAudio 实时合成音效（无音频文件）
 * 首次触摸后解锁；静音状态写 localStorage，容器内由平台缓存双写。
 */
(function () {
  var A = (window.WhichAudio = {
    ctx: null,
    master: null,
    muted: false,
    ready: false,

    init: function () {
      if (this.ready) {
        if (this.ctx && this.ctx.state === 'suspended') this.resumeSafe();
        return;
      }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        this.ready = true;
        this.resumeSafe();
      } catch (err) {
        this.ready = false;
        this.ctx = null;
        this.master = null;
      }
    },

    resumeSafe: function () {
      if (!this.ctx) return;
      try {
        var p = this.ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } catch (err) {}
    },

    setMuted: function (v) {
      this.muted = !!v;
      try { localStorage.setItem('which-muted', this.muted ? '1' : '0'); } catch (e) {}
      if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
      return this.muted;
    },

    toggleMute: function () { return this.setMuted(!this.muted); },

    tone: function (freq, dur, type, vol, slideTo, pan) {
      if (!this.ready || this.muted) return;
      var t = this.ctx.currentTime;
      var o = this.ctx.createOscillator();
      var g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      var node = g;
      if (pan != null && this.ctx.createStereoPanner) {
        var p = this.ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan));
        g.connect(p);
        node = p;
      }
      node.connect(this.master);
      o.connect(g);
      o.start(t);
      o.stop(t + dur + 0.02);
    },

    burst: function (dur, vol, freq, q) {
      if (!this.ready || this.muted) return;
      var t = this.ctx.currentTime;
      var len = Math.floor(this.ctx.sampleRate * dur);
      var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      var src = this.ctx.createBufferSource();
      src.buffer = buf;
      var f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq || 900;
      f.Q.value = q || 1.2;
      var g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    },

    /* 选了一个选项 */
    pick: function () {
      this.tone(560, 0.09, 'triangle', 0.10, 700);
      this.burst(0.035, 0.03, 2600, 1.4);
    },

    /* 翻到下一题 */
    next: function () {
      this.tone(420, 0.16, 'sine', 0.06, 620);
    },

    /* 出结果：一段上行琶音 */
    reveal: function () {
      var seq = [523, 659, 784, 988, 1175];
      for (var i = 0; i < seq.length; i++) {
        (function (self, f, d) {
          setTimeout(function () { self.tone(f, 0.30, 'triangle', 0.10); }, d);
        })(this, seq[i], i * 95);
      }
    },

    /* 新解锁一只猫 */
    unlock: function () {
      var seq = [784, 988, 1319];
      for (var i = 0; i < seq.length; i++) {
        (function (self, f, d) {
          setTimeout(function () { self.tone(f, 0.26, 'triangle', 0.11); }, d);
        })(this, seq[i], i * 110);
      }
      this.burst(0.12, 0.04, 3200, 2.0);
    },

    /* 集齐全部 */
    complete: function () {
      var seq = [523, 659, 784, 1046, 1318, 1568];
      for (var i = 0; i < seq.length; i++) {
        (function (self, f, d) {
          setTimeout(function () { self.tone(f, 0.30, 'triangle', 0.11); }, d);
        })(this, seq[i], i * 100);
      }
    },

    /* 打开图鉴 */
    open: function () {
      this.tone(660, 0.12, 'sine', 0.06, 880);
    },
  });

  try { A.muted = localStorage.getItem('which-muted') === '1'; } catch (e) {}
})();
