# Uncle / unc.la

个人博客与作品集的 Hugo 副本，使用 [Hugo](https://gohugo.io/) 和 [PaperMod](https://github.com/adityatelange/hugo-PaperMod) 构建。

## 内容与域名

- `unc1e.cn`：跳转到语雀；语雀是日常写作的第一真相源。
- `www.unc.la`：Hugo canonical 站点，由 Vercel 构建。
- `code.unc1e.com`：同一份 Hugo 内容的 GitHub Pages 镜像。
- `unc1e.com`：预留为 Hugo 域名，绑定与跳转策略后续配置。

首轮只迁移现有首页、个人介绍、项目与链接。语雀文章的自动同步和 Web Archive 提交不在本轮实现范围内。

## 本地开发

环境要求：Git，以及 Hugo `0.164.0` 或兼容版本。

```bash
git clone --recurse-submodules git@github.com:hi-unc1e/cv.git
cd cv
hugo server -D
```

原创静态小工具位于 `static/funny/`。工作状态趣味自检的公开路径是
`/funny/work-checkin/`，所有答案只在浏览器中计算，不会发送到服务端。

计分逻辑可单独验证：

```bash
node --test tests/work-checkin.test.cjs
```

如果仓库已经克隆：

```bash
git submodule update --init --recursive
hugo server -D
```

生产构建：

```bash
hugo --gc --minify
```

生成目录为 `public/`，它不进入 Git。

## 内容维护

文章放在 `content/posts/`。新建文章：

```bash
hugo new content posts/my-post.md
```

Front matter 约定：

- `title`、`date`、`lastmod`：标题与时间。
- `description`：用于列表摘要和 SEO。
- `tags`、`categories`：站内分类。
- `source_url`：原文来自语雀时记录原文 URL；本站原创可留空。
- `draft`：发布前保持 `true`，确认后改为 `false`。

语雀同步的最低原则是：语雀正文为内容真相源，Git 保留公开 Markdown 副本；同步器不得覆盖本站专用 front matter 和静态资源。

## 发布

- 推送或合并到 `main` 后，GitHub Actions 构建并发布到 GitHub Pages。
- Vercel 的 Git 集成使用 `vercel.json` 构建 `public/`，并继续提供分支预览。
- PaperMod 作为公开 Git submodule 固定到主仓库记录的提交；升级主题时单独提交 submodule 指针变更并执行完整构建检查。
- `layouts/` 只包含 PaperMod issue #1856 的 Hugo 0.158+ 兼容覆盖；主题合并上游修复后应删除这些覆盖并重新严格构建。

## 本地资料

`devdocs/`、`.claude/` 和 `.open.sh` 仅供本机使用，已从公开仓库的跟踪边界排除。
