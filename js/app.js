/* 

The Kawaii Spatial Diorama, UI layer (panels, audio, forms, slider). 

https://www.tooplate.com/view/2171-spatial-diorama
 
*/
(function(){
  'use strict';
  var doc = document, body = doc.body;
  var $ = function(s, r){ return (r || doc).querySelector(s); };
  var $$ = function(s, r){ return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var SECTIONS = ['hero', 'gallery', 'cabinet', 'mail'];
  var SOUND_KEY = 'gm635-sound';

  var Bus = window.GM635 = {
    mode: 'room',
    engine: null,
    reduced: !!(mq && mq.matches),
    sections: SECTIONS
  };
  if (mq) {
    var onMq = function(){ Bus.reduced = mq.matches; };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
  }

  /* ---------------- Audio: modal marimba bars, glass bells, chord swell ---------------- */
  var Sound = Bus.audio = {
    ctx: null, dry: null, wet: null, enabled: true, stepIdx: 0,
    load: function(){ try { if (localStorage.getItem(SOUND_KEY) === 'off') this.enabled = false; } catch (e) {} },
    save: function(){ try { localStorage.setItem(SOUND_KEY, this.enabled ? 'on' : 'off'); } catch (e) {} },
    arm: function(){
      if (!this.enabled) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!this.ctx) { try { this.build(new AC()); } catch (e) { this.ctx = null; return; } }
      if (this.ctx.state === 'suspended') { var p = this.ctx.resume(); if (p && p.catch) p.catch(function(){}); }
    },
    build: function(ctx){
      this.ctx = ctx;
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
      var master = ctx.createGain(); master.gain.value = 0.85;
      master.connect(comp); comp.connect(ctx.destination);
      var conv = ctx.createConvolver();
      conv.normalize = false;               /* unit-energy IR below keeps the wet level honest */
      conv.buffer = this.impulse(ctx, 2.6);
      var wetGain = ctx.createGain(); wetGain.gain.value = 0.55;
      conv.connect(wetGain); wetGain.connect(master);
      this.dry = master; this.wet = conv;
    },
    impulse: function(ctx, sec){
      var rate = ctx.sampleRate, len = Math.floor(rate * sec), buf = ctx.createBuffer(2, len, rate);
      for (var ch = 0; ch < 2; ch++) {
        var d = buf.getChannelData(ch), e = 0, i, t, v;
        for (i = 0; i < len; i++) { t = i / len; v = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.8) * (0.55 + 0.45 * Math.exp(-t * 18)); d[i] = v; e += v * v; }
        var s = 1 / Math.sqrt(e || 1);
        for (i = 0; i < len; i++) d[i] *= s;
      }
      return buf;
    },
    live: function(){ return !!(this.enabled && this.ctx && this.ctx.state === 'running'); },
    voice: function(send){
      var c = this.ctx, g = c.createGain(), s = c.createGain();
      g.connect(this.dry); s.gain.value = send; g.connect(s); s.connect(this.wet);
      return g;
    },
    partials: function(out, f, t, v, modes, atk){
      var c = this.ctx, ny = c.sampleRate * 0.45;
      modes.forEach(function(m){
        var fr = f * m[0]; if (fr > ny) return;
        var o = c.createOscillator(), e = c.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(fr, t);
        e.gain.setValueAtTime(0.0001, t);
        e.gain.linearRampToValueAtTime(v * m[1], t + atk);
        e.gain.exponentialRampToValueAtTime(0.0001, t + m[2]);
        o.connect(e); e.connect(out); o.start(t); o.stop(t + m[2] + 0.05);
      });
    },
    /* Wooden bar: marimba mode ratios 1 : 3.93 : 9.24 with a short mallet knock */
    bar: function(f, t, v, send){
      var c = this.ctx, out = this.voice(send);
      this.partials(out, f, t, v, [[1, 1, 0.5], [3.93, 0.28, 0.14], [9.24, 0.07, 0.05]], 0.004);
      var k = c.createOscillator(), ke = c.createGain();
      k.type = 'triangle'; k.frequency.setValueAtTime(f * 0.5, t); k.frequency.exponentialRampToValueAtTime(f * 0.25, t + 0.03);
      ke.gain.setValueAtTime(0.0001, t); ke.gain.linearRampToValueAtTime(v * 0.22, t + 0.002); ke.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      k.connect(ke); ke.connect(out); k.start(t); k.stop(t + 0.06);
    },
    /* Glass bell: inharmonic free-plate ratios */
    bell: function(f, t, v, send){
      this.partials(this.voice(send), f, t, v, [[1, 1, 2.4], [2.756, 0.45, 1.5], [5.404, 0.22, 0.9], [8.933, 0.1, 0.5]], 0.006);
    },
    tap: function(){
      if (!this.live()) return;
      var seq = [0, 2, 4, 2, 3, 1, 4, 5];
      var notes = [1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093];
      this.bar(notes[seq[this.stepIdx++ % seq.length]], this.ctx.currentTime + 0.004, 0.16, 0.14);
    },
    chime: function(){
      if (!this.live()) return;
      var t = this.ctx.currentTime + 0.01, self = this;
      [1318.51, 1975.53, 2637.02].forEach(function(f, i){ self.bell(f, t + i * 0.075, 0.11 - i * 0.02, 0.5); });
    },
    hop: function(){
      if (!this.live()) return;
      var t = this.ctx.currentTime + 0.004;
      this.bar(1318.51, t, 0.12, 0.18); this.bar(1975.53, t + 0.055, 0.1, 0.22);
    },
    /* Drawer open: a bright wooden bar that rises a step per drawer, plus a soft upper chirp */
    drawerOpen: function(i){
      if (!this.live()) return;
      var t = this.ctx.currentTime + 0.01, f = 783.99 * Math.pow(2, i * 2 / 12);
      this.bar(f, t, 0.14, 0.25);
      this.bar(f * 1.5, t + 0.06, 0.06, 0.3);
    },
    /* Drawer close: the open gesture in reverse. A soft-mallet wooden bar that steps down
       a fourth, warm and rounded (slow attack, low upper partial, gentle lowpass) */
    drawerClose: function(i, soft){
      if (!this.live()) return;
      var c = this.ctx, t = c.currentTime + 0.01, f = 1174.66 * Math.pow(2, i * 2 / 12), v = soft ? 0.55 : 1;
      var out = this.voice(0.3);
      var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 0.4;
      lp.connect(out);
      var mallet = [[1, 1, 0.5], [3.93, 0.08, 0.09]];
      this.partials(lp, f, t, 0.11 * v, mallet, 0.009);
      this.partials(lp, f * 0.75, t + 0.085, 0.1 * v, [[1, 1, 0.7], [3.93, 0.06, 0.1]], 0.01);
    },
    /* Secret found: a music-box run up the pentatonic scale */
    secret: function(){
      if (!this.live()) return;
      var t = this.ctx.currentTime + 0.01, self = this;
      [1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093].forEach(function(f, i){ self.bell(f, t + i * 0.07, 0.07, 0.45); });
    },
    /* Water drop: a round sine plop that glides up, stepping higher each drop */
    drop: function(n){
      if (!this.live()) return;
      var c = this.ctx, t = c.currentTime + 0.01, base = [587.33, 698.46, 880][Math.max(0, Math.min(2, n - 1))];
      var out = this.voice(0.35), o = c.createOscillator(), e = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * 2, t + 0.09);
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.16, t + 0.01); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(e); e.connect(out); o.start(t); o.stop(t + 0.3);
      this.bar(base * 2, t + 0.1, 0.06, 0.35);
    },
    /* Bloom: soft chord swell with a sparkle of glass bells on top */
    bloom: function(){
      if (!this.live()) return;
      this.swell();
      var t = this.ctx.currentTime + 0.3, self = this;
      [2093, 2349.32, 2637.02, 3135.96].forEach(function(f, i){ self.bell(f, t + i * 0.09, 0.05, 0.6); });
    },
    back: function(){
      if (!this.live()) return;
      var t = this.ctx.currentTime + 0.01;
      this.bar(1567.98, t, 0.13, 0.2); this.bar(1174.66, t + 0.09, 0.11, 0.2);
    },
    swell: function(){
      if (!this.live()) return;
      var c = this.ctx, t = c.currentTime + 0.02, self = this;
      var out = this.voice(0.6);
      var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
      lp.frequency.setValueAtTime(320, t); lp.frequency.exponentialRampToValueAtTime(2800, t + 1.1); lp.frequency.exponentialRampToValueAtTime(1100, t + 3.2);
      lp.connect(out);
      var amp = c.createGain();
      amp.gain.setValueAtTime(0.0001, t); amp.gain.exponentialRampToValueAtTime(0.5, t + 0.9); amp.gain.setTargetAtTime(0.0001, t + 1.6, 0.7);
      amp.connect(lp);
      [261.63, 329.63, 392.0, 523.25, 659.25].forEach(function(f){
        [-6, 6].forEach(function(dt){
          var o = c.createOscillator(), g = c.createGain();
          o.type = 'triangle'; o.frequency.value = f; o.detune.value = dt; g.gain.value = 0.05;
          o.connect(g); g.connect(amp); o.start(t); o.stop(t + 5);
        });
      });
      [1046.5, 1318.51, 1567.98, 2093].forEach(function(f, i){ self.bell(f, t + 0.55 + i * 0.11, 0.07, 0.6); });
    },
    setEnabled: function(on){
      this.enabled = on; this.save();
      if (on) this.arm(); else if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
      syncSoundBtn();
    }
  };
  Sound.load();
  var soundBtn = $('#soundBtn');
  function syncSoundBtn(){
    soundBtn.setAttribute('aria-pressed', Sound.enabled ? 'true' : 'false');
    soundBtn.setAttribute('aria-label', Sound.enabled ? '소리 켜짐. 누르면 꺼져요' : '소리 꺼짐. 누르면 켜져요');
  }
  syncSoundBtn();
  soundBtn.addEventListener('click', function(){ Sound.setEnabled(!Sound.enabled); if (Sound.enabled) Sound.chime(); });
  /* Arm on the first real gesture, never before */
  window.addEventListener('pointerdown', function(){ Sound.arm(); }, true);
  window.addEventListener('keydown', function(){ Sound.arm(); }, true);

  /* ---------------- Panels ---------------- */
  var panels = { hero: $('#panel-hero'), gallery: $('#panel-gallery'), cabinet: $('#panel-cabinet'), mail: $('#panel-mail') };
  var lastTrigger = null;

  $$('[data-stagger]').forEach(function(wrap){
    Array.prototype.forEach.call(wrap.children, function(el, i){ el.style.setProperty('--i', i); });
  });
  $$('.card').forEach(function(el, i){ el.style.setProperty('--i', i); });

  function setInert(el, on){ if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert'); try { el.inert = on; } catch (e) {} }

  function showPanel(id){
    var el = panels[id]; if (!el || Bus.mode !== id) return;
    if (id === 'mail') bloomOrigin();
    setInert(el, false);
    void el.offsetWidth;
    el.classList.add('is-open');
    var h = $('.panel__head', el);
    if (h) { try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
  }
  function hidePanel(id){
    var el = panels[id]; if (!el) return;
    el.classList.remove('is-open');
    setInert(el, true);
    if (id === 'cabinet') closeDrawers();
  }
  function bloomOrigin(){
    var el = panels.mail, r = el.getBoundingClientRect();
    var p = Bus.engine ? Bus.engine.project('mail') : null;
    var x = p ? p.x - r.left : r.width / 2, y = p ? p.y - r.top : r.height / 2;
    el.style.setProperty('--ox', Math.round(x) + 'px');
    el.style.setProperty('--oy', Math.round(y) + 'px');
    var far = 0;
    [[0, 0], [r.width, 0], [0, r.height], [r.width, r.height]].forEach(function(c){ far = Math.max(far, Math.hypot(c[0] - x, c[1] - y)); });
    el.style.setProperty('--or', Math.ceil(far + 24) + 'px');
  }

  function open(id){
    if (!panels[id] || Bus.mode === id) return;
    var prev = Bus.mode;
    if (prev !== 'room') hidePanel(prev);
    else lastTrigger = doc.activeElement && doc.activeElement !== body ? doc.activeElement : null;
    Bus.mode = id;
    body.setAttribute('data-mode', id);
    if (id === 'secret') Sound.secret(); else Sound.chime();
    var reveal = function(){ showPanel(id); };
    if (Bus.engine) Bus.engine.focus(id, reveal); else reveal();
  }
  function close(){
    if (Bus.mode === 'room') return;
    var id = Bus.mode;
    hidePanel(id);
    Bus.mode = 'room';
    body.setAttribute('data-mode', 'room');
    Sound.back();
    if (Bus.engine) Bus.engine.home();
    var target = lastTrigger && doc.contains(lastTrigger) && !lastTrigger.closest('[inert]') ? lastTrigger : $('.dock__btn[data-open="' + id + '"]');
    if (target) { try { target.focus({ preventScroll: true }); } catch (e) {} }
  }
  Bus.open = open; Bus.close = close;

  doc.addEventListener('click', function(e){
    var t = e.target.closest ? e.target.closest('[data-open],[data-go]') : null;
    if (!t) return;
    open(t.getAttribute('data-open') || t.getAttribute('data-go'));
  });
  $('#backBtn').addEventListener('click', close);
  $('#resetBtn').addEventListener('click', function(){ if (Bus.mode !== 'room') close(); else if (Bus.engine) Bus.engine.resetView(); });

  doc.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && Bus.mode !== 'room') { e.preventDefault(); close(); return; }
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= 4) { e.preventDefault(); open(SECTIONS[n - 1]); }
  });

  /* ---------------- Smooth wheel scrolling (panels + gallery) ---------------- */
  function wheelDelta(e, el, horizontal){
    var d = horizontal && Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (horizontal && Math.abs(e.deltaX) > 0 && Math.abs(e.deltaY) === 0 ? e.deltaX : e.deltaY);
    if (e.deltaMode === 1) d *= 18; else if (e.deltaMode === 2) d *= horizontal ? el.clientWidth : el.clientHeight;
    return d;
  }
  function smoothScroller(el, horizontal, opts){
    opts = opts || {};
    var prop = horizontal ? 'scrollLeft' : 'scrollTop';
    var st = { target: 0, cur: 0, raf: 0, last: 0 };
    function max(){ return horizontal ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight; }
    function tick(){
      var now = performance.now(), dt = Math.max(0.001, Math.min(0.05, (now - st.last) / 1000)); st.last = now;
      st.cur += (st.target - st.cur) * (1 - Math.exp(-dt * 14));
      if (Math.abs(st.target - st.cur) < 0.5) st.cur = st.target;
      el[prop] = st.cur;
      if (st.cur !== st.target) st.raf = requestAnimationFrame(tick);
      else { st.raf = 0; if (opts.onSettle) opts.onSettle(st); }
    }
    el.addEventListener('wheel', function(e){
      if (e.ctrlKey || Bus.reduced) return;
      var ta = e.target.closest && e.target.closest('textarea');
      if (ta && ta.scrollHeight > ta.clientHeight + 1) return;
      var m = max(); if (m <= 0) return;
      var d = wheelDelta(e, el, horizontal);
      if (!st.raf) { st.cur = el[prop]; st.target = st.cur; }
      var next = Math.max(0, Math.min(m, st.target + d));
      if (next === st.target && (next === 0 || next === m)) return;
      e.preventDefault();
      st.target = next;
      if (opts.onStart) opts.onStart(st);
      if (!st.raf) { st.last = performance.now(); st.raf = requestAnimationFrame(tick); }
    }, { passive: false });
    el.addEventListener('pointerdown', function(){ if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; } });
    return {
      stop: function(){ if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; } },
      get target(){ return st.target; },
      get running(){ return !!st.raf; },
      glideTo: function(v){ if (!st.raf) st.cur = el[prop]; st.target = Math.max(0, Math.min(max(), v)); if (!st.raf) { st.last = performance.now(); st.raf = requestAnimationFrame(tick); } }
    };
  }
  ['hero', 'gallery', 'cabinet', 'mail'].forEach(function(id){ smoothScroller(panels[id], false); });

  /* 액자(그림 백업) 화면은 js/gallery.js 가 서버 그림으로 채움 */

  /* ---------------- Cabinet drawers (click only) ---------------- */
  var drawerBtns = $$('.drawer__btn');
  function setDrawer(btn, on){
    btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (Bus.engine) Bus.engine.drawer(+btn.getAttribute('data-drawer'), on);
  }
  function closeDrawers(){ drawerBtns.forEach(function(b){ if (b.getAttribute('aria-expanded') === 'true') setDrawer(b, false); }); }
  drawerBtns.forEach(function(btn){
    btn.addEventListener('click', function(){
      var on = btn.getAttribute('aria-expanded') !== 'true', idx = +btn.getAttribute('data-drawer');
      var swapped = false;
      drawerBtns.forEach(function(b){ if (b !== btn && b.getAttribute('aria-expanded') === 'true') { setDrawer(b, false); swapped = true; Sound.drawerClose(+b.getAttribute('data-drawer'), true); } });
      setDrawer(btn, on);
      if (on) Sound.drawerOpen(idx); else Sound.drawerClose(idx, false);
    });
  });

  /* 화분 물 주기는 3D 방에서 화분을 누르면 됨 (js/diorama.js goWater) */

  /* ---------------- Mail form ---------------- */
  var form = $('#mailForm'), wrap = $('#formWrap');
  /* 푸밤: 우체통 = 방명록. 이름 + 내용만 받고, 실제 저장은 js/guestbook.js 의 PUBAM_GUESTBOOK_SEND 가 함 */
  var FIELDS = ['name', 'message'];
  var rules = {
    name: function(v){ return v.trim().length >= 1 ? '' : '이름을 적어 주세요.'; },
    message: function(v){ return v.trim().length >= 2 ? '' : '두 글자 이상 적어 주세요.'; }
  };
  function check(field){
    var msg = rules[field.name](field.value);
    field.setAttribute('aria-invalid', msg ? 'true' : 'false');
    $('#' + field.getAttribute('aria-describedby')).textContent = msg;
    return !msg;
  }
  FIELDS.forEach(function(n){
    var f = form.elements[n];
    f.addEventListener('blur', function(){ if (f.value) check(f); });
    f.addEventListener('input', function(){ if (f.getAttribute('aria-invalid') === 'true') check(f); });
  });
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var bad = null;
    FIELDS.forEach(function(n){ var f = form.elements[n]; if (!check(f) && !bad) bad = f; });
    if (bad) { bad.focus(); return; }
    var btn = form.querySelector('[type="submit"]'); btn.disabled = true;
    var send = window.PUBAM_GUESTBOOK_SEND ? window.PUBAM_GUESTBOOK_SEND(form) : Promise.resolve();
    Promise.resolve(send).then(function(){
      btn.disabled = false;
      wrap.classList.add('is-sent');
      Sound.swell();
      if (Bus.engine) Bus.engine.celebrate();
      var sent = $('#sent'); sent.setAttribute('tabindex', '-1'); try { sent.focus({ preventScroll: true }); } catch (err) {}
    }, function(err){
      btn.disabled = false;
      $('#e-msg').textContent = (window.PUBAM && window.PUBAM.msg) ? window.PUBAM.msg(err) : '보내지 못했어요';
    });
  });
  $('#againBtn').addEventListener('click', function(){
    form.reset();
    FIELDS.forEach(function(n){ form.elements[n].removeAttribute('aria-invalid'); });
    $$('.err', form).forEach(function(s){ s.textContent = ''; });
    wrap.classList.remove('is-sent');
    form.elements.name.focus();
  });

  /* ---------------- Engine handshake ---------------- */
  var loaderText = $('#loaderText');
  var failTimer = setTimeout(function(){ if (!Bus.engine) Bus.fail('timeout'); }, 12000);
  Bus.attach = function(engine){
    clearTimeout(failTimer);
    Bus.engine = engine;
    body.classList.add('is-ready');
    body.classList.remove('no-3d');
  };
  Bus.fail = function(){
    if (Bus.engine) return;
    clearTimeout(failTimer);
    body.classList.add('no-3d');
    loaderText.textContent = '이 기기에서는 3D 방을 열 수 없어요. 아래 메뉴로 열어 보세요.';
    setTimeout(function(){ body.classList.add('is-ready'); }, 5000);
  };
})();
