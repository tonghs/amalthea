// 语言对话框：没有 JS 时按钮是指向根页的链接，根页列出全部语言
addEventListener("DOMContentLoaded", () => {
  const dialog = document.querySelector(".langs");

  document.querySelector(".lang").addEventListener("click", (e) => {
    e.preventDefault();
    dialog.showModal();
    // 焦点定位到当前语言，75 种语言时也能直接看到
    const current = dialog.querySelector("[aria-current]");
    current.focus({ preventScroll: true });
    current.scrollIntoView({ block: "center" });
  });
  dialog.querySelector(".close").addEventListener("click", () => dialog.close());
  // 点击遮罩关闭。dialog 没有内边距，target 是 dialog 本身说明在内容之外。
  // 按下和松开都在遮罩上才关闭：拖出或拖入内容时，click 的 target 也是 dialog，无法区分。
  // 只认主键（触屏和笔也是 0），右键、中键不关闭
  let downOnBackdrop = false;
  dialog.addEventListener("pointerdown", (e) => (downOnBackdrop = e.button === 0 && e.target === dialog));
  dialog.addEventListener("pointerup", (e) => downOnBackdrop && e.target === dialog && dialog.close());
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
      const txt = btn.dataset.title + btn.dataset[current()];
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
  // 其他标签页切换主题时同步；localStorage.clear() 时 key 为 null，回到跟随系统
  addEventListener("storage", (e) => (e.key === "theme" || e.key === null) && apply(e.newValue));
});
