// Importar Supabase desde tu archivo
import { supabase } from './supabaseClient.js';

// ===== NUEVA FUNCIÓN: Actualizar último login =====
async function updateLastLogin(userId) {
    try {
        const now = new Date().toISOString();
        const { error } = await supabase
            .from('w_users')
            .update({
                last_login: now
            })
            .eq('id', userId);

        if (error) {
            console.error('Error al actualizar last_login:', error);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error:', error);
        return false;
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    const splash = document.getElementById('splashScreen');
    const loginContainer = document.querySelector('.login-container');

    // El login está oculto al principio (gracias al CSS)

    try {
        // Cargamos el contenido HTML de nexen-suite.html
        const response = await fetch('nexen-suite.html');
        const html = await response.text();
        splash.innerHTML = html;
    } catch (err) {
        console.error("Error al cargar nexen-suite.html", err);
        splash.innerHTML = "<h2>Cargando...</h2>";
    }

    // Después de 6 segundos, hacemos desaparecer el splash
    setTimeout(() => {
        splash.classList.add('fade-out');

        // Después de la transición del splash, mostramos el login
        setTimeout(() => {
            splash.remove();
            loginContainer.classList.add('show');
        }, 1000); // Corresponde a la duración de la transición fade-out
    }, 4000); // 6 segundos de visualización del splash

    // Verificar si el usuario ya está conectado
    const user = sessionStorage.getItem('current_user');
    if (user) {
        window.location.href = 'accueil.html';
    }
});

// Gestionar el envío del formulario
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');

    // Validación básica
    if (!username || !password) {
        showError('Por favor, complete todos los campos');
        return;
    }

    // Desactivar el botón
    const loginBtn = document.querySelector('.login-btn');
    const originalText = loginBtn.innerHTML;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Conectando...';
    loginBtn.disabled = true;

    try {
        // 1. Iniciar sesión con Supabase Auth
        const email = `${username.toLowerCase()}@bodega.bombasalmo.mx`;
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError || !authData?.user) {
            showError('Usuario o contraseña incorrectos');
            return;
        }

        // 2. Leer el perfil en w_users (sin traer la contraseña)
        const { data: userData, error: userError } = await supabase
            .from('w_users')
            .select('id, username, permissions')
            .eq('auth_id', authData.user.id)
            .single();

        if (userError || !userData) {
            await supabase.auth.signOut();
            showError('Tu cuenta no tiene acceso a la bodega');
            return;
        }

        // 3. Guardar la info del usuario (mismo formato que antes)
        sessionStorage.setItem('current_user', JSON.stringify({
            id: userData.id,
            username: userData.username,
            permissions: userData.permissions || {},
            isAdmin: userData.permissions?.config || false
        }));

        // 4. Redirigir al inicio
        window.location.href = 'accueil.html';

    } catch (error) {
        console.error('Error de conexión:', error);
        showError('Error de conexión al servidor');
    } finally {
        // Reactivar el botón
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
    }
});

// Función para mostrar errores
function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');

    errorText.textContent = message;
    errorMessage.style.display = 'flex';

    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

// Borrar el error cuando el usuario escribe
document.getElementById('username').addEventListener('input', function() {
    document.getElementById('errorMessage').style.display = 'none';
});

document.getElementById('password').addEventListener('input', function() {
    document.getElementById('errorMessage').style.display = 'none';
});