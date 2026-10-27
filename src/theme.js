// 在 head 里同步执行：绘制前应用用户选的主题，避免亮暗闪烁。没有 data-theme 表示跟随系统
try {
  const theme = localStorage.theme;
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
} catch {}
