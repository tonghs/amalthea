/*
  codes 可用语言目录名（第 1 个是源语言），saved 上次访问的语言，prefs 浏览器语言列表
  返回 要跳转的语言目录名
  注意：构建时会把本函数源码内联到根页，函数内不能引用外部变量
*/
export default (codes, saved, prefs) => {
  if (codes.includes(saved)) return saved;
  // 浏览器语言标签 → i18n 目录名，两侧都用小写比较
  const ALIAS = { he: "iw", "zh-hk": "zh-tw", "zh-mo": "zh-tw", "zh-hant": "zh-tw" },
    find = (tag) => codes.find((c) => c.toLowerCase() === (ALIAS[tag] || tag));
  for (const pref of prefs) {
    const s = pref.toLowerCase().split("-"),
      hit = find(s.join("-")) || find(s.slice(0, 2).join("-")) || find(s[0]);
    if (hit) return hit;
  }
  return codes[0];
};
