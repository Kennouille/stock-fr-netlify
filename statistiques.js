// ===== IMPORTS =====
import { supabase } from './supabaseClient.js';

// ===== ÉTATS GLOBAUX =====
let state = {
    user: null,
    filters: {
        period: 'current_month',
        startDate: null,
        endDate: null,
        userId: '',
        projectId: ''
    },
    data: {
        articles: [],
        reservations: [],
        projects: [],
        users: [],
        movements: []
    },
    reports: {
        stockValue: null,
        lowStock: [],
        outOfStock: [],
        topArticles: [],
        categories: []
    },
    dataTables: {}
};

// ===== ÉLÉMENTS DOM =====
const elements = {
    // Overlay
    loadingOverlay: document.getElementById('loadingOverlay'),

    // Header
    usernameDisplay: document.getElementById('usernameDisplay'),
    logoutBtn: document.getElementById('logoutBtn'),

    // Filtres
    periodSelect: document.getElementById('periodSelect'),
    startDate: document.getElementById('startDate'),
    endDate: document.getElementById('endDate'),
    userFilter: document.getElementById('userFilter'),
    projectFilter: document.getElementById('projectFilter'),
    applyFiltersBtn: document.getElementById('applyFiltersBtn'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    periodInfo: document.getElementById('periodInfo'),

    // Carte valeur stock
    totalStockValue: document.getElementById('totalStockValue'),
    stockValueChange: document.getElementById('stockValueChange'),
    previousStockValue: document.getElementById('previousStockValue'),
    activeArticlesCount: document.getElementById('activeArticlesCount'),
    averageArticleValue: document.getElementById('averageArticleValue'),
    topCategory: document.getElementById('topCategory'),
    stockValuePeriod: document.getElementById('stockValuePeriod'),

    // Tableaux
    stockValueBody: document.getElementById('stockValueBody'),
    stockValueTotal: document.getElementById('stockValueTotal'),
    lowStockBody: document.getElementById('lowStockBody'),
    outOfStockBody: document.getElementById('outOfStockBody'),
    topArticlesBody: document.getElementById('topArticlesBody'),
    categoriesBody: document.getElementById('categoriesBody'),
    lowStockCount: document.getElementById('lowStockCount'),
    outOfStockCount: document.getElementById('outOfStockCount'),

    // Période top articles
    topArticlesPeriod: document.getElementById('topArticlesPeriod'),

    // Actions
    exportPdfBtn: document.getElementById('exportPdfBtn'),
    exportExcelBtn: document.getElementById('exportExcelBtn'),
    refreshBtn: document.getElementById('refreshBtn'),

    // Footer
    lastUpdateTime: document.getElementById('lastUpdateTime')
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

        // Mettre à jour l'interface avec le nom d'utilisateur IMMÉDIATEMENT
        elements.usernameDisplay.textContent = state.user.username || state.user.email;

        // DEBUG: Afficher les permissions pour vérification
        console.log('Utilisateur connecté:', state.user.username);
        console.log('Permissions:', state.user.permissions);
        console.log('Permission stats:', state.user.permissions?.stats);

        // Le SuperAdmin a toujours accès
        const SUPERADMIN_USERNAME = 'Kennouille';
        const isSuperAdmin = state.user.username === SUPERADMIN_USERNAME;

        if (isSuperAdmin) {
            console.log('SuperAdmin - accès autorisé automatiquement');
            // Mettre à jour les permissions pour inclure stats si nécessaire
            if (!state.user.permissions) {
                state.user.permissions = {};
            }
            state.user.permissions.stats = true;
            return true;
        }

        // Pour les autres utilisateurs, vérifier la permission stats
        if (!state.user.permissions?.stats) {
            alert('Vous n\'avez pas la permission d\'accéder à cette page');
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

function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2
    }).format(amount);
}

function updateLastUpdateTime() {
    const now = new Date();
    elements.lastUpdateTime.textContent = formatDateTime(now);
}

// ===== GESTION DES PÉRIODES =====
function getDateRangeForPeriod(period) {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    switch (period) {
        case 'current_month':
            start.setDate(1);
            end.setMonth(end.getMonth() + 1);
            end.setDate(0);
            break;

        case 'last_month':
            start.setMonth(start.getMonth() - 1);
            start.setDate(1);
            end.setMonth(end.getMonth());
            end.setDate(0);
            break;

        case 'current_quarter':
            const currentQuarter = Math.floor(now.getMonth() / 3);
            start.setMonth(currentQuarter * 3);
            start.setDate(1);
            end.setMonth(currentQuarter * 3 + 2);
            end.setDate(getDaysInMonth(end.getFullYear(), end.getMonth()));
            break;

        case 'last_quarter':
            const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
            start.setMonth(lastQuarter * 3);
            start.setDate(1);
            end.setMonth(lastQuarter * 3 + 2);
            end.setDate(getDaysInMonth(end.getFullYear(), end.getMonth()));
            break;

        case 'current_year':
            start.setMonth(0);
            start.setDate(1);
            end.setMonth(11);
            end.setDate(31);
            break;

        default:
            // Période personnalisée
            if (state.filters.startDate && state.filters.endDate) {
                start.setTime(new Date(state.filters.startDate).getTime());
                end.setTime(new Date(state.filters.endDate).getTime());
            } else {
                start.setDate(1);
                end.setMonth(end.getMonth() + 1);
                end.setDate(0);
            }
    }

    // Ajuster les heures pour couvrir toute la journée
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
}

