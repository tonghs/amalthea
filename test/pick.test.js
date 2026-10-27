import { describe, expect, test } from "bun:test";
import pick from "../src/pick.js";

const CODES = ["zh", "en", "ja"];

describe("pick", () => {
  test("优先使用上次访问的语言", () => {
    expect(pick(CODES, "ja", ["en-US"])).toBe("ja");
  });

  test("忽略无效的上次访问语言", () => {
    expect(pick(CODES, "fr", ["en-US"])).toBe("en");
    expect(pick(CODES, undefined, ["en-US"])).toBe("en");
  });

  test("按浏览器语言顺序匹配，不区分大小写", () => {
    expect(pick(CODES, null, ["fr", "JA-jp", "en"])).toBe("ja");
    expect(pick(["zh", "zh-TW"], null, ["ZH-tw"])).toBe("zh-TW");
  });

  test("地区标签回退到主语言", () => {
    expect(pick(CODES, null, ["zh-CN"])).toBe("zh");
    expect(pick(CODES, null, ["en-GB"])).toBe("en");
  });

  test("繁体中文标签映射到 zh-TW", () => {
    const codes = ["zh", "zh-TW"];
    for (const tag of ["zh-TW", "zh-HK", "zh-MO", "zh-Hant", "zh-Hant-HK"]) {
      expect(pick(codes, null, [tag])).toBe("zh-TW");
    }
  });

  test("没有 zh-TW 时繁体中文回退到 zh", () => {
    expect(pick(CODES, null, ["zh-HK"])).toBe("zh");
    expect(pick(CODES, null, ["zh-Hant-TW"])).toBe("zh");
  });

  test("he 映射到 iw", () => {
    expect(pick(["en", "iw"], null, ["he-IL"])).toBe("iw");
  });

  test("没有匹配时返回源语言", () => {
    expect(pick(CODES, null, ["fr", "de"])).toBe("zh");
    expect(pick(CODES, null, [])).toBe("zh");
  });

  test("源码可以脱离模块独立运行（构建时会内联到根页）", () => {
    const inlined = new Function(`return (${pick})`)();
    expect(inlined(CODES, null, ["ja"])).toBe("ja");
  });
});
