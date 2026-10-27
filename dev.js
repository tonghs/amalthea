import { existsSync, statSync, watch } from "node:fs";
import { join, resolve, sep } from "node:path";
import build from "./build.js";

const ROOT = import.meta.dirname,
  OUT = join(ROOT, "dist"),
  PORT = Number(process.env.PORT) || 3000,
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

Bun.serve({
  port: PORT,
  fetch(req) {
    const { pathname } = new URL(req.url),
      path = resolve(OUT, "." + decodeURIComponent(pathname));
    if (path !== OUT && !path.startsWith(OUT + sep)) return new Response("Forbidden", { status: 403 });
    if (existsSync(path) && statSync(path).isDirectory()) {
      // 和静态托管一致：目录补斜杠，保证页面里的相对链接正确
      if (!pathname.endsWith("/")) return Response.redirect(pathname + "/", 301);
      return new Response(Bun.file(join(path, "index.html")));
    }
    return existsSync(path) ? new Response(Bun.file(path)) : new Response("Not Found", { status: 404 });
  },
});

console.log(`http://localhost:${PORT}/`);
