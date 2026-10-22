"use strict";

// 不支持原生跨页过渡或直接打开本地文件时，使用简短的淡入淡出。
(() => {
  const nativeTransitions = "CSSViewTransitionRule" in window && location.protocol !== "file:";
  const surface = document.querySelector(".shell");
  if (nativeTransitions || !surface?.animate) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let animation;
  let destination = "";
  let recoveryTimer;

  function reset() {
    destination = "";
    clearTimeout(recoveryTimer);
    animation?.cancel();
    animation = null;
  }

  function enter() {
    if (reducedMotion.matches) return;
    animation = surface.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 200,
      easing: "ease-out"
    });
  }

  enter();
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || reducedMotion.matches) return;
    const link = event.target.closest?.("a[href]");
    if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;

    const target = new URL(link.href, location.href);
    if (target.origin !== location.origin || target.protocol !== location.protocol || !["http:", "https:", "file:"].includes(target.protocol)) return;
    if (target.pathname === location.pathname && target.search === location.search) return;
    if (!target.pathname.endsWith(".html") && !target.pathname.endsWith("/")) return;

    event.preventDefault();
    if (destination) {
      destination = target.href;
      return;
    }
    const opacity = getComputedStyle(surface).opacity;
    animation?.cancel();
    destination = target.href;
    animation = surface.animate([{ opacity }, { opacity: 0 }], {
      duration: 100,
      easing: "ease-in",
      fill: "forwards"
    });
    animation.finished.then(() => {
      if (!destination) return;
      // 跳转缓慢或取消时恢复当前页，防止停留在透明状态。
      recoveryTimer = setTimeout(reset, 500);
      location.assign(destination);
    }, () => { /* 返回页面或减少动态效果时，动画可以被取消。 */ });
  });
  window.addEventListener("pagehide", reset);
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    reset();
    enter();
  });
  reducedMotion.addEventListener("change", () => {
    const pending = destination;
    reset();
    if (pending) location.assign(pending);
  });
})();

// 宽屏使用侧栏，窄屏使用抽屉；两种视图分别保留各自的开关状态。
const readingLayout = document.querySelector("[data-reading-layout]");
if (readingLayout) {
  const sidebar = readingLayout.querySelector(".index-sidebar");
  const toggle = readingLayout.querySelector("[data-index-toggle]");
  const close = readingLayout.querySelector("[data-index-close]");
  const backdrop = readingLayout.querySelector("[data-index-backdrop]");
  const mobile = window.matchMedia("(max-width: 850px)");
  const background = [...document.querySelectorAll(".site-header, .site-footer, #main, .skip-link")];
  let desktopOpen = true;
  let mobileOpen = false;
  try { desktopOpen = localStorage.getItem("raindown-index-open") !== "false"; } catch { /* 使用默认状态。 */ }
  readingLayout.classList.add("js-index");
  sidebar.hidden = false;
  toggle.hidden = false;
  backdrop.hidden = false;
  close.hidden = false;

  function renderIndex() {
    const open = mobile.matches ? mobileOpen : desktopOpen;
    const modal = mobile.matches && open;
    // 保留元素以完成退场动画，并立即停止隐藏内容的键盘交互。
    sidebar.inert = !open;
    sidebar.setAttribute("aria-hidden", String(!open));
    toggle.inert = open;
    toggle.setAttribute("aria-hidden", String(open));
    readingLayout.classList.toggle("index-collapsed", !open);
    toggle.setAttribute("aria-expanded", String(open));
    close.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("index-modal-open", modal);
    for (const element of background) element.inert = modal;
    if (modal) {
      sidebar.setAttribute("role", "dialog");
      sidebar.setAttribute("aria-modal", "true");
    } else {
      sidebar.removeAttribute("role");
      sidebar.removeAttribute("aria-modal");
    }
  }

  function setIndex(open, restoreFocus = true) {
    if (mobile.matches) mobileOpen = open;
    else {
      desktopOpen = open;
      try { localStorage.setItem("raindown-index-open", String(open)); } catch { /* 当前页仍可收起。 */ }
    }
    renderIndex();
    if (restoreFocus) (open ? close : toggle).focus({ preventScroll: true });
  }

  toggle.addEventListener("click", () => setIndex(true));
  close.addEventListener("click", () => setIndex(false));
  backdrop.addEventListener("click", () => setIndex(false));
  sidebar.addEventListener("click", (event) => {
    if (mobile.matches && event.target.closest("a")) setIndex(false, false);
  });
  document.addEventListener("keydown", (event) => {
    if (!mobile.matches || !mobileOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setIndex(false);
    } else if (event.key === "Tab") {
      const items = [...sidebar.querySelectorAll("button, a[href]")]
        .filter((item) => !item.closest("[inert]") && item.getClientRects().length);
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  mobile.addEventListener("change", () => {
    const focusInside = sidebar.contains(document.activeElement);
    const focusOnToggle = document.activeElement === toggle;
    mobileOpen = false;
    renderIndex();
    if (focusInside && sidebar.inert) toggle.focus({ preventScroll: true });
    else if (focusOnToggle && toggle.inert) close.focus({ preventScroll: true });
  });
  renderIndex();
  // 初始状态先落定，避免加载页面时从展开态滑到已保存的收起态。
  requestAnimationFrame(() => requestAnimationFrame(() => {
    readingLayout.classList.add("index-motion-ready");
  }));
}

// 笔记索引按科目独立收放；禁用 JavaScript 时仍显示全部链接。
document.querySelectorAll('.index-sidebar nav[aria-label="笔记索引"] .index-group').forEach((group, index) => {
  const heading = group.querySelector("h3");
  const list = group.querySelector("ul");
  if (!heading || !list) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "index-subject-toggle";
  button.textContent = heading.textContent;
  button.setAttribute("aria-expanded", "true");

  const content = document.createElement("div");
  content.className = "index-subject-content";
  content.id = `note-subject-${index}`;
  button.setAttribute("aria-controls", content.id);
  list.before(content);
  content.append(list);
  heading.replaceChildren(button);
  group.classList.add("index-subject");

  button.addEventListener("click", () => {
    const open = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(open));
    content.inert = !open;
    content.setAttribute("aria-hidden", String(!open));
    group.classList.toggle("subject-collapsed", !open);
  });
});

// 分类筛选只增强笔记列表；禁用 JavaScript 时，所有笔记仍可阅读。
const filterBar = document.querySelector("[data-note-filters]");

if (filterBar) {
  const buttons = [...filterBar.querySelectorAll("button[data-filter]")];
  const notes = [...document.querySelectorAll("[data-note-category]")];
  const status = document.querySelector("[data-filter-status]");
  filterBar.hidden = false;

  filterBar.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter]");
    if (!button || !filterBar.contains(button)) return;

    const category = button.dataset.filter;
    let visibleCount = 0;
    for (const note of notes) {
      note.hidden = category !== "all" && note.dataset.noteCategory !== category;
      if (!note.hidden) visibleCount += 1;
    }
    for (const item of buttons) {
      item.setAttribute("aria-pressed", String(item === button));
    }
    if (status) status.textContent = `${button.textContent.trim()} · ${visibleCount} 篇示例笔记`;
  });
}
