import { supabase } from './supabaseClient.js';

// Elementos DOM y variables
let currentUser = null;
let allUsers = [];
const SUPERADMIN_USERNAME = 'Kennouille';
const SUPERADMIN_CODE = '109801';
let isSuperAdmin = false;

document.addEventListener('DOMContentLoaded', async function() {
    // Verificar autenticación
    await checkAuth();

    // Cargar usuarios
    await loadUsers();

    // Configurar eventos
    setupEventListeners();

    // Ocultar el loading
    document.getElementById('loadingOverlay').style.display = 'none';
});

// AGREGUE ESTA FUNCIÓN EN LA PARTE SUPERIOR DEL ARCHIVO, justo después de las importaciones
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ===== AUTENTICACIÓN =====
async function checkAuth() {
    try {
        // Recuperar el usuario de sessionStorage
        const userJson = sessionStorage.getItem('current_user');

        if (!userJson) {
            window.location.href = 'connexion.html';
            return;
        }

        currentUser = JSON.parse(userJson);

        // Verificar permisos
        if (!currentUser.permissions?.config) {
            alert('No tienes permiso para acceder a esta página');
            window.location.href = 'accueil.html';
            return;
        }

        // Verificar si es el SuperAdmin
        isSuperAdmin = currentUser.username === SUPERADMIN_USERNAME;

        // Actualizar la interfaz de usuario
        updateUserInterface();

        // Mostrar/ocultar la sección SuperAdmin
        toggleSuperAdminSection();

    } catch (error) {
        console.error('Error de autenticación:', error);
        sessionStorage.removeItem('current_user');
        window.location.href = 'connexion.html';
    }
}

function updateUserInterface() {
    document.getElementById('usernameDisplay').textContent = currentUser.username;
}

function toggleSuperAdminSection() {
    const superAdminSection = document.getElementById('superAdminSection');

    if (isSuperAdmin) {
        superAdminSection.style.display = 'block';
        setupSuperAdminInfo();
    } else {
        superAdminSection.style.display = 'none';
    }
}

// ===== SUPER ADMIN =====
function setupSuperAdminInfo() {
    // SIEMPRE mostrar estrellas por defecto para el código, incluso para el SuperAdmin
    document.getElementById('superadminUsername').textContent = SUPERADMIN_USERNAME;
    document.getElementById('superadminCode').textContent = '**********'; // Oculto por defecto

    // Para otros admins, mostrar solo estrellas
    if (!isSuperAdmin) {
        document.getElementById('superadminUsername').textContent = '**********';
        document.getElementById('superadminCode').textContent = '**********';
    }
}

// Revelar información SuperAdmin
document.getElementById('revealSuperadminBtn')?.addEventListener('click', function() {
    const usernameSpan = document.getElementById('superadminUsername');
    const codeSpan = document.getElementById('superadminCode');

    // Si el SuperAdmin está conectado
    if (isSuperAdmin) {
        if (this.innerHTML.includes('fa-eye')) {
            // Revelar solo el código
            usernameSpan.textContent = SUPERADMIN_USERNAME;
            codeSpan.textContent = SUPERADMIN_CODE;
            this.innerHTML = '<i class="fas fa-eye-slash"></i> Ocultar código';
        } else {
            // Ocultar el código con estrellas
            usernameSpan.textContent = SUPERADMIN_USERNAME;
            codeSpan.textContent = '**********';
            this.innerHTML = '<i class="fas fa-eye"></i> Revelar código';
        }
    } else {
        // Para los no SuperAdmin, siempre oculto
        alert('Solo el SuperAdmin puede revelar esta información');
    }
});

