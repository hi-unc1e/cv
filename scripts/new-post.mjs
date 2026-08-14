#!/usr/bin/env node
/**
 * Scaffold a new blog post with the /web/<YY>/<MM>/<slug>/ routing convention.
 *
 * The URL path segments come from the publish date (Asia/Shanghai):
 *   zh post -> content/zh/posts/<section>/<slug>.md   with url: /web/YY/MM/<slug>/
 *   en post -> content/en/posts/<section>/<slug>.md   with url: /en/web/YY/MM/<slug>/
 *
 * Usage:
 *   node scripts/new-post.mjs <slug> [options]
 *
 * Options:
 *   --title <t>        post title (default: slug)
 *   --section <s>      content section under posts/ (default: thoughts)
 *   --date <iso>       publish date, default: now (Asia/Shanghai)
 *   --lang <l>         zh | en | both (default: zh)
 *   --key <key>        translationKey override (default: slug)
 *   --draft/--no-draft draft flag (default: --draft)
 *
 * Examples:
 *   node scripts/new-post.mjs my-new-post --title "我的新文章" --section penetration
 *   node scripts/new-post.mjs my-new-post --lang both --title "New Post"
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const opts = {
    slug: undefined,
    title: undefined,
    section: "thoughts",
    date: undefined,
    lang: "zh",
    key: undefined,
    draft: true,
  };
  const rest = [...argv];
  opts.slug = rest.shift();
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    switch (arg) {
      case "--title": opts.title = rest[++i]; break;
      case "--section": opts.section = rest[++i]; break;
      case "--date": opts.date = rest[++i]; break;
      case "--lang": opts.lang = rest[++i]; break;
      case "--key": opts.key = rest[++i]; break;
      case "--draft": opts.draft = true; break;
      case "--no-draft": opts.draft = false; break;
      default:
        throw new Error(`unknown option: ${arg}`);
    }
  }
  if (!opts.slug) throw new Error("usage: node scripts/new-post.mjs <slug> [--title ... --section ... --date ... --lang zh|en|both --key ...]");
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(opts.slug)) {
    throw new Error(`slug must be lowercase URL-safe ([a-z0-9._-]): ${opts.slug}`);
  }
  if (!["zh", "en", "both"].includes(opts.lang)) {
    throw new Error(`--lang must be zh|en|both, got: ${opts.lang}`);
  }
  return opts;
}

function shanghaiParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    year: get("year"),
    yy: get("year").slice(-2),
    mm: get("month"),
    iso: `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}:${get("second")}+08:00`,
  };
}

function postUrl(lang, slug, parts) {
  const prefix = lang === "en" ? "/en" : "";
  return `${prefix}/web/${parts.yy}/${parts.mm}/${slug}/`;
}

function frontMatter(opts, lang, parts) {
  const lines = [
    "---",
    `title: ${JSON.stringify(opts.title ?? opts.slug)}`,
    `slug: ${opts.slug}`,
    `translationKey: ${opts.key ?? opts.slug}`,
    `url: ${postUrl(lang, opts.slug, parts)}`,
    `date: ${parts.iso}`,
    `lastmod: ${parts.iso}`,
    `draft: ${opts.draft}`,
    `description: ""`,
    `tags: []`,
    `categories: []`,
    "---",
    "",
    "",
  ];
  return lines.join("\n");
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const date = opts.date ? new Date(opts.date) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error(`invalid --date: ${opts.date}`);
  const parts = shanghaiParts(date);

  const langs = opts.lang === "both" ? ["zh", "en"] : [opts.lang];
  for (const lang of langs) {
    const file = path.join(ROOT, "content", lang, "posts", opts.section, `${opts.slug}.md`);
    if (fs.existsSync(file)) throw new Error(`already exists: ${path.relative(ROOT, file)}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, frontMatter(opts, lang, parts), "utf8");
    console.log(`created ${path.relative(ROOT, file)}`);
    console.log(`url:   ${postUrl(lang, opts.slug, parts)}`);
  }
}

main();
