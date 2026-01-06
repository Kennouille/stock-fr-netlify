import { supabase } from './supabaseClient.js';

// Éléments DOM et variables
let currentUser = null;
let allUsers = [];
const SUPERADMIN_USERNAME = 'Kennouille';
const SUPERADMIN_CODE = '109801';
let isSuperAdmin = false;

document.addEventListener('DOMContentLoaded', async function() {
    // Vérifier l'authentification
    await checkAuth();

    // Charger les utilisateurs
    await loadUsers();

    // Configurer les événements
    setupEventListeners();

    // Cacher le loading
    document.getElementById('loadingOverlay').style.display = 'none';
});

// ===== AUTHENTIFICATION =====
async function checkAuth() {
    try {
        // Récupérer l'utilisateur depuis sessionStorage
        const userJson = sessionStorage.getItem('current_user');

        if (!userJson) {
            window.location.href = 'connexion.html';
            return;
        }

        currentUser = JSON.parse(userJson);

        // Vérifier les permissions
        if (!currentUser.permissions?.config) {
            alert('Vous n\'avez pas la permission d\'accéder à cette page');
            window.location.href = 'accueil.html';
            return;
        }

        // Vérifier si c'est le SuperAdmin
        isSuperAdmin = currentUser.username === SUPERADMIN_USERNAME;

        // Mettre à jour l'interface
        updateUserInterface();

        // Afficher/cacher la section SuperAdmin
        toggleSuperAdminSection();

    } catch (error) {
        console.error('Erreur d\'authentification:', error);
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
    // Pour le SuperAdmin, afficher les vraies valeurs
    document.getElementById('superadminUsername').textContent = SUPERADMIN_USERNAME;
    document.getElementById('superadminCode').textContent = SUPERADMIN_CODE;

    // Pour les autres admins, afficher des étoiles
    // (déjà fait par défaut dans le HTML)
}

// Révéler les informations SuperAdmin
document.getElementById('revealSuperadminBtn')?.addEventListener('click', function() {
    const usernameSpan = document.getElementById('superadminUsername');
    const codeSpan = document.getElementById('superadminCode');

    if (this.innerHTML.includes('fa-eye')) {
        usernameSpan.textContent = SUPERADMIN_USERNAME;
        codeSpan.textContent = SUPERADMIN_CODE;
        this.innerHTML = '<i class="fas fa-eye-slash"></i> Cacher';
    } else {
        usernameSpan.textContent = '**********';
        codeSpan.textContent = '**********';
        this.innerHTML = '<i class="fas fa-eye"></i> Révéler';
    }
});

// Mettre à jour le SuperAdmin
document.getElementById('updateSuperadminForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const newUsername = document.getElementById('newSuperadminUsername').value.trim();
    const newCode = document.getElementById('newSuperadminCode').value.trim();
    const confirmCode = document.getElementById('confirmSuperadminCode').value.trim();
    const errorDiv = document.getElementById('superadminError');
    const errorText = document.getElementById('superadminErrorText');

    // Validation
    if (newUsername.length < 3) {
        showError(errorDiv, errorText, 'Le nom d\'utilisateur doit contenir au moins 3 caractères');
        return;
    }

    if (!/^\d{6}$/.test(newCode)) {
        showError(errorDiv, errorText, 'Le code doit contenir exactement 6 chiffres');
        return;
    }

    if (newCode !== confirmCode) {
        showError(errorDiv, errorText, 'Les codes ne correspondent pas');
        return;
    }

    // Demander confirmation
    if (!confirm('⚠️ ATTENTION : Vous allez modifier les informations du SuperAdmin.\n\nCette action est irréversible. Continuer ?')) {
        return;
    }

    // Pour l'instant, juste afficher un message
    // Dans la vraie version, tu mettrais à jour la base de données
    alert(`SuperAdmin mis à jour :
Nom: ${newUsername}
Code: ${newCode}

(En réalité, tu devrais mettre à jour dans ta table w_users)`);

    // Réinitialiser le formulaire
    this.reset();
});

