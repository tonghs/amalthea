import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dump, load } from "js-yaml";
import build, { missing } from "../build.js";
import fixture, { ROOT } from "./fixture.js";

// 测试不受外部 SITE_URL 影响，统一以 package.json 的 homepage 为准
delete process.env.SITE_URL;
let root, out;

const html = (p) => readFileSync(join(out, p), "utf8"),
  head = (p) => {
    const page = html(p);
    return page.slice(0, page.indexOf("</head>"));
  },
  srcFile = (p) => readFileSync(join(ROOT, "src", p), "utf8"),
  addLang = (code) => cpSync(join(root, "i18n/en"), join(root, "i18n", code), { recursive: true }),
  // 用 fn 修改 i18n/<code>/site.yml 的文案对象
  editYml = (code, fn) => {
    const p = join(root, "i18n", code, "site.yml"),
      t = load(readFileSync(p, "utf8"));
    fn(t);
    writeFileSync(p, dump(t));
  },
  // 用 fn 修改 package.json 对象
  editPkg = (fn) => {
    const p = join(root, "package.json"),
      pkg = JSON.parse(readFileSync(p, "utf8"));
    fn(pkg);
    writeFileSync(p, JSON.stringify(pkg));
  },
  count = (s, sub) => s.split(sub).length - 1;

describe("missing", () => {
  test("结构一致时返回空", () => {
    expect(missing({ a: 1, b: { c: 2 } }, { a: "x", b: { c: "y" } })).toEqual([]);
  });

  test("返回缺失键的完整路径", () => {
    expect(missing({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 1 } })).toEqual(["a", "b.d"]);
  });

  test("检查数组元素", () => {
    expect(missing({ li: [{ t: 1 }, { t: 2 }] }, { li: [{ t: 1 }] })).toEqual(["li.1"]);
    expect(missing({ li: [{ t: 1, d: 2 }] }, { li: [{ t: 1 }] })).toEqual(["li.0.d"]);
  });

  test("译文多出的键不算错", () => {
    expect(missing({ a: 1 }, { a: 1, b: 2 })).toEqual([]);
  });

  test("译文为空", () => {
    expect(missing({ a: 1 }, null)).toEqual(["a"]);
  });

  test("译文只有键没有值（null）也算缺失", () => {
    expect(missing({ a: 1 }, { a: null })).toEqual(["a"]);
    expect(missing({ a: { b: 1 } }, { a: { b: null } })).toEqual(["a.b"]);
  });

  test("译文为空字符串不算缺失", () => {
    expect(missing({ a: 1 }, { a: "" })).toEqual([]);
  });
});

