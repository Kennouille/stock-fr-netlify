// Système de traduction
let currentLanguage = localStorage.getItem('language') || 'fr';
let translations = {};

// Charger les traductions
async function loadTranslations(lang) {
    try {
        const response = await fetch(`lang/${lang}.json`);
        translations = await response.json();
        return translations;
    } catch (error) {
        console.error('Erreur chargement traductions:', error);
        return null;
    }
}

// Traduire la page
function translatePage() {
    // Textes normaux
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[key]) {
            element.textContent = translations[key];
        }
    });

    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (translations[key]) {
            element.placeholder = translations[key];
        }
    });
}


// Changer de langue
async function changeLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);

    await loadTranslations(lang);
    translatePage();

    // Mettre à jour les boutons actifs
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-lang') === lang) {
            btn.classList.add('active');
        }
    });
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', async () => {
    await loadTranslations(currentLanguage);
    translatePage();

    // Event listeners pour les boutons de langue
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            changeLanguage(lang);
        });
    });
});