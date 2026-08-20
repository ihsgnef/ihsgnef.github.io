// Generates a single self-contained preview of the built site, for review.
// `node preview.mjs [outfile]`. Not part of the site; nothing links to it.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, 'dist');
const dest = process.argv[2] || join(ROOT, 'preview.html');

const css = readFileSync(join(OUT, 'assets/style.css'), 'utf8');

// Pull the light and dark token blocks out of the stylesheet so the preview can
// force either one, instead of following the viewer's OS setting.
const darkTokens = css.match(/@media \(prefers-color-scheme: dark\) \{\s*:root \{([\s\S]*?)\}\s*\}/)[1];
const lightTokens = css.match(/^:root \{([\s\S]*?)\n\}/m)[1];

const PAGES = [
  ['About', '/'],
  ['Group', '/group/'],
  ['Publications', '/publications/'],
  ['Teaching', '/teaching/'],
  ['FAQ', '/faq/'],
  ['Not found', '/404.html'],
];

const docs = {};
for (const [, url] of PAGES) {
  const file = url.endsWith('.html') ? url.slice(1) : join(url === '/' ? '' : url.slice(1), 'index.html');
  let html = readFileSync(join(OUT, file), 'utf8');
  html = html
    .replace('<link rel="stylesheet" href="/assets/style.css">',
      `<style>${css}</style><style id="mode"></style>`)
    .replace(/<link rel="icon"[^>]*>/, '');
  docs[url] = html;
}

const tabs = PAGES.map(([label, url], i) =>
  `<button class="tab${i === 0 ? ' on' : ''}" data-url="${url}">${label}</button>`).join('');

writeFileSync(dest, `<title>New shifeng.me</title>
<style>
  :root {
    --shell: #eeeeee; --panel: #ffffff; --ink: #1a1a1a; --dim: #666666;
    --line: #dddddd; --accent: #0645ad;
    --ui: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  }
  :root:not([data-theme="light"]) { }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --shell: #111111; --panel: #1a1a1a; --ink: #e0e0e0; --dim: #999999;
      --line: #333333; --accent: #7aa6ff;
    }
  }
  :root[data-theme="dark"] {
    --shell: #111111; --panel: #1a1a1a; --ink: #e0e0e0; --dim: #999999;
    --line: #333333; --accent: #7aa6ff;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--shell); color: var(--ink);
    font-family: var(--ui); display: flex; flex-direction: column; min-height: 100vh;
  }
  .bar {
    position: sticky; top: 0; z-index: 5; background: var(--panel);
    border-bottom: 1px solid var(--line);
    display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1.25rem;
    padding: 0.7rem 1.1rem;
  }
  .label {
    font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.11em;
    color: var(--dim); white-space: nowrap;
  }
  .tabs { display: flex; flex-wrap: wrap; gap: 0.3rem; flex: 1; }
  .tab {
    font: inherit; font-size: 0.8rem; cursor: pointer;
    background: none; border: 1px solid transparent; border-radius: 4px;
    color: var(--dim); padding: 0.28rem 0.6rem;
  }
  .tab:hover { color: var(--ink); }
  .tab.on { color: var(--accent); border-color: var(--line); background: var(--shell); }
  .tab:focus-visible, .mode button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .mode { display: flex; border: 1px solid var(--line); border-radius: 4px; overflow: hidden; }
  .mode button {
    font: inherit; font-size: 0.72rem; cursor: pointer; background: none; border: 0;
    color: var(--dim); padding: 0.3rem 0.7rem;
  }
  .mode button.on { background: var(--accent); color: var(--panel); }
  .stage { flex: 1; padding: 1.1rem; display: flex; }
  iframe {
    width: 100%; min-height: 78vh; border: 1px solid var(--line); border-radius: 5px;
    background: #fff; display: block;
  }
  .foot {
    padding: 0.75rem 1.1rem 1.4rem; font-size: 0.72rem; color: var(--dim); line-height: 1.6;
  }
  .foot code { font-size: 0.95em; }
</style>
<div class="bar">
  <span class="label">shifeng.me · preview</span>
  <div class="tabs">${tabs}</div>
  <div class="mode">
    <button data-mode="light" class="on">Light</button>
    <button data-mode="dark">Dark</button>
  </div>
</div>
<div class="stage"><iframe id="frame" title="Site preview"></iframe></div>
<p class="foot">Rendered from the real build output — this is the same HTML the deployed site serves.
Copy is unchanged from the current shifeng.me, except that links to the removed Sprints page now point at praxis-research.org.</p>
<script>
  const DOCS = ${JSON.stringify(docs)};
  const LIGHT = ${JSON.stringify(lightTokens)};
  const DARK = ${JSON.stringify(darkTokens)};
  let url = '/', mode = 'light';

  function paint() {
    const frame = document.getElementById('frame');
    frame.srcdoc = DOCS[url].replace('<style id="mode"></style>',
      '<style>:root{' + (mode === 'dark' ? DARK : LIGHT) + '}</style>');
  }
  document.getElementById('frame').addEventListener('load', (e) => {
    try {
      const d = e.target.contentDocument;
      if (d) e.target.style.height = Math.max(d.body.scrollHeight + 40, 500) + 'px';
    } catch (_) { /* height stays at the CSS minimum */ }
  });
  document.querySelectorAll('.tab').forEach((b) => b.onclick = () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === b));
    url = b.dataset.url; paint();
  });
  document.querySelectorAll('.mode button').forEach((b) => b.onclick = () => {
    document.querySelectorAll('.mode button').forEach((x) => x.classList.toggle('on', x === b));
    mode = b.dataset.mode; paint();
  });
  paint();
</script>
`);
console.log(`preview -> ${relative(ROOT, dest)} (${(statSync(dest).size / 1024).toFixed(0)} KB)`);
