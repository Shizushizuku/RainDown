"use strict";

// 只处理文章正文，代码块与行内代码保留原样。
if (typeof window.renderMathInElement === "function") {
  document.querySelectorAll(".prose").forEach((article) => {
    window.renderMathInElement(article, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false }
      ],
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "option"],
      ignoredClasses: ["no-math"],
      throwOnError: false,
      trust: false
    });
  });
}
