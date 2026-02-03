import { supabase } from './supabaseClient.js';

// Éléments DOM et variables
let currentUser = null;
let allMovements = [];
let filteredMovements = [];
let allUsers = [];
let allArticles = [];
let allProjects = [];
let currentFilters = {
    search: '',
    period: 'month',
    startDate: null,
    endDate: null,
    type: '',
    userId: '',
    articleId: '',
    project: ''
};
let currentPage = 1;
const rowsPerPage = 50;
let totalPages = 1;
let currentView = 'table';

document.addEventListener('DOMContentLoaded', async function() {
    // Vérifier l'authentification
    await checkAuth();

    // Initialiser les dates
    initializeDates();

    // Charger les données
    await loadAllData();

    // Configurer les événements
    setupEventListeners();

    // Charger l'historique
    await loadHistory();

    // Cacher le loading
    document.getElementById('loadingOverlay').style.display = 'none';
});

// ===== AUTHENTIFICATION =====
async function checkAuth() {
    try {
        const userJson = sessionStorage.getItem('current_user');

        if (!userJson) {
            window.location.href = 'connexion.html';
            return;
        }

        currentUser = JSON.parse(userJson);

        // Vérifier les permissions
        if (!currentUser.permissions?.historique) {
            alert('No tiene permiso para acceder al historial'); // TRADUIT
            window.location.href = 'accueil.html';
            return;
        }

        // Mettre à jour l'interface
        document.getElementById('usernameDisplay').textContent = currentUser.username;

    } catch (error) {
        console.error('Erreur d\'authentification:', error);
        sessionStorage.removeItem('current_user');
        window.location.href = 'connexion.html';
    }
}

// ===== INITIALISATION =====
function initializeDates() {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    // Définir la période par défaut (30 derniers jours)
    document.getElementById('startDate').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('endDate').value = today.toISOString().split('T')[0];

    currentFilters.startDate = thirtyDaysAgo;
    currentFilters.endDate = today;
    currentFilters.endDate.setHours(23, 59, 59, 999); // Fin de journée
}

// ===== CHARGEMENT DES DONNÉES =====
async function loadAllData() {
    try {
        await Promise.all([
            loadUsers(),
            loadArticles(),
            loadProjects(),
            loadRecentExits()
        ]);
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        alert('Error al cargar los datos iniciales'); // TRADUIT
    }
}

async function loadUsers() {
    try {
        const { data: users, error } = await supabase
            .from('w_users')
            .select('id, username')
            .order('username');

        if (error) throw error;

        allUsers = users || [];

        // Remplir le select des utilisateurs
        const userSelect = document.getElementById('filterUser');
        userSelect.innerHTML = '<option value="">Todos los usuarios</option>'; // TRADUIT

        allUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.username;
            userSelect.appendChild(option);
        });

    } catch (error) {
        console.error('Erreur lors du chargement des utilisateurs:', error);
    }
}

async function loadArticles() {
    try {
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('id, nom, numero')
            .order('nom');

        if (error) throw error;

        allArticles = articles || [];

        // Remplir le select des articles
        const articleSelect = document.getElementById('filterArticle');
        articleSelect.innerHTML = '<option value="">Todos los artículos</option>'; // TRADUIT

        allArticles.forEach(article => {
            const option = document.createElement('option');
            option.value = article.id;
            option.textContent = `${article.nom} (${article.numero})`;
            option.title = article.nom;
            articleSelect.appendChild(option);
        });

    } catch (error) {
        console.error('Erreur lors du chargement des articles:', error);
    }
}

async function loadProjects() {
    try {
        // Récupérer les projets uniques des mouvements
        const { data: movements, error } = await supabase
            .from('w_mouvements')
            .select('projet')
            .not('projet', 'is', null)
            .order('projet');

        if (error) throw error;

        // Extraire les projets uniques
        const uniqueProjects = [...new Set(movements.map(m => m.projet).filter(p => p))];
        allProjects = uniqueProjects;

        // Remplir le select des projets
        const projectSelect = document.getElementById('filterProject');
        projectSelect.innerHTML = '<option value="">Todos los proyectos</option><option value="none">Sin proyecto</option>'; // TRADUIT

        uniqueProjects.forEach(project => {
            const option = document.createElement('option');
            option.value = project;
            option.textContent = project;
            projectSelect.appendChild(option);
        });

    } catch (error) {
        console.error('Erreur lors du chargement des projets:', error);
    }
}

async function loadHistory() {
    try {
        // Construire la requête avec les filtres de BASE (seulement date)
        let query = supabase
            .from('w_mouvements')
            .select(`
                *,
                stock_avant,
                stock_apres,
                article:article_id (nom, numero, code_barre),
                utilisateur:utilisateur_id (username)
            `)
            .order('created_at', { ascending: false });

        // Appliquer SEULEMENT les filtres de date (les autres sont gérés par applySearchFilter)
        if (currentFilters.startDate && currentFilters.endDate) {
            query = query
                .gte('created_at', currentFilters.startDate.toISOString())
                .lte('created_at', currentFilters.endDate.toISOString());
        }

        const { data: movements, error } = await query;

        if (error) throw error;

        allMovements = movements || [];

        // Appliquer TOUS les filtres (recherche, type, utilisateur, etc.)
        applySearchFilter();

        // Mettre à jour l'interface
        updateStats();

        if (currentView === 'table') {
            updateTableView();
        } else {
            updateTimelineView();
        }

    } catch (error) {
        console.error('Erreur lors du chargement de l\'historique:', error);
        alert('Error al cargar el historial'); // TRADUIT
    }
}