function getPreviousPeriodRange(currentStart, currentEnd) {
    const duration = currentEnd - currentStart;
    const previousStart = new Date(currentStart.getTime() - duration - 1);
    const previousEnd = new Date(currentStart.getTime() - 1);

    return { start: previousStart, end: previousEnd };
}

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function updatePeriodInfo() {
    const { start, end } = getDateRangeForPeriod(state.filters.period);

    const startStr = formatDate(start);
    const endStr = formatDate(end);

    let periodText = '';
    switch (state.filters.period) {
        case 'current_month':
            periodText = `Mois en cours : ${start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
            break;
        case 'last_month':
            periodText = `Mois précédent : ${start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
            break;
        case 'current_quarter':
            const quarter = Math.floor(start.getMonth() / 3) + 1;
            periodText = `Trimestre en cours : T${quarter} ${start.getFullYear()}`;
            break;
        case 'last_quarter':
            const lastQuarter = Math.floor(start.getMonth() / 3) + 1;
            periodText = `Trimestre précédent : T${lastQuarter} ${start.getFullYear()}`;
            break;
        case 'current_year':
            periodText = `Année en cours : ${start.getFullYear()}`;
            break;
        case 'custom':
            periodText = `Personnalisé : ${startStr} au ${endStr}`;
            break;
    }

    elements.periodInfo.textContent = periodText;
    elements.stockValuePeriod.textContent = periodText.split(':')[0].trim();
}

// ===== FONCTIONS SUPABASE =====
async function fetchData() {
    try {
        showLoading();

        // Récupérer tous les articles
        const { data: articles, error: articlesError } = await supabase
            .from('w_articles')
            .select('*')
            .order('nom');

        if (articlesError) throw articlesError;
        state.data.articles = articles || [];

        // Récupérer les réservations actives
        const { data: reservations, error: reservationsError } = await supabase
            .from('w_reservations_actives')
            .select('*');

        if (reservationsError) throw reservationsError;
        state.data.reservations = reservations || [];

        // Récupérer les projets
        console.log('Récupération des projets...');
        const { data: projects, error: projectsError } = await supabase
            .from('w_projets')
            .select('id, nom, numero')
            .eq('archived', false)
            .order('nom');

        if (projectsError) {
            console.error('Erreur récupération projets:', projectsError);
            state.data.projects = [];
        } else {
            console.log('Projets récupérés:', projects);
            state.data.projects = projects || [];
        }

        // Récupérer les utilisateurs
        console.log('Récupération des utilisateurs...');
        const { data: users, error: usersError } = await supabase
            .from('w_users')
            .select('id, username')
            .order('username');

        // Récupérer les mouvements récents
        const dateRange = getDateRangeForPeriod(state.filters.period);
        const { data: movements, error: movementsError } = await supabase
            .from('w_mouvements')
            .select('*')
            .gte('created_at', dateRange.start.toISOString())
            .lte('created_at', dateRange.end.toISOString())
            .order('created_at', { ascending: false });

        if (movementsError) throw movementsError;
        state.data.movements = movements || [];

        // Mettre à jour les filtres
        populateFilters();

        // Générer les rapports
        generateReports();

        // Mettre à jour l'affichage
        updateDisplay();

        // Initialiser DataTables
        initDataTables();

        updateLastUpdateTime();

    } catch (error) {
        console.error('Erreur chargement données:', error);
        showAlert('Erreur lors du chargement des données', 'error');
    } finally {
        hideLoading();
    }
}

function populateFilters() {
    // Peupler le filtre utilisateur
    let userHtml = '<option value="">Tous les utilisateurs</option>';
    state.data.users.forEach(user => {
        userHtml += `<option value="${user.id}">${user.username}</option>`;
    });
    elements.userFilter.innerHTML = userHtml;
    elements.userFilter.value = state.filters.userId;

    // Peupler le filtre projet
    let projectHtml = '<option value="">Tous les projets</option>';
    state.data.projects.forEach(project => {
        projectHtml += `<option value="${project.id}">${project.nom} (${project.numero})</option>`;
    });
    elements.projectFilter.innerHTML = projectHtml;
    elements.projectFilter.value = state.filters.projectId;

    // Mettre à jour les dates
    const dateRange = getDateRangeForPeriod(state.filters.period);
    elements.startDate.value = dateRange.start.toISOString().split('T')[0];
    elements.endDate.value = dateRange.end.toISOString().split('T')[0];

    // Afficher/masquer les dates personnalisées
    const customDateElements = document.querySelectorAll('.custom-date');
    if (state.filters.period === 'custom') {
        customDateElements.forEach(el => el.style.display = 'flex');
    } else {
        customDateElements.forEach(el => el.style.display = 'none');
    }
}

// ===== GÉNÉRATION DES RAPPORTS =====
function generateReports() {
    generateStockValueReport();
    generateLowStockReport();
    generateOutOfStockReport();
    generateTopArticlesReport();
    generateCategoriesReport();
}

function generateStockValueReport() {
    // Calculer la valeur totale du stock
    let totalValue = 0;
    let activeArticles = 0;
    const categoryValues = {};

    state.data.articles.forEach(article => {
        if (article.quantite_disponible > 0) {
            const value = article.prix_unitaire * article.quantite_disponible;
            totalValue += value;
            activeArticles++;

            // Par catégorie
            const category = article.categorie || 'Non catégorisé';
            if (!categoryValues[category]) {
                categoryValues[category] = { value: 0, count: 0 };
            }
            categoryValues[category].value += value;
            categoryValues[category].count++;
        }
    });

    // Trouver la catégorie principale
    let topCategory = '-';
    let maxValue = 0;
    Object.entries(categoryValues).forEach(([category, data]) => {
        if (data.value > maxValue) {
            maxValue = data.value;
            topCategory = category;
        }
    });

    // Calculer la valeur moyenne
    const averageValue = activeArticles > 0 ? totalValue / activeArticles : 0;

    // Calculer la variation vs période précédente
    const currentRange = getDateRangeForPeriod(state.filters.period);
    const previousRange = getPreviousPeriodRange(currentRange.start, currentRange.end);

    // Pour l'exemple, on simule des données historiques
    const previousValue = totalValue * (0.9 + Math.random() * 0.2); // +/- 10%
    const changePercent = ((totalValue - previousValue) / previousValue) * 100;

    state.reports.stockValue = {
        totalValue,
        activeArticles,
        averageValue,
        topCategory,
        previousValue,
        changePercent
    };
}

function generateLowStockReport() {
    const lowStock = [];

    state.data.articles.forEach(article => {
        if (article.stock_min && article.quantite_disponible > 0) {
            const difference = article.quantite_disponible - article.stock_min;

            if (difference <= article.stock_min * 0.2 && difference > 0) { // Moins de 20% au-dessus du min
                lowStock.push({
                    article,
                    current: article.quantite_disponible,
                    min: article.stock_min,
                    difference,
                    status: difference <= 0 ? 'critique' : 'faible'
                });
            }
        }
    });

    // Trier par urgence
    lowStock.sort((a, b) => a.difference - b.difference);

    state.reports.lowStock = lowStock;
    elements.lowStockCount.textContent = lowStock.length;
}

function generateOutOfStockReport() {
    const outOfStock = [];

    state.data.articles.forEach(article => {
        if (article.quantite_disponible <= 0) {
            // Trouver la dernière sortie pour cet article
            const lastMovement = state.data.movements
                .filter(m => m.id_article === article.id && m.type === 'sortie')
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

            // Trouver la dernière commande (simulé)
            const lastOrder = state.data.movements
                .filter(m => m.id_article === article.id && m.type === 'entree')
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

            // Calculer la quantité manquante (par rapport au stock minimum)
            const missingQuantity = article.stock_min || 10;

            outOfStock.push({
                article,
                lastMovement,
                lastOrder,
                missingQuantity
            });
        }
    });

    state.reports.outOfStock = outOfStock;
    elements.outOfStockCount.textContent = outOfStock.length;
}

function generateTopArticlesReport() {
    const periodDays = parseInt(elements.topArticlesPeriod.value) || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);

    // Compter les réservations par article
    const articleStats = {};

    state.data.reservations.forEach(reservation => {
        if (new Date(reservation.created_at) >= cutoffDate) {
            const article = state.data.articles.find(a => a.id === reservation.id_article);
            if (article) {
                if (!articleStats[article.id]) {
                    articleStats[article.id] = {
                        article,
                        reservationCount: 0,
                        totalQuantity: 0,
                        users: new Set()
                    };
                }

                articleStats[article.id].reservationCount++;
                articleStats[article.id].totalQuantity += reservation.quantite;
                articleStats[article.id].users.add(reservation.id_user);
            }
        }
    });

    // Convertir en tableau et trier
    const topArticles = Object.values(articleStats)
        .map(stat => ({
            ...stat,
            uniqueUsers: stat.users.size
        }))
        .sort((a, b) => b.reservationCount - a.reservationCount)
        .slice(0, 10);

    state.reports.topArticles = topArticles;
}