// Actualizar SuperAdmin
document.getElementById('updateSuperadminForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const newUsername = document.getElementById('newSuperadminUsername').value.trim();
    const newCode = document.getElementById('newSuperadminCode').value.trim();
    const confirmCode = document.getElementById('confirmSuperadminCode').value.trim();
    const errorDiv = document.getElementById('superadminError');
    const errorText = document.getElementById('superadminErrorText');

    // Validación
    if (newUsername.length < 3) {
        showError(errorDiv, errorText, 'El nombre de usuario debe contener al menos 3 caracteres');
        return;
    }

    if (!/^\d{6}$/.test(newCode)) {
        showError(errorDiv, errorText, 'El código debe contener exactamente 6 dígitos');
        return;
    }

    if (newCode !== confirmCode) {
        showError(errorDiv, errorText, 'Los códigos no coinciden');
        return;
    }

    // Pedir confirmación
    if (!confirm('⚠️ ADVERTENCIA: Va a modificar la información del SuperAdmin.\n\nEsta acción es irreversible. ¿Continuar?')) {
        return;
    }

    // Por ahora, solo mostrar un mensaje
    // En la versión real, actualizarías la base de datos
    alert(`SuperAdmin actualizado:
Nombre: ${newUsername}
Código: ${newCode}

(En realidad, deberías actualizar en tu tabla w_users)`);

    // Reiniciar el formulario
    this.reset();
});

