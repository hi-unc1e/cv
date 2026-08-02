#!/usr/bin/env node
/**
 * Enforce English URL-safe slugs on Hugo content Markdown.
 *
 * Rules (aligned with scripts/import-yuque.mjs SAFE_SLUG):
 * - slug must match /^[a-z0-9][a-z0-9._-]*$/
 * - no uppercase, no spaces, no CJK / fullwidth punctuation
 * - posts under content/posts/** (except _index.md) must declare slug in front matter
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

function readSlug(frontMatter) {
  const match = frontMatter.match(/^slug:\s*(.*)$/m);
  if (!match) return undefined;
  return decodeScalar(match[1]);
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
    normalized.startsWith("content/posts/") &&
    normalized.endsWith(".md") &&
    !normalized.endsWith("/_index.md")
  );
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

function checkFile(absPath) {
  const rel = path.relative(ROOT, absPath).split(path.sep).join("/");
  const errors = [];

  let markdown;
  try {
    markdown = fs.readFileSync(absPath, "utf8");
  } catch (err) {
    errors.push(`${rel}: cannot read file (${err.message})`);
    return errors;
  }

  const frontMatter = readFrontMatter(markdown);
  if (frontMatter === null) {
    if (isPostPage(rel)) {
      errors.push(`${rel}: missing YAML front matter (posts require English slug)`);
    }
    return errors;
  }

  const slug = readSlug(frontMatter);
  if (slug === undefined || slug === "") {
    if (isPostPage(rel)) {
      errors.push(
        `${rel}: missing front matter \`slug\` — posts must set an English URL-safe slug (e.g. my-post-name)`,
      );
    }
    return errors;
  }

  if (typeof slug !== "string" || !SAFE_SLUG.test(slug)) {
    const hasCjk = /[\u3400-\u9fff\uf900-\ufaff]/.test(slug);
    const hint = hasCjk
      ? "contains Chinese/CJK characters"
      : "must be lowercase English URL-safe: start with [a-z0-9], then only [a-z0-9._-]";
    errors.push(`${rel}: invalid slug ${JSON.stringify(slug)} — ${hint}`);
  }

  return errors;
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
    console.error("✖ English slug check failed:\n");
    for (const err of allErrors) {
      console.error(`  - ${err}`);
    }
    console.error(`
Rule: front matter slug must match /^[a-z0-9][a-z0-9._-]*$/
  ✓ slug: agents-next-problem-is-action-boundary
  ✗ slug: Agent运行时防护
  ✗ slug: My Post
  ✗ (missing slug on content/posts/** pages)

Fix the slug field, then re-stage and commit.
`);
    process.exit(1);
  }

  const label = staged ? "staged" : "checked";
  console.log(`✓ English slug OK (${files.length} ${label} file${files.length === 1 ? "" : "s"})`);
}

main(process.argv);
