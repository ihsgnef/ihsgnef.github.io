#!/usr/bin/env node
// Copies praxis-research.org's front-page listing into this site, and its
// local post pages along with it, so the home page lists them under the bio
// and shifeng.me/grafting (etc.) serves a copy of the post.
//
//   npm run sync-praxis                      # reads ../praxis-website at origin/main
//   node bin/sync-praxis.mjs <checkout> [ref]
//   npm run check
//
// Writes content/praxis.json (the listing, without authors or summaries),
// static/<slug>.html for every post that lives on the lab site, the figures
// those posts use, and assets/design.css + assets/outline.js verbatim. Each
// copied page gets this site's header and footer, and a canonical link to the
// original, so search engines treat praxis-research.org as the source.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PRAXIS = resolve(process.argv[2] || join(ROOT, '..', 'praxis-website'));
const REF = process.argv[3] || 'origin/main';
const ORIGIN = 'https://praxis-research.org';
const site = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));

const git = (...args) => execFileSync('git', ['-C', PRAXIS, ...args], { maxBuffer: 256 << 20 });
if (REF.startsWith('origin/')) git('fetch', '-q', 'origin');
const show = (path) => git('show', `${REF}:${path}`);
const put = (rel, data) => {
  mkdirSync(dirname(join(ROOT, rel)), { recursive: true });
  writeFileSync(join(ROOT, rel), data);
};

// The listing: what the lab's front page shows, minus authors and summaries.
const keep = ({ url, title, date, year, venue, note, order }) => ({ url, title, date, year, venue, note, order });
const posts = JSON.parse(show('content/blog.json')).map(keep);
const papers = JSON.parse(show('content/papers.json')).map(keep);
put('content/praxis.json', JSON.stringify({ posts, papers }, null, 2) + '\n');

// This site's chrome, as build.mjs writes it.
const header = `<header class="site-header">
  <div class="container">
    <a class="brand" href="/">${site.title}</a>
    <nav class="site-nav">
        ${site.nav.map((n) => `<a href="${n.href}">${n.label}</a>`).join('\n        ')}
    </nav>
  </div>
</header>`;
const footer = (url) => `<footer class="site-footer">
  <div class="container">
    <p>${site.footerNote} · First published on <a href="${url}">Praxis Research</a></p>
  </div>
</footer>`;

function swapOnce(html, re, replacement, what, slug) {
  const hits = html.match(new RegExp(re.source, 'g')) || [];
  if (hits.length !== 1) throw new Error(`static/${slug}.html: expected one ${what}, found ${hits.length}`);
  return html.replace(re, replacement);
}

const figureDirs = new Set();
const local = [...posts, ...papers].filter((p) => p.url.startsWith('/'));
for (const p of local) {
  const slug = p.url.replace(/^\/|\/$/g, '');
  const original = `${ORIGIN}/${slug}`;
  let html = show(`static/${slug}.html`).toString('utf8');
  html = swapOnce(html, /<header class="site-header">[\s\S]*?<\/header>/, header, 'site header', slug);
  html = swapOnce(html, /<footer class="site-footer">[\s\S]*?<\/footer>/, footer(original), 'site footer', slug);
  if (!/<link rel="canonical"/.test(html)) {
    html = html.replace(/(<meta name="viewport"[^>]*>)/, `$1\n<link rel="canonical" href="${original}">`);
  }
  for (const m of html.matchAll(/\/figures\/([\w-]+)\//g)) figureDirs.add(m[1]);
  put(`static/${slug}.html`, html);
  console.log(`  ${p.url}`);
}

for (const dir of figureDirs) {
  const files = git('ls-tree', '-r', '--name-only', REF, `static/figures/${dir}`).toString().trim().split('\n');
  for (const f of files.filter(Boolean)) put(f, show(f));
  console.log(`  /figures/${dir}/ (${files.length} files)`);
}

put('assets/design.css', show('assets/design.css'));
put('assets/outline.js', show('assets/outline.js'));

const sha = git('rev-parse', '--short', REF).toString().trim();
console.log(`synced ${posts.length} posts, ${papers.length} papers, ${local.length} pages from praxis-website@${sha}`);
