// 语言下拉：点击外部或按 Esc 时收起；没有 JS 时 details 仍可用
addEventListener("click", (e) => {
  const d = document.querySelector(".lang");
  if (!d.contains(e.target)) d.open = false;
});
addEventListener("keydown", (e) => {
  const d = document.querySelector(".lang");
  if (e.key === "Escape" && d.open) {
    d.open = false;
    d.querySelector("summary").focus();
  }
});

// 主题切换：跟随系统 → 浅色 → 深色 → 跟随系统。没有 data-theme 表示跟随系统
addEventListener("DOMContentLoaded", () => {
  const root = document.documentElement,
    btn = document.querySelector(".theme"),
    NEXT = { system: "light", light: "dark", dark: "system" },
    current = () => root.dataset.theme || "system",
    apply = (theme) => {
      if (theme === "light" || theme === "dark") root.dataset.theme = theme;
      else delete root.dataset.theme;
      const { title, colon } = btn.dataset,
        txt = title + colon + btn.dataset[current()];
      btn.setAttribute("aria-label", txt);
      btn.title = txt;
    };

  apply(current());
  btn.hidden = false;
  btn.addEventListener("click", () => {
    const theme = NEXT[current()];
    apply(theme);
    try {
      if (theme === "system") localStorage.removeItem("theme");
      else localStorage.theme = theme;
    } catch {}
  });
  // 其他标签页切换主题时同步
  addEventListener("storage", (e) => e.key === "theme" && apply(e.newValue));
});
