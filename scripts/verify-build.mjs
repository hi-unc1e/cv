#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.resolve(process.argv[2] ?? path.join(projectRoot, "public"));
const sourceDir = path.resolve(
  process.argv[3] ?? path.join(projectRoot, "..", "knowledge", "yuque-export"),
);
const sections = ["penetration", "thoughts"];
const missingArticles = [];
const seen = new Set();
let expectedArticles = 0;

for (const section of sections) {
  const sourceSection = path.join(sourceDir, section);
  const files = fs.readdirSync(sourceSection).filter((name) => name.endsWith(".md"));

  for (const filename of files) {
    const markdown = fs.readFileSync(path.join(sourceSection, filename), "utf8");
    const slug = markdown.match(/^slug:\s*([^\r\n]+)$/m)?.[1].trim();
    if (!slug) {
      throw new Error(`${section}/${filename}: missing slug`);
    }

    const key = `${section}/${slug}`;
    if (seen.has(key)) {
      throw new Error(`duplicate source URL: ${key}`);
    }
    seen.add(key);
    expectedArticles += 1;

    const output = path.join(publicDir, "posts", section, slug, "index.html");
    if (!fs.existsSync(output)) {
      missingArticles.push(key);
    }
  }
}

const htmlFiles = [];
function walk(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, item.name);
    if (item.isDirectory()) {
      walk(fullPath);
    } else if (item.name.endsWith(".html")) {
      htmlFiles.push(fullPath);
    }
  }
}
walk(publicDir);

const brokenInternalRefs = new Set();
for (const filename of htmlFiles) {
  const html = fs.readFileSync(filename, "utf8");
  for (const match of html.matchAll(/(?:href|src)=["'](\/[^"'#?]*)/g)) {
    const reference = decodeURI(match[1]);
    const candidate = path.join(publicDir, reference.replace(/^\//, ""));
    const exists =
      fs.existsSync(candidate) ||
      fs.existsSync(path.join(candidate, "index.html")) ||
      fs.existsSync(`${candidate}.html`);
    if (!exists) {
      brokenInternalRefs.add(`${path.relative(publicDir, filename)} -> ${reference}`);
    }
  }
}

const readingSample = fs.readFileSync(
  path.join(publicDir, "posts", "thoughts", "bi3x3xx0iqi2lfxp", "index.html"),
  "utf8",
);
const cjkReadingMeta =
  /<span>\d+ 分钟<\/span>/.test(readingSample) &&
  /<span>\d+ 字<\/span>/.test(readingSample);

const result = {
  expectedArticles,
  missingArticles: missingArticles.length,
  htmlFiles: htmlFiles.length,
  brokenInternalRefs: brokenInternalRefs.size,
  cjkReadingMeta,
};
console.log(JSON.stringify(result, null, 2));

if (missingArticles.length > 0) {
  console.error(missingArticles.join("\n"));
}
if (brokenInternalRefs.size > 0) {
  console.error([...brokenInternalRefs].join("\n"));
}
if (missingArticles.length > 0 || brokenInternalRefs.size > 0 || !cjkReadingMeta) {
  process.exitCode = 1;
}
