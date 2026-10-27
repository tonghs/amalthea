# 多语言静态站点

## 目标

用 yml + pug 生成纯静态的多语言单页站点。每个语言输出 1 个 html。

## 决策

| 项 | 决定 | 理由 |
|---|---|---|
| 文案 | 每个语言 1 个 `i18n/<lang>/site.yml` | `@1-/tran` 的路径规则固定为 `<dir>/<lang>/<rel>` |
| 源语言 | `zh`，写在 `tran.yml` 的 `tran.from` | 构建和翻译共用这一处配置 |
| 语言 | 全部 75 种（`to_li: "*"`），首批为 `zh`、`en`、`ja` | 用户指定；增删语言只改 `tran.yml` 和 `i18n/` 目录 |
| 模板 | `src/layout.pug` 共用，`index.pug` 语言页，`root.pug` 根页 | 公用一套模板 |
| 样式 | 纯 CSS，构建时内联 | 页面小，少一个依赖，少一次请求 |
| 字体 | webc 的 `18s@0.2.24/_.css`，异步加载 | CSS gzip 后 67 KB，同步加载会阻塞首屏 |
| 语言名 | 取自 `@3-/lang/NAME.js` | 翻译语言名会得到错误结果（「中文」→ "Chinese"） |
| 品牌名 | `package.json` 的 `brand`，不放进 yml | 实测日文把 Amalthea 音译成「アマルテア」 |
| 页面标题、版权 | 模板拼接 `brand · hero.title`，年份构建时生成 | 减少需要翻译的固定文本 |
| 图标 | `public/favicon.svg`，原样拷到 `dist/` | 用户提供；页面强调色取自图标的橙色 |
| 根路径 `/` | JS 跳转（方案 B） | 用户指定 |
| 暗色模式 | 三态：跟随系统 / 浅色 / 深色，单按钮循环 | 用户指定三态；320px 宽放不下 3 个并排按钮 |
| 设计规范 | `DESIGN.md`，约束写在 `CLAUDE.md` | 用户要求 |
| 部署 | GitHub Actions → GitHub Pages，只监听 push 到 main 和手动触发 | PR 合并即 push；`pull_request` 会部署未合并代码 |
| 站点地址 | `SITE_URL` 优先于 `homepage`，CI 从 `configure-pages` 注入 | github.io 子路径和自定义域名都自动正确 |

## URL 结构

- `/`：根页。按顺序选择语言：上次访问的语言（`localStorage.lang`）→ 浏览器语言 → 源语言。
- `/<lang>/`：语言页。访问时把 `<lang>` 写入 `localStorage.lang`。
- 语言切换器用对话框网格（参考 webc 的 `I18n`），支持 75 种语言。没有 JS 时按钮指向根页的语言列表。
- 根页同时列出所有语言链接。禁用 JS 的访客和爬虫可以用这些链接。

## 浏览器语言匹配

`src/pick.js` 对 `navigator.languages` 逐个尝试 3 种形式：完整标签、前 2 段、主语言。

- 别名：`he` → `iw`；`zh-hk`、`zh-mo`、`zh-hant` → `zh-TW`。
- 构建时把 `pick` 的源码内联到根页。`pick` 本身有单元测试。

## SEO

- 每页都有 `canonical`，以及每个语言的 `hreflang` 链接。
- `x-default` 指向根页。
- `hreflang` 必须用绝对 URL。站点地址优先取环境变量 `SITE_URL`（CI 注入），没有时取 `package.json` 的 `homepage`。
- `iw` 输出为 `he`，因为 `iw` 是已废弃的 BCP 47 代码。
- ar、fa、ur、iw、sd 加 `dir="rtl"`。

## 构建校验

出现以下情况时，构建直接失败，不清空 `dist/`，上一次的产物保持不变：

- `package.json` 缺少 `homepage`（且没有 `SITE_URL`）或 `brand`。
- 译文缺少源语言 yml 中的键，或键的值为空（提示运行 `bun run tran`）。
- `i18n/` 下的目录名不是 `@3-/lang` 支持的语言代码。
- 缺少源语言文案。
- 模板渲染出错。所有页面先渲染到内存，全部成功后才清空 `dist/` 并写盘。

## 翻译规则（实测得出）

- 源文案和译文在同一次 `tran` 里都有变化时，源文案优先，手改的译文会被覆盖。
- 手改后的译文行数必须和源文件一致，否则报 `update line mismatch`。
- 翻译 API 会混入零宽字符 U+200B，需要人工检查。

## 不做

- 多页面路由、sitemap、JS 打包和压缩。
