import { beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import build from "../build.js";
import { handle } from "../dev.js";

// handle 固定读项目根下的 dist/，先构建到默认输出目录（dist 是构建产物，已 gitignore）
delete process.env.SITE_URL;
beforeAll(() => build());

const get = (path) => handle(new Request("http://localhost" + path)),
  // 状态码和正文
  res = async (path) => {
    const r = get(path);
    return [r.status, await r.text()];
  };

describe("handle", () => {
  test("目录带结尾斜杠时返回该目录的 index.html", async () => {
    const r = get("/en/");
    expect(r.status).toBe(200);
    // Bun.file 响应的 content-type 惰性生成，先读头再读正文
    expect(r.headers.get("content-type")).toContain("text/html");
    expect(await r.text()).toContain('<html lang="en"');
  });

  test("根路径返回根页", async () => {
    const [status, body] = await res("/");
    expect(status).toBe(200);
    expect(body).toContain("location.replace(");
  });

  test("返回 public 拷贝来的文件", async () => {
    const r = get("/favicon.svg");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("svg");
    expect(await r.text()).toContain("<svg");
  });

  test("目录没有结尾斜杠时 301 补斜杠，保留 query", () => {
    const r = get("/en?x=1");
    expect(r.status).toBe(301);
    expect(r.headers.get("location")).toBe("http://localhost/en/?x=1");
  });

  test("路径以 // 开头时跳转仍是同源地址", () => {
    // 拼字符串会得到 //en/，浏览器会当成协议相对地址跳到 en 这个主机
    const r = get("//en");
    expect(r.status).toBe(301);
    expect(r.headers.get("location")).toBe("http://localhost//en/");
  });

  test("不存在的路径返回 404", async () => {
    expect(await res("/nope.html")).toEqual([404, "Not Found"]);
  });

  test("文件路径带结尾斜杠时返回 404", async () => {
    expect(await res("/favicon.svg/")).toEqual([404, "Not Found"]);
    expect(await res("/en/index.html/")).toEqual([404, "Not Found"]);
  });

  test("路径经过文件时返回 404", async () => {
    expect(await res("/favicon.svg/x")).toEqual([404, "Not Found"]);
  });

  test("目录缺少 index.html 时返回 404", async () => {
    const dir = join(import.meta.dirname, "../dist/emptydir");
    mkdirSync(dir);
    try {
      expect(await res("/emptydir/")).toEqual([404, "Not Found"]);
    } finally {
      rmdirSync(dir);
    }
  });

  test("用编码斜杠穿越到 dist 外时返回 403", async () => {
    // new Request 会把 /../ 和 /%2e%2e/ 规范化掉，编码的斜杠则原样保留
    expect(await res("/a%2F..%2F..%2Fpackage.json")).toEqual([403, "Forbidden"]);
    expect(await res("/..%2Fpackage.json")).toEqual([403, "Forbidden"]);
  });

  test("非法的百分号编码返回 400", async () => {
    expect(await res("/%E0%A4%A")).toEqual([400, "Bad Request"]);
  });

  test("路径含 \\0 时返回 400", async () => {
    expect(await res("/%00")).toEqual([400, "Bad Request"]);
  });
});
