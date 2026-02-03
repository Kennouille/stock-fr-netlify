// ===== IMPORTS =====
import { supabase } from './supabaseClient.js';

// ===== ÉTATS GLOBAUX =====
let state = {
    user: null,
    projects: [],
    archivedProjects: [],
    articles: [],
    reservations: [],
    users: [],
    currentTab: 'projects',
    filters: {
        status: '',
        manager: '',
        sortBy: 'created_at'
    },
    currentProject: null,
    currentModal: null,
    charts: {}
};

// ===== ÉLÉMENTS DOM =====
const elements = {
    // Overlay de chargement
    loadingOverlay: document.getElementById('loadingOverlay'),

    // Header
    usernameDisplay: document.getElementById('usernameDisplay'),
    logoutBtn: document.getElementById('logoutBtn'),

    // Statistiques
    activeProjectsCount: document.getElementById('activeProjectsCount'),
    totalReservedItems: document.getElementById('totalReservedItems'),
    reservedValue: document.getElementById('reservedValue'),
    activeUsersCount: document.getElementById('activeUsersCount'),

    // Boutons header
    newProjectBtn: document.getElementById('newProjectBtn'),
    exportProjectsBtn: document.getElementById('exportProjectsBtn'),
    showArchivedBtn: document.getElementById('showArchivedBtn'),

    // Onglets
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    archivedTabCount: document.getElementById('archivedTabCount'),

    // Recherche
    searchProjects: document.getElementById('searchProjects'),
    searchBtn: document.getElementById('searchBtn'),

    // Filtres
    filterStatus: document.getElementById('filterStatus'),
    filterManager: document.getElementById('filterManager'),
    sortBy: document.getElementById('sortBy'),
    clearFiltersBtn: document.getElementById('clearFiltersBtn'),

    // Grid projets
    projectsGrid: document.getElementById('projectsGrid'),
    archivedProjectsGrid: document.getElementById('archivedProjectsGrid'),

    // Statistiques
    analyticsPeriod: document.getElementById('analyticsPeriod'),
    reservationsChart: document.getElementById('reservationsChart'),
    statusChart: document.getElementById('statusChart'),
    topManagersList: document.getElementById('topManagersList'),
    topArticlesList: document.getElementById('topArticlesList'),

    // Modals
    newProjectModal: document.getElementById('newProjectModal'),
    projectDetailsModal: document.getElementById('projectDetailsModal'),
    addReservationModal: document.getElementById('addReservationModal'),
    releaseStockModal: document.getElementById('releaseStockModal'),
    closeModalBtns: document.querySelectorAll('.close-modal'),

    // Modal nouveau projet
    newProjectForm: document.getElementById('newProjectForm'),
    projectName: document.getElementById('projectName'),
    projectNumber: document.getElementById('projectNumber'),
    projectDescription: document.getElementById('projectDescription'),
    projectManager: document.getElementById('projectManager'),
    projectEndDate: document.getElementById('projectEndDate'),
    projectBudget: document.getElementById('projectBudget'),
    projectError: document.getElementById('projectError'),
    projectErrorText: document.getElementById('projectErrorText'),

    // Modal détails projet
    projectDetailsName: document.getElementById('projectDetailsName'),
    projectDetailsNumber: document.getElementById('projectDetailsNumber'),
    projectDetailsStatus: document.getElementById('projectDetailsStatus'),
    projectDetailsItemsCount: document.getElementById('projectDetailsItemsCount'),
    projectDetailsTotalValue: document.getElementById('projectDetailsTotalValue'),
    projectDetailsDaysLeft: document.getElementById('projectDetailsDaysLeft'),
    projectDetailsDescription: document.getElementById('projectDetailsDescription'),
    projectDetailsCreatedAt: document.getElementById('projectDetailsCreatedAt'),
    projectDetailsEndDate: document.getElementById('projectDetailsEndDate'),
    projectDetailsUpdatedAt: document.getElementById('projectDetailsUpdatedAt'),
    projectDetailsManager: document.getElementById('projectDetailsManager'),
    projectDetailsBudget: document.getElementById('projectDetailsBudget'),

    // Tabs détails
    projectTabBtns: document.querySelectorAll('.project-tab-btn'),
    projectInfoTab: document.getElementById('projectInfoTab'),
    projectReservationsTab: document.getElementById('projectReservationsTab'),
    projectHistoryTab: document.getElementById('projectHistoryTab'),
    projectReservationsCount: document.getElementById('projectReservationsCount'),
    projectReservationsBody: document.getElementById('projectReservationsBody'),
    projectHistoryList: document.getElementById('projectHistoryList'),

    // Actions détails
    addReservationToProjectBtn: document.getElementById('addReservationToProjectBtn'),
    archiveProjectBtn: document.getElementById('archiveProjectBtn'),
    editProjectBtn: document.getElementById('editProjectBtn'),
    exportProjectBtn: document.getElementById('exportProjectBtn'),

    // Modal ajout réservation
    reservationArticle: document.getElementById('reservationArticle'),
    reservationQuantity: document.getElementById('reservationQuantity'),
    reservationQuantityMinus: document.getElementById('reservationQuantityMinus'),
    reservationQuantityPlus: document.getElementById('reservationQuantityPlus'),
    reservationAvailableStock: document.getElementById('reservationAvailableStock'),
    reservationAlreadyReserved: document.getElementById('reservationAlreadyReserved'),
    reservationComment: document.getElementById('reservationComment'),
    reservationError: document.getElementById('reservationError'),
    reservationErrorText: document.getElementById('reservationErrorText'),
    confirmAddReservationBtn: document.getElementById('confirmAddReservationBtn'),

    // Modal libération stock
    releaseItemsCount: document.getElementById('releaseItemsCount'),
    releaseReason: document.getElementById('releaseReason'),
    releaseComment: document.getElementById('releaseComment'),
    releaseError: document.getElementById('releaseError'),
    releaseErrorText: document.getElementById('releaseErrorText'),
    confirmReleaseBtn: document.getElementById('confirmReleaseBtn')
};

// ===== AUTHENTIFICATION =====
async function checkAuth() {
    try {
        const userJson = sessionStorage.getItem('current_user');

        if (!userJson) {
            window.location.href = 'connexion.html';
            return false;
        }

        state.user = JSON.parse(userJson);

        // Mettre à jour l'interface
        elements.usernameDisplay.textContent = state.user.username || state.user.email;

        // CORRECTION : Vérifier les permissions pour les projets
        // Soit l'utilisateur est admin, soit il a la permission 'projets'
        const hasProjectPermission = state.user.isAdmin || state.user.permissions?.projets || state.user.permissions?.admin;

        if (!hasProjectPermission) {
            alert('Acceso reservado a los usuarios con el permiso "Proyectos"');
            window.location.href = 'accueil.html';
            return false;
        }

        return true;

    } catch (error) {
        console.error('Erreur d\'authentification:', error);
        sessionStorage.removeItem('current_user');
        window.location.href = 'connexion.html';
        return false;
    }
}

function logout() {
    if (!confirm('¿Está seguro de que desea cerrar sesión?')) {
        return;
    }

    sessionStorage.removeItem('current_user');
    sessionStorage.removeItem('supabase_token');
    window.location.href = 'connexion.html';
}

// ===== FONCTIONS UTILITAIRES =====
function showLoading() {
    elements.loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    elements.loadingOverlay.style.display = 'none';
}

function showAlert(message, type = 'info') {
    // Créer une alerte temporaire
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert-message ${type}`;
    alertDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;

    // Ajouter au début du main-content
    const mainContent = document.querySelector('.main-content');
    mainContent.insertBefore(alertDiv, mainContent.firstChild);

    // Supprimer après 5 secondes
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 5000);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        return 'N/A';
    }
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return 'N/A';
    }
}

function formatDateTimeUTC(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);

    return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Paris'
    });
}


function calculateDaysBetween(startDate, endDate) {
    try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch (e) {
        return 0;
    }
}

function calculateDaysLeft(endDate) {
    try {
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (end < today) return 0; // Ya terminado

        const diffTime = end - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch (e) {
        return 0;
    }
}

function getProjectStatus(project) {
    if (project.archived) return 'archived';

    const daysLeft = calculateDaysLeft(project.date_fin_prevue);

    if (daysLeft <= 0) return 'overdue';
    if (daysLeft <= 7) return 'ending';
    return 'active';
}

async function useReservation(reservationId, articleId, originalQuantity, quantityToUse = null, comment = '') {
    try {
        // Si quantityToUse n'est pas fourni, utiliser toute la quantité
        if (quantityToUse === null) {
            quantityToUse = originalQuantity;
        }

        // Demander confirmation
        if (!confirm(`¿Utilizar ${quantityToUse} artículo(s) de los ${originalQuantity} reservados?`)) {
            return;
        }

        showLoading();

        // Récupérer la réservation
        const { data: reservation, error: reservationError } = await supabase
            .from('w_reservations_actives')
            .select(`
                *,
                w_articles (*),
                w_users (username)
            `)
            .eq('id', reservationId)
            .single();

        if (reservationError) throw reservationError;

        // Récupérer le stock actuel
        const { data: article, error: articleError } = await supabase
            .from('w_articles')
            .select('stock_actuel')
            .eq('id', articleId)
            .single();

        if (articleError) throw articleError;

        // Créer le mouvement de sortie avec plus d'informations
        const articleName = reservation.w_articles?.nom || 'Artículo desconocido';
        const projetNom = state.currentProject?.nom || 'Proyecto desconocido';
        const mouvementComment = comment
            ? `${comment} | Origen: Reserva #${reservationId} (${articleName})`
            : `Salida para proyecto "${projetNom}" desde reserva #${reservationId} (${articleName})`;

        const { error: movementError } = await supabase
            .from('w_mouvements')
            .insert([{
                article_id: articleId,
                type: 'sortie',
                quantite: quantityToUse,
                projet: state.currentProject.nom,
                projet_id: state.currentProject.id,
                commentaire: mouvementComment,
                utilisateur_id: state.user.id,
                utilisateur: state.user.username,
                stock_avant: article.stock_actuel,
                stock_apres: article.stock_actuel - quantityToUse,
                date_mouvement: new Date().toISOString().split('T')[0],
                heure_mouvement: new Date().toLocaleTimeString('es-ES', { hour12: false }),
                created_at: new Date().toISOString()
            }]);

        if (movementError) throw movementError;

        // Gérer la réservation selon la quantité utilisée
        if (quantityToUse === originalQuantity) {

            // 1️⃣ Supprimer le mouvement "reservation"
            const { error: deleteMovementError } = await supabase
                .from('w_mouvements')
                .delete()
                .eq('type', 'reservation')
                .eq('article_id', articleId)
                .eq('projet_id', reservation.projet_id);

            if (deleteMovementError) throw deleteMovementError;

            // 2️⃣ Supprimer la réservation active
            const { error: deleteError } = await supabase
                .from('w_reservations_actives')
                .delete()
                .eq('id', reservationId);

            if (deleteError) throw deleteError;
        }
         else {
            // Réduire la quantité de la réservation
            const { error: updateError } = await supabase
                .from('w_reservations_actives')
                .update({
                    quantite: originalQuantity - quantityToUse,
                    updated_at: new Date().toISOString()
                })
                .eq('id', reservationId);

            if (updateError) throw updateError;
        }

        // Mettre à jour le stock
        const { error: stockError } = await supabase
            .from('w_articles')
            .update({
                stock_actuel: article.stock_actuel - quantityToUse,
                updated_at: new Date().toISOString()
            })
            .eq('id', articleId);

        if (stockError) throw stockError;

        // Mettre à jour les données locales
        await Promise.all([
            fetchReservations(),
            fetchArticles(),
            fetchMovements()
        ]);

        // Recharger les détails
        if (state.currentProject) {
            await showProjectDetails(state.currentProject.id);
        }

        showAlert(`${quantityToUse} artículo(s) marcado(s) como utilizado(s)`, 'success');

    } catch (error) {
        console.error('Erreur utilisation réservation:', error);
        showAlert('Error al actualizar la reserva', 'error');
    } finally {
        hideLoading();
    }
}

