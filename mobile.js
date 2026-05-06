function stretchMainPanel() {
    const panel = document.querySelector(".panel");
    if (!panel) return;

    if (isMobile()) {
        panel.style.minHeight = (window.innerHeight - 40) + "px"; 
        panel.style.display = "flex";
        panel.style.flexDirection = "column";
        panel.style.justifyContent = "center";
    } else {
        panel.style.minHeight = "";
        panel.style.display = "";
        panel.style.flexDirection = "";
        panel.style.justifyContent = "";
    }
}
