# Git hooks

This repo keeps hooks under `.githooks/` (versioned) instead of `.git/hooks/`.

## Enable (once per clone)

```bash
git config core.hooksPath .githooks
```

## What `pre-commit` does

Runs `node scripts/check-content-slugs.mjs --staged`:

- staged Markdown under `content/`
- front matter `slug` must be English URL-safe: `^[a-z0-9][a-z0-9._-]*$`
- posts under `content/{zh,en}/posts/**` (except `_index.md`) must declare `slug`
- posts dated on/after **2026-08-14** must declare a date-based `url`:
  - zh: `url: /<YY>/<MM>/<slug>/`
  - en: `url: /en/<YY>/<MM>/<slug>/`
  - `YY`/`MM` are the year/month of the post's own `date` (Asia/Shanghai)
- posts dated before 2026-08-14 keep their legacy URLs (no `url` required)
- Chinese / uppercase / spaces in slug, or a routing mismatch → commit fails

## Creating a new post

Use the scaffold (computes the correct `url` automatically):

```bash
node scripts/new-post.mjs <slug> --section penetration --title "标题" [--lang zh|en|both] [--date ISO]
```

`hugo new` also works for the default (zh) language — `archetypes/posts.md`
fills in `slug`, `translationKey`, and `url: /<YY>/<MM>/<slug>/`.

Manual full-repo scan:

```bash
node scripts/check-content-slugs.mjs
```