// Ajoutez cette fonction après useReservation
async function showUseReservationModal(reservationId, articleId, originalQuantity) {
    // Créer la modal
    const modalHtml = `
        <div class="modal-overlay use-reservation-modal">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3><i class="fas fa-check-circle"></i> Marcar como utilizado</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label><i class="fas fa-boxes"></i> Cantidad a utilizar *</label>
                        <div class="quantity-input-group">
                            <button type="button" class="quantity-btn minus" id="useQuantityMinus">
                                <i class="fas fa-minus"></i>
                            </button>
                            <input type="number"
                                   id="useQuantity"
                                   value="${originalQuantity}"
                                   min="1"
                                   max="${originalQuantity}"
                                   class="form-input quantity">
                            <button type="button" class="quantity-btn plus" id="useQuantityPlus">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                        <div class="quantity-info">
                            <span>Cantidad reservada : <strong>${originalQuantity}</strong></span>
                        </div>
                    </div>

                    <div class="form-group">
                        <label><i class="fas fa-comment"></i> Comentario (opcional)</label>
                        <textarea id="useComment"
                                  rows="3"
                                  placeholder="Detalles del uso..."
                                  class="form-textarea"></textarea>
                    </div>

                    <div class="error-message" id="useReservationError" style="display: none;">
                        <i class="fas fa-exclamation-circle"></i>
                        <span id="useReservationErrorText"></span>
                    </div>

                    <div class="modal-actions">
                        <button id="confirmUseReservationBtn" class="btn-success">
                            <i class="fas fa-check"></i> Confirmar el uso
                        </button>
                        <button type="button" class="btn-secondary close-modal">
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Ajouter au DOM
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);

    const modal = modalContainer.querySelector('.use-reservation-modal');
    modal.style.display = 'flex';

    // Gestion des boutons de quantité
    const quantityInput = modal.querySelector('#useQuantity');
    modal.querySelector('#useQuantityMinus').addEventListener('click', () => {
        let value = parseInt(quantityInput.value) || 1;
        if (value > 1) {
            quantityInput.value = value - 1;
        }
    });

    modal.querySelector('#useQuantityPlus').addEventListener('click', () => {
        let value = parseInt(quantityInput.value) || 1;
        if (value < originalQuantity) {
            quantityInput.value = value + 1;
        }
    });

    // Gestion de la fermeture
    modal.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.remove();
        });
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Confirmation
    modal.querySelector('#confirmUseReservationBtn').addEventListener('click', async () => {
        const quantityToUse = parseInt(quantityInput.value);
        const comment = modal.querySelector('#useComment').value.trim();

        if (!quantityToUse || quantityToUse < 1 || quantityToUse > originalQuantity) {
            modal.querySelector('#useReservationErrorText').textContent = 'Cantidad no válida';
            modal.querySelector('#useReservationError').style.display = 'flex';
            return;
        }

        modal.remove();
        await useReservation(reservationId, articleId, originalQuantity, quantityToUse, comment);
    });
}

// ===== FONCTIONS SUPABASE =====
async function fetchProjects() {
    try {
        showLoading();

        const { data, error } = await supabase
            .from('w_projets')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        state.projects = data || [];
        state.archivedProjects = state.projects.filter(p => p.archived);
        state.projects = state.projects.filter(p => !p.archived);

        // NE PAS appeler updateProjectsDisplay() ici
        // Elle sera appelée après que toutes les données soient chargées

    } catch (error) {
        console.error('Erreur chargement projets:', error);
        showAlert('Error al cargar los proyectos', 'error');
    } finally {
        hideLoading();
    }
}

async function fetchArticles() {
    try {
        const { data, error } = await supabase
            .from('w_articles')
            .select('id, nom, numero, code_barre, prix_unitaire, stock_actuel, stock_reserve')
            .order('nom');

        if (error) throw error;
        state.articles = data || [];
        populateArticleSelect();

        // ← AJOUTE CETTE LIGNE
        refreshReservationModal();

    } catch (error) {
        console.error('Erreur chargement articles:', error);
    }
}

async function fetchReservations() {
    try {
        const { data, error } = await supabase
            .from('w_reservations_actives')
            .select('*');

        if (error) throw error;

        state.reservations = data || [];

    } catch (error) {
        console.error('Erreur chargement réservations:', error);
    }
}

async function fetchUsers() {
    try {
        const { data, error } = await supabase
            .from('w_users')
            .select('id, username, permissions')  // Seulement les colonnes qui existent
            .order('username');

        if (error) throw error;

        state.users = data || [];

    } catch (error) {
        console.error('Erreur chargement utilisateurs:', error);
    }
}

async function createProject(projectData) {
    try {
        const { data, error } = await supabase
            .from('w_projets')
            .insert([{
                nom: projectData.nom,
                numero: projectData.numero,
                description: projectData.description,
                responsable: projectData.responsable,
                date_fin_prevue: projectData.date_fin_prevue,
                budget: projectData.budget,
                actif: true,
                created_at: new Date().toISOString(),
                created_by: state.user.id
            }])
            .select()
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Erreur création projet:', error);
        throw error;
    }
}

async function updateProject(projectId, projectData) {
    try {
        const { data, error } = await supabase
            .from('w_projets')
            .update({
                nom: projectData.nom,
                description: projectData.description,
                responsable: projectData.responsable,
                date_fin_prevue: projectData.date_fin_prevue,
                budget: projectData.budget,
                updated_at: new Date().toISOString()
            })
            .eq('id', projectId)
            .select()
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Erreur mise à jour projet:', error);
        throw error;
    }
}

async function archiveProject(projectId) {
    try {
        showLoading();

        // 1. Récupérer toutes les réservations du projet
        const { data: reservations, error: reservationsError } = await supabase
            .from('w_reservations_actives')
            .select('id')
            .eq('projet_id', projectId);

        if (reservationsError) throw reservationsError;

        console.log('Réservations à libérer:', reservations);

        // 2. Libérer chaque réservation
        if (reservations && reservations.length > 0) {
            for (const reservation of reservations) {
                console.log('Libération réservation:', reservation.id);
                await releaseReservation(reservation.id, 'Liberación automática - Proyecto archivado');
            }
        }

        // 3. Archiver le projet
        const { data, error } = await supabase
            .from('w_projets')
            .update({
                archived: true,
                actif: false,
                archived_at: new Date().toISOString(),
                archived_by: state.user.id
            })
            .eq('id', projectId)
            .select()
            .single();

        if (error) throw error;

        // 4. Mettre à jour les données locales
        await fetchReservations();
        await fetchArticles();

        hideLoading();
        return data;
    } catch (error) {
        console.error('Erreur archivage projet:', error);
        hideLoading();
        throw error;
    }
}

async function unarchiveProject(projectId) {
    try {
        const { data, error } = await supabase
            .from('w_projets')
            .update({
                archived: false,
                actif: true,
                archived_at: null,
                archived_by: null
            })
            .eq('id', projectId)
            .select()
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Erreur désarchivage projet:', error);
        throw error;
    }
}

async function createReservation(reservationData) {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + 7);

    console.log('=== DÉBUT createReservation ===');
    console.log('Données réservation:', reservationData);

    try {
        // 1️⃣ récupérer stock_reserve actuel
        console.log('Étape 1: Lecture stock_reserve pour article:', reservationData.articleId);
        const { data: article, error: articleError } = await supabase
            .from('w_articles')
            .select('stock_reserve')
            .eq('id', reservationData.articleId)
            .single();

        if (articleError) {
            console.error('Erreur lecture stock_reserve:', articleError);
            throw articleError;
        }

        console.log('Stock_reserve actuel:', article?.stock_reserve);

        // 2️⃣ créer la réservation
        console.log('Étape 2: Création réservation');
        const { data, error } = await supabase
            .from('w_reservations_actives')
            .insert([{
                article_id: reservationData.articleId,
                projet_id: reservationData.projectId,
                quantite: reservationData.quantity,
                date_debut: now.toISOString(),
                utilisateur_id: state.user.id,
                statut: 'active',
                created_at: now.toISOString(),
                updated_at: now.toISOString(),
                date_fin: endDate.toISOString(),
                notes: reservationData.comment,
                responsable: state.user.username
            }])
            .select()
            .single();

        if (error) {
            console.error('Erreur création réservation:', error);
            throw error;
        }

        console.log('Réservation créée:', data);

        // 3️⃣ mettre à jour stock_reserve
        const newStockReserve = (article.stock_reserve || 0) + reservationData.quantity;
        console.log('Étape 3: Mise à jour stock_reserve de', article.stock_reserve, 'à', newStockReserve);

        const { error: updateStockError } = await supabase
            .from('w_articles')
            .update({
                stock_reserve: newStockReserve,
                updated_at: now.toISOString()
            })
            .eq('id', reservationData.articleId);

        if (updateStockError) {
            console.error('Erreur mise à jour stock_reserve:', updateStockError);
            throw updateStockError;
        }

        console.log('Stock_reserve mis à jour avec succès');

        // 4️⃣ ajouter le mouvement
        const { error: movementError } = await supabase
            .from('w_mouvements')
            .insert([{
                article_id: reservationData.articleId,
                type: 'reservation',
                quantite: reservationData.quantity,
                projet: state.currentProject?.nom || '',
                projet_id: reservationData.projectId,
                utilisateur_id: state.user.id,
                utilisateur: state.user.username,
                commentaire: reservationData.comment || 'Reserva',
                date_debut: now.toISOString().split('T')[0],
                date_fin: endDate.toISOString().split('T')[0],
                created_at: now.toISOString()
            }]);

        if (movementError) throw movementError;

        console.log('=== FIN createReservation - SUCCÈS ===');
        return data;

    } catch (error) {
        console.error('=== ERREUR createReservation ===', error);
        throw error;
    }
}

async function releaseReservation(reservationId, comment = '') {
    try {
        // 1️⃣ Recuperar la reserva
        const { data: reservation, error: fetchError } = await supabase
            .from('w_reservations_actives')
            .select('article_id, projet_id, quantite')
            .eq('id', reservationId)
            .single();

        if (fetchError) throw fetchError;

        // 2️⃣ Recuperar stock_reserve actual
        const { data: article, error: articleError } = await supabase
            .from('w_articles')
            .select('stock_reserve')
            .eq('id', reservation.article_id)
            .single();

        if (articleError) throw articleError;

        // 3️⃣ Actualizar stock_reserve
        const newReservedStock =
            Math.max(0, (article.stock_reserve || 0) - reservation.quantite);

        const { error: updateStockError } = await supabase
            .from('w_articles')
            .update({ stock_reserve: newReservedStock })
            .eq('id', reservation.article_id);

        if (updateStockError) throw updateStockError;

        // 4️⃣ Eliminar el movimiento "reservation"
        const { error: deleteMovementError } = await supabase
            .from('w_mouvements')
            .delete()
            .eq('type', 'reservation')
            .eq('article_id', reservation.article_id)
            .eq('projet_id', reservation.projet_id);

        if (deleteMovementError) throw deleteMovementError;

        // 5️⃣ Eliminar la reserva activa
        const { error } = await supabase
            .from('w_reservations_actives')
            .delete()
            .eq('id', reservationId);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error('Error liberación reserva:', error);
        throw error;
    }
}

// ===== FUNCIONES SUPABASE =====
async function getProjectReservations(projectId) {
    try {
        const project = state.projects.find(p => p.id === projectId) ||
                       state.archivedProjects.find(p => p.id === projectId);

        if (!project) return { sorties: [], reservations: [] };

        console.log('Buscando para proyecto:', project.nom);

        // 1. RECUPERAR LAS SALIDAS (por proyecto_id)
        const { data: sorties, error: sortiesError } = await supabase
            .from('w_mouvements')
            .select(`
                *,
                article:article_id (nom, numero, code_barre, prix_unitaire),
                utilisateur:utilisateur_id (username)
            `)
            .eq('projet_id', projectId)  // Columna projet_id
            .eq('type', 'sortie')
            .order('created_at', { ascending: false });

        if (sortiesError) {
            console.error('Error recuperación salidas por ID:', sortiesError);
            // Intentar con el nombre
            const { data: sortiesByName, error: sortiesByNameError } = await supabase
                .from('w_mouvements')
                .select(`
                    *,
                    article:article_id (nom, numero, code_barre, prix_unitaire),
                    utilisateur:utilisateur_id (username)
                `)
                .eq('projet', project.nom)
                .eq('type', 'sortie')
                .order('created_at', { ascending: false });

            if (sortiesByNameError) {
                console.error('Error recuperación salidas por nombre:', sortiesByNameError);
                throw sortiesByNameError;
            }

            return {
                sorties: sortiesByName || [],
                reservations: []
            };
        }

        // 2. RECUPERAR LAS RESERVAS (usa created_at en lugar de date_reservation)
        const { data: reservations, error: reservationsError } = await supabase
            .from('w_reservations_actives')
            .select(`
                *,
                w_articles (
                    nom,
                    numero,
                    code_barre,
                    prix_unitaire
                ),
                w_users (
                    username
                )
            `)
            .eq('projet_id', projectId)
            .order('created_at', { ascending: false });  // CAMBIADO : date_reservation → created_at

        if (reservationsError) {
            console.error('Error recuperación reservas:', reservationsError);
            throw reservationsError;
        }

        return {
            sorties: sorties || [],
            reservations: reservations || []
        };

    } catch (error) {
        console.error('Error carga datos proyecto:', error);
        return { sorties: [], reservations: [] };
    }
}

async function getProjectHistory(projectId) {
    try {
        const project = state.projects.find(p => p.id === projectId) ||
                       state.archivedProjects.find(p => p.id === projectId);

        if (!project) return [];

        // ESCAPAR el nombre del proyecto para evitar problemas
        const nomProjetEchappe = project.nom.replace(/'/g, "''");

        const { data, error } = await supabase
            .from('w_mouvements')
            .select(`
                *,
                article:article_id (nom, numero)
            `)
            .or(`projet_id.eq.${projectId},projet.eq.${nomProjetEchappe}`)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        return data || [];

    } catch (error) {
        console.error('Error carga historial proyecto:', error);
        return [];
    }
}

async function fetchMovements() {
    try {
        console.log('=== CARGA MOVIMIENTOS ===');

        const { data, error } = await supabase
            .from('w_mouvements')
            .select('*')
            .or('type.eq.sortie,type.eq.retour_projet');

        if (error) {
            console.error('Error:', error);
            throw error;
        }

        console.log('Movimientos cargados:', data);
        console.log('=== FIN CARGA ===');

        state.movements = data || [];

    } catch (error) {
        console.error('Error carga movimientos:', error);
        state.movements = [];
    }
}

// ===== ACTUALIZACIÓN DE LA PANTALLA =====
function updateStatistics() {
    // Contar proyectos activos
    elements.activeProjectsCount.textContent = state.projects.length;
    elements.archivedTabCount.textContent = state.archivedProjects.length;

    // Calcular el total de artículos reservados
    let totalItems = 0;
    let totalValue = 0;

    state.projects.forEach(project => {
        const projectReservations = state.reservations.filter(r => r.projet_id === project.id);
        totalItems += projectReservations.reduce((sum, r) => sum + r.quantite, 0);

        projectReservations.forEach(reservation => {
            const article = state.articles.find(a => a.id === reservation.id_article);
            if (article && article.prix_unitaire) {
                totalValue += article.prix_unitaire * reservation.quantite;
            }
        });
    });

    elements.totalReservedItems.textContent = totalItems;
    elements.reservedValue.textContent = `${totalValue.toFixed(2)} €`;

    // Contar usuarios únicos con reservas
    const uniqueUsers = new Set(
        state.reservations.map(r => r.id_user).filter(Boolean)
    );
    elements.activeUsersCount.textContent = uniqueUsers.size;
}

function updateProjectsDisplay() {
    // Filtrar proyectos
    let filteredProjects = [...state.projects];

    // Filtro por estado
    if (state.filters.status) {
        filteredProjects = filteredProjects.filter(project => {
            const status = getProjectStatus(project);
            return status === state.filters.status;
        });
    }

    // Filtro por responsable
    if (state.filters.manager) {
        filteredProjects = filteredProjects.filter(project =>
            project.responsable === state.filters.manager
        );
    }

    // Búsqueda de texto
    if (elements.searchProjects.value.trim()) {
        const searchTerm = elements.searchProjects.value.toLowerCase().trim();
        filteredProjects = filteredProjects.filter(project => {
            const searchableText = [
                project.nom || '',
                project.numero || '',
                project.description || '',
                project.responsable || ''
            ].join(' ').toLowerCase();

            return searchableText.includes(searchTerm);
        });
    }

    // Ordenar
    filteredProjects.sort((a, b) => {
        switch (state.filters.sortBy) {
            case 'name':
                return (a.nom || '').localeCompare(b.nom || '');
            case 'end_date':
                return new Date(a.date_fin_prevue || 0) - new Date(b.date_fin_prevue || 0);
            case 'items_count':
                const countA = state.reservations.filter(r => r.id_projet === a.id).length;
                const countB = state.reservations.filter(r => r.id_projet === b.id).length;
                return countB - countA;
            default: // created_at
                return new Date(b.created_at) - new Date(a.created_at);
        }
    });

    if (filteredProjects.length === 0) {
        elements.projectsGrid.innerHTML = `
            <div class="no-projects">
                <i class="fas fa-project-diagram"></i>
                <p>No se encontraron proyectos</p>
                <button id="createFirstProjectBtn" class="btn-primary">
                    <i class="fas fa-plus"></i> Crear un primer proyecto
                </button>
            </div>
        `;

        document.getElementById('createFirstProjectBtn')?.addEventListener('click', () => {
            showModal(elements.newProjectModal);
        });

        return;
    }

    let html = '';
    filteredProjects.forEach(project => {
        const projectReservations = state.reservations.filter(r => r.projet_id === project.id);

        // DEBUG : Ver qué hay en state.movements
        console.log('=== DEBUG PROYECTO ===');
        console.log('ID Proyecto:', project.id);
        console.log('Nombre Proyecto:', project.nom);
        console.log('Total movimientos en state:', state.movements?.length || 0);
        console.log('Movimientos para este proyecto (ID):', state.movements?.filter(m => m.projet_id === project.id));
        console.log('Movimientos para este proyecto (Nombre):', state.movements?.filter(m => m.projet === project.nom));

        // Filtrar las SALIDAS para este proyecto (por ID O por nombre)
        const projectSorties = state.movements?.filter(m =>
            m.type === 'sortie' &&
            (m.projet_id === project.id || m.projet === project.nom)
        ) || [];

        console.log('Salidas encontradas:', projectSorties);

        // Calcular el total de artículos salidos
        const itemsUsedCount = projectSorties.reduce((sum, m) => sum + (m.quantite || 0), 0);

        console.log('itemsUsedCount calculado:', itemsUsedCount);
        console.log('=== FIN DEBUG ===');
        const status = getProjectStatus(project);
        const daysLeft = calculateDaysLeft(project.date_fin_prevue);

        html += `
            <div class="project-card" data-id="${project.id}">
                <div class="project-card-header">
                    <div>
                        <div class="project-name">${project.nom}</div>
                        <div class="project-number">${project.numero || 'Sin número'}</div>
                    </div>

                </div>

                <div class="project-description">
                    ${project.description || 'Sin descripción'}
                </div>

                <div class="project-meta">
                    <div class="project-meta-item">
                        <span class="project-meta-value">${itemsUsedCount}</span>
                        <span class="project-meta-label">Artículos</span>
                    </div>
                    <div class="project-meta-item">
                        <span class="project-meta-value">${daysLeft}</span>
                        <span class="project-meta-label">Días restantes</span>
                    </div>
                    <div class="project-meta-item">
                        <span class="project-meta-value">${projectReservations.length}</span>
                        <span class="project-meta-label">Reservas</span>
                    </div>
                </div>

                <div class="project-info">
                    <div class="project-info-item">
                        <i class="fas fa-user-tie"></i>
                        <span>Responsable : ${project.responsable || 'No definido'}</span>
                    </div>
                    <div class="project-info-item">
                        <i class="fas fa-calendar"></i>
                        <span>Creado el : ${formatDate(project.created_at)}</span>
                    </div>
                    ${project.date_fin_prevue ? `
                    <div class="project-info-item">
                        <i class="fas fa-calendar-check"></i>
                        <span>Fin prevista : ${formatDate(project.date_fin_prevue)}</span>
                    </div>
                    ` : ''}
                </div>

                <div class="project-actions">
                    <button class="btn-primary btn-small view-project-details" data-id="${project.id}">
                        <i class="fas fa-eye"></i> Detalles
                    </button>
                    ${status === 'archived' ? `
                    <button class="btn-secondary btn-small unarchive-project" data-id="${project.id}">
                        <i class="fas fa-box-open"></i> Desarchivar
                    </button>
                    ` : `
                    <button class="btn-secondary btn-small archive-project" data-id="${project.id}">
                        <i class="fas fa-archive"></i> Archivar
                    </button>
                    `}
                </div>
            </div>
        `;
    });

    elements.projectsGrid.innerHTML = html;

    // Añadir eventos
    document.querySelectorAll('.view-project-details').forEach(btn => {
        btn.addEventListener('click', function() {
            const projectId = this.dataset.id;
            showProjectDetails(projectId);
        });
    });

    document.querySelectorAll('.archive-project').forEach(btn => {
        btn.addEventListener('click', function() {
            const projectId = this.dataset.id;
            archiveProjectAction(projectId);
        });
    });

    document.querySelectorAll('.unarchive-project').forEach(btn => {
        btn.addEventListener('click', function() {
            const projectId = this.dataset.id;
            unarchiveProjectAction(projectId);
        });
    });
}

function updateArchivedProjectsDisplay() {
    if (state.archivedProjects.length === 0) {
        elements.archivedProjectsGrid.innerHTML = `
            <div class="no-projects">
                <i class="fas fa-archive"></i>
                <p>Ningún proyecto archivado</p>
            </div>
        `;
        return;
    }

    let html = '';
    state.archivedProjects.forEach(project => {
        const projectReservations = state.reservations.filter(r => r.id_projet === project.id);
        const itemsCount = projectReservations.reduce((sum, r) => sum + r.quantite, 0);

        html += `
            <div class="project-card archived" data-id="${project.id}">
                <div class="project-card-header">
                    <div>
                        <div class="project-name">${project.nom}</div>
                        <div class="project-number">${project.numero || 'Sin número'}</div>
                    </div>
                    <span class="project-status archived">
                        Archivado
                    </span>
                </div>

                <div class="project-description">
                    ${project.description || 'Sin descripción'}
                </div>

                <div class="project-meta">
                    <div class="project-meta-item">
                        <span class="project-meta-value">${itemsCount}</span>
                        <span class="project-meta-label">Artículos</span>
                    </div>
                    <div class="project-meta-item">
                        <span class="project-meta-value">${formatDate(project.archived_at)}</span>
                        <span class="project-meta-label">Archivado el</span>
                    </div>
                </div>

                <div class="project-info">
                    <div class="project-info-item">
                        <i class="fas fa-user-tie"></i>
                        <span>Responsable : ${project.responsable || 'No definido'}</span>
                    </div>
                    <div class="project-info-item">
                        <i class="fas fa-calendar"></i>
                        <span>Creado el : ${formatDate(project.created_at)}</span>
                    </div>
                </div>

                <div class="project-actions">
                    <button class="btn-primary btn-small view-project-details" data-id="${project.id}">
                        <i class="fas fa-eye"></i> Detalles
                    </button>
                    <button class="btn-secondary btn-small unarchive-project" data-id="${project.id}">
                        <i class="fas fa-box-open"></i> Desarchivar
                    </button>
                </div>
            </div>
        `;
    });

    elements.archivedProjectsGrid.innerHTML = html;

    // ← AÑADIR ESTA SECCIÓN PARA LOS EVENTOS
    document.querySelectorAll('.view-project-details').forEach(btn => {
        btn.addEventListener('click', function() {
            const projectId = this.dataset.id;
            showProjectDetails(projectId);
        });
    });

    document.querySelectorAll('.unarchive-project').forEach(btn => {
        btn.addEventListener('click', function() {
            const projectId = this.dataset.id;
            unarchiveProjectAction(projectId);
        });
    });
}

function populateManagerFilter() {
    const managers = [...new Set(state.projects.map(p => p.responsable).filter(Boolean))];

    let html = '<option value="">Todos los responsables</option>';
    managers.forEach(manager => {
        html += `<option value="${manager}">${manager}</option>`;
    });

    elements.filterManager.innerHTML = html;
    elements.filterManager.value = state.filters.manager;
}

function populateArticleSelect() {
    let html = '<option value="">Seleccionar un artículo</option>';
    state.articles.forEach(article => {
        // Calcular el stock disponible real
        const stockReserve = article.stock_reserve || 0;
        const stockActuel = article.stock_actuel || 0;
        const stockDisponible = Math.max(0, stockActuel - stockReserve);

        // Mostrar solo artículos con stock disponible > 0
        if (stockDisponible > 0) {
            html += `<option value="${article.id}">${article.nom} (${article.code || article.numero}) - Stock disponible: ${stockDisponible}</option>`;
        }
    });
    elements.reservationArticle.innerHTML = html;
}

// ===== GESTIÓN DE LOS MODALES =====
function showModal(modalElement) {
    if (state.currentModal && state.currentModal !== modalElement) {
        state.previousModal = state.currentModal;
        state.currentModal.style.display = 'none';
    }

    modalElement.style.display = 'flex';
    state.currentModal = modalElement;
}

function hideModal() {
    if (!state.currentModal) return;

    state.currentModal.style.display = 'none';
    state.currentModal = null;
}


// ===== DETALLES DEL PROYECTO =====
async function showProjectDetails(projectId) {
    try {
        showLoading();

        const project = [...state.projects, ...state.archivedProjects].find(p => p.id === projectId);
        if (!project) {
            showAlert('Proyecto no encontrado', 'error');
            return;
        }

        state.currentProject = project;

        // Recuperar los datos del proyecto
        const projectData = await getProjectReservations(projectId);
        const projectHistory = await getProjectHistory(projectId);

        const sorties = projectData.sorties || []; // ← AGREGADO de "|| []"
        const reservations = projectData.reservations || []; // ← AGREGADO de "|| []"

        // Calcular las estadísticas SEPARADAS
        // 1. Artículos SALIDOS (ya utilizados)
        const itemsSortis = sorties.reduce((sum, s) => sum + s.quantite, 0);
        const valeurSortis = sorties.reduce((sum, s) => {
            const article = s.article;
            if (article?.prix_unitaire) {
                return sum + (article.prix_unitaire * s.quantite);
            }
            return sum;
        }, 0);

        // 2. Artículos RESERVADOS (aún no utilizados)
        const itemsReserves = reservations.reduce((sum, r) => sum + r.quantite, 0);
        const valeurReserves = reservations.reduce((sum, r) => {
            const article = r.w_articles;
            if (article?.prix_unitaire) {
                return sum + (article.prix_unitaire * r.quantite);
            }
            return sum;
        }, 0);

        // 3. Totales generales
        const itemsTotaux = itemsSortis + itemsReserves;
        const valeurTotale = valeurSortis + valeurReserves;

        const daysLeft = calculateDaysLeft(project.date_fin_prevue);
        const status = getProjectStatus(project);

        // Actualizar la cabecera con las estadísticas correctas
        elements.projectDetailsName.textContent = project.nom;
        elements.projectDetailsNumber.textContent = project.numero || 'Sin número';
        elements.projectDetailsStatus.textContent = status === 'active' ? 'Activo' :
                                                  status === 'ending' ? 'Próximo a terminar' :
                                                  status === 'overdue' ? 'Atrasado' : 'Archivado';
        elements.projectDetailsStatus.className = `project-status ${status}`;

        // Mostrar solo las SALIDAS en el contador principal (lo que se factura)
        document.getElementById('projectDetailsItemsUsed').textContent = itemsSortis;
        document.getElementById('projectDetailsValueUsed').textContent = `${valeurSortis.toFixed(2)} €`;
        document.getElementById('projectDetailsItemsReserved').textContent = itemsReserves;
        document.getElementById('projectDetailsValueReserved').textContent = `${valeurReserves.toFixed(2)} €`;
        elements.projectDetailsDaysLeft.textContent = daysLeft;

        // Actualizar la información
        elements.projectDetailsDescription.textContent = project.description || 'Sin descripción';
        elements.projectDetailsCreatedAt.textContent = formatDateTime(project.created_at);
        elements.projectDetailsEndDate.textContent = project.date_fin_prevue ? formatDate(project.date_fin_prevue) : 'No definida';
        elements.projectDetailsUpdatedAt.textContent = project.updated_at ? formatDateTime(project.updated_at) : 'Nunca';
        elements.projectDetailsManager.textContent = project.responsable || 'No definido';
        elements.projectDetailsBudget.textContent = project.budget ? `${project.budget} €` : 'No definido';

        // Actualizar la visualización de los artículos
        // Recuperar también las devoluciones (movimientos de tipo 'retour_projet')
        const retours = state.movements?.filter(m =>
            m.type === 'retour_projet' &&
            m.projet_id === projectId
        ) || [];

        // Actualizar la visualización de los artículos
        updateProjectReservations(sorties, retours, reservations);
        elements.projectReservationsCount.textContent = sorties.length + reservations.length;

        // Actualizar el historial
        updateProjectHistory(projectHistory);

        // Actualizar la información adicional (a agregar en tu HTML)
        updateReservationStats(itemsReserves, valeurReserves, itemsSortis, valeurSortis);

        // Configurar los botones
        elements.archiveProjectBtn.style.display = project.archived ? 'none' : 'block';
        elements.archiveProjectBtn.textContent = project.archived ? 'Desarchivar' : 'Archivar';

        showModal(elements.projectDetailsModal);
        switchProjectTab('reservations');

    } catch (error) {
        console.error('Error al mostrar detalles del proyecto:', error);
        showAlert('Error al cargar los detalles', 'error');
    } finally {
        hideLoading();
    }
}

// Función para actualizar las estadísticas adicionales
function updateReservationStats(itemsReserves, valeurReserves, itemsSortis, valeurSortis) {
    // Crear o actualizar un elemento HTML para mostrar las estadísticas detalladas
    const statsContainer = document.getElementById('projectDetailsStats') ||
                          document.querySelector('.project-stats-container');

    if (!statsContainer) {
        // Si el elemento no existe, crearlo
        const detailsContent = document.querySelector('.project-details-content');
        if (detailsContent) {
            const statsHtml = `
                <div class="project-stats-container">
                    <div class="project-stats-grid">
                        <div class="stat-card sortie">
                            <div class="stat-icon">
                                <i class="fas fa-check-circle"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value">${itemsSortis}</div>
                                <div class="stat-label">Artículos utilizados</div>
                                <div class="stat-amount">${valeurSortis.toFixed(2)} €</div>
                            </div>
                        </div>
                        <div class="stat-card reservation">
                            <div class="stat-icon">
                                <i class="fas fa-clock"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value">${itemsReserves}</div>
                                <div class="stat-label">Artículos reservados</div>
                                <div class="stat-amount">${valeurReserves.toFixed(2)} €</div>
                            </div>
                        </div>
                        <div class="stat-card total">
                            <div class="stat-icon">
                                <i class="fas fa-calculator"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value">${itemsSortis + itemsReserves}</div>
                                <div class="stat-label">Total de artículos</div>
                                <div class="stat-amount">${(valeurSortis + valeurReserves).toFixed(2)} €</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            detailsContent.insertAdjacentHTML('afterbegin', statsHtml);
        }
    } else {
        // Actualizar los valores
        const sortieValue = statsContainer.querySelector('.stat-card.sortie .stat-value');
        const sortieAmount = statsContainer.querySelector('.stat-card.sortie .stat-amount');
        const reserveValue = statsContainer.querySelector('.stat-card.reservation .stat-value');
        const reserveAmount = statsContainer.querySelector('.stat-card.reservation .stat-amount');
        const totalValue = statsContainer.querySelector('.stat-card.total .stat-value');
        const totalAmount = statsContainer.querySelector('.stat-card.total .stat-amount');

        if (sortieValue) sortieValue.textContent = itemsSortis;
        if (sortieAmount) sortieAmount.textContent = `${valeurSortis.toFixed(2)} €`;
        if (reserveValue) reserveValue.textContent = itemsReserves;
        if (reserveAmount) reserveAmount.textContent = `${valeurReserves.toFixed(2)} €`;
        if (totalValue) totalValue.textContent = itemsSortis + itemsReserves;
        if (totalAmount) totalAmount.textContent = `${(valeurSortis + valeurReserves).toFixed(2)} €`;
    }
}