function generateCategoriesReport() {
    const categoryStats = {};
    let totalValueAll = 0;

    // Calculer les statistiques par catégorie
    state.data.articles.forEach(article => {
        const category = article.categorie || 'Non catégorisé';
        const value = article.prix_unitaire * article.quantite_disponible;

        if (!categoryStats[category]) {
            categoryStats[category] = {
                articleCount: 0,
                totalStock: 0,
                totalValue: 0
            };
        }

        categoryStats[category].articleCount++;
        categoryStats[category].totalStock += article.quantite_disponible;
        categoryStats[category].totalValue += value;
        totalValueAll += value;
    });

    // Convertir en tableau et calculer les pourcentages
    const categories = Object.entries(categoryStats).map(([name, stats]) => ({
        name,
        ...stats,
        percentage: totalValueAll > 0 ? (stats.totalValue / totalValueAll) * 100 : 0
    }));

    // Trier par valeur décroissante
    categories.sort((a, b) => b.totalValue - a.totalValue);

    state.reports.categories = categories;
}

// ===== MISE À JOUR DE L'AFFICHAGE =====
function updateDisplay() {
    updateStockValueCard();
    updateStockValueTable();
    updateLowStockTable();
    updateOutOfStockTable();
    updateTopArticlesTable();
    updateCategoriesTable();
    updatePeriodInfo();
}

