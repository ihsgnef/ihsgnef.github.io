# shifeng.me

Personal site. Markdown in, static HTML out. No Notion, no CMS, no framework —
one build script (`build.mjs`) and one stylesheet (`assets/style.css`). Same
generator as [praxis-research.org](https://github.com/praxis-research/praxis-research.github.io).

```bash
npm install
npm run serve     # build + preview on http://localhost:8080
npm run check     # build + fail on dead internal links or missing frontmatter
```

Push to `main` and GitHub Actions builds and deploys.

## Where things live

| You want to change | Edit |
| --- | --- |
| Front page, recruiting list, research focuses | `content/index.md` |
| Group members and past mentees | `content/group.md` |
| Publications | `content/publications.md` |
| Courses | `content/teaching.md` |
| FAQ | `content/faq.md` |
| Nav, site title, form URLs, email | `site.config.json` |
| Colours, fonts, spacing | `assets/style.css` (all of it is in `:root`) |
| PDFs and images | `static/docs/`, `static/img/` — served at `/docs/…`, `/img/…` |

`static/` is copied to the site root verbatim. That is what keeps the old
`ihsgnef.github.io/docs/shifeng_cv.pdf` style links working.

## Adding a publication

`content/publications.md` is plain markdown, three lines per paper. The line
breaks are significant on this page (and only this page):

```markdown
### Title of the paper
Venue 2026 [arxiv](https://arxiv.org/abs/…)
First Author, Second Author, **Shi Feng**
```

Newest first — the file order is the page order. Bold your own name; the
stylesheet renders the rest of the line muted.

## Adding a person

In `content/group.md`:

```markdown
- [Their Name](https://their-site.example) — MATS 11.0
```

The text after the em dash (` — `) becomes muted metadata. Past mentees are the
same, grouped under `###` year headings.

## Conventions worth keeping

- **`{{name}}` in a page body** is substituted from that page's frontmatter,
  falling back to `site.config.json`. `{{email}}`, `{{contactForm}}` and
  `{{interestForm}}` are the useful ones — each URL is written down once.
- **Frontmatter is a small YAML subset**: `key: value`, one per line. No
  nesting, no lists. `build.mjs` throws on anything else, deliberately.
- **Internal links end in a slash** (`/group/`, not `/group`), so
  `npm run check` can verify them.
- `npm run check` runs in CI. If it fails, the deploy does not happen.
- `dist/` is generated. Never edit it, never commit it.

## Deployment

See `DEPLOY.md`.
