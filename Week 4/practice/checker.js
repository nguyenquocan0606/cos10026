/* ============================================================
   BỘ CHẤM TỰ ĐỘNG — bạn KHÔNG cần sửa file này.
   Nó đọc CSS thật mà trình duyệt đang áp dụng (getComputedStyle)
   rồi so với yêu cầu của từng nhiệm vụ.
   ============================================================ */
(function () {
  function getEl(sel) { return document.querySelector(sel); }

  function computed(sel, prop) {
    var e = getEl(sel);
    if (!e) return null;
    return getComputedStyle(e)[prop];
  }

  // Đổi mọi kiểu viết màu (green, #008000, hsl(...)) về dạng rgb(...) để so sánh
  function normColor(c) {
    var t = document.createElement('span');
    t.style.color = c;
    document.body.appendChild(t);
    var v = getComputedStyle(t).color;
    t.remove();
    return v;
  }

  function isColorProp(p) { return /color$/i.test(p); }

  function missing(sel) { return { ok: false, actual: 'không tìm thấy phần tử ' + sel }; }

  // Giá trị CSS phải đúng bằng expected
  window.cssIs = function (sel, prop, expected) {
    return function () {
      var actual = computed(sel, prop);
      if (actual === null) return missing(sel);
      var exp = isColorProp(prop) ? normColor(expected) : expected;
      return { ok: actual === exp, actual: actual };
    };
  };

  // Giá trị CSS phải chứa đoạn text
  window.cssHas = function (sel, prop, text) {
    return function () {
      var actual = computed(sel, prop);
      if (actual === null) return missing(sel);
      return { ok: actual.toLowerCase().indexOf(text.toLowerCase()) !== -1, actual: actual };
    };
  };

  // Giá trị CSS KHÔNG được bằng value
  window.cssNot = function (sel, prop, value) {
    return function () {
      var actual = computed(sel, prop);
      if (actual === null) return missing(sel);
      var v = isColorProp(prop) ? normColor(value) : value;
      return { ok: actual !== v, actual: actual };
    };
  };

  // Phần tử phải tồn tại trong HTML
  window.exists = function (sel) {
    return function () {
      var ok = !!getEl(sel);
      return { ok: ok, actual: ok ? 'đã có' : 'chưa có ' + sel };
    };
  };

  // Tổng chiều rộng thật trên màn hình (content + padding + border)
  window.widthIs = function (sel, px) {
    return function () {
      var e = getEl(sel);
      if (!e) return missing(sel);
      return { ok: e.offsetWidth === px, actual: e.offsetWidth + 'px' };
    };
  };

  // Kết hợp nhiều điều kiện: tất cả phải đúng
  window.all = function () {
    var checks = Array.prototype.slice.call(arguments);
    return function () {
      var results = checks.map(function (c) { return c(); });
      return {
        ok: results.every(function (r) { return r.ok; }),
        actual: results.map(function (r) { return r.actual; }).join('  |  ')
      };
    };
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function storageGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function storageSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var STYLE = [
    ':host{all:initial}',
    '.panel{position:fixed;right:16px;bottom:16px;width:min(500px,calc(100vw - 32px));max-height:80vh;overflow:auto;',
    'background:#fff;color:#1f2328;border:1px solid #d0d7de;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);',
    'font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;z-index:2147483647}',
    '.head{position:sticky;top:0;background:#0b5cad;color:#fff;padding:10px 14px;display:flex;align-items:center;gap:8px}',
    '.head h2{font-size:15px;margin:0;flex:1;font-weight:600}',
    '.score{background:rgba(255,255,255,.2);padding:2px 8px;border-radius:99px;font-weight:600;white-space:nowrap}',
    'button{font:inherit;cursor:pointer;border:0;border-radius:6px;padding:4px 10px}',
    '.head button{background:rgba(255,255,255,.2);color:#fff}',
    '.body{padding:10px 14px 14px}',
    '.collapsed .body{display:none}',
    'details.theory{background:#f6f8fa;border:1px solid #d0d7de;border-radius:8px;padding:6px 10px;margin-bottom:10px}',
    'details.theory summary{cursor:pointer;font-weight:600}',
    'code{font:12.5px ui-monospace,Consolas,monospace;background:#eff1f3;padding:1px 4px;border-radius:4px}',
    'pre{font:12.5px/1.45 ui-monospace,Consolas,monospace;background:#eff1f3;padding:8px;border-radius:6px;overflow:auto;margin:6px 0}',
    'ul.tasks{list-style:none;padding:0;margin:0}',
    'ul.tasks li{padding:8px 0;border-top:1px solid #eaeef2}',
    '.icon{display:inline-block;width:1.5em}',
    '.actual{color:#57606a;font-size:12.5px;margin:3px 0 0 1.5em}',
    '.hint{color:#9a6700;font-size:12.5px;margin:3px 0 0 1.5em}',
    '.ok .hint{display:none}',
    '.done{background:#dafbe1;border:1px solid #4ac26b;border-radius:8px;padding:8px 10px;margin-top:10px}',
    '.done a{color:#0b5cad;font-weight:600}',
    '.foot{margin-top:10px;display:flex;gap:8px}',
    '.foot button{background:#0b5cad;color:#fff}'
  ].join('');

  function render(cfg) {
    var host = document.createElement('div');
    document.body.appendChild(host);
    var root = host.attachShadow({ mode: 'open' });

    var autoTotal = 0, autoPassed = 0;
    var rows = cfg.tests.map(function (t, i) {
      if (t.manual) {
        var key = 'checker:' + location.pathname + ':' + i;
        var checked = storageGet(key) === '1';
        return '<li class="manual"><label><input type="checkbox" data-key="' + esc(key) + '"' +
          (checked ? ' checked' : '') + '> 🧠 ' + t.task + '</label>' +
          (t.hint ? '<div class="hint" style="display:block">💡 ' + t.hint + '</div>' : '') + '</li>';
      }
      autoTotal++;
      var r;
      try { r = t.check(); } catch (e) { r = { ok: false, actual: 'Lỗi: ' + e.message }; }
      if (r.ok) autoPassed++;
      return '<li class="' + (r.ok ? 'ok' : 'fail') + '"><span class="icon">' + (r.ok ? '✅' : '❌') + '</span>' +
        t.task +
        '<div class="actual">Trình duyệt đang thấy: <code>' + esc(r.actual) + '</code></div>' +
        (t.hint ? '<div class="hint">💡 ' + t.hint + '</div>' : '') + '</li>';
    });

    var allDone = autoPassed === autoTotal;
    document.documentElement.setAttribute('data-checker-score', autoPassed + '/' + autoTotal);
    var collapsed = storageGet('checker:collapsed') === '1';

    root.innerHTML = '<style>' + STYLE + '</style>' +
      '<div class="panel' + (collapsed ? ' collapsed' : '') + '">' +
      '<div class="head"><h2>' + esc(cfg.title) + '</h2>' +
      '<span class="score">' + autoPassed + '/' + autoTotal + '</span>' +
      '<button class="toggle" title="Thu gọn / mở rộng">' + (collapsed ? '▲' : '▼') + '</button></div>' +
      '<div class="body">' +
      (cfg.theory ? '<details class="theory"' + (allDone ? '' : ' open') + '><summary>📖 Lý thuyết nhanh</summary>' + cfg.theory + '</details>' : '') +
      '<strong>Nhiệm vụ</strong> <span style="color:#57606a">(sửa code, lưu file, rồi bấm Chấm lại)</span>' +
      '<ul class="tasks">' + rows.join('') + '</ul>' +
      (allDone ? '<div class="done">🎉 Bạn đã hoàn thành phần tự chấm!' +
        (cfg.next ? ' <a href="' + esc(cfg.next) + '">Sang bước tiếp theo →</a>' : ' Đây là bước cuối cùng.') + '</div>' : '') +
      '<div class="foot"><button class="reload">🔄 Chấm lại</button></div>' +
      '</div></div>';

    root.querySelector('.reload').onclick = function () { location.reload(); };
    root.querySelector('.toggle').onclick = function () {
      var p = root.querySelector('.panel');
      var c = p.classList.toggle('collapsed');
      this.textContent = c ? '▲' : '▼';
      storageSet('checker:collapsed', c ? '1' : '0');
    };
    Array.prototype.forEach.call(root.querySelectorAll('input[type=checkbox]'), function (cb) {
      cb.onchange = function () { storageSet(cb.getAttribute('data-key'), cb.checked ? '1' : '0'); };
    });
  }

  window.setupChecker = function (cfg) {
    if (document.readyState === 'complete') render(cfg);
    else window.addEventListener('load', function () { render(cfg); });
  };
})();