function updateStockValueCard() {
    const report = state.reports.stockValue;
    if (!report) return;

    elements.totalStockValue.textContent = formatCurrency(report.totalValue);

    // Mettre à jour la variation
    const changeElement = elements.stockValueChange;
    changeElement.textContent = `${report.changePercent >= 0 ? '+' : ''}${report.changePercent.toFixed(1)}%`;
    changeElement.className = `stat-change ${report.changePercent >= 0 ? '' : 'negative'}`;
    changeElement.innerHTML = `${report.changePercent >= 0 ? '<i class="fas fa-caret-up"></i>' : '<i class="fas fa-caret-down"></i>'} ${Math.abs(report.changePercent).toFixed(1)}%`;

    elements.previousStockValue.textContent = formatCurrency(report.previousValue);
    elements.activeArticlesCount.textContent = report.activeArticles;
    elements.averageArticleValue.textContent = formatCurrency(report.averageValue);
    elements.topCategory.textContent = report.topCategory;

    // Utiliser elements.periodInfo.textContent au lieu de periodText
    const periodText = elements.periodInfo.textContent;
    elements.stockValuePeriod.textContent = periodText.split(':')[0].trim();
}

function updateStockValueTable() {
    let html = '';
    let tableTotal = 0;

    state.data.articles.forEach(article => {
        if (article.quantite_disponible > 0) {
            const totalValue = article.prix_unitaire * article.quantite_disponible;
            tableTotal += totalValue;

            const stockClass = article.stock_min && article.quantite_disponible <= article.stock_min * 1.2
                ? 'low'
                : 'normal';

            html += `
                <tr>
                    <td>
                        <div class="article-name">${article.nom}</div>
                    </td>
                    <td>${article.code || article.numero || '-'}</td>
                    <td>${article.categorie || 'Non catégorisé'}</td>
                    <td>
                        <span class="stock-badge ${stockClass}">
                            ${article.quantite_disponible}
                        </span>
                    </td>
                    <td>${article.stock_min || '-'}</td>
                    <td>${formatCurrency(article.prix_unitaire || 0)}</td>
                    <td><strong>${formatCurrency(totalValue)}</strong></td>
                </tr>
            `;
        }
    });

    if (html) {
        elements.stockValueBody.innerHTML = html;
    } else {
        // Vide le tbody complètement pour DataTables
        elements.stockValueBody.innerHTML = '';
    }
    elements.stockValueTotal.textContent = formatCurrency(tableTotal);
}

