
(function () {
  const root = document.documentElement;
  const STORAGE_KEY = "theme";
  const DARK = "dark";
  const LIGHT = "light";

  function getSystemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? DARK : LIGHT;
  }

  function setButtonIcon(theme) {
    const btn = document.getElementById("theme-toggle");
    if (btn) btn.textContent = theme === DARK ? "🌑" : "🌕";
  }

  function applyTheme(theme, persist = true) {
    root.setAttribute("data-theme", theme);
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
    }
    setButtonIcon(theme);
    window.dispatchEvent(new CustomEvent("pmya-theme-change", { detail: { theme } }));
  }

  function getSavedTheme() {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }

  applyTheme(getSavedTheme() || getSystemTheme(), false);

  function ensureButton() {
    if (document.getElementById("theme-toggle")) {
      setButtonIcon(root.getAttribute("data-theme") || getSavedTheme() || getSystemTheme());
      return;
    }
    const btn = document.createElement("button");
    btn.id = "theme-toggle";
    btn.type = "button";
    btn.className = "theme-toggle-fixed";
    btn.setAttribute("aria-label", "Toggle dark mode");
    document.body.appendChild(btn);
    setButtonIcon(root.getAttribute("data-theme") || getSavedTheme() || getSystemTheme());
  }

  function toggleTheme() {
    const current = root.getAttribute("data-theme") || getSavedTheme() || getSystemTheme();
    applyTheme(current === DARK ? LIGHT : DARK, true);
  }

  document.addEventListener("DOMContentLoaded", function () {
    ensureButton();
    const btn = document.getElementById("theme-toggle");
    if (btn && !btn.dataset.themeBound) {
      btn.dataset.themeBound = "1";
      btn.addEventListener("click", toggleTheme);
    }
  });

  if (window.matchMedia) {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      if (!getSavedTheme()) applyTheme(getSystemTheme(), false);
    };
    if (typeof media.addEventListener === "function") media.addEventListener("change", listener);
    else if (typeof media.addListener === "function") media.addListener(listener);
  }

  window.pmyaTheme = { applyTheme, toggleTheme, getSystemTheme };
})();
