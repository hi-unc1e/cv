#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPOSITORIES = ["penetration", "thoughts"];
const SAFE_SLUG = /^[a-z0-9][a-z0-9._-]*$/;

function decodeScalar(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"')) {
    return JSON.parse(trimmed);
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }
  return trimmed;
}

export function splitFrontMatter(markdown, label = "Markdown") {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    throw new Error(`${label}: missing YAML front matter`);
  }

  return {
    frontMatter: match[1],
    body: markdown.slice(match[0].length),
  };
}

export function readFrontMatterScalar(frontMatter, key) {
  const match = frontMatter.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  return match ? decodeScalar(match[1]) : undefined;
}

function readAliases(frontMatter) {
  const lines = frontMatter.split(/\r?\n/);
  const aliases = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^aliases:\s*(.*)$/);
    if (!match) {
      continue;
    }

    const inline = match[1].trim();
    if (inline) {
      if (inline.startsWith("[")) {
        const parsed = JSON.parse(inline);
        if (!Array.isArray(parsed)) {
          throw new Error("aliases must be a YAML list");
        }
        aliases.push(...parsed);
      } else {
        aliases.push(decodeScalar(inline));
      }
      continue;
    }

    for (let item = index + 1; item < lines.length; item += 1) {
      const alias = lines[item].match(/^\s+-\s*(.+)$/);
      if (!alias) {
        break;
      }
      aliases.push(decodeScalar(alias[1]));
    }
  }

  return aliases;
}

function removeAliases(lines) {
  const result = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^aliases:\s*/.test(lines[index])) {
      result.push(lines[index]);
      continue;
    }

    while (index + 1 < lines.length && /^\s+-\s*/.test(lines[index + 1])) {
      index += 1;
    }
  }

  return result;
}

function setScalar(lines, key, value) {
  const rendered = `${key}: ${value}`;
  const index = lines.findIndex((line) => new RegExp(`^${key}:`).test(line));
  if (index >= 0) {
    lines[index] = rendered;
  } else {
    lines.push(rendered);
  }
}

function validateAlias(alias, label) {
  if (
    typeof alias !== "string" ||
    !alias.startsWith("/") ||
    alias.includes("..") ||
    alias.includes("?") ||
    alias.includes("#")
  ) {
    throw new Error(`${label}: invalid alias ${JSON.stringify(alias)}`);
  }
}

export function normalizeArticle({
  markdown,
  metadata,
  repository,
  existingMarkdown,
  label,
}) {
  const cleaned = markdown.replaceAll("\0", "");
  const source = splitFrontMatter(cleaned, label);
  const sourceAliases = readAliases(source.frontMatter);
  const existingAliases = [];
  let oldSlug;

  if (existingMarkdown) {
    const existing = splitFrontMatter(existingMarkdown.replaceAll("\0", ""), label);
    oldSlug = readFrontMatterScalar(existing.frontMatter, "slug");
    existingAliases.push(...readAliases(existing.frontMatter));
  }

  const aliases = [...sourceAliases, ...existingAliases];
  if (oldSlug && oldSlug !== metadata.slug) {
    aliases.push(`/posts/${repository}/${oldSlug}/`);
  }

  const uniqueAliases = [...new Set(aliases)];
  for (const alias of uniqueAliases) {
    validateAlias(alias, label);
  }

  const lines = removeAliases(source.frontMatter.split(/\r?\n/));
  setScalar(lines, "title", JSON.stringify(metadata.title));
  setScalar(lines, "slug", metadata.slug);
  setScalar(lines, "date", metadata.date);
  setScalar(lines, "source", `yuque/${repository}`);

  while (lines.at(-1) === "") {
    lines.pop();
  }

  if (uniqueAliases.length > 0) {
    lines.push("aliases:");
    for (const alias of uniqueAliases) {
      lines.push(`  - ${JSON.stringify(alias)}`);
    }
  }

  return `---\n${lines.join("\n")}\n---\n${source.body}`;
}

function validateMetadata(entry, repository, filename) {
  const label = `${repository}/${filename}`;
  if (!entry || entry.exported !== true) {
    throw new Error(`${label}: no matching exported index entry`);
  }
  if (typeof entry.title !== "string" || entry.title.trim() === "") {
    throw new Error(`${label}: title is empty`);
  }
  if (typeof entry.slug !== "string" || !SAFE_SLUG.test(entry.slug)) {
    throw new Error(
      `${label}: slug ${JSON.stringify(entry.slug)} must use lowercase URL-safe characters`,
    );
  }
  if (!Number.isFinite(Date.parse(entry.date))) {
    throw new Error(`${label}: invalid date ${JSON.stringify(entry.date)}`);
  }
}

