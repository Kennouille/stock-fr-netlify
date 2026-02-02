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

// Fonction de traduction avec paramètres et support des clés imbriquées
function t(key, params = {}) {
    // Gérer les clés imbriquées (ex: "actions.sortie.title")
    let keys = key.split('.');
    let text = keys.reduce((obj, k) => obj && obj[k], translations) || key;

    // Remplacer les paramètres {{variable}}
    if (typeof text === 'string') {
        Object.keys(params).forEach(param => {
            text = text.replace(`{{${param}}}`, params[param]);
        });
    }

    return text;
}

// Traduire la page
function translatePage() {
    // Textes normaux
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translated = t(key);
        if (translated && translated !== key) {
            element.textContent = translated;
        }
    });

    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        const translated = t(key);
        if (translated && translated !== key) {
            element.placeholder = translated;
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

// 🔥 EXPORT : Ajoute cette ligne à la fin
export const i18n = {
    t,
    changeLanguage,
    translatePage,
    getCurrentLanguage: () => currentLanguage
};
