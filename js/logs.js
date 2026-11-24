/* TV = 로그 백업. 서버 logs 표 + media 저장소(PDF·캡처).
   시나리오별 묶음(접기/펼치기) → 로그(접기/펼치기) → PDF(페이지가 위아래로 이어지는 스크롤) / 본문·캡처.
   성인 로그는 '성인 로그' 묶음에만, 게스트는 성인 비번을 넣어야 보임(서버 함수 adult_logs).
   올리기·고치기는 upload.html(#log, #edit-log=ID). TV 화면 그림 바꾸기(settings 'tv_image')도 여기. */
(function(){
  'use strict';
  var P = window.PUBAM;
  var PUBAM_SC = '푸르가토리움의 밤';
  var PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/';
  var css = document.createElement('style');
  css.textContent =
    '.lg-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:16px 0 12px}' +
    '.lg-sm{min-height:38px;padding:0 12px;border-radius:999px;border:1.5px solid #D9D5E3;background:#fff;font:700 13px Nunito,"Gowun Dodum",sans-serif;cursor:pointer;color:var(--ink);text-decoration:none;display:inline-flex;align-items:center}' +
    '.lg-sm:hover{border-color:var(--ink)}' +
    '.lg-ink{background:var(--ink);border-color:var(--ink);color:#fff}' +
    '.lg-pl{display:none!important}' +
    'html.is-pl .lg-pl{display:inline-flex!important}' +
    'html.is-pl div.lg-pl{display:flex!important}' +
    '.lg-group{border:1.5px solid #D9D5E3;border-radius:20px;margin:0 0 10px;background:var(--gb,#fff)}' +
    '.lg-group>summary,.lg-log>summary{list-style:none;cursor:pointer}' +
    '.lg-group>summary::-webkit-details-marker,.lg-log>summary::-webkit-details-marker{display:none}' +
    '.lg-group>summary{display:flex;align-items:center;gap:10px;min-height:52px;padding:8px 16px;font:900 16px Nunito,"Gowun Dodum",sans-serif}' +
    '.lg-group>summary span{flex:1}' +
    '.lg-n{font:800 12px Nunito,sans-serif;font-style:normal;color:var(--ink-3);background:#fff;border:1px solid #D9D5E3;border-radius:999px;padding:1px 9px}' +
    '.lg-chev{width:18px;height:18px;flex:none;transition:transform .3s var(--spring,ease)}' +
    'details[open]>summary .lg-chev{transform:rotate(90deg)}' +
    '.lg-list{display:flex;flex-direction:column;gap:8px;padding:0 10px 10px}' +
    '.lg-log{background:#fff;border:1px solid #D9D5E3;border-radius:16px}' +
    '.lg-log>summary{display:grid;grid-template-columns:auto 1fr;gap:0 10px;align-items:center;padding:10px 12px;border-radius:16px}' +
    '.lg-log>summary:hover{background:var(--blush-fill)}' +
    '.lg-no{grid-row:span 2;min-width:40px;height:40px;padding:0 6px;border-radius:12px;background:var(--blush-fill);display:grid;place-items:center;font:900 12px Nunito,sans-serif}' +
    '.lg-log>summary b{font:800 15px/1.35 Nunito,"Gowun Dodum",sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.lg-log>summary small{font:700 12px/1.4 Nunito,"Gowun Dodum",sans-serif;color:var(--ink-3)}' +
    '.lg-body{padding:4px 12px 14px;border-top:1px dashed #D9D5E3;margin:0 8px}' +
    '.lg-body h3{margin:12px 0 4px;font:900 16px Nunito,"Gowun Dodum",sans-serif}' +
    '.panel .lg-body p{margin:10px 0;font-size:15px;line-height:1.75;white-space:pre-wrap;word-break:break-word;color:var(--ink)}' +
    '.lg-caps{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin:10px 0}' +
    '.lg-caps a{display:block;border-radius:12px;overflow:hidden;background:var(--lav-fill);aspect-ratio:4/3}' +
    '.lg-caps img{width:100%;height:100%;object-fit:cover;display:block}' +
    '.lg-open{display:inline-flex;align-items:center;gap:6px;margin:10px 0 8px;font:800 14px Nunito,"Gowun Dodum",sans-serif;color:#5565AA}' +
    /* PDF: 페이지를 위아래로 이어서 */
    '.lg-pdf{display:flex;flex-direction:column;gap:8px;margin:6px -4px 0}' +
    '.lg-page{width:100%;aspect-ratio:1/1.414;background:#fff;border:1px solid #E3DFEC;border-radius:6px;overflow:hidden;position:relative}' +
    '.lg-page::before{content:attr(data-n);position:absolute;inset:0;display:grid;place-items:center;font:800 13px Nunito,sans-serif;color:#C9C4D6}' +
    '.lg-page canvas{display:block;width:100%;height:auto;position:relative}' +
    '.panel p.lg-pdfmsg{margin:4px 0;font-size:13px;color:var(--ink-3)}' +
    '.lg-tools{gap:6px;margin-top:10px}' +
    '.panel p.lg-empty{color:var(--ink-3);text-align:center;padding:20px 0;font-size:15px}' +
    '.lg-lock{margin:4px 10px 12px;padding:12px 14px;border:1.5px dashed var(--ink-3);border-radius:16px;background:#fff}' +
    '.panel .lg-lock p{font-size:14px;margin:0 0 8px}' +
    '.lg-lock form{display:flex;gap:6px;flex-wrap:wrap}' +
    '.lg-lock input{min-height:42px;border:1.5px solid var(--ink);border-radius:12px;padding:0 12px;font-size:16px;flex:1 1 140px}' +
    '.lg-lock button{min-height:42px;padding:0 16px;border-radius:12px;border:1.5px solid var(--ink);background:var(--ink);color:#fff;font-weight:800;cursor:pointer}' +
    '.panel .lg-lerr{color:#B3261E;font-size:13px;margin:6px 0 0;min-height:1em}' +
    '.lg-tv{margin-top:14px;padding:12px 14px;border-radius:16px;background:var(--lav-fill);flex-wrap:wrap;align-items:center;gap:8px}' +
    '.panel .lg-tv p{font-size:13px;margin:0;flex:1 1 100%}';
  document.head.appendChild(css);

  var LOGS = [], ADULT = [], adultPw = null, loaded = false, err = '', openGroups = {};
  var chev = '<svg class="lg-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  function $(id){ return document.getElementById(id); }
  function esc(s){ return P.esc(s == null ? '' : s); }
  function dot(d){ return d ? d.replace(/-/g, '.') : ''; }
  function all(){ return LOGS.concat(ADULT.filter(function(a){ return !LOGS.some(function(x){ return x.id === a.id; }); })); }
  function sortKey(l){ return (l.played_on || '9999') + '|' + String(l.session_no == null ? 999 : l.session_no).padStart(3, '0') + '|' + l.created_at; }
  function bySort(a, b){ return sortKey(a) < sortKey(b) ? -1 : 1; }

  function logHTML(l){
    var caps = l.image_paths || [];
    var no = l.session_no != null ? l.session_no + '회' : (l.pdf_path ? 'PDF' : '·');
    return '<details class="lg-log" id="lg-' + l.id + '" data-id="' + l.id + '">' +
      /* 접었을 때: 올린 사람이 정한 문구(비우면 제목) + 작은 날짜 */
      '<summary><span class="lg-no">' + no + '</span><b>' + esc(l.fold_text || l.title) + '</b><small>' + (dot(l.played_on) || '&nbsp;') + '</small></summary>' +
      '<div class="lg-body">' +
        (l.fold_text ? '<h3>' + esc(l.title) + '</h3>' : '') +
        String(l.body || '').split(/\n\s*\n/).map(function(x){ return x.trim(); }).filter(Boolean).map(function(x){ return '<p>' + esc(x) + '</p>'; }).join('') +
        (caps.length ? '<div class="lg-caps">' + caps.map(function(p){ var u = esc(P.mediaUrl(p)); return '<a href="' + u + '" target="_blank" rel="noopener"><img data-src="' + u + '" alt="로그 캡처"></a>'; }).join('') + '</div>' : '') +
        (l.pdf_path ? '<a class="lg-open" href="' + esc(P.mediaUrl(l.pdf_path)) + '" target="_blank" rel="noopener">새 창에서 원본 PDF 열기 ↗</a><div class="lg-pdf" data-pdf="' + esc(P.mediaUrl(l.pdf_path)) + '"></div>' : '') +
        '<div class="lg-pl lg-tools"><a class="lg-sm" href="upload.html#edit-log=' + l.id + '">수정</a><button class="lg-sm" type="button" data-lgdel="' + l.id + '">삭제</button></div>' +
      '</div></details>';
  }
  function groupHTML(key, name, items, bg, first, extra){
    var open = key in openGroups ? openGroups[key] : first;
    return '<details class="lg-group" data-g="' + esc(key) + '"' + (open ? ' open' : '') + ' style="--gb:' + bg + '">' +
      '<summary>' + chev + '<span>' + esc(name) + '</span><i class="lg-n">' + (items ? items.length : '🔒') + '</i></summary>' +
      (extra || '') + '<div class="lg-list">' + (items ? (items.length ? items.map(logHTML).join('') : '<p class="lg-empty">아직 없어요.</p>') : '') + '</div></details>';
  }
  function render(){
    var view = $('lgView'); if (!view) return;
    if (!loaded) { view.innerHTML = '<p class="lg-empty">' + (err || '로그를 불러오는 중…') + '</p>'; return; }
    var open = [].map.call(view.querySelectorAll('.lg-log[open]'), function(d){ return d.id; });
    var pub = all().filter(function(l){ return !l.is_adult; });
    /* 시나리오별 묶음: 푸르가토리움이 맨 위, 나머지는 첫 날짜 순 */
    var names = [];
    pub.slice().sort(bySort).forEach(function(l){ var n = l.scenario || PUBAM_SC; if (names.indexOf(n) < 0) names.push(n); });
    names.sort(function(a, b){ return (a === PUBAM_SC ? -1 : 0) - (b === PUBAM_SC ? -1 : 0); });
    var bgs = ['color-mix(in oklab,var(--blush) 30%,#fff)', 'var(--lav-fill)', 'var(--mint-fill)', '#EEF3FA'];
    var html = names.map(function(n, i){
      return groupHTML('sc:' + n, n, pub.filter(function(l){ return (l.scenario || PUBAM_SC) === n; }).sort(bySort), bgs[i % bgs.length], i === 0);
    }).join('');
    if (!names.length) html = '<p class="lg-empty">아직 올린 로그가 없어요.</p>';
    /* 성인 로그: 따로 묶음, 게스트는 비번 */
    var unlocked = P.isPL() || adultPw !== null;
    var adult = all().filter(function(l){ return l.is_adult; }).sort(bySort);
    if (unlocked ? adult.length : true) {
      html += groupHTML('adult', '성인 로그', unlocked ? adult : null, '#FFEAF0', false,
        unlocked ? '' : '<div class="lg-lock"><p>성인 로그는 성인 비밀번호를 넣어야 보여요.</p><form id="lgLock"><label style="position:absolute;left:-9999px" for="lgPw">성인 비밀번호</label><input id="lgPw" type="password" placeholder="성인 비밀번호" autocomplete="off" required><button type="submit">열기</button></form><p class="lg-lerr" id="lgLErr" role="alert"></p></div>');
    }
    view.innerHTML = html;
    open.forEach(function(id){ var d = $(id); if (d) { d.open = true; opened(d); } });
  }

  /* ---------- PDF 보기: PDF.js로 페이지를 차례로. 보이는 곳 근처만 그리고, 멀어지면 지움 ---------- */
  var pdfLib = null;
  function pdfjs(){
    if (!pdfLib) pdfLib = import(PDFJS + 'build/pdf.min.mjs').then(function(m){ m.GlobalWorkerOptions.workerSrc = PDFJS + 'build/pdf.worker.min.mjs'; return m; });
    return pdfLib;
  }
  async function showPdf(box){
    if (box.dataset.state) return;
    box.dataset.state = 'loading';
    box.innerHTML = '<p class="lg-pdfmsg">PDF 불러오는 중…</p>';
    try {
      var lib = await pdfjs();
      var doc = await lib.getDocument({ url: box.dataset.pdf, cMapUrl: PDFJS + 'cmaps/', cMapPacked: true, standardFontDataUrl: PDFJS + 'standard_fonts/' }).promise;
      var vp1 = (await doc.getPage(1)).getViewport({ scale: 1 });
      box.innerHTML = '<p class="lg-pdfmsg">' + doc.numPages + '쪽 · 내리면서 읽어요</p>';
      var pages = [];
      for (var i = 1; i <= doc.numPages; i++) {
        var d = document.createElement('div'); d.className = 'lg-page'; d.dataset.n = i;
        d.style.aspectRatio = vp1.width + ' / ' + vp1.height; box.appendChild(d); pages.push(d);
      }
      var root = box.closest('.panel') || null;
      var draw = async function(el){
        if (el._c || el._busy) return;
        el._busy = true;
        try {
          var page = await doc.getPage(+el.dataset.n), vp0 = page.getViewport({ scale: 1 });
          el.style.aspectRatio = vp0.width + ' / ' + vp0.height;
          var dpr = Math.min(window.devicePixelRatio || 1, 2), w = el.clientWidth || box.clientWidth || 360;   /* 화면 폭에 맞춤 */
          var vp = page.getViewport({ scale: w * dpr / vp0.width });
          var c = document.createElement('canvas'); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
          await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
          if (el._want) { el.appendChild(c); el._c = c; }
        } catch (e) { console.warn(e); }
        el._busy = false;
      };
      var free = function(el){ if (el._c) { el._c.width = 0; el._c.height = 0; el._c.remove(); el._c = null; } };
      var io = new IntersectionObserver(function(ents){
        ents.forEach(function(en){ en.target._want = en.isIntersecting; if (en.isIntersecting) draw(en.target); else free(en.target); });
      }, { root: root, rootMargin: '900px 0px' });
      pages.forEach(function(p){ io.observe(p); });
      box._io = io; box._doc = doc; box.dataset.state = 'ready';
    } catch (e) {
      console.warn(e);
      box.dataset.state = '';
      box.innerHTML = '<p class="lg-pdfmsg">PDF를 여기서 열지 못했어요. 위의 "새 창에서 원본 PDF 열기"를 눌러 주세요.</p>';
    }
  }
  function closePdf(box){
    if (box._io) box._io.disconnect();
    if (box._doc) box._doc.destroy();
    box._io = box._doc = null; box.dataset.state = ''; box.innerHTML = '';
  }
  function opened(d){
    d.querySelectorAll('img[data-src]').forEach(function(im){ if (!im.getAttribute('src')) im.src = im.dataset.src; });
    var box = d.querySelector('.lg-pdf'); if (box) showPdf(box);
  }

  async function loadAll(){
    if (!P || !P.sb) { err = '서버에 연결하지 못했어요.'; render(); return; }
    var r = await P.sb.from('logs').select('*');
    if (r.error) { err = P.msg(r.error); render(); return; }
    LOGS = r.data; loaded = true; err = '';
    if (P.isPL()) ADULT = [];
    else if (adultPw !== null) { try { await loadAdult(adultPw); } catch (x) {} }
    render();
  }
  async function loadAdult(pw){
    var r = await P.sb.rpc('adult_logs', { pw: pw });
    if (r.error) throw r.error;
    ADULT = r.data;
  }

  document.addEventListener('click', async function(e){
    var t = e.target;
    var allBtn = t.closest('#panel-hero [data-lgall]');
    if (allBtn) {
      var on = allBtn.dataset.lgall === '1';
      document.querySelectorAll('#lgView details').forEach(function(d){
        if (d.classList.contains('lg-log') && on) return;          /* '모두 펼치기'는 묶음만 (PDF를 한꺼번에 열지 않게) */
        d.open = on; if (d.dataset.g) openGroups[d.dataset.g] = on;
      });
      return;
    }
    var del = t.closest('#lgView [data-lgdel]');
    if (del) {
      var l = all().find(function(x){ return x.id === +del.dataset.lgdel; });
      if (!confirm('로그 「' + (l.fold_text || l.title) + '」을(를) 지울까요? 되돌릴 수 없어요.')) return;
      var r = await P.sb.from('logs').delete().eq('id', l.id);
      if (r.error) { alert(P.msg(r.error)); return; }
      var files = (l.image_paths || []).concat(l.pdf_path ? [l.pdf_path] : []);
      if (files.length) await P.sb.storage.from('media').remove(files);
      loadAll(); return;
    }
    if (t.closest('#tvPick')) { $('tvFile').click(); return; }
    if (t.closest('#tvReset')) { setTv(null); return; }
  });
  document.addEventListener('toggle', function(e){
    var d = e.target; if (!d.closest || !d.closest('#lgView')) return;
    if (d.classList.contains('lg-group')) openGroups[d.dataset.g] = d.open;
    if (d.classList.contains('lg-log')) { if (d.open) opened(d); else { var b = d.querySelector('.lg-pdf'); if (b) closePdf(b); } }
  }, true);
  document.addEventListener('submit', async function(e){
    if (e.target.id !== 'lgLock') return;
    e.preventDefault();
    var b = e.target.querySelector('button'); b.disabled = true;
    try { var pw = $('lgPw').value; await loadAdult(pw); adultPw = pw; openGroups.adult = true; render(); }
    catch (x) { $('lgLErr').textContent = P.msg(x); b.disabled = false; }
  });

  function mount(){
    var tf = $('tvFile');
    if (tf) tf.addEventListener('change', async function(){
      var file = tf.files[0]; tf.value = ''; if (!file) return;
      $('tvMsg').textContent = '올리는 중…';
      try { var c = await P.compressImage(file, 1280); var path = await P.uploadImage(c.blob, c.ext, 'tv'); await setTv(path); }
      catch (x) { $('tvMsg').textContent = P.msg(x); }
    });
    render();
    var lastPL = null;
    P.onAuth(function(){ var pl = P.isPL(); if (pl !== lastPL) { lastPL = pl; loadAll(); } });
    if (P.offline) { err = '서버에 연결하지 못했어요.'; render(); }
  }

  /* ---------- TV 화면 그림 ---------- */
  async function setTv(path){
    var old = await P.sb.from('settings').select('value').eq('key', 'tv_image').maybeSingle();
    var r = await P.sb.from('settings').upsert({ key: 'tv_image', value: path ? { path: path } : null });
    if (r.error) { $('tvMsg').textContent = P.msg(r.error); if (path) P.sb.storage.from('media').remove([path]); return; }
    var oldPath = old.data && old.data.value && old.data.value.path;
    if (oldPath && oldPath !== path) P.sb.storage.from('media').remove([oldPath]);
    var G = window.GM635; if (G && G.engine && G.engine.setTvImage) G.engine.setTvImage(path ? P.mediaUrl(path) : null);
    $('tvMsg').textContent = path ? 'TV 화면을 바꿨어요. 모든 방문자에게 보여요.' : 'TV를 원래 화면으로 돌렸어요.';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
