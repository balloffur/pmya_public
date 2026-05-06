function isMobile() {
    return window.innerWidth <= 768;
}

function hideUnneededElements() {
    const backArrow = document.querySelector(".nav-home, .back-arrow");
    if (backArrow) backArrow.style.display = isMobile() ? "none" : "";

    const themeButtons = document.querySelectorAll("#theme-toggle, .theme-switch, .theme-toggle");
    themeButtons.forEach(btn => btn.style.display = isMobile() ? "none" : "");
}

function stretchMainPanel() {
    const panel = document.querySelector(".panel, .wrap");
    if (!panel) return;

    if (isMobile()) {
        panel.style.minHeight = (window.innerHeight - 20) + "px";
        panel.style.display = "flex";
        panel.style.flexDirection = "column";
        panel.style.justifyContent = "flex-start";
    } else {
        panel.style.minHeight = "";
        panel.style.display = "";
        panel.style.flexDirection = "";
        panel.style.justifyContent = "";
    }
}

function applySystemTheme() {
    const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const body = document.body;

    if (darkModeQuery.matches) {
        body.classList.add("dark");
        body.classList.remove("light");
    } else {
        body.classList.add("light");
        body.classList.remove("dark");
    }
}

function hideHelpPanels() {
    const helpPanel = document.getElementById("helpPanel");
    if (helpPanel) helpPanel.style.display = "none";

    const varsPanel = document.getElementById("varsPanel");
    if (varsPanel) varsPanel.style.display = "none";
}

function initMobile() {
    hideUnneededElements();
    stretchMainPanel();
    applySystemTheme();
    hideHelpPanels();
}

window.addEventListener("DOMContentLoaded", initMobile);
window.addEventListener("resize", initMobile);
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applySystemTheme);
