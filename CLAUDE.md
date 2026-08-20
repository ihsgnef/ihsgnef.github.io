# Editing this site

This is a static site: markdown in `content/` becomes HTML in `dist/` via
`build.mjs`. Read `README.md` for the full map — it is short.

## The loop

```bash
npm install          # once
npm run check        # build + validate. Do this before every commit.
```

`npm run check` fails on dead internal links and missing frontmatter. A green
check is the bar for "done"; CI runs the same command and blocks the deploy.

## Rules

1. **Edit `content/`, `site.config.json`, or `assets/style.css`. Nothing else**,
   unless the task is explicitly about the generator.
2. **Never edit or commit `dist/`.** It is generated and gitignored.
3. **Frontmatter is `key: value` only** — no nesting, no lists, no multi-line
   values. The parser rejects anything else on purpose.
4. **Internal links end in a slash**: `/blog/some-post/`, not `/blog/some-post`.
   Without the slash the link check fails.
5. **Keep the author's words.** When porting or restructuring content, move the
   prose verbatim. Do not rewrite copy that was not the point of the task.
6. **One dependency** (`marked`). Do not add more without being asked. The value
   of this repo is that a person can read all of it in ten minutes.
7. **Do not touch `static/docs/` or `static/img/`.** Those are the legacy PDFs
   and photos from the old site, kept so existing links do not rot.

## Adding content

Every page is a single file in `content/`. There are no auto-generated index
pages on this site. To add a publication or a person, append to
`content/publications.md` or `content/group.md` — `README.md` has the exact
shape for each, and both have a formatting convention worth reading before you
edit them.

## Layouts

`layout:` in frontmatter picks the renderer in `build.mjs`: `home`, `page`,
`people`, `publications`. Adding a layout means adding a function to the
`layouts` object — it is a plain string template, not a template language.

`publications` is the one page rendered with `breaks: true`, so single newlines
become line breaks. Do not turn that on globally; the other pages rely on soft
wrapping.
