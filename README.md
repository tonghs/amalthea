# Amalthea

用 yml 写文案、pug 写模板的多语言静态站点。每个语言生成 1 个纯静态 html。

- 每个语言 1 个 yml，所有语言共用 1 套 pug 模板。
- 字体使用 [webc.site](https://github.com/webc-site/webc.site) 的网络字体 `18s`。中日韩字体按 unicode-range 分片，按需下载。
- 用 webc 的 `@1-/tran` 增量翻译。只维护中文，其他语言由 1 条命令生成。
- 根路径 `/` 按访客语言自动跳转。
- 响应式适配 mobile、pad、desktop。支持暗色模式，可以在跟随系统、浅色、深色之间切换。设计规范见 [DESIGN.md](DESIGN.md)。

## 快速开始

环境要求：[bun](https://bun.sh) ≥ 1.4。

```bash
bun install
bun run dev      # 开发：http://localhost:3000/ ，改文件后自动重建
bun run build    # 构建到 dist/
bun test         # 单元测试
bun run tran     # 增量翻译（需要 token，见下文）
```

`dev` 可以用 `PORT` 指定端口，例如 `PORT=4173 bun run dev`。

## 目录结构

```
├── i18n/
│   ├── zh/site.yml        # 源语言文案，手写
│   ├── en/site.yml        # 由 tran 生成，可以手改
│   ├── ja/site.yml
│   └── .cache/            # tran 的增量状态，必须提交到 git
├── src/
│   ├── layout.pug         # 公共 <head>：SEO、字体、内联 CSS
│   ├── index.pug          # 语言页
│   ├── root.pug           # 根页：JS 跳转 + 语言列表
│   ├── style.css          # 构建时内联进 html
│   ├── theme.js           # 每页 head 内联：绘制前应用主题，避免闪烁
│   ├── page.js            # 语言页脚本：语言对话框、主题切换
│   └── pick.js            # 根页的语言选择逻辑，构建时内联
├── public/                # 原样拷到 dist/（favicon.svg）
├── test/                  # bun test；page.test.js 用 happy-dom 测页面交互
├── build.js               # 构建脚本
├── dev.js                 # 开发服务器
├── tran.yml               # 翻译配置：源语言和目标语言
├── .github/workflows/     # GitHub Pages 自动部署
├── package.json           # homepage（站点地址）、brand（品牌名）
├── doc/i18n.md            # 翻译与语言管理详解
├── DESIGN.md              # 设计规范：断点、颜色、字体、间距、验收清单
├── CLAUDE.md              # 给 AI 助手的项目约束
└── spec/                  # 设计规格
```

## 构建产物

```
dist/
├── index.html         # 根页，跳转到合适的语言
├── favicon.svg
├── zh/index.html
├── en/index.html
└── ja/index.html
```

根页按以下顺序选择语言：

1. 上次访问的语言。访问语言页时，会把该语言写入 `localStorage`。
2. 浏览器语言（`navigator.languages`）。依次尝试完整标签、前 2 段、主语言，例如 `zh-Hant-HK` → `zh-hant` → `zh`。
3. 源语言。

根页也列出所有语言链接，供禁用 JS 的访客和爬虫使用。

## 配置

| 配置 | 位置 | 说明 |
|---|---|---|
| 站点地址 | 环境变量 `SITE_URL`，没有时用 `package.json` 的 `homepage` | 生成 `canonical` 和 `hreflang` 的绝对 URL，可以带子路径，例如 `https://a.com/site/`。部署到 GitHub Pages 时由 CI 自动注入 |
| 品牌名 | `package.json` 的 `brand` | 不放进 yml，避免被翻译改写 |
| 源语言、目标语言 | `tran.yml` | 见 [doc/i18n.md](doc/i18n.md) |

## 改文案

1. 修改 `i18n/zh/site.yml`。
2. 运行 `bun run tran`，同步其他语言。
3. 运行 `bun run build`。

如果译文缺少源语言中的键，或键只写了键没写值，构建会失败并提示运行 `bun run tran`。这样可以避免发布缺字的页面。构建失败时，上一次的 `dist/` 保持不变。

## 语言

当前已启用 `@3-/lang` 支持的全部 75 种语言（`tran.yml` 中 `to_li: "*"`）。完整列表见 [doc/i18n.md](doc/i18n.md#支持的语言)。

页面、语言切换器和 `hreflang` 都按 `i18n/` 下的目录自动生成，增删语言不需要改代码。

### 只启用部分语言

1. 把 `tran.yml` 的 `to_li` 改成列表，例如 `to_li: [en, ja, ko]`。
2. 删除不再需要的 `i18n/<lang>/` 目录。构建按目录生成页面，目录还在，页面就还会生成。
3. 运行 `bun run build`。

### 重新启用全部语言

1. 把 `tran.yml` 的 `to_li` 改成 `"*"`。
2. 运行 `bun run tran`。只翻译还没有译文的语言，已有的译文保持不变。
3. 运行 `bun run build`。

RTL 语言（ar、fa、ur、iw、sd）会自动加 `dir="rtl"`。语言切换用对话框网格平铺，75 种语言在 desktop 上一屏可以看到 52 种。

## 翻译 token

`tran` 从 `~/.config/webc.site.yml` 读取 token，也可以用环境变量 `WEBC_TOKEN`：

```yaml
token: "your-api-token"
```

不要把 token 提交到仓库。

## 部署

### GitHub Pages（已配置）

`.github/workflows/deploy.yml` 在以下情况自动部署：

- push 到 `main`。PR 合并进 `main` 也属于这种情况。
- 在 Actions 页面手动运行 Deploy。

流程：安装依赖 → `bun test` → 构建 → 部署。测试或构建校验失败时停止部署，线上版本保持不变。CI 不运行翻译，译文以仓库里提交的为准。

站点地址由 `actions/configure-pages` 读取，并通过 `SITE_URL` 注入构建。改仓库名或绑定自定义域名后，不需要改代码。

首次使用前，必须在仓库的 Settings → Pages → Build and deployment → Source 中选择 **GitHub Actions**。

### 其他静态托管

`dist/` 是纯静态文件，可以部署到 Cloudflare Pages、Nginx 等任何静态托管。托管服务需要对目录请求返回 `index.html`，并给 `/en` 这类路径补上结尾斜杠。主流托管服务默认都会这样处理。构建时用 `SITE_URL=https://你的域名/ bun run build` 指定站点地址。
