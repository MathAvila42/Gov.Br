// Gera public/index.html a partir de content/roteiro.md, no estilo Notion.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked, Renderer } from 'marked';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let md = readFileSync(join(root, 'content/roteiro.md'), 'utf8');

// Cada linha de citação vira um parágrafo próprio (um callout por linha).
md = md.replace(/^(>.*)\n(?=>)/gm, '$1\n>\n');

const EMOJI = /^((?:\p{Regional_Indicator}{2})|(?:\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*))\s*/u;

const slugCount = new Map();
function slugify(text) {
  let s = text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'secao';
  const n = slugCount.get(s) || 0;
  slugCount.set(s, n + 1);
  return n ? `${s}-${n + 1}` : s;
}
const stripTags = (h) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

function calloutColor(icon) {
  if (/[🔴❌⛔]/u.test(icon)) return 'red';
  if (/⚠/u.test(icon)) return 'orange';
  if (/[💡⭐🌇🌅]/u.test(icon)) return 'yellow';
  if (/[✅🆓💰📉💳]/u.test(icon)) return 'green';
  if (/[ℹ🚉🚇🗺🚌🚆✈🛫⏱⏰]/u.test(icon)) return 'blue';
  if (/[🍛🍜🍣🍲🍵🐟🍱🍽🍁🍢]/u.test(icon)) return 'brown';
  if (/[🌙🌬🐱♻🔁]/u.test(icon)) return 'purple';
  return 'gray';
}

const toc = []; // {depth, id, icon, label}
let taskId = 0;
let pageTitle = '';
let seenTitle = false;

const renderer = new Renderer();
const base = new Renderer();

renderer.heading = function ({ tokens, depth }) {
  const html = this.parser.parseInline(tokens);
  const plain = stripTags(html).trim();
  if (depth === 1 && !seenTitle) {
    seenTitle = true;
    pageTitle = plain;
    return ''; // o título é renderizado no cabeçalho da página
  }
  const id = slugify(plain);
  const m = plain.match(EMOJI);
  const icon = m ? m[1] : '';
  const label = m ? plain.slice(m[0].length) : plain;
  if (depth <= 2) toc.push({ depth, id, icon, label });
  const cls = /^📍/u.test(plain) ? ' class="day"' : '';
  return `<h${depth} id="${id}"${cls}><a class="anchor" href="#${id}" aria-label="Link para esta seção">#</a>${html}</h${depth}>\n`;
};

renderer.blockquote = function ({ tokens }) {
  let out = '';
  for (const t of tokens) {
    if (t.type !== 'paragraph') { out += this.parser.parse([t]); continue; }
    let html = this.parser.parseInline(t.tokens).trim();
    let icon = '💬';
    const m = html.match(EMOJI);
    if (m) { icon = m[1]; html = html.slice(m[0].length); }
    else {
      const b = html.match(/^<strong>/) && html.slice(8).match(EMOJI);
      if (b) { icon = b[1]; html = '<strong>' + html.slice(8 + b[0].length); }
    }
    out += `<div class="callout c-${calloutColor(icon)}"><span class="callout-icon">${icon}</span><div class="callout-body">${html}</div></div>\n`;
  }
  return out;
};

renderer.checkbox = function ({ checked }) {
  taskId += 1;
  return `<input type="checkbox" class="todo-box" data-task="t${taskId}" data-default="${checked ? 1 : 0}"${checked ? ' checked' : ''} aria-label="Marcar como feito"> `;
};

renderer.listitem = function (item) {
  const html = base.listitem.call(this, item);
  if (!item.task) return html;
  return html.replace(/^<li>/, `<li class="todo${item.checked ? ' done' : ''}">`);
};

renderer.list = function (token) {
  const html = base.list.call(this, token);
  if (token.items.some((i) => i.task)) return html.replace(/^<(ul|ol)/, '<$1 class="todo-list"');
  return html;
};

renderer.table = function (token) {
  const html = base.table.call(this, token);
  const head = token.header.map((h) => h.text).join(' ');
  const cols = token.header.length;
  const kind = /Hora/.test(head) ? ' t-schedule' : /Destino/.test(head) ? ' t-route' : '';
  const empty = token.header.every((h) => !h.text.trim()) ? ' t-props' : '';
  return `<div class="table-wrap${kind}${empty}" data-cols="${cols}">${html}</div>\n`;
};

