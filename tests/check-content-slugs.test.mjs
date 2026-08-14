import assert from "node:assert/strict";
import test from "node:test";

import { checkMarkdown, expectedPostUrl, ROUTING_START } from "../scripts/check-content-slugs.mjs";

function post(frontMatter) {
  return `---\n${frontMatter}\n---\n\nbody\n`;
}

test("ROUTING_START is 2026-08-14 Asia/Shanghai", () => {
  assert.equal(ROUTING_START.toISOString(), "2026-08-13T16:00:00.000Z");
});

test("expectedPostUrl formats zh and en URLs from the post date", () => {
  const date = new Date("2026-08-20T10:00:00+08:00");
  assert.equal(expectedPostUrl("zh", "my-post", date), "/26/08/my-post/");
  assert.equal(expectedPostUrl("en", "my-post", date), "/en/26/08/my-post/");
});

test("expectedPostUrl uses Asia/Shanghai even for adjacent-timezone dates", () => {
  // 2026-09-01T00:30+09:00 (Tokyo) is still 2026-08-31T23:30 in Shanghai.
  const date = new Date("2026-09-01T00:30:00+09:00");
  assert.equal(expectedPostUrl("zh", "x", date), "/26/08/x/");
});

test("new zh post without url is rejected", () => {
  const errors = checkMarkdown(
    "content/zh/posts/penetration/new-no-url.md",
    post(['title: "T"', "slug: new-no-url", "translationKey: new-no-url", "date: 2026-08-14T08:00:00+08:00"].join("\n")),
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /must declare `url: \/26\/08\/new-no-url\/`/);
});

test("new en post without url is rejected", () => {
  const errors = checkMarkdown(
    "content/en/posts/penetration/new-en-no-url.md",
    post(['title: "T"', "slug: new-en-no-url", "date: 2026-08-15T08:00:00+08:00"].join("\n")),
  );
  assert.match(errors[0], /must declare `url: \/en\/26\/08\/new-en-no-url\/`/);
});

test("new post with mismatched url is rejected", () => {
  const errors = checkMarkdown(
    "content/zh/posts/thoughts/wrong-month.md",
    post(['title: "T"', "slug: wrong-month", "date: 2026-08-20T08:00:00+08:00", "url: /26/09/wrong-month/"].join("\n")),
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /expected \/26\/08\/wrong-month\//);
});

test("new post with correct url passes (trailing slash optional)", () => {
  assert.deepEqual(
    checkMarkdown(
      "content/zh/posts/penetration/good-post.md",
      post(['title: "T"', "slug: good-post", "date: 2026-08-14T00:00:00+08:00", "url: /26/08/good-post"].join("\n")),
    ),
    [],
  );
  assert.deepEqual(
    checkMarkdown(
      "content/en/posts/penetration/good-post.md",
      post(['title: "T"', "slug: good-post", "date: 2026-08-14T00:00:00+08:00", "url: /en/26/08/good-post/"].join("\n")),
    ),
    [],
  );
});

test("legacy post before ROUTING_START needs no url", () => {
  assert.deepEqual(
    checkMarkdown(
      "content/zh/posts/penetration/legacy-post.md",
      post(['title: "T"', "slug: legacy-post", "date: 2026-08-13T23:59:59+08:00"].join("\n")),
    ),
    [],
  );
  // and a legacy post may keep any url it already has
  assert.deepEqual(
    checkMarkdown(
      "content/en/posts/penetration/legacy-url.md",
      post(['title: "T"', "slug: legacy-url", "date: 2026-08-12T00:00:00+08:00", "url: /some/old/path/"].join("\n")),
    ),
    [],
  );
});

test("posts page without slug is still rejected after content restructure", () => {
  for (const lang of ["zh", "en"]) {
    const errors = checkMarkdown(
      `content/${lang}/posts/penetration/no-slug-${lang}.md`,
      post(['title: "T"', "date: 2020-01-01T00:00:00+08:00"].join("\n")),
    );
    assert.equal(errors.length, 1, `${lang}: ${errors}`);
    assert.match(errors[0], /missing front matter `slug`/);
  }
});

test("non-post pages are exempt from slug and routing rules", () => {
  assert.deepEqual(
    checkMarkdown("content/zh/about.md", post(['title: "关于"'].join("\n"))),
    [],
  );
});
