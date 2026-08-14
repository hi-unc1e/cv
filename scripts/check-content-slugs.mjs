#!/usr/bin/env node
/**
 * Enforce content routing rules on Hugo content Markdown.
 *
 * Rules:
 * - slug must match /^[a-z0-9][a-z0-9._-]*$/ (no uppercase, spaces, CJK)
 * - posts under content/{zh,en}/posts/** (except _index.md) must declare slug
 * - posts dated on/after ROUTING_START must declare a date-based URL:
 *     zh: /web/<YY>/<MM>/<slug>/
 *     en: /en/web/<YY>/<MM>/<slug>/
 *   where YY/MM come from the post's own `date` (Asia/Shanghai).
 *   Posts dated before ROUTING_START keep their legacy URLs (compatibility).
 *
 * Usage:
 *   node scripts/check-content-slugs.mjs              # scan all content Markdown
 *   node scripts/check-content-slugs.mjs --staged     # only git staged content files
 *   node scripts/check-content-slugs.mjs path/a.md    # explicit paths
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SAFE_SLUG = /^[a-z0-9][a-z0-9._-]*$/;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The /web/<YY>/<MM>/<slug>/ routing convention applies to posts published
// from this date on. Older posts keep their legacy URLs untouched.
export const ROUTING_START = new Date("2026-08-14T00:00:00+08:00");

function decodeScalar(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1).replace(/"$/, "");
    }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }
  // strip inline comments like: slug: foo # note
  return trimmed.replace(/\s+#.*$/, "").trim();
}

function readFrontMatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return match ? match[1] : null;
}

function readScalar(frontMatter, key) {
  const match = frontMatter.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  if (!match) return undefined;
  return decodeScalar(match[1]);
}

function readSlug(frontMatter) {
  const slug = readScalar(frontMatter, "slug");
  return slug === "" ? undefined : slug;
}

function readDate(frontMatter) {
  const raw = readScalar(frontMatter, "date");
  if (typeof raw !== "string" || raw === "") return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isContentMarkdown(relPath) {
  const normalized = relPath.split(path.sep).join("/");
  return (
    normalized.startsWith("content/") &&
    normalized.endsWith(".md") &&
    !normalized.endsWith("/_index.md") &&
    normalized !== "content/_index.md"
  );
}

function isPostPage(relPath) {
  const normalized = relPath.split(path.sep).join("/");
  return (
    /^content\/(zh|en)\/posts\/.+\.(md|markdown)$/i.test(normalized) &&
    !normalized.endsWith("/_index.md")
  );
}

function languageOfPost(relPath) {
  return relPath.split(path.sep).join("/").startsWith("content/en/") ? "en" : "zh";
}

export function expectedPostUrl(lang, slug, date) {
  // Format in Asia/Shanghai regardless of host timezone.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "2-digit",
    month: "2-digit",
  }).formatToParts(date);
  const yy = parts.find((p) => p.type === "year").value;
  const mm = parts.find((p) => p.type === "month").value;
  const prefix = lang === "en" ? "/en" : "";
  return `${prefix}/web/${yy}/${mm}/${slug}/`;
}

export function checkMarkdown(relPath, markdown) {
  const rel = relPath.split(path.sep).join("/");
  const errors = [];

  const frontMatter = readFrontMatter(markdown);
  if (frontMatter === null) {
    if (isPostPage(rel)) {
      errors.push(`${rel}: missing YAML front matter (posts require English slug)`);
    }
    return errors;
  }

  const slug = readSlug(frontMatter);
  if (slug === undefined) {
    if (isPostPage(rel)) {
      errors.push(
        `${rel}: missing front matter \`slug\` — posts must set an English URL-safe slug (e.g. my-post-name)`,
      );
    }
    return errors;
  }

  if (typeof slug !== "string" || !SAFE_SLUG.test(slug)) {
    const hasCjk = /[\u3400-\u9fff\uf900-\ufaff]/.test(String(slug));
    const hint = hasCjk
      ? "contains Chinese/CJK characters"
      : "must be lowercase English URL-safe: start with [a-z0-9], then only [a-z0-9._-]";
    errors.push(`${rel}: invalid slug ${JSON.stringify(slug)} — ${hint}`);
    return errors;
  }

  // Routing convention: /web/<YY>/<MM>/<slug>/ for posts published since ROUTING_START.
  if (isPostPage(rel)) {
    const date = readDate(frontMatter);
    if (date !== undefined && date >= ROUTING_START) {
      const url = readScalar(frontMatter, "url");
      const expected = expectedPostUrl(languageOfPost(rel), slug, date);
      if (url === undefined || url === "") {
        errors.push(
          `${rel}: dated ${date.toISOString().slice(0, 10)} — new posts must declare \`url: ${expected}\` (/web/<YY>/<MM>/<slug>/ convention)`,
        );
      } else if (typeof url === "string" && url.replace(/\/?$/, "/") !== expected) {
        errors.push(
          `${rel}: url ${JSON.stringify(url)} does not match routing convention — expected ${expected}`,
        );
      }
    }
  }

  return errors;
}

export function checkFile(absPath) {
  const rel = path.relative(ROOT, absPath);
  let markdown;
  try {
    markdown = fs.readFileSync(absPath, "utf8");
  } catch (err) {
    return [`${rel}: cannot read file (${err.message})`];
  }
  return checkMarkdown(rel, markdown);
}

function walkMarkdown(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkMarkdown(full, out);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

function listStagedContentFiles() {
  const output = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z", "--", "content"],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (!output) return [];
  return output
    .split("\0")
    .filter(Boolean)
    .filter((p) => isContentMarkdown(p))
    .map((p) => path.join(ROOT, p));
}

function main(argv) {
  const args = argv.slice(2);
  const staged = args.includes("--staged");
  const paths = args.filter((a) => a !== "--staged");

  let files;
  if (paths.length > 0) {
    files = paths.map((p) => path.resolve(ROOT, p)).filter((p) => fs.existsSync(p));
  } else if (staged) {
    files = listStagedContentFiles();
  } else {
    files = walkMarkdown(path.join(ROOT, "content")).filter((p) =>
      isContentMarkdown(path.relative(ROOT, p)),
    );
  }

  if (files.length === 0) {
    if (staged) {
      // nothing to check in this commit
      process.exit(0);
    }
    console.error("No content Markdown files to check.");
    process.exit(0);
  }

  const allErrors = [];
  for (const file of files) {
    allErrors.push(...checkFile(file));
  }

  if (allErrors.length > 0) {
    console.error("✖ Content routing check failed:\n");
    for (const err of allErrors) {
      console.error(`  - ${err}`);
    }
    console.error(`
Rule: front matter slug must match /^[a-z0-9][a-z0-9._-]*$/
  ✓ slug: agents-next-problem-is-action-boundary
  ✗ slug: Agent运行时防护
  ✗ slug: My Post
  ✗ (missing slug on content/{zh,en}/posts/** pages)

Posts dated on/after ${ROUTING_START.toISOString().slice(0, 10)} must set
  zh: url: /web/<YY>/<MM>/<slug>/   (YY/MM from the post's own date)
  en: url: /en/web/<YY>/<MM>/<slug>/

Fix the front matter, then re-stage and commit.
`);
    process.exit(1);
  }

  const label = staged ? "staged" : "checked";
  console.log(`✓ Content routing OK (${files.length} ${label} file${files.length === 1 ? "" : "s"})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv);
}
