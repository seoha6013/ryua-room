/* 액자 = 그림 백업. 서버(artworks)에서 그림을 불러와 HO1 PL / HO2 PL 탭으로 보여 줌.
   달마다 묶음(접기/펼치기) → 그림 카드(접기/펼치기) → 큰 그림 + 댓글.
   펼친 그림은 방 안 액자에도 걸림. 성인 그림은 PL이거나 성인 비번을 넣었을 때만 보임. */
(function(){
  'use strict';
  var P = window.PUBAM;
  var css = document.createElement('style');
  css.textContent =
    '.ag-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin:18px 0 12px}' +
    '.ag-tabs{display:inline-flex;gap:8px}' +
    '.ag-tab{min-height:44px;padding:0 16px;border-radius:16px;border:1.5px solid var(--ink);background:var(--t,#fff);font:800 14px Nunito,"Gowun Dodum",sans-serif;cursor:pointer;color:var(--ink)}' +
    '.ag-tab[aria-selected="true"]{transform:translateY(-2px);box-shadow:0 3px 0 var(--ink)}' +
    '.ag-tools{display:flex;gap:6px}' +
    '.ag-sm{min-height:38px;padding:0 12px;border-radius:999px;border:1.5px solid #D9D5E3;background:#fff;font:700 13px Nunito,"Gowun Dodum",sans-serif;cursor:pointer;color:var(--ink)}' +
    '.ag-sm:hover{border-color:var(--ink)}' +
    '.ag-group{border:1.5px solid #D9D5E3;border-radius:20px;margin:0 0 10px;background:var(--gb,#fff)}' +
    '.ag-group>summary,.ag-art>summary{list-style:none;cursor:pointer}' +
    '.ag-group>summary::-webkit-details-marker,.ag-art>summary::-webkit-details-marker{display:none}' +
    '.ag-group>summary{display:flex;align-items:center;gap:10px;min-height:52px;padding:8px 16px;font:900 16px Nunito,"Gowun Dodum",sans-serif}' +
    '.ag-group>summary span{flex:1}' +
    '.ag-n{font:800 12px Nunito,sans-serif;color:var(--ink-3);background:#fff;border:1px solid #D9D5E3;border-radius:999px;padding:1px 9px}' +
    '.ag-chev{width:18px;height:18px;flex:none;transition:transform .3s var(--spring,ease)}' +
    'details[open]>summary .ag-chev{transform:rotate(90deg)}' +
    '.ag-list{display:flex;flex-direction:column;gap:8px;padding:0 10px 10px}' +
    '.ag-art{background:#fff;border:1px solid #D9D5E3;border-radius:16px}' +
    '.ag-art>summary{display:grid;grid-template-columns:56px 1fr;gap:2px 12px;align-items:center;padding:8px 10px;border-radius:16px}' +
    '.ag-art>summary:hover{background:var(--lav-fill)}' +
    '.ag-art>summary img{grid-row:span 2;width:56px;height:56px;border-radius:12px;object-fit:cover;background:var(--lav-fill)}' +
    '.ag-art>summary b{font:800 15px/1.35 Nunito,"Gowun Dodum",sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.ag-art>summary small{font:700 12px/1.4 Nunito,"Gowun Dodum",sans-serif;color:var(--ink-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.ag-who{display:inline-block;font:800 10px Nunito,sans-serif;padding:1px 7px;margin-right:5px;border-radius:999px;background:var(--lav-fill);vertical-align:2px}' +
    '.ag-body h3.ag-title{margin:8px 0 2px;font:900 16px Nunito,"Gowun Dodum",sans-serif}' +
    '.ag-body{padding:4px 12px 14px;border-top:1px dashed #D9D5E3;margin:0 10px}' +
    '.ag-body .ag-full{display:block;margin:10px 0 6px}' +
    '.ag-body .ag-full img{display:block;width:100%;height:auto;max-height:70vh;object-fit:contain;border-radius:14px;background:var(--lav-fill)}' +
    '.panel .ag-body p.ag-cap{font-size:15px;margin:4px 0 8px;color:var(--ink-2)}' +
    '.ag-body h3{margin:12px 0 6px;font:900 14px Nunito,"Gowun Dodum",sans-serif}' +
    '.ag-cl{list-style:none;margin:0 0 8px;padding:0;display:flex;flex-direction:column;gap:6px}' +
    '.ag-cl li{position:relative;background:var(--lav-fill);border-radius:14px 14px 14px 4px;padding:7px 36px 7px 12px;font-size:14px;line-height:1.55;word-break:break-word}' +
    '.ag-cl li b{font-weight:800;margin-right:6px}' +
    '.ag-cl .ag-none{background:none;padding:0;color:var(--ink-3)}' +
    '.ag-cdel{display:none;position:absolute;right:6px;top:5px;width:26px;height:26px;border-radius:50%;border:1px solid #D9D5E3;background:#fff;cursor:pointer;line-height:1}' +
    'html.is-pl .ag-cdel{display:block}' +
    '.ag-cf{display:flex;flex-wrap:wrap;gap:6px}' +
    '.ag-cf input{min-height:42px;border:1.5px solid #D9D5E3;border-radius:12px;padding:0 10px;font:16px Nunito,"Gowun Dodum",sans-serif;background:#fff}' +
    '.ag-cf .n{flex:0 1 96px}.ag-cf .t{flex:1 1 160px}' +
    '.ag-cf button{min-height:42px;padding:0 14px;border-radius:12px;border:1.5px solid var(--ink);background:var(--ink);color:#fff;font:800 14px Nunito,"Gowun Dodum",sans-serif;cursor:pointer}' +
    '.ag-pl{display:none;gap:6px;margin-top:10px}' +
    'html.is-pl .ag-pl{display:flex}' +
    '.ag-pl a,.ag-pl button{text-decoration:none;color:var(--ink)}' +
    '.ag-lock{margin-top:12px;padding:12px 14px;border:1.5px dashed var(--ink-3);border-radius:16px;background:var(--blush-fill)}' +
    '.panel .ag-lock p{font-size:14px;margin:0 0 8px}' +
    '.ag-lock form{display:flex;gap:6px;flex-wrap:wrap}' +
    '.ag-lock input{min-height:42px;border:1.5px solid var(--ink);border-radius:12px;padding:0 12px;font-size:16px;flex:1 1 140px}' +
    '.ag-lock button{min-height:42px;padding:0 16px;border-radius:12px;border:1.5px solid var(--ink);background:var(--ink);color:#fff;font-weight:800;cursor:pointer}' +
    '.ag-lock .ag-lerr{color:#B3261E;font-size:13px;margin:6px 0 0;min-height:1em}' +
    '.panel p.ag-empty{color:var(--ink-3);text-align:center;padding:24px 0;font-size:15px}' +
    '.ag-up{display:none;margin-top:14px}' +
    'html.is-pl .ag-up{display:block}';
  document.head.appendChild(css);

  var ARTS = [], ADULT = [], comments = {}, tab = 'ho1', adultPw = null, loaded = false, err = '';
  var openGroups = {};
  var chev = '<svg class="ag-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  function esc(s){ return P.esc(s == null ? '' : s); }
  function url(p){ return P.sb.storage.from('media').getPublicUrl(p).data.publicUrl; }
  function dayOf(a){ return a.drawn_on || a.created_at.slice(0, 10); }
  function all(){ return ARTS.concat(ADULT.filter(function(a){ return !ARTS.some(function(x){ return x.id === a.id; }); })); }
  function $(id){ return document.getElementById(id); }

  /* ---------- 방 안 액자에 그림 걸기 ---------- */
  function hang(a, img){
    var G = window.GM635, tries = 0;
    function go(){
      if (!(G && G.engine)) { if (++tries < 40) setTimeout(go, 250); return; }
      if (!img) { img = new Image(); img.crossOrigin = 'anonymous'; img.src = url(a.image_path); }
      if (img.complete && img.naturalWidth) G.engine.ripple('art' + a.id, 0.5, 0.5, img);
      else img.addEventListener('load', function(){ G.engine.ripple('art' + a.id, 0.5, 0.5, img); }, { once: true });
    }
    go();
  }

  /* ---------- 그리기 ---------- */
  function pagesOf(a){ return a.pages && a.pages.length ? a.pages : (a.image_path ? [a.image_path] : []); }
  function isComic(a){ return a.kind === 'comic' && pagesOf(a).length > 1; }
  function commentsHTML(a){
    var c = comments[a.id] || [];
    return '<h3>댓글 ' + c.length + '</h3>' +
      '<ul class="ag-cl">' + (c.length ? c.map(function(x){
        return '<li><b>' + esc(x.name) + '</b>' + esc(x.body) + (x.id ? '<button class="ag-cdel" type="button" data-cdel="' + x.id + '" aria-label="댓글 지우기">×</button>' : '') + '</li>';
      }).join('') : '<li class="ag-none">첫 댓글을 남겨 보세요.</li>') + '</ul>' +
      '<form class="ag-cf" data-id="' + a.id + '">' +
        '<label style="position:absolute;left:-9999px" for="agn-' + a.id + '">이름</label><input class="n" id="agn-' + a.id + '" name="name" placeholder="이름" maxlength="20" required>' +
        '<label style="position:absolute;left:-9999px" for="agt-' + a.id + '">댓글</label><input class="t" id="agt-' + a.id + '" name="text" placeholder="한마디 남기기" maxlength="300" required>' +
        '<button type="submit">남기기</button></form>';
  }
  function artHTML(a){
    var c = comments[a.id] || [];
    var who = tab === 'adult' ? '<span class="ag-who">' + a.author.toUpperCase() + '</span>' : '';
    /* 만화: 표지 한 칸. 누르면 카드뉴스 보기 화면 */
    if (isComic(a)) {
      return '<div class="ag-art" id="ag-' + a.id + '" data-id="' + a.id + '"><button type="button" class="ag-comic" data-comic="' + a.id + '" aria-label="그림 보기: ' + esc(a.fold_text || a.title || '제목 없음') + ', ' + pagesOf(a).length + '장">' +
        '<span class="ag-cover"><img src="' + esc(url(a.image_path)) + '" crossorigin="anonymous" alt="" loading="lazy"><i class="ag-badge">' + pagesOf(a).length + '장</i></span>' +
        '<b>' + who + esc(a.fold_text || a.title || '제목 없음') + '</b>' +
        '<small>' + dayOf(a).replace(/-/g, '.') + ' · 댓글 ' + c.length + ' · 눌러서 넘겨 보기</small></button></div>';
    }
    return '<details class="ag-art" id="ag-' + a.id + '" data-id="' + a.id + '">' +
      /* 접었을 때: 올린 사람이 정한 문구(비우면 제목) + 작은 날짜 */
      '<summary><img src="' + esc(url(a.image_path)) + '" crossorigin="anonymous" alt="" loading="lazy">' +
        '<b>' + who + esc(a.fold_text || a.title || '제목 없음') + '</b>' +
        '<small>' + dayOf(a).replace(/-/g, '.') + ' · 댓글 ' + c.length + '</small></summary>' +
      '<div class="ag-body">' +
        '<a class="ag-full" href="' + esc(url(a.image_path)) + '" target="_blank" rel="noopener"><img data-src="' + esc(url(a.image_path)) + '" crossorigin="anonymous" alt="' + esc(a.title || '그림') + '"></a>' +
        (a.title ? '<h3 class="ag-title">' + esc(a.title) + '</h3>' : '') +
        (a.caption ? '<p class="ag-cap">' + esc(a.caption) + '</p>' : '') +
        commentsHTML(a) +
        '<div class="ag-pl"><a class="ag-sm" href="upload.html#edit-art=' + a.id + '">수정</a><button class="ag-sm" type="button" data-adel="' + a.id + '">삭제</button></div>' +
      '</div></details>';
  }
  function render(){
    var view = $('agView'); if (!view) return;
    document.querySelectorAll('.ag-tab').forEach(function(b){ b.setAttribute('aria-selected', b.dataset.ag === tab ? 'true' : 'false'); });
    if (!loaded) { view.innerHTML = '<p class="ag-empty">' + (err || '그림을 불러오는 중…') + '</p>'; return; }
    /* 성인 탭: 성인 비번으로 잠김 (PL은 바로). 성인 그림은 HO1·HO2 탭에는 안 나옴 */
    if (tab === 'adult' && !P.isPL() && adultPw === null) {
      view.innerHTML = '<div class="ag-lock"><p>성인 그림이 들어 있어요. 성인 비밀번호를 넣으면 열려요.</p><form id="agLock"><label style="position:absolute;left:-9999px" for="agPw">성인 비밀번호</label><input id="agPw" type="password" placeholder="성인 비밀번호" autocomplete="off" required><button type="submit">열기</button></form><p class="ag-lerr" id="agLErr" role="alert"></p></div>';
      return;
    }
    var list = all().filter(function(a){ return tab === 'adult' ? a.is_adult : (a.author === tab && !a.is_adult); })
      .sort(function(x, y){ return dayOf(y) < dayOf(x) ? -1 : dayOf(y) > dayOf(x) ? 1 : y.id - x.id; });
    /* 달마다 묶기 (최근 달이 위) */
    var groups = [], idx = {};
    list.forEach(function(a){
      var k = dayOf(a).slice(0, 7);
      if (!(k in idx)) { idx[k] = groups.length; groups.push({ k: k, items: [] }); }
      groups[idx[k]].items.push(a);
    });
    var html = groups.map(function(g, gi){
      var gid = tab + '-' + g.k, open = gid in openGroups ? openGroups[gid] : gi === 0;
      return '<details class="ag-group" data-g="' + gid + '"' + (open ? ' open' : '') + ' style="--gb:' + (gi % 2 ? 'var(--lav-fill)' : 'color-mix(in oklab,var(--blush) 30%,#fff)') + '">' +
        '<summary>' + chev + '<span>' + g.k.replace('-', '년 ') + '월</span><i class="ag-n">' + g.items.length + '</i></summary>' +
        '<div class="ag-list">' + g.items.map(artHTML).join('') + '</div></details>';
    }).join('');
    if (!html) html = '<p class="ag-empty">' + (tab === 'adult' ? '아직 성인 그림이 없어요.' : '아직 ' + tab.toUpperCase() + ' PL의 그림이 없어요.') + '</p>';
    var open = [].map.call(view.querySelectorAll('.ag-art[open]'), function(d){ return d.id; });
    view.innerHTML = html;
    open.forEach(function(id){ var d = $(id); if (d) { d.open = true; loadFull(d); } });
  }
  function loadFull(d){
    var im = d.querySelector('.ag-full img');
    if (im && !im.getAttribute('src')) im.src = im.dataset.src;
    return im;
  }

  /* ---------- 서버 ---------- */
  async function loadAll(){
    if (!P || !P.sb) { err = '서버에 연결하지 못했어요.'; render(); return; }
    var r = await Promise.all([
      P.sb.from('artworks').select('*'),
      P.sb.from('comments').select('id,target_id,name,body,created_at').eq('target_type', 'artwork').order('created_at')
    ]);
    var e = r[0].error || r[1].error;
    if (e) { err = P.msg(e); render(); return; }
    loaded = true; err = '';
    ARTS = r[0].data;
    ADULT = P.isPL() ? [] : ADULT;
    comments = {};
    r[1].data.forEach(function(c){ (comments[c.target_id] = comments[c.target_id] || []).push(c); });
    if (!P.isPL() && adultPw !== null) { try { await loadAdult(adultPw); } catch (x) {} }
    render();
    /* 처음엔 PL이 고른 액자 사진(settings 'frame_image'), 없으면 가장 최근 그림을 걸어 둠 */
    if (!hung) { hung = true; hangDefault(); }
  }
  var hung = false;
  function latestArt(){
    return ARTS.filter(function(a){ return !a.is_adult; }).sort(function(x, y){ return dayOf(y) < dayOf(x) ? -1 : 1; })[0];
  }
  async function hangDefault(){
    var p = null;
    try { var r = await P.sb.from('settings').select('value').eq('key', 'frame_image').maybeSingle(); p = r.data && r.data.value && r.data.value.path; } catch (x) {}
    if (p) { hang({ id: 'frame:' + p, image_path: p }); return; }
    var first = latestArt(); if (first) hang(first);
  }

  /* ---------- 액자 사진 고르기 (PL) ---------- */
  async function setFrame(path){
    var old = await P.sb.from('settings').select('value').eq('key', 'frame_image').maybeSingle();
    var r = await P.sb.from('settings').upsert({ key: 'frame_image', value: path ? { path: path } : null });
    if (r.error) { $('frameMsg').textContent = P.msg(r.error); if (path) P.sb.storage.from('media').remove([path]); return; }
    var oldPath = old.data && old.data.value && old.data.value.path;
    if (oldPath && oldPath !== path) P.sb.storage.from('media').remove([oldPath]);
    if (path) hang({ id: 'frame:' + path, image_path: path });
    else { var first = latestArt(); if (first) hang(first); }
    $('frameMsg').textContent = path ? '액자 사진을 바꿨어요. 모든 방문자에게 보여요.' : '액자를 가장 최근 그림으로 돌렸어요.';
  }
  document.addEventListener('click', function(e){
    if (!e.target.closest) return;
    if (e.target.closest('#framePick')) $('frameFile').click();
    else if (e.target.closest('#frameReset')) setFrame(null);
  });
  document.addEventListener('change', async function(e){
    var ff = e.target; if (ff.id !== 'frameFile') return;
    var file = ff.files[0]; ff.value = ''; if (!file) return;
    $('frameMsg').textContent = '올리는 중…';
    try { var c = await P.compressImage(file, 1600); var path = await P.uploadImage(c.blob, c.ext, 'frame'); await setFrame(path); }
    catch (x) { $('frameMsg').textContent = P.msg(x); }
  });
  async function loadAdult(pw){
    var r = await Promise.all([P.sb.rpc('adult_artworks', { pw: pw }), P.sb.rpc('adult_art_comments', { pw: pw })]);
    if (r[0].error) throw r[0].error;
    ADULT = r[0].data;
    (r[1].data || []).forEach(function(c){ var l = comments[c.target_id] = comments[c.target_id] || []; if (!l.some(function(x){ return x.id === c.id; })) l.push(c); });
  }

  /* =========================================================
     만화 보기 (카드뉴스): 옆으로 넘기기 ↔ 세로로 이어 보기
     ========================================================= */
  var cvCss = document.createElement('style');
  cvCss.textContent =
    /* 목록의 만화 한 칸 */
    '.ag-comic{all:unset;box-sizing:border-box;display:grid;grid-template-columns:72px 1fr;gap:2px 12px;align-items:center;width:100%;padding:8px 10px;border-radius:16px;cursor:pointer}' +
    '.ag-comic:hover{background:var(--lav-fill)}.ag-comic:focus-visible{outline:3px solid var(--ink);outline-offset:2px}' +
    '.ag-cover{grid-row:span 2;position:relative;width:72px;height:72px}' +
    '.ag-cover img{width:72px;height:72px;border-radius:12px;object-fit:cover;background:var(--lav-fill);display:block}' +
    '.ag-badge{position:absolute;left:-4px;bottom:-6px;font:900 10px/1 Nunito,"Gowun Dodum",sans-serif;font-style:normal;color:#fff;background:#5565AA;border:1.5px solid #fff;border-radius:999px;padding:4px 7px;white-space:nowrap;box-shadow:0 2px 0 rgba(31,27,36,.25)}' +
    '.ag-comic b{font:800 15px/1.35 Nunito,"Gowun Dodum",sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink)}' +
    '.ag-comic small{font:700 12px/1.4 Nunito,"Gowun Dodum",sans-serif;color:var(--ink-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}';
  document.head.appendChild(cvCss);

  /* 묶음 크게 보기: 공통 보기 화면(js/viewer.js)을 씀 */
  function VW(){ return window.PUBAM_VIEWER; }
  var viewingId = null;
  function underHTML(a){
    return (a.title ? '<h2>' + esc(a.title) + '</h2>' : '') + (a.caption ? '<p class="cap">' + esc(a.caption) + '</p>' : '') +
      '<p class="cap" style="font-size:13px">' + dayOf(a).replace(/-/g, '.') + ' · ' + a.author.toUpperCase() + ' PL · ' + pagesOf(a).length + '장</p>' +
      VW().reactHTML() + commentsHTML(a) +
      '<div class="ag-pl"><a class="ag-sm" href="upload.html#edit-art=' + a.id + '">수정</a><button class="ag-sm" type="button" data-adel="' + a.id + '">삭제</button></div>';
  }
  function openComic(a){
    viewingId = a.id;
    VW().open({
      key: 'art:' + a.id, title: a.fold_text || a.title || '그림', urls: pagesOf(a).map(url),
      react: { type: 'artwork', id: a.id },
      under: function(){ return underHTML(all().find(function(x){ return x.id === a.id; }) || a); },
      onClose: function(){ viewingId = null; }
    });
    hang(a);
  }
  function closeComic(){ if (viewingId != null) VW().close(); }
  /* ---------- 이벤트 ---------- */
  document.addEventListener('click', async function(e){
    var cb = e.target.closest('#agView [data-comic]');
    if (cb) { var ca = all().find(function(x){ return x.id === +cb.dataset.comic; }); if (ca) openComic(ca); return; }
    var t = e.target.closest('#panel-gallery [data-ag]');
    if (t) { tab = t.dataset.ag; render(); return; }
    var all_ = e.target.closest('#panel-gallery [data-agall]');
    if (all_) {
      var on = all_.dataset.agall === '1';
      document.querySelectorAll('#agView details').forEach(function(d){ d.open = on; if (d.dataset.g) openGroups[d.dataset.g] = on; });
      return;
    }
    var cd = e.target.closest('#agView [data-cdel], #cv [data-cdel]');
    if (cd) {
      if (!confirm('이 댓글을 지울까요?')) return;
      var r = await P.sb.from('comments').delete().eq('id', +cd.dataset.cdel);
      if (r.error) alert(P.msg(r.error)); else { await loadAll(); refreshViewer(); }
      return;
    }
    var ad = e.target.closest('#agView [data-adel], #cv [data-adel]');
    if (ad) {
      var a = all().find(function(x){ return x.id === +ad.dataset.adel; });
      var pg = pagesOf(a);
      if (!confirm(isComic(a) ? '「' + (a.title || '제목 없음') + '」(' + pg.length + '장 전부)을(를) 지울까요? 되돌릴 수 없어요.' : '그림 「' + (a.title || '제목 없음') + '」을(를) 지울까요? 되돌릴 수 없어요.')) return;
      var d = await P.sb.from('artworks').delete().eq('id', a.id);
      if (d.error) { alert(P.msg(d.error)); return; }
      await P.sb.storage.from('media').remove(pg.concat(pg.indexOf(a.image_path) < 0 && a.image_path ? [a.image_path] : []));
      await P.sb.from('comments').delete().eq('target_type', 'artwork').eq('target_id', a.id);
      closeComic(); loadAll();
    }
  });
  /* 펼칠 때: 큰 그림 불러오고 방 안 액자에 걸기 */
  document.addEventListener('toggle', function(e){
    var d = e.target;
    if (!d.closest || !d.closest('#agView')) return;
    if (d.classList.contains('ag-group')) { openGroups[d.dataset.g] = d.open; return; }
    if (d.classList.contains('ag-art') && d.open) {
      var a = all().find(function(x){ return x.id === +d.dataset.id; });
      var im = loadFull(d);
      if (a && im) hang(a, im);
    }
  }, true);
  document.addEventListener('submit', async function(e){
    var f = e.target;
    if (f.id === 'agLock') {
      e.preventDefault();
      var pw = $('agPw').value, b = f.querySelector('button'); b.disabled = true;
      try { await loadAdult(pw); adultPw = pw; render(); }
      catch (x) { $('agLErr').textContent = P.msg(x); b.disabled = false; }
      return;
    }
    if (!f.classList.contains('ag-cf')) return;
    e.preventDefault();
    var id = +f.dataset.id, name = f.name.value.trim(), text = f.text.value.trim();
    if (!name || !text) return;
    var btn = f.querySelector('button'); btn.disabled = true;
    var r = await P.sb.from('comments').insert({ target_type: 'artwork', target_id: id, name: name, body: text });
    btn.disabled = false;
    if (r.error) { alert(P.msg(r.error)); return; }
    var art = all().find(function(x){ return x.id === id; });
    if (P.isPL() || !art.is_adult) { await loadAll(); }
    else { (comments[id] = comments[id] || []).push({ id: 0, target_id: id, name: name, body: text }); render(); }
    if (viewingId === id) { refreshViewer(); var vn = document.querySelector('#cv .ag-cf .n'); if (vn) vn.value = name; return; }
    var el = $('ag-' + id); if (el && el.tagName === 'DETAILS') { el.open = true; loadFull(el); var n = el.querySelector('.ag-cf .n'); if (n) n.value = name; }
  });

  /* 댓글을 달거나 지운 뒤: 보기 화면의 아래쪽만 새로 */
  function refreshViewer(){ if (viewingId != null) VW().refresh(); }

  var lastPL = null;
  function start(){
    render();
    P.onAuth(function(){ var pl = P.isPL(); if (pl !== lastPL) { lastPL = pl; loadAll(); } });
    if (P.offline) { err = '서버에 연결하지 못했어요.'; render(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
