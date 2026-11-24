/* 우체통 = 방명록. 글 목록을 서버에서 불러오고, app.js의 폼이 보낼 때 서버에 저장 */
(function(){
  'use strict';
  var P = window.PUBAM;
  var css = document.createElement('style');
  css.textContent =
    '.gb-list{list-style:none;margin:22px 0 0;padding:0;display:flex;flex-direction:column;gap:10px}' +
    '.gb-list li{background:#fff;border:1px solid #E3DFEC;border-radius:18px 18px 18px 6px;padding:10px 14px;font-size:15px;line-height:1.6}' +
    '.gb-list .gb-top{display:flex;align-items:center;gap:8px;font-family:Quicksand,Nunito,sans-serif;font-size:12px;color:#6E6878}' +
    '.gb-list b{font-family:Nunito,"Gowun Dodum",sans-serif;font-size:14px;color:#1F1B24}' +
    '.gb-list p{margin:4px 0 0;white-space:pre-wrap;word-break:break-word}' +
    '.gb-list .gb-del{margin-left:auto;min-height:32px;padding:0 10px;border-radius:999px;border:1px solid #D9D5E3;background:#fff;font:700 12px Nunito,sans-serif;cursor:pointer;display:none}' +
    'html.is-pl .gb-list .gb-del{display:inline-block}' +
    '.gb-list .gb-empty{background:none;border:0;color:#6E6878;padding:0}';
  document.head.appendChild(css);

  function fmt(t){ var d = new Date(t); return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0'); }

  async function load(){
    var ul = document.getElementById('gbList'); if (!ul) return;
    if (!P || !P.sb) { ul.innerHTML = '<li class="gb-empty">서버에 연결하지 못했어요.</li>'; return; }
    var r = await P.sb.from('guestbook').select('id,name,body,created_at').order('created_at', { ascending: false }).limit(100);
    if (r.error) { ul.innerHTML = '<li class="gb-empty">' + P.esc(P.msg(r.error)) + '</li>'; return; }
    ul.innerHTML = r.data.length ? r.data.map(function(g){
      return '<li><div class="gb-top"><b>' + P.esc(g.name) + '</b><span>' + fmt(g.created_at) + '</span>' +
        '<button class="gb-del" type="button" data-del="' + g.id + '">지우기</button></div><p>' + P.esc(g.body) + '</p></li>';
    }).join('') : '<li class="gb-empty">아직 아무도 안 남겼어요. 첫 글을 남겨 주세요!</li>';
  }

  window.PUBAM_GUESTBOOK_SEND = async function(form){
    if (!P || !P.sb) throw new Error('Failed to fetch');
    var r = await P.sb.from('guestbook').insert({ name: form.elements.name.value.trim(), body: form.elements.message.value.trim() });
    if (r.error) throw r.error;
    load();
  };

  document.addEventListener('click', async function(e){
    var b = e.target.closest('[data-del]'); if (!b || !b.closest('#gbList')) return;
    if (!confirm('이 방명록 글을 지울까요?')) return;
    var r = await P.sb.from('guestbook').delete().eq('id', +b.dataset.del);
    if (r.error) alert(P.msg(r.error)); else load();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();
