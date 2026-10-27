# CLAUDE.md

多语言静态站点：yml 文案 + pug 模板，每个语言构建成 1 个 html。总体说明见 `README.md`。

## 必读文档

| 改动 | 先读 |
|---|---|
| 任何 UI（样式、模板、交互） | `DESIGN.md` |
| 文案、翻译、增删语言 | `doc/i18n.md` |
| 构建和整体架构 | `spec/multilingual-site.md` |

## 命令

```bash
bun run dev      # 开发服务器，PORT 可指定端口
bun run build    # 构建到 dist/
bun test         # 单元测试
bun run tran     # 增量翻译，token 在 ~/.config/webc.site.yml
```

## 设计约束（硬性）

1. **改 UI 前必须先读 `DESIGN.md`。** 规范和代码冲突时，以 `DESIGN.md` 为准。需要改规范时，先改 `DESIGN.md`，再改代码，并在交付说明里写明改了哪条规范、为什么改。
2. **三端都不妥协。** mobile（< 768px）、pad（768–1023px）、desktop（≥ 1024px）都必须专门检查。如果某一端必须妥协，先和用户确认，再把理由写进 `DESIGN.md`。
3. **只用 token。** 颜色、字号、字重、间距、圆角、动效都必须用 `src/style.css` 里 `:root` 的 token。允许的裸数值只限 `DESIGN.md` 第 10 节列出的情况。
4. **新增颜色必须算对比度。** 亮色和暗色都要算，结果补进 `DESIGN.md` 的对比度表。正文 ≥ 4.5:1。
5. **暗色模式不能遗漏。** 新增的颜色必须用 `light-dark()` 定义。不要新增只在亮色下生效的样式。
6. **只用逻辑属性。** 用 `margin-inline`、`inset-inline-end` 这类属性，不要用 `left`、`right`、`margin-left`，否则 RTL 语言会显示错位。
7. **触控目标 ≥ 44×44px。** 悬停样式只写在 `@media (hover: hover)` 中。
8. **JS 只做增强。** 禁用 JS 时，内容、语言切换、跟随系统的主题都必须可用。依赖 JS 的控件默认 `hidden`，由脚本显示。
9. **交付前必须截图验收。** 按 `DESIGN.md` 第 12 节执行：6 个宽度 × 亮色和暗色 × zh 和 en。改动涉及布局方向时，再加 ar。逐项过完清单再交付，不要只看 1 个宽度。

## 文案与翻译约束

1. 只改源语言 `i18n/zh/site.yml`，然后运行 `bun run tran`。不要手写新语言的 yml。
2. 品牌名、年份这类不翻译的文本不要放进 yml。品牌名在 `package.json` 的 `brand` 里。
3. 手改译文前，先让源文案的变更跑完 `tran`。手改后的译文行数必须和源文件一致。
4. 翻译后检查术语误译和零宽字符，检查命令见 `doc/i18n.md`。

## 部署约束

1. push 到 `main` 会自动部署到 GitHub Pages（`.github/workflows/deploy.yml`）。不要在 workflow 里加 `pull_request` 触发，否则未合并的 PR 也会被部署。
2. 站点地址由 CI 通过 `SITE_URL` 注入，不要在代码里写死 github.io 地址。
3. bun 版本以 `package.json` 的 `packageManager` 为准。升级 bun 时同时改这里。

## 代码约束

1. 构建失败时不能留下残缺产物：校验和模板渲染都放在 `rmSync(out)` 之前。所有页面先渲染到内存，全部成功后再清空输出目录并写盘。
2. `src/pick.js` 的源码会内联到根页，函数内不能引用外部变量。
3. 改动 `build.js`、`src/*.js` 后必须补测试（`test/`），覆盖边界和异常。
4. 测试用 `test/fixture.js` 生成临时项目，文案只含 zh、en、ja。不要让断言依赖仓库开启了几种语言，否则增删语言就会让测试失败。
5. `page.js` 的交互测试在 `test/page.test.js`：用 happy-dom 加载真实构建产物，让内联脚本自己运行。happy-dom 不派发 `DOMContentLoaded`，测试的 `load()` 会手动补发。