renderer.link = function (token) {
  const { href } = token;
  const text = this.parser.parseInline(token.tokens);
  if (/google\.[a-z.]+\/maps/.test(href)) {
    return `<a class="maps-btn" href="${href}" target="_blank" rel="noopener"><span class="maps-ico">🗺️</span><span>${text.replace(EMOJI, '')}</span><span class="maps-arrow">↗</span></a>`;
  }
  const ext = /^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '';
  return `<a href="${href}"${ext}>${text}</a>`;
};

renderer.paragraph = function ({ tokens }) {
  const html = this.parser.parseInline(tokens);
  // Parágrafo com só um botão do Maps (o emoji 🗺️ já vem no botão)
  const only = html.replace(/^\s*🗺️\s*/u, '');
  if (/^<a class="maps-btn"[^]*<\/a>$/.test(only.trim())) return `<p class="maps-line">${only}</p>\n`;
  if (/^<strong>🚇 Deslocamentos do dia<\/strong>$/u.test(html.trim())) return `<p class="block-label">🚇 Deslocamentos do dia</p>\n`;
  return `<p>${html}</p>\n`;
};

renderer.hr = () => '<div class="divider" role="separator"></div>\n';

const marked = new Marked({ gfm: true, renderer });
const body = marked.parse(md);

