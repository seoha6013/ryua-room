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
      return '<div class="ag-art" id="ag-' + a.id + '" data-id="' + a.id + '"><button type="button" class="ag-comic" data-comic="' + a.id + '" aria-label="만화 보기: ' + esc(a.fold_text || a.title || '제목 없음') + ', ' + pagesOf(a).length + '장">' +
        '<span class="ag-cover"><img src="' + esc(url(a.image_path)) + '" crossorigin="anonymous" alt="" loading="lazy"><i class="ag-badge">만화 · ' + pagesOf(a).length + '장</i></span>' +
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
    /* 처음엔 가장 최근 그림을 액자에 걸어 둠 */
    var first = ARTS.filter(function(a){ return !a.is_adult; }).sort(function(x, y){ return dayOf(y) < dayOf(x) ? -1 : 1; })[0];
    if (first && !hung) { hung = true; hang(first); }
  }
  var hung = false;
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
    '.ag-comic small{font:700 12px/1.4 Nunito,"Gowun Dodum",sans-serif;color:var(--ink-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    /* 보기 화면 */
    '.cv{position:fixed;inset:0;z-index:200;background:#F7F6FB;display:flex;flex-direction:column;font:15px/1.6 Nunito,"Gowun Dodum",system-ui,sans-serif;color:#1F1B24}' +
    '.cv[hidden]{display:none}' +
    '.cv-top{flex:none;display:flex;align-items:center;gap:8px;padding:10px 12px;padding-top:max(10px,env(safe-area-inset-top));background:#fff;border-bottom:1px solid #E3DFEC;z-index:2}' +
    '.cv-top b{flex:1;font:900 16px Nunito,"Gowun Dodum",sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.cv-count{font:900 14px Nunito,sans-serif;color:#4A4552;white-space:nowrap}' +
    '.cv-btn{min-height:40px;padding:0 12px;border-radius:999px;border:1.5px solid #D9D5E3;background:#fff;font:800 13px Nunito,"Gowun Dodum",sans-serif;cursor:pointer;white-space:nowrap}' +
    '.cv-btn:hover{border-color:#1F1B24}' +
    '.cv-x{width:44px;height:44px;flex:none;border-radius:50%;border:1.5px solid #1F1B24;background:#fff;font:900 18px Nunito,sans-serif;cursor:pointer;box-shadow:0 2px 0 #1F1B24}' +
    '.cv-scroll{flex:1;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}' +
    '.cv-stage{position:relative;transition:transform .2s,opacity .2s}' +
    '.cv{--cvh:calc(100dvh - 128px)}' +
    '.cv-track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;height:var(--cvh);overscroll-behavior-x:contain}' +
    '.cv-track::-webkit-scrollbar{display:none}' +
    /* 한 장이 화면 안에 통째로 보이게: 장 칸 = 보기 칸 크기, 그림은 비율 그대로 그 안에 맞춤 */
    '.cv-slide{flex:0 0 100%;width:100%;height:var(--cvh);box-sizing:border-box;padding:8px;scroll-snap-align:center;scroll-snap-stop:always;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}' +
    '.cv-slide img{width:auto;height:auto;max-width:100%;max-height:calc(var(--cvh) - 16px);object-fit:contain;display:block;user-select:none;-webkit-user-drag:none;background:#fff;box-shadow:0 2px 14px -6px rgba(31,27,36,.35)}' +
    '.cv-slide.zoom{display:block;overflow:auto;touch-action:pan-x pan-y}' +
    '.cv-slide.zoom img{max-width:none;max-height:none;width:200%;cursor:zoom-out}' +
    '.cv-end{flex-direction:column;gap:14px;text-align:center}' +
    '.cv-end p{margin:0;font:900 18px Nunito,"Gowun Dodum",sans-serif}' +
    '.cv-end button{min-height:50px;padding:0 26px;border-radius:999px;border:1.5px solid #2E3870;background:#5565AA;color:#fff;font:900 16px Nunito,"Gowun Dodum",sans-serif;cursor:pointer;box-shadow:0 3px 0 #2E3870}' +
    '.cv-nav{position:absolute;top:50%;transform:translateY(-50%);width:52px;height:52px;border-radius:50%;border:1.5px solid #1F1B24;background:rgba(255,255,255,.92);font:900 26px/1 Nunito,sans-serif;cursor:pointer;box-shadow:0 3px 0 #1F1B24;z-index:2}' +
    '.cv-nav:disabled{opacity:.25;cursor:default}' +
    '.cv-nav.prev{left:14px}.cv-nav.next{right:14px}' +
    '.cv-dots{display:flex;flex-wrap:wrap;justify-content:center;gap:2px;padding:8px 12px 4px;max-width:720px;margin:0 auto}' +
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
    '.cv-under .ag-cl li{background:#fff}' +
    /* 세로로 이어 보기 (웹툰처럼) */
    '.cv.vert .cv-track{display:block;overflow:visible;height:auto;scroll-snap-type:none}' +
    '.cv.vert .cv-slide{display:block;height:auto;padding:0;overflow-x:auto;scroll-snap-align:none}' +
    '.cv.vert .cv-slide img{width:min(100%,860px);max-height:none;margin:0 auto;box-shadow:none}' +
    '.cv.vert .cv-slide.zoom img{width:200%;max-width:none}' +
    '.cv.vert .cv-end{display:flex;padding:30px 0}' +
    '.cv.vert .cv-nav,.cv.vert .cv-dots{display:none}' +
    '@media (max-width:600px){.cv-top{gap:6px;padding:8px}.cv-btn{padding:0 10px;font-size:12px;min-height:38px}.cv-x{width:48px;height:48px}.cv-nav{display:none}.cv{--cvh:calc(100dvh - 120px)}.cv-top b{font-size:14px}}';
  document.head.appendChild(cvCss);

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
  var V = { art: null, i: 0, n: 0, vert: false, back: null, react: {} };
  var REACTS = ['❤️', '😭', '👍', '🤣'];
  var mineR = (function(){ try { return JSON.parse(localStorage.getItem('pubam-reacted') || '{}'); } catch (e) { return {}; } })();
  function q(id){ return cv.querySelector('#' + id); }
  function slides(){ return [].slice.call(q('cvTrack').querySelectorAll('.cv-slide[data-i]')); }
  function want(i){   /* 지금 장과 앞뒤 장은 미리 불러 둠 */
    slides().forEach(function(s){ var k = +s.dataset.i, im = s.querySelector('img'); if (Math.abs(k - i) <= 2 && !im.getAttribute('src')) im.src = im.dataset.src; });
  }
  function setIdx(i){
    if (V.goal != null && i === V.goal) V.goal = null;   /* 넘기는 중이던 장에 도착 */
    V.i = Math.max(0, Math.min(V.n - 1, i));
    q('cvCount').textContent = (V.i + 1) + ' / ' + V.n;
    [].forEach.call(q('cvDots').children, function(b, k){ b.setAttribute('aria-current', k === V.i ? 'true' : 'false'); });
    q('cvPrev').disabled = V.i === 0;
    want(V.i);
  }
  function go(i, smooth){
    var t = q('cvTrack');
    if (V.vert) { var s = slides()[Math.max(0, Math.min(V.n - 1, i))]; if (s) s.scrollIntoView({ block: 'start', behavior: smooth === false ? 'auto' : 'smooth' }); return; }
    V.goal = Math.max(0, Math.min(V.n, i));
    t.scrollTo({ left: V.goal * t.clientWidth, behavior: smooth === false || Bus().reduced ? 'auto' : 'smooth' });
  }
  /* 넘기는 도중에 또 누르면 가던 장 기준으로 (빠르게 여러 번 눌러도 안 놓침) */
  function step(d){ go((V.goal != null ? V.goal : V.i) + d); }
  function Bus(){ return window.GM635 || {}; }
  function unzoom(){ cv.querySelectorAll('.cv-slide.zoom').forEach(function(s){ s.classList.remove('zoom'); }); q('cvZoom').textContent = '＋ 확대'; }
  function toggleZoom(slide){
    slide = slide || slides()[V.i]; if (!slide) return;
    var on = !slide.classList.contains('zoom'); unzoom();
    if (on) { slide.classList.add('zoom'); q('cvZoom').textContent = '－ 원래대로'; }
  }
  function setMode(vert){
    V.vert = vert; unzoom();
    cv.classList.toggle('vert', vert);
    q('cvMode').textContent = vert ? '↔ 옆으로 넘기기' : '↕ 세로로 이어 보기';
    try { localStorage.setItem('pubam-comic-mode', vert ? 'v' : 'h'); } catch (e) {}   /* 마지막으로 고른 방식 기억 */
    if (vert) slides().forEach(function(s){ var im = s.querySelector('img'); im.loading = 'lazy'; if (!im.getAttribute('src')) im.src = im.dataset.src; });
    var keep = V.i; setTimeout(function(){ go(keep, false); setIdx(keep); }, 30);
  }
  async function loadReacts(){
    var r = await P.sb.rpc('reaction_counts', { p_type: 'artwork' });
    V.react = {};
    (r.data || []).forEach(function(x){ if (x.target_id === V.art.id) V.react[x.emoji] = Number(x.n); });
    renderUnder();
  }
  function renderUnder(){
    var a = V.art; if (!a) return;
    q('cvUnder').innerHTML =
      (a.title ? '<h2>' + esc(a.title) + '</h2>' : '') + (a.caption ? '<p class="cap">' + esc(a.caption) + '</p>' : '') +
      '<p class="cap" style="font-size:13px">' + dayOf(a).replace(/-/g, '.') + ' · ' + a.author.toUpperCase() + ' PL · ' + V.n + '장</p>' +
      '<div class="cv-react" role="group" aria-label="반응">' + REACTS.map(function(e){
        return '<button type="button" data-cvr="' + e + '" aria-pressed="' + !!mineR['artwork:' + a.id + ':' + e] + '">' + e + ' <span>' + (V.react[e] || 0) + '</span></button>';
      }).join('') + '</div>' +
      commentsHTML(a) +
      '<div class="ag-pl"><a class="ag-sm" href="upload.html#edit-art=' + a.id + '">수정</a><button class="ag-sm" type="button" data-adel="' + a.id + '">만화 삭제</button></div>';
  }
  function openComic(a){
    var pages = pagesOf(a);
    V.art = a; V.n = pages.length; V.i = 0; V.back = document.activeElement; V.react = {};
    q('cvTitle').textContent = a.fold_text || a.title || '만화';
    q('cvTrack').innerHTML = pages.map(function(p, i){
      return '<div class="cv-slide" data-i="' + i + '"><img data-src="' + esc(url(p)) + '" alt="' + (i + 1) + ' / ' + pages.length + '쪽" draggable="false"></div>';
    }).join('') + '<div class="cv-slide cv-end"><p>마지막 장이에요</p><button type="button" data-first>처음으로</button></div>';
    q('cvDots').innerHTML = pages.map(function(p, i){ return '<button type="button" data-dot="' + i + '" aria-label="' + (i + 1) + '장으로"></button>'; }).join('');
    renderUnder(); loadReacts();
    cv.hidden = false; document.documentElement.style.overflow = 'hidden';
    q('cvScroll').scrollTop = 0;
    var saved = 'h'; try { saved = localStorage.getItem('pubam-comic-mode') || 'h'; } catch (e) {}
    setMode(saved === 'v');
    q('cvTrack').scrollLeft = 0; setIdx(0);
    q('cvClose').focus();
    hang(a);
  }
  function closeComic(){
    if (cv.hidden) return;
    cv.hidden = true; document.documentElement.style.overflow = ''; unzoom();
    q('cvStage').style.transform = ''; q('cvStage').style.opacity = '';
    V.art = null; q('cvTrack').innerHTML = '';
    if (V.back && V.back.focus) try { V.back.focus({ preventScroll: true }); } catch (e) {}
  }
  function mountViewer(){
    document.body.appendChild(cv);
    var t = q('cvTrack'), raf = 0;
    t.addEventListener('scroll', function(){   /* 옆으로 넘길 때 지금 장 */
      if (V.vert) return;
      cancelAnimationFrame(raf); raf = requestAnimationFrame(function(){ setIdx(Math.round(t.scrollLeft / Math.max(1, t.clientWidth))); });
    }, { passive: true });
    q('cvScroll').addEventListener('scroll', function(){   /* 세로로 볼 때 지금 장 */
      if (!V.vert) return;
      var top = q('cvScroll').getBoundingClientRect().top + 80, best = 0;
      slides().forEach(function(s, k){ if (s.getBoundingClientRect().top <= top) best = k; });
      if (best !== V.i) setIdx(best);
    }, { passive: true });
    q('cvPrev').addEventListener('click', function(){ step(-1); });
    q('cvNext').addEventListener('click', function(){ step(1); });
    t.addEventListener('touchstart', function(){ V.goal = null; }, { passive: true });   /* 손가락으로 넘기면 그쪽이 우선 */
    q('cvClose').addEventListener('click', closeComic);
    q('cvMode').addEventListener('click', function(){ setMode(!V.vert); });
    q('cvZoom').addEventListener('click', function(){ toggleZoom(); });
    cv.addEventListener('click', async function(e){
      var d = e.target.closest('[data-dot]'); if (d) { go(+d.dataset.dot); return; }
      if (e.target.closest('[data-first]')) { if (V.vert) q('cvScroll').scrollTo({ top: 0, behavior: 'smooth' }); else go(0); return; }
      var r = e.target.closest('[data-cvr]');
      if (r) {
        var id = V.art.id, k = r.dataset.cvr, key = 'artwork:' + id + ':' + k; r.disabled = true;
        var res = await P.sb.rpc('toggle_reaction', { p_type: 'artwork', p_id: id, p_emoji: k, p_client: P.clientId });
        r.disabled = false; if (res.error) { alert(P.msg(res.error)); return; }
        var on = res.data === true; if (on) mineR[key] = 1; else delete mineR[key];
        try { localStorage.setItem('pubam-reacted', JSON.stringify(mineR)); } catch (x) {}
        V.react[k] = Math.max(0, (V.react[k] || 0) + (on ? 1 : -1)); renderUnder();
      }
    });
    /* 두 번 탭(또는 더블클릭)하면 확대 */
    var lastTap = { t: 0, x: 0, y: 0 };
    t.addEventListener('pointerup', function(e){
      var s = e.target.closest('.cv-slide[data-i]'); if (!s) return;
      var now = performance.now();
      if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { toggleZoom(s); lastTap.t = 0; }
      else lastTap = { t: now, x: e.clientX, y: e.clientY };
    });
    /* 폰: 맨 위에서 아래로 쓸어내리면 닫힘 */
    var sw = null, stage = q('cvStage'), sc = q('cvScroll');
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
      if (sw && sw.on && sw.dy > 110) closeComic();
      else { stage.style.transform = ''; stage.style.opacity = ''; }
      sw = null;
    });
    /* 키보드: ← → 넘기기, Esc 닫기 (방의 다른 단축키는 막음) */
    window.addEventListener('keydown', function(e){
      if (cv.hidden) return;
      var tag = e.target && e.target.tagName;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeComic(); return; }
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === ' ' || e.key === 'PageDown' || e.key === 'PageUp') { return; }
      e.stopImmediatePropagation();
    }, true);
    window.addEventListener('resize', function(){ if (!cv.hidden && !V.vert) go(V.i, false); });
  }

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
      if (!confirm(isComic(a) ? '만화 「' + (a.title || '제목 없음') + '」(' + pg.length + '장 전부)를 지울까요? 되돌릴 수 없어요.' : '그림 「' + (a.title || '제목 없음') + '」을(를) 지울까요? 되돌릴 수 없어요.')) return;
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
    if (V.art && V.art.id === id) { refreshViewer(); var vn = cv.querySelector('.ag-cf .n'); if (vn) vn.value = name; return; }
    var el = $('ag-' + id); if (el && el.tagName === 'DETAILS') { el.open = true; loadFull(el); var n = el.querySelector('.ag-cf .n'); if (n) n.value = name; }
  });

  /* 댓글을 달거나 지운 뒤: 보기 화면의 아래쪽만 새로 */
  function refreshViewer(){ if (!V.art) return; var a = all().find(function(x){ return x.id === V.art.id; }); if (a) { V.art = a; renderUnder(); } }

  var lastPL = null;
  function start(){
    mountViewer();
    render();
    P.onAuth(function(){ var pl = P.isPL(); if (pl !== lastPL) { lastPL = pl; loadAll(); } });
    if (P.offline) { err = '서버에 연결하지 못했어요.'; render(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
