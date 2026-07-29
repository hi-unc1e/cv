# @Unc1e / unc.la

个人博客与作品集的 Hugo 副本，使用 [Hugo](https://gohugo.io/) 和 [PaperMod](https://github.com/adityatelange/hugo-PaperMod) 构建。

## 内容与域名

- `unc1e.cn`：跳转到语雀；语雀是日常写作的第一真相源。
- `www.unc.la`：Hugo canonical 站点，由 Vercel 构建。
- `code.unc1e.com`：同一份 Hugo 内容的 GitHub Pages 镜像。
- `unc1e.com`：预留为 Hugo 域名，绑定与跳转策略后续配置。

站内已发布 115 篇语雀公开文章：81 篇安全研究与工程实践、34 篇思考与生活记录。Web Archive 提交和自动增量同步暂未实现。

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

文章按来源栏目放在 `content/posts/penetration/` 和 `content/posts/thoughts/`。新建原创文章仍可直接放在 `content/posts/`：

```bash
hugo new content posts/my-post.md
```

Front matter 约定：

- `title`、`date`、`lastmod`：标题与时间。
- `description`：用于列表摘要和 SEO。
- `tags`、`categories`：站内分类。
- `source_url`：原文来自语雀时记录原文 URL；本站原创可留空。
- `source`：批量导出的语雀来源标识，例如 `yuque/penetration`；迁移内容保留该字段。
- `draft`：发布前保持 `true`，确认后改为 `false`。

语雀同步的最低原则是：语雀正文为内容真相源，Git 保留公开 Markdown 副本；同步器不得覆盖本站专用 front matter 和静态资源。

语雀 CDN 图片继续使用原始外链。项目级 Markdown 图片 render hook 会为 `cdn.nlark.com` 设置 `referrerpolicy="no-referrer"`，避免外站 Referer 触发防盗链 403。

## 发布

- 推送或合并到 `main` 后，GitHub Actions 构建并发布到 GitHub Pages。
- Vercel 的 Git 集成使用 `vercel.json` 构建 `public/`，并继续提供分支预览。
- PaperMod 作为公开 Git submodule 固定到主仓库记录的提交；升级主题时单独提交 submodule 指针变更并执行完整构建检查。
- `layouts/` 包含 PaperMod issue #1856 的 Hugo 0.158+ 兼容覆盖、表格可访问性和语雀 CDN 图片加载适配；升级主题时应逐项复核并重新严格构建。

## 本地资料

`devdocs/`、`.claude/` 和 `.open.sh` 仅供本机使用，已从公开仓库的跟踪边界排除。
