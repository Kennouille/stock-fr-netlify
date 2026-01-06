// Importer Supabase depuis ton fichier
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async function() {
    const splash = document.getElementById('splashScreen');
    const loginContainer = document.querySelector('.login-container');

    // Le login est caché au début (grâce au CSS)

    try {
        // On charge le contenu HTML de nexen-suite.html
        const response = await fetch('nexen-suite.html');
        const html = await response.text();
        splash.innerHTML = html;
    } catch (err) {
        console.error("Erreur lors du chargement de nexen-suite.html", err);
        splash.innerHTML = "<h2>Chargement...</h2>";
    }

    // Après 6 secondes, on fait disparaître le splash
    setTimeout(() => {
        splash.classList.add('fade-out');

        // Après la transition du splash, on montre le login
        setTimeout(() => {
            splash.remove();
            loginContainer.classList.add('show');
        }, 1000); // Correspond à la durée de la transition fade-out
    }, 4000); // 6 secondes d'affichage du splash

    // Vérifier si l'utilisateur est déjà connecté
    const user = sessionStorage.getItem('current_user');
    if (user) {
        window.location.href = 'accueil.html';
    }
});

// Gérer la soumission du formulaire
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');

    // Validation basique
    if (!username || !password) {
        showError('Veuillez remplir tous les champs');
        return;
    }

    // Désactiver le bouton
    const loginBtn = document.querySelector('.login-btn');
    const originalText = loginBtn.innerHTML;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connexion...';
    loginBtn.disabled = true;

    try {
        // Rechercher l'utilisateur dans la table 'w_users'
        const { data: userData, error: userError } = await supabase
            .from('w_users')
            .select('*')
            .eq('username', username)
            .single();

        if (userError || !userData) {
            showError('Nom d\'utilisateur incorrect');
            return;
        }

        // Vérifier le mot de passe
        if (password === userData.password) {
            // Connexion réussie - stocker les infos utilisateur
            sessionStorage.setItem('current_user', JSON.stringify({
                id: userData.id,
                username: userData.username,
                permissions: userData.permissions || {},
                isAdmin: userData.permissions?.config || false
            }));

            // Rediriger vers l'accueil
            window.location.href = 'accueil.html';
        } else {
            showError('Mot de passe incorrect');
        }

    } catch (error) {
        console.error('Erreur de connexion:', error);
        showError('Erreur de connexion au serveur');
    } finally {
        // Réactiver le bouton
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
    }
});

// Fonction pour afficher les erreurs
function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');

    errorText.textContent = message;
    errorMessage.style.display = 'flex';

    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

// Effacer l'erreur quand l'utilisateur tape
document.getElementById('username').addEventListener('input', function() {
    document.getElementById('errorMessage').style.display = 'none';
});

document.getElementById('password').addEventListener('input', function() {
    document.getElementById('errorMessage').style.display = 'none';
});