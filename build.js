import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { load } from "js-yaml";
import pug from "pug";
import CODE from "@3-/lang/CODE.js";
import NAME from "@3-/lang/NAME.js";
import pick from "./src/pick.js";

const FONT = "https://cdn.jsdmirror.com/npm/18s@0.2.24/_.css",
  RTL = new Set(["ar", "fa", "ur", "iw", "sd"]),
  // iw 是已废弃的 BCP 47 代码，html lang 和 hreflang 输出 he
  TAG = { iw: "he" },
  // 中日韩用全角冒号拼接「标签：值」
  CJK = /^(zh|ja|ko)/,
  write = (path, txt) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, txt);
  };

/*
  src 源语言文案，t 译文
  返回 src 中有、t 中缺失的键路径
*/
export const missing = (src, t, path = []) =>
  src && typeof src === "object"
    ? Object.keys(src).flatMap((k) => {
        const p = [...path, k];
        return t?.[k] === undefined ? [p.join(".")] : missing(src[k], t[k], p);
      })
    : [];

/*
  root 项目根目录，out 输出目录
  每个语言渲染 <out>/<lang>/index.html，再渲染跳转用的根页 <out>/index.html
  返回 语言目录名列表（源语言在前）
*/
const build = ({ root = import.meta.dirname, out = join(root, "dist") } = {}) => {
  const read = (...p) => readFileSync(join(root, ...p), "utf8"),
    { from } = load(read("tran.yml")).tran,
    { homepage, brand } = JSON.parse(read("package.json")),
    // 补结尾斜杠，否则 new URL("en/", "https://a.com/site") 会丢掉 site
    home = homepage?.replace(/\/?$/, "/"),
    codes = readdirSync(join(root, "i18n")).filter((c) => existsSync(join(root, "i18n", c, "site.yml"))),
    unknown = codes.filter((c) => !CODE.includes(c));

  if (!home || !brand) throw new Error("package.json 必须配置 homepage 和 brand");
  if (unknown.length) throw new Error(`i18n/ 下有不支持的语言代码：${unknown.join(", ")}`);
  if (!codes.includes(from)) throw new Error(`缺少源语言文案 i18n/${from}/site.yml`);
  codes.sort((a, b) => (b === from) - (a === from) || CODE.indexOf(a) - CODE.indexOf(b));

  const src = load(read("i18n", from, "site.yml")),
    langs = codes.map((code) => {
      const t = load(read("i18n", code, "site.yml")),
        lack = missing(src, t);
      if (lack.length) throw new Error(`i18n/${code}/site.yml 缺少 ${lack.join(", ")}，请运行 bun run tran`);
      return {
        code,
        t,
        tag: TAG[code] || code,
        dir: RTL.has(code) ? "rtl" : "ltr",
        colon: CJK.test(code) ? "：" : ": ",
        name: NAME[CODE.indexOf(code)],
        url: new URL(code + "/", home).href,
      };
    }),
    // 品牌名不放进 yml，避免被翻译改写
    shared = { FONT, langs, brand, year: new Date().getFullYear(), home, css: read("src", "style.css") },
    // 每页 head 先执行主题脚本，再执行各自的脚本
    themeJs = read("src", "theme.js"),
    pageJs = read("src", "page.js"),
    render = (name, locals) => pug.renderFile(join(root, "src", name + ".pug"), { ...shared, ...locals });

  rmSync(out, { recursive: true, force: true });
  cpSync(join(root, "public"), out, { recursive: true });

  for (const l of langs) {
    write(
      join(out, l.code, "index.html"),
      render("index", { l, t: l.t, url: l.url, base: "../", js: themeJs + `try{localStorage.lang=${JSON.stringify(l.code)}}catch{}\n` + pageJs }),
    );
  }

  write(
    join(out, "index.html"),
    render("root", {
      l: langs[0],
      t: src,
      url: home,
      base: "",
      js: themeJs + `let s;try{s=localStorage.lang}catch{}location.replace((${pick})(${JSON.stringify(codes)},s,navigator.languages||[navigator.language])+"/")`,
    }),
  );

  return codes;
};

export default build;

if (import.meta.main) console.log("built:", build().join(", "));
