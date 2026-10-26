/* 중2 수학 아케이드 · 공통 도구 (Supabase 함수 부르기, 복사, 저장) */
(function () {
  'use strict';
  var CFG = window.M2A_CONFIG || {};

  /* Supabase 함수 호출. 응답 JSON을 그대로 돌려줘요.
     네트워크 문제나 서버 오류면 Error를 던지고, err.retryable 로 다시 시도할지 알려줘요. */
  function rpc(fn, args, opt) {
    opt = opt || {};
    var headers = { 'Content-Type': 'application/json', 'apikey': CFG.key };
    if (/^eyJ/.test(CFG.key || '')) headers.Authorization = 'Bearer ' + CFG.key; // 예전 anon 키일 때만
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, opt.timeout || 15000) : null;
    return fetch(CFG.url + '/rest/v1/rpc/' + CFG.prefix + fn, {
      method: 'POST', headers: headers, body: JSON.stringify(args || {}), signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      return res.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!res.ok) {
          var msg = (j && (j.message || j.error)) || ('서버 오류 ' + res.status);
          if (/Could not find the function/i.test(msg)) msg = '데이터베이스 설정이 아직 안 됐어요. Supabase에서 setup.sql을 실행해 주세요.';
          var err = new Error(msg); err.status = res.status; err.retryable = res.status >= 500 || res.status === 429; throw err;
        }
        return j;
      });
    }, function (e) {
      if (timer) clearTimeout(timer);
      var err = new Error('인터넷 연결을 확인해 주세요.'); err.retryable = true; err.cause = e; throw err;
    });
  }

  /* 실패하면 점점 길게 + 무작위로 흩어서 다시 시도 */
  function rpcRetry(fn, args, tries, onRetry) {
    tries = tries || 4; var n = 0;
    return new Promise(function (resolve, reject) {
      (function go() {
        rpc(fn, args).then(resolve, function (e) {
          if (!e.retryable || n >= tries) return reject(e);
          n++; if (onRetry) onRetry(n, tries);
          setTimeout(go, 1500 * Math.pow(2, n - 1) + Math.random() * 1500);
        });
      })();
    });
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* 학생 접속 주소: 이 사이트의 첫 화면 + ?s=학교코드 */
  function siteBase() {
    if (CFG.site) return CFG.site.replace(/\/?$/, '/');
    return location.origin + location.pathname.replace(/[^/]*$/, '');
  }
  function studentUrl(code) {
    var base = siteBase();
    return base + '?s=' + encodeURIComponent(code);
  }

  /* 붙여 넣은 링크나 코드에서 학교 코드만 꺼내기 */
  function pickCode(v) {
    v = String(v || '').trim();
    var m = v.match(/[?&]s=([A-Za-z0-9]+)/); if (m) return m[1].toLowerCase();
    return v.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  }

  function copyText(text, btn) {
    var done = function () { if (btn) { var t = btn.textContent; btn.textContent = '복사했어요'; setTimeout(function () { btn.textContent = t; }, 1400); } };
    var fallback = function () {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} ta.remove();
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  }

  function downloadBlob(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function downloadText(text, name) { downloadBlob(new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' }), name); }
  function downloadCanvas(cv, name) { cv.toBlob(function (b) { downloadBlob(b, name); }, 'image/png'); }

  function fmtDate(s) {
    if (!s) return '-'; var d = new Date(s);
    return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '. ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /* 학생 안내문 이미지(세로 A4 비율) */
  function makePoster(name, url) {
    var W = 1240, H = 1754, cv = document.createElement('canvas'); cv.width = W; cv.height = H; var c = cv.getContext('2d');
    var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ffd03a'); g.addColorStop(1, '#ffbb1c'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.save(); c.translate(W / 2, 380); for (var i = 0; i < 36; i++) { c.rotate(Math.PI / 18); c.fillStyle = i % 2 ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,0)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(1800, -160); c.lineTo(1800, 160); c.fill(); } c.restore();
    var font = '"Black Han Sans","Jua","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#ff3b55'; c.strokeStyle = '#1b1426'; c.lineWidth = 8; roundRect(c, W / 2 - 230, 120, 460, 84, 14); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.font = '48px ' + font; c.fillText('MATH ARCADE', W / 2, 165);
    var ts = 150; c.font = ts + 'px ' + font; while (c.measureText('중2 수학 아케이드').width > W - 180 && ts > 60) { ts -= 4; c.font = ts + 'px ' + font; }
    c.lineWidth = Math.round(ts * 0.15); c.strokeStyle = '#1b1426'; c.strokeText('중2 수학 아케이드', W / 2, 330); c.fillStyle = '#fff'; c.fillText('중2 수학 아케이드', W / 2, 330);
    c.fillStyle = '#1b1426'; c.font = '74px ' + font; fitFill(c, name, W / 2, 480, W - 160);
    c.fillStyle = '#fff'; c.strokeStyle = '#1b1426'; c.lineWidth = 10; roundRect(c, W / 2 - 420, 570, 840, 840, 36); c.fill(); c.stroke();
    var q = document.createElement('canvas'); drawQR(q, url, 760); c.imageSmoothingEnabled = false; c.drawImage(q, W / 2 - 380, 610, 760, 760);
    c.fillStyle = '#1b1426'; c.font = '56px ' + font; c.fillText('휴대폰 카메라로 QR을 찍어 들어오세요', W / 2, 1490);
    c.font = '40px "Jua",sans-serif'; fitFill(c, url, W / 2, 1580, W - 120);
    c.font = '36px "Jua",sans-serif'; c.fillStyle = '#4a3b5c'; c.fillText('반·번호와 별명(예: 2-3 수학왕)으로 들어오면 우리 학교 랭킹에 올라가요', W / 2, 1660);
    return cv;
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function fitFill(c, t, x, y, maxW) { var size = parseInt(c.font, 10), rest = c.font.replace(/^\d+px/, ''); while (c.measureText(t).width > maxW && size > 18) { size -= 2; c.font = size + 'px' + rest; } c.fillText(t, x, y); }

  window.M2A = { siteBase: siteBase, rpc: rpc, rpcRetry: rpcRetry, esc: esc, studentUrl: studentUrl, pickCode: pickCode, copyText: copyText,
    downloadText: downloadText, downloadCanvas: downloadCanvas, fmtDate: fmtDate, makePoster: makePoster };
})();
