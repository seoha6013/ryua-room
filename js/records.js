/* 책장 = 기록장: 명장면 · 주사위 명예의 전당 (+ 성인 탭). 서버 records 표 + media 저장소.
   이미지 중심. 한 장 또는 여러 장 묶음 → 누르면 공통 보기 화면(js/viewer.js)으로 크게·넘겨 보기.
   주소 끝 #scenes / #dice 로 바로 열림. 올리기·고치기는 upload.html(#rec-scenes, #rec-dice, #edit-rec=ID) */
(function(){
  'use strict';
  var P = window.PUBAM;
  var css = document.createElement('style');
  css.textContent =
    '.rc-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 10px}' +
    '.rc-tab{min-height:46px;padding:0 16px;border-radius:16px;border:1.5px solid var(--ink);background:var(--t,#fff);font:800 14px Nunito,"Gowun Dodum",sans-serif;cursor:pointer;color:var(--ink)}' +
    '.rc-tab[aria-selected="true"]{transform:translateY(-2px);box-shadow:0 3px 0 var(--ink)}' +
    '.rc-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 12px}' +
    '.rc-seg{display:inline-flex;border:1.5px solid #D9D5E3;border-radius:999px;padding:3px;background:#fff}' +
    '.rc-seg button{min-height:36px;padding:0 12px;border:0;border-radius:999px;background:none;font:800 13px Nunito,"Gowun Dodum",sans-serif;cursor:pointer;color:var(--ink)}' +
    '.rc-seg button[aria-pressed="true"]{background:var(--ink);color:#fff}' +
    '.rc-sm{min-height:38px;padding:0 12px;border-radius:999px;border:1.5px solid #D9D5E3;background:#fff;font:700 13px Nunito,"Gowun Dodum",sans-serif;cursor:pointer;color:var(--ink);text-decoration:none;display:inline-flex;align-items:center}' +
    '.rc-sm:hover{border-color:var(--ink)}' +
    '.rc-up{display:none!important;margin-left:auto;background:var(--ink)!important;color:#fff!important;border-color:var(--ink)!important}' +
    'html.is-pl .rc-up{display:inline-flex!important}' +
    '.rc-pl{display:none;gap:6px;margin-top:10px}html.is-pl .rc-pl{display:flex}' +
    /* 명장면: 시나리오 묶음 → 장면 */
    '.rc-group{border:1.5px solid #D9D5E3;border-radius:20px;margin:0 0 10px;background:var(--gb,#fff)}' +
    '.rc-group>summary,.rc-item>summary{list-style:none;cursor:pointer}' +
    '.rc-group>summary::-webkit-details-marker,.rc-item>summary::-webkit-details-marker{display:none}' +
    '.rc-group>summary{display:flex;align-items:center;gap:10px;min-height:52px;padding:8px 16px;font:900 16px Nunito,"Gowun Dodum",sans-serif}' +
    '.rc-group>summary span{flex:1}' +
    '.rc-n{font:800 12px Nunito,sans-serif;font-style:normal;color:var(--ink-3);background:#fff;border:1px solid #D9D5E3;border-radius:999px;padding:1px 9px}' +
    '.rc-chev{width:18px;height:18px;flex:none;transition:transform .3s var(--spring,ease)}' +
    'details[open]>summary .rc-chev{transform:rotate(90deg)}' +
    '.rc-list{display:flex;flex-direction:column;gap:8px;padding:0 10px 10px}' +
    '.rc-item{background:#fff;border:1px solid #D9D5E3;border-radius:16px}' +
    '.rc-item>summary{display:grid;grid-template-columns:64px 1fr;gap:2px 12px;align-items:center;padding:8px 10px;border-radius:16px}' +
    '.rc-item>summary:hover{background:var(--lav-fill)}' +
    '.rc-item>summary img{grid-row:span 2;width:64px;height:64px;border-radius:12px;object-fit:cover;background:var(--lav-fill)}' +
    '.rc-item>summary b{font:800 15px/1.35 Nunito,"Gowun Dodum",sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.rc-item>summary small{font:700 12px/1.4 Nunito,"Gowun Dodum",sans-serif;color:var(--ink-3)}' +
    '.rc-body{padding:4px 12px 14px;border-top:1px dashed #D9D5E3;margin:0 8px}' +
    '.rc-big{all:unset;display:block;cursor:zoom-in;margin:10px 0 6px;border-radius:12px;overflow:hidden;background:#fff;outline:1px solid #E3DFEC}' +
    '.rc-big img{display:block;width:100%;height:auto;max-height:70vh;object-fit:contain}' +
    '.rc-big:focus-visible{outline:3px solid var(--ink)}' +
    '.rc-more{margin:4px 0 0}' +
    /* 명예의 전당: 바둑판 */
    '.rc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}' +
    '.rc-card{all:unset;box-sizing:border-box;display:flex;flex-direction:column;cursor:pointer;background:#fff;border:3px solid var(--vc,#D9D5E3);border-radius:18px;overflow:hidden;box-shadow:0 3px 0 var(--vs,rgba(31,27,36,.12));position:relative}' +
    '.rc-card:hover{transform:translateY(-2px)}.rc-card:focus-visible{outline:3px solid var(--ink);outline-offset:2px}' +
    '.rc-card.crit{--vc:#E6B84A;--vs:#B8902A;background:#FFF9E6}' +
    '.rc-card.fumble{--vc:#9B7BD8;--vs:#6E50B8;background:#F6F1FF}' +
    '.rc-card img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;background:var(--lav-fill)}' +
    '.rc-card .cap{padding:6px 10px 8px;font:800 13px/1.35 Nunito,"Gowun Dodum",sans-serif;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.rc-card .cap small{display:block;font:700 11px Nunito,"Gowun Dodum",sans-serif;color:var(--ink-3)}' +
    '.rc-badge{position:absolute;left:8px;top:8px;font:900 11px/1 Nunito,"Gowun Dodum",sans-serif;padding:5px 8px;border-radius:999px;background:#fff;border:1.5px solid var(--vc,#1F1B24);color:#1F1B24}' +
    '.rc-badge.crit{background:#F6DE8A}.rc-badge.fumble{background:#DCCFF5}' +
    '.rc-cnt{position:absolute;right:8px;top:8px;font:900 11px/1 Nunito,sans-serif;padding:5px 7px;border-radius:999px;background:#5565AA;color:#fff;border:1.5px solid #fff}' +
    '.rc-type{display:inline-block;font:800 10px Nunito,"Gowun Dodum",sans-serif;padding:1px 7px;margin-right:4px;border-radius:999px;background:var(--lav-fill)}' +
    /* 반응 · 댓글 */
    '.rc-react{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}' +
    '.rc-react button{min-height:38px;padding:0 12px;border-radius:999px;border:1.5px solid #D9D5E3;background:#fff;cursor:pointer;font-size:14px}' +
    '.rc-react button[aria-pressed="true"]{background:#F2E6A0;border-color:#1F1B24}' +
    '.rc-body h3,.cv-under .rc-h{margin:12px 0 6px;font:900 14px Nunito,"Gowun Dodum",sans-serif}' +
    '.rc-cl{list-style:none;margin:0 0 8px;padding:0;display:flex;flex-direction:column;gap:6px}' +
    '.rc-cl li{position:relative;background:var(--lav-fill,#F4F4FD);border-radius:14px 14px 14px 4px;padding:7px 36px 7px 12px;font-size:14px;line-height:1.55;word-break:break-word}' +
    '.rc-cl li b{font-weight:800;margin-right:6px}' +
    '.rc-cl .rc-none{background:none;padding:0;color:#6E6878}' +
    '.rc-cdel{display:none;position:absolute;right:6px;top:5px;width:26px;height:26px;border-radius:50%;border:1px solid #D9D5E3;background:#fff;cursor:pointer;line-height:1}' +
    'html.is-pl .rc-cdel{display:block}' +
    '.rc-cf{display:flex;flex-wrap:wrap;gap:6px}' +
    '.rc-cf input{min-height:42px;border:1.5px solid #D9D5E3;border-radius:12px;padding:0 10px;font:16px Nunito,"Gowun Dodum",sans-serif;background:#fff}' +
    '.rc-cf .n{flex:0 1 96px}.rc-cf .t{flex:1 1 160px}' +
    '.rc-cf button{min-height:42px;padding:0 14px;border-radius:12px;border:1.5px solid #1F1B24;background:#1F1B24;color:#fff;font:800 14px Nunito,"Gowun Dodum",sans-serif;cursor:pointer}' +
    '.panel p.rc-empty{color:var(--ink-3);text-align:center;padding:24px 0;font-size:15px}' +
    '.rc-lock{padding:12px 14px;border:1.5px dashed var(--ink-3);border-radius:16px;background:var(--blush-fill)}' +
    '.panel .rc-lock p{font-size:14px;margin:0 0 8px}' +
    '.rc-lock form{display:flex;gap:6px;flex-wrap:wrap}' +
    '.rc-lock input{min-height:42px;border:1.5px solid var(--ink);border-radius:12px;padding:0 12px;font-size:16px;flex:1 1 140px}' +
    '.rc-lock button{min-height:42px;padding:0 16px;border-radius:12px;border:1.5px solid var(--ink);background:var(--ink);color:#fff;font-weight:800;cursor:pointer}' +
    '.panel .rc-lerr{color:#B3261E;font-size:13px;margin:6px 0 0;min-height:1em}';
  document.head.appendChild(css);

  var TABS = ['scenes', 'dice', 'adult'];
  var REACTS = ['❤️', '😭', '👍', '🤣'];
  var VERD = { crit: '🌟 대성공', fumble: '💀 대실패', other: '기타' };
  var RECS = [], ADULT = [], comments = {}, counts = {}, loaded = false, err = '';
  var S = { tab: 'scenes', sort: 'new', filter: 'all', pw: null, groups: {} };
  var viewing = null;
  var mineR = (function(){ try { return JSON.parse(localStorage.getItem('pubam-reacted') || '{}'); } catch (e) { return {}; } })();
  var chev = '<svg class="rc-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  function $(id){ return document.getElementById(id); }
  function esc(s){ return P.esc(s == null ? '' : s); }
  function url(p){ return P.mediaUrl(p); }
  function dot(d){ return d ? d.replace(/-/g, '.') : ''; }
  function dayOf(r){ return r.played_on || r.created_at.slice(0, 10); }
  function pagesOf(r){ return r.pages && r.pages.length ? r.pages : (r.image_path ? [r.image_path] : []); }
  function label(r){ return r.fold_text || dot(dayOf(r)); }   /* 접었을 때: 문구, 비우면 날짜 */
  function all(){ return RECS.concat(ADULT.filter(function(a){ return !RECS.some(function(x){ return x.id === a.id; }); })); }
  function find(id){ return all().find(function(x){ return x.id === id; }); }
  function meta(r){
    return [r.scenario, r.session_no != null ? r.session_no + '회' : '', dot(dayOf(r)), pagesOf(r).length > 1 ? pagesOf(r).length + '장' : ''].filter(Boolean).join(' · ');
  }

  /* ---------- 조각들 ---------- */
  function reactHTML(r){
    var c = counts[r.id] || {};
    return '<div class="rc-react" role="group" aria-label="반응">' + REACTS.map(function(e){
      return '<button type="button" data-rcr="' + r.id + '" data-e="' + e + '" aria-pressed="' + !!mineR['record:' + r.id + ':' + e] + '">' + e + ' <span>' + (c[e] || 0) + '</span></button>';
    }).join('') + '</div>';
  }
  function commentsHTML(r){
    var c = comments[r.id] || [];
    return '<h3 class="rc-h">댓글 ' + c.length + '</h3>' +
      '<ul class="rc-cl">' + (c.length ? c.map(function(x){
        return '<li><b>' + esc(x.name) + '</b>' + esc(x.body) + (x.id ? '<button class="rc-cdel" type="button" data-rccdel="' + x.id + '" aria-label="댓글 지우기">×</button>' : '') + '</li>';
      }).join('') : '<li class="rc-none">첫 댓글을 남겨 보세요.</li>') + '</ul>' +
      '<form class="rc-cf" data-id="' + r.id + '">' +
        '<label style="position:absolute;left:-9999px" for="rcn-' + r.id + '">이름</label><input class="n" id="rcn-' + r.id + '" name="name" placeholder="이름" maxlength="20" required>' +
        '<label style="position:absolute;left:-9999px" for="rct-' + r.id + '">댓글</label><input class="t" id="rct-' + r.id + '" name="text" placeholder="한마디 남기기" maxlength="300" required>' +
        '<button type="submit">남기기</button></form>';
  }
  function plHTML(r){ return '<div class="rc-pl"><a class="rc-sm" href="upload.html#edit-rec=' + r.id + '">수정</a><button class="rc-sm" type="button" data-rcdel="' + r.id + '">삭제</button></div>'; }
  function sceneHTML(r){
    var n = pagesOf(r).length, c = (comments[r.id] || []).length;
    return '<details class="rc-item" id="rc-' + r.id + '" data-id="' + r.id + '">' +
      '<summary><img src="' + esc(url(r.image_path)) + '" alt="" loading="lazy"><b>' + (S.tab === 'adult' ? '<span class="rc-type">명장면</span>' : '') + esc(label(r)) + '</b>' +
        '<small>' + esc(meta(r)) + ' · 댓글 ' + c + '</small></summary>' +
      '<div class="rc-body">' +
        '<button type="button" class="rc-big" data-rcview="' + r.id + '" aria-label="크게 보기"><img data-src="' + esc(url(r.image_path)) + '" alt="' + esc(label(r)) + '"></button>' +
        (n > 1 ? '<p class="rc-more"><button type="button" class="rc-sm" data-rcview="' + r.id + '">' + n + '장 넘겨 보기 ›</button></p>' : '') +
        reactHTML(r) + commentsHTML(r) + plHTML(r) +
      '</div></details>';
  }
  function cardHTML(r){
    var v = r.verdict && r.verdict !== 'other' ? r.verdict : '', n = pagesOf(r).length;
    return '<button type="button" class="rc-card ' + v + '" data-rcview="' + r.id + '" aria-label="크게 보기: ' + esc(label(r)) + (r.verdict ? ', ' + VERD[r.verdict] : '') + '">' +
      '<img src="' + esc(url(r.image_path)) + '" alt="" loading="lazy">' +
      (r.verdict ? '<i class="rc-badge ' + r.verdict + '">' + VERD[r.verdict] + '</i>' : '') +
      (n > 1 ? '<i class="rc-cnt">' + n + '장</i>' : '') +
      '<span class="cap">' + (S.tab === 'adult' ? '<span class="rc-type">' + (r.type === 'scene' ? '명장면' : '명예의 전당') + '</span>' : '') + esc(label(r)) +
        '<small>' + esc([r.scenario, r.session_no != null ? r.session_no + '회' : ''].filter(Boolean).join(' · ') || dot(dayOf(r))) + ' · 댓글 ' + (comments[r.id] || []).length + '</small></span></button>';
  }

  /* ---------- 그리기 ---------- */
  function bar(){
    var t = S.tab, b = $('rcBar'); if (!b) return;
    var up = '<a class="rc-sm rc-up" href="upload.html#rec-' + (t === 'dice' ? 'dice' : 'scenes') + '">＋ 올리기</a>';
    if (t === 'scenes') b.innerHTML =
      '<span class="rc-seg" role="group" aria-label="정렬"><button type="button" data-rcsort="new" aria-pressed="' + (S.sort === 'new') + '">최신순</button><button type="button" data-rcsort="session" aria-pressed="' + (S.sort === 'session') + '">회차순</button></span>' +
      '<button type="button" class="rc-sm" data-rcall="1">모두 펼치기</button><button type="button" class="rc-sm" data-rcall="0">모두 접기</button>' + up;
    else if (t === 'dice') b.innerHTML =
      '<span class="rc-seg" role="group" aria-label="판정 거르기"><button type="button" data-rcf="all" aria-pressed="' + (S.filter === 'all') + '">전체</button><button type="button" data-rcf="crit" aria-pressed="' + (S.filter === 'crit') + '">🌟 대성공만</button><button type="button" data-rcf="fumble" aria-pressed="' + (S.filter === 'fumble') + '">💀 대실패만</button></span>' + up;
    else b.innerHTML = '';
  }
  var byNew = function(a, b){ return dayOf(a) < dayOf(b) ? 1 : dayOf(a) > dayOf(b) ? -1 : b.id - a.id; };
  var bySession = function(a, b){
    var x = a.session_no == null ? 1e9 : a.session_no, y = b.session_no == null ? 1e9 : b.session_no;
    return x - y || (dayOf(a) < dayOf(b) ? -1 : dayOf(a) > dayOf(b) ? 1 : a.id - b.id);
  };
  function render(){
    var view = $('rcView'); if (!view) return;
    document.querySelectorAll('.rc-tab').forEach(function(b){ b.setAttribute('aria-selected', b.dataset.rctab === S.tab ? 'true' : 'false'); });
    bar();
    if (!loaded) { view.innerHTML = '<p class="rc-empty">' + (err || '기록을 불러오는 중…') + '</p>'; return; }
    var open = [].map.call(view.querySelectorAll('.rc-item[open]'), function(d){ return d.id; });
    var html = '';
    if (S.tab === 'scenes') {
      var list = all().filter(function(r){ return r.type === 'scene' && !r.is_adult; }).sort(S.sort === 'new' ? byNew : bySession);
      var names = [];
      list.forEach(function(r){ var n = r.scenario || '시나리오 없음'; if (names.indexOf(n) < 0) names.push(n); });
      var bgs = ['color-mix(in oklab,var(--blush) 28%,#fff)', 'var(--lav-fill)', 'var(--mint-fill)', '#EEF3FA'];
      html = names.map(function(n, i){
        var items = list.filter(function(r){ return (r.scenario || '시나리오 없음') === n; });
        var open1 = n in S.groups ? S.groups[n] : i === 0;
        return '<details class="rc-group" data-g="' + esc(n) + '"' + (open1 ? ' open' : '') + ' style="--gb:' + bgs[i % bgs.length] + '">' +
          '<summary>' + chev + '<span>' + esc(n) + '</span><i class="rc-n">' + items.length + '</i></summary>' +
          '<div class="rc-list">' + items.map(sceneHTML).join('') + '</div></details>';
      }).join('') || '<p class="rc-empty">아직 올린 명장면이 없어요.</p>';
    } else if (S.tab === 'dice') {
      var dl = all().filter(function(r){ return r.type === 'dice' && !r.is_adult && (S.filter === 'all' || r.verdict === S.filter); }).sort(byNew);
      html = dl.length ? '<div class="rc-grid">' + dl.map(cardHTML).join('') + '</div>' : '<p class="rc-empty">' + (S.filter === 'all' ? '아직 올린 주사위 기록이 없어요.' : '이 판정의 기록이 아직 없어요.') + '</p>';
    } else {
      if (!P.isPL() && S.pw === null) {
        html = '<div class="rc-lock"><p>성인 기록이 들어 있어요. 성인 비밀번호를 넣으면 열려요.</p><form id="rcLock"><label style="position:absolute;left:-9999px" for="rcPw">성인 비밀번호</label><input id="rcPw" type="password" placeholder="성인 비밀번호" autocomplete="off" required><button type="submit">열기</button></form><p class="rc-lerr" id="rcLErr" role="alert"></p></div>';
      } else {
        var al = all().filter(function(r){ return r.is_adult; }).sort(byNew);
        html = al.length ? '<div class="rc-grid">' + al.map(cardHTML).join('') + '</div>' : '<p class="rc-empty">아직 성인 기록이 없어요.</p>';
      }
    }
    view.innerHTML = html;
    open.forEach(function(id){ var d = $(id); if (d) { d.open = true; loadBig(d); } });
  }
  function loadBig(d){ d.querySelectorAll('img[data-src]').forEach(function(im){ if (!im.getAttribute('src')) im.src = im.dataset.src; }); }

  /* ---------- 크게 보기 (공통 보기 화면) ---------- */
  function VW(){ return window.PUBAM_VIEWER; }
  function openView(r){
    viewing = r.id;
    VW().open({
      key: 'rec:' + r.id, title: label(r) + (r.verdict && r.verdict !== 'other' ? ' · ' + VERD[r.verdict] : ''), urls: pagesOf(r).map(url),
      react: { type: 'record', id: r.id },
      under: function(){
        var x = find(r.id) || r;
        return '<p class="cap" style="font-size:13px">' + (x.type === 'scene' ? '📘 명장면' : '🎲 주사위 명예의 전당') + ' · ' + esc(meta(x)) + (x.author ? ' · ' + x.author.toUpperCase() + ' PL' : '') + '</p>' +
          VW().reactHTML() + commentsHTML(x) + plHTML(x);
      },
      onClose: function(){ viewing = null; loadCounts().then(render); }
    });
  }

  /* ---------- 서버 ---------- */
  async function loadCounts(){
    var r = await P.sb.rpc('reaction_counts', { p_type: 'record' });
    counts = {};
    (r.data || []).forEach(function(x){ (counts[x.target_id] = counts[x.target_id] || {})[x.emoji] = Number(x.n); });
  }
  async function loadAll(){
    if (!P || !P.sb) { err = '서버에 연결하지 못했어요.'; render(); return; }
    var r = await Promise.all([
      P.sb.from('records').select('*'),
      P.sb.from('comments').select('id,target_id,name,body,created_at').eq('target_type', 'record').order('created_at'),
      loadCounts()
    ]);
    var e = r[0].error || r[1].error;
    if (e) { err = P.msg(e); render(); return; }
    RECS = r[0].data; loaded = true; err = '';
    if (P.isPL()) ADULT = [];
    comments = {};
    r[1].data.forEach(function(c){ (comments[c.target_id] = comments[c.target_id] || []).push(c); });
    if (!P.isPL() && S.pw !== null) { try { await loadAdult(S.pw); } catch (x) {} }
    render();
    if (viewing != null) VW().refresh();
  }
  async function loadAdult(pw){
    var r = await Promise.all([P.sb.rpc('adult_records', { pw: pw }), P.sb.rpc('adult_record_comments', { pw: pw })]);
    if (r[0].error) throw r[0].error;
    ADULT = r[0].data;
    (r[1].data || []).forEach(function(c){ var l = comments[c.target_id] = comments[c.target_id] || []; if (!l.some(function(x){ return x.id === c.id; })) l.push(c); });
  }

  /* ---------- 탭 · 주소 ---------- */
  function setTab(t){
    if (TABS.indexOf(t) < 0) return;
    S.tab = t; render();
    if (t !== 'adult' && document.body.dataset.mode === 'records') history.replaceState(null, '', '#' + t);
  }
  window.PUBAM_RECORDS = { setTab: setTab };
  /* index.html#scenes / #dice 로 들어오면 책장 기록장을 바로 엶 */
  function fromHash(){
    var h = location.hash.slice(1); if (h !== 'scenes' && h !== 'dice') return;
    S.tab = h; render();
    var tries = 0;
    (function go(){
      var G = window.GM635;
      if (!(G && G.engine && G.open)) { if (++tries < 60) setTimeout(go, 250); return; }
      if (G.mode !== 'records') G.open('records');
    })();
  }

  /* ---------- 이벤트 ---------- */
  document.addEventListener('click', async function(e){
    var t = e.target;
    var tb = t.closest('[data-rctab]'); if (tb) { setTab(tb.dataset.rctab); return; }
    var so = t.closest('[data-rcsort]'); if (so) { S.sort = so.dataset.rcsort; render(); return; }
    var fi = t.closest('[data-rcf]'); if (fi) { S.filter = fi.dataset.rcf; render(); return; }
    var al = t.closest('#panel-records [data-rcall]');
    if (al) { var on = al.dataset.rcall === '1'; document.querySelectorAll('#rcView details').forEach(function(d){ d.open = on; if (d.dataset.g) S.groups[d.dataset.g] = on; if (on) loadBig(d); }); return; }
    var vw = t.closest('[data-rcview]'); if (vw) { var rv = find(+vw.dataset.rcview); if (rv) openView(rv); return; }
    var rb = t.closest('[data-rcr]');
    if (rb) {
      var id = +rb.dataset.rcr, k = rb.dataset.e, key = 'record:' + id + ':' + k; rb.disabled = true;
      var res = await P.sb.rpc('toggle_reaction', { p_type: 'record', p_id: id, p_emoji: k, p_client: P.clientId });
      rb.disabled = false; if (res.error) { alert(P.msg(res.error)); return; }
      var on2 = res.data === true; if (on2) mineR[key] = 1; else delete mineR[key];
      try { localStorage.setItem('pubam-reacted', JSON.stringify(mineR)); } catch (x) {}
      var c = counts[id] = counts[id] || {}; c[k] = Math.max(0, (c[k] || 0) + (on2 ? 1 : -1));
      rb.setAttribute('aria-pressed', on2); rb.querySelector('span').textContent = c[k];
      return;
    }
    var cd = t.closest('[data-rccdel]');
    if (cd) {
      if (!confirm('이 댓글을 지울까요?')) return;
      var dr = await P.sb.from('comments').delete().eq('id', +cd.dataset.rccdel);
      if (dr.error) alert(P.msg(dr.error)); else loadAll();
      return;
    }
    var del = t.closest('[data-rcdel]');
    if (del) {
      var r = find(+del.dataset.rcdel), pg = pagesOf(r);
      if (!confirm('이 기록' + (pg.length > 1 ? '(' + pg.length + '장 전부)' : '') + '을 지울까요? 되돌릴 수 없어요.')) return;
      var d = await P.sb.from('records').delete().eq('id', r.id);
      if (d.error) { alert(P.msg(d.error)); return; }
      await P.sb.storage.from('media').remove(pg.concat(pg.indexOf(r.image_path) < 0 && r.image_path ? [r.image_path] : []));
      await P.sb.from('comments').delete().eq('target_type', 'record').eq('target_id', r.id);
      if (viewing === r.id) VW().close();
      loadAll();
    }
  });
  document.addEventListener('toggle', function(e){
    var d = e.target; if (!d.closest || !d.closest('#rcView')) return;
    if (d.classList.contains('rc-group')) S.groups[d.dataset.g] = d.open;
    if (d.open) loadBig(d);
  }, true);
  document.addEventListener('submit', async function(e){
    var f = e.target;
    if (f.id === 'rcLock') {
      e.preventDefault();
      var b = f.querySelector('button'); b.disabled = true;
      try { var pw = $('rcPw').value; await loadAdult(pw); S.pw = pw; render(); }
      catch (x) { $('rcLErr').textContent = P.msg(x); b.disabled = false; }
      return;
    }
    if (!f.classList.contains('rc-cf')) return;
    e.preventDefault();
    var id = +f.dataset.id, name = f.name.value.trim(), text = f.text.value.trim();
    if (!name || !text) return;
    var btn = f.querySelector('button'); btn.disabled = true;
    var r = await P.sb.from('comments').insert({ target_type: 'record', target_id: id, name: name, body: text });
    btn.disabled = false;
    if (r.error) { alert(P.msg(r.error)); return; }
    var rec = find(id);
    if (P.isPL() || !rec.is_adult) await loadAll();
    else { (comments[id] = comments[id] || []).push({ id: 0, target_id: id, name: name, body: text }); render(); if (viewing === id) VW().refresh(); }
    var el = $('rc-' + id); if (el && viewing !== id) { el.open = true; loadBig(el); }
    var nm = document.querySelector((viewing === id ? '#cv' : '#rc-' + id) + ' .rc-cf .n'); if (nm) nm.value = name;
  });

  var lastPL = null;
  function start(){
    render(); fromHash();
    window.addEventListener('hashchange', fromHash);
    P.onAuth(function(){ var pl = P.isPL(); if (pl !== lastPL) { lastPL = pl; loadAll(); } });
    if (P.offline) { err = '서버에 연결하지 못했어요.'; render(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
