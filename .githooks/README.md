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
- posts under `content/posts/**` (except `_index.md`) must declare `slug`
- Chinese / uppercase / spaces in slug → commit fails

Manual full-repo scan:

```bash
node scripts/check-content-slugs.mjs
```
