import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import build, { missing } from "../build.js";

const ROOT = join(import.meta.dirname, "..");
let root, out;

// 把项目输入拷到临时目录，测试改动不影响真实文件
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "amalthea-"));
  out = join(root, "dist");
  for (const p of ["src", "i18n", "public", "tran.yml", "package.json"]) {
    cpSync(join(ROOT, p), join(root, p), { recursive: true });
  }
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

const html = (p) => readFileSync(join(out, p), "utf8"),
  addLang = (code) => cpSync(join(root, "i18n/en"), join(root, "i18n", code), { recursive: true });

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
});

describe("build", () => {
  test("源语言排第 1，其余按 @3-/lang 顺序", () => {
    expect(build({ root, out })).toEqual(["zh", "en", "ja"]);
  });

  test("输出每个语言的页面、根页和 public 文件", () => {
    build({ root, out });
    for (const p of ["index.html", "zh/index.html", "en/index.html", "ja/index.html", "favicon.svg"]) {
      expect(existsSync(join(out, p))).toBe(true);
    }
  });

  test("语言页包含 lang、标题、hreflang 和语言记忆", () => {
    build({ root, out });
    const en = html("en/index.html");
    expect(en).toContain('<html lang="en" dir="ltr">');
    expect(en).toContain("<title>Amalthea · One source, many languages</title>");
    expect(en).toContain('<link rel="canonical" href="https://example.com/en/">');
    expect(en).toContain('<link rel="alternate" hreflang="ja" href="https://example.com/ja/">');
    expect(en).toContain('<link rel="alternate" hreflang="x-default" href="https://example.com/">');
    expect(en).toContain('localStorage.lang="en"');
    expect(en).toContain('addEventListener("keydown"');
    expect(en).toContain('href="../ja/" hreflang="ja" lang="ja">日本語</a>');
    expect(en).toContain('aria-current="page">English</a>');
    expect(en).toContain('aria-label="Language: English"');
    expect(en).toContain('data-colon=": "');
    expect(html("zh/index.html")).toContain('aria-label="切换语言：中文"');
    expect(en).toContain("© " + new Date().getFullYear() + " Amalthea");
  });

  test("每页 head 都先应用主题，避免闪烁", () => {
    build({ root, out });
    for (const p of ["index.html", "zh/index.html", "en/index.html"]) {
      const page = html(p),
        head = page.slice(0, page.indexOf("</head>"));
      expect(head).toContain("document.documentElement.dataset.theme = theme");
    }
  });

  test("语言页的主题按钮带翻译文案，默认隐藏等 JS 显示", () => {
    build({ root, out });
    const ja = html("ja/index.html");
    expect(ja).toMatch(/<button class="btn theme" type="button" hidden data-colon="：" data-title="テーマ" data-system="[^"]+" data-light="ライト" data-dark="ダーク">/);
    expect(ja).toContain('addEventListener("storage"');
  });

  test("根页包含跳转脚本和所有语言链接", () => {
    build({ root, out });
    const index = html("index.html");
    expect(index).toContain('<html lang="zh" dir="ltr">');
    expect(index).toContain('["zh","en","ja"]');
    expect(index).toContain("location.replace(");
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
    const pkg = join(root, "package.json");
    writeFileSync(pkg, readFileSync(pkg, "utf8").replace("https://example.com/", "https://a.com/site/"));
    build({ root, out });
    expect(html("en/index.html")).toContain('<link rel="canonical" href="https://a.com/site/en/">');
  });

  test("homepage 没有结尾斜杠时自动补上", () => {
    const pkg = join(root, "package.json");
    writeFileSync(pkg, readFileSync(pkg, "utf8").replace("https://example.com/", "https://a.com/site"));
    build({ root, out });
    expect(html("en/index.html")).toContain('<link rel="canonical" href="https://a.com/site/en/">');
    expect(html("index.html")).toContain('<link rel="canonical" href="https://a.com/site/">');
  });

  test("package.json 缺少 brand 时报错", () => {
    const pkg = join(root, "package.json");
    writeFileSync(pkg, readFileSync(pkg, "utf8").replace(/"brand": ".*",\n/, ""));
    expect(() => build({ root, out })).toThrow("package.json 必须配置 homepage 和 brand");
  });

  test("构建失败时保留旧产物", () => {
    build({ root, out });
    addLang("xx");
    expect(() => build({ root, out })).toThrow();
    expect(existsSync(join(out, "en/index.html"))).toBe(true);
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

  test("译文缺键时报错并提示运行 tran", () => {
    const p = join(root, "i18n/ja/site.yml");
    writeFileSync(p, readFileSync(p, "utf8").replace(/^lang:.*\n/m, ""));
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