function updateProjectReservations(sorties, retours, reservations) { // ← CAMBIADO: agregado el parámetro retours
    const allItems = [...sorties, ...reservations];

    if (allItems.length === 0) {
        elements.projectReservationsBody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-row">
                    <i class="fas fa-info-circle"></i> Ningún artículo para este proyecto
                </td>
            </tr>
        `;
        return;
    }

    let html = '';

    // 1. MOSTRAR LAS SALIDAS (ya utilizadas)
    if (sorties.length > 0) {
        html += `
            <tr>
                <td colspan="7" class="section-header">
                    <i class="fas fa-check-circle text-success"></i> Artículos utilizados (salidas)
                </td>
            </tr>
        `;

        sorties.forEach(sortie => {
            const valeurTotale = sortie.article?.prix_unitaire ?
                (sortie.article.prix_unitaire * sortie.quantite).toFixed(2) : '0.00';

            // Verificar si esta salida ya tiene un retorno
            const hasReturn = retours?.some(retour =>
                retour.mouvement_parent_id === sortie.id // ← USAR el parámetro retours
            );

            html += `
                <tr data-id="${sortie.id}" class="sortie-row ${hasReturn ? 'already-returned' : ''}">
                    <td>
                        <div class="article-info">
                            <strong>${sortie.article?.nom || 'Artículo desconocido'}</strong>
                            ${hasReturn ? '<span class="badge badge-returned">Ya devuelto</span>' : ''}
                            <small>${sortie.article?.numero || ''}</small>
                        </div>
                    </td>
                    <td>${sortie.article?.numero || 'N/A'}</td>
                    <td>
                        <span class="quantity-badge sortie ${hasReturn ? 'returned' : ''}">
                            -${sortie.quantite}
                        </span>
                    </td>
                    <td>
                        <div class="date-info">
                            ${formatDate(sortie.created_at)}
                            <small>${formatDateTime(sortie.created_at).split(' ')[1] || ''}</small>
                        </div>
                    </td>
                    <td>
                        <div class="price-info">
                            ${sortie.article?.prix_unitaire ?
                                `${sortie.article.prix_unitaire.toFixed(2)} €` :
                                'Precio N/A'}
                            <small>Total: ${valeurTotale} €</small>
                        </div>
                    </td>
                    <td>
                        <div class="user-info">
                            ${sortie.utilisateur?.username || 'Usuario desconocido'}
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            ${hasReturn ? '' : `
                            <button class="btn-action btn-small return-to-stock"
                                    data-id="${sortie.id}"
                                    data-article-id="${sortie.article_id}"
                                    data-quantity="${sortie.quantite}"
                                    title="Devolver al stock">
                                <i class="fas fa-arrow-left"></i>
                            </button>
                            `}
                            <button class="btn-action btn-small view-details"
                                    data-id="${sortie.id}"
                                    data-type="sortie"
                                    title="Ver detalles">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    // 2. MOSTRAR LAS DEVOLUCIONES (usar el parámetro retours)
    if (retours && retours.length > 0) {
        html += `
            <tr>
                <td colspan="7" class="section-header retour-header">
                    <i class="fas fa-check-circle text-success"></i> Artículos devueltos al stock
                </td>
            </tr>
        `;

        retours.forEach(retourItem => {
            // Encontrar el artículo correspondiente
            let article = null;

            // Buscar primero en las salidas
            const relatedSortie = sorties.find(s => s.id === retourItem.mouvement_parent_id);
            if (relatedSortie?.article) {
                article = relatedSortie.article;
            } else {
                // Si no, buscar en los artículos del state
                article = state.articles.find(a => a.id === retourItem.article_id) || {};
            }

            const valeurTotale = article?.prix_unitaire ?
                (article.prix_unitaire * retourItem.quantite).toFixed(2) : '0.00';

            html += `
                <tr data-id="${retourItem.id}" class="returned-row">
                    <td>
                        <div class="article-info">
                            <strong>${article?.nom || 'Artículo desconocido'}</strong>
                            <small>${article?.numero || ''}</small>
                        </div>
                    </td>
                    <td>${article?.numero || 'N/A'}</td>
                    <td>
                        <span class="quantity-badge retour">
                            +${retourItem.quantite}
                        </span>
                        ${retourItem.raison ? `
                        <br>
                        <small style="color: #dc3545; font-size: 0.85em;">
                            <i class="fas fa-exclamation-triangle"></i>
                            ${retourItem.raison}
                        </small>
                        ` : ''}
                    </td>
                    <td>
                        <div class="date-info">
                            ${formatDate(retourItem.created_at)}
                            <small>${formatDateTime(retourItem.created_at).split(' ')[1] || ''}</small>
                        </div>
                    </td>
                    <td>
                        <div class="price-info">
                            ${article?.prix_unitaire ?
                                `${article.prix_unitaire.toFixed(2)} €` :
                                'Precio N/A'}
                            <small>Total: ${valeurTotale} €</small>
                            ${retourItem.raison ? `
                            <div class="missing-info" style="color: #dc3545; margin-top: 5px;">
                                <i class="fas fa-exclamation-circle"></i>
                                ${retourItem.raison}
                            </div>
                            ` : ''}
                        </div>
                    </td>
                    <td>
                        <div class="user-info">
                            ${retourItem.utilisateur || 'Usuario desconocido'}
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-action btn-small view-details"
                                    data-id="${retourItem.id}"
                                    data-type="retour"
                                    title="Ver detalles">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    // 3. MOSTRAR LAS RESERVAS (aún no utilizadas)
    if (reservations.length > 0) {
        html += `
            <tr>
                <td colspan="7" class="section-header reservation-header">
                    <i class="fas fa-clock text-warning"></i> Artículos reservados (no utilizados)
                </td>
            </tr>
        `;

        reservations.forEach(reservation => {
            const article = reservation.w_articles;
            const valeurTotale = article?.prix_unitaire ?
                (article.prix_unitaire * reservation.quantite).toFixed(2) : '0.00';
            const daysLeft = calculateDaysLeft(reservation.date_fin);

            html += `
                <tr data-id="${reservation.id}" class="reservation-row">
                    <td>
                        <div class="article-info">
                            <strong>${article?.nom || 'Artículo desconocido'}</strong>
                            <small>${article?.numero || ''}</small>
                        </div>
                    </td>
                    <td>${article?.numero || 'N/A'}</td>
                    <td>
                        <span class="quantity-badge reservation">
                            ${reservation.quantite}
                        </span>
                    </td>
                    <td>
                        <div class="date-info">
                            ${formatDate(reservation.created_at)}
                            <small>${formatDateTime(reservation.created_at).split(' ')[1]}</small>
                        </div>
                    </td>
                    <td>
                        <div class="price-info">
                            ${article?.prix_unitaire ?
                                `${article.prix_unitaire.toFixed(2)} €` :
                                'Precio N/A'}
                            <small>Total: ${valeurTotale} €</small>
                            <br>
                            <span class="badge ${daysLeft <= 0 ? 'danger' : daysLeft <= 7 ? 'warning' : 'info'}">
                                ${formatDate(reservation.date_fin)}
                                ${daysLeft <= 0 ? ' (Expirado)' : daysLeft <= 7 ? ` (${daysLeft}d)` : ''}
                            </span>
                        </div>
                    </td>
                    <td>
                        <div class="user-info">
                            ${reservation.w_users?.username || 'Usuario desconocido'}
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-action btn-small use-reservation"
                                    data-id="${reservation.id}"
                                    data-article-id="${reservation.article_id || ''}"
                                    data-quantity="${reservation.quantite}"
                                    title="Marcar como utilizado">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="btn-action btn-small view-details"
                                    data-id="${reservation.id}"
                                    data-type="reservation"
                                    title="Ver detalles">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-action btn-small release-reservation"
                                    data-id="${reservation.id}"
                                    title="Liberar reserva">
                                <i class="fas fa-unlock"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    elements.projectReservationsBody.innerHTML = html;

    // Evento para el botón "Devolver al stock"
    document.querySelectorAll('.return-to-stock').forEach(btn => {
        btn.addEventListener('click', function() {
            console.log('=== CLICK DEVOLVER STOCK ===');
            console.log('Botón clickeado:', this);
            console.log('Dataset:', this.dataset);

            const mouvementId = this.dataset.id;
            const articleId = this.dataset.articleId;
            const quantity = parseInt(this.dataset.quantity);

            console.log('mouvementId:', mouvementId);
            console.log('articleId:', articleId);
            console.log('quantity:', quantity);

            openReturnToStockModal(mouvementId, articleId, quantity);
        });
    });

    // Agregar los eventos para los botones
    document.querySelectorAll('.view-details').forEach(btn => {
        btn.addEventListener('click', function() {
            const itemId = this.dataset.id;
            const itemType = this.dataset.type;
            showItemDetails(itemId, itemType, sorties, retours, reservations); // ← CAMBIADO: agregado retours
        });
    });

    document.querySelectorAll('.release-reservation').forEach(btn => {
        btn.addEventListener('click', async function() {
            const reservationId = this.dataset.id;
            const reservation = reservations.find(r => r.id === reservationId);

            if (reservation) {
                const article = reservation.w_articles;
                const articleName = article?.nom || 'Artículo desconocido';

                if (confirm(`¿Liberar la reserva de ${reservation.quantite} ${articleName} ?`)) {
                    try {
                        showLoading();

                        await releaseReservation(reservationId);

                        showAlert('Reserva liberada con éxito', 'success');

                        // Recargar los detalles del proyecto
                        await showProjectDetails(state.currentProject.id);

                    } catch (error) {
                        console.error('Error liberación reserva:', error);
                        showAlert('Error al liberar la reserva', 'error');
                    } finally {
                        hideLoading();
                    }
                }
            }
        });
    });

    // Evento para el botón "Usar"
    document.querySelectorAll('.use-reservation').forEach(btn => {
        btn.addEventListener('click', function() {
            const reservationId = this.dataset.id;
            const articleId = this.dataset.articleId;
            const quantity = parseInt(this.dataset.quantity);
            showUseReservationModal(reservationId, articleId, quantity);
        });
    });
}

// Función para mostrar los detalles de un item
function showItemDetails(itemId, itemType, sorties, reservations) {
    let item;

    if (itemType === 'sortie') {
        item = sorties.find(s => s.id === itemId);
    } else {
        item = reservations.find(r => r.id === itemId);
    }

    if (!item) return;

    const isSortie = itemType === 'sortie';
    const article = isSortie ? item.article : item.w_articles;
    const user = isSortie ? item.utilisateur : item.w_users;

    const modalHtml = `
        <div class="modal-overlay" style="display: flex;">
            <div class="modal" style="max-width: 600px;">
                <div class="modal-header">
                    <h3><i class="fas fa-info-circle"></i> Detalles</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="detail-section">
                        <h4><i class="fas fa-box"></i> Artículo</h4>
                        <div class="detail-item">
                            <span class="detail-label">Nombre :</span>
                            <span class="detail-value">${article?.nom || 'No especificado'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Número :</span>
                            <span class="detail-value">${article?.numero || 'No especificado'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Código de barras :</span>
                            <span class="detail-value">${article?.code_barre || 'No especificado'}</span>
                        </div>
                    </div>

                    <div class="detail-section">
                        <h4><i class="fas ${isSortie ? 'fa-check-circle' : 'fa-clock'}"></i> ${isSortie ? 'Salida' : 'Reserva'}</h4>
                        <div class="detail-item">
                            <span class="detail-label">Tipo :</span>
                            <span class="detail-value badge ${isSortie ? 'sortie' : 'reservation'}">
                                ${isSortie ? 'Salida efectuada' : 'Reserva activa'}
                            </span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Cantidad :</span>
                            <span class="detail-value">${isSortie ? '-' : ''}${item.quantite}</span>
                        </div>
                        ${article?.prix_unitaire ? `
                        <div class="detail-item">
                            <span class="detail-label">Precio unitario :</span>
                            <span class="detail-value">${article.prix_unitaire.toFixed(2)} €</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Valor total :</span>
                            <span class="detail-value" style="font-weight: bold;">
                                ${(article.prix_unitaire * item.quantite).toFixed(2)} €
                            </span>
                        </div>
                        ` : ''}
                        <div class="detail-item">
                            <span class="detail-label">Fecha :</span>
                            <span class="detail-value">${formatDateTime(item.created_at)}</span>
                        </div>
                        ${!isSortie ? `
                        <div class="detail-item">
                            <span class="detail-label">Fecha de fin :</span>
                            <span class="detail-value">${formatDate(item.date_fin)}</span>
                        </div>
                        ` : ''}
                    </div>

                    <div class="detail-section">
                        <h4><i class="fas fa-user"></i> Responsable</h4>
                        <div class="detail-item">
                            <span class="detail-label">Usuario :</span>
                            <span class="detail-value">${user?.username || 'No especificado'}</span>
                        </div>
                        ${user?.email ? `
                        <div class="detail-item">
                            <span class="detail-label">Email :</span>
                            <span class="detail-value">${user.email}</span>
                        </div>
                        ` : ''}
                    </div>

                    ${item.commentaire ? `
                    <div class="detail-section">
                        <h4><i class="fas fa-comment"></i> Comentario</h4>
                        <div class="detail-comment">
                            ${item.commentaire}
                        </div>
                    </div>
                    ` : ''}

                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary close-details-modal">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);

    const modal = modalContainer.querySelector('.modal-overlay');

    // Manejar el cierre
    modal.querySelector('.close-modal').addEventListener('click', () => {
        modal.remove();
    });

    modal.querySelector('.close-details-modal').addEventListener('click', () => {
        modal.remove();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

async function openReturnToStockModal(mouvementId, articleId, originalQuantity) {
    console.log('=== ABRIR MODAL DEVOLUCIÓN ===');
    console.log('mouvementId:', mouvementId);
    console.log('articleId:', articleId);
    console.log('originalQuantity:', originalQuantity);

    try {
        console.log('=== INICIO TRY ABRIR MODAL DEVOLUCIÓN ===');
        console.log('Usuario actual:', state.user);
        console.log('=== CONSULTA ARTÍCULO ===');
        console.log('articleId:', articleId);

        const { data: article, error: articleError } = await supabase
            .from('w_articles')
            .select(`
                nom,
                numero,
                photo_url,
                rack_id,
                level_id,
                slot_id,
                rack:w_vuestock_racks(rack_code, display_name),
                level:w_vuestock_levels(level_code),
                slot:w_vuestock_slots(slot_code)
            `)
            .eq('id', articleId)
            .single();

        console.log('Resultado consulta:', { article, articleError });

        if (articleError) {
            console.error('Error consulta artículo:', articleError);
            throw articleError;
        }

        console.log('Artículo encontrado:', article);
        console.log('=== FIN CONSULTA ===');

        // Crear el modal
        const modalHTML = `
            <div class="modal-overlay return-stock-modal">
                <div class="modal" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-arrow-left"></i> Devolver al stock</h3>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="article-summary">
                            <div class="article-header">
                                ${article.photo_url ? `
                                    <div class="article-photo" style="text-align: center; margin: 15px 0; position: relative;" id="photoContainer">
                                        <img src="${article.photo_url}" alt="${article.nom}"
                                             style="max-width: 200px; max-height: 200px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); cursor: pointer; transition: all 0.3s ease;"
                                             onclick="const img = this;
                                                      if(img.style.position === 'fixed') {
                                                          // Volver a la posición original
                                                          img.style.position = '';
                                                          img.style.width = '';
                                                          img.style.height = '';
                                                          img.style.top = '';
                                                          img.style.left = '';
                                                          img.style.transform = '';
                                                          img.style.zIndex = '';
                                                          img.style.maxWidth = '200px';
                                                          img.style.maxHeight = '200px';
                                                          img.style.objectFit = '';
                                                          img.style.backgroundColor = '';
                                                          img.style.padding = '';
                                                          img.style.borderRadius = '8px';
                                                      } else {
                                                          // Guardar la posición original
                                                          const rect = img.getBoundingClientRect();
                                                          img.dataset.originalTop = rect.top + 'px';
                                                          img.dataset.originalLeft = rect.left + 'px';

                                                          // Ampliar a pantalla completa
                                                          img.style.position = 'fixed';
                                                          img.style.width = '90vw';
                                                          img.style.height = '90vh';
                                                          img.style.top = '50%';
                                                          img.style.left = '50%';
                                                          img.style.transform = 'translate(-50%, -50%)';
                                                          img.style.zIndex = '9999';
                                                          img.style.maxWidth = 'none';
                                                          img.style.maxHeight = 'none';
                                                          img.style.objectFit = 'contain';
                                                          img.style.backgroundColor = 'rgba(0,0,0,0.9)';
                                                          img.style.padding = '20px';
                                                          img.style.borderRadius = '10px';
                                                      }">
                                    </div>
                                    ` : ''}
                                <div class="article-info">
                                    <h4>${article.nom} (${article.numero})</h4>
                                    <p>Salido: ${originalQuantity} unidad(es)</p>
                                </div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label><i class="fas fa-boxes"></i> Cantidad devuelta *</label>
                            <input type="number"
                                   id="returnQuantity"
                                   value="${originalQuantity}"
                                   min="0"
                                   max="${originalQuantity}"
                                   class="form-input">
                        </div>

                        <div id="missingQuantitySection" style="display: none;">
                            <div class="form-group">
                                <label><i class="fas fa-exclamation-triangle"></i> Razón de la diferencia</label>
                                <select id="missingReason" class="form-select" required>
                                    <option value="">Seleccionar una razón...</option>
                                    <option value="perdu">Perdido(s)</option>
                                    <option value="cassé">Roto(s)</option>
                                    <option value="vole">Robado(s)</option>
                                    <option value="fin_vie">Fin de vida útil</option>
                                </select>
                                <div class="form-error" id="missingReasonError" style="color: #dc3545; font-size: 0.85em; display: none;">
                                    <i class="fas fa-exclamation-circle"></i> Este campo es obligatorio
                                </div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label><i class="fas fa-map-marker-alt"></i> Ubicación de almacenamiento</label>
                            <div class="location-display" style="background: #f8f9fa; padding: 10px; border-radius: 4px; border-left: 3px solid #28a745;">
                                <div><strong>Estante:</strong> ${article.rack?.display_name || article.rack?.rack_code || 'No especificado'}</div>
                                <div><strong>Nivel:</strong> ${article.level?.level_code || 'No especificado'}</div>
                                <div><strong>Posición:</strong> ${article.slot?.slot_code || 'No especificado'}</div>
                            </div>
                            <small><i class="fas fa-info-circle"></i> Almacene el artículo en esta ubicación</small>
                        </div>

                        <div class="form-group">
                            <label><i class="fas fa-clipboard-check"></i> Estado de los artículos</label>
                            <select id="itemCondition" class="form-select">
                                <option value="parfait">Condición 1 Estado perfecto</option>
                                <option value="raye">Condición 2 Desgastado / Reparado</option>
                                <option value="reparation">Condición 3 A reparar</option>
                                <option value="casse">Condición 4 A reemplazar</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label><i class="fas fa-comment"></i> Comentario</label>
                            <textarea id="returnComment"
                                      rows="3"
                                      placeholder="Detalles de la devolución..."
                                      class="form-textarea"></textarea>
                        </div>

                        <div class="error-message" id="returnError" style="display: none;">
                            <i class="fas fa-exclamation-circle"></i>
                            <span id="returnErrorText"></span>
                        </div>

                        <div class="modal-actions">
                            <button id="confirmReturnBtn" class="btn-success">
                                <i class="fas fa-check"></i> Confirmar devolución
                            </button>
                            <button type="button" class="btn-secondary cancel-edit-btn">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;


        console.log('=== CREACIÓN MODAL HTML ===');
        console.log('Modal HTML creado, longitud:', modalHTML.length);
        console.log('Estado de state.currentProject:', state.currentProject);

        // Agregar el modal al DOM
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        console.log('Contenedor modal creado:', modalContainer);
        document.body.appendChild(modalContainer);

        const modal = modalContainer.querySelector('.return-stock-modal');
        console.log('Modal encontrado en DOM:', modal);
        console.log('Estilo del modal:', modal?.style);

        modal.style.display = 'flex';
        console.log('Estilo del modal después de display:', modal.style.display);
        state.previousModal = state.currentModal;
        state.currentModal = modal;

        // BOTÓN CERRAR
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.remove();
            state.currentModal = state.previousModal;
            state.previousModal = null;
        });

        // BOTÓN CANCELAR
        modal.querySelector('.cancel-edit-btn').addEventListener('click', () => {
            modal.remove();
            state.currentModal = state.previousModal;
            state.previousModal = null;
        });

        // CLIC EN OVERLAY
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                state.currentModal = state.previousModal;
                state.previousModal = null;
            }
        });


        // Gestionar la visualización de la sección "razón de la diferencia"
        const returnQuantityInput = modal.querySelector('#returnQuantity');
        const missingSection = modal.querySelector('#missingQuantitySection');

        returnQuantityInput.addEventListener('input', function() {
            const returnedQty = parseInt(this.value) || 0;

            if (returnedQty < originalQuantity) {
                missingSection.style.display = 'block';
                modal.querySelector('#missingReason').required = true;
            } else {
                missingSection.style.display = 'none';
                modal.querySelector('#missingReason').required = false;
                modal.querySelector('#missingReason').value = '';
            }
        });


        // Gestionar la confirmación de la devolución
        modal.querySelector('#confirmReturnBtn').addEventListener('click', async () => {
            await processReturnToStock(mouvementId, articleId, originalQuantity, modalContainer);
        });

    } catch (error) {
        console.error('=== ERROR ABRIR MODAL DEVOLUCIÓN ===');
        console.error('Error completo:', error);
        console.error('Stack:', error.stack);
        console.error('=== FIN ERROR ===');
        showAlert('Error al abrir el formulario de devolución', 'error');
    }
}