describe("build", () => {
  beforeEach(() => {
    root = fixture();
    out = join(root, "dist");
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test("源语言排第 1，其余按 @3-/lang 顺序", () => {
    expect(build({ root, out })).toEqual(["zh", "en", "ja"]);
  });

  test("输出每个语言的页面、根页和 public 文件", () => {
    build({ root, out });
    for (const p of ["index.html", "zh/index.html", "en/index.html", "ja/index.html", "favicon.svg"]) {
      expect(existsSync(join(out, p))).toBe(true);
    }
  });

  test("语言页包含 lang、标题和 hreflang", () => {
    build({ root, out });
    const en = html("en/index.html");
    expect(en).toContain('<html lang="en" dir="ltr">');
    expect(en).toContain("<title>Amalthea · One source, many languages</title>");
    expect(en).toContain('<link rel="canonical" href="https://example.com/en/">');
    expect(en).toContain('<link rel="alternate" hreflang="ja" href="https://example.com/ja/">');
    expect(en).toContain('<link rel="alternate" hreflang="x-default" href="https://example.com/">');
    expect(en).toContain('data-title="Theme: "');
    expect(en).toContain("© " + new Date().getFullYear() + " Amalthea");
  });

  test("语言按钮没有 JS 时指向根页，有 JS 时打开对话框", () => {
    build({ root, out });
    const en = html("en/index.html");
    expect(en).toContain('<a class="btn lang" href="../" aria-haspopup="dialog" aria-label="Language: English">');
    // page.js 用 querySelector 只取第 1 个
    expect(count(en, 'class="btn lang"')).toBe(1);
    expect(html("zh/index.html")).toContain('aria-label="切换语言：中文"');
  });

  test("语言对话框列出所有语言，当前语言高亮", () => {
    build({ root, out });
    const ja = html("ja/index.html"),
      dialog = ja.slice(ja.indexOf('<dialog class="langs"'), ja.indexOf("</dialog>"));
    expect(ja).toContain('<dialog class="langs" aria-labelledby="langs-title">');
    expect(count(ja, 'id="langs-title"')).toBe(1);
    expect(dialog).toContain('<h2 id="langs-title">言語を切り替え</h2>');
    expect(dialog).toContain('aria-label="閉じる"');
    expect(dialog).toContain('<a href="../en/" hreflang="en" lang="en"><span>English</span></a>');
    expect(dialog).toContain('<a href="../ja/" hreflang="ja" lang="ja" aria-current="page"><span>日本語</span><svg');
    expect(count(dialog, "aria-current")).toBe(1);
    expect(count(dialog, "<li>")).toBe(3);
  });

  test("语言页 head 原样内联 theme.js 和 page.js，theme.js 在前", () => {
    build({ root, out });
    const themeJs = srcFile("theme.js"),
      pageJs = srcFile("page.js");
    for (const p of ["zh/index.html", "en/index.html", "ja/index.html"]) {
      const h = head(p);
      expect(h).toContain(themeJs);
      expect(h).toContain(pageJs);
      expect(h.indexOf(themeJs)).toBeLessThan(h.indexOf(pageJs));
    }
  });

  test("根页 head 原样内联 theme.js，不含 page.js", () => {
    build({ root, out });
    const h = head("index.html");
    expect(h).toContain(srcFile("theme.js"));
    expect(html("index.html")).not.toContain(srcFile("page.js"));
  });

  test("语言页的主题按钮带翻译文案，默认隐藏等 JS 显示", () => {
    build({ root, out });
    const ja = html("ja/index.html");
    expect(ja).toMatch(/<button class="btn theme" type="button" hidden data-title="テーマ：" data-system="[^"]+" data-light="ライト" data-dark="ダーク">/);
  });

  test("语言页主题按钮包含 3 个主题图标（style.css 按 class 切换显示）", () => {
    build({ root, out });
    const en = html("en/index.html"),
      start = en.indexOf('<button class="btn theme"'),
      btn = en.slice(start, en.indexOf("</button>", start));
    for (const cls of ["i-system", "i-light", "i-dark"]) {
      expect(count(btn, `<svg class="${cls}"`)).toBe(1);
    }
  });

  test("根页不含主题按钮、语言按钮和对话框", () => {
    build({ root, out });
    const index = html("index.html");
    for (const s of ["btn theme", 'class="btn lang"', "<dialog"]) expect(index).not.toContain(s);
  });

  test("文案中的 HTML 特殊字符在正文和属性中都被转义", () => {
    const X = `A"B<script>alert('x')</script>&C`,
      E = "A&quot;B&lt;script&gt;alert('x')&lt;/script&gt;&amp;C";
    for (const code of ["zh", "en"]) {
      editYml(code, (t) => {
        t.description = t.lang = t.close = t.theme.title = t.hero.title = X;
      });
    }
    build({ root, out });
    const en = html("en/index.html");
    expect(en).toContain(`<title>Amalthea · ${E}</title>`);
    expect(en).toContain(`<meta name="description" content="${E}">`);
    expect(en).toContain(`<meta property="og:title" content="Amalthea · ${E}">`);
    expect(en).toContain(`<h1>${E}</h1>`);
    expect(en).toContain(`<a class="btn lang" href="../" aria-haspopup="dialog" aria-label="${E}: English">`);
    expect(en).toContain(`data-title="${E}: " data-system="System"`);
    expect(en).toContain(`<h2 id="langs-title">${E}</h2>`);
    expect(en).toContain(`<button class="btn close" type="button" aria-label="${E}">`);
    // 只有 head 里内联的那 1 个 script，文案没有注入新标签
    expect(count(en, "<script")).toBe(1);
    // 根页使用源语言文案
    const index = html("index.html");
    expect(index).toContain(`<title>Amalthea · ${E}</title>`);
    expect(count(index, "<script")).toBe(1);
  });

  test("根页使用源语言、列出所有语言链接、不记住语言", () => {
    build({ root, out });
    const index = html("index.html");
    expect(index).toContain('<html lang="zh" dir="ltr">');
    expect(index).not.toContain("localStorage.lang=");
    expect(index).toContain('<a href="ja/" hreflang="ja" lang="ja">日本語</a>');
  });

  test("RTL 语言加 dir=rtl，iw 输出为 he", () => {
    addLang("ar");
    addLang("iw");
    build({ root, out });
    expect(html("ar/index.html")).toContain('<html lang="ar" dir="rtl">');
    expect(html("iw/index.html")).toContain('<html lang="he" dir="rtl">');
    expect(html("zh/index.html")).toContain('hreflang="he" href="https://example.com/iw/"');
  });

  test("homepage 带子路径时生成正确的绝对 URL", () => {
    editPkg((pkg) => (pkg.homepage = "https://a.com/site/"));
    build({ root, out });
    expect(html("en/index.html")).toContain('<link rel="canonical" href="https://a.com/site/en/">');
  });

  test("homepage 没有结尾斜杠时自动补上", () => {
    editPkg((pkg) => (pkg.homepage = "https://a.com/site"));
    build({ root, out });
    expect(html("en/index.html")).toContain('<link rel="canonical" href="https://a.com/site/en/">');
    expect(html("index.html")).toContain('<link rel="canonical" href="https://a.com/site/">');
  });

  test("site 参数优先于 homepage（CI 注入 SITE_URL）", () => {
    build({ root, out, site: "https://tonghs.github.io/amalthea" });
    expect(html("en/index.html")).toContain('<link rel="canonical" href="https://tonghs.github.io/amalthea/en/">');
    expect(html("index.html")).toContain('hreflang="x-default" href="https://tonghs.github.io/amalthea/"');
  });

  test("不传 site 时读取环境变量 SITE_URL", () => {
    process.env.SITE_URL = "https://a.com/x";
    try {
      build({ root, out });
    } finally {
      delete process.env.SITE_URL;
    }
    expect(html("en/index.html")).toContain('<link rel="canonical" href="https://a.com/x/en/">');
  });

  test("site 为空字符串时回退到 homepage", () => {
    build({ root, out, site: "" });
    expect(html("en/index.html")).toContain('<link rel="canonical" href="https://example.com/en/">');
  });

  test("package.json 缺少 brand 时报错", () => {
    editPkg((pkg) => delete pkg.brand);
    expect(() => build({ root, out })).toThrow("package.json 必须配置 homepage 和 brand");
  });

  test("构建失败时保留旧产物", () => {
    build({ root, out });
    addLang("xx");
    expect(() => build({ root, out })).toThrow();
    expect(existsSync(join(out, "en/index.html"))).toBe(true);
  });

  test("根页模板运行出错时报错，保留旧产物", () => {
    build({ root, out });
    writeFileSync(join(root, "src/root.pug"), "extends layout\n\nblock body\n  p= undefinedVar.x\n");
    expect(() => build({ root, out })).toThrow("undefinedVar");
    for (const p of ["index.html", "en/index.html", "favicon.svg"]) expect(existsSync(join(out, p))).toBe(true);
  });

  test("语言页模板语法错误时报错，保留旧产物", () => {
    build({ root, out });
    writeFileSync(join(root, "src/index.pug"), "div(\n");
    expect(() => build({ root, out })).toThrow("index.pug");
    for (const p of ["index.html", "en/index.html", "favicon.svg"]) expect(existsSync(join(out, p))).toBe(true);
  });

  test("忽略没有 site.yml 的目录（如翻译缓存 .cache）", () => {
    cpSync(join(root, "public"), join(root, "i18n/fr"), { recursive: true });
    expect(build({ root, out })).toEqual(["zh", "en", "ja"]);
  });

  test("重新构建时清掉旧产物", () => {
    build({ root, out });
    writeFileSync(join(out, "stale.html"), "");
    build({ root, out });
    expect(existsSync(join(out, "stale.html"))).toBe(false);
  });

  test("译文不是合法 yml 时，报错带上文件路径", () => {
    // 亚美尼亚语用英文冒号代替句号，tran 不给值加引号，行尾冒号会让解析失败
    writeFileSync(join(root, "i18n/ja/site.yml"), "description: 段落の終わり:\n");
    expect(() => build({ root, out })).toThrow("i18n/ja/site.yml");
  });

  test("译文缺键时报错并提示运行 tran", () => {
    editYml("ja", (t) => delete t.lang);
    expect(() => build({ root, out })).toThrow("i18n/ja/site.yml 缺少 lang，请运行 bun run tran");
  });

  test("译文某键只写键没写值时报错并提示运行 tran", () => {
    const p = join(root, "i18n/ja/site.yml");
    writeFileSync(p, readFileSync(p, "utf8").replace(/^lang:.*$/m, "lang:"));
    expect(() => build({ root, out })).toThrow("i18n/ja/site.yml 缺少 lang，请运行 bun run tran");
  });

  test("不支持的语言代码报错", () => {
    addLang("xx");
    expect(() => build({ root, out })).toThrow("不支持的语言代码：xx");
  });

  test("缺少源语言文案时报错", () => {
    rmSync(join(root, "i18n/zh"), { recursive: true });
    expect(() => build({ root, out })).toThrow("缺少源语言文案 i18n/zh/site.yml");
  });
});
