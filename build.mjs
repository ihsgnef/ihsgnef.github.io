#!/usr/bin/env node
// The entire site generator. Reads `content/`, writes `dist/`.
// Run `npm run build`. Run `npm run check` to build and validate links.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, cpSync, existsSync, statSync } from 'node:fs';
import { join, dirname, basename, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'content');
const OUT = join(ROOT, 'dist');
const CHECK = process.argv.includes('--check');

const site = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));

/* ---------------------------------------------------------------- helpers */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const slug = (s) => String(s).toLowerCase().trim()
  .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');

// Frontmatter: a deliberately small YAML subset — `key: value`, one per line,
// optional single or double quotes. No nesting, no lists. Keep it that way.
function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const i = line.indexOf(':');
    if (i === -1) throw new Error(`bad frontmatter line: ${line}`);
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (/^".*"$/.test(val) || /^'.*'$/.test(val)) val = val.slice(1, -1);
    data[key] = val;
  }
  return { data, body: raw.slice(m[0].length) };
}

// {{name}} is replaced from page frontmatter first, then site config.
function interpolate(text, scope) {
  return text.replace(/\{\{(\w+)\}\}/g, (whole, key) =>
    key in scope ? scope[key] : (key in site ? site[key] : whole));
}

function formatDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  return `${months[m - 1]} ${d}, ${y}`;
}

/* ------------------------------------------------------------- markdown */

// Heading ids, so any section can be deep-linked.
marked.use({
  gfm: true,
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const id = slug(text.replace(/<[^>]+>/g, ''));
      return `<h${depth} id="${id}">${text}</h${depth}>\n`;
    },
    image({ href, title, text }) {
      const cap = text ? `<figcaption>${text}</figcaption>` : '';
      return `<figure><img src="${href}" alt="${esc(text)}"${title ? ` title="${esc(title)}"` : ''} loading="lazy">${cap}</figure>`;
    },
  },
});

const md = (text, scope = {}, opts = {}) => marked.parse(interpolate(text, scope), opts);

// Publications are three lines each — title, venue, authors — and the line
// breaks are meaningful. Everything else wants soft wrapping left alone.
const mdLines = (text, scope = {}) => md(text, scope, { breaks: true });

// `Name — role` inside a list item: the tail becomes muted metadata.
function splitMeta(html) {
  return html.replace(/(<(li|p)>)([\s\S]*?)(<\/\2>)/g, (whole, open, tag, inner, close) => {
    const i = inner.indexOf(' — ');
    if (i === -1) return whole;
    return `${open}${inner.slice(0, i)}<span class="meta">${inner.slice(i + 3)}</span>${close}`;
  });
}

/* --------------------------------------------------------------- loading */

function loadDir(dir) {
  const abs = join(SRC, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).filter((f) => extname(f) === '.md').map((f) => {
    const raw = readFileSync(join(abs, f), 'utf8');
    const { data, body } = parseFrontmatter(raw);
    const name = basename(f, '.md');
    return { ...data, slug: name, url: `/${dir}/${name}/`, body, source: `content/${dir}/${f}` };
  });
}

function loadPage(name) {
  const file = join(SRC, `${name}.md`);
  const { data, body } = parseFrontmatter(readFileSync(file, 'utf8'));
  const url = name === 'index' ? '/' : `/${name}/`;
  return { ...data, slug: name, url, body, source: `content/${name}.md` };
}

/* ---------------------------------------------------------------- layout */