function updateLowStockTable() {
    let html = '';

    state.reports.lowStock.forEach(item => {
        const { article, current, min, difference, status } = item;
        const percentage = min > 0 ? Math.round((current / min) * 100) : 0;

        html += `
            <tr>
                <td>
                    <div class="article-name">${article.nom}</div>
                    <small>${article.code || ''}</small>
                </td>
                <td>${article.code || article.numero || '-'}</td>
                <td>
                    <span class="stock-badge ${status === 'critique' ? 'critical' : 'low'}">
                        ${current}
                    </span>
                </td>
                <td>${min}</td>
                <td>
                    <span class="${difference <= 0 ? 'text-danger' : 'text-warning'}">
                        ${difference > 0 ? '+' : ''}${difference}
                        ${percentage > 0 ? `(${percentage}%)` : ''}
                    </span>
                </td>
                <td>
                    <span class="stock-badge ${status === 'critique' ? 'critical' : 'low'}">
                        ${status === 'critique' ? 'Critique' : 'Faible'}
                    </span>
                </td>
                <td>
                    <div class="quick-actions">
                        <button class="quick-action-btn" title="Commander" onclick="orderArticle(${article.id})">
                            <i class="fas fa-shopping-cart"></i>
                        </button>
                        <button class="quick-action-btn" title="Voir l'historique" onclick="viewArticleHistory(${article.id})">
                            <i class="fas fa-history"></i>
                        </button>
                        <button class="quick-action-btn" title="Modifier le stock min" onclick="editMinStock(${article.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    elements.lowStockBody.innerHTML = html || '<tr><td colspan="7" class="text-center">Aucune alerte de stock minimum</td></tr>';
}

function updateOutOfStockTable() {
    let html = '';

    state.reports.outOfStock.forEach(item => {
        const { article, lastMovement, lastOrder, missingQuantity } = item;

        html += `
            <tr>
                <td>
                    <div class="article-name">${article.nom}</div>
                    <small>${article.code || ''}</small>
                </td>
                <td>${article.code || article.numero || '-'}</td>
                <td>${lastMovement ? formatDateTime(lastMovement.created_at) : 'Jamais'}</td>
                <td>
                    <span class="stock-badge empty">
                        ${missingQuantity} unités
                    </span>
                </td>
                <td>${lastOrder ? formatDateTime(lastOrder.created_at) : 'Jamais commandé'}</td>
                <td>
                    <div class="quick-actions">
                        <button class="quick-action-btn" title="Commander urgence" onclick="orderArticleUrgent(${article.id})">
                            <i class="fas fa-bolt"></i>
                        </button>
                        <button class="quick-action-btn" title="Réapprovisionner" onclick="reorderArticle(${article.id})">
                            <i class="fas fa-truck"></i>
                        </button>
                        <button class="quick-action-btn" title="Marquer comme obsolète" onclick="markObsolete(${article.id})">
                            <i class="fas fa-ban"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    elements.outOfStockBody.innerHTML = html || '<tr><td colspan="6" class="text-center">Aucune rupture de stock</td></tr>';
}

function updateTopArticlesTable() {
    let html = '';
    let rank = 1;

    state.reports.topArticles.forEach(item => {
        const { article, reservationCount, totalQuantity, uniqueUsers } = item;

        html += `
            <tr>
                <td><strong>#${rank}</strong></td>
                <td>
                    <div class="article-name">${article.nom}</div>
                    <small>${article.code || ''}</small>
                </td>
                <td>
                    <span class="badge badge-primary">${reservationCount}</span>
                </td>
                <td>
                    <span class="stock-badge normal">${totalQuantity}</span>
                </td>
                <td>
                    <span class="badge badge-info">${uniqueUsers}</span>
                </td>
            </tr>
        `;
        rank++;
    });

    elements.topArticlesBody.innerHTML = html || '<tr><td colspan="5" class="text-center">Aucune donnée disponible</td></tr>';
}

function updateCategoriesTable() {
    let html = '';

    state.reports.categories.forEach(category => {
        html += `
            <tr>
                <td><strong>${category.name}</strong></td>
                <td>${category.articleCount}</td>
                <td>${category.totalStock}</td>
                <td><strong>${formatCurrency(category.totalValue)}</strong></td>
                <td>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${category.percentage}%"></div>
                        <span>${category.percentage.toFixed(1)}%</span>
                    </div>
                </td>
            </tr>
        `;
    });

    elements.categoriesBody.innerHTML = html || '<tr><td colspan="5" class="text-center">Aucune catégorie disponible</td></tr>';
}

// ===== DATATABLES INITIALISATION =====
function initDataTables() {
    console.log('Initialisation DataTables...');
    console.log('Nombre de th dans stockValueTable:', $('#stockValueTable thead th').length);
    console.log('Nombre de th dans lowStockTable:', $('#lowStockTable thead th').length);
    console.log('Nombre de th dans outOfStockTable:', $('#outOfStockTable thead th').length);
    console.log('Nombre de th dans topArticlesTable:', $('#topArticlesTable thead th').length);
    console.log('Nombre de th dans categoriesTable:', $('#categoriesTable thead th').length);

    // Détruire les instances existantes
    if (state.dataTables.stockValue) {
        state.dataTables.stockValue.destroy();
    }
    if (state.dataTables.lowStock) {
        state.dataTables.lowStock.destroy();
    }
    if (state.dataTables.outOfStock) {
        state.dataTables.outOfStock.destroy();
    }
    if (state.dataTables.topArticles) {
        state.dataTables.topArticles.destroy();
    }
    if (state.dataTables.categories) {
        state.dataTables.categories.destroy();
    }

    console.log('Initialisation stockValueTable...');
    console.log('Contenu de stockValueTable tbody:', $('#stockValueTable tbody').html());
    console.log('Nombre de lignes dans tbody:', $('#stockValueTable tbody tr').length);

    // Initialiser les tables avec DataTables
    state.dataTables.stockValue = $('#stockValueTable').DataTable({
        pageLength: 10,
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/fr-FR.json'
        },
        order: [[6, 'desc']] // Trier par valeur totale décroissante
    });
    console.log('stockValueTable initialisée');

    state.dataTables.lowStock = $('#lowStockTable').DataTable({
        pageLength: 10,
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/fr-FR.json'
        },
        order: [[4, 'asc']] // Trier par différence croissante (plus critique d'abord)
    });

    state.dataTables.outOfStock = $('#outOfStockTable').DataTable({
        pageLength: 10,
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/fr-FR.json'
        }
    });

    state.dataTables.topArticles = $('#topArticlesTable').DataTable({
        pageLength: 10,
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/fr-FR.json'
        },
        order: [[2, 'desc']] // Trier par nombre de réservations
    });

    state.dataTables.categories = $('#categoriesTable').DataTable({
        pageLength: 10,
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/fr-FR.json'
        },
        order: [[3, 'desc']] // Trier par valeur totale
    });
}