// ===== GESTION DES UTILISATEURS =====
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
        console.error('Erreur lors du chargement des utilisateurs:', error);
        alert('Erreur lors du chargement des utilisateurs');
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    const usersCount = document.getElementById('usersCount');
    const paginationInfo = document.getElementById('paginationInfo');

    // Mettre à jour le compteur
    usersCount.textContent = `${users.length} utilisateur${users.length > 1 ? 's' : ''}`;
    paginationInfo.textContent = `Affiche 1-${users.length} sur ${users.length}`;

    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="loading-cell">
                    <i class="fas fa-user-slash"></i> Aucun utilisateur trouvé
                </td>
            </tr>
        `;
        return;
    }

    // Construire le tableau
    tbody.innerHTML = '';

    users.forEach(user => {
        const isCurrentUser = user.username === currentUser.username;
        const isSuperAdminUser = user.username === SUPERADMIN_USERNAME;

        const row = document.createElement('tr');

        // Colonne Utilisateur
        let usernameCell = user.username;
        if (isSuperAdminUser && !isSuperAdmin) {
            usernameCell = '**********';
        }

        // Colonne Permissions
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
                        'creation': 'Création',
                        'stats': 'Stats',
                        'historique': 'Historique',
                        'impression': 'Impression',
                        'gestion': 'Gestion',
                        'projets': 'Projets',
                        'reservations': 'Réservations'
                    };

                    permissionsHTML += `<span class="permission-tag ${key === 'config' ? 'admin' : ''}">${permissionNames[key] || key}</span>`;
                }
            });
            permissionsHTML += '</div>';
        }

        // Colonne Dates
        const createdAt = user.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR') : '-';
        const lastLogin = user.last_login ? new Date(user.last_login).toLocaleDateString('fr-FR') : 'Jamais';

        // Colonne Actions
        let actionsHTML = '';

        if (isSuperAdminUser) {
            // SuperAdmin - seulement le SuperAdmin peut le modifier
            if (isSuperAdmin) {
                actionsHTML = `
                    <button class="btn-action edit" data-id="${user.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                `;
            } else {
                actionsHTML = '<span class="text-secondary">Accès restreint</span>';
            }
        } else if (isCurrentUser) {
            // Utilisateur courant - peut modifier son mot de passe
            actionsHTML = `
                <button class="btn-action edit" data-id="${user.id}">
                    <i class="fas fa-key"></i> MDP
                </button>
            `;
        } else {
            // Autres utilisateurs
            actionsHTML = `
                <button class="btn-action edit" data-id="${user.id}" title="Modifier">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-action delete" data-id="${user.id}" title="Supprimer">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        }

        row.innerHTML = `
            <td>
                <strong>${usernameCell}</strong>
                ${isCurrentUser ? '<br><small><i class="fas fa-user"></i> (Vous)</small>' : ''}
            </td>
            <td class="permissions-cell">${permissionsHTML}</td>
            <td>${createdAt}</td>
            <td>${lastLogin}</td>
            <td class="actions-cell">${actionsHTML}</td>
        `;

        tbody.appendChild(row);
    });

    // Ajouter les événements aux boutons d'action
    setupUserActionButtons();
}

function setupUserActionButtons() {
    // Boutons d'édition
    document.querySelectorAll('.btn-action.edit').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.dataset.id;
            const user = allUsers.find(u => u.id === userId);
            if (user) {
                openEditModal(user);
            }
        });
    });

    // Boutons de suppression
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

// ===== MODAL D'ÉDITION =====
function openEditModal(user) {
    const modal = document.getElementById('editUserModal');
    const form = document.getElementById('editUserForm');
    const isSuperAdminUser = user.username === SUPERADMIN_USERNAME;

    // Remplir le formulaire
    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUsername').value = user.username;

    // Gérer la visibilité du nom d'utilisateur pour SuperAdmin
    if (isSuperAdminUser && !isSuperAdmin) {
        document.getElementById('editUsername').value = '**********';
        document.getElementById('editUsername').disabled = true;
    } else {
        document.getElementById('editUsername').disabled = false;
    }

    // Créer les checkboxes de permissions
    const permissionsList = document.getElementById('editPermissionsList');
    permissionsList.innerHTML = '';

    const allPermissions = [
        { id: 'edit_perm_config', key: 'config', label: 'Configuration', icon: 'fa-cog', desc: 'Admin - Gérer les utilisateurs' },
        { id: 'edit_perm_creation', key: 'creation', label: 'CrÉation article', icon: 'fa-plus-circle', desc: 'CrÉer de nouveaux articles' },
        { id: 'edit_perm_stats', key: 'stats', label: 'Statistiques', icon: 'fa-chart-bar', desc: 'Voir les rapports et stats' },
        { id: 'edit_perm_historique', key: 'historique', label: 'Historique', icon: 'fa-history', desc: 'Consulter l\'historique' },
        { id: 'edit_perm_impression', key: 'impression', label: 'Impression', icon: 'fa-print', desc: 'Imprimer Étiquettes et rapports' },
        { id: 'edit_perm_gestion', key: 'gestion', label: 'Gestion articles', icon: 'fa-box-open', desc: 'Modifier/supprimer articles' },
        { id: 'edit_perm_projets', key: 'projets', label: 'Gestion projets', icon: 'fa-project-diagram', desc: 'CrÉer/gÉrer les projets' },
        { id: 'edit_perm_reservations', key: 'reservations', label: 'RÉservations', icon: 'fa-clipboard-list', desc: 'GÉrer les rÉservations' }
    ];

    allPermissions.forEach(perm => {
        const isChecked = user.permissions?.[perm.key] || false;
        const isDisabled = isSuperAdminUser && !isSuperAdmin; // Bloqué si pas SuperAdmin
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
                ${isCurrentUserConfig ? '<br><small class="text-warning"><i class="fas fa-info-circle"></i> Ne peut pas dÉsactiver sa propre permission admin</small>' : ''}
            </label>
        `;
        permissionsList.appendChild(div);
    });

    // Afficher le modal
    modal.style.display = 'flex';
}

