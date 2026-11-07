(function () {
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var root = document.documentElement;
  var body = document.body;

  /* ---- tema ---- */
  function isDark() {
    var t = root.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  document.getElementById('themeBtn').addEventListener('click', function () {
    var next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    store.set('theme', next);
  });

  /* ---- largura total ---- */
  if (store.get('fullWidth') === '1') body.classList.add('full');
  document.getElementById('widthBtn').addEventListener('click', function () {
    body.classList.toggle('full');
    store.set('fullWidth', body.classList.contains('full') ? '1' : '0');
  });

  /* ---- menu mobile ---- */
  function closeNav() { body.classList.remove('nav-open'); }
  document.getElementById('menuBtn').addEventListener('click', function () { body.classList.add('nav-open'); });
  document.getElementById('sideClose').addEventListener('click', closeNav);
  document.getElementById('scrim').addEventListener('click', closeNav);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNav(); });

  /* ---- grupos do menu ---- */
  var groups = Array.prototype.slice.call(document.querySelectorAll('.nav-group'));
  groups.forEach(function (g) {
    var btn = g.querySelector('.nav-toggle');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      g.classList.toggle('open');
      btn.setAttribute('aria-expanded', g.classList.contains('open'));
    });
  });
  document.querySelectorAll('.side-nav a').forEach(function (a) {
    a.addEventListener('click', function () {
      if (window.innerWidth <= 960) closeNav();
      var id = a.getAttribute('data-id');
      var el = id && document.getElementById(id);
      if (el && el.tagName !== 'MAIN') {
        el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
      }
    });
  });

  /* ---- busca no menu ---- */
  var search = document.getElementById('navSearch');
  var sideNav = document.querySelector('.side-nav');
  function norm(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  search.addEventListener('input', function () {
    var q = norm(search.value.trim());
    sideNav.classList.toggle('searching', !!q);
    groups.forEach(function (g) {
      var top = g.querySelector('.nav-top');
      var topHit = !q || norm(top.textContent).indexOf(q) > -1;
      var anyKid = false;
      g.querySelectorAll('.nav-kids li').forEach(function (li) {
        var hit = !q || topHit || norm(li.textContent).indexOf(q) > -1;
        li.classList.toggle('hidden', !hit);
        if (hit) anyKid = true;
      });
      g.classList.toggle('hidden', !(topHit || anyKid));
    });
  });
  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    if ((e.key === '/' && tag !== 'input' && tag !== 'textarea') || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      if (window.innerWidth <= 960) body.classList.add('nav-open');
      search.focus();
    }
  });

  /* ---- tarefas (salvas no navegador) ---- */
  var boxes = Array.prototype.slice.call(document.querySelectorAll('.todo-box'));
  var saved = {};
  try { saved = JSON.parse(store.get('tasks') || '{}') || {}; } catch (e) { saved = {}; }
  function paint(box) {
    var li = box.closest('li');
    if (li) li.classList.toggle('done', box.checked);
  }
  function stats() {
    var done = boxes.filter(function (b) { return b.checked; }).length;
    document.getElementById('taskStat').textContent = done + ' de ' + boxes.length + ' feitas';
    document.getElementById('taskBar').style.width = (boxes.length ? (done / boxes.length) * 100 : 0) + '%';
  }
  boxes.forEach(function (b) {
    var k = b.getAttribute('data-task');
    if (Object.prototype.hasOwnProperty.call(saved, k)) b.checked = !!saved[k];
    paint(b);
    b.addEventListener('change', function () {
      saved[k] = b.checked ? 1 : 0;
      store.set('tasks', JSON.stringify(saved));
      paint(b); stats();
    });
  });
  stats();

  /* ---- contagem regressiva ---- */
  (function () {
    var el = document.getElementById('countdown');
    var start = new Date('2027-01-08T00:00:00-03:00');
    var end = new Date('2027-01-28T23:59:59-03:00');
    var now = new Date();
    var day = 86400000;
    if (now < start) {
      var d = Math.ceil((start - now) / day);
      var w = Math.floor(d / 7);
      el.innerHTML = '<span class="tag t-orange">faltam ' + d + ' dias</span><span style="color:var(--text-2)">≈ ' + w + ' semana' + (w === 1 ? '' : 's') + '</span>';
    } else if (now <= end) {
      var n = Math.floor((now - start) / day) + 1;
      el.innerHTML = '<span class="tag t-green">em viagem · dia ' + n + ' de 20</span>';
    } else {
      el.innerHTML = '<span class="tag t-purple">viagem concluída ✨</span>';
    }
  })();

  /* ---- scrollspy + breadcrumb ---- */
  var crumb = document.getElementById('crumb');
  var links = {};
  document.querySelectorAll('.side-nav a[data-id]').forEach(function (a) { links[a.getAttribute('data-id')] = a; });
  var heads = Array.prototype.slice.call(document.querySelectorAll('.content h1[id], .content h2[id]'))
    .filter(function (h) { return links[h.id]; });
  var current = null;
  function setActive(id) {
    if (id === current) return;
    current = id;
    Object.keys(links).forEach(function (k) { links[k].classList.remove('active'); });
    var a = links[id];
    if (!a) return;
    a.classList.add('active');
    var g = a.closest('.nav-group');
    if (g && a.closest('.nav-kids') && !g.classList.contains('open')) {
      groups.forEach(function (x) { if (x !== g) x.classList.remove('open'); });
      g.classList.add('open');
    }
    var topA = g ? g.querySelector('.nav-top') : null;
    var label = id === 'top' ? 'Início' : (a.querySelector('.nav-txt') || a).textContent;
    if (topA && topA !== a) label = topA.querySelector('.nav-txt').textContent + ' / ' + label;
    crumb.textContent = label;
    if (window.innerWidth > 960) {
      var r = a.getBoundingClientRect(), nr = sideNav.getBoundingClientRect();
      if (r.top < nr.top || r.bottom > nr.bottom) a.scrollIntoView({ block: 'nearest' });
    }
  }
  var topbar = document.querySelector('.topbar');
  var toTop = document.getElementById('toTop');
  var ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.scrollY;
    topbar.classList.toggle('scrolled', y > 10);
    toTop.classList.toggle('show', y > 800);
    var id = 'top';
    for (var i = 0; i < heads.length; i++) {
      if (heads[i].getBoundingClientRect().top < 120) id = heads[i].id; else break;
    }
    setActive(id);
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
})();