async function processReturnToStock(mouvementId, articleId, originalQuantity, modalElement) {
    try {
        const modal = modalElement;
        const returnQuantity = parseInt(modal.querySelector('#returnQuantity').value);
        const returnLocation = "Ubicación original según ficha del artículo";
        const itemCondition = modal.querySelector('#itemCondition').value;
        const returnComment = modal.querySelector('#returnComment').value.trim();
        const missingReason = modal.querySelector('#missingReason')?.value || '';
        const missingQuantity = originalQuantity - returnQuantity;

        // Validación de la razón si la cantidad es faltante
        if (missingQuantity > 0 && !missingReason) {
            modal.querySelector('#returnErrorText').textContent = 'Por favor, indique la razón de la cantidad faltante';
            modal.querySelector('#returnError').style.display = 'flex';
            return;
        }

        // Validación
        if (!returnQuantity || returnQuantity < 0) {
            modal.querySelector('#returnErrorText').textContent = 'La cantidad devuelta es inválida';
            modal.querySelector('#returnError').style.display = 'flex';
            return;
        }

        // Pedir confirmación
        if (!confirm(`¿Confirmar la devolución de ${returnQuantity} unidad(es) al stock?`)) {
            return;
        }

        showLoading();

        // 1. OBTENER EL STOCK ACTUAL + stock_reservado
        const { data: currentArticle, error: articleError } = await supabase
            .from('w_articles')
            .select('stock_actuel, stock_reserve')
            .eq('id', articleId)
            .single();

        if (articleError) throw articleError;

        // 2. CREAR EL MOVIMIENTO DE DEVOLUCIÓN
        const { data: returnMovement, error: movementError } = await supabase
            .from('w_mouvements')
            .insert([{
                article_id: articleId,
                type: 'retour_projet',
                quantite: returnQuantity,
                projet: state.currentProject?.nom || '',
                projet_id: state.currentProject?.id || null,
                commentaire: returnComment,
                utilisateur_id: state.user.id,
                utilisateur: state.user.username,
                stock_avant: currentArticle.stock_actuel,
                stock_apres: currentArticle.stock_actuel + returnQuantity,
                motif: `Devolución proyecto - Estado: ${itemCondition}`,
                notes: `Ubicación: ${returnLocation} | Estado: ${itemCondition}`,
                date_mouvement: new Date().toISOString().split('T')[0],
                heure_mouvement: new Date().toLocaleTimeString('es-ES', { hour12: false }),
                raison: missingReason && missingQuantity > 0 ? `${missingQuantity} ${missingReason}` : null,
                mouvement_parent_id: mouvementId
            }])
            .select()
            .single();

        if (movementError) throw movementError;

        // 3. ACTUALIZAR EL STOCK DEL ARTÍCULO (con stock_reservado)
        const { error: updateError } = await supabase
            .from('w_articles')
            .update({
                stock_actuel: currentArticle.stock_actuel + returnQuantity,
                stock_reserve: Math.max(0, currentArticle.stock_reserve - returnQuantity),
                updated_at: new Date().toISOString()
            })
            .eq('id', articleId);

        if (updateError) throw updateError;

        // 4. ACTUALIZAR LOS DATOS LOCALES
        await fetchMovements();
        await fetchArticles();

        // 5. CERRAR EL MODAL Y MOSTRAR ÉXITO
        modal.remove();
        showAlert(`${returnQuantity} unidad(es) devuelta(s) al stock con éxito`, 'success');

        // 6. REABRIR LOS DETALLES DEL PROYECTO SI ES NECESARIO
        if (state.currentProject && elements.projectDetailsModal.style.display === 'flex') {
            await showProjectDetails(state.currentProject.id);
        }

    } catch (error) {
        console.error('Error devolución al stock:', error);
        modalElement.querySelector('#returnErrorText').textContent = error.message || 'Error al devolver al stock';
        modalElement.querySelector('#returnError').style.display = 'flex';
    } finally {
        hideLoading();
    }
}

