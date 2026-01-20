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
    releaseAllProjectItemsBtn: document.getElementById('releaseAllProjectItemsBtn'),
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
            alert('Accès réservé aux utilisateurs avec la permission "Projets"');
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
    if (!confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
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
        return date.toLocaleDateString('fr-FR', {
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
        return date.toLocaleDateString('fr-FR', {
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

        if (end < today) return 0; // Déjà terminé

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
        if (!confirm(`Utiliser ${quantityToUse} article(s) sur ${originalQuantity} réservés ?`)) {
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
        const articleName = reservation.w_articles?.nom || 'Article inconnu';
        const projetNom = state.currentProject?.nom || 'Projet inconnu';
        const mouvementComment = comment
            ? `${comment} | Source: Réservation #${reservationId} (${articleName})`
            : `Sortie pour projet "${projetNom}" depuis réservation #${reservationId} (${articleName})`;

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
                heure_mouvement: new Date().toLocaleTimeString('fr-FR', { hour12: false }),
                created_at: new Date().toISOString()
            }]);

        if (movementError) throw movementError;

        // Gérer la réservation selon la quantité utilisée
        if (quantityToUse === originalQuantity) {
            // Supprimer complètement la réservation
            const { error: deleteError } = await supabase
                .from('w_reservations_actives')
                .delete()
                .eq('id', reservationId);

            if (deleteError) throw deleteError;
        } else {
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

        showAlert(`${quantityToUse} article(s) marqué(s) comme utilisé(s)`, 'success');

    } catch (error) {
        console.error('Erreur utilisation réservation:', error);
        showAlert('Erreur lors de la mise à jour de la réservation', 'error');
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
                    <h3><i class="fas fa-check-circle"></i> Marquer comme utilisé</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label><i class="fas fa-boxes"></i> Quantité à utiliser *</label>
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
                            <span>Quantité réservée : <strong>${originalQuantity}</strong></span>
                        </div>
                    </div>

                    <div class="form-group">
                        <label><i class="fas fa-comment"></i> Commentaire (optionnel)</label>
                        <textarea id="useComment"
                                  rows="3"
                                  placeholder="Détails de l'utilisation..."
                                  class="form-textarea"></textarea>
                    </div>

                    <div class="error-message" id="useReservationError" style="display: none;">
                        <i class="fas fa-exclamation-circle"></i>
                        <span id="useReservationErrorText"></span>
                    </div>

                    <div class="modal-actions">
                        <button id="confirmUseReservationBtn" class="btn-success">
                            <i class="fas fa-check"></i> Confirmer l'utilisation
                        </button>
                        <button type="button" class="btn-secondary close-modal">
                            Annuler
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
            modal.querySelector('#useReservationErrorText').textContent = 'Quantité invalide';
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
        showAlert('Erreur lors du chargement des projets', 'error');
    } finally {
        hideLoading();
    }
}

async function fetchArticles() {
    try {
        const { data, error } = await supabase
            .from('w_articles')
            .select('id, nom, numero, code_barre, prix_unitaire, stock_actuel')
            .order('nom');

        if (error) throw error;

        state.articles = data || [];
        populateArticleSelect();

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
        const { data, error } = await supabase
            .from('w_projets')
            .update({
                archived: true,
                archived_at: new Date().toISOString(),
                archived_by: state.user.id
            })
            .eq('id', projectId)
            .select()
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Erreur archivage projet:', error);
        throw error;
    }
}

async function unarchiveProject(projectId) {
    try {
        const { data, error } = await supabase
            .from('w_projets')
            .update({
                archived: false,
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
    endDate.setDate(now.getDate() + 30);

    const { data, error } = await supabase
        .from('w_reservations_actives')
        .insert([{
            article_id: reservationData.articleId,
            projet_id: reservationData.projectId,
            quantite: reservationData.quantity,

            date_debut: now.toISOString(),

            utilisateur_id: state.user.id,
            statut: 'active',

            created_at: now.toISOString(),   // 🔑 C’EST LUI
            updated_at: now.toISOString(),
            date_fin: endDate.toISOString(),

            notes: reservationData.comment,
            responsable: state.user.username
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function releaseReservation(reservationId, comment = '') {
    try {
        const { error } = await supabase
            .from('w_reservations_actives')
            .delete()
            .eq('id', reservationId);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error('Erreur libération réservation:', error);
        throw error;
    }
}

// ===== FONCTIONS SUPABASE =====
async function getProjectReservations(projectId) {
    try {
        const project = state.projects.find(p => p.id === projectId) ||
                       state.archivedProjects.find(p => p.id === projectId);

        if (!project) return { sorties: [], reservations: [] };

        console.log('Recherche pour projet:', project.nom);

        // 1. RÉCUPÉRER LES SORTIES (par projet_id)
        const { data: sorties, error: sortiesError } = await supabase
            .from('w_mouvements')
            .select(`
                *,
                article:article_id (nom, numero, code_barre, prix_unitaire),
                utilisateur:utilisateur_id (username)
            `)
            .eq('projet_id', projectId)  // Colonne projet_id
            .eq('type', 'sortie')
            .order('created_at', { ascending: false });

        if (sortiesError) {
            console.error('Erreur récupération sorties par ID:', sortiesError);
            // Essayer avec le nom
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
                console.error('Erreur récupération sorties par nom:', sortiesByNameError);
                throw sortiesByNameError;
            }

            return {
                sorties: sortiesByName || [],
                reservations: []
            };
        }

        // 2. RÉCUPÉRER LES RÉSERVATIONS (utilise created_at au lieu de date_reservation)
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
            .order('created_at', { ascending: false });  // CHANGÉ : date_reservation → created_at

        if (reservationsError) {
            console.error('Erreur récupération réservations:', reservationsError);
            throw reservationsError;
        }

        return {
            sorties: sorties || [],
            reservations: reservations || []
        };

    } catch (error) {
        console.error('Erreur chargement données projet:', error);
        return { sorties: [], reservations: [] };
    }
}

async function getProjectHistory(projectId) {
    try {
        const project = state.projects.find(p => p.id === projectId) ||
                       state.archivedProjects.find(p => p.id === projectId);

        if (!project) return [];

        // ESCAPER le nom du projet pour éviter les problèmes
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
        console.error('Erreur chargement historique projet:', error);
        return [];
    }
}

async function fetchMovements() {
    try {
        console.log('=== CHARGEMENT MOUVEMENTS ===');

        const { data, error } = await supabase
            .from('w_mouvements')
            .select('*')
            .or('type.eq.sortie,type.eq.retour_projet');

        if (error) {
            console.error('Erreur:', error);
            throw error;
        }

        console.log('Mouvements chargés:', data);
        console.log('=== FIN CHARGEMENT ===');

        state.movements = data || [];

    } catch (error) {
        console.error('Erreur chargement mouvements:', error);
        state.movements = [];
    }
}

// ===== MISE À JOUR DE L'AFFICHAGE =====
function updateStatistics() {
    // Compter les projets actifs
    elements.activeProjectsCount.textContent = state.projects.length;
    elements.archivedTabCount.textContent = state.archivedProjects.length;

    // Calculer le total des articles réservés
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

    // Compter les utilisateurs uniques avec des réservations
    const uniqueUsers = new Set(
        state.reservations.map(r => r.id_user).filter(Boolean)
    );
    elements.activeUsersCount.textContent = uniqueUsers.size;
}

function updateProjectsDisplay() {
    // Filtrer les projets
    let filteredProjects = [...state.projects];

    // Filtre par statut
    if (state.filters.status) {
        filteredProjects = filteredProjects.filter(project => {
            const status = getProjectStatus(project);
            return status === state.filters.status;
        });
    }

    // Filtre par responsable
    if (state.filters.manager) {
        filteredProjects = filteredProjects.filter(project =>
            project.responsable === state.filters.manager
        );
    }

    // Recherche texte
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

    // Trier
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
                <p>Aucun projet trouvé</p>
                <button id="createFirstProjectBtn" class="btn-primary">
                    <i class="fas fa-plus"></i> Créer un premier projet
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

        // DEBUG : Voir ce qui est dans state.movements
        console.log('=== DEBUG PROJET ===');
        console.log('Projet ID:', project.id);
        console.log('Projet Nom:', project.nom);
        console.log('Total mouvements dans state:', state.movements?.length || 0);
        console.log('Mouvements pour ce projet (ID):', state.movements?.filter(m => m.projet_id === project.id));
        console.log('Mouvements pour ce projet (Nom):', state.movements?.filter(m => m.projet === project.nom));

        // Filtrer les SORTIES pour ce projet (par ID OU par nom)
        const projectSorties = state.movements?.filter(m =>
            m.type === 'sortie' &&
            (m.projet_id === project.id || m.projet === project.nom)
        ) || [];

        console.log('Sorties trouvées:', projectSorties);

        // Calculer le total des articles sortis
        const itemsUsedCount = projectSorties.reduce((sum, m) => sum + (m.quantite || 0), 0);

        console.log('itemsUsedCount calculé:', itemsUsedCount);
        console.log('=== FIN DEBUG ===');
        const status = getProjectStatus(project);
        const daysLeft = calculateDaysLeft(project.date_fin_prevue);

        html += `
            <div class="project-card" data-id="${project.id}">
                <div class="project-card-header">
                    <div>
                        <div class="project-name">${project.nom}</div>
                        <div class="project-number">${project.numero || 'Sans numéro'}</div>
                    </div>

                </div>

                <div class="project-description">
                    ${project.description || 'Aucune description'}
                </div>

                <div class="project-meta">
                    <div class="project-meta-item">
                        <span class="project-meta-value">${itemsUsedCount}</span>
                        <span class="project-meta-label">Articles</span>
                    </div>
                    <div class="project-meta-item">
                        <span class="project-meta-value">${daysLeft}</span>
                        <span class="project-meta-label">Jours restants</span>
                    </div>
                    <div class="project-meta-item">
                        <span class="project-meta-value">${projectReservations.length}</span>
                        <span class="project-meta-label">Réservations</span>
                    </div>
                </div>

                <div class="project-info">
                    <div class="project-info-item">
                        <i class="fas fa-user-tie"></i>
                        <span>Responsable : ${project.responsable || 'Non défini'}</span>
                    </div>
                    <div class="project-info-item">
                        <i class="fas fa-calendar"></i>
                        <span>Créé le : ${formatDate(project.created_at)}</span>
                    </div>
                    ${project.date_fin_prevue ? `
                    <div class="project-info-item">
                        <i class="fas fa-calendar-check"></i>
                        <span>Fin prévue : ${formatDate(project.date_fin_prevue)}</span>
                    </div>
                    ` : ''}
                </div>

                <div class="project-actions">
                    <button class="btn-primary btn-small view-project-details" data-id="${project.id}">
                        <i class="fas fa-eye"></i> Détails
                    </button>
                    ${status === 'archived' ? `
                    <button class="btn-secondary btn-small unarchive-project" data-id="${project.id}">
                        <i class="fas fa-box-open"></i> Désarchiver
                    </button>
                    ` : `
                    <button class="btn-secondary btn-small archive-project" data-id="${project.id}">
                        <i class="fas fa-archive"></i> Archiver
                    </button>
                    `}
                </div>
            </div>
        `;
    });

    elements.projectsGrid.innerHTML = html;

    // Ajouter les événements
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
                <p>Aucun projet archivé</p>
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
                        <div class="project-number">${project.numero || 'Sans numéro'}</div>
                    </div>
                    <span class="project-status archived">
                        Archivé
                    </span>
                </div>

                <div class="project-description">
                    ${project.description || 'Aucune description'}
                </div>

                <div class="project-meta">
                    <div class="project-meta-item">
                        <span class="project-meta-value">${itemsCount}</span>
                        <span class="project-meta-label">Articles</span>
                    </div>
                    <div class="project-meta-item">
                        <span class="project-meta-value">${formatDate(project.archived_at)}</span>
                        <span class="project-meta-label">Archivé le</span>
                    </div>
                </div>

                <div class="project-info">
                    <div class="project-info-item">
                        <i class="fas fa-user-tie"></i>
                        <span>Responsable : ${project.responsable || 'Non défini'}</span>
                    </div>
                    <div class="project-info-item">
                        <i class="fas fa-calendar"></i>
                        <span>Créé le : ${formatDate(project.created_at)}</span>
                    </div>
                </div>

                <div class="project-actions">
                    <button class="btn-primary btn-small view-project-details" data-id="${project.id}">
                        <i class="fas fa-eye"></i> Détails
                    </button>
                    <button class="btn-secondary btn-small unarchive-project" data-id="${project.id}">
                        <i class="fas fa-box-open"></i> Désarchiver
                    </button>
                </div>
            </div>
        `;
    });

    elements.archivedProjectsGrid.innerHTML = html;
}

function populateManagerFilter() {
    const managers = [...new Set(state.projects.map(p => p.responsable).filter(Boolean))];

    let html = '<option value="">Tous les responsables</option>';
    managers.forEach(manager => {
        html += `<option value="${manager}">${manager}</option>`;
    });

    elements.filterManager.innerHTML = html;
    elements.filterManager.value = state.filters.manager;
}

function populateArticleSelect() {
    let html = '<option value="">Sélectionnez un article</option>';
    state.articles.forEach(article => {
        // Affiche seulement les articles avec stock > 0
        if ((article.stock_actuel || 0) > 0) {
            html += `<option value="${article.id}">${article.nom} (${article.code || article.numero}) - Stock: ${article.stock_actuel}</option>`;
        }
    });
    elements.reservationArticle.innerHTML = html;
}

// ===== GESTION DES MODALS =====
function showModal(modalElement) {
    console.log('showModal called:', {
        modalId: modalElement.id,
        currentModal: state.currentModal?.id,
        previousModal: state.previousModal?.id
    });

    // Sauvegarder le modal courant AVANT de le cacher
    if (state.currentModal && state.currentModal !== modalElement) {
        state.previousModal = state.currentModal;
    }

    hideModal(); // Cache le modal courant
    modalElement.style.display = 'flex';
    state.currentModal = modalElement;
}

function hideModal(returnToPrevious = false) {
    console.log('hideModal called:', {
        returnToPrevious,
        currentModal: state.currentModal?.id,
        previousModal: state.previousModal?.id,
        stateCurrentModal: state.currentModal,
        statePreviousModal: state.previousModal
    });

    if (state.currentModal) {
        state.currentModal.style.display = 'none';

        if (returnToPrevious && state.previousModal) {
            // Retour au modal précédent
            state.currentModal = state.previousModal;
            state.currentModal.style.display = 'flex';
            // Garder previousModal au cas où on veut revenir encore en arrière
        } else {
            // Fermeture normale : seulement si on ne retourne pas à un modal précédent
            state.currentModal = null;
            // NE PAS effacer previousModal ici non plus
            // Il sera écrasé quand un nouveau modal s'ouvrira
        }
    }
}

// ===== DÉTAILS DU PROJET =====
async function showProjectDetails(projectId) {
    try {
        showLoading();

        const project = [...state.projects, ...state.archivedProjects].find(p => p.id === projectId);
        if (!project) {
            showAlert('Projet non trouvé', 'error');
            return;
        }

        state.currentProject = project;

        // Récupérer les données du projet
        const projectData = await getProjectReservations(projectId);
        const projectHistory = await getProjectHistory(projectId);

        const sorties = projectData.sorties;
        const reservations = projectData.reservations;

        // Calculer les statistiques SÉPARÉES
        // 1. Articles SORTIS (déjà utilisés)
        const itemsSortis = sorties.reduce((sum, s) => sum + s.quantite, 0);
        const valeurSortis = sorties.reduce((sum, s) => {
            const article = s.article;
            if (article?.prix_unitaire) {
                return sum + (article.prix_unitaire * s.quantite);
            }
            return sum;
        }, 0);

        // 2. Articles RÉSERVÉS (pas encore utilisés)
        const itemsReserves = reservations.reduce((sum, r) => sum + r.quantite, 0);
        const valeurReserves = reservations.reduce((sum, r) => {
            const article = r.w_articles;
            if (article?.prix_unitaire) {
                return sum + (article.prix_unitaire * r.quantite);
            }
            return sum;
        }, 0);

        // 3. Totaux généraux
        const itemsTotaux = itemsSortis + itemsReserves;
        const valeurTotale = valeurSortis + valeurReserves;

        const daysLeft = calculateDaysLeft(project.date_fin_prevue);
        const status = getProjectStatus(project);

        // Mettre à jour l'en-tête avec les bonnes statistiques
        elements.projectDetailsName.textContent = project.nom;
        elements.projectDetailsNumber.textContent = project.numero || 'Sans numéro';
        elements.projectDetailsStatus.textContent = status === 'active' ? 'Actif' :
                                                  status === 'ending' ? 'Bientôt terminé' :
                                                  status === 'overdue' ? 'En retard' : 'Archivé';
        elements.projectDetailsStatus.className = `project-status ${status}`;

        // Afficher seulement les SORTIES dans le compteur principal (ce qui est facturé)
        document.getElementById('projectDetailsItemsUsed').textContent = itemsSortis;
        document.getElementById('projectDetailsValueUsed').textContent = `${valeurSortis.toFixed(2)} €`;
        document.getElementById('projectDetailsItemsReserved').textContent = itemsReserves;
        document.getElementById('projectDetailsValueReserved').textContent = `${valeurReserves.toFixed(2)} €`;
        elements.projectDetailsDaysLeft.textContent = daysLeft;

        // Mettre à jour les informations
        elements.projectDetailsDescription.textContent = project.description || 'Pas de description';
        elements.projectDetailsCreatedAt.textContent = formatDateTime(project.created_at);
        elements.projectDetailsEndDate.textContent = project.date_fin_prevue ? formatDate(project.date_fin_prevue) : 'Non définie';
        elements.projectDetailsUpdatedAt.textContent = project.updated_at ? formatDateTime(project.updated_at) : 'Jamais';
        elements.projectDetailsManager.textContent = project.responsable || 'Non défini';
        elements.projectDetailsBudget.textContent = project.budget ? `${project.budget} €` : 'Non défini';

        // Mettre à jour l'affichage des articles
        updateProjectReservations(sorties, reservations);
        elements.projectReservationsCount.textContent = sorties.length + reservations.length;

        // Mettre à jour l'historique
        updateProjectHistory(projectHistory);

        // Mettre à jour les infos supplémentaires (à ajouter dans votre HTML)
        updateReservationStats(itemsReserves, valeurReserves, itemsSortis, valeurSortis);

        // Configurer les boutons
        elements.archiveProjectBtn.style.display = project.archived ? 'none' : 'block';
        elements.archiveProjectBtn.textContent = project.archived ? 'Désarchiver' : 'Archiver';

        showModal(elements.projectDetailsModal);
        switchProjectTab('reservations');

    } catch (error) {
        console.error('Erreur affichage détails projet:', error);
        showAlert('Erreur lors du chargement des détails', 'error');
    } finally {
        hideLoading();
    }
}

// Fonction pour mettre à jour les statistiques supplémentaires
function updateReservationStats(itemsReserves, valeurReserves, itemsSortis, valeurSortis) {
    // Créer ou mettre à jour un élément HTML pour afficher les stats détaillées
    const statsContainer = document.getElementById('projectDetailsStats') ||
                          document.querySelector('.project-stats-container');

    if (!statsContainer) {
        // Si l'élément n'existe pas, le créer
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
                                <div class="stat-label">Articles utilisés</div>
                                <div class="stat-amount">${valeurSortis.toFixed(2)} €</div>
                            </div>
                        </div>
                        <div class="stat-card reservation">
                            <div class="stat-icon">
                                <i class="fas fa-clock"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value">${itemsReserves}</div>
                                <div class="stat-label">Articles réservés</div>
                                <div class="stat-amount">${valeurReserves.toFixed(2)} €</div>
                            </div>
                        </div>
                        <div class="stat-card total">
                            <div class="stat-icon">
                                <i class="fas fa-calculator"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value">${itemsSortis + itemsReserves}</div>
                                <div class="stat-label">Total articles</div>
                                <div class="stat-amount">${(valeurSortis + valeurReserves).toFixed(2)} €</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            detailsContent.insertAdjacentHTML('afterbegin', statsHtml);
        }
    } else {
        // Mettre à jour les valeurs
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

function updateProjectReservations(sorties, reservations) {
    const allItems = [...sorties, ...reservations];

    if (allItems.length === 0) {
        elements.projectReservationsBody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-row">
                    <i class="fas fa-info-circle"></i> Aucun article pour ce projet
                </td>
            </tr>
        `;
        return;
    }

    let html = '';

    // 1. AFFICHER LES SORTIES (déjà utilisées)
    if (sorties.length > 0) {
        html += `
            <tr>
                <td colspan="7" class="section-header">
                    <i class="fas fa-check-circle text-success"></i> Articles utilisés (sorties)
                </td>
            </tr>
        `;

        sorties.forEach(sortie => {
            const valeurTotale = sortie.article?.prix_unitaire ?
                (sortie.article.prix_unitaire * sortie.quantite).toFixed(2) : '0.00';

            html += `
                <tr data-id="${sortie.id}" class="sortie-row">
                    <td>
                        <div class="article-info">
                            <strong>${sortie.article?.nom || 'Article inconnu'}</strong>
                            <small>${sortie.article?.numero || ''}</small>
                        </div>
                    </td>
                    <td>${sortie.article?.numero || 'N/A'}</td>
                    <td>
                        <span class="quantity-badge sortie">
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
                                'Prix N/A'}
                            <small>Total: ${valeurTotale} €</small>
                        </div>
                    </td>
                    <td>
                        <div class="user-info">
                            ${sortie.utilisateur?.username || 'Utilisateur inconnu'}
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            ${state.movements?.some(m =>
                                m.type === 'retour_projet' &&
                                m.mouvement_parent_id === sortie.id  // CHANGÉ : lien direct vers la sortie
                            ) ? '' : `
                            <button class="btn-action btn-small return-to-stock"
                                    data-id="${sortie.id}"
                                    data-article-id="${sortie.article_id}"
                                    data-quantity="${sortie.quantite}"
                                    title="Retour au stock">
                                <i class="fas fa-arrow-left"></i>
                            </button>
                            `}
                            <button class="btn-action btn-small view-details"
                                    data-id="${sortie.id}"
                                    data-type="sortie"
                                    title="Voir les détails">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    // 2. AFFICHER LES RETOURS
    const retours = state.movements?.filter(m =>
        m.type === 'retour_projet' &&
        (m.projet_id === state.currentProject.id || m.projet === state.currentProject.nom)
    ) || [];

    if (retours.length > 0) {
        html += `
            <tr>
                <td colspan="7" class="section-header retour-header">
                    <i class="fas fa-check-circle text-success"></i> Articles retournés au stock
                </td>
            </tr>
        `;

        retours.forEach(retourItem => {
            const article = state.articles.find(a => a.id === retourItem.article_id) || {};
            const valeurTotale = article?.prix_unitaire ?
                (article.prix_unitaire * retourItem.quantite).toFixed(2) : '0.00';

            html += `
                <tr data-id="${retourItem.id}" class="returned-row">
                    <td>
                        <div class="article-info">
                            <strong>${article?.nom || 'Article inconnu'}</strong>
                            <small>${article?.numero || ''}</small>
                        </div>
                    </td>
                    <td>${article?.numero || 'N/A'}</td>
                    <td>
                        <span class="quantity-badge retour">
                            ${retourItem.quantite}
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
                                'Prix N/A'}
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
                            ${retourItem.utilisateur || 'Utilisateur inconnu'}
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-action btn-small view-details"
                                    data-id="${retourItem.id}"
                                    data-type="retour"
                                    title="Voir les détails">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    // 3. AFFICHER LES RÉSERVATIONS (pas encore utilisées)
    if (reservations.length > 0) {
        html += `
            <tr>
                <td colspan="7" class="section-header reservation-header">
                    <i class="fas fa-clock text-warning"></i> Articles réservés (non utilisés)
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
                            <strong>${article?.nom || 'Article inconnu'}</strong>
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
                            ${formatDate(reservation.date_reservation)}
                            <small>${formatDateTime(reservation.created_at).split(' ')[1] || ''}</small>
                        </div>
                    </td>
                    <td>
                        <div class="price-info">
                            ${article?.prix_unitaire ?
                                `${article.prix_unitaire.toFixed(2)} €` :
                                'Prix N/A'}
                            <small>Total: ${valeurTotale} €</small>
                            <br>
                            <span class="badge ${daysLeft <= 0 ? 'danger' : daysLeft <= 7 ? 'warning' : 'info'}">
                                ${formatDate(reservation.date_fin)}
                                ${daysLeft <= 0 ? ' (Expiré)' : daysLeft <= 7 ? ` (${daysLeft}j)` : ''}
                            </span>
                        </div>
                    </td>
                    <td>
                        <div class="user-info">
                            ${reservation.w_users?.username || 'Utilisateur inconnu'}
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-action btn-small use-reservation"
                                    data-id="${reservation.id}"
                                    data-article-id="${reservation.article_id || ''}"
                                    data-quantity="${reservation.quantite}"
                                    title="Marquer comme utilisé">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="btn-action btn-small view-details"
                                    data-id="${reservation.id}"
                                    data-type="reservation"
                                    title="Voir les détails">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-action btn-small release-reservation"
                                    data-id="${reservation.id}"
                                    title="Libérer la réservation">
                                <i class="fas fa-unlock"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    elements.projectReservationsBody.innerHTML = html;

    // Événement pour le bouton "Retour au stock"
    document.querySelectorAll('.return-to-stock').forEach(btn => {
        btn.addEventListener('click', function() {
            console.log('=== CLICK RETOUR STOCK ===');
            console.log('Bouton cliqué:', this);
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

    // Ajouter les événements pour les boutons
    document.querySelectorAll('.view-details').forEach(btn => {
        btn.addEventListener('click', function() {
            const itemId = this.dataset.id;
            const itemType = this.dataset.type;
            showItemDetails(itemId, itemType, sorties, reservations);
        });
    });

    document.querySelectorAll('.release-reservation').forEach(btn => {
        btn.addEventListener('click', async function() {
            const reservationId = this.dataset.id;
            const reservation = reservations.find(r => r.id === reservationId);

            if (reservation) {
                const article = reservation.w_articles;
                const articleName = article?.nom || 'Article inconnu';

                if (confirm(`Libérer la réservation de ${reservation.quantite} ${articleName} ?`)) {
                    try {
                        showLoading();

                        const { error } = await supabase
                            .from('w_reservations_actives')
                            .delete()
                            .eq('id', reservationId);

                        if (error) throw error;

                        showAlert('Réservation libérée avec succès', 'success');

                        // Recharger les détails du projet
                        await showProjectDetails(state.currentProject.id);

                    } catch (error) {
                        console.error('Erreur libération réservation:', error);
                        showAlert('Erreur lors de la libération de la réservation', 'error');
                    } finally {
                        hideLoading();
                    }
                }
            }
        });
    });

    // Événement pour le bouton "Utiliser"
    document.querySelectorAll('.use-reservation').forEach(btn => {
        btn.addEventListener('click', function() {
            const reservationId = this.dataset.id;
            const articleId = this.dataset.articleId;
            const quantity = parseInt(this.dataset.quantity);
            showUseReservationModal(reservationId, articleId, quantity);
        });
    });
}

// Fonction pour afficher les détails d'un item
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
                    <h3><i class="fas fa-info-circle"></i> Détails</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="detail-section">
                        <h4><i class="fas fa-box"></i> Article</h4>
                        <div class="detail-item">
                            <span class="detail-label">Nom :</span>
                            <span class="detail-value">${article?.nom || 'Non spécifié'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Numéro :</span>
                            <span class="detail-value">${article?.numero || 'Non spécifié'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Code-barre :</span>
                            <span class="detail-value">${article?.code_barre || 'Non spécifié'}</span>
                        </div>
                    </div>

                    <div class="detail-section">
                        <h4><i class="fas ${isSortie ? 'fa-check-circle' : 'fa-clock'}"></i> ${isSortie ? 'Sortie' : 'Réservation'}</h4>
                        <div class="detail-item">
                            <span class="detail-label">Type :</span>
                            <span class="detail-value badge ${isSortie ? 'sortie' : 'reservation'}">
                                ${isSortie ? 'Sortie effectuée' : 'Réservation active'}
                            </span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Quantité :</span>
                            <span class="detail-value">${isSortie ? '-' : ''}${item.quantite}</span>
                        </div>
                        ${article?.prix_unitaire ? `
                        <div class="detail-item">
                            <span class="detail-label">Prix unitaire :</span>
                            <span class="detail-value">${article.prix_unitaire.toFixed(2)} €</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Valeur totale :</span>
                            <span class="detail-value" style="font-weight: bold;">
                                ${(article.prix_unitaire * item.quantite).toFixed(2)} €
                            </span>
                        </div>
                        ` : ''}
                        <div class="detail-item">
                            <span class="detail-label">Date :</span>
                            <span class="detail-value">${formatDateTime(item.created_at)}</span>
                        </div>
                        ${!isSortie ? `
                        <div class="detail-item">
                            <span class="detail-label">Date de fin :</span>
                            <span class="detail-value">${formatDate(item.date_fin)}</span>
                        </div>
                        ` : ''}
                    </div>

                    <div class="detail-section">
                        <h4><i class="fas fa-user"></i> Responsable</h4>
                        <div class="detail-item">
                            <span class="detail-label">Utilisateur :</span>
                            <span class="detail-value">${user?.username || 'Non spécifié'}</span>
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
                        <h4><i class="fas fa-comment"></i> Commentaire</h4>
                        <div class="detail-comment">
                            ${item.commentaire}
                        </div>
                    </div>
                    ` : ''}

                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary close-details-modal">
                            Fermer
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

    // Gérer la fermeture
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
    console.log('=== OPEN RETURN MODAL ===');
    console.log('mouvementId:', mouvementId);
    console.log('articleId:', articleId);
    console.log('originalQuantity:', originalQuantity);

    state.previousModal = state.currentModal;

    try {
        console.log('=== DÉBUT TRY OPEN RETURN MODAL ===');
        console.log('Current user:', state.user);
        console.log('=== REQUÊTE ARTICLE ===');
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

        console.log('Résultat requête:', { article, articleError });

        if (articleError) {
            console.error('Erreur requête article:', articleError);
            throw articleError;
        }

        console.log('Article trouvé:', article);
        console.log('=== FIN REQUÊTE ===');

        // Créer le modal
        const modalHTML = `
            <div class="modal-overlay return-stock-modal">
                <div class="modal" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-arrow-left"></i> Retour au stock</h3>
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
                                                          // Retour à la position originale
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
                                                          // Sauvegarder la position originale
                                                          const rect = img.getBoundingClientRect();
                                                          img.dataset.originalTop = rect.top + 'px';
                                                          img.dataset.originalLeft = rect.left + 'px';

                                                          // Agrandir en plein écran
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
                                    <p>Sorti : ${originalQuantity} unité(s)</p>
                                </div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label><i class="fas fa-boxes"></i> Quantité retournée *</label>
                            <input type="number"
                                   id="returnQuantity"
                                   value="${originalQuantity}"
                                   min="0"
                                   max="${originalQuantity}"
                                   class="form-input">
                        </div>

                        <div id="missingQuantitySection" style="display: none;">
                            <div class="form-group">
                                <label><i class="fas fa-exclamation-triangle"></i> Raison de la différence</label>
                                <select id="missingReason" class="form-select" required>
                                    <option value="">Sélectionner une raison...</option>
                                    <option value="perdu">Perdu(s)</option>
                                    <option value="cassé">Cassé(s)</option>
                                    <option value="vole">Volé(s)</option>
                                    <option value="fin_vie">Fin de vie utile</option>
                                </select>
                                <div class="form-error" id="missingReasonError" style="color: #dc3545; font-size: 0.85em; display: none;">
                                    <i class="fas fa-exclamation-circle"></i> Ce champ est obligatoire
                                </div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label><i class="fas fa-map-marker-alt"></i> Emplacement de rangement</label>
                            <div class="location-display" style="background: #f8f9fa; padding: 10px; border-radius: 4px; border-left: 3px solid #28a745;">
                                <div><strong>Rayon:</strong> ${article.rack?.display_name || article.rack?.rack_code || 'Non spécifié'}</div>
                                <div><strong>Étage:</strong> ${article.level?.level_code || 'Non spécifié'}</div>
                                <div><strong>Position:</strong> ${article.slot?.slot_code || 'Non spécifié'}</div>
                            </div>
                            <small><i class="fas fa-info-circle"></i> Rangez l'article à cet emplacement</small>
                        </div>

                        <div class="form-group">
                            <label><i class="fas fa-clipboard-check"></i> État des articles</label>
                            <select id="itemCondition" class="form-select">
                                <option value="parfait">Condition 1 Parfait état</option>
                                <option value="raye">Condition 2 Usé / Réparé</option>
                                <option value="reparation">Condition 3 A réparer</option>
                                <option value="casse">Condition 4 A remplacer</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label><i class="fas fa-comment"></i> Commentaire</label>
                            <textarea id="returnComment"
                                      rows="3"
                                      placeholder="Détails du retour..."
                                      class="form-textarea"></textarea>
                        </div>

                        <div class="error-message" id="returnError" style="display: none;">
                            <i class="fas fa-exclamation-circle"></i>
                            <span id="returnErrorText"></span>
                        </div>

                        <div class="modal-actions">
                            <button id="confirmReturnBtn" class="btn-success">
                                <i class="fas fa-check"></i> Confirmer le retour
                            </button>
                            <button type="button" class="btn-secondary cancel-edit-btn">
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;


        console.log('=== CRÉATION MODAL HTML ===');
        console.log('Modal HTML créé, longueur:', modalHTML.length);
        console.log('État de state.currentProject:', state.currentProject);

        // Ajouter le modal au DOM
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        console.log('Modal container créé:', modalContainer);
        document.body.appendChild(modalContainer);

        const modal = modalContainer.querySelector('.return-stock-modal');
        console.log('Modal trouvé dans DOM:', modal);
        console.log('Modal style:', modal?.style);

        modal.style.display = 'flex';
        console.log('Modal style après display:', modal.style.display);

        // Gérer la fermeture
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.remove();
        });

        modal.querySelector('.cancel-edit-btn').addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Gérer l'affichage de la section "raison de la différence"
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


        // Gérer la confirmation du retour
        modal.querySelector('#confirmReturnBtn').addEventListener('click', async () => {
            await processReturnToStock(mouvementId, articleId, originalQuantity, modalContainer);
        });

    } catch (error) {
        console.error('=== ERREUR OPEN RETURN MODAL ===');
        console.error('Erreur complète:', error);
        console.error('Stack:', error.stack);
        console.error('=== FIN ERREUR ===');
        showAlert('Erreur lors de l\'ouverture du formulaire de retour', 'error');
    }
}

async function processReturnToStock(mouvementId, articleId, originalQuantity, modalElement) {
    try {
        const modal = modalElement;
        const returnQuantity = parseInt(modal.querySelector('#returnQuantity').value);
        const returnLocation = "Emplacement d'origine selon fiche article";
        const itemCondition = modal.querySelector('#itemCondition').value;
        const returnComment = modal.querySelector('#returnComment').value.trim();
        const missingReason = modal.querySelector('#missingReason')?.value || '';
        const missingQuantity = originalQuantity - returnQuantity;

        // Validation de la raison si quantité manquante
        if (missingQuantity > 0 && !missingReason) {
            modal.querySelector('#returnErrorText').textContent = 'Veuillez indiquer la raison de la quantité manquante';
            modal.querySelector('#returnError').style.display = 'flex';
            return;
        }

        // Validation
        if (!returnQuantity || returnQuantity < 0) {
            modal.querySelector('#returnErrorText').textContent = 'La quantité retournée est invalide';
            modal.querySelector('#returnError').style.display = 'flex';
            return;
        }

        // Demander confirmation
        if (!confirm(`Confirmer le retour de ${returnQuantity} unité(s) au stock ?`)) {
            return;
        }

        showLoading();

        // 1. RÉCUPÉRER LE STOCK ACTUEL
        const { data: currentArticle, error: articleError } = await supabase
            .from('w_articles')
            .select('stock_actuel')
            .eq('id', articleId)
            .single();

        if (articleError) throw articleError;

        // 2. CRÉER LE MOUVEMENT DE RETOUR
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
                motif: `Retour projet - État: ${itemCondition}`,
                notes: `Emplacement: ${returnLocation} | État: ${itemCondition}`,
                date_mouvement: new Date().toISOString().split('T')[0],
                heure_mouvement: new Date().toLocaleTimeString('fr-FR', { hour12: false }),
                raison: missingReason && missingQuantity > 0 ?
                    `${missingQuantity} ${missingReason}` : null,
                mouvement_parent_id: mouvementId  // AJOUTÉ ICI
            }])
            .select()
            .single();

        if (movementError) throw movementError;

        console.log('=== DEBUG RETOUR STOCK ===');
        console.log('Mouvement retour créé:', returnMovement);
        console.log('Projet courant ID:', state.currentProject?.id);
        console.log('Projet courant nom:', state.currentProject?.nom);
        console.log('Article ID:', articleId);
        console.log('=== FIN DEBUG ===');

        // 3. METTRE À JOUR LE STOCK DE L'ARTICLE
        const { error: updateError } = await supabase
            .from('w_articles')
            .update({
                stock_actuel: currentArticle.stock_actuel + returnQuantity,
                updated_at: new Date().toISOString()
            })
            .eq('id', articleId);

        if (updateError) throw updateError;

        // 4. METTRE À JOUR LES DONNÉES LOCALES
        // Recharger les mouvements
        await fetchMovements();

        // Recharger les articles
        await fetchArticles();

        // 5. FERMER LE MODAL ET AFFICHER SUCCÈS
        modal.remove();
        showAlert(`${returnQuantity} unité(s) retournée(s) au stock avec succès`, 'success');

        // 6. RE-OUVRIR LES DÉTAILS DU PROJET SI NÉCESSAIRE
        if (state.currentProject && elements.projectDetailsModal.style.display === 'flex') {
            await showProjectDetails(state.currentProject.id);
        }

    } catch (error) {
        console.error('Erreur retour au stock:', error);
        modalElement.querySelector('#returnErrorText').textContent = error.message || 'Erreur lors du retour au stock';
        modalElement.querySelector('#returnError').style.display = 'flex';
    } finally {
        hideLoading();
    }
}

// Fonction helper pour éditer une réservation
async function editReservation(reservationId) {
    try {
        // Récupérer la réservation
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
            showAlert('Réservation non trouvée', 'error');
            return;
        }

        // Créer un modal d'édition
        const modalHtml = `
            <div class="modal-overlay" id="editReservationModal" style="display: flex;">
                <div class="modal">
                    <div class="modal-header">
                        <h3><i class="fas fa-edit"></i> Modifier la réservation</h3>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Article :</label>
                            <input type="text"
                                   value="${reservation.w_articles?.nom || ''}"
                                   class="form-input"
                                   disabled>
                        </div>

                        <div class="form-group">
                            <label for="editQuantity">
                                <i class="fas fa-boxes"></i> Quantité *
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
                                <i class="fas fa-calendar"></i> Date de fin *
                            </label>
                            <input type="date"
                                   id="editDateFin"
                                   value="${reservation.date_fin.split('T')[0]}"
                                   class="form-input"
                                   required>
                        </div>

                        <div class="form-group">
                            <label for="editComment">
                                <i class="fas fa-comment"></i> Commentaire
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
                                <i class="fas fa-save"></i> Enregistrer
                            </button>
                            <button type="button" class="btn-secondary cancel-edit-btn">
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Ajouter le modal au DOM
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer);

        const modal = document.getElementById('editReservationModal');

        // Gérer la fermeture
        modal.querySelector('.cancel-edit-btn').addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Gérer les boutons de quantité
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

        // Gérer l'enregistrement
        modal.querySelector('#confirmEditReservationBtn').addEventListener('click', async () => {
            const quantity = parseInt(modal.querySelector('#editQuantity').value);
            const dateFin = modal.querySelector('#editDateFin').value;
            const comment = modal.querySelector('#editComment').value.trim();

            // Validation
            if (!quantity || quantity < 1) {
                modal.querySelector('#editReservationErrorText').textContent = 'La quantité doit être au moins de 1';
                modal.querySelector('#editReservationError').style.display = 'flex';
                return;
            }

            if (!dateFin) {
                modal.querySelector('#editReservationErrorText').textContent = 'La date de fin est obligatoire';
                modal.querySelector('#editReservationError').style.display = 'flex';
                return;
            }

            try {
                showLoading();

                // Mettre à jour la réservation
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

                showAlert('Réservation modifiée avec succès', 'success');

                // Recharger les données
                await fetchReservations();

                // Recharger les détails du projet si ouvert
                if (state.currentProject) {
                    await showProjectDetails(state.currentProject.id);
                }

                // Fermer le modal
                modal.remove();

            } catch (error) {
                console.error('Erreur modification réservation:', error);
                modal.querySelector('#editReservationErrorText').textContent = error.message || 'Erreur lors de la modification';
                modal.querySelector('#editReservationError').style.display = 'flex';
            } finally {
                hideLoading();
            }
        });

    } catch (error) {
        console.error('Erreur préparation édition réservation:', error);
        showAlert('Erreur lors de la préparation de l\'édition', 'error');
    }
}

function updateProjectHistory(historyItems) {
    if (historyItems.length === 0) {
        elements.projectHistoryList.innerHTML = `
            <div class="empty-history">
                <i class="fas fa-history"></i>
                <p>Aucun historique disponible</p>
            </div>
        `;
        return;
    }

    let html = '';
    historyItems.forEach(item => {
        // Déterminer l'icône et le type d'action
        let icon = 'history';
        let actionType = 'Action';
        let details = '';
        const articleName = item.article?.nom || 'Article';
        const articleNum = item.article?.numero ? ` (${item.article.numero})` : '';

        if (item.type === 'sortie') {
            icon = 'arrow-up';
            actionType = 'Sortie de stock';
            details = `${item.quantite} × ${articleName}${articleNum} | Projet: ${item.projet || 'N/A'}`;
        } else if (item.type === 'retour_projet') {
            icon = 'arrow-left';
            actionType = 'Retour au stock';
            details = `${item.quantite} × ${articleName}${articleNum} retourné(s)`;
            if (item.raison) {
                details += ` | ${item.raison}`;
            }
        } else if (item.type === 'entree') {
            icon = 'arrow-down';
            actionType = 'Entrée de stock';
            details = `${item.quantite} × ${articleName}${articleNum} | ${item.fournisseur || 'Stock initial'}`;
        } else if (item.type === 'reservation') {
            icon = 'clock';
            actionType = 'Réservation';
            details = `${item.quantite} × ${articleName}${articleNum} réservé(s)`;
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
                        <span class="history-user"><i class="fas fa-user"></i> ${item.utilisateur || 'Système'}</span>
                    </div>
                </div>
            </div>
        `;
    });

    elements.projectHistoryList.innerHTML = html;
}

// ===== GESTION DES ONGLETS =====
function switchTab(tabName) {
    state.currentTab = tabName;

    // Mettre à jour les boutons d'onglets
    elements.tabBtns.forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Mettre à jour les contenus d'onglets
    elements.tabContents.forEach(content => {
        if (content.id === tabName + 'Tab') {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });

    // Charger les statistiques si onglet analytics
    if (tabName === 'analytics') {
        loadAnalytics();
    }
}

function switchProjectTab(tabName) {
    // Mettre à jour les boutons d'onglets du projet
    elements.projectTabBtns.forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Mettre à jour les contenus d'onglets du projet
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

// ===== GESTION DES FILTRES =====
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

// ===== CRÉATION DE PROJET =====
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

        // Validation
        if (!projectData.nom || !projectData.numero || !projectData.responsable) {
            elements.projectErrorText.textContent = 'Veuillez remplir tous les champs obligatoires';
            elements.projectError.style.display = 'flex';
            return;
        }

        // Vérifier si le numéro existe déjà
        const existingProject = state.projects.find(p => p.numero === projectData.numero);
        if (existingProject) {
            elements.projectErrorText.textContent = 'Ce numéro de projet existe déjà';
            elements.projectError.style.display = 'flex';
            return;
        }

        showLoading();
        const newProject = await createProject(projectData);

        // Ajouter aux projets
        state.projects.unshift(newProject);

        // Mettre à jour l'affichage
        updateProjectsDisplay();
        updateStatistics();
        populateManagerFilter();

        // Fermer le modal et réinitialiser le formulaire
        hideModal();
        elements.newProjectForm.reset();
        elements.projectError.style.display = 'none';

        showAlert('Projet créé avec succès', 'success');

    } catch (error) {
        console.error('Erreur création projet:', error);
        elements.projectErrorText.textContent = error.message || 'Erreur lors de la création du projet';
        elements.projectError.style.display = 'flex';
    } finally {
        hideLoading();
    }
}

// ===== ARCHIVAGE/DÉSARCHIVAGE =====
async function archiveProjectAction(projectId) {
    if (!confirm('Archiver ce projet ? Le projet n\'apparaîtra plus dans les projets actifs.')) {
        return;
    }

    try {
        showLoading();
        const archivedProject = await archiveProject(projectId);

        // Mettre à jour les listes
        const index = state.projects.findIndex(p => p.id === projectId);
        if (index !== -1) {
            state.projects.splice(index, 1);
            state.archivedProjects.unshift(archivedProject);
        }

        // Mettre à jour l'affichage
        updateProjectsDisplay();
        updateArchivedProjectsDisplay();
        updateStatistics();

        // Si on est dans les détails, fermer le modal
        if (state.currentProject?.id === projectId) {
            hideModal();
        }

        showAlert('Projet archivé avec succès', 'success');

    } catch (error) {
        console.error('Erreur archivage projet:', error);
        showAlert('Erreur lors de l\'archivage du projet', 'error');
    } finally {
        hideLoading();
    }
}

async function unarchiveProjectAction(projectId) {
    if (!confirm('Désarchiver ce projet ? Le projet réapparaîtra dans les projets actifs.')) {
        return;
    }

    try {
        showLoading();
        const unarchivedProject = await unarchiveProject(projectId);

        // Mettre à jour les listes
        const index = state.archivedProjects.findIndex(p => p.id === projectId);
        if (index !== -1) {
            state.archivedProjects.splice(index, 1);
            state.projects.unshift(unarchivedProject);
        }

        // Mettre à jour l'affichage
        updateProjectsDisplay();
        updateArchivedProjectsDisplay();
        updateStatistics();

        showAlert('Projet désarchivé avec succès', 'success');

    } catch (error) {
        console.error('Erreur désarchivage projet:', error);
        showAlert('Erreur lors du désarchivage du projet', 'error');
    } finally {
        hideLoading();
    }
}

// ===== GESTION DES RÉSERVATIONS =====
async function addReservationToProject() {
    if (!state.currentProject) return;

    // Réinitialiser le modal
    elements.reservationArticle.value = '';
    elements.reservationQuantity.value = '1';
    elements.reservationComment.value = '';
    elements.reservationError.style.display = 'none';
    elements.reservationAvailableStock.textContent = '0';
    elements.reservationAlreadyReserved.textContent = '0';

    // Stocker le modal précédent avant d'ouvrir le nouveau
    console.log('addReservationToProject - Setting previousModal:', {
        before: state.previousModal?.id,
        currentModal: state.currentModal?.id
    });
    state.previousModal = state.currentModal;

    showModal(elements.addReservationModal);

    showModal(elements.addReservationModal);
}

async function updateReservationStockInfo(articleId) {
    if (!articleId || !state.currentProject) return;

    try {
        // Récupérer le stock total disponible
        const article = state.articles.find(a => a.id === articleId);
        if (article) {
            elements.reservationAvailableStock.textContent = article.stock_actuel || 0;
        }

        // Récupérer le nombre déjà réservé pour ce projet
        const projectReservations = state.reservations.filter(r =>
            r.id_projet === state.currentProject.id && r.id_article === articleId
        );
        const alreadyReserved = projectReservations.reduce((sum, r) => sum + r.quantite, 0);
        elements.reservationAlreadyReserved.textContent = alreadyReserved;

        // Mettre à jour la quantité max
        const availableStock = article?.quantite_disponible || 0;
        const currentQuantity = parseInt(elements.reservationQuantity.value) || 1;

        if (currentQuantity > availableStock) {
            elements.reservationQuantity.value = Math.max(1, availableStock);
        }

    } catch (error) {
        console.error('Erreur mise à jour info stock:', error);
    }
}

async function confirmAddReservation() {
    try {
        const articleId = elements.reservationArticle.value;
        const quantity = parseInt(elements.reservationQuantity.value);
        const comment = elements.reservationComment.value.trim();

        // Validation
        if (!articleId) {
            elements.reservationErrorText.textContent = 'Veuillez sélectionner un article';
            elements.reservationError.style.display = 'flex';
            return;
        }

        if (!quantity || quantity < 1) {
            elements.reservationErrorText.textContent = 'La quantité doit être au moins de 1';
            elements.reservationError.style.display = 'flex';
            return;
        }

        // Vérifier le stock disponible
        const article = state.articles.find(a => a.id === articleId);
        if (!article) {
            elements.reservationErrorText.textContent = 'Article non trouvé';
            elements.reservationError.style.display = 'flex';
            return;
        }

        if ((article.stock_actuel || 0) < quantity) {
            elements.reservationErrorText.textContent = `Stock insuffisant. Disponible: ${article.stock_actuel || 0}`;
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

        // Ajouter à la liste des réservations
        state.reservations.push(newReservation);

        // Recharger les détails du projet
        await showProjectDetails(state.currentProject.id);

        // Mettre à jour les statistiques
        updateStatistics();

        // Fermer le modal
        hideModal();

        showAlert('Réservation ajoutée avec succès', 'success');

    } catch (error) {
        console.error('Erreur ajout réservation:', error);
        elements.reservationErrorText.textContent = error.message || 'Erreur lors de l\'ajout de la réservation';
        elements.reservationError.style.display = 'flex';
    } finally {
        hideLoading();
    }
}

async function releaseAllProjectItems() {
    if (!state.currentProject) return;

    // Récupérer les réservations du projet
    const projectReservations = state.reservations.filter(r => r.id_projet === state.currentProject.id);

    if (projectReservations.length === 0) {
        showAlert('Aucune réservation à libérer pour ce projet', 'info');
        return;
    }

    // Mettre à jour le compteur dans le modal
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
            elements.releaseErrorText.textContent = 'Veuillez sélectionner une raison';
            elements.releaseError.style.display = 'flex';
            return;
        }

        if (!confirm(`Êtes-vous sûr de vouloir libérer toutes les réservations de ce projet ? (${elements.releaseItemsCount.textContent} réservation(s))`)) {
            return;
        }

        showLoading();

        // Récupérer les réservations du projet
        const projectReservations = state.reservations.filter(r => r.id_projet === state.currentProject.id);

        // Libérer chaque réservation
        for (const reservation of projectReservations) {
            try {
                await releaseReservation(reservation.id, `Libération globale: ${reason} - ${comment}`);
            } catch (error) {
                console.error(`Erreur libération réservation ${reservation.id}:`, error);
            }
        }

        // Mettre à jour les données
        await fetchReservations();

        // Recharger les détails du projet
        await showProjectDetails(state.currentProject.id);

        // Mettre à jour les statistiques
        updateStatistics();

        // Fermer le modal
        hideModal();

        showAlert('Toutes les réservations ont été libérées', 'success');

    } catch (error) {
        console.error('Erreur libération globale:', error);
        elements.releaseErrorText.textContent = error.message || 'Erreur lors de la libération du stock';
        elements.releaseError.style.display = 'flex';
    } finally {
        hideLoading();
    }
}

// ===== STATISTIQUES ET GRAPHIQUES =====
function loadAnalytics() {
    // Mettre à jour les listes
    updateTopManagers();
    updateTopArticles();

    // Créer les graphiques si nécessaire
    if (!state.charts.reservationsChart) {
        createReservationsChart();
    }
    if (!state.charts.statusChart) {
        createStatusChart();
    }

    // Mettre à jour les graphiques
    updateCharts();
}

function createReservationsChart() {
    const ctx = elements.reservationsChart.getContext('2d');
    state.charts.reservationsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Nouvelles réservations',
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
            labels: ['Actifs', 'Bientôt terminé', 'En retard', 'Archivés'],
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

    // Mettre à jour le graphique de statut
    const activeCount = state.projects.filter(p => getProjectStatus(p) === 'active').length;
    const endingCount = state.projects.filter(p => getProjectStatus(p) === 'ending').length;
    const overdueCount = state.projects.filter(p => getProjectStatus(p) === 'overdue').length;
    const archivedCount = state.archivedProjects.length;

    state.charts.statusChart.data.datasets[0].data = [activeCount, endingCount, overdueCount, archivedCount];
    state.charts.statusChart.update();

    // Mettre à jour le graphique des réservations (données factices pour l'exemple)
    const period = parseInt(elements.analyticsPeriod.value) || 30;
    const labels = [];
    const data = [];

    // Générer des données pour les X derniers jours
    for (let i = period; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));

        // Données factices - à remplacer par des données réelles
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

            // Compter les articles du projet
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
        html = '<div class="empty-list">Aucun responsable</div>';
    } else {
        sortedManagers.forEach(([manager, stats], index) => {
            html += `
                <div class="top-item ${index < 3 ? 'top' : ''}">
                    <div class="top-item-header">
                        <span class="top-item-rank">#${index + 1}</span>
                        <span class="top-item-name">${manager}</span>
                    </div>
                    <div class="top-item-stats">
                        <span class="stat"><i class="fas fa-project-diagram"></i> ${stats.count} projet(s)</span>
                        <span class="stat"><i class="fas fa-box"></i> ${stats.items} article(s)</span>
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
        html = '<div class="empty-list">Aucune réservation</div>';
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
                        <span class="stat"><i class="fas fa-box"></i> ${article.quantity} unité(s)</span>
                        <span class="stat"><i class="fas fa-sync-alt"></i> ${article.count} réservation(s)</span>
                    </div>
                </div>
            `;
        });
    }

    elements.topArticlesList.innerHTML = html;
}

// ===== ÉVÉNEMENTS =====
function setupEventListeners() {
    // Déconnexion
    elements.logoutBtn.addEventListener('click', logout);

    // Onglets principaux
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchTab(tab);
        });
    });

    // Onglets détails projet
    elements.projectTabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchProjectTab(tab);
        });
    });

    // Fermeture des modals avec event delegation
    document.addEventListener('click', function(e) {
        const closeBtn = e.target.closest('.close-modal');
        if (!closeBtn) return;

        e.preventDefault();
        e.stopPropagation(); // ← IMPORTANT : empêche d'autres gestionnaires

        console.log('Close button clicked:', {
            currentModal: state.currentModal?.id,
            previousModal: state.previousModal?.id
        });

        // Si on est dans un modal enfant et qu'il y a un modal précédent
        if (state.currentModal && state.previousModal) {
            console.log('Returning to previous modal');
            hideModal(true);
        } else {
            console.log('Normal close');
            hideModal();
        }
    });

    // Clic en dehors des modals pour fermer
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', function(e) {
            if (e.target === this) {
                hideModal();
            }
        });
    });

    // Boutons header
    elements.newProjectBtn.addEventListener('click', () => {
        showModal(elements.newProjectModal);
    });

    elements.showArchivedBtn.addEventListener('click', () => {
        switchTab('archived');
    });

    elements.exportProjectsBtn.addEventListener('click', exportProjects);

    // Filtres
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

    // Formulaire nouveau projet
    elements.newProjectForm.addEventListener('submit', function(e) {
        e.preventDefault();
        createProjectAction();
    });

    // Boutons détails projet
    elements.addReservationToProjectBtn.addEventListener('click', addReservationToProject);
    elements.releaseAllProjectItemsBtn.addEventListener('click', releaseAllProjectItems);
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

    // Modal réservation
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

    // Event delegation pour les boutons + et - du modal Réservation
    document.addEventListener('click', function(e) {
        // Bouton -
        if (e.target.closest('#reservationQuantityMinus') ||
            e.target.id === 'reservationQuantityMinus') {
            const input = document.getElementById('reservationQuantity');
            let value = parseInt(input.value) || 1;
            if (value > 1) {
                input.value = value - 1;
            }
        }

        // Bouton +
        if (e.target.closest('#reservationQuantityPlus') ||
            e.target.id === 'reservationQuantityPlus') {
            const input = document.getElementById('reservationQuantity');
            let value = parseInt(input.value) || 1;
            const articleId = document.getElementById('reservationArticle')?.value;

            if (articleId) {
                const article = state.articles.find(a => a.id === articleId);
                const maxQuantity = article?.stock_actuel || 0; // ← Utilisez stock_actuel

                if (value < maxQuantity) {
                    input.value = value + 1;
                }
            } else {
                input.value = value + 1;
            }
        }
    });

    elements.confirmAddReservationBtn.addEventListener('click', confirmAddReservation);

    // Modal libération stock
    elements.confirmReleaseBtn.addEventListener('click', confirmReleaseAll);

    // Période statistiques
    elements.analyticsPeriod.addEventListener('change', updateCharts);

    // Échappement pour fermer les modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && state.currentModal) {
            hideModal();
        }
    });
}

// ===== FONCTIONS D'EXPORT =====
async function exportProjects() {
    try {
        showLoading();

        // Préparer les données
        let data = [];

        if (state.currentTab === 'projects') {
            data = state.projects.map(project => {
                const projectReservations = state.reservations.filter(r => r.id_projet === project.id);
                const itemsCount = projectReservations.reduce((sum, r) => sum + r.quantite, 0);
                const status = getProjectStatus(project);

                return {
                    'Nom': project.nom,
                    'Numéro': project.numero || '',
                    'Description': project.description || '',
                    'Responsable': project.responsable || '',
                    'Date création': formatDate(project.created_at),
                    'Date fin prévue': project.date_fin_prevue ? formatDate(project.date_fin_prevue) : '',
                    'Budget': project.budget || '',

                    'Articles réservés': itemsCount,
                    'Nombre réservations': projectReservations.length
                };
            });
        } else if (state.currentTab === 'archived') {
            data = state.archivedProjects.map(project => {
                const projectReservations = state.reservations.filter(r => r.id_projet === project.id);
                const itemsCount = projectReservations.reduce((sum, r) => sum + r.quantite, 0);

                return {
                    'Nom': project.nom,
                    'Numéro': project.numero || '',
                    'Description': project.description || '',
                    'Responsable': project.responsable || '',
                    'Date création': formatDate(project.created_at),
                    'Date archivage': project.archived_at ? formatDate(project.archived_at) : '',
                    'Budget': project.budget || '',
                    'Articles réservés': itemsCount,
                    'Nombre réservations': projectReservations.length
                };
            });
        }

        // Convertir en CSV
        const headers = Object.keys(data[0] || {});
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => {
                const cell = row[header] || '';
                return `"${cell.toString().replace(/"/g, '""')}"`;
            }).join(','))
        ].join('\n');

        // Télécharger
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `projets_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showAlert('Export réalisé avec succès', 'success');

    } catch (error) {
        console.error('Erreur export:', error);
        showAlert('Erreur lors de l\'export', 'error');
    } finally {
        hideLoading();
    }
}

async function exportProjectDetails() {
    if (!state.currentProject) return;

    try {
        showLoading();

        // Déterminer l'onglet actif
        const activeTab = document.querySelector('.project-tab-btn.active')?.dataset.tab || 'reservations';

        // Récupérer les données selon l'onglet
        if (activeTab === 'history') {
            await exportProjectHistory();
        } else {
            await exportProjectReservations();
        }

    } catch (error) {
        console.error('Erreur export projet:', error);
        showAlert('Erreur lors de l\'export du projet', 'error');
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

        // ===== EN-TÊTE =====
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('DÉTAILS DU PROJET', pageWidth / 2, yPos, { align: 'center' });
        yPos += 10;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(`Exporté le: ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 15;

        // ===== INFORMATIONS PROJET =====
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('INFORMATIONS DU PROJET', margin, yPos);
        yPos += 8;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');

        const projectInfo = [
            ['Nom:', project.nom],
            ['Numéro:', project.numero || 'Non défini'],
            ['Description:', project.description || 'Aucune description'],
            ['Responsable:', project.responsable || 'Non défini'],
            ['Date création:', formatDate(project.created_at)],
            ['Date fin prévue:', project.date_fin_prevue ? formatDate(project.date_fin_prevue) : 'Non définie'],
            ['Budget:', project.budget ? `${project.budget} €` : 'Non défini'],
            ['Statut:', project.archived ? 'Archivé' : getProjectStatus(project) === 'active' ? 'Actif' :
                         getProjectStatus(project) === 'ending' ? 'Bientôt terminé' : 'En retard']
        ];

        projectInfo.forEach(([label, value]) => {
            doc.setFont('helvetica', 'bold');
            doc.text(label, margin, yPos);
            doc.setFont('helvetica', 'normal');

            // Gérer les textes longs avec retour à la ligne
            const lines = doc.splitTextToSize(value.toString(), pageWidth - margin - 60);
            lines.forEach((line, index) => {
                doc.text(line, margin + 40, yPos + (index * 5));
            });
            yPos += Math.max(lines.length * 5, 7);

            // Vérifier si besoin d'une nouvelle page
            if (yPos > doc.internal.pageSize.height - 40) {
                doc.addPage();
                yPos = 20;
            }
        });

        yPos += 5;

        // ===== STATISTIQUES =====
        if (sorties.length > 0 || reservations.length > 0) {
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('STATISTIQUES', margin, yPos);
            yPos += 8;

            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');

            // Calculs
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
                ['Articles utilisés:', `${itemsSortis} unité(s)`, `${valeurSortis.toFixed(2)} €`],
                ['Articles réservés:', `${itemsReserves} unité(s)`, `${valeurReserves.toFixed(2)} €`],
                ['Total articles:', `${itemsSortis + itemsReserves} unité(s)`, `${(valeurSortis + valeurReserves).toFixed(2)} €`]
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

        // ===== SORTIES (ARTICLES UTILISÉS) =====
        if (sorties.length > 0) {
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('ARTICLES UTILISÉS', margin, yPos);
            yPos += 8;

            // En-tête du tableau
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Article', margin, yPos);
            doc.text('Qté', margin + 80, yPos);
            doc.text('Date', margin + 100, yPos);
            doc.text('Prix unitaire', margin + 130, yPos);
            doc.text('Total', margin + 170, yPos);

            doc.line(margin, yPos + 1, pageWidth - margin, yPos + 1);
            yPos += 6;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);

            sorties.forEach(item => {
                const article = item.article || {};
                const prixUnitaire = article.prix_unitaire || 0;
                const total = prixUnitaire * (item.quantite || 0);

                // Vérifier nouvelle page
                if (yPos > doc.internal.pageSize.height - 20) {
                    doc.addPage();
                    yPos = 20;
                }

                doc.text(article.nom?.substring(0, 30) || 'Article', margin, yPos);
                doc.text(item.quantite?.toString() || '0', margin + 80, yPos);
                doc.text(formatDate(item.created_at), margin + 100, yPos);
                doc.text(`${prixUnitaire.toFixed(2)} €`, margin + 130, yPos);
                doc.text(`${total.toFixed(2)} €`, margin + 170, yPos);

                yPos += 6;
            });

            yPos += 10;
        }

        // ===== RÉSERVATIONS =====
        if (reservations.length > 0) {
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('ARTICLES RÉSERVÉS', margin, yPos);
            yPos += 8;

            // En-tête du tableau
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Article', margin, yPos);
            doc.text('Qté', margin + 80, yPos);
            doc.text('Date fin', margin + 100, yPos);
            doc.text('Utilisateur', margin + 130, yPos);
            doc.text('Prix unitaire', margin + 170, yPos);

            doc.line(margin, yPos + 1, pageWidth - margin, yPos + 1);
            yPos += 6;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);

            reservations.forEach(res => {
                const article = res.w_articles || {};
                const prixUnitaire = article.prix_unitaire || 0;

                // Vérifier nouvelle page
                if (yPos > doc.internal.pageSize.height - 20) {
                    doc.addPage();
                    yPos = 20;
                }

                doc.text(article.nom?.substring(0, 30) || 'Article', margin, yPos);
                doc.text(res.quantite?.toString() || '0', margin + 80, yPos);
                doc.text(formatDate(res.date_fin), margin + 100, yPos);
                doc.text(res.w_users?.username?.substring(0, 15) || 'Utilisateur', margin + 130, yPos);
                doc.text(`${prixUnitaire.toFixed(2)} €`, margin + 170, yPos);

                yPos += 6;
            });
        }

        // Pied de page
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('Document généré automatiquement - Système de gestion de stock',
                pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });

        // Télécharger
        doc.save(`projet_${project.numero || project.id}_${new Date().toISOString().split('T')[0]}.pdf`);
        showAlert('PDF exporté avec succès', 'success');

    } catch (error) {
        console.error('Erreur export PDF:', error);
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

        // ===== EN-TÊTE =====
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('HISTORIQUE DU PROJET', pageWidth / 2, yPos, { align: 'center' });
        yPos += 10;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(`Projet: ${project.nom} (${project.numero || 'Sans numéro'})`, margin, yPos);
        yPos += 5;
        doc.text(`Exporté le: ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 10;

        if (history.length === 0) {
            doc.setFontSize(12);
            doc.text('Aucun historique disponible', pageWidth / 2, yPos, { align: 'center' });
        } else {
            // ===== LISTE HISTORIQUE =====
            doc.setFontSize(10);
            history.forEach((item, index) => {
                // Vérifier nouvelle page
                if (yPos > doc.internal.pageSize.height - 30) {
                    doc.addPage();
                    yPos = 20;
                }

                // Type d'action avec icône
                let actionType = '';
                let color = [0, 0, 0]; // Noir par défaut

                switch(item.type) {
                    case 'sortie':
                        actionType = 'Sortie de stock';
                        color = [220, 53, 69]; // Rouge
                        break;
                    case 'retour_projet':
                        actionType = 'Retour au stock';
                        color = [40, 167, 69]; // Vert
                        break;
                    case 'entree':
                        actionType = 'Entrée de stock';
                        color = [0, 123, 255]; // Bleu
                        break;
                    default:
                        actionType = item.type || 'Action';
                }

                // Date et heure
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...color);
                doc.text(actionType, margin, yPos);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 100, 100);
                doc.text(formatDateTime(item.created_at), pageWidth - margin, yPos, { align: 'right' });

                yPos += 4;

                // Détails
                doc.setFontSize(9);
                doc.setTextColor(0, 0, 0);

                const details = [];
                if (item.article?.nom) {
                    details.push(`Article: ${item.article.nom}${item.article.numero ? ` (${item.article.numero})` : ''}`);
                }
                if (item.quantite) {
                    details.push(`Quantité: ${item.quantite}`);
                }
                if (item.projet) {
                    details.push(`Projet: ${item.projet}`);
                }
                if (item.utilisateur) {
                    details.push(`Utilisateur: ${item.utilisateur}`);
                }

                details.forEach(detail => {
                    doc.text(`• ${detail}`, margin + 5, yPos);
                    yPos += 4;
                });

                // Commentaire
                if (item.commentaire) {
                    doc.setFont('helvetica', 'italic');
                    doc.setTextColor(120, 120, 120);
                    doc.text(`"${item.commentaire}"`, margin + 10, yPos);
                    yPos += 4;
                    doc.setFont('helvetica', 'normal');
                }

                // Séparateur
                if (index < history.length - 1) {
                    doc.setDrawColor(200, 200, 200);
                    doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);
                    yPos += 8;
                } else {
                    yPos += 4;
                }

                // Réinitialiser la couleur
                doc.setTextColor(0, 0, 0);
            });
        }

        // Pied de page
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('Document de projet - Système de gestion de stock',
                pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });

        // Télécharger
        doc.save(`historique_${project.numero || project.id}_${new Date().toISOString().split('T')[0]}.pdf`);
        showAlert('Historique exporté en PDF', 'success');

    } catch (error) {
        console.error('Erreur export historique:', error);
        throw error;
    }
}

// ===== ÉDITION DE PROJET =====
async function editProject() {
    if (!state.currentProject) return;

    try {
        // Pré-remplir le formulaire
        elements.projectName.value = state.currentProject.nom;
        elements.projectNumber.value = state.currentProject.numero || '';
        elements.projectDescription.value = state.currentProject.description || '';
        elements.projectManager.value = state.currentProject.responsable || '';
        elements.projectEndDate.value = state.currentProject.date_fin_prevue ?
            state.currentProject.date_fin_prevue.split('T')[0] : '';
        elements.projectBudget.value = state.currentProject.budget || '';

        // Changer le titre et le bouton
        const modal = elements.newProjectModal;
        const header = modal.querySelector('.modal-header h3');
        const submitBtn = modal.querySelector('.btn-primary');

        header.innerHTML = '<i class="fas fa-edit"></i> Modifier le projet';
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Enregistrer les modifications';

        // Changer l'événement
        modal.querySelector('form').onsubmit = async function(e) {
            e.preventDefault();
            await updateProjectAction();
        };

        // ← AJOUTEZ CETTE LIGNE IMPORTANTE AVEC DEBUG
        console.log('editProject - Setting previousModal:', {
            before: state.previousModal?.id,
            currentModal: state.currentModal?.id,
            currentModalElement: state.currentModal
        });
        state.previousModal = state.currentModal;

        showModal(modal);
    } catch (error) {
        console.error('Erreur préparation édition:', error);
        showAlert('Erreur lors de la préparation de l\'édition', 'error');
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

        // Validation
        if (!projectData.nom || !projectData.numero || !projectData.responsable) {
            elements.projectErrorText.textContent = 'Veuillez remplir tous les champs obligatoires';
            elements.projectError.style.display = 'flex';
            return;
        }

        // Vérifier si le numéro existe déjà (sauf pour le projet en cours)
        const existingProject = state.projects.find(p =>
            p.numero === projectData.numero && p.id !== state.currentProject.id
        );
        if (existingProject) {
            elements.projectErrorText.textContent = 'Ce numéro de projet existe déjà';
            elements.projectError.style.display = 'flex';
            return;
        }

        showLoading();
        const updatedProject = await updateProject(state.currentProject.id, projectData);

        // Mettre à jour les listes
        const allProjects = [...state.projects, ...state.archivedProjects];
        const projectIndex = allProjects.findIndex(p => p.id === state.currentProject.id);

        if (projectIndex !== -1) {
            allProjects[projectIndex] = updatedProject;

            // Re-trier dans les bonnes listes
            if (updatedProject.archived) {
                state.archivedProjects = allProjects.filter(p => p.archived);
                state.projects = allProjects.filter(p => !p.archived);
            } else {
                state.projects = allProjects.filter(p => !p.archived);
                state.archivedProjects = allProjects.filter(p => p.archived);
            }
        }

        // Mettre à jour l'affichage
        updateProjectsDisplay();
        updateArchivedProjectsDisplay();
        populateManagerFilter();

        // Recharger les détails si ouvert
        if (elements.projectDetailsModal.style.display === 'flex') {
            await showProjectDetails(updatedProject.id);
        }

        // Fermer le modal et réinitialiser
        hideModal();
        elements.newProjectForm.reset();
        elements.projectError.style.display = 'none';

        // Restaurer le formulaire original
        const modal = elements.newProjectModal;
        const header = modal.querySelector('.modal-header h3');
        const submitBtn = modal.querySelector('.btn-primary');

        header.innerHTML = '<i class="fas fa-plus-circle"></i> Nouveau projet';
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Créer le projet';

        // Restaurer l'événement original
        modal.querySelector('form').onsubmit = function(e) {
            e.preventDefault();
            createProjectAction();
        };

        showAlert('Projet modifié avec succès', 'success');

    } catch (error) {
        console.error('Erreur modification projet:', error);
        elements.projectErrorText.textContent = error.message || 'Erreur lors de la modification du projet';
        elements.projectError.style.display = 'flex';
    } finally {
        hideLoading();
    }
}

// ===== INITIALISATION =====
async function init() {
    try {
        // Vérifier l'authentification
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) return;

        // Initialiser les événements
        setupEventListeners();

        // Charger les données initiales dans l'ordre
        await fetchProjects();  // D'abord les projets
        await Promise.all([     // Puis les autres données en parallèle
            fetchArticles(),
            fetchReservations(),
            fetchUsers(),
            fetchMovements()
        ]);

        // MAINTENANT que toutes les données sont chargées, mettre à jour l'affichage
        updateStatistics();
        updateProjectsDisplay();
        updateArchivedProjectsDisplay();
        populateManagerFilter();

        // Masquer l'overlay de chargement
        hideLoading();

    } catch (error) {
        console.error('Erreur initialisation:', error);
        showAlert('Erreur lors du chargement de l\'application', 'error');
        hideLoading();
    }
}

// Démarrer l'application
document.addEventListener('DOMContentLoaded', init);