function shell(page, inner) {
  const nav = site.nav.map((n) => {
    const active = n.href === page.url ||
      (n.href !== '/' && page.url.startsWith(n.href)) ? ' class="active"' : '';
    return `<a href="${n.href}"${active}>${esc(n.label)}</a>`;
  }).join('\n        ');

  const title = page.url === '/' ? site.title : `${page.title} — ${site.title}`;
  const desc = page.summary || site.description;
  const canonical = site.url + page.url;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="${esc(site.title)}">
<meta property="og:type" content="${page.date ? 'article' : 'website'}">
<meta name="twitter:card" content="summary">
<link rel="alternate" type="application/rss+xml" title="${esc(site.title)}" href="/feed.xml">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/style.css">
</head>
<body>
<header class="site-header">
  <div class="container">
    <a class="brand" href="/">${esc(site.title)}</a>
    <nav class="site-nav">
        ${nav}
    </nav>
  </div>
</header>
<main class="container">
${inner}
</main>
<footer class="site-footer">
  <div class="container">
    <p>${esc(site.footerNote)} · <a href="${site.contactForm}">Contact</a> · <a href="/feed.xml">RSS</a></p>
  </div>
</footer>
</body>
</html>
`;
}

/* --------------------------------------------------------------- layouts */

const layouts = {
  home: (page) => `<article class="content home">
<h1>${esc(site.title)}</h1>
${md(page.body, page)}
</article>`,

  page: (page) => `<article class="content">
<h1>${esc(page.title)}</h1>
${md(page.body, page)}
</article>`,

  publications: (page) => `<article class="content publications">
<h1>${esc(page.title)}</h1>
${mdLines(page.body, page)}
</article>`,

  people: (page) => `<article class="content people">
<h1>${esc(page.title)}</h1>
${splitMeta(md(page.body, page))}
</article>`,

  'blog-index': (page, ctx) => {
    const items = ctx.posts.map((p) => `  <li>
    <h2><a href="${p.url}">${esc(p.title)}</a></h2>
    <p class="byline">${esc(p.authors || '')}${p.date ? ` · <time datetime="${p.date}">${formatDate(p.date)}</time>` : ''}</p>
    ${p.summary ? `<p class="summary">${esc(p.summary)}</p>` : ''}
  </li>`).join('\n');
    return `<article class="content">
<h1>${esc(page.title)}</h1>
${md(page.body, page)}
${items ? `<ul class="post-list">
${items}
</ul>` : '<p class="summary">No posts yet.</p>'}
</article>`;
  },

  post: (page) => `<article class="content post">
<p class="backlink"><a href="/blog/">← All posts</a></p>
<h1>${esc(page.title)}</h1>
<p class="byline">${esc(page.authors || '')}${page.date ? ` · <time datetime="${page.date}">${formatDate(page.date)}</time>` : ''}</p>
${page.venue ? `<p class="venue">${esc(page.venue)}</p>` : ''}
${page.paper_url ? `<p class="paper-link"><a href="${page.paper_url}">Read the paper →</a></p>` : ''}
${page.draft_note ? `<p class="note">${esc(page.draft_note)}</p>` : ''}
${md(page.body, page)}
</article>`,
};

/* ----------------------------------------------------------------- write */

const written = [];
function emit(url, html) {
  const rel = url === '/' ? 'index.html' : join(url.replace(/^\/|\/$/g, ''), 'index.html');
  const dest = join(OUT, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, html);
  written.push(url);
}

function render(page, ctx) {
  const layout = layouts[page.layout || 'page'];
  if (!layout) throw new Error(`${page.source}: unknown layout "${page.layout}"`);
  emit(page.url, shell(page, layout(page, ctx)));
}

/* ------------------------------------------------------------------ main */

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const posts = loadDir('blog').sort((a, b) => String(b.date).localeCompare(String(a.date)));
const ctx = { posts };

const pages = readdirSync(SRC).filter((f) => extname(f) === '.md').map((f) => loadPage(basename(f, '.md')));

for (const p of pages) render(p, ctx);
for (const p of posts) render({ ...p, layout: 'post' }, ctx);

// 404
emit('/404', shell({ url: '/404/', title: 'Not found' },
  `<article class="content"><h1>Not found</h1><p>That page doesn't exist. Try <a href="/">the front page</a>.</p></article>`));
// GitHub Pages serves /404.html for unmatched paths, not /404/index.html.
cpSync(join(OUT, '404/index.html'), join(OUT, '404.html'));
rmSync(join(OUT, '404'), { recursive: true, force: true });

cpSync(join(ROOT, 'assets'), join(OUT, 'assets'), { recursive: true });
if (existsSync(join(ROOT, 'static'))) cpSync(join(ROOT, 'static'), OUT, { recursive: true });

// RSS
const rssItems = posts.map((p) => `  <item>
    <title>${esc(p.title)}</title>
    <link>${site.url}${p.url}</link>
    <guid isPermaLink="true">${site.url}${p.url}</guid>
    ${p.date ? `<pubDate>${new Date(`${p.date}T12:00:00Z`).toUTCString()}</pubDate>` : ''}
    <description>${esc(p.summary || '')}</description>
  </item>`).join('\n');
writeFileSync(join(OUT, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>${esc(site.title)}</title>
  <link>${site.url}/</link>
  <description>${esc(site.description)}</description>
${rssItems}
</channel></rss>
`);

// Sitemap + robots
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${written.filter((u) => u !== '/404').map((u) => `  <url><loc>${site.url}${u}</loc></url>`).join('\n')}
</urlset>
`);
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);
writeFileSync(join(OUT, '.nojekyll'), '');

console.log(`built ${written.length} pages -> dist/`);
for (const u of written) console.log(`  ${u}`);

/* ----------------------------------------------------------------- check */

if (CHECK) {
  const problems = [];
  const walk = (dir) => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
  const files = walk(OUT);
  const exists = new Set(files.map((f) => '/' + relative(OUT, f).split('/').join('/')));

  for (const f of files.filter((f) => f.endsWith('.html'))) {
    const html = readFileSync(f, 'utf8');
    const where = '/' + relative(OUT, f);
    for (const m of html.matchAll(/(?:href|src)="(\/[^"#]*)"/g)) {
      const href = m[1];
      const candidates = [href, href + 'index.html', href + '/index.html', href.replace(/\/$/, '') + '/index.html'];
      if (!candidates.some((c) => exists.has(c))) problems.push(`${where}: dead internal link ${href}`);
    }
  }
  // Markdown that failed to parse leaves its source syntax in the output.
  for (const f of files.filter((f) => f.endsWith('.html'))) {
    const text = readFileSync(f, 'utf8').replace(/<[^>]+>/g, '');
    for (const m of text.matchAll(/\]\([^)\n]{0,120}\)/g)) {
      problems.push(`/${relative(OUT, f)}: unparsed markdown link "${m[0].slice(0, 60)}"`);
    }
  }

  for (const p of posts) {
    if (!p.date) problems.push(`${p.source}: missing "date"`);
    if (!p.title) problems.push(`${p.source}: missing "title"`);
  }
  if (problems.length) {
    console.error(`\ncheck failed (${problems.length}):`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log('\ncheck passed: no dead internal links, all frontmatter present');
}
