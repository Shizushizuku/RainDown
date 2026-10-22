"use strict";

// 在样式加载前恢复主题，避免切换页面时闪现浅色背景。
(() => {
  const root = document.documentElement;
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  let preference = null;
  let button;
  try {
    const saved = localStorage.getItem("raindown-theme");
    if (saved === "light" || saved === "dark") preference = saved;
  } catch { /* 浏览器禁用存储时，仍可在当前页面切换。 */ }

  function applyTheme() {
    const dark = (preference || (systemTheme.matches ? "dark" : "light")) === "dark";
    root.dataset.theme = dark ? "dark" : "light";
    const themeColor = document.querySelector('meta[name="theme-color"]');
    themeColor?.setAttribute("content", dark ? "#1c211f" : (themeColor.dataset.lightColor || "#f7f6f2"));
    if (!button) return;
    button.setAttribute("aria-pressed", String(dark));
    button.setAttribute("aria-label", `切换到${dark ? "浅" : "深"}色模式`);
    button.title = button.getAttribute("aria-label");
    button.querySelector("[data-theme-icon]").textContent = dark ? "☀" : "☾";
    button.querySelector("[data-theme-label]").textContent = dark ? "浅色" : "深色";
  }

  applyTheme();
  systemTheme.addEventListener("change", () => { if (!preference) applyTheme(); });
  window.addEventListener("storage", (event) => {
    if (event.key !== "raindown-theme" && event.key !== null) return;
    preference = event.newValue === "light" || event.newValue === "dark" ? event.newValue : null;
    applyTheme();
  });
  document.addEventListener("DOMContentLoaded", () => {
    button = document.querySelector("[data-theme-toggle]");
    if (!button) return;
    button.hidden = false;
    applyTheme();
    button.addEventListener("click", () => {
      preference = root.dataset.theme === "dark" ? "light" : "dark";
      try { localStorage.setItem("raindown-theme", preference); } catch { /* 保留当前页面选择。 */ }
      applyTheme();
    });
  });
})();
