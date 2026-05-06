function isMobile() {
    return window.innerWidth <= 768; 
}

// 1️⃣ Растягиваем главную страницу
function stretchMainPage() {
    const mainPage = document.querySelector(".main-page"); // замените на ваш селектор главного блока
    if (!mainPage) return;

    if (isMobile()) {
        mainPage.style.minHeight = window.innerHeight + "px";
    } else {
        mainPage.style.minHeight = ""; // возвращаем дефолт
    }
}

// 2️⃣ Устанавливаем тему по умолчанию в зависимости от устройства
function applySystemTheme() {
    const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const body = document.body;

    if (darkModeQuery.matches) {
        body.classList.add("dark"); // например, у тебя есть CSS класс dark
        body.classList.remove("light");
    } else {
        body.classList.add("light");
        body.classList.remove("dark");
    }
}

// Инициализация при загрузке
window.addEventListener("DOMContentLoaded", () => {
    stretchMainPage();
    applySystemTheme();
});

// Адаптация при изменении размера экрана
window.addEventListener("resize", stretchMainPage);

// Поддержка динамической смены темы, если пользователь меняет системную тему
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applySystemTheme);
