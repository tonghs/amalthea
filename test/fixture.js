import { cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const ROOT = join(import.meta.dirname, "..");

// 测试只用这几种语言的文案，断言不随仓库开启的语言数量变化
const LANGS = ["zh", "en", "ja"];

/*
  返回 临时目录，含构建所需的项目输入；文案只拷固定的几种语言，测试改动不影响真实文件
*/
export default () => {
  const root = mkdtempSync(join(tmpdir(), "amalthea-"));
  for (const p of ["src", "public", "tran.yml", "package.json", ...LANGS.map((c) => join("i18n", c))]) {
    cpSync(join(ROOT, p), join(root, p), { recursive: true });
  }
  return root;
};