function applySearchFilter() {
    console.log("Application des filtres:", currentFilters);
    console.log("Date de début:", currentFilters.startDate, "Type:", typeof currentFilters.startDate);
    console.log("Date de fin:", currentFilters.endDate, "Type:", typeof currentFilters.endDate);

    // Filtre les données déjà chargées
    filteredMovements = allMovements.filter(movement => {
        // Filtre de recherche
        if (currentFilters.search) {
            const searchLower = currentFilters.search.toLowerCase();
            const articleName = movement.article?.nom?.toLowerCase() || '';
            const articleNumber = movement.article?.numero?.toLowerCase() || '';
            const username = movement.utilisateur?.username?.toLowerCase() || '';
            const project = movement.projet?.toLowerCase() || '';
            const comment = movement.commentaire?.toLowerCase() || '';

            const matchesSearch =
                articleName.includes(searchLower) ||
                articleNumber.includes(searchLower) ||
                username.includes(searchLower) ||
                project.includes(searchLower) ||
                comment.includes(searchLower);

            if (!matchesSearch) return false;
        }

        // Filtre par type
        if (currentFilters.type && movement.type !== currentFilters.type) {
            return false;
        }

        // Filtre par utilisateur
        if (currentFilters.userId && movement.utilisateur_id !== currentFilters.userId) {
            return false;
        }

        // Filtre par article
        if (currentFilters.articleId && movement.article_id !== currentFilters.articleId) {
            return false;
        }

        // Filtre par projet
        if (currentFilters.project) {
            if (currentFilters.project === 'none') {
                // On veut les mouvements sans projet
                if (movement.projet) return false;
            } else if (movement.projet !== currentFilters.project) {
                return false;
            }
        }

        // Filtre par période
        if (currentFilters.startDate && currentFilters.endDate) {
            const movementDate = new Date(movement.created_at);

            // Logs détaillés en UTC pour comprendre
            console.log("=== Comparaison UTC ===");
            console.log("Mouvement UTC:", movementDate.toUTCString());
            console.log("Start UTC:", currentFilters.startDate.toUTCString());
            console.log("End UTC:", currentFilters.endDate.toUTCString());
            console.log("Movement >= Start?", movementDate >= currentFilters.startDate);
            console.log("Movement <= End?", movementDate <= currentFilters.endDate);

            if (movementDate < currentFilters.startDate || movementDate > currentFilters.endDate) {
                console.log("Rejeté: hors période");
                return false;
            }
        }

        return true;
    });

    console.log(`Movimientos después del filtrado: ${filteredMovements.length} de ${allMovements.length}`);

    // Mettre à jour la pagination
    totalPages = Math.ceil(filteredMovements.length / rowsPerPage);
    if (currentPage > totalPages) {
        currentPage = Math.max(1, totalPages);
    }

    // Mettre à jour le compteur
    document.getElementById('movementsCount').textContent = filteredMovements.length;
}

// ===== STATISTIQUES =====
function updateStats() {
    // Calculer les statistiques
    const total = allMovements.length;
    const entries = allMovements.filter(m => m.type === 'entree').length;
    const exits = allMovements.filter(m => m.type === 'sortie').length;
    const reservations = allMovements.filter(m => m.type === 'reservation').length;

    // Mettre à jour l'affichage
    document.getElementById('statTotalMovements').textContent = total;
    document.getElementById('statEntries').textContent = entries;
    document.getElementById('statExits').textContent = exits;
    document.getElementById('statReservations').textContent = reservations;
}

function updateMovementsCount() {
    document.getElementById('movementsCount').textContent = allMovements.length;
}

