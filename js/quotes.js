/* 책장 = 기록장의 "명대사" 탭 (#quotes). 서버 quotes 표 (speaker 'ho1'|'ho2', line, context, sort, bubble).
   보기는 누구나: 캐릭터별 거르기 · 검색 · 캐릭터 색 말풍선 카드.
   PL만: txt 파일 올리기 / 붙여 넣기 / 한 줄씩 넣기(미리보기 → 저장, 똑같은 줄은 건너뜀), 수정 · 삭제 · 말풍선에 쓰기 켜기/끄기.
   방의 혼잣말 말풍선(diorama.js)은 PUBAM_QUOTES.bubbles()로 대사를 가져감 */
(function(){
  'use strict';
  var P = window.PUBAM;
  var WHO = { ho1: '류스케', ho2: '아키사' };
  var NAMES = { '류스케': 'ho1', 'ho1': 'ho1', '아키사': 'ho2', 'ho2': 'ho2' };
  var css = document.createElement('style');
  css.textContent =
    '.qt-tools{display:flex;flex-wrap:wrap;align-items:center;gap:6px;width:100%}' +
    '.qt-search{flex:1 1 160px;min-height:40px;border:1.5px solid #D9D5E3;border-radius:999px;padding:0 14px;font:16px Nunito,"Gowun Dodum",sans-serif;background:#fff;color:var(--ink)}' +
    '.qt-search:focus{outline:none;border-color:var(--ink)}' +
    '.qt-count{font:800 12px Nunito,"Gowun Dodum",sans-serif;color:var(--ink-3)}' +
    '.qt-list{display:flex;flex-direction:column;gap:10px}' +
    '.qt-card{position:relative;padding:12px 14px 12px;border-radius:20px 20px 20px 6px;border:1.5px solid var(--qb);background:var(--qf);box-shadow:0 3px 0 var(--qb)}' +
    '.qt-card.ho1{--qf:#FBF4D2;--qb:#D9C462;--qc:#F2E6A0;--qt:#1F1B24}' +
    '.qt-card.ho2{--qf:#E6EBF8;--qb:#5565AA;--qc:#5565AA;--qt:#fff;border-radius:20px 20px 6px 20px}' +
    'html.is-pl .qt-card.off{opacity:.62}html:not(.is-pl) .qt-off{display:none}' +
    '.qt-who{display:inline-block;font:900 11px/1 Nunito,"Gowun Dodum",sans-serif;padding:4px 9px;border-radius:999px;background:var(--qc);color:var(--qt);border:1px solid var(--qb)}' +
    '.panel .qt-line{margin:8px 0 0;font:700 16px/1.6 "Gowun Dodum",Nunito,sans-serif;color:var(--ink);white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere}' +
    '.panel .qt-ctx{margin:4px 0 0;font-size:12px;color:var(--ink-3)}' +
    '.qt-off{font:800 11px Nunito,"Gowun Dodum",sans-serif;color:var(--ink-3);margin-left:6px}' +
    '.qt-pl{display:none;flex-wrap:wrap;gap:6px;margin-top:10px}html.is-pl .qt-pl{display:flex}' +
    '.qt-pl .rc-sm[aria-pressed="true"]{background:#C8E6C9;border-color:#1F1B24}' +
    '.qt-edit{display:flex;flex-direction:column;gap:8px;margin-top:8px}' +
    '.qt-edit textarea,.qt-ed textarea{width:100%;box-sizing:border-box;border:1.5px solid #D9D5E3;border-radius:14px;padding:10px 12px;font:16px/1.6 "Gowun Dodum",Nunito,sans-serif;background:#fff;color:var(--ink);resize:vertical}' +
    '.qt-sel{min-height:42px;border:1.5px solid #D9D5E3;border-radius:12px;padding:0 10px;font:800 15px Nunito,"Gowun Dodum",sans-serif;background:#fff;color:var(--ink)}' +
    '.qt-go{min-height:42px;padding:0 16px;border-radius:12px;border:1.5px solid #1F1B24;background:#1F1B24;color:#fff;font:800 14px Nunito,"Gowun Dodum",sans-serif;cursor:pointer}' +
    '.qt-go:disabled{opacity:.5;cursor:default}' +
    '.qt-ed{display:none;margin:0 0 14px;padding:14px;border:1.5px dashed var(--ink-3);border-radius:20px;background:#FFF7FA}' +
    'html.is-pl .qt-ed.open{display:block}' +
    '.qt-modes{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}' +
    '.qt-modes button{min-height:40px;padding:0 14px;border-radius:999px;border:1.5px solid #D9D5E3;background:#fff;font:800 13px Nunito,"Gowun Dodum",sans-serif;cursor:pointer;color:var(--ink)}' +
    '.qt-modes button[aria-pressed="true"]{background:#FFD1DC;border-color:#1F1B24}' +
    '.qt-drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:110px;padding:14px;border:2px dashed #E0A8BA;border-radius:16px;background:#fff;text-align:center;cursor:pointer;font:800 14px Nunito,"Gowun Dodum",sans-serif;color:var(--ink)}' +
    '.qt-drop small{font-weight:700;color:var(--ink-3)}' +
    '.qt-drop.over{background:#FFE3EB;border-color:#1F1B24}' +
    '.qt-row{display:flex;flex-wrap:wrap;gap:6px}.qt-row input{flex:1 1 180px;min-height:42px;border:1.5px solid #D9D5E3;border-radius:12px;padding:0 12px;font:16px "Gowun Dodum",Nunito,sans-serif;background:#fff;color:var(--ink)}' +
    '.qt-help{margin-top:10px;font-size:13px;color:var(--ink-2,#4A4452)}.qt-help summary{cursor:pointer;font-weight:800}' +
    '.qt-help pre{margin:6px 0 0;padding:10px 12px;border-radius:12px;background:#fff;border:1px solid #E3DFEC;font:13px/1.6 "Gowun Dodum",monospace;white-space:pre-wrap}' +
    '.qt-prev{margin-top:12px;padding:12px;border-radius:16px;background:#fff;border:1.5px solid #1F1B24}' +
    '.panel .qt-prev p{margin:0 0 8px;font-size:14px}' +
    '.qt-pl2{list-style:none;margin:0 0 10px;padding:0;max-height:300px;overflow:auto;display:flex;flex-direction:column;gap:4px}' +
    '.qt-pl2 li{display:flex;gap:8px;align-items:baseline;font-size:14px;line-height:1.5;padding:4px 6px;border-radius:8px}' +
    '.qt-pl2 li.skip{color:var(--ink-3);text-decoration:line-through}' +
    '.qt-pl2 li i{flex:none;font-style:normal;font:900 11px/1 Nunito,"Gowun Dodum",sans-serif;padding:3px 7px;border-radius:999px;border:1px solid #1F1B24}' +
    '.qt-pl2 li i.ho1{background:#F2E6A0}.qt-pl2 li i.ho2{background:#5565AA;color:#fff}.qt-pl2 li i.no{background:#eee}' +
    '.panel .qt-msg{min-height:1.2em;margin:8px 0 0;font-size:13px;font-weight:800;color:#2E7D32}.panel .qt-msg.err{color:#B3261E}' +
    '.qt-add{margin-left:auto}' +
    '.qt-sit{display:inline-block;margin-left:6px;font:800 11px/1 Nunito,"Gowun Dodum",sans-serif;padding:4px 8px;border-radius:999px;background:#FFE3EB;border:1px solid #E0A8BA;color:#1F1B24}' +
    '.qt-chk{display:inline-flex;align-items:center;gap:6px;min-height:42px;font:800 13px Nunito,"Gowun Dodum",sans-serif;color:var(--ink);cursor:pointer}.qt-chk input{width:18px;height:18px}';
  document.head.appendChild(css);

  var QUOTES = [], loaded = false, err = '';
  var S = { who: 'all', q: '', editing: null, mode: 'file', edOpen: false, pending: null };
  var view = null, bar = null;
  function esc(s){ return P && P.esc ? P.esc(s == null ? '' : s) : String(s); }
  function $(id){ return document.getElementById(id); }
  function whoOf(sp){ var k = String(sp || '').trim().toLowerCase().replace(/\s+/g, ''); return NAMES[k] || (k === '1' ? 'ho1' : k === '2' ? 'ho2' : null); }
  function norm(s){ return String(s || '').replace(/\s+/g, ' ').trim(); }
  function isOn(q){ return q.bubble !== false; }
  var needCol = '서버에 "말풍선에 쓰기" 칸이 아직 없어요. 안내받은 SQL(quotes_bubble.sql)을 먼저 실행해 주세요.';
  var needSit = '서버에 "상황(들렸을 때)" 칸이 아직 없어요. 안내받은 SQL(quotes_situation.sql)을 먼저 실행해 주세요.';
  function emsg(e){ var m = (e && e.message) || ''; return /situation/.test(m) ? needSit : /bubble/.test(m) ? needCol : (P.msg ? P.msg(e) : m); }
  /* 상황: 'lifted' = 들렸을 때 전용 대사 (캐릭터를 들어 올리면 나옴). 비어 있으면 평소 대사 */
  function isLift(q){ return q.situation === 'lifted'; }
  /* "류스케·들림", "아키사 들림", "HO1/들림" 같은 이름 → { who, sit } */
  function whoSit(str){
    var t = String(str || '').trim(), m = t.match(/^(.+?)[\s·・.\/\-_]*들림$/);
    if (m && whoOf(m[1])) return { who: whoOf(m[1]), sit: 'lifted' };
    return { who: whoOf(t), sit: null };
  }

  /* ---------- 글 → 대사 나누기 ----------
     "이름: 대사" = 그 사람 / "[이름]" 줄 아래 = 다음 [이름] 전까지 이름 없이도 그 사람 / 빈 줄·#메모 무시 */
  function parse(text){
    var cur = null, curSit = null, out = [], seen = {};
    QUOTES.forEach(function(q){ seen[(whoOf(q.speaker) || '') + '|' + (isLift(q) ? 'lifted' : '') + '|' + norm(q.line)] = 1; });
    String(text || '').replace(/^﻿/, '').split(/\r\n|\r|\n/).forEach(function(raw, i){
      var l = raw.trim();
      if (!l || l.charAt(0) === '#') return;
      var sec = l.match(/^\[\s*(.+?)\s*\]$/);
      if (sec) { var w0 = whoSit(sec[1]); if (w0.who) { cur = w0.who; curSit = w0.sit; } return; }   /* [류스케] / [류스케·들림]. 모르는 [ ]는 메모 */
      var who = cur, sit = curSit, line = l, m = l.match(/^([^:：]{1,12}?)\s*[:：]\s*(.*)$/);
      if (m && whoSit(m[1]).who) { var ns = whoSit(m[1]); who = ns.who; sit = ns.sit || (who === cur ? curSit : null); line = m[2].trim(); }
      if (!line) return;
      var row = { who: who, sit: sit, line: line, n: i + 1 }, key = who + '|' + (sit || '') + '|' + norm(line);
      if (!who) row.skip = '누구 대사인지 몰라요';
      else if (seen[key]) row.skip = '이미 있어요';
      else seen[key] = 1;
      out.push(row);
    });
    return out;
  }
  /* txt 읽기: UTF-8 → 깨지면 EUC-KR(CP949). 메모장 '유니코드'(UTF-16)도 받음 */
  function readTxt(file){
    return file.arrayBuffer().then(function(buf){
      var b = new Uint8Array(buf);
      if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(buf);
      if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(buf);
      try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
      catch (e) { try { return new TextDecoder('euc-kr').decode(buf); } catch (x) { return new TextDecoder('utf-8').decode(buf); } }
    });
  }

  /* ---------- 그리기 ---------- */
  function listed(){
    var q = S.q.trim().toLowerCase();
    return QUOTES.filter(function(x){
      var w = whoOf(x.speaker);
      return (S.who === 'all' || w === S.who) && (!q || String(x.line).toLowerCase().indexOf(q) >= 0 || String(x.context || '').toLowerCase().indexOf(q) >= 0);
    });
  }
  function cardHTML(x){
    var w = whoOf(x.speaker) || 'ho1', on = isOn(x);
    if (S.editing === x.id) return '<article class="qt-card ' + w + '" data-qid="' + x.id + '"><form class="qt-edit" data-qedit="' + x.id + '">' +
      '<label class="sr-only" for="qe-w">누구 대사</label><select class="qt-sel" id="qe-w" name="who"><option value="ho1"' + (w === 'ho1' ? ' selected' : '') + '>류스케</option><option value="ho2"' + (w === 'ho2' ? ' selected' : '') + '>아키사</option></select>' +
      '<label class="sr-only" for="qe-l">대사</label><textarea id="qe-l" name="line" rows="3" required>' + esc(x.line) + '</textarea>' +
      '<label class="qt-chk"><input type="checkbox" name="lifted"' + (isLift(x) ? ' checked' : '') + '> 🙌 들렸을 때 대사</label>' +
      '<div class="qt-row"><button class="qt-go" type="submit">저장</button><button class="rc-sm" type="button" data-qcancel="1">취소</button></div></form></article>';
    return '<article class="qt-card ' + w + (on ? '' : ' off') + '" data-qid="' + x.id + '">' +
      '<span class="qt-who">' + WHO[w] + '</span>' + (isLift(x) ? '<span class="qt-sit">🙌 들렸을 때</span>' : '') + (on ? '' : '<span class="qt-off">말풍선 꺼짐</span>') +
      '<p class="qt-line">' + esc(x.line) + '</p>' + (x.context ? '<p class="qt-ctx">' + esc(x.context) + '</p>' : '') +
      '<div class="qt-pl"><button class="rc-sm" type="button" data-qbub="' + x.id + '" aria-pressed="' + on + '">💬 말풍선에 쓰기 ' + (on ? '켜짐' : '꺼짐') + '</button>' +
      '<button class="rc-sm" type="button" data-qed="' + x.id + '">수정</button><button class="rc-sm" type="button" data-qdel="' + x.id + '">삭제</button></div></article>';
  }
  function drawList(){
    var el = $('qtList'); if (!el) return;
    var L = listed(), c = $('qtCount');
    if (c) c.textContent = loaded ? L.length + '줄' : '';
    if (!loaded) { el.innerHTML = '<p class="rc-empty">' + esc(err || '명대사를 불러오는 중…') + '</p>'; return; }
    el.innerHTML = L.length ? L.map(cardHTML).join('') :
      '<p class="rc-empty">' + (QUOTES.length ? '찾는 대사가 없어요.' : '아직 넣은 명대사가 없어요.') + '</p>';
  }
  function drawBar(){
    if (!bar) return;
    bar.innerHTML = '<div class="qt-tools">' +
      '<span class="rc-seg" role="group" aria-label="캐릭터 거르기">' + [['all', '전체'], ['ho1', '류스케'], ['ho2', '아키사']].map(function(o){
        return '<button type="button" data-qwho="' + o[0] + '" aria-pressed="' + (S.who === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</span>' +
      '<label class="sr-only" for="qtQ">대사 검색</label><input class="qt-search" id="qtQ" type="search" placeholder="대사 검색" value="' + esc(S.q) + '" autocomplete="off">' +
      '<span class="qt-count" id="qtCount" aria-live="polite"></span>' +
      '<button type="button" class="rc-sm rc-up qt-add" data-qopen="1" aria-expanded="' + S.edOpen + '">＋ 대사 넣기</button></div>';
  }
  var FORMAT = '류스케: 봤지! 나니깐!\n아키사: …뭐야.\n[류스케]\n이 줄부터는 이름 없이 써도 류스케 대사\n[아키사]\n여기부터는 아키사 대사\n[류스케·들림]\n들어 올렸을 때만 나오는 류스케 대사\n[아키사·들림]\n들어 올렸을 때만 나오는 아키사 대사\n# 샵(#)으로 시작하는 줄은 메모라 안 들어가요';
  function edHTML(){
    var m = S.mode;
    return '<div class="qt-ed' + (S.edOpen ? ' open' : '') + '" id="qtEd">' +
      '<div class="qt-modes" role="group" aria-label="넣는 방법">' + [['file', '📄 txt 파일'], ['paste', '📋 붙여 넣기'], ['one', '✏️ 한 줄씩']].map(function(o){
        return '<button type="button" data-qmode="' + o[0] + '" aria-pressed="' + (m === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
      (m === 'file' ? '<label class="qt-drop" id="qtDrop">txt 파일을 끌어다 놓거나 눌러서 고르기<small>여러 개 한 번에 · UTF-8 / 메모장(ANSI) 둘 다 돼요</small><input id="qtFile" type="file" accept=".txt,text/plain" multiple hidden></label>' :
       m === 'paste' ? '<label class="sr-only" for="qtPaste">대사 붙여 넣기</label><textarea id="qtPaste" rows="8" placeholder="' + esc(FORMAT) + '"></textarea><div class="qt-row" style="margin-top:8px"><button class="qt-go" type="button" data-qprev="1">미리보기</button></div>' :
       '<form class="qt-row" id="qtOne"><label class="sr-only" for="qtOneW">누구 대사</label><select class="qt-sel" id="qtOneW"><option value="ho1">류스케</option><option value="ho2">아키사</option></select>' +
         '<label class="sr-only" for="qtOneL">대사</label><input id="qtOneL" placeholder="대사 한 줄" maxlength="500" required>' +
         '<label class="qt-chk"><input type="checkbox" id="qtOneLift"> 🙌 들렸을 때</label><button class="qt-go" type="submit">추가</button></form>') +
      (m !== 'one' ? '<details class="qt-help"><summary>쓰는 형식 보기</summary><pre>' + esc(FORMAT) + '</pre><p>이름은 류스케·아키사(또는 HO1·HO2). 빈 줄은 무시하고, 이미 있는 똑같은 대사는 건너뛰어요.</p></details>' : '') +
      '<div id="qtPrev"></div><p class="qt-msg" id="qtMsg" role="status"></p></div>';
  }
  function drawPrev(){
    var el = $('qtPrev'); if (!el) return;
    var rows = S.pending; if (!rows) { el.innerHTML = ''; return; }
    var ok = rows.filter(function(r){ return !r.skip; }), a = ok.filter(function(r){ return r.who === 'ho1'; }).length, lf = ok.filter(function(r){ return r.sit; }).length;
    var dup = rows.filter(function(r){ return r.skip === '이미 있어요'; }).length, unk = rows.filter(function(r){ return r.skip && r.skip !== '이미 있어요'; }).length;
    el.innerHTML = '<div class="qt-prev"><p><b>새로 넣을 대사 ' + ok.length + '줄</b> — 류스케 ' + a + '줄 · 아키사 ' + (ok.length - a) + '줄' +
      (lf ? ' (그중 들렸을 때 ' + lf + '줄)' : '') + (dup ? ' · 이미 있어서 건너뜀 ' + dup + '줄' : '') + (unk ? ' · 누구 대사인지 몰라 건너뜀 ' + unk + '줄' : '') + '</p>' +
      '<ul class="qt-pl2">' + rows.map(function(r){
        return '<li' + (r.skip ? ' class="skip" title="' + esc(r.skip) + '"' : '') + '><i class="' + (r.who || 'no') + '">' + (r.who ? WHO[r.who] + (r.sit ? '·들림' : '') : '?') + '</i><span>' + esc(r.line) + (r.skip ? ' <small>(' + esc(r.skip) + ')</small>' : '') + '</span></li>';
      }).join('') + '</ul>' +
      '<div class="qt-row"><button class="qt-go" type="button" data-qsave="1"' + (ok.length ? '' : ' disabled') + '>저장 (' + ok.length + '줄)</button><button class="rc-sm" type="button" data-qdrop="1">취소</button></div></div>';
  }
  function msg(t, bad){ var m = $('qtMsg'); if (m) { m.textContent = t || ''; m.classList.toggle('err', !!bad); } }
  function mount(v, b){
    view = v; bar = b;
    drawBar();
    v.innerHTML = edHTML() + '<div class="qt-list" id="qtList"></div>';
    drawPrev(); drawList();
  }
  function redrawEd(){ var e = $('qtEd'); if (!e) return; var d = document.createElement('div'); d.innerHTML = edHTML(); e.replaceWith(d.firstChild); drawPrev(); }

  /* ---------- 서버 ---------- */
  async function load(){
    if (!P || !P.sb) { err = '서버에 연결하지 못했어요.'; drawList(); return; }
    var r = await P.sb.from('quotes').select('*').order('sort', { ascending: true, nullsFirst: false }).order('id');
    if (r.error) { err = emsg(r.error); drawList(); return; }
    QUOTES = r.data || []; loaded = true; err = '';
    drawList();
    document.dispatchEvent(new CustomEvent('pubam-quotes'));
  }
  function nextSort(){ return QUOTES.reduce(function(m, q){ return Math.max(m, +q.sort || 0); }, 0) + 1; }
  async function insertRows(rows){
    var base = nextSort(), data = rows.map(function(r, i){ var d = { speaker: r.who, line: r.line, sort: base + i }; if (r.sit) d.situation = r.sit; return d; });
    if (data.some(function(d){ return d.situation; }) && data.some(function(d){ return !d.situation; })) data.forEach(function(d){ if (!d.situation) d.situation = null; });   /* 한 번에 넣을 땐 칸을 맞춤 */
    for (var i = 0; i < data.length; i += 200) {
      var res = await P.sb.from('quotes').insert(data.slice(i, i + 200));
      if (res.error) throw res.error;
    }
  }

  /* ---------- 이벤트 ---------- */
  function inQt(t){ return t.closest && t.closest('#panel-records'); }
  document.addEventListener('click', async function(e){
    var t = e.target; if (!inQt(t)) return;
    var w = t.closest('[data-qwho]'); if (w) { S.who = w.dataset.qwho; drawBar(); drawList(); return; }
    if (t.closest('[data-qopen]')) { S.edOpen = !S.edOpen; t.closest('[data-qopen]').setAttribute('aria-expanded', S.edOpen); $('qtEd').classList.toggle('open', S.edOpen); return; }
    var md = t.closest('[data-qmode]'); if (md) { S.mode = md.dataset.qmode; S.pending = null; redrawEd(); return; }
    if (t.closest('[data-qprev]')) { S.pending = parse($('qtPaste').value); msg(S.pending.length ? '' : '넣을 대사가 없어요.', !S.pending.length); drawPrev(); return; }
    if (t.closest('[data-qdrop]')) { S.pending = null; drawPrev(); msg(''); return; }
    var sv = t.closest('[data-qsave]');
    if (sv) {
      var ok = (S.pending || []).filter(function(r){ return !r.skip; }); if (!ok.length) return;
      sv.disabled = true; msg('저장하는 중…');
      try { await insertRows(ok); S.pending = null; drawPrev(); var pa = $('qtPaste'); if (pa) pa.value = ''; await load(); msg(ok.length + '줄 넣었어요.'); }
      catch (x) { sv.disabled = false; msg(emsg(x), true); }
      return;
    }
    var bb = t.closest('[data-qbub]');
    if (bb) {
      var q = QUOTES.find(function(x){ return x.id === +bb.dataset.qbub; }); if (!q) return;
      bb.disabled = true;
      var r = await P.sb.from('quotes').update({ bubble: !isOn(q) }).eq('id', q.id);
      bb.disabled = false;
      if (r.error) { alert(emsg(r.error)); return; }
      q.bubble = !isOn(q); drawList(); document.dispatchEvent(new CustomEvent('pubam-quotes'));
      return;
    }
    var ed = t.closest('[data-qed]'); if (ed) { S.editing = +ed.dataset.qed; drawList(); var ta = $('qe-l'); if (ta) ta.focus(); return; }
    if (t.closest('[data-qcancel]')) { S.editing = null; drawList(); return; }
    var dl = t.closest('[data-qdel]');
    if (dl) {
      var q2 = QUOTES.find(function(x){ return x.id === +dl.dataset.qdel; }); if (!q2) return;
      if (!confirm('이 대사를 지울까요?\n\n' + q2.line)) return;
      var d = await P.sb.from('quotes').delete().eq('id', q2.id);
      if (d.error) { alert(emsg(d.error)); return; }
      load();
    }
  });
  document.addEventListener('input', function(e){
    if (e.target.id !== 'qtQ') return;
    S.q = e.target.value; drawList();
  });
  document.addEventListener('submit', async function(e){
    var f = e.target;
    if (f.dataset && f.dataset.qedit) {
      e.preventDefault();
      var line = f.line.value.trim(); if (!line) return;
      var b = f.querySelector('button[type=submit]'); b.disabled = true;
      var up = { speaker: f.who.value, line: line }, old = QUOTES.find(function(q){ return q.id === +f.dataset.qedit; }) || {};
      if (f.lifted.checked || 'situation' in old) up.situation = f.lifted.checked ? 'lifted' : null;
      var r = await P.sb.from('quotes').update(up).eq('id', +f.dataset.qedit);
      b.disabled = false;
      if (r.error) { alert(emsg(r.error)); return; }
      S.editing = null; load();
      return;
    }
    if (f.id === 'qtOne') {
      e.preventDefault();
      var who = $('qtOneW').value, l = $('qtOneL').value.trim(), lifted = $('qtOneLift').checked; if (!l) return;
      var dup = QUOTES.some(function(q){ return whoOf(q.speaker) === who && isLift(q) === lifted && norm(q.line) === norm(l); });
      if (dup) { msg('이미 있는 대사예요.', true); return; }
      var bt = f.querySelector('button'); bt.disabled = true;
      try { await insertRows([{ who: who, sit: lifted ? 'lifted' : null, line: l }]); $('qtOneL').value = ''; await load(); msg(WHO[who] + (lifted ? ' 들렸을 때' : '') + ' 대사를 넣었어요.'); $('qtOneL').focus(); }
      catch (x) { msg(emsg(x), true); }
      bt.disabled = false;
    }
  });
  async function takeFiles(files){
    var txts = [].filter.call(files || [], function(f){ return /\.txt$/i.test(f.name) || f.type === 'text/plain'; });
    if (!txts.length) { msg('.txt 파일만 올릴 수 있어요.', true); return; }
    var all = [];
    for (var i = 0; i < txts.length; i++) all.push(await readTxt(txts[i]));
    S.pending = parse(all.join('\n'));
    msg(S.pending.length ? txts.length + '개 파일을 읽었어요. 아래에서 확인하고 저장을 눌러 주세요.' : '파일에 넣을 대사가 없어요.', !S.pending.length);
    drawPrev();
  }
  document.addEventListener('change', function(e){ if (e.target.id === 'qtFile') { takeFiles(e.target.files); e.target.value = ''; } });
  ['dragenter', 'dragover'].forEach(function(ev){ document.addEventListener(ev, function(e){ var d = e.target.closest && e.target.closest('#qtDrop'); if (d) { e.preventDefault(); d.classList.add('over'); } }); });
  document.addEventListener('dragleave', function(e){ var d = e.target.closest && e.target.closest('#qtDrop'); if (d) d.classList.remove('over'); });
  document.addEventListener('drop', function(e){ var d = e.target.closest && e.target.closest('#qtDrop'); if (!d) return; e.preventDefault(); d.classList.remove('over'); takeFiles(e.dataTransfer.files); });

  window.PUBAM_QUOTES = {
    mount: mount,
    /* 혼잣말 말풍선용: 말풍선에 쓰기가 켜진 대사만 */
    bubbles: function(){ return QUOTES.filter(function(q){ return isOn(q) && !isLift(q) && whoOf(q.speaker) && norm(q.line); }).map(function(q){ return { id: q.id, who: whoOf(q.speaker), line: norm(q.line) }; }); },
    /* 들어 올렸을 때: 그 캐릭터의 들림 전용 대사 → 없으면 평소 대사 (말풍선에 쓰기가 켜진 것만) */
    liftLines: function(who){
      var mine = QUOTES.filter(function(q){ return isOn(q) && whoOf(q.speaker) === who && norm(q.line); });
      var l = mine.filter(isLift); if (!l.length) l = mine;
      return l.map(function(q){ return { id: q.id, who: who, line: norm(q.line) }; });
    },
    parse: parse
  };
  function start(){ load(); if (P && P.onAuth) P.onAuth(function(){ if ($('qtList')) { drawBar(); drawList(); } }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
