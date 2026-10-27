import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Window } from "happy-dom";
import build from "../build.js";

// 在 happy-dom 里加载真实构建产物，让页面内联的 theme.js 和 page.js 自己运行
delete process.env.SITE_URL;
let out;
const windows = [];

beforeAll(() => {
  out = mkdtempSync(join(tmpdir(), "amalthea-page-"));
  build({ out });
});

afterAll(() => rmSync(out, { recursive: true, force: true }));

afterEach(async () => {
  for (const w of windows.splice(0)) await w.happyDOM.close();
});

/*
  lang 语言目录，storage 加载前写入 localStorage 的键值，setup 加载前对窗口做的额外处理
  返回 加载完成的 happy-dom 窗口
*/
const load = async (lang = "en", storage = {}, setup) => {
  const w = new Window({
    url: `https://example.com/${lang}/`,
    settings: { enableJavaScriptEvaluation: true, suppressInsecureJavaScriptEnvironmentWarning: true },
  });
  windows.push(w);
  for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
  setup?.(w);
  w.document.write(readFileSync(join(out, lang, "index.html"), "utf8"));
  w.document.close();
  await w.happyDOM.waitUntilComplete();
  // happy-dom 不派发 DOMContentLoaded，按浏览器的方式在 document 上派发并冒泡到 window
  w.document.dispatchEvent(new w.Event("DOMContentLoaded", { bubbles: true }));
  return w;
};

const $ = (w, s) => w.document.querySelector(s),
  // 当前主题、localStorage.theme、按钮标签
  themeState = (w) => [w.document.documentElement.dataset.theme ?? "system", w.localStorage.getItem("theme"), $(w, ".theme").getAttribute("aria-label")],
  pointer = (w, el, type, button = 0) => el.dispatchEvent(new w.PointerEvent(type, { bubbles: true, button })),
  openDialog = (w) => $(w, ".lang").dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));

describe("主题切换", () => {
  test("加载后显示按钮，默认跟随系统", async () => {
    const w = await load("en"),
      btn = $(w, ".theme");
    expect(btn.hidden).toBe(false);
    expect(themeState(w)).toEqual(["system", null, "Theme: System"]);
    expect(btn.title).toBe("Theme: System");
  });

  test("点击按 跟随系统 → 浅色 → 深色 → 跟随系统 循环，并保存选择", async () => {
    const w = await load("ja"),
      seq = [];
    for (let i = 0; i < 3; i++) {
      $(w, ".theme").click();
      seq.push(themeState(w));
    }
    expect(seq).toEqual([
      ["light", "light", "テーマ：ライト"],
      ["dark", "dark", "テーマ：ダーク"],
      ["system", null, "テーマ：システム設定に合わせる"],
    ]);
  });

  test("已保存的主题在加载时生效", async () => {
    const w = await load("en", { theme: "dark" });
    expect(themeState(w)).toEqual(["dark", "dark", "Theme: Dark"]);
    $(w, ".theme").click();
    expect(themeState(w)).toEqual(["system", null, "Theme: System"]);
  });

  test("忽略非法的已保存值", async () => {
    const w = await load("en", { theme: "blue" });
    expect(w.document.documentElement.dataset.theme).toBeUndefined();
    expect($(w, ".theme").getAttribute("aria-label")).toBe("Theme: System");
  });

  test("同步其他标签页的切换", async () => {
    const w = await load("en"),
      storage = (key, newValue) => w.dispatchEvent(new w.StorageEvent("storage", { key, newValue })),
      theme = () => w.document.documentElement.dataset.theme ?? "system";
    storage("theme", "dark");
    expect(theme()).toBe("dark");
    expect($(w, ".theme").getAttribute("aria-label")).toBe("Theme: Dark");
    // 其他键的变化不影响主题
    storage("lang", "ja");
    expect(theme()).toBe("dark");
    // localStorage.clear() 时 key 为 null，回到跟随系统
    storage(null, null);
    expect(theme()).toBe("system");
    storage("theme", "light");
    storage("theme", "blue");
    expect(theme()).toBe("system");
  });

  test("localStorage 不可用时仍能切换，只是不保存", async () => {
    const w = await load("en", {}, (w) =>
      Object.defineProperty(w, "localStorage", {
        get() {
          throw new Error("denied");
        },
      }),
    );
    const btn = $(w, ".theme");
    expect(btn.hidden).toBe(false);
    btn.click();
    expect(w.document.documentElement.dataset.theme).toBe("light");
    expect(btn.getAttribute("aria-label")).toBe("Theme: Light");
  });
});

describe("语言对话框", () => {
  test("访问语言页时记住该语言", async () => {
    const w = await load("ja");
    expect(w.localStorage.getItem("lang")).toBe("ja");
  });

  test("点击语言按钮不跳转，打开对话框并聚焦当前语言", async () => {
    const w = await load("ja"),
      click = new w.MouseEvent("click", { bubbles: true, cancelable: true });
    $(w, ".lang").dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect($(w, ".langs").open).toBe(true);
    expect(w.document.activeElement.getAttribute("aria-current")).toBe("page");
    expect(w.document.activeElement.textContent).toBe("日本語");
  });

  test("关闭按钮关闭对话框", async () => {
    const w = await load("en");
    openDialog(w);
    $(w, ".close").click();
    expect($(w, ".langs").open).toBe(false);
  });

  test("主键在遮罩上按下并松开时关闭", async () => {
    const w = await load("en"),
      dialog = $(w, ".langs");
    openDialog(w);
    pointer(w, dialog, "pointerdown");
    pointer(w, dialog, "pointerup");
    expect(dialog.open).toBe(false);
  });

  test("右键、中键点遮罩不关闭", async () => {
    const w = await load("en"),
      dialog = $(w, ".langs");
    openDialog(w);
    for (const button of [1, 2]) {
      pointer(w, dialog, "pointerdown", button);
      pointer(w, dialog, "pointerup", button);
    }
    expect(dialog.open).toBe(true);
  });

  test("从内容拖到遮罩、或从遮罩拖进内容时不关闭", async () => {
    const w = await load("en"),
      dialog = $(w, ".langs"),
      title = $(w, ".sheet h2");
    openDialog(w);
    pointer(w, title, "pointerdown");
    pointer(w, dialog, "pointerup");
    expect(dialog.open).toBe(true);
    pointer(w, dialog, "pointerdown");
    pointer(w, title, "pointerup");
    expect(dialog.open).toBe(true);
  });

  test("点击对话框内容不关闭", async () => {
    const w = await load("en"),
      dialog = $(w, ".langs"),
      list = $(w, ".sheet ul");
    openDialog(w);
    pointer(w, list, "pointerdown");
    pointer(w, list, "pointerup");
    expect(dialog.open).toBe(true);
  });
});