// Navegação lateral agrupada por H1
const groups = [];
for (const e of toc) {
  if (e.depth === 1) groups.push({ ...e, children: [] });
  else if (groups.length) groups[groups.length - 1].children.push(e);
  else groups.push({ ...e, children: [] });
}
// Os dias 09–14 vêm logo após "Como ler as tabelas"; no menu, ficam em "Tóquio — Parte 1".
{
  const how = groups.findIndex((g) => /^COMO LER/.test(g.label));
  const tokyo = groups.findIndex((g) => /^TÓQUIO — PARTE 1/.test(g.label));
  if (how > -1 && tokyo > -1) {
    groups[tokyo].children.push(...groups[how].children);
    groups[how].children = [];
  }
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const nav = groups.map((g) => {
  const kids = g.children.length
    ? `<ul class="nav-kids">${g.children.map((c) => `<li><a href="#${c.id}" data-id="${c.id}"><span class="nav-ico">${c.icon || '•'}</span><span class="nav-txt">${esc(c.label)}</span></a></li>`).join('')}</ul>`
    : '';
  const toggle = g.children.length ? `<button class="nav-toggle" aria-label="Expandir ${esc(g.label)}" aria-expanded="false"><svg viewBox="0 0 12 12" width="10" height="10"><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : '<span class="nav-toggle-spacer"></span>';
  return `<li class="nav-group">${toggle}<a href="#${g.id}" data-id="${g.id}" class="nav-top"><span class="nav-ico">${g.icon || '📄'}</span><span class="nav-txt">${esc(g.label)}</span></a>${kids}</li>`;
}).join('\n');

const cleanTitle = pageTitle.replace(EMOJI, '');
const css = readFileSync(join(root, 'src/styles.css'), 'utf8');
const js = readFileSync(join(root, 'src/app.js'), 'utf8');

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Japão 2027</title>
<meta name="description" content="${esc(cleanTitle)} — Matheus & Monique. Roteiro dia a dia, reservas, hospedagem, transporte e custos.">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#191919" media="(prefers-color-scheme: dark)">
<meta property="og:title" content="Japão 2027 — Matheus & Monique">
<meta property="og:description" content="${esc(cleanTitle)}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='white'/><circle cx='50' cy='50' r='26' fill='%23bc002d'/></svg>">
<script>(function(){try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>
<style>${css}</style>
</head>
<body>
<div class="app">
  <aside class="sidebar" id="sidebar" aria-label="Navegação">
    <div class="side-head">
      <div class="workspace"><span class="ws-avatar">日</span><span class="ws-name">Matheus & Monique</span></div>
      <button class="icon-btn side-close" id="sideClose" aria-label="Fechar menu">✕</button>
    </div>
    <div class="side-search">
      <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M13 13l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      <input id="navSearch" type="search" placeholder="Buscar seção…" autocomplete="off" aria-label="Buscar seção">
      <kbd class="kbd">/</kbd>
    </div>
    <div class="side-label">Roteiro</div>
    <nav class="side-nav"><ul class="nav-root">
      <li class="nav-group"><span class="nav-toggle-spacer"></span><a href="#top" data-id="top" class="nav-top"><span class="nav-ico">🇯🇵</span><span class="nav-txt">Início</span></a></li>
${nav}
    </ul></nav>
    <div class="side-foot">Câmbio ¥1.000 ≈ R$ 33 · 🔸 = reconfirmar</div>
  </aside>
  <div class="scrim" id="scrim"></div>

  <div class="main">
    <header class="topbar">
      <button class="icon-btn menu-btn" id="menuBtn" aria-label="Abrir menu"><svg viewBox="0 0 20 20" width="18" height="18"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
      <div class="crumbs"><span class="crumb-ico">🇯🇵</span><span class="crumb-root">Japão 2027</span><span class="crumb-sep">/</span><span class="crumb-cur" id="crumb">Início</span></div>
      <div class="top-actions">
        <button class="icon-btn" id="widthBtn" aria-label="Alternar largura total" title="Largura total"><svg viewBox="0 0 20 20" width="16" height="16"><path d="M2 10h16M5 7l-3 3 3 3M15 7l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button class="icon-btn" id="themeBtn" aria-label="Alternar tema claro/escuro" title="Tema"><svg class="i-sun" viewBox="0 0 20 20" width="16" height="16"><circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><svg class="i-moon" viewBox="0 0 20 20" width="16" height="16"><path d="M16.5 12.6A7 7 0 0 1 7.4 3.5a7 7 0 1 0 9.1 9.1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg></button>
      </div>
    </header>

    <main class="page" id="top">
      <div class="cover" role="img" aria-label="Capa: sol vermelho sobre o Monte Fuji">
        <svg viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6d7c3"/><stop offset=".65" stop-color="#f3b8a0"/><stop offset="1" stop-color="#e98f7f"/></linearGradient>
            <linearGradient id="mt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d4a6b"/><stop offset="1" stop-color="#26304a"/></linearGradient>
          </defs>
          <rect width="1200" height="300" fill="url(#sky)"/>
          <circle cx="820" cy="120" r="74" fill="#bc002d" opacity=".92"/>
          <path d="M0 300 L0 250 C140 236 260 246 380 232 L520 120 C548 98 572 98 600 120 L740 232 C860 246 1020 236 1200 250 L1200 300 Z" fill="url(#mt)"/>
          <path d="M520 120 C548 98 572 98 600 120 L628 143 L606 136 L590 150 L572 134 L552 151 L536 137 L512 146 Z" fill="#f4f1ec"/>
          <path d="M0 300 L0 272 C200 262 420 280 600 268 C800 256 1000 278 1200 266 L1200 300Z" fill="#1c2438" opacity=".9"/>
        </svg>
      </div>
      <div class="page-inner">
        <div class="page-icon" aria-hidden="true">🇯🇵</div>
        <h1 class="page-title">${esc(cleanTitle)}</h1>

        <div class="props" role="list">
          <div class="prop" role="listitem"><span class="prop-k"><span>📅</span>Datas</span><span class="prop-v">08/01 → 28/01/2027</span></div>
          <div class="prop" role="listitem"><span class="prop-k"><span>👥</span>Viajantes</span><span class="prop-v"><span class="tag t-pink">Matheus</span><span class="tag t-purple">Monique</span></span></div>
          <div class="prop" role="listitem"><span class="prop-k"><span>🏨</span>Hospedagem</span><span class="prop-v">19 noites + madrugada do voo</span></div>
          <div class="prop" role="listitem"><span class="prop-k"><span>🗺️</span>Cidades</span><span class="prop-v"><span class="tag t-red">Tóquio</span><span class="tag t-blue">Kawaguchiko</span><span class="tag t-green">Hakone</span><span class="tag t-orange">Kyoto</span><span class="tag t-yellow">Osaka</span></span></div>
          <div class="prop" role="listitem"><span class="prop-k"><span>⏳</span>Contagem</span><span class="prop-v" id="countdown">—</span></div>
          <div class="prop" role="listitem"><span class="prop-k"><span>☑️</span>Reservas</span><span class="prop-v"><span id="taskStat">—</span><span class="bar"><span class="bar-fill" id="taskBar"></span></span></span></div>
        </div>

        <article class="content">
${body}
        </article>
        <footer class="page-foot">Japão 2027 · Matheus & Monique · as caixinhas de reserva ficam salvas neste navegador</footer>
      </div>
    </main>
  </div>
</div>
<button class="to-top" id="toTop" aria-label="Voltar ao topo">↑</button>
<script>${js}</script>
</body>
</html>`;

mkdirSync(join(root, 'public'), { recursive: true });
writeFileSync(join(root, 'public/index.html'), html);
console.log(`OK: public/index.html (${(html.length / 1024).toFixed(0)} KB, ${toc.length} seções, ${taskId} tarefas)`);
