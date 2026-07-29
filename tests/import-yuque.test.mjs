import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  importYuque,
  readFrontMatterScalar,
  splitFrontMatter,
} from "../scripts/import-yuque.mjs";

async function fixture(entries) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "yuque-import-"));
  const sourceDir = path.join(root, "source");
  const contentDir = path.join(root, "content");
  const index = { penetration: [], thoughts: [] };

  for (const entry of entries) {
    const repository = entry.repository ?? "penetration";
    const directory = path.join(sourceDir, repository);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, entry.filename), entry.markdown, "utf8");
    index[repository].push({
      repo: repository,
      title: entry.title,
      slug: entry.slug,
      date: entry.date ?? "2026-07-29T08:00:00+08:00",
      filename: entry.filename,
      exported: true,
    });
  }

  for (const repository of ["penetration", "thoughts"]) {
    await fs.mkdir(path.join(sourceDir, repository), { recursive: true });
  }
  await fs.writeFile(
    path.join(sourceDir, "index.json"),
    `${JSON.stringify(index, null, 2)}\n`,
  );
  return { root, sourceDir, contentDir };
}

function article({ title = "测试文章", slug = "stable-slug", body = "正文\n" } = {}) {
  return `---\ntitle: ${JSON.stringify(title)}\nslug: ${slug}\ndate: 2026-07-29T08:00:00+08:00\nsource: yuque/penetration\n---\n\n${body}`;
}

test("imports an article, normalizes YAML, and removes NUL bytes", async (context) => {
  const setup = await fixture([
    {
      filename: "文章.md",
      title: '从"测试"开始',
      slug: "stable-slug",
      markdown: article({ title: '从"测试"开始', body: "有\0效正文\n" }),
    },
  ]);
  context.after(() => fs.rm(setup.root, { recursive: true, force: true }));

  const result = await importYuque(setup);
  const output = await fs.readFile(
    path.join(setup.contentDir, "penetration", "文章.md"),
    "utf8",
  );

  assert.equal(result.stats.added, 1);
  assert.equal(output.includes("\0"), false);
  assert.match(output, /^title: "从\\"测试\\"开始"$/m);
});

test("keeps a stable slug idempotently", async (context) => {
  const markdown = article();
  const setup = await fixture([
    {
      filename: "文章.md",
      title: "测试文章",
      slug: "stable-slug",
      markdown,
    },
  ]);
  context.after(() => fs.rm(setup.root, { recursive: true, force: true }));

  await importYuque(setup);
  const second = await importYuque(setup);

  assert.equal(second.stats.unchanged, 1);
  assert.equal(second.stats.updated, 0);
});

test("adds the old URL as an alias only when a published slug changes", async (context) => {
  const setup = await fixture([
    {
      filename: "文章.md",
      title: "测试文章",
      slug: "new-slug",
      markdown: article({ slug: "new-slug" }),
    },
  ]);
  context.after(() => fs.rm(setup.root, { recursive: true, force: true }));

  const target = path.join(setup.contentDir, "penetration", "文章.md");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, article({ slug: "old-slug" }), "utf8");

  await importYuque(setup);
  const output = await fs.readFile(target, "utf8");
  const parsed = splitFrontMatter(output);

  assert.equal(readFrontMatterScalar(parsed.frontMatter, "slug"), "new-slug");
  assert.match(output, /aliases:\n  - "\/posts\/penetration\/old-slug\/"/);
});

test("reuses existing content when an exported filename changes but slug stays stable", async (context) => {
  const setup = await fixture([
    {
      filename: "新标题.md",
      title: "新标题",
      slug: "stable-slug",
      markdown: article({ title: "新标题" }),
    },
  ]);
  context.after(() => fs.rm(setup.root, { recursive: true, force: true }));

  const oldTarget = path.join(setup.contentDir, "penetration", "旧标题.md");
  await fs.mkdir(path.dirname(oldTarget), { recursive: true });
  await fs.writeFile(oldTarget, article({ title: "旧标题" }), "utf8");

  const result = await importYuque(setup);
  const output = await fs.readFile(oldTarget, "utf8");

  assert.equal(result.stats.updated, 1);
  assert.match(output, /^title: "新标题"$/m);
  await assert.rejects(
    fs.access(path.join(setup.contentDir, "penetration", "新标题.md")),
  );
});

test("keeps a relocated source out of posts and requires its old URL alias", async (context) => {
  const setup = await fixture([
    {
      repository: "thoughts",
      filename: "Links.md",
      title: "Links",
      slug: "qcccnq",
      markdown: article({ title: "Links", slug: "qcccnq" }).replace(
        "source: yuque/penetration",
        "source: yuque/thoughts",
      ),
    },
  ]);
  context.after(() => fs.rm(setup.root, { recursive: true, force: true }));

  await fs.writeFile(
    path.join(setup.root, "links.md"),
    "---\ntitle: 友情链接\naliases:\n  - /posts/thoughts/qcccnq/\n---\n",
    "utf8",
  );
  const result = await importYuque({
    ...setup,
    relocations: { "thoughts/qcccnq": "links.md" },
  });

  assert.equal(result.stats.scanned, 1);
  assert.equal(result.stats.relocated, 1);
  await assert.rejects(
    fs.access(path.join(setup.contentDir, "thoughts", "Links.md")),
  );
});

test("rejects duplicate slugs before writing the second article", async (context) => {
  const setup = await fixture([
    {
      filename: "甲.md",
      title: "甲",
      slug: "same-slug",
      markdown: article({ title: "甲", slug: "same-slug" }),
    },
    {
      filename: "乙.md",
      title: "乙",
      slug: "same-slug",
      markdown: article({ title: "乙", slug: "same-slug" }),
    },
  ]);
  context.after(() => fs.rm(setup.root, { recursive: true, force: true }));

  await assert.rejects(
    importYuque(setup),
    /duplicate slug same-slug/,
  );
});

test("rejects a source file whose slug already belongs to another existing file", async (context) => {
  const setup = await fixture([
    {
      filename: "新文章.md",
      title: "新文章",
      slug: "stable-slug",
      markdown: article({ title: "新文章" }),
    },
  ]);
  context.after(() => fs.rm(setup.root, { recursive: true, force: true }));

  const repository = path.join(setup.contentDir, "penetration");
  await fs.mkdir(repository, { recursive: true });
  await fs.writeFile(
    path.join(repository, "旧文章.md"),
    article({ title: "旧文章" }),
    "utf8",
  );
  await fs.writeFile(
    path.join(repository, "新文章.md"),
    article({ title: "新文章", slug: "other-slug" }),
    "utf8",
  );

  await assert.rejects(
    importYuque(setup),
    /slug stable-slug already belongs to 旧文章\.md/,
  );
});

test("dry-run validates without creating content", async (context) => {
  const setup = await fixture([
    {
      filename: "文章.md",
      title: "测试文章",
      slug: "stable-slug",
      markdown: article(),
    },
  ]);
  context.after(() => fs.rm(setup.root, { recursive: true, force: true }));

  const result = await importYuque({ ...setup, dryRun: true });

  assert.equal(result.stats.added, 1);
  await assert.rejects(fs.access(setup.contentDir));
});