// Función auxiliar para editar una reserva
async function editReservation(reservationId) {
    try {
        // Recuperar la reserva
        const { data: reservation, error } = await supabase
            .from('w_reservations_actives')
            .select(`
                *,
                w_articles (
                    nom,
                    code,
                    prix_unitaire,
                    quantite_disponible
                )
            `)
            .eq('id', reservationId)
            .single();

        if (error) throw error;

        if (!reservation) {
            showAlert('Reserva no encontrada', 'error');
            return;
        }

        // Crear un modal de edición
        const modalHtml = `
            <div class="modal-overlay" id="editReservationModal" style="display: flex;">
                <div class="modal">
                    <div class="modal-header">
                        <h3><i class="fas fa-edit"></i> Editar reserva</h3>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Artículo :</label>
                            <input type="text"
                                   value="${reservation.w_articles?.nom || ''}"
                                   class="form-input"
                                   disabled>
                        </div>

                        <div class="form-group">
                            <label for="editQuantity">
                                <i class="fas fa-boxes"></i> Cantidad *
                            </label>
                            <div class="quantity-input-group">
                                <button type="button" class="quantity-btn minus" id="editQuantityMinus">
                                    <i class="fas fa-minus"></i>
                                </button>
                                <input type="number"
                                       id="editQuantity"
                                       min="1"
                                       max="${reservation.w_articles?.quantite_disponible + reservation.quantite || 100}"
                                       value="${reservation.quantite}"
                                       class="form-input quantity">
                                <button type="button" class="quantity-btn plus" id="editQuantityPlus">
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>
                            <div class="quantity-info">
                                <span>Stock disponible : <strong>${reservation.w_articles?.quantite_disponible + reservation.quantite || 0}</strong></span>
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="editDateFin">
                                <i class="fas fa-calendar"></i> Fecha de fin *
                            </label>
                            <input type="date"
                                   id="editDateFin"
                                   value="${reservation.date_fin.split('T')[0]}"
                                   class="form-input"
                                   required>
                        </div>

                        <div class="form-group">
                            <label for="editComment">
                                <i class="fas fa-comment"></i> Comentario
                            </label>
                            <textarea id="editComment"
                                      rows="3"
                                      class="form-textarea">${reservation.commentaire || ''}</textarea>
                        </div>

                        <div class="error-message" id="editReservationError" style="display: none;">
                            <i class="fas fa-exclamation-circle"></i>
                            <span id="editReservationErrorText"></span>
                        </div>

                        <div class="modal-actions">
                            <button id="confirmEditReservationBtn" class="btn-primary">
                                <i class="fas fa-save"></i> Guardar
                            </button>
                            <button type="button" class="btn-secondary cancel-edit-btn">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Agregar el modal al DOM
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer);

        const modal = document.getElementById('editReservationModal');

        // Manejar el cierre
        modal.querySelector('.cancel-edit-btn').addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Gestionar los botones de cantidad
        modal.querySelector('#editQuantityMinus').addEventListener('click', () => {
            const input = modal.querySelector('#editQuantity');
            let value = parseInt(input.value) || 1;
            if (value > 1) {
                input.value = value - 1;
            }
        });

        modal.querySelector('#editQuantityPlus').addEventListener('click', () => {
            const input = modal.querySelector('#editQuantity');
            const max = parseInt(input.max) || 100;
            let value = parseInt(input.value) || 1;
            if (value < max) {
                input.value = value + 1;
            }
        });

        // Gestionar el guardado
        modal.querySelector('#confirmEditReservationBtn').addEventListener('click', async () => {
            const quantity = parseInt(modal.querySelector('#editQuantity').value);
            const dateFin = modal.querySelector('#editDateFin').value;
            const comment = modal.querySelector('#editComment').value.trim();

            // Validación
            if (!quantity || quantity < 1) {
                modal.querySelector('#editReservationErrorText').textContent = 'La cantidad debe ser al menos 1';
                modal.querySelector('#editReservationError').style.display = 'flex';
                return;
            }

            if (!dateFin) {
                modal.querySelector('#editReservationErrorText').textContent = 'La fecha de fin es obligatoria';
                modal.querySelector('#editReservationError').style.display = 'flex';
                return;
            }

            try {
                showLoading();

                // Actualizar la reserva
                const { error: updateError } = await supabase
                    .from('w_reservations_actives')
                    .update({
                        quantite: quantity,
                        date_fin: dateFin + 'T23:59:59',
                        commentaire: comment,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', reservationId);

                if (updateError) throw updateError;

                showAlert('Reserva modificada con éxito', 'success');

                // Recargar los datos
                await fetchReservations();

                // Recargar los detalles del proyecto si está abierto
                if (state.currentProject) {
                    await showProjectDetails(state.currentProject.id);
                }

                // Cerrar el modal
                modal.remove();

            } catch (error) {
                console.error('Error modificación reserva:', error);
                modal.querySelector('#editReservationErrorText').textContent = error.message || 'Error al modificar la reserva';
                modal.querySelector('#editReservationError').style.display = 'flex';
            } finally {
                hideLoading();
            }
        });

    } catch (error) {
        console.error('Error preparación edición reserva:', error);
        showAlert('Error al preparar la edición', 'error');
    }
}

function updateProjectHistory(historyItems) {
    if (historyItems.length === 0) {
        elements.projectHistoryList.innerHTML = `
            <div class="empty-history">
                <i class="fas fa-history"></i>
                <p>No hay historial disponible</p>
            </div>
        `;
        return;
    }

    let html = '';
    historyItems.forEach(item => {
        // Determinar el icono y el tipo de acción
        let icon = 'history';
        let actionType = 'Acción';
        let details = '';
        const articleName = item.article?.nom || 'Artículo';
        const articleNum = item.article?.numero ? ` (${item.article.numero})` : '';

        if (item.type === 'sortie') {
            icon = 'arrow-up';
            actionType = 'Salida de stock';
            details = `${item.quantite} × ${articleName}${articleNum} | Proyecto: ${item.projet || 'N/A'}`;
        } else if (item.type === 'retour_projet') {
            icon = 'arrow-left';
            actionType = 'Devolución al stock';
            details = `${item.quantite} × ${articleName}${articleNum} devuelto(s)`;
            if (item.raison) {
                details += ` | ${item.raison}`;
            }
        } else if (item.type === 'entree') {
            icon = 'arrow-down';
            actionType = 'Entrada de stock';
            details = `${item.quantite} × ${articleName}${articleNum} | ${item.fournisseur || 'Stock inicial'}`;
        } else if (item.type === 'reservation') {
            icon = 'clock';
            actionType = 'Reserva';
            details = `${item.quantite} × ${articleName}${articleNum} reservado(s)`;
        }

        html += `
            <div class="history-item">
                <div class="history-icon ${item.type}">
                    <i class="fas fa-${icon}"></i>
                </div>
                <div class="history-content">
                    <div class="history-header">
                        <span class="history-title">${actionType}</span>
                        <span class="history-date">${formatDateTime(item.created_at)}</span>
                    </div>
                    <div class="history-details">
                        ${details}
                        ${item.commentaire ? `<div class="history-comment"><i class="fas fa-comment"></i> ${item.commentaire}</div>` : ''}
                    </div>
                    <div class="history-footer">
                        <span class="history-user"><i class="fas fa-user"></i> ${item.utilisateur || 'Sistema'}</span>
                    </div>
                </div>
            </div>
        `;
    });

    elements.projectHistoryList.innerHTML = html;
}

// ===== GESTIÓN DE LAS PESTAÑAS =====
function switchTab(tabName) {
    state.currentTab = tabName;

    // Actualizar los botones de pestaña
    elements.tabBtns.forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Actualizar los contenidos de las pestañas
    elements.tabContents.forEach(content => {
        if (content.id === tabName + 'Tab') {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });

    // Cargar las estadísticas si es la pestaña de análisis
    if (tabName === 'analytics') {
        loadAnalytics();
    }
}

function switchProjectTab(tabName) {
    // Actualizar los botones de pestaña del proyecto
    elements.projectTabBtns.forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Actualizar los contenidos de las pestañas del proyecto
    const tabs = ['info', 'reservations', 'history'];
    tabs.forEach(tab => {
        const element = document.getElementById(`project${tab.charAt(0).toUpperCase() + tab.slice(1)}Tab`);
        if (element) {
            if (tab === tabName) {
                element.classList.add('active');
            } else {
                element.classList.remove('active');
            }
        }
    });
}

// ===== GESTIÓN DE FILTROS =====
function applyFilters() {
    updateProjectsDisplay();
}

function clearFilters() {
    state.filters = {
        status: '',
        manager: '',
        sortBy: 'created_at'
    };

    elements.filterStatus.value = '';
    elements.filterManager.value = '';
    elements.sortBy.value = 'created_at';
    elements.searchProjects.value = '';

    applyFilters();
}

// ===== CREACIÓN DE PROYECTO =====
async function createProjectAction() {
    try {
        const projectData = {
            nom: elements.projectName.value.trim(),
            numero: elements.projectNumber.value.trim(),
            description: elements.projectDescription.value.trim(),
            responsable: elements.projectManager.value.trim(),
            date_fin_prevue: elements.projectEndDate.value || null,
            budget: elements.projectBudget.value ? parseFloat(elements.projectBudget.value) : null
        };

        // Validación
        if (!projectData.nom || !projectData.numero || !projectData.responsable) {
            elements.projectErrorText.textContent = 'Por favor, rellene todos los campos obligatorios';
            elements.projectError.style.display = 'flex';
            return;
        }

        // Verificar si el número ya existe
        const existingProject = state.projects.find(p => p.numero === projectData.numero);
        if (existingProject) {
            elements.projectErrorText.textContent = 'Este número de proyecto ya existe';
            elements.projectError.style.display = 'flex';
            return;
        }

        showLoading();
        const newProject = await createProject(projectData);

        // Añadir a los proyectos
        state.projects.unshift(newProject);

        // Actualizar la visualización
        updateProjectsDisplay();
        updateStatistics();
        populateManagerFilter();

        // Cerrar el modal y reiniciar el formulario
        hideModal();
        elements.newProjectForm.reset();
        elements.projectError.style.display = 'none';

        showAlert('Proyecto creado con éxito', 'success');

    } catch (error) {
        console.error('Error creación proyecto:', error);
        elements.projectErrorText.textContent = error.message || 'Error al crear el proyecto';
        elements.projectError.style.display = 'flex';
    } finally {
        hideLoading();
    }
}

// ===== ARCHIVO/DESARCHIVO =====
async function archiveProjectAction(projectId) {
    if (!confirm('¿Archivar este proyecto? El proyecto ya no aparecerá en los proyectos activos.')) {
        return;
    }

    try {
        showLoading();
        const archivedProject = await archiveProject(projectId);

        // Actualizar las listas
        const index = state.projects.findIndex(p => p.id === projectId);
        if (index !== -1) {
            state.projects.splice(index, 1);
            state.archivedProjects.unshift(archivedProject);
        }

        // Actualizar la visualización
        updateProjectsDisplay();
        updateArchivedProjectsDisplay();
        updateStatistics();

        // Si estamos en los detalles, cerrar el modal
        if (state.currentProject?.id === projectId) {
            hideModal();
        }

        showAlert('Proyecto archivado con éxito', 'success');

    } catch (error) {
        console.error('Error archivo proyecto:', error);
        showAlert('Error al archivar el proyecto', 'error');
    } finally {
        hideLoading();
    }
}

async function unarchiveProjectAction(projectId) {
    if (!confirm('¿Desarchivar este proyecto? El proyecto volverá a aparecer en los proyectos activos.')) {
        return;
    }

    try {
        showLoading();
        const unarchivedProject = await unarchiveProject(projectId);

        // Actualizar las listas
        const index = state.archivedProjects.findIndex(p => p.id === projectId);
        if (index !== -1) {
            state.archivedProjects.splice(index, 1);
            state.projects.unshift(unarchivedProject);
        }

        // Actualizar la visualización
        updateProjectsDisplay();
        updateArchivedProjectsDisplay();
        updateStatistics();

        showAlert('Proyecto desarchivado con éxito', 'success');

    } catch (error) {
        console.error('Error desarchivo proyecto:', error);
        showAlert('Error al desarchivar el proyecto', 'error');
    } finally {
        hideLoading();
    }
}

// ===== GESTIÓN DE RESERVAS =====
async function addReservationToProject() {
    if (!state.currentProject) return;

    // Reiniciar el modal
    elements.reservationArticle.value = '';
    elements.reservationQuantity.value = '1';
    elements.reservationComment.value = '';
    elements.reservationError.style.display = 'none';
    elements.reservationAvailableStock.textContent = '0';
    elements.reservationAlreadyReserved.textContent = '0';

    // Almacenar el modal anterior antes de abrir el nuevo
    console.log('addReservationToProject - Estableciendo previousModal:', {
        before: state.previousModal?.id,
        currentModal: state.currentModal?.id
    });

    showModal(elements.addReservationModal);

    showModal(elements.addReservationModal);
}

async function updateReservationStockInfo(articleId) {
    if (!articleId || !state.currentProject) return;

    try {
        const article = state.articles.find(a => a.id === articleId);
        if (article) {
            const stockReserve = article.stock_reserve || 0;
            const stockActuel = article.stock_actuel || 0;
            const stockDisponible = Math.max(0, stockActuel - stockReserve);

            // Mostrar el stock disponible real
            elements.reservationAvailableStock.textContent = stockDisponible;

            // Recuperar la cantidad ya reservada para ESTE PROYECTO
            const projectReservations = state.reservations.filter(r =>
                r.projet_id === state.currentProject.id && r.article_id === articleId
            );
            const alreadyReserved = projectReservations.reduce((sum, r) => sum + r.quantite, 0);
            elements.reservationAlreadyReserved.textContent = alreadyReserved;

            // Actualizar la cantidad máxima con el stock disponible
            const currentQuantity = parseInt(elements.reservationQuantity.value) || 1;

            if (currentQuantity > stockDisponible) {
                elements.reservationQuantity.value = Math.max(1, stockDisponible);
            }
        }
        // ← Más código fuera del if(article), por lo tanto, no hay error si article es null

    } catch (error) {
        console.error('Error actualización info stock:', error);
    }
}

function refreshReservationModal() {
    // Recalcular y volver a mostrar la información de stock
    const articleId = elements.reservationArticle.value;
    if (articleId) {
        updateReservationStockInfo(articleId);
    }

    // Repoblar la lista de artículos (por si acaso)
    populateArticleSelect();
}

async function confirmAddReservation() {
    try {
        const articleId = elements.reservationArticle.value;
        const quantity = parseInt(elements.reservationQuantity.value);
        const comment = elements.reservationComment.value.trim();

        // Validación
        if (!articleId) {
            elements.reservationErrorText.textContent = 'Por favor, seleccione un artículo';
            elements.reservationError.style.display = 'flex';
            return;
        }

        if (!quantity || quantity < 1) {
            elements.reservationErrorText.textContent = 'La cantidad debe ser al menos 1';
            elements.reservationError.style.display = 'flex';
            return;
        }

        // Verificar el stock disponible real
        const article = state.articles.find(a => a.id === articleId);
        if (!article) {
            elements.reservationErrorText.textContent = 'Artículo no encontrado';
            elements.reservationError.style.display = 'flex';
            return;
        }

        // Calcular el stock disponible real
        const stockReserve = article.stock_reserve || 0;
        const stockActuel = article.stock_actuel || 0;
        const stockDisponible = Math.max(0, stockActuel - stockReserve);

        if (stockDisponible < quantity) {
            elements.reservationErrorText.textContent = `Stock insuficiente. Disponible: ${stockDisponible}`;
            elements.reservationError.style.display = 'flex';
            return;
        }

        showLoading();

        const reservationData = {
            articleId: articleId,
            projectId: state.currentProject.id,
            quantity: quantity,
            comment: comment
        };

        const newReservation = await createReservation(reservationData);

        // Añadir a la lista de reservas
        state.reservations.push(newReservation);

        // Actualizar el stock_reserve en el artículo local
        if (article) {
            article.stock_reserve = (article.stock_reserve || 0) + quantity;
        }

        // Recargar los detalles del proyecto
        await showProjectDetails(state.currentProject.id);

        // Actualizar las estadísticas
        updateStatistics();

        // Cerrar el modal
        hideModal();

        showAlert('Reserva añadida con éxito', 'success');

    } catch (error) {
        console.error('Error al añadir reserva:', error);
        elements.reservationErrorText.textContent = error.message || 'Error al añadir la reserva';
        elements.reservationError.style.display = 'flex';
    } finally {
        hideLoading();
    }
}

async function releaseAllProjectItems() {
    if (!state.currentProject) return;

    // Recuperar las reservas del proyecto
    const projectReservations = state.reservations.filter(r => r.id_projet === state.currentProject.id);

    if (projectReservations.length === 0) {
        showAlert('No hay reservas para liberar en este proyecto', 'info');
        return;
    }

    // Actualizar el contador en el modal
    elements.releaseItemsCount.textContent = projectReservations.length;
    elements.releaseReason.value = '';
    elements.releaseComment.value = '';
    elements.releaseError.style.display = 'none';

    showModal(elements.releaseStockModal);
}

async function confirmReleaseAll() {
    try {
        const reason = elements.releaseReason.value;
        const comment = elements.releaseComment.value.trim();

        if (!reason) {
            elements.releaseErrorText.textContent = 'Por favor, seleccione una razón';
            elements.releaseError.style.display = 'flex';
            return;
        }

        if (!confirm(`¿Está seguro de que desea liberar todas las reservas de este proyecto? (${elements.releaseItemsCount.textContent} reserva(s))`)) {
            return;
        }

        showLoading();

        // Recuperar las reservas del proyecto
        const projectReservations = state.reservations.filter(r => r.id_projet === state.currentProject.id);

        // Liberar cada reserva
        for (const reservation of projectReservations) {
            try {
                await releaseReservation(reservation.id, `Liberación global: ${reason} - ${comment}`);
            } catch (error) {
                console.error(`Error al liberar reserva ${reservation.id}:`, error);
            }
        }

        // Actualizar los datos
        await fetchReservations();

        // Recargar los detalles del proyecto
        await showProjectDetails(state.currentProject.id);

        // Actualizar las estadísticas
        updateStatistics();

        // Cerrar el modal
        hideModal();

        showAlert('Todas las reservas han sido liberadas', 'success');

    } catch (error) {
        console.error('Error liberación global:', error);
        elements.releaseErrorText.textContent = error.message || 'Error al liberar el stock';
        elements.releaseError.style.display = 'flex';
    } finally {
        hideLoading();
    }
}

// ===== ESTADÍSTICAS Y GRÁFICOS =====
function loadAnalytics() {
    // Actualizar las listas
    updateTopManagers();
    updateTopArticles();

    // Crear los gráficos si es necesario
    if (!state.charts.reservationsChart) {
        createReservationsChart();
    }
    if (!state.charts.statusChart) {
        createStatusChart();
    }

    // Actualizar los gráficos
    updateCharts();
}

function createReservationsChart() {
    const ctx = elements.reservationsChart.getContext('2d');
    state.charts.reservationsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Nuevas reservas',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function createStatusChart() {
    const ctx = elements.statusChart.getContext('2d');
    state.charts.statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Activos', 'Próximos a finalizar', 'Retrasados', 'Archivados'],
            datasets: [{
                data: [0, 0, 0, 0],
                backgroundColor: [
                    'rgb(40, 167, 69)',
                    'rgb(255, 193, 7)',
                    'rgb(220, 53, 69)',
                    'rgb(108, 117, 125)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function updateCharts() {
    if (!state.charts.reservationsChart || !state.charts.statusChart) return;

    // Actualizar el gráfico de estado
    const activeCount = state.projects.filter(p => getProjectStatus(p) === 'active').length;
    const endingCount = state.projects.filter(p => getProjectStatus(p) === 'ending').length;
    const overdueCount = state.projects.filter(p => getProjectStatus(p) === 'overdue').length;
    const archivedCount = state.archivedProjects.length;

    state.charts.statusChart.data.datasets[0].data = [activeCount, endingCount, overdueCount, archivedCount];
    state.charts.statusChart.update();

    // Actualizar el gráfico de reservas (datos de ejemplo para el ejemplo)
    const period = parseInt(elements.analyticsPeriod.value) || 30;
    const labels = [];
    const data = [];

    // Generar datos para los X últimos días
    for (let i = period; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }));

        // Datos de ejemplo - para reemplazar con datos reales
        data.push(Math.floor(Math.random() * 10) + 1);
    }

    state.charts.reservationsChart.data.labels = labels;
    state.charts.reservationsChart.data.datasets[0].data = data;
    state.charts.reservationsChart.update();
}

function updateTopManagers() {
    const managerStats = {};

    state.projects.forEach(project => {
        if (project.responsable) {
            if (!managerStats[project.responsable]) {
                managerStats[project.responsable] = {
                    count: 0,
                    items: 0
                };
            }
            managerStats[project.responsable].count++;

            // Contar los artículos del proyecto
            const projectItems = state.reservations.filter(r => r.id_projet === project.id)
                .reduce((sum, r) => sum + r.quantite, 0);
            managerStats[project.responsable].items += projectItems;
        }
    });

    const sortedManagers = Object.entries(managerStats)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5);

    let html = '';
    if (sortedManagers.length === 0) {
        html = '<div class="empty-list">Ningún responsable</div>';
    } else {
        sortedManagers.forEach(([manager, stats], index) => {
            html += `
                <div class="top-item ${index < 3 ? 'top' : ''}">
                    <div class="top-item-header">
                        <span class="top-item-rank">#${index + 1}</span>
                        <span class="top-item-name">${manager}</span>
                    </div>
                    <div class="top-item-stats">
                        <span class="stat"><i class="fas fa-project-diagram"></i> ${stats.count} proyecto(s)</span>
                        <span class="stat"><i class="fas fa-box"></i> ${stats.items} artículo(s)</span>
                    </div>
                </div>
            `;
        });
    }

    elements.topManagersList.innerHTML = html;
}

function updateTopArticles() {
    const articleStats = {};

    state.reservations.forEach(reservation => {
        const article = state.articles.find(a => a.id === reservation.id_article);
        if (article) {
            const articleKey = article.nom;
            if (!articleStats[articleKey]) {
                articleStats[articleKey] = {
                    name: article.nom,
                    code: article.code || article.numero,
                    count: 0,
                    quantity: 0
                };
            }
            articleStats[articleKey].count++;
            articleStats[articleKey].quantity += reservation.quantite;
        }
    });

    const sortedArticles = Object.values(articleStats)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

    let html = '';
    if (sortedArticles.length === 0) {
        html = '<div class="empty-list">Ninguna reserva</div>';
    } else {
        sortedArticles.forEach((article, index) => {
            html += `
                <div class="top-item ${index < 3 ? 'top' : ''}">
                    <div class="top-item-header">
                        <span class="top-item-rank">#${index + 1}</span>
                        <span class="top-item-name">${article.name}</span>
                    </div>
                    <div class="top-item-stats">
                        <span class="stat"><i class="fas fa-hashtag"></i> ${article.code}</span>
                        <span class="stat"><i class="fas fa-box"></i> ${article.quantity} unidad(es)</span>
                        <span class="stat"><i class="fas fa-sync-alt"></i> ${article.count} reserva(s)</span>
                    </div>
                </div>
            `;
        });
    }

    elements.topArticlesList.innerHTML = html;
}

// ===== EVENTOS =====
function setupEventListeners() {
    // Cierre de sesión
    elements.logoutBtn.addEventListener('click', logout);

    // Pestañas principales
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchTab(tab);
        });
    });

    // Pestañas de detalles del proyecto
    elements.projectTabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchProjectTab(tab);
        });
    });

    // Cierre de modales con delegación de eventos
    document.addEventListener('click', function(e) {
        const closeBtn = e.target.closest('.close-modal');
        if (!closeBtn) return;

        e.preventDefault();
        e.stopPropagation(); // ← IMPORTANTE: evita otros manejadores

        console.log('Botón de cierre presionado:', {
            currentModal: state.currentModal?.id,
            previousModal: state.previousModal?.id
        });

        // Si estamos en un modal hijo y hay un modal anterior
        if (state.currentModal && state.previousModal) {
            console.log('Volviendo al modal anterior');
            hideModal(true);
        } else {
            console.log('Cierre normal');
            hideModal();
        }
    });

    // Clic fuera de los modales para cerrar
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', function(e) {
            if (e.target === this) {
                hideModal();
            }
        });
    });

    // Botones de cabecera
    elements.newProjectBtn.addEventListener('click', () => {
        showModal(elements.newProjectModal);
    });

    elements.showArchivedBtn.addEventListener('click', () => {
        switchTab('archived');
    });

    elements.exportProjectsBtn.addEventListener('click', exportProjects);

    // Filtros
    elements.filterStatus.addEventListener('change', function() {
        state.filters.status = this.value;
        applyFilters();
    });

    elements.filterManager.addEventListener('change', function() {
        state.filters.manager = this.value;
        applyFilters();
    });

    elements.sortBy.addEventListener('change', function() {
        state.filters.sortBy = this.value;
        applyFilters();
    });

    elements.searchProjects.addEventListener('input', applyFilters);
    elements.searchBtn.addEventListener('click', applyFilters);

    elements.clearFiltersBtn.addEventListener('click', clearFilters);

    // Formulario nuevo proyecto
    elements.newProjectForm.addEventListener('submit', function(e) {
        e.preventDefault();
        createProjectAction();
    });

    // Botones de detalles del proyecto
    elements.addReservationToProjectBtn.addEventListener('click', addReservationToProject);
    elements.archiveProjectBtn.addEventListener('click', function() {
        if (state.currentProject) {
            if (state.currentProject.archived) {
                unarchiveProjectAction(state.currentProject.id);
            } else {
                archiveProjectAction(state.currentProject.id);
            }
        }
    });

    elements.editProjectBtn.addEventListener('click', editProject);
    elements.exportProjectBtn.addEventListener('click', exportProjectDetails);

    // Modal de reserva
    elements.reservationArticle.addEventListener('change', function() {
        updateReservationStockInfo(this.value);
    });

    elements.reservationQuantity.addEventListener('input', function() {
        const articleId = elements.reservationArticle.value;
        if (articleId) {
            const article = state.articles.find(a => a.id === articleId);
            const maxQuantity = article?.quantite_disponible || 0;
            const currentQuantity = parseInt(this.value) || 1;

            if (currentQuantity > maxQuantity) {
                this.value = Math.max(1, maxQuantity);
            }
        }
    });

    // Delegación de eventos para los botones + y - del modal de Reserva
    document.addEventListener('click', function(e) {
        // Botón -
        if (e.target.closest('#reservationQuantityMinus') ||
            e.target.id === 'reservationQuantityMinus') {
            const input = document.getElementById('reservationQuantity');
            let value = parseInt(input.value) || 1;
            if (value > 1) {
                input.value = value - 1;
            }
        }

        // Botón +
        if (e.target.closest('#reservationQuantityPlus') ||
            e.target.id === 'reservationQuantityPlus') {
            const input = document.getElementById('reservationQuantity');
            let value = parseInt(input.value) || 1;
            const articleId = document.getElementById('reservationArticle')?.value;

            if (articleId) {
                const article = state.articles.find(a => a.id === articleId);
                // Calcular el stock disponible real
                const stockReserve = article?.stock_reserve || 0;
                const stockActuel = article?.stock_actuel || 0;
                const stockDisponible = Math.max(0, stockActuel - stockReserve);

                if (value < stockDisponible) {
                    input.value = value + 1;
                }
            } else {
                input.value = value + 1;
            }
        }
    });

    elements.confirmAddReservationBtn.addEventListener('click', confirmAddReservation);

    // Modal de liberación de stock
    elements.confirmReleaseBtn.addEventListener('click', confirmReleaseAll);

    // Período de estadísticas
    elements.analyticsPeriod.addEventListener('change', updateCharts);

    // Tecla Escape para cerrar modales
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && state.currentModal) {
            hideModal();
        }
    });
}

// ===== FUNCIONES DE EXPORTACIÓN =====
async function exportProjects() {
    try {
        showLoading();

        // Preparar los datos
        let data = [];

        if (state.currentTab === 'projects') {
            data = state.projects.map(project => {
                const projectReservations = state.reservations.filter(r => r.id_projet === project.id);
                const itemsCount = projectReservations.reduce((sum, r) => sum + r.quantite, 0);
                const status = getProjectStatus(project);

                return {
                    'Nombre': project.nom,
                    'Número': project.numero || '',
                    'Descripción': project.description || '',
                    'Responsable': project.responsable || '',
                    'Fecha creación': formatDate(project.created_at),
                    'Fecha fin prevista': project.date_fin_prevue ? formatDate(project.date_fin_prevue) : '',
                    'Presupuesto': project.budget || '',

                    'Artículos reservados': itemsCount,
                    'Número de reservas': projectReservations.length
                };
            });
        } else if (state.currentTab === 'archived') {
            data = state.archivedProjects.map(project => {
                const projectReservations = state.reservations.filter(r => r.id_projet === project.id);
                const itemsCount = projectReservations.reduce((sum, r) => sum + r.quantite, 0);

                return {
                    'Nombre': project.nom,
                    'Número': project.numero || '',
                    'Descripción': project.description || '',
                    'Responsable': project.responsable || '',
                    'Fecha creación': formatDate(project.created_at),
                    'Fecha de archivo': project.archived_at ? formatDate(project.archived_at) : '',
                    'Presupuesto': project.budget || '',
                    'Artículos reservados': itemsCount,
                    'Número de reservas': projectReservations.length
                };
            });
        }

        // Convertir a CSV
        const headers = Object.keys(data[0] || {});
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => {
                const cell = row[header] || '';
                return `"${cell.toString().replace(/"/g, '""')}"`;
            }).join(','))
        ].join('\n');

        // Descargar
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `proyectos_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showAlert('Exportación realizada con éxito', 'success');

    } catch (error) {
        console.error('Error exportación:', error);
        showAlert('Error durante la exportación', 'error');
    } finally {
        hideLoading();
    }
}

async function exportProjectDetails() {
    if (!state.currentProject) return;

    try {
        showLoading();

        // Determinar la pestaña activa
        const activeTab = document.querySelector('.project-tab-btn.active')?.dataset.tab || 'reservations';

        // Recuperar los datos según la pestaña
        if (activeTab === 'history') {
            await exportProjectHistory();
        } else {
            await exportProjectReservations();
        }

    } catch (error) {
        console.error('Error exportación proyecto:', error);
        showAlert('Error durante la exportación del proyecto', 'error');
    } finally {
        hideLoading();
    }
}

async function exportProjectReservations() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const project = state.currentProject;
        const projectData = await getProjectReservations(project.id);
        const sorties = projectData.sorties || [];
        const reservations = projectData.reservations || [];

        let yPos = 20;
        const pageWidth = doc.internal.pageSize.width;
        const margin = 15;

        // ===== ENCABEZADO =====
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('DETALLES DEL PROYECTO', pageWidth / 2, yPos, { align: 'center' });
        yPos += 10;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(`Exportado el: ${new Date().toLocaleDateString('es-ES')}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 15;

        // ===== INFORMACIÓN DEL PROYECTO =====
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('INFORMACIÓN DEL PROYECTO', margin, yPos);
        yPos += 8;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');

        const projectInfo = [
            ['Nombre:', project.nom],
            ['Número:', project.numero || 'No definido'],
            ['Descripción:', project.description || 'Sin descripción'],
            ['Responsable:', project.responsable || 'No definido'],
            ['Fecha creación:', formatDate(project.created_at)],
            ['Fecha fin prevista:', project.date_fin_prevue ? formatDate(project.date_fin_prevue) : 'No definida'],
            ['Presupuesto:', project.budget ? `${project.budget} €` : 'No definido'],
            ['Estado:', project.archived ? 'Archivado' : getProjectStatus(project) === 'active' ? 'Activo' :
                         getProjectStatus(project) === 'ending' ? 'Próximo a finalizar' : 'Retrasado']
        ];

        projectInfo.forEach(([label, value]) => {
            doc.setFont('helvetica', 'bold');
            doc.text(label, margin, yPos);
            doc.setFont('helvetica', 'normal');

            // Gestionar textos largos con salto de línea
            const lines = doc.splitTextToSize(value.toString(), pageWidth - margin - 60);
            lines.forEach((line, index) => {
                doc.text(line, margin + 40, yPos + (index * 5));
            });
            yPos += Math.max(lines.length * 5, 7);

            // Verificar si se necesita una nueva página
            if (yPos > doc.internal.pageSize.height - 40) {
                doc.addPage();
                yPos = 20;
            }
        });

        yPos += 5;

        // ===== ESTADÍSTICAS =====
        if (sorties.length > 0 || reservations.length > 0) {
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('ESTADÍSTICAS', margin, yPos);
            yPos += 8;

            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');

            // Cálculos
            const itemsSortis = sorties.reduce((sum, s) => sum + (s.quantite || 0), 0);
            const valeurSortis = sorties.reduce((sum, s) => {
                const article = s.article;
                return sum + ((article?.prix_unitaire || 0) * (s.quantite || 0));
            }, 0);

            const itemsReserves = reservations.reduce((sum, r) => sum + (r.quantite || 0), 0);
            const valeurReserves = reservations.reduce((sum, r) => {
                const article = r.w_articles;
                return sum + ((article?.prix_unitaire || 0) * (r.quantite || 0));
            }, 0);

            const stats = [
                ['Artículos usados:', `${itemsSortis} unidad(es)`, `${valeurSortis.toFixed(2)} €`],
                ['Artículos reservados:', `${itemsReserves} unidad(es)`, `${valeurReserves.toFixed(2)} €`],
                ['Total artículos:', `${itemsSortis + itemsReserves} unidad(es)`, `${(valeurSortis + valeurReserves).toFixed(2)} €`]
            ];

            stats.forEach(([label, qty, value]) => {
                doc.setFont('helvetica', 'bold');
                doc.text(label, margin, yPos);
                doc.setFont('helvetica', 'normal');
                doc.text(qty, pageWidth / 2, yPos, { align: 'center' });
                doc.text(value, pageWidth - margin, yPos, { align: 'right' });
                yPos += 6;
            });

            yPos += 5;
        }

        // ===== SALIDAS (ARTÍCULOS USADOS) =====
        if (sorties.length > 0) {
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('ARTÍCULOS USADOS', margin, yPos);
            yPos += 8;

            // Encabezado de la tabla
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Artículo', margin, yPos);
            doc.text('Cant.', margin + 80, yPos);
            doc.text('Fecha', margin + 100, yPos);
            doc.text('Precio unitario', margin + 130, yPos);
            doc.text('Total', margin + 170, yPos);

            doc.line(margin, yPos + 1, pageWidth - margin, yPos + 1);
            yPos += 6;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);

            sorties.forEach(item => {
                const article = item.article || {};
                const prixUnitaire = article.prix_unitaire || 0;
                const total = prixUnitaire * (item.quantite || 0);

                // Verificar nueva página
                if (yPos > doc.internal.pageSize.height - 20) {
                    doc.addPage();
                    yPos = 20;
                }

                doc.text(article.nom?.substring(0, 30) || 'Artículo', margin, yPos);
                doc.text(item.quantite?.toString() || '0', margin + 80, yPos);
                doc.text(formatDate(item.created_at), margin + 100, yPos);
                doc.text(`${prixUnitaire.toFixed(2)} €`, margin + 130, yPos);
                doc.text(`${total.toFixed(2)} €`, margin + 170, yPos);

                yPos += 6;
            });

            yPos += 10;
        }

        // ===== RESERVAS =====
        if (reservations.length > 0) {
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('ARTÍCULOS RESERVADOS', margin, yPos);
            yPos += 8;

            // Encabezado de la tabla
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Artículo', margin, yPos);
            doc.text('Cant.', margin + 80, yPos);
            doc.text('Fecha fin', margin + 100, yPos);
            doc.text('Usuario', margin + 130, yPos);
            doc.text('Precio unitario', margin + 170, yPos);

            doc.line(margin, yPos + 1, pageWidth - margin, yPos + 1);
            yPos += 6;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);

            reservations.forEach(res => {
                const article = res.w_articles || {};
                const prixUnitaire = article.prix_unitaire || 0;

                // Verificar nueva página
                if (yPos > doc.internal.pageSize.height - 20) {
                    doc.addPage();
                    yPos = 20;
                }

                doc.text(article.nom?.substring(0, 30) || 'Artículo', margin, yPos);
                doc.text(res.quantite?.toString() || '0', margin + 80, yPos);
                doc.text(formatDate(res.date_fin), margin + 100, yPos);
                doc.text(res.w_users?.username?.substring(0, 15) || 'Usuario', margin + 130, yPos);
                doc.text(`${prixUnitaire.toFixed(2)} €`, margin + 170, yPos);

                yPos += 6;
            });
        }

        // Pie de página
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('Documento generado automáticamente - Sistema de gestión de stock',
                pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });

        // Descargar
        doc.save(`proyecto_${project.numero || project.id}_${new Date().toISOString().split('T')[0]}.pdf`);
        showAlert('PDF exportado con éxito', 'success');

    } catch (error) {
        console.error('Error exportación PDF:', error);
        throw error;
    }
}