// ===== FONCTIONS D'EXPORT =====
async function exportToPdf() {
    try {
        showLoading();

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // En-tête
        doc.setFontSize(20);
        doc.text('Rapport Statistiques Stock', 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Généré le : ${new Date().toLocaleDateString('fr-FR')}`, 14, 30);
        doc.text(`Période : ${elements.periodInfo.textContent}`, 14, 35);

        // Carte valeur totale
        doc.setFontSize(14);
        doc.text('1. Valeur totale du stock', 14, 50);

        doc.setFontSize(12);
        doc.text(`Valeur totale : ${elements.totalStockValue.textContent}`, 20, 60);
        doc.text(`Variation : ${elements.stockValueChange.textContent}`, 20, 67);
        doc.text(`Articles actifs : ${elements.activeArticlesCount.textContent}`, 20, 74);

        let yPosition = 85;

        // Tableau des articles
        doc.setFontSize(14);
        doc.text('2. Articles avec stock et valeur', 14, yPosition);
        yPosition += 10;

        const stockData = state.data.articles
            .filter(a => a.quantite_disponible > 0)
            .map(a => [
                a.nom.substring(0, 30),
                a.code || '-',
                a.categorie || '-',
                a.quantite_disponible.toString(),
                (a.stock_min || '-').toString(),
                formatCurrency(a.prix_unitaire),
                formatCurrency(a.prix_unitaire * a.quantite_disponible)
            ]);

        doc.autoTable({
            startY: yPosition,
            head: [['Article', 'Code', 'Catégorie', 'Quantité', 'Stock min', 'Prix unitaire', 'Valeur totale']],
            body: stockData,
            theme: 'striped',
            headStyles: { fillColor: [37, 99, 235] }
        });

        yPosition = doc.lastAutoTable.finalY + 10;

        // Alertes stock minimum
        if (state.reports.lowStock.length > 0) {
            doc.setFontSize(14);
            doc.text('3. Alertes stock minimum', 14, yPosition);
            yPosition += 10;

            const lowStockData = state.reports.lowStock.map(item => [
                item.article.nom.substring(0, 30),
                item.article.code || '-',
                item.current.toString(),
                item.min.toString(),
                item.difference.toString(),
                item.status
            ]);

            doc.autoTable({
                startY: yPosition,
                head: [['Article', 'Code', 'Stock actuel', 'Stock min', 'Différence', 'État']],
                body: lowStockData,
                theme: 'striped',
                headStyles: { fillColor: [245, 158, 11] }
            });

            yPosition = doc.lastAutoTable.finalY + 10;
        }

        // Ruptures de stock
        if (state.reports.outOfStock.length > 0) {
            doc.setFontSize(14);
            doc.text('4. Ruptures de stock', 14, yPosition);
            yPosition += 10;

            const outOfStockData = state.reports.outOfStock.map(item => [
                item.article.nom.substring(0, 30),
                item.article.code || '-',
                item.lastMovement ? formatDate(item.lastMovement.created_at) : 'Jamais',
                item.missingQuantity.toString() + ' unités'
            ]);

            doc.autoTable({
                startY: yPosition,
                head: [['Article', 'Code', 'Dernière sortie', 'Quantité manquante']],
                body: outOfStockData,
                theme: 'striped',
                headStyles: { fillColor: [239, 68, 68] }
            });
        }

        // Enregistrer le PDF
        doc.save(`rapport_stock_${new Date().toISOString().split('T')[0]}.pdf`);

        showAlert('Rapport PDF exporté avec succès', 'success');

    } catch (error) {
        console.error('Erreur export PDF:', error);
        showAlert('Erreur lors de l\'export PDF', 'error');
    } finally {
        hideLoading();
    }
}

async function exportToExcel() {
    try {
        showLoading();

        // Préparer les données pour Excel
        const data = [];

        // 1. Articles avec stock
        const articlesData = state.data.articles.map(article => ({
            'Article': article.nom,
            'Code': article.code || '',
            'Catégorie': article.categorie || '',
            'Quantité': article.quantite_disponible,
            'Stock minimum': article.stock_min || '',
            'Prix unitaire': article.prix_unitaire,
            'Valeur totale': article.prix_unitaire * article.quantite_disponible,
            'Unité': article.unite || '',
            'Fournisseur': article.fournisseur || '',
            'Dernière mise à jour': article.updated_at ? formatDateTime(article.updated_at) : ''
        }));

        // 2. Alertes stock
        const alertsData = state.reports.lowStock.map(item => ({
            'Article': item.article.nom,
            'Code': item.article.code || '',
            'Stock actuel': item.current,
            'Stock minimum': item.min,
            'Différence': item.difference,
            'Pourcentage': item.min > 0 ? Math.round((item.current / item.min) * 100) + '%' : '0%',
            'État': item.status === 'critique' ? 'Critique' : 'Faible',
            'Catégorie': item.article.categorie || '',
            'Prix unitaire': item.article.prix_unitaire
        }));

        // 3. Ruptures
        const outagesData = state.reports.outOfStock.map(item => ({
            'Article': item.article.nom,
            'Code': item.article.code || '',
            'Dernière sortie': item.lastMovement ? formatDateTime(item.lastMovement.created_at) : 'Jamais',
            'Quantité manquante': item.missingQuantity,
            'Dernière commande': item.lastOrder ? formatDateTime(item.lastOrder.created_at) : 'Jamais',
            'Catégorie': item.article.categorie || '',
            'Prix unitaire': item.article.prix_unitaire
        }));

        // 4. Top articles
        const topData = state.reports.topArticles.map((item, index) => ({
            'Rang': index + 1,
            'Article': item.article.nom,
            'Code': item.article.code || '',
            'Nombre de réservations': item.reservationCount,
            'Quantité totale': item.totalQuantity,
            'Utilisateurs uniques': item.uniqueUsers,
            'Prix unitaire': item.article.prix_unitaire,
            'Valeur totale réservée': item.article.prix_unitaire * item.totalQuantity
        }));

        // 5. Catégories
        const categoriesData = state.reports.categories.map(cat => ({
            'Catégorie': cat.name,
            'Nombre d\'articles': cat.articleCount,
            'Stock total': cat.totalStock,
            'Valeur totale': cat.totalValue,
            'Pourcentage du total': cat.percentage.toFixed(1) + '%',
            'Valeur moyenne par article': cat.articleCount > 0 ? cat.totalValue / cat.articleCount : 0
        }));

        // Créer un classeur avec plusieurs feuilles
        const wb = XLSX.utils.book_new();

        // Ajouter les feuilles
        const ws1 = XLSX.utils.json_to_sheet(articlesData);
        XLSX.utils.book_append_sheet(wb, ws1, 'Articles');

        if (alertsData.length > 0) {
            const ws2 = XLSX.utils.json_to_sheet(alertsData);
            XLSX.utils.book_append_sheet(wb, ws2, 'Alertes Stock');
        }

        if (outagesData.length > 0) {
            const ws3 = XLSX.utils.json_to_sheet(outagesData);
            XLSX.utils.book_append_sheet(wb, ws3, 'Ruptures');
        }

        if (topData.length > 0) {
            const ws4 = XLSX.utils.json_to_sheet(topData);
            XLSX.utils.book_append_sheet(wb, ws4, 'Top Articles');
        }

        if (categoriesData.length > 0) {
            const ws5 = XLSX.utils.json_to_sheet(categoriesData);
            XLSX.utils.book_append_sheet(wb, ws5, 'Catégories');
        }

        // Ajouter une feuille de résumé
        const summaryData = [{
            'Statistique': 'Valeur totale du stock',
            'Valeur': state.reports.stockValue?.totalValue || 0
        }, {
            'Statistique': 'Nombre d\'articles actifs',
            'Valeur': state.reports.stockValue?.activeArticles || 0
        }, {
            'Statistique': 'Alertes stock minimum',
            'Valeur': state.reports.lowStock.length
        }, {
            'Statistique': 'Ruptures de stock',
            'Valeur': state.reports.outOfStock.length
        }, {
            'Statistique': 'Période du rapport',
            'Valeur': elements.periodInfo.textContent
        }, {
            'Statistique': 'Date de génération',
            'Valeur': new Date().toLocaleString('fr-FR')
        }];

        const ws6 = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, ws6, 'Résumé');

        // Générer et télécharger
        XLSX.writeFile(wb, `donnees_stock_${new Date().toISOString().split('T')[0]}.xlsx`);

        showAlert('Données exportées en Excel avec succès', 'success');

    } catch (error) {
        console.error('Erreur export Excel:', error);
        showAlert('Erreur lors de l\'export Excel', 'error');
    } finally {
        hideLoading();
    }
}

// ===== FONCTIONS D'ACTION =====
// Ces fonctions peuvent être implémentées selon vos besoins
function orderArticle(articleId) {
    showAlert('Fonctionnalité de commande à implémenter', 'info');
}

function viewArticleHistory(articleId) {
    showAlert('Fonctionnalité historique à implémenter', 'info');
}

function editMinStock(articleId) {
    showAlert('Fonctionnalité modification stock min à implémenter', 'info');
}

function orderArticleUrgent(articleId) {
    showAlert('Fonctionnalité commande urgente à implémenter', 'info');
}

function reorderArticle(articleId) {
    showAlert('Fonctionnalité réapprovisionnement à implémenter', 'info');
}

function markObsolete(articleId) {
    if (confirm('Marquer cet article comme obsolète ?')) {
        showAlert('Article marqué comme obsolète', 'success');
    }
}

// ===== GESTION DES ÉVÉNEMENTS =====
function setupEventListeners() {
    // Déconnexion
    elements.logoutBtn.addEventListener('click', logout);

    // Filtres
    elements.periodSelect.addEventListener('change', function() {
        state.filters.period = this.value;

        // Afficher/masquer les dates personnalisées
        const customDateElements = document.querySelectorAll('.custom-date');
        if (this.value === 'custom') {
            customDateElements.forEach(el => el.style.display = 'flex');
        } else {
            customDateElements.forEach(el => el.style.display = 'none');
            // Mettre à jour les dates
            const dateRange = getDateRangeForPeriod(state.filters.period);
            elements.startDate.value = dateRange.start.toISOString().split('T')[0];
            elements.endDate.value = dateRange.end.toISOString().split('T')[0];
        }

        updatePeriodInfo();
    });

    elements.applyFiltersBtn.addEventListener('click', async function() {
        // Mettre à jour les filtres
        state.filters.userId = elements.userFilter.value;
        state.filters.projectId = elements.projectFilter.value;

        if (state.filters.period === 'custom') {
            state.filters.startDate = elements.startDate.value;
            state.filters.endDate = elements.endDate.value;
        }

        // Recharger les données
        await fetchData();

        showAlert('Filtres appliqués avec succès', 'success');
    });

    elements.resetFiltersBtn.addEventListener('click', function() {
        state.filters = {
            period: 'current_month',
            startDate: null,
            endDate: null,
            userId: '',
            projectId: ''
        };

        elements.periodSelect.value = 'current_month';
        elements.userFilter.value = '';
        elements.projectFilter.value = '';

        // Masquer les dates personnalisées
        document.querySelectorAll('.custom-date').forEach(el => {
            el.style.display = 'none';
        });

        updatePeriodInfo();
        showAlert('Filtres réinitialisés', 'info');
    });

    // Export
    elements.exportPdfBtn.addEventListener('click', exportToPdf);
    elements.exportExcelBtn.addEventListener('click', exportToExcel);
    elements.refreshBtn.addEventListener('click', fetchData);

    // Boutons d'export dans les tableaux
    document.querySelectorAll('.export-table').forEach(btn => {
        btn.addEventListener('click', function() {
            const tableId = this.dataset.table;
            exportTableToExcel(tableId);
        });
    });

    // Période top articles
    elements.topArticlesPeriod.addEventListener('change', function() {
        generateTopArticlesReport();
        updateTopArticlesTable();
        state.dataTables.topArticles.destroy();
        state.dataTables.topArticles = $('#topArticlesTable').DataTable({
            pageLength: 10,
            language: {
                url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/fr-FR.json'
            },
            order: [[2, 'desc']]
        });
    });

    // Exporter une table spécifique
    function exportTableToExcel(tableId) {
        const table = document.getElementById(tableId);
        const wb = XLSX.utils.table_to_book(table);
        XLSX.writeFile(wb, `${tableId}_${new Date().toISOString().split('T')[0]}.xlsx`);
        showAlert('Tableau exporté en Excel', 'success');
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

        // Charger les données
        await fetchData();

    } catch (error) {
        console.error('Erreur initialisation:', error);
        showAlert('Erreur lors du chargement de l\'application', 'error');
    }
}

// Démarrer l'application
document.addEventListener('DOMContentLoaded', init);

// Exposer les fonctions globales
window.orderArticle = orderArticle;
window.viewArticleHistory = viewArticleHistory;
window.editMinStock = editMinStock;
window.orderArticleUrgent = orderArticleUrgent;
window.reorderArticle = reorderArticle;
window.markObsolete = markObsolete;