// ===== AJOUT D'UTILISATEUR =====
document.getElementById('addUserForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value.trim();
    const errorDiv = document.getElementById('addUserError');
    const errorText = document.getElementById('addUserErrorText');

    // Validation
    if (!username || !password) {
        showError(errorDiv, errorText, 'Veuillez remplir tous les champs');
        return;
    }

    if (username.length < 3) {
        showError(errorDiv, errorText, 'Le nom d\'utilisateur doit contenir au moins 3 caractères');
        return;
    }

    // Vérifier si l'utilisateur existe déjà
    const userExists = allUsers.some(user =>
        user.username.toLowerCase() === username.toLowerCase()
    );

    if (userExists) {
        showError(errorDiv, errorText, 'Cet utilisateur existe déjà');
        return;
    }

    // Récupérer les permissions
    const permissions = {
        accueil: true // Toujours vrai
    };

    // Liste des permissions
    const permissionKeys = ['config', 'creation', 'stats', 'historique', 'impression', 'gestion', 'projets', 'reservations'];

    permissionKeys.forEach(key => {
        const checkbox = document.getElementById(`perm_${key}`);
        permissions[key] = checkbox.checked;
    });

    try {
        // Insérer le nouvel utilisateur
        const { data, error } = await supabase
            .from('w_users')
            .insert([
                {
                    username: username,
                    password: password, // À sécuriser plus tard avec bcrypt
                    permissions: permissions
                }
            ]);

        if (error) throw error;

        // Recharger la liste des utilisateurs
        await loadUsers();

        // Réinitialiser le formulaire
        this.reset();

        // Afficher un message de succès
        alert(`Utilisateur "${username}" créé avec succès !`);

    } catch (error) {
        console.error('Erreur lors de la création de l\'utilisateur:', error);
        showError(errorDiv, errorText, 'Erreur lors de la création de l\'utilisateur');
    }
});