// ===== GESTIÓN DE USUARIOS =====
async function loadUsers() {
    try {
        const { data: users, error } = await supabase
            .from('w_users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allUsers = users || [];
        displayUsers(allUsers);

    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        alert('Error al cargar usuarios');
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    const usersCount = document.getElementById('usersCount');
    const paginationInfo = document.getElementById('paginationInfo');

    // Actualizar el contador
    usersCount.textContent = `${users.length} usuario${users.length > 1 ? 's' : ''}`;
    paginationInfo.textContent = `Mostrando 1-${users.length} de ${users.length}`;

    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="loading-cell">
                    <i class="fas fa-user-slash"></i> Ningún usuario encontrado
                </td>
            </tr>
        `;
        return;
    }

    // Construir la tabla
    tbody.innerHTML = '';

    users.forEach(user => {
        const isCurrentUser = user.username === currentUser.username;
        const isSuperAdminUser = user.username === SUPERADMIN_USERNAME;

        const row = document.createElement('tr');

        // Columna Usuario
        let usernameCell = user.username;
        if (isSuperAdminUser && !isSuperAdmin) {
            usernameCell = '**********';
        }

        // Columna Permisos
        let permissionsHTML = '';
        const permissions = user.permissions || {};

        if (isSuperAdminUser && !isSuperAdmin) {
            permissionsHTML = '<div class="permissions-tags"><span class="permission-tag admin">SUPER ADMIN</span></div>';
        } else {
            permissionsHTML = '<div class="permissions-tags">';
            Object.entries(permissions).forEach(([key, value]) => {
                if (value && key !== 'accueil') {
                    const permissionNames = {
                        'config': 'Admin',
                        'creation': 'Creación',
                        'stats': 'Estadísticas',
                        'historique': 'Historial',
                        'impression': 'Impresión',
                        'gestion': 'Gestión',
                        'projets': 'Proyectos',
                        'reservations': 'Reservas',
                        'vuestock': 'Ver Stock'
                    };

                    permissionsHTML += `<span class="permission-tag ${key === 'config' ? 'admin' : ''}">${permissionNames[key] || key}</span>`;
                }
            });
            permissionsHTML += '</div>';
        }

        // Columna Fechas
        const createdAt = user.created_at ? new Date(user.created_at).toLocaleDateString('es-ES') : '-';
        const lastLogin = user.last_login ? new Date(user.last_login).toLocaleDateString('es-ES') : 'Nunca';

        // Columna Acciones
        let actionsHTML = '';

        if (isSuperAdminUser) {
            // SuperAdmin - solo el SuperAdmin puede modificarlo
            if (isSuperAdmin) {
                actionsHTML = `
                    <button class="btn-action edit" data-id="${user.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                `;
            } else {
                actionsHTML = '<span class="text-secondary">Acceso restringido</span>';
            }
        } else if (isCurrentUser) {
            // Usuario actual - puede modificar su contraseña
            actionsHTML = `
                <button class="btn-action edit" data-id="${user.id}">
                    <i class="fas fa-key"></i> Contraseña
                </button>
            `;
        } else {
            // Otros usuarios
            actionsHTML = `
                <button class="btn-action edit" data-id="${user.id}" title="Modificar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-action delete" data-id="${user.id}" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        }

        row.innerHTML = `
            <td>
                <strong>${usernameCell}</strong>
                ${isCurrentUser ? '<br><small><i class="fas fa-user"></i> (Tú)</small>' : ''}
            </td>
            <td class="permissions-cell">${permissionsHTML}</td>
            <td>${createdAt}</td>
            <td>${lastLogin}</td>
            <td class="actions-cell">${actionsHTML}</td>
        `;

        tbody.appendChild(row);
    });

    // Agregar eventos a los botones de acción
    setupUserActionButtons();
}

function setupUserActionButtons() {
    // Botones de edición
    document.querySelectorAll('.btn-action.edit').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.dataset.id;
            const user = allUsers.find(u => u.id === userId);
            if (user) {
                openEditModal(user);
            }
        });
    });

    // Botones de eliminación
    document.querySelectorAll('.btn-action.delete').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.dataset.id;
            const user = allUsers.find(u => u.id === userId);
            if (user) {
                confirmDeleteUser(user);
            }
        });
    });
}

// ===== MODAL DE EDICIÓN =====
function openEditModal(user) {
    const modal = document.getElementById('editUserModal');
    const form = document.getElementById('editUserForm');
    const isSuperAdminUser = user.username === SUPERADMIN_USERNAME;

    // Rellenar el formulario
    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUsername').value = user.username;

    // Gestionar la visibilidad del nombre de usuario para SuperAdmin
    if (isSuperAdminUser && !isSuperAdmin) {
        document.getElementById('editUsername').value = '**********';
        document.getElementById('editUsername').disabled = true;
    } else {
        document.getElementById('editUsername').disabled = false;
    }

    // Crear las casillas de verificación de permisos
    const permissionsList = document.getElementById('editPermissionsList');
    permissionsList.innerHTML = '';

    const allPermissions = [
        { id: 'edit_perm_config', key: 'config', label: 'Configuración', icon: 'fa-cog', desc: 'Admin - Gestionar usuarios' },
        { id: 'edit_perm_creation', key: 'creation', label: 'Creación artículo', icon: 'fa-plus-circle', desc: 'Crear nuevos artículos' },
        { id: 'edit_perm_stats', key: 'stats', label: 'Estadísticas', icon: 'fa-chart-bar', desc: 'Ver informes y estadísticas' },
        { id: 'edit_perm_historique', key: 'historique', label: 'Historial', icon: 'fa-history', desc: 'Consultar el historial' },
        { id: 'edit_perm_impression', key: 'impression', label: 'Impresión', icon: 'fa-print', desc: 'Imprimir etiquetas e informes' },
        { id: 'edit_perm_gestion', key: 'gestion', label: 'Gestión artículos', icon: 'fa-box-open', desc: 'Modificar/eliminar artículos' },
        { id: 'edit_perm_projets', key: 'projets', label: 'Gestión proyectos', icon: 'fa-project-diagram', desc: 'Crear/gestionar proyectos' },
        { id: 'edit_perm_reservations', key: 'reservations', label: 'Reservas', icon: 'fa-clipboard-list', desc: 'Gestionar reservas' },
        { id: 'edit_perm_vuestock', key: 'vuestock', label: 'Ver Stock', icon: 'fa-eye', desc: 'Visualizar el stock completo' }
    ];

    allPermissions.forEach(perm => {
        const isChecked = user.permissions?.[perm.key] || false;
        const isDisabled = isSuperAdminUser && !isSuperAdmin; // Bloqueado si no es SuperAdmin
        const isCurrentUserConfig = user.username === currentUser.username && perm.key === 'config';

        const div = document.createElement('div');
        div.className = 'permission-item';
        div.innerHTML = `
            <input type="checkbox"
                   id="${perm.id}"
                   ${isChecked ? 'checked' : ''}
                   ${isDisabled ? 'disabled' : ''}
                   ${isCurrentUserConfig ? 'disabled' : ''}
                   data-key="${perm.key}">
            <label for="${perm.id}">
                <i class="fas ${perm.icon}"></i>
                <span>${perm.label}</span>
                <small>${perm.desc}</small>
                ${isCurrentUserConfig ? '<br><small class="text-warning"><i class="fas fa-info-circle"></i> No se puede desactivar el propio permiso de admin</small>' : ''}
            </label>
        `;
        permissionsList.appendChild(div);
    });

    // Mostrar el modal
    modal.style.display = 'flex';
}

// ===== ADICIÓN DE USUARIO =====
document.getElementById('addUserForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value.trim();
    const errorDiv = document.getElementById('addUserError');
    const errorText = document.getElementById('addUserErrorText');

    // Validación
    if (!username || !password) {
        showError(errorDiv, errorText, 'Por favor, complete todos los campos');
        return;
    }

    if (username.length < 3) {
        showError(errorDiv, errorText, 'El nombre de usuario debe contener al menos 3 caracteres');
        return;
    }

    // Verificar si el usuario ya existe
    const userExists = allUsers.some(user =>
        user.username.toLowerCase() === username.toLowerCase()
    );

    if (userExists) {
        showError(errorDiv, errorText, 'Este usuario ya existe');
        return;
    }

    // Recuperar los permisos
    const permissions = {
        accueil: true // Siempre verdadero
    };

    // Lista de permisos
    const permissionKeys = ['config', 'creation', 'stats', 'historique', 'impression', 'gestion', 'projets', 'reservations', 'vuestock'];

    permissionKeys.forEach(key => {
        const checkbox = document.getElementById(`perm_${key}`);
        permissions[key] = checkbox.checked;
    });

    try {
        // Insertar el nuevo usuario
        const { data, error } = await supabase
            .from('w_users')
            .insert([
                {
                    id: generateUUID(),
                    username: username,
                    password: password, // Se asegurará más tarde con bcrypt
                    permissions: permissions
                }
            ]);

        if (error) throw error;

        // Recargar la lista de usuarios
        await loadUsers();

        // Reiniciar el formulario
        this.reset();

        // Mostrar un mensaje de éxito
        alert(`¡Usuario "${username}" creado con éxito!`);

    } catch (error) {
        console.error('Error al crear el usuario:', error);
        showError(errorDiv, errorText, 'Error al crear el usuario');
    }
});

// ===== EVENTOS =====
function setupEventListeners() {
    // Cierre de sesión
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Actualizar lista
    document.getElementById('refreshUsersBtn').addEventListener('click', loadUsers);

    // Búsqueda de usuarios
    document.getElementById('searchUsersInput').addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const filteredUsers = allUsers.filter(user =>
            user.username.toLowerCase().includes(searchTerm)
        );
        displayUsers(filteredUsers);
    });

    // Cerrar modal
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            document.getElementById('editUserModal').style.display = 'none';
        });
    });

    // Cancelar modificación SuperAdmin
    document.getElementById('cancelUpdateBtn')?.addEventListener('click', function() {
        document.getElementById('updateSuperadminForm').reset();
    });

    // Gestión del modal de edición
    const editUserForm = document.getElementById('editUserForm');
    if (editUserForm) {
        editUserForm.addEventListener('submit', handleEditUser);
        document.getElementById('deleteUserBtn').addEventListener('click', handleDeleteUser);
    }
}

async function handleEditUser(e) {
    e.preventDefault();

    const userId = document.getElementById('editUserId').value;
    const newUsername = document.getElementById('editUsername').value.trim();
    const newPassword = document.getElementById('editPassword').value.trim();
    const errorDiv = document.getElementById('editUserError');
    const errorText = document.getElementById('editUserErrorText');

    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    const isSuperAdminUser = user.username === SUPERADMIN_USERNAME;

    // Validación
    if (!isSuperAdminUser && newUsername.length < 3) {
        showError(errorDiv, errorText, 'El nombre de usuario debe contener al menos 3 caracteres');
        return;
    }

    // Verificar si el nombre de usuario ya existe (excepto para el mismo usuario)
    if (!isSuperAdminUser && newUsername !== user.username) {
        const usernameExists = allUsers.some(u =>
            u.id !== userId && u.username.toLowerCase() === newUsername.toLowerCase()
        );

        if (usernameExists) {
            showError(errorDiv, errorText, 'Este nombre de usuario ya está en uso');
            return;
        }
    }

    // Recuperar los nuevos permisos
    const newPermissions = { accueil: true };
    const checkboxes = document.querySelectorAll('#editPermissionsList input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        const key = checkbox.dataset.key;
        newPermissions[key] = checkbox.checked;
    });

    // Si el usuario modificado es el usuario actual y se quita los permisos de admin
    if (user.username === currentUser.username && !newPermissions.config && user.permissions?.config) {
        if (!confirm('⚠️ ATENCIÓN : Estás a punto de quitarte los permisos de administrador.\n\nNo podrás acceder a esta página.\n¿Continuar?')) {
            return;
        }
    }

    try {
        // Preparar los datos de actualización
        const updateData = {};

        if (!isSuperAdminUser) {
            updateData.username = newUsername;
        }

        if (newPassword) {
            updateData.password = newPassword;
        }

        updateData.permissions = newPermissions;

        // Actualizar el usuario
        const { error } = await supabase
            .from('w_users')
            .update(updateData)
            .eq('id', userId);

        if (error) throw error;

        // Recargar la lista
        await loadUsers();

        // Cerrar el modal
        document.getElementById('editUserModal').style.display = 'none';

        // Si el usuario actual se modificó a sí mismo, actualizar la sesión
        if (user.username === currentUser.username) {
            const updatedUser = { ...currentUser, ...updateData };
            sessionStorage.setItem('current_user', JSON.stringify(updatedUser));

            // Si se quitó los permisos de admin, redirigir
            if (!newPermissions.config && user.permissions?.config) {
                alert('Has perdido los permisos de administrador. Redirigiendo...');
                window.location.href = 'accueil.html';
            }
        }

    } catch (error) {
        console.error('Error al modificar el usuario:', error);
        showError(errorDiv, errorText, 'Error al modificar');
    }
}

async function handleDeleteUser() {
    const userId = document.getElementById('editUserId').value;
    const user = allUsers.find(u => u.id === userId);

    if (!user) return;

    // Impedir la eliminación del SuperAdmin
    if (user.username === SUPERADMIN_USERNAME) {
        alert('Imposible eliminar al SuperAdmin');
        return;
    }

    // Impedir que el usuario se elimine a sí mismo
    if (user.username === currentUser.username) {
        alert('No puedes eliminar tu propia cuenta');
        return;
    }

    // Pedir confirmación
    if (!confirm(`¿Estás seguro de que quieres eliminar al usuario "${user.username}"?\n\nEsta acción es irreversible.`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('w_users')
            .delete()
            .eq('id', userId);

        if (error) throw error;

        // Recargar la lista
        await loadUsers();

        // Cerrar el modal
        document.getElementById('editUserModal').style.display = 'none';

    } catch (error) {
        console.error('Error al eliminar:', error);
        alert('Error al eliminar al usuario');
    }
}

async function confirmDeleteUser(user) {
    // Impedir la eliminación del SuperAdmin
    if (user.username === SUPERADMIN_USERNAME) {
        alert('Imposible eliminar al SuperAdmin');
        return;
    }

    // Impedir que el usuario se elimine a sí mismo
    if (user.username === currentUser.username) {
        alert('No puedes eliminar tu propia cuenta');
        return;
    }

    if (!confirm(`¿Eliminar al usuario "${user.username}"?`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('w_users')
            .delete()
            .eq('id', user.id);

        if (error) throw error;

        // Recargar la lista
        await loadUsers();

    } catch (error) {
        console.error('Error al eliminar:', error);
        alert('Error al eliminar');
    }
}

// ===== UTILIDADES =====
function showError(div, textElement, message) {
    textElement.textContent = message;
    div.style.display = 'flex';

    setTimeout(() => {
        div.style.display = 'none';
    }, 5000);
}

function logout() {
    if (!confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        return;
    }

    sessionStorage.removeItem('current_user');
    sessionStorage.removeItem('supabase_token');
    window.location.href = 'connexion.html';
}

// Cerrar modal al hacer clic fuera
document.getElementById('editUserModal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        this.style.display = 'none';
    }
});