async function exportProjectHistory() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const project = state.currentProject;
        const history = await getProjectHistory(project.id);

        let yPos = 20;
        const pageWidth = doc.internal.pageSize.width;
        const margin = 15;

        // ===== ENCABEZADO =====
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('HISTORIAL DEL PROYECTO', pageWidth / 2, yPos, { align: 'center' });
        yPos += 10;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(`Proyecto: ${project.nom} (${project.numero || 'Sin número'})`, margin, yPos);
        yPos += 5;
        doc.text(`Exportado el: ${new Date().toLocaleDateString('es-ES')}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 10;

        if (history.length === 0) {
            doc.setFontSize(12);
            doc.text('No hay historial disponible', pageWidth / 2, yPos, { align: 'center' });
        } else {
            // ===== LISTA DE HISTORIAL =====
            doc.setFontSize(10);
            history.forEach((item, index) => {
                // Verificar nueva página
                if (yPos > doc.internal.pageSize.height - 30) {
                    doc.addPage();
                    yPos = 20;
                }

                // Tipo de acción con icono
                let actionType = '';
                let color = [0, 0, 0]; // Negro por defecto

                switch(item.type) {
                    case 'sortie':
                        actionType = 'Salida de stock';
                        color = [220, 53, 69]; // Rojo
                        break;
                    case 'retour_projet':
                        actionType = 'Retorno a stock';
                        color = [40, 167, 69]; // Verde
                        break;
                    case 'entree':
                        actionType = 'Entrada de stock';
                        color = [0, 123, 255]; // Azul
                        break;
                    default:
                        actionType = item.type || 'Acción';
                }

                // Fecha y hora
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...color);
                doc.text(actionType, margin, yPos);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 100, 100);
                doc.text(formatDateTime(item.created_at), pageWidth - margin, yPos, { align: 'right' });

                yPos += 4;

                // Detalles
                doc.setFontSize(9);
                doc.setTextColor(0, 0, 0);

                const details = [];
                if (item.article?.nom) {
                    details.push(`Artículo: ${item.article.nom}${item.article.numero ? ` (${item.article.numero})` : ''}`);
                }
                if (item.quantite) {
                    details.push(`Cantidad: ${item.quantite}`);
                }
                if (item.projet) {
                    details.push(`Proyecto: ${item.projet}`);
                }
                if (item.utilisateur) {
                    details.push(`Usuario: ${item.utilisateur}`);
                }

                details.forEach(detail => {
                    doc.text(`• ${detail}`, margin + 5, yPos);
                    yPos += 4;
                });

                // Comentario
                if (item.commentaire) {
                    doc.setFont('helvetica', 'italic');
                    doc.setTextColor(120, 120, 120);
                    doc.text(`"${item.commentaire}"`, margin + 10, yPos);
                    yPos += 4;
                    doc.setFont('helvetica', 'normal');
                }

                // Separador
                if (index < history.length - 1) {
                    doc.setDrawColor(200, 200, 200);
                    doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);
                    yPos += 8;
                } else {
                    yPos += 4;
                }

                // Restablecer el color
                doc.setTextColor(0, 0, 0);
            });
        }

        // Pie de página
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('Documento de proyecto - Sistema de gestión de stock',
                pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });

        // Descargar
        doc.save(`historial_${project.numero || project.id}_${new Date().toISOString().split('T')[0]}.pdf`);
        showAlert('Historial exportado en PDF', 'success');

    } catch (error) {
        console.error('Error exportación historial:', error);
        throw error;
    }
}

// ===== EDICIÓN DE PROYECTO =====
async function editProject() {
    if (!state.currentProject) return;

    try {
        // Pre-rellenar el formulario
        elements.projectName.value = state.currentProject.nom;
        elements.projectNumber.value = state.currentProject.numero || '';
        elements.projectDescription.value = state.currentProject.description || '';
        elements.projectManager.value = state.currentProject.responsable || '';
        elements.projectEndDate.value = state.currentProject.date_fin_prevue ?
            state.currentProject.date_fin_prevue.split('T')[0] : '';
        elements.projectBudget.value = state.currentProject.budget || '';

        // Cambiar el título y el botón
        const modal = elements.newProjectModal;
        const header = modal.querySelector('.modal-header h3');
        const submitBtn = modal.querySelector('.btn-primary');

        header.innerHTML = '<i class="fas fa-edit"></i> Modificar proyecto';
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Guardar cambios';

        // Cambiar el evento
        modal.querySelector('form').onsubmit = async function(e) {
            e.preventDefault();
            await updateProjectAction();
        };

        // ← AÑADE ESTA LÍNEA IMPORTANTE CON DEBUG
        console.log('editProject - Estableciendo previousModal:', {
            before: state.previousModal?.id,
            currentModal: state.currentModal?.id,
            currentModalElement: state.currentModal
        });

        showModal(modal);
    } catch (error) {
        console.error('Error al preparar la edición:', error);
        showAlert('Error al preparar la edición', 'error');
    }
}

async function updateProjectAction() {
    try {
        const projectData = {
            nom: elements.projectName.value.trim(),
            numero: elements.projectNumber.value.trim(),
            description: elements.projectDescription.value.trim(),
            responsable: elements.projectManager.value.trim(),
            date_fin_prevue: elements.projectEndDate.value || null,
            budget: elements.projectBudget.value ? parseFloat(elements.projectBudget.value) : null
        };

        // Validación
        if (!projectData.nom || !projectData.numero || !projectData.responsable) {
            elements.projectErrorText.textContent = 'Por favor, rellena todos los campos obligatorios';
            elements.projectError.style.display = 'flex';
            return;
        }

        // Verificar si el número ya existe (excepto para el proyecto actual)
        const existingProject = state.projects.find(p =>
            p.numero === projectData.numero && p.id !== state.currentProject.id
        );
        if (existingProject) {
            elements.projectErrorText.textContent = 'Este número de proyecto ya existe';
            elements.projectError.style.display = 'flex';
            return;
        }

        showLoading();
        const updatedProject = await updateProject(state.currentProject.id, projectData);

        // Actualizar las listas
        const allProjects = [...state.projects, ...state.archivedProjects];
        const projectIndex = allProjects.findIndex(p => p.id === state.currentProject.id);

        if (projectIndex !== -1) {
            allProjects[projectIndex] = updatedProject;

            // Reordenar en las listas correctas
            if (updatedProject.archived) {
                state.archivedProjects = allProjects.filter(p => p.archived);
                state.projects = allProjects.filter(p => !p.archived);
            } else {
                state.projects = allProjects.filter(p => !p.archived);
                state.archivedProjects = allProjects.filter(p => p.archived);
            }
        }

        // Actualizar la visualización
        updateProjectsDisplay();
        updateArchivedProjectsDisplay();
        populateManagerFilter();

        // Recargar detalles si está abierto
        if (elements.projectDetailsModal.style.display === 'flex') {
            await showProjectDetails(updatedProject.id);
        }

        // Cerrar el modal y reiniciar
        hideModal();
        elements.newProjectForm.reset();
        elements.projectError.style.display = 'none';

        // Restaurar el formulario original
        const modal = elements.newProjectModal;
        const header = modal.querySelector('.modal-header h3');
        const submitBtn = modal.querySelector('.btn-primary');

        header.innerHTML = '<i class="fas fa-plus-circle"></i> Nuevo proyecto';
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Crear proyecto';

        // Restaurar el evento original
        modal.querySelector('form').onsubmit = function(e) {
            e.preventDefault();
            createProjectAction();
        };

        showAlert('Proyecto modificado con éxito', 'success');

    } catch (error) {
        console.error('Error al modificar proyecto:', error);
        elements.projectErrorText.textContent = error.message || 'Error al modificar el proyecto';
        elements.projectError.style.display = 'flex';
    } finally {
        hideLoading();
    }
}

// ===== INICIALIZACIÓN =====
async function init() {
    try {
        // Verificar autenticación
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) return;

        // Inicializar eventos
        setupEventListeners();

        // Cargar datos iniciales en orden
        await fetchProjects();  // Primero los proyectos
        await Promise.all([     // Luego los demás datos en paralelo
            fetchArticles(),
            fetchReservations(),
            fetchUsers(),
            fetchMovements()
        ]);

        // AHORA que todos los datos están cargados, actualizar la visualización
        updateStatistics();
        updateProjectsDisplay();
        updateArchivedProjectsDisplay();
        populateManagerFilter();

        // Ocultar la superposición de carga
        hideLoading();

    } catch (error) {
        console.error('Error de inicialización:', error);
        showAlert('Error al cargar la aplicación', 'error');
        hideLoading();
    }
}

// Iniciar la aplicación
document.addEventListener('DOMContentLoaded', init);
