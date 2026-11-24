/* 푸밤 서버 연결 (Supabase)
   - 모든 페이지가 같이 씀: 로그인/로그아웃, 입장 화면, 서버 클라이언트
   - 이 키(publishable)는 공개돼도 괜찮은 키. 실제 권한은 DB 보안 규칙(RLS)이 막음.
   - 필요: 이 파일보다 먼저 supabase-js CDN 스크립트 */
(function(){
  'use strict';
  var URL = 'https://jikuodhzdluxttrlrhqy.supabase.co';
  var KEY = 'sb_publishable_7scIYX6-NjrS7FID5yMrBw_dre5FjOd';

  var P = window.PUBAM = { sb: null, user: null, member: null, offline: false };
  var listeners = [];

  /* 게스트 반응(❤️ 등) 구분용 무작위 번호. 이 브라우저에만 저장 */
  P.clientId = (function(){
    var k = 'pubam-client';
    try {
      var v = localStorage.getItem(k);
      if (!v) { v = (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, function(){ return (Math.random() * 16 | 0).toString(16); })); localStorage.setItem(k, v); }
      return v;
    } catch (e) { return '00000000-0000-4000-8000-000000000000'; }
  })();

  P.isPL = function(){ return !!P.member; };
  P.onAuth = function(fn){ listeners.push(fn); if (P._ready) fn(P); };
  function emit(){
    window.PUBAM_CAN_EDIT = P.isPL();
    document.documentElement.classList.toggle('is-pl', P.isPL());
    listeners.forEach(function(fn){ try { fn(P); } catch (e) { console.error(e); } });
    try { window.dispatchEvent(new CustomEvent('pubam:auth', { detail: P })); } catch (e) {}
  }

  async function loadMember(){
    P.member = null;
    if (!P.user) return;
    var r = await P.sb.from('members').select('slot,display_name').eq('user_id', P.user.id).maybeSingle();
    if (r.data) P.member = r.data;
  }

  if (!window.supabase || !window.supabase.createClient) {
    P.offline = true; P._ready = true;
    P.ready = Promise.resolve(P);
    window.PUBAM_CAN_EDIT = false;
    console.warn('[pubam] supabase-js를 못 불러왔어요. 서버 없이 보여 줍니다.');
  } else {
    P.sb = window.supabase.createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    P.ready = (async function(){
      try {
        var s = await P.sb.auth.getSession();
        P.user = s.data.session ? s.data.session.user : null;
        await loadMember();
      } catch (e) { console.warn(e); }
      P._ready = true; emit();
      P.sb.auth.onAuthStateChange(function(ev, session){
        var uid = session ? session.user.id : null;
        if ((P.user && P.user.id) === uid && ev !== 'SIGNED_IN') return;
        P.user = session ? session.user : null;
        setTimeout(function(){ loadMember().then(emit); }, 0);
      });
      return P;
    })();
  }

  P.login = async function(email, pw){
    var r = await P.sb.auth.signInWithPassword({ email: email, password: pw });
    if (r.error) throw r.error;
    P.user = r.data.user; await loadMember();
    if (!P.member) { await P.sb.auth.signOut(); P.user = null; throw new Error('not_member'); }
    emit(); return P.member;
  };
  P.logout = async function(){ await P.sb.auth.signOut(); P.user = null; P.member = null; emit(); };

  /* 오류 문구를 쉬운 말로 */
  P.msg = function(err){
    var m = (err && (err.message || err)) + '';
    if (/Invalid login/i.test(m)) return '이메일이나 비밀번호가 맞지 않아요';
    if (/not_member/.test(m)) return 'PL 명단에 없는 계정이에요';
    if (/wrong_password/.test(m)) return '비밀번호가 맞지 않아요';
    if (/잠시 후/.test(m)) return '잠시 후에 다시 남겨 주세요';
    if (/10MB|50MB/.test(m)) return m;
    if (/maximum allowed size|too large|413/i.test(m)) return '파일이 너무 커요 (PDF 50MB, 그림 10MB까지)';
    if (/mime type|not supported/i.test(m)) return '올릴 수 없는 파일 형식이에요';
    if (/Failed to fetch|NetworkError/i.test(m)) return '서버에 연결하지 못했어요';
    if (/row-level security|permission/i.test(m)) return '권한이 없어요';
    return '문제가 생겼어요: ' + m;
  };

  /* ---------- 그림 줄이기 + 올리기 (여러 화면이 같이 씀) ---------- */
  P.MAX_BYTES = 10 * 1024 * 1024;
  var MIME = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', pdf: 'application/pdf' };
  P.MAX_PDF = 50 * 1024 * 1024;
  async function loadImg(file){
    if (window.createImageBitmap) { try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) {} }
    return await new Promise(function(ok, no){ var i = new Image(); i.onload = function(){ ok(i); }; i.onerror = no; i.src = URL.createObjectURL(file); });
  }
  /* 긴 쪽 maxSide(기본 2400px)로 줄이고 WebP(안 되면 JPG)로. 원본이 더 작으면 원본 그대로. GIF는 그대로 */
  P.compressImage = async function(file, maxSide){
    maxSide = maxSide || 2400;
    if (file.type === 'image/gif') return { blob: file, ext: 'gif' };
    var img = await loadImg(file);
    var w = img.width, h = img.height, s = Math.min(1, maxSide / Math.max(w, h));
    var c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
    var ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, 0, 0, c.width, c.height);
    if (img.close) img.close();
    var blob = await new Promise(function(r){ c.toBlob(r, 'image/webp', 0.86); }), ext = 'webp';
    if (!blob || blob.type !== 'image/webp') {
      var c2 = document.createElement('canvas'); c2.width = c.width; c2.height = c.height;
      var x2 = c2.getContext('2d'); x2.fillStyle = '#fff'; x2.fillRect(0, 0, c2.width, c2.height); x2.drawImage(c, 0, 0);
      blob = await new Promise(function(r){ c2.toBlob(r, 'image/jpeg', 0.88); }); ext = 'jpg';
    }
    if (s === 1 && blob.size >= file.size) return { blob: file, ext: (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg') };
    return { blob: blob, ext: ext };
  };
  /* media 저장소에 올리고 경로를 돌려줌. folder 예: 'logs', 'tv'. PDF는 50MB까지 */
  P.uploadImage = async function(blob, ext, folder){
    var max = ext === 'pdf' ? P.MAX_PDF : P.MAX_BYTES;
    if (blob.size > max) throw new Error((ext === 'pdf' ? '50MB' : '10MB') + '가 넘어 못 올려요');
    var id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    var path = folder + '/' + (P.member ? P.member.slot : 'x') + '/' + id + '.' + ext;
    var up = await P.sb.storage.from('media').upload(path, blob, { contentType: MIME[ext] || blob.type, cacheControl: '31536000', upsert: false });
    if (up.error) throw up.error;
    return path;
  };
  P.mediaUrl = function(path){ return P.sb.storage.from('media').getPublicUrl(path).data.publicUrl; };

  /* ---------- 로그인 창 / 입장 화면 (DOM을 직접 만들어 넣음) ---------- */
  var css = document.createElement('style');
  css.textContent =
    '.pb-scrim{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:rgba(206,222,242,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}' +
    '.pb-scrim[hidden]{display:none}' +
    '.pb-card{width:min(380px,100%);background:#fff;border:1.5px solid #1F1B24;border-radius:26px;padding:26px 22px 22px;box-shadow:0 6px 0 #1F1B24;font:16px/1.6 Nunito,"Gowun Dodum",system-ui,sans-serif;color:#1F1B24;text-align:center}' +
    '.pb-card h2{margin:0 0 4px;font:900 24px/1.2 Nunito,"Gowun Dodum",sans-serif;letter-spacing:-.02em}' +
    '.pb-card p{margin:0 0 18px;color:#4A4552;font-size:15px}' +
    '.pb-col{display:flex;flex-direction:column;gap:10px}' +
    '.pb-btn{min-height:50px;border-radius:999px;border:1.5px solid #1F1B24;background:#fff;color:#1F1B24;font:800 16px Nunito,"Gowun Dodum",sans-serif;cursor:pointer;box-shadow:0 3px 0 #1F1B24}' +
    '.pb-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #1F1B24}' +
    '.pb-btn.ink{background:#5565AA;border-color:#2E3870;color:#fff;box-shadow:0 3px 0 #2E3870}' +
    '.pb-btn.yel{background:#F2E6A0}' +
    '.pb-btn:disabled{opacity:.5;cursor:default}' +
    '.pb-in{min-height:48px;border:1.5px solid #D9D5E3;border-radius:14px;padding:0 14px;font:16px Nunito,"Gowun Dodum",sans-serif;width:100%;box-sizing:border-box}' +
    '.pb-in:focus{outline:none;border-color:#5565AA}' +
    '.pb-err{min-height:22px;margin:2px 0 0;font-size:14px;color:#B3261E}' +
    '.pb-link{background:none;border:0;color:#6E6878;font:700 14px Nunito,"Gowun Dodum",sans-serif;cursor:pointer;margin-top:6px;min-height:40px}' +
    '.pb-who{position:fixed;z-index:36;left:50%;transform:translateX(-50%);top:calc(var(--gutter,24px) + 6px);display:flex;align-items:center;gap:6px;padding:4px 4px 4px 12px;border-radius:999px;background:rgba(255,255,255,.9);border:1px solid #cfd4e6;font:700 13px Nunito,"Gowun Dodum",sans-serif;color:#1F1B24}' +
    '.pb-who button{min-height:34px;padding:0 12px;border-radius:999px;border:1.5px solid #1F1B24;background:#fff;font:800 13px Nunito,"Gowun Dodum",sans-serif;cursor:pointer}' +
    '.pb-who .pb-up{display:inline-flex;align-items:center;min-height:34px;padding:0 12px;border-radius:999px;border:1.5px solid #2E3870;background:#5565AA;color:#fff;font:800 13px Nunito,"Gowun Dodum",sans-serif;text-decoration:none}' +
    '.pb-who i{width:10px;height:10px;border-radius:50%;border:1.5px solid #1F1B24;background:#F2E6A0}' +
    '.pb-who i.ho2{background:#5565AA}' +
    'body:not([data-mode="room"]) .pb-who.in-room{display:none}' +
    '@media (max-width:600px){.pb-who{top:auto;bottom:calc(env(safe-area-inset-bottom,0px) + 140px)}}';
  document.head.appendChild(css);

  var box = document.createElement('div');
  box.className = 'pb-scrim'; box.hidden = true;
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'pbTitle');
  box.innerHTML =
    '<div class="pb-card">' +
      '<div id="pbGate">' +
        '<h2 id="pbTitle">푸르가토리움의 밤</h2>' +
        '<p>HO1 · HO2의 방에 어서 오세요.</p>' +
        '<div class="pb-col">' +
          '<button class="pb-btn yel" type="button" id="pbGuest">게스트로 둘러보기</button>' +
          '<button class="pb-btn ink" type="button" id="pbToLogin">PL 로그인</button>' +
        '</div>' +
      '</div>' +
      '<form id="pbLogin" hidden>' +
        '<h2>PL 로그인</h2><p>PL 두 명만 들어올 수 있어요.</p>' +
        '<div class="pb-col">' +
          '<label class="sr" for="pbEmail" style="position:absolute;left:-9999px">이메일</label><input class="pb-in" id="pbEmail" type="email" autocomplete="username" placeholder="이메일" required>' +
          '<label class="sr" for="pbPw" style="position:absolute;left:-9999px">비밀번호</label><input class="pb-in" id="pbPw" type="password" autocomplete="current-password" placeholder="비밀번호" required>' +
          '<p class="pb-err" id="pbErr" role="alert"></p>' +
          '<button class="pb-btn ink" type="submit" id="pbGo">들어가기</button>' +
        '</div>' +
        '<button class="pb-link" type="button" id="pbCancel">게스트로 둘러보기</button>' +
      '</form>' +
    '</div>';

  var whoBar = document.createElement('div');
  whoBar.className = 'pb-who';

  function q(id){ return box.querySelector('#' + id); }
  function close(){ box.hidden = true; try { sessionStorage.setItem('pubam-entered', '1'); } catch (e) {} }
  P.openLogin = function(){
    box.hidden = false; q('pbGate').hidden = true; q('pbLogin').hidden = false; q('pbErr').textContent = '';
    setTimeout(function(){ q('pbEmail').focus(); }, 30);
  };
  P.openGate = function(){ box.hidden = false; q('pbGate').hidden = false; q('pbLogin').hidden = true; setTimeout(function(){ q('pbGuest').focus(); }, 30); };

  function mount(){
    document.body.appendChild(box);
    q('pbGuest').addEventListener('click', close);
    q('pbToLogin').addEventListener('click', P.openLogin);
    q('pbCancel').addEventListener('click', close);
    box.addEventListener('keydown', function(e){ if (e.key === 'Escape') close(); });
    q('pbLogin').addEventListener('submit', async function(e){
      e.preventDefault();
      if (P.offline) { q('pbErr').textContent = '서버에 연결하지 못했어요'; return; }
      var b = q('pbGo'); b.disabled = true; q('pbErr').textContent = '';
      try { await P.login(q('pbEmail').value.trim(), q('pbPw').value); q('pbPw').value = ''; close(); }
      catch (err) { q('pbErr').textContent = P.msg(err); }
      b.disabled = false;
    });
    /* 화면 위 작은 표시: 지금 누구로 보는지 + 로그인/로그아웃 */
    if (document.body.dataset.pubamWho !== 'off') {
      if (document.body.dataset.mode) whoBar.classList.add('in-room');
      document.body.appendChild(whoBar);
      whoBar.addEventListener('click', function(e){
        var b = e.target.closest('button'); if (!b) return;
        if (b.dataset.act === 'out') P.logout(); else P.openLogin();
      });
      P.onAuth(function(){
        whoBar.innerHTML = P.isPL()
          ? '<i class="' + P.member.slot + '"></i>' + esc(P.member.display_name) + ' <a class="pb-up" href="upload.html">올리기</a><button type="button" data-act="out">로그아웃</button>'
          : '게스트 <button type="button" data-act="in">PL 로그인</button>';
      });
    }
    /* 입장 화면: data-pubam-gate 가 붙은 페이지에서, 이 탭에서 처음 들어왔을 때만 */
    if (document.body.hasAttribute('data-pubam-gate') && !/closeup=/.test(location.search)) {
      var seen = false; try { seen = sessionStorage.getItem('pubam-entered') === '1'; } catch (e) {}
      P.ready.then(function(){ if (!seen && !P.isPL()) P.openGate(); });
    }
  }
  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  P.esc = esc;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