// ===== ÉVÉNEMENTS =====
function setupEventListeners() {
    // Déconnexion
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Actualiser la liste
    document.getElementById('refreshUsersBtn').addEventListener('click', loadUsers);

    // Recherche d'utilisateurs
    document.getElementById('searchUsersInput').addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const filteredUsers = allUsers.filter(user =>
            user.username.toLowerCase().includes(searchTerm)
        );
        displayUsers(filteredUsers);
    });

    // Fermer le modal
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            document.getElementById('editUserModal').style.display = 'none';
        });
    });

    // Annuler la modification SuperAdmin
    document.getElementById('cancelUpdateBtn')?.addEventListener('click', function() {
        document.getElementById('updateSuperadminForm').reset();
    });

    // Gestion du modal d'édition
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

    // Validation
    if (!isSuperAdminUser && newUsername.length < 3) {
        showError(errorDiv, errorText, 'Le nom d\'utilisateur doit contenir au moins 3 caractères');
        return;
    }

    // Vérifier si le nom d'utilisateur existe déjà (sauf pour le même utilisateur)
    if (!isSuperAdminUser && newUsername !== user.username) {
        const usernameExists = allUsers.some(u =>
            u.id !== userId && u.username.toLowerCase() === newUsername.toLowerCase()
        );

        if (usernameExists) {
            showError(errorDiv, errorText, 'Ce nom d\'utilisateur est déjà pris');
            return;
        }
    }

    // Récupérer les nouvelles permissions
    const newPermissions = { accueil: true };
    const checkboxes = document.querySelectorAll('#editPermissionsList input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        const key = checkbox.dataset.key;
        newPermissions[key] = checkbox.checked;
    });

    // Si l'utilisateur modifié est l'utilisateur courant et qu'il se retire admin
    if (user.username === currentUser.username && !newPermissions.config && user.permissions?.config) {
        if (!confirm('⚠️ ATTENTION : Vous êtes sur le point de vous retirer les permissions admin.\n\nVous ne pourrez plus accéder à cette page.\nContinuer ?')) {
            return;
        }
    }

    try {
        // Préparer les données de mise à jour
        const updateData = {};

        if (!isSuperAdminUser) {
            updateData.username = newUsername;
        }

        if (newPassword) {
            updateData.password = newPassword;
        }

        updateData.permissions = newPermissions;

        // Mettre à jour l'utilisateur
        const { error } = await supabase
            .from('w_users')
            .update(updateData)
            .eq('id', userId);

        if (error) throw error;

        // Recharger la liste
        await loadUsers();

        // Fermer le modal
        document.getElementById('editUserModal').style.display = 'none';

        // Si l'utilisateur courant s'est modifié, mettre à jour la session
        if (user.username === currentUser.username) {
            const updatedUser = { ...currentUser, ...updateData };
            sessionStorage.setItem('current_user', JSON.stringify(updatedUser));

            // Si il s'est retiré admin, rediriger
            if (!newPermissions.config && user.permissions?.config) {
                alert('Vous avez perdu les permissions admin. Redirection...');
                window.location.href = 'accueil.html';
            }
        }

    } catch (error) {
        console.error('Erreur lors de la modification de l\'utilisateur:', error);
        showError(errorDiv, errorText, 'Erreur lors de la modification');
    }
}

async function handleDeleteUser() {
    const userId = document.getElementById('editUserId').value;
    const user = allUsers.find(u => u.id === userId);

    if (!user) return;

    // Empêcher la suppression du SuperAdmin
    if (user.username === SUPERADMIN_USERNAME) {
        alert('Impossible de supprimer le SuperAdmin');
        return;
    }

    // Empêcher l'utilisateur de se supprimer lui-même
    if (user.username === currentUser.username) {
        alert('Vous ne pouvez pas supprimer votre propre compte');
        return;
    }

    // Demander confirmation
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${user.username}" ?\n\nCette action est irréversible.`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('w_users')
            .delete()
            .eq('id', userId);

        if (error) throw error;

        // Recharger la liste
        await loadUsers();

        // Fermer le modal
        document.getElementById('editUserModal').style.display = 'none';

    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression de l\'utilisateur');
    }
}

async function confirmDeleteUser(user) {
    // Empêcher la suppression du SuperAdmin
    if (user.username === SUPERADMIN_USERNAME) {
        alert('Impossible de supprimer le SuperAdmin');
        return;
    }

    // Empêcher l'utilisateur de se supprimer lui-même
    if (user.username === currentUser.username) {
        alert('Vous ne pouvez pas supprimer votre propre compte');
        return;
    }

    if (!confirm(`Supprimer l'utilisateur "${user.username}" ?`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('w_users')
            .delete()
            .eq('id', user.id);

        if (error) throw error;

        // Recharger la liste
        await loadUsers();

    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression');
    }
}

// ===== UTILITAIRES =====
function showError(div, textElement, message) {
    textElement.textContent = message;
    div.style.display = 'flex';

    setTimeout(() => {
        div.style.display = 'none';
    }, 5000);
}

function logout() {
    if (!confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
        return;
    }

    sessionStorage.removeItem('current_user');
    sessionStorage.removeItem('supabase_token');
    window.location.href = 'connexion.html';
}

// Fermer le modal en cliquant à l'extérieur
document.getElementById('editUserModal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        this.style.display = 'none';
    }
});