async function readIfPresent(filename) {
  try {
    return await fs.readFile(filename, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

export async function importYuque({
  sourceDir,
  contentDir,
  dryRun = false,
  log = () => {},
}) {
  const indexPath = path.join(sourceDir, "index.json");
  const index = JSON.parse(await fs.readFile(indexPath, "utf8"));
  const stats = {
    scanned: 0,
    added: 0,
    updated: 0,
    unchanged: 0,
    shadowedIndexEntries: 0,
  };
  const matched = new Set();
  const warnings = [];

  for (const repository of REPOSITORIES) {
    if (!Array.isArray(index[repository])) {
      throw new Error(`index.json: missing ${repository} array`);
    }

    const sourceRepository = path.join(sourceDir, repository);
    const targetRepository = path.join(contentDir, repository);
    const existingBySlug = new Map();
    const existingFilenames = await fs.readdir(targetRepository).catch((error) => {
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    });
    for (const filename of existingFilenames.filter(
      (item) => item.endsWith(".md") && item !== "_index.md",
    )) {
      const existingPath = path.join(targetRepository, filename);
      const existingMarkdown = await fs.readFile(existingPath, "utf8");
      const parsed = splitFrontMatter(
        existingMarkdown.replaceAll("\0", ""),
        `${repository}/${filename}`,
      );
      const slug = readFrontMatterScalar(parsed.frontMatter, "slug");
      if (slug && existingBySlug.has(slug)) {
        throw new Error(
          `${repository}: existing content duplicates slug ${slug} in ${existingBySlug.get(slug)} and ${filename}`,
        );
      }
      if (slug) {
        existingBySlug.set(slug, filename);
      }
    }

    const filenames = (await fs.readdir(sourceRepository))
      .filter((filename) => filename.endsWith(".md"))
      .sort((left, right) => left.localeCompare(right, "zh-CN"));
    const slugs = new Map();

    for (const filename of filenames) {
      const sourcePath = path.join(sourceRepository, filename);
      const raw = await fs.readFile(sourcePath, "utf8");
      const parsed = splitFrontMatter(raw.replaceAll("\0", ""), `${repository}/${filename}`);
      const sourceSlug = readFrontMatterScalar(parsed.frontMatter, "slug");
      const candidates = index[repository].filter(
        (entry) =>
          entry.exported === true &&
          entry.filename === filename &&
          entry.slug === sourceSlug,
      );

      if (candidates.length !== 1) {
        throw new Error(
          `${repository}/${filename}: expected one exported index match for slug ${JSON.stringify(sourceSlug)}, found ${candidates.length}`,
        );
      }

      const metadata = candidates[0];
      validateMetadata(metadata, repository, filename);
      const duplicate = slugs.get(metadata.slug);
      if (duplicate) {
        throw new Error(
          `${repository}: duplicate slug ${metadata.slug} in ${duplicate} and ${filename}`,
        );
      }
      slugs.set(metadata.slug, filename);
      matched.add(`${repository}\0${filename}\0${metadata.slug}`);

      const exactTarget = path.join(targetRepository, filename);
      const exactExisting = await readIfPresent(exactTarget);
      const stableFilename = existingBySlug.get(metadata.slug);
      if (
        exactExisting !== undefined &&
        stableFilename &&
        stableFilename !== filename
      ) {
        throw new Error(
          `${repository}/${filename}: slug ${metadata.slug} already belongs to ${stableFilename}`,
        );
      }
      const targetPath =
        exactExisting !== undefined || !stableFilename
          ? exactTarget
          : path.join(targetRepository, stableFilename);
      const existingMarkdown = await readIfPresent(targetPath);
      const normalized = normalizeArticle({
        markdown: raw,
        metadata,
        repository,
        existingMarkdown,
        label: `${repository}/${filename}`,
      });

      stats.scanned += 1;
      if (existingMarkdown === normalized) {
        stats.unchanged += 1;
        continue;
      }

      if (existingMarkdown === undefined) {
        stats.added += 1;
      } else {
        stats.updated += 1;
      }

      if (!dryRun) {
        await fs.mkdir(targetRepository, { recursive: true });
        await fs.writeFile(targetPath, normalized, "utf8");
      }
      log(`${dryRun ? "would write" : "wrote"} ${path.relative(contentDir, targetPath)}`);
    }
  }

  for (const repository of REPOSITORIES) {
    for (const entry of index[repository].filter((item) => item.exported === true)) {
      const key = `${repository}\0${entry.filename}\0${entry.slug}`;
      if (!matched.has(key)) {
        stats.shadowedIndexEntries += 1;
        warnings.push(
          `${repository}/${entry.filename}: exported index slug ${entry.slug} has no distinct Markdown file`,
        );
      }
    }
  }

  return { stats, warnings };
}

function parseArguments(argv) {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(scriptDirectory, "..");
  const options = {
    sourceDir: path.resolve(projectRoot, "..", "knowledge", "yuque-export"),
    contentDir: path.join(projectRoot, "content", "posts"),
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--source") {
      const value = argv[++index];
      if (!value) {
        throw new Error("--source requires a directory");
      }
      options.sourceDir = path.resolve(value);
    } else if (argument === "--content") {
      const value = argv[++index];
      if (!value) {
        throw new Error("--content requires a directory");
      }
      options.contentDir = path.resolve(value);
    } else if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/import-yuque.mjs [options]

Options:
  --source <directory>  Yuque export directory (default: ../knowledge/yuque-export)
  --content <directory> Hugo posts directory (default: content/posts)
  --dry-run             Validate and report without writing files
  -h, --help            Show this help
`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const result = await importYuque({
    ...options,
    log: (message) => console.log(message),
  });

  console.log(
    `Yuque import: ${result.stats.scanned} scanned, ${result.stats.added} added, ${result.stats.updated} updated, ${result.stats.unchanged} unchanged`,
  );
  for (const warning of result.warnings) {
    console.warn(`warning: ${warning}`);
  }
}

const invokedAsScript =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invokedAsScript) {
  main().catch((error) => {
    console.error(`Yuque import failed: ${error.message}`);
    process.exitCode = 1;
  });
}
