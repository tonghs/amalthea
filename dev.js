import { statSync, watch } from "node:fs";
import { join, resolve, sep } from "node:path";
import build from "./build.js";

const ROOT = import.meta.dirname,
  OUT = join(ROOT, "dist");

/*
  req 请求
  返回 dist 下对应文件的响应，行为和静态托管一致
*/
export const handle = (req) => {
  const url = new URL(req.url);
  let path, stat;
  try {
    // 结尾斜杠表示目录，取其 index.html；因此 /favicon.svg/ 不存在，和静态托管一样 404
    path = join(resolve(OUT, "." + decodeURIComponent(url.pathname)), url.pathname.endsWith("/") ? "index.html" : "");
    if (path !== OUT && !path.startsWith(OUT + sep)) return new Response("Forbidden", { status: 403 });
    stat = statSync(path, { throwIfNoEntry: false });
  } catch (e) {
    // 路径经过文件（/favicon.svg/x）时是 ENOTDIR，按不存在处理；其余是非法的百分号编码或路径含 \0
    if (e.code !== "ENOTDIR") return new Response("Bad Request", { status: 400 });
  }
  if (!stat) return new Response("Not Found", { status: 404 });
  // 走到这里的目录一定没有结尾斜杠：补斜杠，保证相对链接正确。改 URL 对象：保持同源，保留 query
  if (stat.isDirectory()) {
    url.pathname += "/";
    return Response.redirect(url, 301);
  }
  return new Response(Bun.file(path));
};

if (import.meta.main) {
  const PORT = Number(process.env.PORT) || 3000,
    rebuild = () => {
      try {
        console.log(new Date().toLocaleTimeString(), "built:", build().join(", "));
      } catch (e) {
        console.error(e.message);
      }
    };

  rebuild();
  // build.js、pick.js 的改动由 bun --watch 重启进程处理
  for (const dir of ["src", "i18n", "public"]) watch(join(ROOT, dir), { recursive: true }, rebuild);
  // tran.yml、package.json 也影响构建。监听根目录而不是单个文件：编辑器原子保存会替换文件，单文件监听随之失效
  watch(ROOT, (_, file) => (file === "tran.yml" || file === "package.json") && rebuild());

  Bun.serve({ port: PORT, fetch: handle });
  console.log(`http://localhost:${PORT}/`);
}
