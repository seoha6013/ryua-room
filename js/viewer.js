/* 크게 보기 (카드뉴스): 그림 묶음 · 기록장이 같이 씀
   - 옆으로 넘기기(scroll-snap) ↔ 세로로 이어 보기, 방식은 localStorage 'pubam-comic-mode'에 기억
   - 쪽수 · 점 · 처음으로 · 두 번 탭/버튼 확대 · 앞뒤 장 미리 불러오기
   - 남은 화면을 재서 원본 비율 그대로 여백 두고 맞춤 (dvh 모르는 브라우저도)
   - 닫기: ✕ / Esc / 폰에서 맨 위에서 아래로 쓸어내리기
   - 아래쪽(댓글 등)은 여는 쪽이 under()로 채움. 반응(❤️😭👍🤣)은 여기서 처리
   사용: PUBAM_VIEWER.open({ key, title, urls, react: { type, id } | null, under: () => html, onClose })
         PUBAM_VIEWER.reactHTML() → under() 안에 넣는 반응 버튼, .refresh(), .close(), .isOpen(key) */
(function(){
  'use strict';
  var P = window.PUBAM;
  function esc(s){ return P.esc(s == null ? '' : s); }
  var css = document.createElement('style');
  css.textContent =
    '.cv{position:fixed;inset:0;z-index:200;background:#F7F6FB;display:flex;flex-direction:column;font:15px/1.6 Nunito,"Gowun Dodum",system-ui,sans-serif;color:#1F1B24}' +
    '.cv[hidden]{display:none}' +
    '.cv-top{flex:none;display:flex;align-items:center;gap:8px;padding:10px 12px;padding-top:max(10px,env(safe-area-inset-top));background:#fff;border-bottom:1px solid #E3DFEC;z-index:2}' +
    '.cv-top b{flex:1;font:900 16px Nunito,"Gowun Dodum",sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.cv-count{font:900 14px Nunito,sans-serif;color:#4A4552;white-space:nowrap}' +
    '.cv-btn{min-height:40px;padding:0 12px;border-radius:999px;border:1.5px solid #D9D5E3;background:#fff;font:800 13px Nunito,"Gowun Dodum",sans-serif;cursor:pointer;white-space:nowrap}' +
    '.cv-btn:hover{border-color:#1F1B24}.cv-btn[hidden],.cv-count[hidden]{display:none}' +
    '.cv-x{width:44px;height:44px;flex:none;border-radius:50%;border:1.5px solid #1F1B24;background:#fff;font:900 18px Nunito,sans-serif;cursor:pointer;box-shadow:0 2px 0 #1F1B24}' +
    '.cv-scroll{flex:1;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}' +
    '.cv-stage{position:relative;transition:transform .2s,opacity .2s}' +
    '.cv{--cvh:calc(100vh - 128px)}' +
    '.cv-track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;height:var(--cvh);overscroll-behavior-x:contain}' +
    '.cv-track::-webkit-scrollbar{display:none}' +
    '.cv-slide{flex:0 0 100%;width:100%;height:var(--cvh);box-sizing:border-box;padding:8px;scroll-snap-align:center;scroll-snap-stop:always;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}' +
    '.cv-slide img{width:auto;height:auto;max-width:100%;max-height:calc(var(--cvh) - 16px);object-fit:contain;display:block;user-select:none;-webkit-user-drag:none;background:#fff;outline:1px solid #D9D5E3;box-shadow:0 2px 14px -6px rgba(31,27,36,.35)}' +   /* 얇은 테두리 = 원본 그림의 끝 */
    '.cv-slide.zoom{display:block!important;overflow:auto!important;touch-action:pan-x pan-y}' +
    '.cv-slide.zoom img{max-width:none!important;max-height:none!important;width:200%!important;height:auto!important;cursor:zoom-out}' +
    '.cv-end{flex-direction:column;gap:14px;text-align:center}' +
    '.cv-end p{margin:0;font:900 18px Nunito,"Gowun Dodum",sans-serif}' +
    '.cv-end button{min-height:50px;padding:0 26px;border-radius:999px;border:1.5px solid #2E3870;background:#5565AA;color:#fff;font:900 16px Nunito,"Gowun Dodum",sans-serif;cursor:pointer;box-shadow:0 3px 0 #2E3870}' +
    '.cv-nav{position:absolute;top:50%;transform:translateY(-50%);width:52px;height:52px;border-radius:50%;border:1.5px solid #1F1B24;background:rgba(255,255,255,.92);font:900 26px/1 Nunito,sans-serif;cursor:pointer;box-shadow:0 3px 0 #1F1B24;z-index:2}' +
    '.cv-nav:disabled{opacity:.25;cursor:default}.cv-nav[hidden]{display:none}' +
    '.cv-nav.prev{left:14px}.cv-nav.next{right:14px}' +
    '.cv-dots{display:flex;flex-wrap:wrap;justify-content:center;gap:2px;padding:8px 12px 4px;max-width:720px;margin:0 auto}' +
    '.cv-dots:empty{padding:4px}' +
    '.cv-dots button{width:26px;height:26px;border:0;background:none;cursor:pointer;display:grid;place-items:center;padding:0}' +
    '.cv-dots button::before{content:"";width:9px;height:9px;border-radius:50%;background:#CFCADB;transition:transform .2s,background .2s}' +
    '.cv-dots button[aria-current="true"]::before{background:#5565AA;transform:scale(1.35)}' +
    '.cv-under{max-width:720px;margin:0 auto;padding:10px 16px 40px}' +
    '.cv-under h2{margin:8px 0 2px;font:900 19px Nunito,"Gowun Dodum",sans-serif}' +
    '.cv-under .cap{margin:0 0 6px;color:#4A4552}' +
    '.cv-react{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}' +
    '.cv-react button{min-height:42px;padding:0 14px;border-radius:999px;border:1.5px solid #D9D5E3;background:#fff;cursor:pointer;font-size:15px}' +
    '.cv-react button[aria-pressed="true"]{background:#F2E6A0;border-color:#1F1B24}' +
    '.cv-under h3{margin:14px 0 6px;font:900 14px Nunito,"Gowun Dodum",sans-serif}' +
    '.cv-under .ag-cl li,.cv-under .rc-cl li{background:#fff}' +
    /* 세로로 이어 보기 (웹툰처럼) */
    '.cv.vert .cv-track{display:block;overflow:visible;height:auto;scroll-snap-type:none}' +
    '.cv.vert .cv-slide{display:block;height:auto;padding:0;overflow-x:auto;scroll-snap-align:none}' +
    '.cv.vert .cv-slide img{width:min(100%,860px);max-height:none;margin:0 auto;box-shadow:none}' +
    '.cv.vert .cv-end{display:flex;padding:30px 0}' +
    '.cv.vert .cv-nav,.cv.vert .cv-dots{display:none}' +
    '@media (max-width:600px){.cv-top{gap:6px;padding:8px}.cv-btn{padding:0 10px;font-size:12px;min-height:38px}.cv-x{width:48px;height:48px}.cv-nav{display:none!important}.cv{--cvh:calc(100vh - 120px)}.cv-top b{font-size:14px}}';
  document.head.appendChild(css);

  var cv = document.createElement('div');
  cv.className = 'cv'; cv.id = 'cv'; cv.hidden = true;
  cv.setAttribute('role', 'dialog'); cv.setAttribute('aria-modal', 'true'); cv.setAttribute('aria-labelledby', 'cvTitle');
  cv.innerHTML =
    '<div class="cv-top"><b id="cvTitle"></b><span class="cv-count" id="cvCount" aria-live="polite"></span>' +
      '<button type="button" class="cv-btn" id="cvMode"></button><button type="button" class="cv-btn" id="cvZoom">＋ 확대</button>' +
      '<button type="button" class="cv-x" id="cvClose" aria-label="닫기">✕</button></div>' +
    '<div class="cv-scroll" id="cvScroll"><div class="cv-stage" id="cvStage">' +
      '<div class="cv-track" id="cvTrack"></div>' +
      '<button type="button" class="cv-nav prev" id="cvPrev" aria-label="이전 장">‹</button><button type="button" class="cv-nav next" id="cvNext" aria-label="다음 장">›</button>' +
    '</div><div class="cv-dots" id="cvDots" role="group" aria-label="장 고르기"></div><section class="cv-under" id="cvUnder"></section></div>';
  var V = { o: null, i: 0, n: 0, vert: false, back: null, react: {}, goal: null };
  var REACTS = ['❤️', '😭', '👍', '🤣'];
  var mineR = (function(){ try { return JSON.parse(localStorage.getItem('pubam-reacted') || '{}'); } catch (e) { return {}; } })();
  function q(id){ return cv.querySelector('#' + id); }
  function slides(){ return [].slice.call(q('cvTrack').querySelectorAll('.cv-slide[data-i]')); }
  function reduced(){ return !!(window.GM635 && window.GM635.reduced); }
  function want(i){   /* 지금 장과 앞뒤 장은 미리 불러 둠 */
    slides().forEach(function(s){ var k = +s.dataset.i, im = s.querySelector('img'); if (Math.abs(k - i) <= 2 && !im.getAttribute('src')) im.src = im.dataset.src; });
  }
  function setIdx(i){
    if (V.goal != null && i === V.goal) V.goal = null;
    V.i = Math.max(0, Math.min(V.n - 1, i));
    q('cvCount').textContent = (V.i + 1) + ' / ' + V.n;
    [].forEach.call(q('cvDots').children, function(b, k){ b.setAttribute('aria-current', k === V.i ? 'true' : 'false'); });
    q('cvPrev').disabled = V.i === 0;
    want(V.i);
  }
  function go(i, smooth){
    var t = q('cvTrack');
    if (V.vert) { var s = slides()[Math.max(0, Math.min(V.n - 1, i))]; if (s) s.scrollIntoView({ block: 'start', behavior: smooth === false ? 'auto' : 'smooth' }); return; }
    V.goal = Math.max(0, Math.min(V.n > 1 ? V.n : 0, i));
    t.scrollTo({ left: V.goal * t.clientWidth, behavior: smooth === false || reduced() ? 'auto' : 'smooth' });
  }
  function step(d){ go((V.goal != null ? V.goal : V.i) + d); }   /* 넘기는 도중 또 눌러도 안 놓침 */
  function fitImg(im, W, H, pad){
    if (!im.naturalWidth) return;
    var k = Math.min(1, (W - pad * 2) / im.naturalWidth, (H - pad * 2) / im.naturalHeight);
    im.style.width = Math.floor(im.naturalWidth * k) + 'px';
    im.style.height = Math.floor(im.naturalHeight * k) + 'px';
  }
  function layout(){
    var t = q('cvTrack'); if (!t || cv.hidden) return;
    var all = [].slice.call(t.querySelectorAll('.cv-slide'));
    if (V.vert) { t.style.height = ''; all.forEach(function(s){ s.style.cssText = ''; var im = s.querySelector('img'); if (im) { im.style.width = ''; im.style.height = ''; } }); return; }
    var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    var H = Math.max(200, Math.floor(vh - cv.querySelector('.cv-top').offsetHeight - q('cvDots').offsetHeight - 6));
    var W = t.clientWidth, pad = W < 600 ? 14 : 28;
    t.style.height = H + 'px';
    all.forEach(function(s){
      s.style.cssText = 'flex:0 0 ' + W + 'px;width:' + W + 'px;height:' + H + 'px;padding:0';
      var im = s.querySelector('img'); if (!im) return;
      im.style.maxWidth = 'none'; im.style.maxHeight = 'none';
      if (im.naturalWidth) fitImg(im, W, H, pad);
      else { im.style.width = (W - pad * 2) + 'px'; im.style.height = 'auto'; im.onload = function(){ fitImg(im, W, H, pad); }; }
    });
    t.scrollLeft = Math.min(V.n, V.goal != null ? V.goal : V.i) * W;
  }
  function unzoom(){ cv.querySelectorAll('.cv-slide.zoom').forEach(function(s){ s.classList.remove('zoom'); }); q('cvZoom').textContent = '＋ 확대'; }
  function toggleZoom(slide){
    slide = slide || slides()[V.i]; if (!slide) return;
    var on = !slide.classList.contains('zoom'); unzoom();
    if (on) { slide.classList.add('zoom'); q('cvZoom').textContent = '－ 원래대로'; }
  }
  function setMode(vert){
    V.vert = vert && V.n > 1; unzoom();
    cv.classList.toggle('vert', V.vert);
    q('cvMode').textContent = V.vert ? '↔ 옆으로 넘기기' : '↕ 세로로 이어 보기';
    if (V.n > 1) try { localStorage.setItem('pubam-comic-mode', V.vert ? 'v' : 'h'); } catch (e) {}
    if (V.vert) slides().forEach(function(s){ var im = s.querySelector('img'); im.loading = 'lazy'; if (!im.getAttribute('src')) im.src = im.dataset.src; });
    var keep = V.i; setTimeout(function(){ layout(); go(keep, false); setIdx(keep); }, 30);
  }
  function reactHTML(){
    var r = V.o && V.o.react; if (!r) return '';
    return '<div class="cv-react" role="group" aria-label="반응">' + REACTS.map(function(e){
      return '<button type="button" data-cvr="' + e + '" aria-pressed="' + !!mineR[r.type + ':' + r.id + ':' + e] + '">' + e + ' <span>' + (V.react[e] || 0) + '</span></button>';
    }).join('') + '</div>';
  }
  function refresh(){ if (V.o) q('cvUnder').innerHTML = V.o.under ? V.o.under() : reactHTML(); }
  async function loadReacts(){
    var r = V.o && V.o.react; if (!r) return;
    var res = await P.sb.rpc('reaction_counts', { p_type: r.type });
    if (!V.o || V.o.react !== r) return;
    V.react = {};
    (res.data || []).forEach(function(x){ if (x.target_id === r.id) V.react[x.emoji] = Number(x.n); });
    refresh();
  }
  function open(o){
    var urls = o.urls || [];
    if (!urls.length) return;
    V.o = o; V.n = urls.length; V.i = 0; V.goal = null; V.back = document.activeElement; V.react = {};
    var multi = V.n > 1;
    q('cvTitle').textContent = o.title || '';
    q('cvTrack').innerHTML = urls.map(function(u, i){
      return '<div class="cv-slide" data-i="' + i + '"><img data-src="' + esc(u) + '" alt="' + (i + 1) + ' / ' + urls.length + '쪽" draggable="false"></div>';
    }).join('') + (multi ? '<div class="cv-slide cv-end"><p>마지막 장이에요</p><button type="button" data-first>처음으로</button></div>' : '');
    q('cvDots').innerHTML = multi ? urls.map(function(u, i){ return '<button type="button" data-dot="' + i + '" aria-label="' + (i + 1) + '장으로"></button>'; }).join('') : '';
    q('cvMode').hidden = !multi; q('cvCount').hidden = !multi; q('cvPrev').hidden = q('cvNext').hidden = !multi;
    refresh(); loadReacts();
    cv.hidden = false; document.documentElement.style.overflow = 'hidden';
    q('cvScroll').scrollTop = 0;
    var saved = 'h'; try { saved = localStorage.getItem('pubam-comic-mode') || 'h'; } catch (e) {}
    setMode(saved === 'v');
    q('cvTrack').scrollLeft = 0; setIdx(0);
    q('cvClose').focus();
  }
  function close(){
    if (cv.hidden) return;
    var o = V.o;
    cv.hidden = true; document.documentElement.style.overflow = ''; unzoom();
    q('cvStage').style.transform = ''; q('cvStage').style.opacity = '';
    V.o = null; q('cvTrack').innerHTML = '';
    if (V.back && V.back.focus) try { V.back.focus({ preventScroll: true }); } catch (e) {}
    if (o && o.onClose) o.onClose();
  }
  function mount(){
    document.body.appendChild(cv);
    var t = q('cvTrack'), raf = 0;
    t.addEventListener('scroll', function(){
      if (V.vert) return;
      cancelAnimationFrame(raf); raf = requestAnimationFrame(function(){ setIdx(Math.round(t.scrollLeft / Math.max(1, t.clientWidth))); });
    }, { passive: true });
    q('cvScroll').addEventListener('scroll', function(){
      if (!V.vert) return;
      var top = q('cvScroll').getBoundingClientRect().top + 80, best = 0;
      slides().forEach(function(s, k){ if (s.getBoundingClientRect().top <= top) best = k; });
      if (best !== V.i) setIdx(best);
    }, { passive: true });
    q('cvPrev').addEventListener('click', function(){ step(-1); });
    q('cvNext').addEventListener('click', function(){ step(1); });
    t.addEventListener('touchstart', function(){ V.goal = null; }, { passive: true });
    q('cvClose').addEventListener('click', close);
    q('cvMode').addEventListener('click', function(){ setMode(!V.vert); });
    q('cvZoom').addEventListener('click', function(){ toggleZoom(); });
    cv.addEventListener('click', async function(e){
      var d = e.target.closest('[data-dot]'); if (d) { go(+d.dataset.dot); return; }
      if (e.target.closest('[data-first]')) { if (V.vert) q('cvScroll').scrollTo({ top: 0, behavior: 'smooth' }); else go(0); return; }
      var b = e.target.closest('[data-cvr]');
      if (b && V.o && V.o.react) {
        var r = V.o.react, k = b.dataset.cvr, key = r.type + ':' + r.id + ':' + k; b.disabled = true;
        var res = await P.sb.rpc('toggle_reaction', { p_type: r.type, p_id: r.id, p_emoji: k, p_client: P.clientId });
        b.disabled = false; if (res.error) { alert(P.msg(res.error)); return; }
        var on = res.data === true; if (on) mineR[key] = 1; else delete mineR[key];
        try { localStorage.setItem('pubam-reacted', JSON.stringify(mineR)); } catch (x) {}
        V.react[k] = Math.max(0, (V.react[k] || 0) + (on ? 1 : -1)); refresh();
      }
    });
    var lastTap = { t: 0, x: 0, y: 0 };
    t.addEventListener('pointerup', function(e){   /* 두 번 탭하면 확대 */
      var s = e.target.closest('.cv-slide[data-i]'); if (!s) return;
      var now = performance.now();
      if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { toggleZoom(s); lastTap.t = 0; }
      else lastTap = { t: now, x: e.clientX, y: e.clientY };
    });
    var sw = null, stage = q('cvStage'), sc = q('cvScroll');   /* 폰: 아래로 쓸어내리면 닫힘 */
    sc.addEventListener('touchstart', function(e){
      if (sc.scrollTop > 2 || cv.querySelector('.cv-slide.zoom') || e.touches.length > 1) { sw = null; return; }
      sw = { x: e.touches[0].clientX, y: e.touches[0].clientY, on: false };
    }, { passive: true });
    sc.addEventListener('touchmove', function(e){
      if (!sw) return;
      var dx = e.touches[0].clientX - sw.x, dy = e.touches[0].clientY - sw.y;
      if (!sw.on) { if (dy > 12 && dy > Math.abs(dx) * 1.4) sw.on = true; else if (Math.abs(dx) > 12 || dy < -8) { sw = null; return; } }
      if (sw.on) { sw.dy = dy; stage.style.transform = 'translateY(' + dy * 0.6 + 'px)'; stage.style.opacity = String(Math.max(0.4, 1 - dy / 500)); }
    }, { passive: true });
    sc.addEventListener('touchend', function(){
      if (sw && sw.on && sw.dy > 110) close(); else { stage.style.transform = ''; stage.style.opacity = ''; }
      sw = null;
    });
    window.addEventListener('keydown', function(e){   /* ← → 넘기기, Esc 닫기 (방 단축키는 막음) */
      if (cv.hidden) return;
      var tag = e.target && e.target.tagName;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (/^Arrow(Up|Down)$|^Page|^ $/.test(e.key)) return;
      e.stopImmediatePropagation();
    }, true);
    var lastW = 0, lastH = 0;
    var relayout = function(){   /* 화면 크기가 바뀌면(폰 돌리기, 주소창) 다시 잼 */
      if (cv.hidden) return;
      var w = window.innerWidth, h = window.visualViewport ? Math.round(window.visualViewport.height) : window.innerHeight;
      if (w === lastW && Math.abs(h - lastH) < 2) return;
      lastW = w; lastH = h; layout();
    };
    window.addEventListener('resize', relayout);
    window.addEventListener('orientationchange', function(){ setTimeout(relayout, 250); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', relayout);
  }
  window.PUBAM_VIEWER = {
    open: open, close: close, refresh: refresh, reactHTML: reactHTML,
    isOpen: function(key){ return !cv.hidden && !!V.o && (key == null || V.o.key === key); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