// ===== VUE TABLEAU =====
function updateTableView() {
    const tbody = document.getElementById('historyTableBody');
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, filteredMovements.length);
    const pageMovements = filteredMovements.slice(startIndex, endIndex);

    // Mettre à jour le texte de pagination
    document.getElementById('paginationText').textContent =
        `Mostrando ${startIndex + 1}-${endIndex} de ${filteredMovements.length}`; // TRADUIT

    if (pageMovements.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 3rem;">
                    <i class="fas fa-search" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                    <p>No se encontraron movimientos</p> <!-- TRADUIT -->
                    <small class="text-secondary">Intente modificar sus filtros</small> <!-- TRADUIT -->
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = '';

    pageMovements.forEach(movement => {
        const row = document.createElement('tr');

        // Formater la date
        const dateStr = movement.date_mouvement ?
            movement.date_mouvement.split('-').reverse().join('/') : // Convertir 2024-01-15 en 15/01/2024
            new Date(movement.created_at).toLocaleDateString('es-ES'); // TRADUIT locale

        const timeStr = movement.heure_mouvement ?
            movement.heure_mouvement.substring(0, 5) : // Garder HH:MM seulement
            new Date(movement.created_at).toLocaleTimeString('es-ES', { // TRADUIT locale
                hour: '2-digit',
                minute: '2-digit'
            });

        // Déterminer le type
        let typeClass = '';
        let typeText = '';
        let quantityClass = '';

        switch(movement.type) {
            case 'entree':
                typeClass = 'type-entree';
                typeText = 'Entrada'; // TRADUIT
                quantityClass = 'quantity-positive';
                break;
            case 'sortie':
                typeClass = 'type-sortie';
                typeText = 'Salida'; // TRADUIT
                quantityClass = 'quantity-negative';
                break;
            case 'reservation':
                typeClass = 'type-reservation';
                typeText = 'Reserva'; // TRADUIT
                quantityClass = 'quantity-negative';
                break;
            case 'liberation':
                typeClass = 'type-liberation';
                typeText = 'Liberación'; // TRADUIT
                quantityClass = 'quantity-positive';
                break;
            case 'ajustement':
                typeClass = 'type-ajustement';
                typeText = 'Ajuste'; // TRADUIT
                quantityClass = 'quantity-neutral';
                break;
            default:
                typeClass = 'type-ajustement';
                typeText = 'Otro'; // TRADUIT
                quantityClass = 'quantity-neutral';
        }

        // Calculer le signe de la quantité
        const quantitySign = movement.type === 'entree' || movement.type === 'liberation' ? '+' : '-';
        const quantityDisplay = `${quantitySign}${Math.abs(movement.quantite)}`;

        row.innerHTML = `
            <td>
                <div>${dateStr}</div>
                <small class="text-secondary">${timeStr}</small>
            </td>
            <td>
                <span class="movement-type ${typeClass}">${typeText}</span>
            </td>
            <td class="article-cell">
                <div class="article-name">${movement.article?.nom || 'Artículo desconocido'}</div> <!-- TRADUIT -->
                <div class="article-details">
                    ${movement.article?.numero ? `<span>${movement.article.numero}</span>` : ''}
                </div>
            </td>
            <td class="quantity-cell ${quantityClass}">
                ${quantityDisplay}
            </td>
            <td>
                ${movement.stock_apres !== null && movement.stock_apres !== undefined ?
                    movement.stock_apres :
                    '<span class="text-secondary">N/A</span>'}
            </td>
            <td>
                ${movement.projet || '<span class="text-secondary">-</span>'}
            </td>
            <td>
                ${movement.utilisateur?.username || '<span class="text-secondary">-</span>'}
            </td>
            <td>
                ${movement.commentaire || '<span class="text-secondary">-</span>'}
            </td>
            <td class="actions-cell">
                <button class="btn-details" data-id="${movement.id}" title="Ver detalles"> <!-- TRADUIT -->
                    <i class="fas fa-eye"></i> Detalles <!-- TRADUIT -->
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });

    // Ajouter les événements aux boutons de détails
    document.querySelectorAll('.btn-details').forEach(btn => {
        btn.addEventListener('click', function() {
            const movementId = this.dataset.id;
            showMovementDetails(movementId);
        });
    });

    // Mettre à jour la pagination
    updatePagination();
}

// ===== VUE CHRONOLOGIE =====
function updateTimelineView() {
    const timeline = document.getElementById('timeline');

    if (filteredMovements.length === 0) {
        timeline.innerHTML = `
            <div class="timeline-placeholder">
                <i class="fas fa-stream"></i>
                <p>No se encontraron movimientos para este período</p> <!-- TRADUIT -->
                <small class="text-secondary">Intente modificar sus filtros</small> <!-- TRADUIT -->
            </div>
        `;
        return;
    }

    timeline.innerHTML = '';

    // Grouper les mouvements par jour
    const movementsByDay = {};

    filteredMovements.forEach(movement => {
        const date = new Date(movement.created_at);
        const dateKey = date.toLocaleDateString('es-ES'); // TRADUIT locale

        if (!movementsByDay[dateKey]) {
            movementsByDay[dateKey] = [];
        }

        movementsByDay[dateKey].push(movement);
    });

    // Créer la chronologie
    Object.entries(movementsByDay).forEach(([date, dayMovements]) => {
        // En-tête du jour
        const dayHeader = document.createElement('div');
        dayHeader.className = 'timeline-day-header';
        dayHeader.innerHTML = `<h4>${date}</h4>`;
        timeline.appendChild(dayHeader);

        // Événements du jour
        dayMovements.forEach(movement => {
            const event = createTimelineEvent(movement);
            timeline.appendChild(event);
        });
    });
}

function createTimelineEvent(movement) {
    const event = document.createElement('div');
    event.className = `timeline-event ${movement.type}`;

    const movementDate = new Date(movement.created_at);
    const timeStr = movementDate.toLocaleTimeString('es-ES', { // TRADUIT locale
        hour: '2-digit',
        minute: '2-digit'
    });

    // Déterminer le type
    let typeText = '';
    let quantitySign = '';

    switch(movement.type) {
        case 'entree':
            typeText = 'Entrada stock'; // TRADUIT
            quantitySign = '+';
            break;
        case 'sortie':
            typeText = 'Salida stock'; // TRADUIT
            quantitySign = '-';
            break;
        case 'reservation':
            typeText = 'Reserva'; // TRADUIT
            quantitySign = '-';
            break;
        case 'liberation':
            typeText = 'Liberación'; // TRADUIT
            quantitySign = '+';
            break;
        case 'ajustement':
            typeText = 'Ajuste'; // TRADUIT
            quantitySign = '±';
            break;
        default:
            typeText = 'Movimiento'; // TRADUIT
            quantitySign = '';
    }

    event.innerHTML = `
        <div class="event-header">
            <span class="event-time">${timeStr}</span>
            <span class="event-type">${typeText}</span>
        </div>
        <div class="event-content">
            <div>
                <div class="event-article">${movement.article?.nom || 'Artículo desconocido'}</div> <!-- TRADUIT -->
                <div class="event-user">
                    <i class="fas fa-user"></i> ${movement.utilisateur?.username || 'Usuario desconocido'} <!-- TRADUIT -->
                </div>
            </div>
            <div class="event-quantity">
                ${quantitySign}${Math.abs(movement.quantite)}
            </div>
        </div>
    `;

    // Ajouter l'événement de clic
    event.addEventListener('click', () => {
        showMovementDetails(movement.id);
    });

    return event;
}

// ===== DERNIÈRES SORTIES =====
async function loadRecentExits() {
    try {
        const { data: exits, error } = await supabase
            .from('w_mouvements')
            .select(`
                *,
                article:article_id (nom),
                utilisateur:utilisateur_id (username)
            `)
            .eq('type', 'sortie')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        displayRecentExits(exits || []);

    } catch (error) {
        console.error('Erreur lors du chargement des dernières sorties:', error);
    }
}

function displayRecentExits(exits) {
    const container = document.getElementById('recentExits');

    if (!exits || exits.length === 0) {
        container.innerHTML = `
            <div class="loading-recent">
                <i class="fas fa-info-circle"></i> Ninguna salida reciente <!-- TRADUIT -->
            </div>
        `;
        return;
    }

    container.innerHTML = '';

    exits.forEach(exit => {
        const exitDate = new Date(exit.created_at);
        const dateStr = exitDate.toLocaleDateString('es-ES'); // TRADUIT locale
        const timeStr = exitDate.toLocaleTimeString('es-ES', { // TRADUIT locale
            hour: '2-digit',
            minute: '2-digit'
        });

        const card = document.createElement('div');
        card.className = 'recent-exit-card';

        card.innerHTML = `
            <div class="recent-exit-header">
                <span class="recent-exit-time">${dateStr} ${timeStr}</span>
                <span class="recent-exit-quantity">-${exit.quantite}</span>
            </div>
            <div class="recent-exit-article">${exit.article?.nom || 'Artículo desconocido'}</div> <!-- TRADUIT -->
            <div class="recent-exit-project">${exit.projet || 'Sin proyecto'}</div> <!-- TRADUIT -->
            <div class="recent-exit-user">
                <i class="fas fa-user"></i> ${exit.utilisateur?.username || 'Usuario desconocido'} <!-- TRADUIT -->
            </div>
        `;

        // Ajouter l'événement de clic
        card.addEventListener('click', () => {
            showMovementDetails(exit.id);
        });

        container.appendChild(card);
    });
}

// ===== DÉTAILS DU MOUVEMENT =====
async function showMovementDetails(movementId) {
    try {
        const { data: movement, error } = await supabase
            .from('w_mouvements')
            .select(`
                *,
                article:article_id (*),
                utilisateur:utilisateur_id (username)
            `)
            .eq('id', movementId)
            .single();

        if (error) throw error;

        displayMovementDetails(movement);

    } catch (error) {
        console.error('Erreur lors du chargement des détails:', error);
        alert('Error al cargar los detalles del movimiento'); // TRADUIT
    }
}

function displayMovementDetails(movement) {
    const detailsContainer = document.getElementById('movementDetails');

    // Utiliser les nouvelles colonnes si disponibles, sinon l'ancienne
    const dateStr = movement.date_mouvement ?
        movement.date_mouvement.split('-').reverse().join('/') : // Convertir 2024-01-15 en 15/01/2024
        new Date(movement.created_at).toLocaleDateString('es-ES'); // TRADUIT locale

    const timeStr = movement.heure_mouvement ?
        movement.heure_mouvement.substring(0, 5) : // Garder HH:MM seulement
        new Date(movement.created_at).toLocaleTimeString('es-ES', { // TRADUIT locale
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

    // Déterminer le type
    let typeClass = '';
    let typeText = '';
    let quantityDisplay = '';

    switch(movement.type) {
        case 'entree':
            typeClass = 'type-entree';
            typeText = 'Entrada de stock'; // TRADUIT
            quantityDisplay = `+${movement.quantite}`;
            break;
        case 'sortie':
            typeClass = 'type-sortie';
            typeText = 'Salida de stock'; // TRADUIT
            quantityDisplay = `-${movement.quantite}`;
            break;
        case 'reservation':
            typeClass = 'type-reservation';
            typeText = 'Reserva para proyecto'; // TRADUIT
            quantityDisplay = `-${movement.quantite}`;
            break;
        case 'liberation':
            typeClass = 'type-liberation';
            typeText = 'Liberación de reserva'; // TRADUIT
            quantityDisplay = `+${movement.quantite}`;
            break;
        case 'ajustement':
            typeClass = 'type-ajustement';
            typeText = 'Ajuste de stock'; // TRADUIT
            quantityDisplay = `±${Math.abs(movement.quantite)}`;
            break;
        default:
            typeClass = 'type-ajustement';
            typeText = 'Movimiento'; // TRADUIT
            quantityDisplay = movement.quantite;
    }

    detailsContainer.innerHTML = `
        <div class="detail-section">
            <h4><i class="fas fa-info-circle"></i> Información general</h4> <!-- TRADUIT -->
            <div class="detail-item">
                <span class="detail-label">Tipo:</span> <!-- TRADUIT -->
                <span class="detail-value badge ${typeClass}">${typeText}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Fecha:</span> <!-- TRADUIT -->
                <span class="detail-value">${dateStr} a las ${timeStr}</span> <!-- TRADUIT -->
            </div>
            <div class="detail-item">
                <span class="detail-label">Cantidad:</span> <!-- TRADUIT -->
                <span class="detail-value" style="font-weight: 600; font-size: 1.1rem;">${quantityDisplay}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Proyecto:</span> <!-- TRADUIT -->
                <span class="detail-value">${movement.projet || '<span class="text-secondary">Ninguno</span>'}</span> <!-- TRADUIT -->
            </div>
        </div>

        <div class="detail-section">
            <h4><i class="fas fa-box"></i> Artículo afectado</h4> <!-- TRADUIT -->
            <div class="detail-item">
                <span class="detail-label">Nombre:</span> <!-- TRADUIT -->
                <span class="detail-value">${movement.article?.nom || 'Artículo desconocido'}</span> <!-- TRADUIT -->
            </div>
            <div class="detail-item">
                <span class="detail-label">Número:</span> <!-- TRADUIT -->
                <span class="detail-value">${movement.article?.numero || 'N/A'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Código de barras:</span> <!-- TRADUIT -->
                <span class="detail-value">${movement.article?.code_barre || 'N/A'}</span>
            </div>
        </div>

        <div class="detail-section">
            <h4><i class="fas fa-user"></i> Responsable</h4>
            <div class="detail-item">
                <span class="detail-label">Usuario:</span> <!-- TRADUIT -->
                <span class="detail-value">${movement.utilisateur?.username || 'Usuario desconocido'}</span> <!-- TRADUIT -->
            </div>
        </div>

        ${movement.commentaire ? `
        <div class="detail-section">
            <h4><i class="fas fa-comment"></i> Comentario</h4> <!-- TRADUIT -->
            <div class="detail-comment">
                ${movement.commentaire}
            </div>
        </div>
        ` : ''}
    `;

    // Afficher le modal
    document.getElementById('detailModal').style.display = 'flex';
}

// ===== PAGINATION =====
function updatePagination() {
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = totalPages || 1;

    // Activer/désactiver les boutons
    document.getElementById('firstPageBtn').disabled = currentPage === 1;
    document.getElementById('prevPageBtn').disabled = currentPage === 1;
    document.getElementById('nextPageBtn').disabled = currentPage === totalPages || totalPages === 0;
    document.getElementById('lastPageBtn').disabled = currentPage === totalPages || totalPages === 0;
}

function goToPage(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;

    if (currentView === 'table') {
        updateTableView();
    }

    scrollToHistory();
}

function scrollToHistory() {
    const historySection = document.querySelector('.history-section');
    if (historySection) {
        historySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ===== GESTION DES FILTRES =====
function updateFilters() {
    console.log("Mise à jour des filtres...");

    // Recherche
    currentFilters.search = document.getElementById('quickSearch').value;

    // Type
    currentFilters.type = document.getElementById('filterType').value;

    // Utilisateur
    currentFilters.userId = document.getElementById('filterUser').value;

    // Article
    currentFilters.articleId = document.getElementById('filterArticle').value;

    // Projet
    currentFilters.project = document.getElementById('filterProject').value;

    // Réinitialiser la page
    currentPage = 1;

    console.log("Filtres mis à jour:", currentFilters);
}

function applyPeriodFilter(period) {
    const today = new Date(); // Hora local de la máquina

    let startDate = new Date(today);

    switch(period) {
        case 'today':
            // Hoy a medianoche
            startDate.setHours(0, 0, 0, 0);
            // Hoy a las 23:59:59
            const endDate = new Date(today);
            endDate.setHours(23, 59, 59, 999);

            currentFilters.startDate = startDate;
            currentFilters.endDate = endDate;
            break;
        case 'week':
            startDate.setDate(today.getDate() - 7);
            startDate.setHours(0, 0, 0, 0);
            const weekEnd = new Date(today);
            weekEnd.setHours(23, 59, 59, 999);
            currentFilters.startDate = startDate;
            currentFilters.endDate = weekEnd;
            break;
        case 'month':
            startDate.setDate(today.getDate() - 30);
            startDate.setHours(0, 0, 0, 0);
            const monthEnd = new Date(today);
            monthEnd.setHours(23, 59, 59, 999);
            currentFilters.startDate = startDate;
            currentFilters.endDate = monthEnd;
            break;
        case 'quarter':
            startDate.setDate(today.getDate() - 90);
            startDate.setHours(0, 0, 0, 0);
            const quarterEnd = new Date(today);
            quarterEnd.setHours(23, 59, 59, 999);
            currentFilters.startDate = startDate;
            currentFilters.endDate = quarterEnd;
            break;
        case 'all':
            currentFilters.startDate = null;
            currentFilters.endDate = null;
            break;
        default:
            return;
    }

    currentFilters.period = period;

    // Actualizar los campos de fecha
    if (period !== 'all') {
        document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
        document.getElementById('endDate').value = today.toISOString().split('T')[0];
    }

    console.log("Período:", period, "Inicio:", currentFilters.startDate?.toString(), "Fin:", currentFilters.endDate?.toString());

    // Aplicar el filtro
    applySearchFilter();

    // Actualizar la visualización
    if (currentView === 'table') {
        updateTableView();
    } else {
        updateTimelineView();
    }
}

function applyCustomPeriod() {
    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');

    if (!startInput.value || !endInput.value) {
        return;
    }

    // Utilizar directamente los valores del datepicker
    const startValue = startInput.value; // "2025-12-26"
    const endValue = endInput.value; // "2025-12-27"

    console.log("=== Fechas seleccionadas ===");
    console.log("Inicio:", startValue);
    console.log("Fin:", endValue);

    // Crear las fechas en hora local SIN desfase
    // Método simple: crear a medianoche local
    const startDate = new Date(startValue + 'T00:00:00');
    const endDate = new Date(endValue + 'T23:59:59.999');

    console.log("Fecha inicio local:", startDate.toString());
    console.log("Fecha fin local:", endDate.toString());
    console.log("Día inicio:", startDate.getDate());
    console.log("Día fin:", endDate.getDate());

    if (startDate > endDate) {
        alert('La fecha de inicio debe ser anterior a la fecha de fin'); // TRADUIT
        return;
    }

    // Actualizar currentFilters
    currentFilters.startDate = startDate;
    currentFilters.endDate = endDate;
    currentFilters.period = 'custom';

    // Desactivar los otros botones de período
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Aplicar el filtro
    applySearchFilter();

    // Actualizar la visualización
    if (currentView === 'table') {
        updateTableView();
    } else {
        updateTimelineView();
    }
}

function resetFilters() {
    console.log("Reinicio de filtros");

    // Reiniciar los valores de los inputs
    document.getElementById('quickSearch').value = '';
    document.getElementById('filterType').value = '';
    document.getElementById('filterUser').value = '';
    document.getElementById('filterArticle').value = '';
    document.getElementById('filterProject').value = '';

    // Reiniciar las fechas
    const today = new Date();
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);

    document.getElementById('startDate').value = startOfToday.toISOString().split('T')[0];
    document.getElementById('endDate').value = today.toISOString().split('T')[0];

    // Reiniciar los botones de período
    document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
    const todayBtn = document.querySelector('.period-btn[data-period="today"]');
    if (todayBtn) {
        todayBtn.classList.add('active');
    }

    // Reiniciar los filtros
    currentFilters = {
        search: '',
        type: '',
        userId: '',
        articleId: '',
        project: '',
        startDate: startOfToday,
        endDate: today,
        period: 'today'
    };

    console.log("Filtros reiniciados:", currentFilters);

    // Aplicar los filtros y actualizar la visualización
    applySearchFilter();

    if (currentView === 'table') {
        updateTableView();
    } else {
        updateTimelineView();
    }
}

// ===== EVENTOS =====
function setupEventListeners() {
    // Desconexión
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Búsqueda
    document.getElementById('quickSearch').addEventListener('input', function() {
        updateFilters();
        applySearchFilter();

        if (currentView === 'table') {
            updateTableView();
        } else {
            updateTimelineView();
        }
    });

    document.getElementById('clearSearchBtn').addEventListener('click', function() {
        document.getElementById('quickSearch').value = '';
        updateFilters();
        applySearchFilter();

        if (currentView === 'table') {
            updateTableView();
        } else {
            updateTimelineView();
        }
    });

    // Períodos
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Activar el botón clicado
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            const period = this.dataset.period;
            applyPeriodFilter(period); // Esto actualiza currentFilters

            // FILTRAR LOS DATOS EXISTENTES en lugar de recargar
            applySearchFilter();

            if (currentView === 'table') {
                updateTableView();
            } else {
                updateTimelineView();
            }
        });
    });

    // Exportación
    document.getElementById('exportHistoryBtn').addEventListener('click', exportHistory);

    // Cambio de vista
    document.getElementById('tableViewBtn').addEventListener('click', function() {
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');

        document.querySelectorAll('.view-container').forEach(container => {
            container.classList.remove('active');
        });

        document.getElementById('tableView').classList.add('active');
        currentView = 'table';
        updateTableView();
    });

    document.getElementById('timelineViewBtn').addEventListener('click', function() {
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');

        document.querySelectorAll('.view-container').forEach(container => {
            container.classList.remove('active');
        });

        document.getElementById('timelineView').classList.add('active');
        currentView = 'timeline';
        updateTimelineView();
    });

    // Paginación
    document.getElementById('firstPageBtn').addEventListener('click', () => goToPage(1));
    document.getElementById('prevPageBtn').addEventListener('click', () => goToPage(currentPage - 1));
    document.getElementById('nextPageBtn').addEventListener('click', () => goToPage(currentPage + 1));
    document.getElementById('lastPageBtn').addEventListener('click', () => goToPage(totalPages));

    // Modales
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal-overlay').style.display = 'none';
        });
    });

    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
            }
        });
    });

    // Filtros instantáneos (sin necesidad de recargar)
    document.getElementById('filterType').addEventListener('change', function() {
        updateFilters();
        applySearchFilter();
        if (currentView === 'table') {
            updateTableView();
        } else {
            updateTimelineView();
        }
    });

    document.getElementById('filterUser').addEventListener('change', function() {
        updateFilters();
        applySearchFilter();
        if (currentView === 'table') {
            updateTableView();
        } else {
            updateTimelineView();
        }
    });

    document.getElementById('filterArticle').addEventListener('change', function() {
        updateFilters();
        applySearchFilter();
        if (currentView === 'table') {
            updateTableView();
        } else {
            updateTimelineView();
        }
    });

    document.getElementById('filterProject').addEventListener('change', function() {
        updateFilters();
        applySearchFilter();
        if (currentView === 'table') {
            updateTableView();
        } else {
            updateTimelineView();
        }
    });

    // Filtros de fecha instantáneos
    document.getElementById('startDate').addEventListener('change', function() {
        console.log("Start date changed:", this.value);
        const endDate = document.getElementById('endDate').value;
        if (this.value && endDate) {
            console.log("Both dates selected, applying filter");
            applyCustomPeriod();
        }
    });

    document.getElementById('endDate').addEventListener('change', function() {
        console.log("End date changed:", this.value);
        const startDate = document.getElementById('startDate').value;
        if (this.value && startDate) {
            console.log("Both dates selected, applying filter");
            applyCustomPeriod();
        }
    });
}

// ===== EXPORT PDF =====
async function exportHistory() {
    try {
        if (filteredMovements.length === 0) {
            alert('No hay movimientos para exportar'); // TRADUIT
            return;
        }

        // Demander confirmation
        const confirmExport = confirm(`¿Exportar ${filteredMovements.length} movimientos en formato PDF?\n\nEl archivo se descargará automáticamente.`); // TRADUIT

        if (!confirmExport) {
            return;
        }

        // Créer le PDF
        await generatePDF(filteredMovements);

        console.log(`Export PDF réussi`);

    } catch (error) {
        console.error('Erreur lors de l\'export PDF:', error);
        alert('Error durante la exportación a PDF: ' + error.message); // TRADUIT
    }
}

async function generatePDF(movements) {
    // Vérifier que jsPDF est chargé
    if (typeof window.jspdf === 'undefined') {
        alert('Biblioteca PDF no cargada. Por favor, recargue la página.'); // TRADUIT
        return;
    }

    const { jsPDF } = window.jspdf;

    // Créer le document PDF
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    // === EN-TÊTE ===
    // Titre principal
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('HISTORIAL DE MOVIMIENTOS DE STOCK', 105, 20, { align: 'center' }); // TRADUIT

    // Sous-titre
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    const today = new Date();
    const dateStr = today.toLocaleDateString('es-ES'); // TRADUIT locale
    doc.text(`Exportado el ${dateStr} - ${movements.length} movimientos`, 105, 28, { align: 'center' }); // TRADUIT

    // Informations de filtre
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);

    const filterInfo = [];
    if (currentFilters.startDate && currentFilters.endDate) {
        const startStr = currentFilters.startDate.toLocaleDateString('es-ES'); // TRADUIT locale
        const endStr = currentFilters.endDate.toLocaleDateString('es-ES'); // TRADUIT locale
        filterInfo.push(`Período: ${startStr} al ${endStr}`); // TRADUIT
    }
    if (currentFilters.type) {
        filterInfo.push(`Tipo: ${getTypeText(currentFilters.type)}`); // TRADUIT
    }
    if (currentFilters.project) {
        filterInfo.push(`Proyecto: ${currentFilters.project === 'none' ? 'Sin proyecto' : currentFilters.project}`); // TRADUIT
    }

    if (filterInfo.length > 0) {
        doc.text(`Filtros aplicados: ${filterInfo.join(' | ')}`, 105, 35, { align: 'center' }); // TRADUIT
    }

    // Ligne de séparation
    doc.setDrawColor(200, 200, 200);
    doc.line(15, 40, 275, 40);

    // === PRÉPARER LES DONNÉES DU TABLEAU ===
    const tableData = movements.map(movement => {
        const date = new Date(movement.created_at);

        return [
            date.toLocaleDateString('es-ES'), // TRADUIT locale
            date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }), // TRADUIT locale
            getTypeText(movement.type),
            movement.article?.nom || 'N/A',
            movement.article?.numero || 'N/A',
            formatQuantityForPDF(movement.type, movement.quantite),
            movement.stock_apres !== null && movement.stock_apres !== undefined ? movement.stock_apres : 'N/A',
            movement.projet || '-',
            movement.utilisateur?.username || 'N/A',
            truncateText(movement.commentaire || '', 30)
        ];
    });

    // === CONFIGURATION DU TABLEAU ===
    doc.autoTable({
        startY: 45,
        head: [
            ['Fecha', 'Hora', 'Tipo', 'Artículo', 'N° Artículo', 'Cant.', 'Stock final', 'Proyecto', 'Usuario', 'Comentario'] // TRADUIT
        ],
        body: tableData,
        theme: 'grid',
        styles: {
            fontSize: 8,
            cellPadding: 3,
            overflow: 'linebreak',
            lineColor: [220, 220, 220],
            lineWidth: 0.1
        },
        headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 9
        },
        columnStyles: {
            0: { cellWidth: 20 }, // Date
            1: { cellWidth: 15 }, // Heure
            2: { cellWidth: 20 }, // Type
            3: { cellWidth: 40 }, // Article
            4: { cellWidth: 25 }, // N° Article
            5: { cellWidth: 20, halign: 'right' }, // Quantité
            6: { cellWidth: 20, halign: 'right' }, // Stock après
            7: { cellWidth: 30 }, // Projet
            8: { cellWidth: 25 }, // Utilisateur
            9: { cellWidth: 40 } // Commentaire
        },
        didDrawPage: function(data) {
            // Pied de page
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(
                `Página ${data.pageNumber} de ${data.pageCount} - Sistema de Gestión de Stock`, // TRADUIT
                105,
                doc.internal.pageSize.height - 10,
                { align: 'center' }
            );
        },
        margin: { top: 45, right: 15, bottom: 20, left: 15 }
    });

    // === STATISTIQUES ===
    const finalY = doc.lastAutoTable.finalY || 100;

    // Calculer les statistiques
    const stats = calculateStatistics(movements);

    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text('RESUMEN', 15, finalY + 10); // TRADUIT

    // Ligne de séparation
    doc.setDrawColor(200, 200, 200);
    doc.line(15, finalY + 12, 275, finalY + 12);

    // Afficher les statistiques
    doc.setFontSize(9);
    let statsY = finalY + 20;

    doc.text(`Total movimientos: ${stats.total}`, 15, statsY); // TRADUIT
    doc.text(`Entradas: ${stats.entries}`, 60, statsY); // TRADUIT
    doc.text(`Salidas: ${stats.exits}`, 95, statsY); // TRADUIT
    doc.text(`Reservas: ${stats.reservations}`, 130, statsY); // TRADUIT

    statsY += 8;

    if (stats.topArticles.length > 0) {
        doc.text(`Artículos más activos: ${stats.topArticles.join(', ')}`, 15, statsY); // TRADUIT
    }

    // === NOM DU FICHIER ===
    const fileName = `Historial_Movimientos_${today.toISOString().split('T')[0]}.pdf`; // TRADUIT

    // === TÉLÉCHARGEMENT ===
    doc.save(fileName);

    // Message de confirmation
    showExportSuccess(fileName);
}

function formatQuantityForPDF(type, quantity) {
    let formatted = quantity;
    let color = [0, 0, 0]; // Noir par défaut

    switch(type) {
        case 'entree':
        case 'liberation':
            formatted = `+${quantity}`;
            color = [39, 174, 96]; // Vert
            break;
        case 'sortie':
        case 'reservation':
            formatted = `-${quantity}`;
            color = [231, 76, 60]; // Rouge
            break;
    }

    return formatted;
}

function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function calculateStatistics(movements) {
    const entries = movements.filter(m => m.type === 'entree').length;
    const exits = movements.filter(m => m.type === 'sortie').length;
    const reservations = movements.filter(m => m.type === 'reservation').length;

    // Compter les articles les plus fréquents
    const articleCounts = {};
    movements.forEach(m => {
        const articleName = m.article?.nom;
        if (articleName) {
            articleCounts[articleName] = (articleCounts[articleName] || 0) + 1;
        }
    });

    // Top 3 des articles
    const topArticles = Object.entries(articleCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);

    return {
        total: movements.length,
        entries,
        exits,
        reservations,
        topArticles
    };
}

function showExportSuccess(filename) {
    const successDiv = document.createElement('div');
    successDiv.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideIn 0.3s ease;
            max-width: 400px;
        ">
            <i class="fas fa-check-circle" style="font-size: 1.2rem;"></i>
            <div>
                <div style="font-weight: bold; margin-bottom: 4px;">Exportación exitosa</div> <!-- TRADUIT -->
                <div style="font-size: 0.9rem; opacity: 0.9;">${filename} descargado</div> <!-- TRADUIT -->
            </div>
        </div>
    `;

    // Style d'animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(successDiv);

    // Supprimer après 4 secondes
    setTimeout(() => {
        successDiv.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (successDiv.parentNode) {
                document.body.removeChild(successDiv);
            }
            if (style.parentNode) {
                document.head.removeChild(style);
            }
        }, 300);
    }, 4000);
}

function getTypeText(type) {
    const types = {
        'entree': 'Entrada',      // TRADUIT
        'sortie': 'Salida',       // TRADUIT
        'reservation': 'Reserva', // TRADUIT
        'liberation': 'Liberación',// TRADUIT
        'ajustement': 'Ajuste'    // TRADUIT
    };
    return types[type] || type;
}

function downloadCSV(csv, filename) {
    // Créer le blob avec l'encodage UTF-8
    const blob = new Blob([csv], {
        type: 'text/csv;charset=utf-8;'
    });

    // Créer le lien de téléchargement
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.href = url;
    link.download = filename;

    // Ajouter au document et cliquer
    document.body.appendChild(link);
    link.click();

    // Nettoyer
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);

    // Afficher un message
    const exportMessage = document.createElement('div');
    exportMessage.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        z-index: 1000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    exportMessage.textContent = `Exportación exitosa: ${filename}`; // TRADUIT

    document.body.appendChild(exportMessage);

    // Supprimer le message après 3 secondes
    setTimeout(() => {
        document.body.removeChild(exportMessage);
    }, 3000);
}

// ===== UTILITAIRES =====
function logout() {
    if (!confirm('¿Está seguro de que desea cerrar sesión?')) { // TRADUIT
        return;
    }

    sessionStorage.removeItem('current_user');
    sessionStorage.removeItem('supabase_token');
    window.location.href = 'connexion.html'; // Si cambiaste el nombre del archivo HTML, actualízalo aquí (ej: index.html o login.html)
}
