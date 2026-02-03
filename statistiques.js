// ===== IMPORTACIONES =====
import { supabase } from './supabaseClient.js';

// ===== ESTADOS GLOBALES =====
let state = {
    user: null,
    filters: {
        period: 'current_month', // mes_actual
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
        stockValue: null, // valor_stock
        lowStock: [], // stock_bajo
        outOfStock: [], // sin_stock
        topArticles: [], // articulos_populares
        categories: []
    },
    dataTables: {}
};

// ===== ELEMENTOS DOM =====
const elements = {
    // Overlay de carga
    loadingOverlay: document.getElementById('loadingOverlay'),

    // Cabecera
    usernameDisplay: document.getElementById('usernameDisplay'),
    logoutBtn: document.getElementById('logoutBtn'), // boton_cerrar_sesion

    // Filtros
    periodSelect: document.getElementById('periodSelect'), // selector_periodo
    startDate: document.getElementById('startDate'), // fecha_inicio
    endDate: document.getElementById('endDate'), // fecha_fin
    userFilter: document.getElementById('userFilter'), // filtro_usuario
    projectFilter: document.getElementById('projectFilter'), // filtro_proyecto
    applyFiltersBtn: document.getElementById('applyFiltersBtn'), // boton_aplicar_filtros
    resetFiltersBtn: document.getElementById('resetFiltersBtn'), // boton_reiniciar_filtros
    periodInfo: document.getElementById('periodInfo'), // info_periodo

    // Tarjeta valor de stock
    totalStockValue: document.getElementById('totalStockValue'), // valor_total_stock
    stockValueChange: document.getElementById('stockValueChange'), // cambio_valor_stock
    previousStockValue: document.getElementById('previousStockValue'), // valor_stock_anterior
    activeArticlesCount: document.getElementById('activeArticlesCount'), // numero_articulos_activos
    averageArticleValue: document.getElementById('averageArticleValue'), // valor_medio_articulo
    topCategory: document.getElementById('topCategory'), // categoria_principal
    stockValuePeriod: document.getElementById('stockValuePeriod'), // periodo_valor_stock

    // Tablas
    stockValueBody: document.getElementById('stockValueBody'), // cuerpo_tabla_valor_stock
    stockValueTotal: document.getElementById('stockValueTotal'), // total_valor_stock
    lowStockBody: document.getElementById('lowStockBody'), // cuerpo_tabla_stock_bajo
    outOfStockBody: document.getElementById('outOfStockBody'), // cuerpo_tabla_sin_stock
    topArticlesBody: document.getElementById('topArticlesBody'), // cuerpo_tabla_articulos_populares
    categoriesBody: document.getElementById('categoriesBody'), // cuerpo_tabla_categorias
    lowStockCount: document.getElementById('lowStockCount'), // contador_stock_bajo
    outOfStockCount: document.getElementById('outOfStockCount'), // contador_sin_stock

    // Período top articles
    topArticlesPeriod: document.getElementById('topArticlesPeriod'), // periodo_articulos_populares

    // Acciones
    exportPdfBtn: document.getElementById('exportPdfBtn'), // boton_exportar_pdf
    exportExcelBtn: document.getElementById('exportExcelBtn'), // boton_exportar_excel
    refreshBtn: document.getElementById('refreshBtn'), // boton_refrescar

    // Pie de página
    lastUpdateTime: document.getElementById('lastUpdateTime') // ultima_actualizacion
};

// ===== AUTENTIFICACIÓN =====
async function checkAuth() {
    try {
        const userJson = sessionStorage.getItem('current_user');

        if (!userJson) {
            window.location.href = 'connexion.html'; // página_de_inicio_de_sesion
            return false;
        }

        state.user = JSON.parse(userJson);

        // Actualizar la interfaz con el nombre de usuario INMEDIATAMENTE
        elements.usernameDisplay.textContent = state.user.username || state.user.email;

        // DEBUG: Mostrar permisos para verificación
        console.log('Usuario conectado:', state.user.username);
        console.log('Permisos:', state.user.permissions);
        console.log('Permiso stats:', state.user.permissions?.stats);

        // El SuperAdmin tiene siempre acceso
        const SUPERADMIN_USERNAME = 'Kennouille';
        const isSuperAdmin = state.user.username === SUPERADMIN_USERNAME;

        if (isSuperAdmin) {
            console.log('SuperAdmin - acceso autorizado automáticamente');
            // Actualizar permisos para incluir stats si es necesario
            if (!state.user.permissions) {
                state.user.permissions = {};
            }
            state.user.permissions.stats = true;
            return true;
        }

        // Para otros usuarios, verificar el permiso stats
        if (!state.user.permissions?.stats) {
            alert('No tienes permiso para acceder a esta página');
            window.location.href = 'accueil.html'; // página_principal
            return false;
        }

        return true;

    } catch (error) {
        console.error('Error de autentificación:', error);
        sessionStorage.removeItem('current_user');
        window.location.href = 'connexion.html'; // página_de_inicio_de_sesion
        return false;
    }
}

function logout() {
    if (!confirm('¿Estás seguro de que quieres cerrar la sesión?')) {
        return;
    }

    sessionStorage.removeItem('current_user');
    sessionStorage.removeItem('supabase_token');
    window.location.href = 'connexion.html'; // página_de_inicio_de_sesion
}

// ===== FUNCIONES UTILITARIAS =====
function showLoading() {
    elements.loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    elements.loadingOverlay.style.display = 'none';
}

function showAlert(message, type = 'info') {
    // Crear una alerta temporal
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert-message ${type}`;
    alertDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;

    // Añadir al principio del main-content
    const mainContent = document.querySelector('.main-content');
    mainContent.insertBefore(alertDiv, mainContent.firstChild);

    // Eliminar después de 5 segundos
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
        return date.toLocaleDateString('es-ES', { // Formato español
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
        return date.toLocaleDateString('es-ES', { // Formato español
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
    return new Intl.NumberFormat('es-ES', { // Formato español
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2
    }).format(amount);
}

function updateLastUpdateTime() {
    const now = new Date();
    elements.lastUpdateTime.textContent = formatDateTime(now);
}

// ===== GESTIÓN DE PERIODOS =====
function getDateRangeForPeriod(period) {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    switch (period) {
        case 'current_month': // mes_actual
            start.setDate(1);
            end.setMonth(end.getMonth() + 1);
            end.setDate(0);
            break;

        case 'last_month': // mes_anterior
            start.setMonth(start.getMonth() - 1);
            start.setDate(1);
            end.setMonth(end.getMonth());
            end.setDate(0);
            break;

        case 'current_quarter': // trimestre_actual
            const currentQuarter = Math.floor(now.getMonth() / 3);
            start.setMonth(currentQuarter * 3);
            start.setDate(1);
            end.setMonth(currentQuarter * 3 + 2);
            end.setDate(getDaysInMonth(end.getFullYear(), end.getMonth()));
            break;

        case 'last_quarter': // trimestre_anterior
            const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
            start.setMonth(lastQuarter * 3);
            start.setDate(1);
            end.setMonth(lastQuarter * 3 + 2);
            end.setDate(getDaysInMonth(end.getFullYear(), end.getMonth()));
            break;

        case 'current_year': // año_actual
            start.setMonth(0);
            start.setDate(1);
            end.setMonth(11);
            end.setDate(31);
            break;

        default:
            // Período personalizado
            if (state.filters.startDate && state.filters.endDate) {
                start.setTime(new Date(state.filters.startDate).getTime());
                end.setTime(new Date(state.filters.endDate).getTime());
            } else {
                start.setDate(1);
                end.setMonth(end.getMonth() + 1);
                end.setDate(0);
            }
    }

    // Ajustar las horas para cubrir todo el día
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
        case 'current_month': // mes_actual
            periodText = `Mes actual: ${start.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
            break;
        case 'last_month': // mes_anterior
            periodText = `Mes anterior: ${start.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
            break;
        case 'current_quarter': // trimestre_actual
            const quarter = Math.floor(start.getMonth() / 3) + 1;
            periodText = `Trimestre actual: T${quarter} ${start.getFullYear()}`;
            break;
        case 'last_quarter': // trimestre_anterior
            const lastQuarter = Math.floor(start.getMonth() / 3) + 1;
            periodText = `Trimestre anterior: T${lastQuarter} ${start.getFullYear()}`;
            break;
        case 'current_year': // año_actual
            periodText = `Año actual: ${start.getFullYear()}`;
            break;
        case 'custom': // personalizado
            periodText = `Personalizado: ${startStr} al ${endStr}`;
            break;
    }

    elements.periodInfo.textContent = periodText;
    // Separar el texto para usar solo la parte del periodo (ej: "Mes actual", "Trimestre anterior")
    elements.stockValuePeriod.textContent = periodText.split(':')[0].trim();
}

// ===== FUNCIONES SUPABASE =====
async function fetchData() {
    try {
        showLoading();

        // Recuperar todos los artículos
        const { data: articles, error: articlesError } = await supabase
            .from('w_articles')
            .select('*')
            .order('nom');

        if (articlesError) throw articlesError;
        state.data.articles = articles || [];

        // Recuperar las reservas activas
        const { data: reservations, error: reservationsError } = await supabase
            .from('w_reservations_actives')
            .select('*');

        if (reservationsError) throw reservationsError;
        state.data.reservations = reservations || [];

        // Recuperar los proyectos
        console.log('Recuperando proyectos...');
        const { data: projects, error: projectsError } = await supabase
            .from('w_projets')
            .select('id, nom, numero')
            .eq('archived', false)
            .order('nom');

        if (projectsError) {
            console.error('Error recuperando proyectos:', projectsError);
            state.data.projects = [];
        } else {
            console.log('Proyectos recuperados:', projects);
            state.data.projects = projects || [];
        }

        // Recuperar los usuarios
        console.log('Recuperando usuarios...');
        const { data: users, error: usersError } = await supabase
            .from('w_users')
            .select('id, username')
            .order('username');

        // Recuperar movimientos recientes
        const dateRange = getDateRangeForPeriod(state.filters.period);
        const { data: movements, error: movementsError } = await supabase
            .from('w_mouvements')
            .select('*')
            .gte('created_at', dateRange.start.toISOString())
            .lte('created_at', dateRange.end.toISOString())
            .order('created_at', { ascending: false });

        if (movementsError) throw movementsError;
        state.data.movements = movements || [];

        // Actualizar los filtros
        populateFilters();

        // Generar los informes
        generateReports();

        // Actualizar la visualización
        updateDisplay();

        // Inicializar DataTables
        initDataTables();

        updateLastUpdateTime();

    } catch (error) {
        console.error('Error cargando datos:', error);
        showAlert('Error al cargar los datos', 'error');
    } finally {
        hideLoading();
    }
}

function populateFilters() {
    // Poblar el filtro de usuario
    let userHtml = '<option value="">Todos los usuarios</option>';
    state.data.users.forEach(user => {
        userHtml += `<option value="${user.id}">${user.username}</option>`;
    });
    elements.userFilter.innerHTML = userHtml;
    elements.userFilter.value = state.filters.userId;

    // Poblar el filtro de proyecto
    let projectHtml = '<option value="">Todos los proyectos</option>';
    state.data.projects.forEach(project => {
        projectHtml += `<option value="${project.id}">${project.nom} (${project.numero})</option>`;
    });
    elements.projectFilter.innerHTML = projectHtml;
    elements.projectFilter.value = state.filters.projectId;

    // Actualizar las fechas
    const dateRange = getDateRangeForPeriod(state.filters.period);
    elements.startDate.value = dateRange.start.toISOString().split('T')[0];
    elements.endDate.value = dateRange.end.toISOString().split('T')[0];

    // Mostrar/ocultar las fechas personalizadas
    const customDateElements = document.querySelectorAll('.custom-date');
    if (state.filters.period === 'custom') {
        customDateElements.forEach(el => el.style.display = 'flex');
    } else {
        customDateElements.forEach(el => el.style.display = 'none');
    }
}

// ===== GENERACIÓN DE INFORMES =====
function generateReports() {
    generateStockValueReport();
    generateLowStockReport();
    generateOutOfStockReport();
    generateTopArticlesReport();
    generateCategoriesReport();
}

function generateStockValueReport() {
    // Calcular el valor total del stock
    let totalValue = 0;
    let activeArticles = 0;
    const categoryValues = {};

    state.data.articles.forEach(article => {
        if (article.quantite_disponible > 0) {
            const value = article.prix_unitaire * article.quantite_disponible;
            totalValue += value;
            activeArticles++;

            // Por categoría
            const category = article.categorie || 'Sin categoría';
            if (!categoryValues[category]) {
                categoryValues[category] = { value: 0, count: 0 };
            }
            categoryValues[category].value += value;
            categoryValues[category].count++;
        }
    });

    // Encontrar la categoría principal
    let topCategory = '-';
    let maxValue = 0;
    Object.entries(categoryValues).forEach(([category, data]) => {
        if (data.value > maxValue) {
            maxValue = data.value;
            topCategory = category;
        }
    });

    // Calcular el valor medio
    const averageValue = activeArticles > 0 ? totalValue / activeArticles : 0;

    // Calcular la variación vs período anterior
    const currentRange = getDateRangeForPeriod(state.filters.period);
    const previousRange = getPreviousPeriodRange(currentRange.start, currentRange.end);

    // Para el ejemplo, simulamos datos históricos
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

            if (difference <= article.stock_min * 0.2 && difference > 0) { // Menos del 20% por encima del mínimo
                lowStock.push({
                    article,
                    current: article.quantite_disponible,
                    min: article.stock_min,
                    difference,
                    status: difference <= 0 ? 'crítico' : 'bajo'
                });
            }
        }
    });

    // Ordenar por urgencia
    lowStock.sort((a, b) => a.difference - b.difference);

    state.reports.lowStock = lowStock;
    elements.lowStockCount.textContent = lowStock.length;
}

function generateOutOfStockReport() {
    const outOfStock = [];

    state.data.articles.forEach(article => {
        if (article.quantite_disponible <= 0) {
            // Encontrar la última salida para este artículo
            const lastMovement = state.data.movements
                .filter(m => m.id_article === article.id && m.type === 'sortie')
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

            // Encontrar el último pedido (simulado)
            const lastOrder = state.data.movements
                .filter(m => m.id_article === article.id && m.type === 'entree')
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

            // Calcular la cantidad faltante (respecto al stock mínimo)
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

    // Contar reservaciones por artículo
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

    // Convertir en array y ordenar
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

    // Calcular estadísticas por categoría
    state.data.articles.forEach(article => {
        const category = article.categorie || 'Sin categoría';
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

    // Convertir en array y calcular porcentajes
    const categories = Object.entries(categoryStats).map(([name, stats]) => ({
        name,
        ...stats,
        percentage: totalValueAll > 0 ? (stats.totalValue / totalValueAll) * 100 : 0
    }));

    // Ordenar por valor descendente
    categories.sort((a, b) => b.totalValue - a.totalValue);

    state.reports.categories = categories;
}

// ===== ACTUALIZACIÓN DE LA VISTA =====
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

    // Actualizar la variación
    const changeElement = elements.stockValueChange;
    changeElement.textContent = `${report.changePercent >= 0 ? '+' : ''}${report.changePercent.toFixed(1)}%`;
    changeElement.className = `stat-change ${report.changePercent >= 0 ? '' : 'negative'}`;
    changeElement.innerHTML = `${report.changePercent >= 0 ? '<i class="fas fa-caret-up"></i>' : '<i class="fas fa-caret-down"></i>'} ${Math.abs(report.changePercent).toFixed(1)}%`;

    elements.previousStockValue.textContent = formatCurrency(report.previousValue);
    elements.activeArticlesCount.textContent = report.activeArticles;
    elements.averageArticleValue.textContent = formatCurrency(report.averageValue);
    elements.topCategory.textContent = report.topCategory;

    // Usar elements.periodInfo.textContent en lugar de periodText
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
                    <td>${article.categorie || 'Sin categoría'}</td>
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
        // Vaciar el tbody completamente para DataTables
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
                        ${status === 'critique' ? 'Crítico' : 'Bajo'}
                    </span>
                </td>
                <td>
                    <div class="quick-actions">
                        <button class="quick-action-btn" title="Pedir" onclick="orderArticle(${article.id})">
                            <i class="fas fa-shopping-cart"></i>
                        </button>
                        <button class="quick-action-btn" title="Ver historial" onclick="viewArticleHistory(${article.id})">
                            <i class="fas fa-history"></i>
                        </button>
                        <button class="quick-action-btn" title="Editar stock mínimo" onclick="editMinStock(${article.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    if (html) {
        elements.lowStockBody.innerHTML = html;
    } else {
        elements.lowStockBody.innerHTML = '';
    }
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
                <td>${lastMovement ? formatDateTime(lastMovement.created_at) : 'Nunca'}</td>
                <td>
                    <span class="stock-badge empty">
                        ${missingQuantity} unidades
                    </span>
                </td>
                <td>${lastOrder ? formatDateTime(lastOrder.created_at) : 'Nunca pedido'}</td>
                <td>
                    <div class="quick-actions">
                        <button class="quick-action-btn" title="Pedido de emergencia" onclick="orderArticleUrgent(${article.id})">
                            <i class="fas fa-bolt"></i>
                        </button>
                        <button class="quick-action-btn" title="Reponer stock" onclick="reorderArticle(${article.id})">
                            <i class="fas fa-truck"></i>
                        </button>
                        <button class="quick-action-btn" title="Marcar como obsoleto" onclick="markObsolete(${article.id})">
                            <i class="fas fa-ban"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    if (html) {
        elements.outOfStockBody.innerHTML = html;
    } else {
        elements.outOfStockBody.innerHTML = '';
    }
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

    if (html) {
        elements.topArticlesBody.innerHTML = html;
    } else {
        elements.topArticlesBody.innerHTML = '';
    }
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

    if (html) {
        elements.categoriesBody.innerHTML = html;
    } else {
        elements.categoriesBody.innerHTML = '';
    }
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
        doc.text('Informe Estadísticas Stock', 14, 22); // Traduit "Rapport Statistiques Stock"

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generado el : ${new Date().toLocaleDateString('es-ES')}`, 14, 30); // Traduit "Généré le :" et utilise le format espagnol
        doc.text(`Período : ${elements.periodInfo.textContent}`, 14, 35); // Traduit "Période :"

        // Carte valeur totale
        doc.setFontSize(14);
        doc.text('1. Valor total del stock', 14, 50); // Traduit "1. Valeur totale du stock"

        doc.setFontSize(12);
        doc.text(`Valor total : ${elements.totalStockValue.textContent}`, 20, 60); // Traduit "Valeur totale :"
        doc.text(`Variación : ${elements.stockValueChange.textContent}`, 20, 67); // Traduit "Variation :"
        doc.text(`Artículos activos : ${elements.activeArticlesCount.textContent}`, 20, 74); // Traduit "Articles actifs :"

        let yPosition = 85;

        // Tableau des articles
        doc.setFontSize(14);
        doc.text('2. Artículos con stock y valor', 14, yPosition); // Traduit "2. Articles avec stock et valeur"
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
            head: [['Artículo', 'Código', 'Categoría', 'Cantidad', 'Stock min', 'Precio unitario', 'Valor total']], // Traduit les en-têtes de colonne
            body: stockData,
            theme: 'striped',
            headStyles: { fillColor: [37, 99, 235] }
        });

        yPosition = doc.lastAutoTable.finalY + 10;

        // Alertes stock minimum
        if (state.reports.lowStock.length > 0) {
            doc.setFontSize(14);
            doc.text('3. Alertas de stock mínimo', 14, yPosition); // Traduit "3. Alertes stock minimum"
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
                head: [['Artículo', 'Código', 'Stock actual', 'Stock min', 'Diferencia', 'Estado']], // Traduit les en-têtes de colonne
                body: lowStockData,
                theme: 'striped',
                headStyles: { fillColor: [245, 158, 11] }
            });

            yPosition = doc.lastAutoTable.finalY + 10;
        }

        // Ruptures de stock
        if (state.reports.outOfStock.length > 0) {
            doc.setFontSize(14);
            doc.text('4. Roturas de stock', 14, yPosition); // Traduit "4. Ruptures de stock"
            yPosition += 10;

            const outOfStockData = state.reports.outOfStock.map(item => [
                item.article.nom.substring(0, 30),
                item.article.code || '-',
                item.lastMovement ? formatDate(item.lastMovement.created_at) : 'Jamais', // "Jamais" laissé car c'est une valeur et non une étiquette à traduire, sauf si vous spécifiez autrement.
                item.missingQuantity.toString() + ' unidades' // Traduit "unités" en "unidades"
            ]);

            doc.autoTable({
                startY: yPosition,
                head: [['Artículo', 'Código', 'Última salida', 'Cantidad faltante']], // Traduit les en-têtes de colonne
                body: outOfStockData,
                theme: 'striped',
                headStyles: { fillColor: [239, 68, 68] }
            });
        }

        // Enregistrer le PDF
        doc.save(`informe_stock_${new Date().toISOString().split('T')[0]}.pdf`); // Modifié le nom du fichier pour être en espagnol

        showAlert('Informe PDF exportado con éxito', 'success'); // Traduit le message de succès

    } catch (error) {
        console.error('Error exportación PDF:', error); // Traduit le message d'erreur console
        showAlert('Error al exportar PDF', 'error'); // Traduit le message d'erreur
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
            'Artículo': article.nom, // Traduit "Article"
            'Código': article.code || '', // Traduit "Code"
            'Categoría': article.categorie || '', // Traduit "Catégorie"
            'Cantidad': article.quantite_disponible, // Traduit "Quantité"
            'Stock Mínimo': article.stock_min || '', // Traduit "Stock minimum"
            'Precio Unitario': article.prix_unitaire, // Traduit "Prix unitaire"
            'Valor Total': article.prix_unitaire * article.quantite_disponible, // Traduit "Valeur totale"
            'Unidad': article.unite || '', // Traduit "Unité"
            'Proveedor': article.fournisseur || '', // Traduit "Fournisseur"
            'Última actualización': article.updated_at ? formatDateTime(article.updated_at) : '' // Traduit "Dernière mise à jour"
        }));

        // 2. Alertes stock
        const alertsData = state.reports.lowStock.map(item => ({
            'Artículo': item.article.nom, // Traduit "Article"
            'Código': item.article.code || '', // Traduit "Code"
            'Stock Actual': item.current, // Traduit "Stock actuel"
            'Stock Mínimo': item.min, // Traduit "Stock minimum"
            'Diferencia': item.difference, // Traduit "Différence"
            'Porcentaje': item.min > 0 ? Math.round((item.current / item.min) * 100) + '%' : '0%', // Traduit "Pourcentage"
            'Estado': item.status === 'critique' ? 'Crítico' : 'Bajo', // Traduit "État" et les valeurs
            'Categoría': item.article.categorie || '', // Traduit "Catégorie"
            'Precio Unitario': item.article.prix_unitaire // Traduit "Prix unitaire"
        }));

        // 3. Ruptures
        const outagesData = state.reports.outOfStock.map(item => ({
            'Artículo': item.article.nom, // Traduit "Article"
            'Código': item.article.code || '', // Traduit "Code"
            'Última salida': item.lastMovement ? formatDateTime(item.lastMovement.created_at) : 'Nunca', // Traduit "Dernière sortie" et "Jamais"
            'Cantidad faltante': item.missingQuantity, // Traduit "Quantité manquante"
            'Último pedido': item.lastOrder ? formatDateTime(item.lastOrder.created_at) : 'Nunca', // Traduit "Dernière commande" et "Jamais"
            'Categoría': item.article.categorie || '', // Traduit "Catégorie"
            'Precio Unitario': item.article.prix_unitaire // Traduit "Prix unitaire"
        }));

        // 4. Top articles
        const topData = state.reports.topArticles.map((item, index) => ({
            'Rango': index + 1, // Traduit "Rang"
            'Artículo': item.article.nom, // Traduit "Article"
            'Código': item.article.code || '', // Traduit "Code"
            'Número de reservaciones': item.reservationCount, // Traduit "Nombre de réservations"
            'Cantidad total': item.totalQuantity, // Traduit "Quantité totale"
            'Usuarios únicos': item.uniqueUsers, // Traduit "Utilisateurs uniques"
            'Precio Unitario': item.article.prix_unitaire, // Traduit "Prix unitaire"
            'Valor total reservado': item.article.prix_unitaire * item.totalQuantity // Traduit "Valeur totale réservée"
        }));

        // 5. Catégories
        const categoriesData = state.reports.categories.map(cat => ({
            'Categoría': cat.name, // Traduit "Catégorie"
            'Número de artículos': cat.articleCount, // Traduit "Nombre d'articles"
            'Stock total': cat.totalStock, // Traduit "Stock total"
            'Valor total': cat.totalValue, // Traduit "Valeur totale"
            'Porcentaje del total': cat.percentage.toFixed(1) + '%', // Traduit "Pourcentage du total"
            'Valor promedio por artículo': cat.articleCount > 0 ? cat.totalValue / cat.articleCount : 0 // Traduit "Valeur moyenne par article"
        }));

        // Créer un classeur avec plusieurs feuilles
        const wb = XLSX.utils.book_new();

        // Ajouter les feuilles
        const ws1 = XLSX.utils.json_to_sheet(articlesData);
        XLSX.utils.book_append_sheet(wb, ws1, 'Artículos'); // Traduit le nom de la feuille

        if (alertsData.length > 0) {
            const ws2 = XLSX.utils.json_to_sheet(alertsData);
            XLSX.utils.book_append_sheet(wb, ws2, 'Alertas Stock'); // Traduit le nom de la feuille
        }

        if (outagesData.length > 0) {
            const ws3 = XLSX.utils.json_to_sheet(outagesData);
            XLSX.utils.book_append_sheet(wb, ws3, 'Roturas'); // Traduit le nom de la feuille
        }

        if (topData.length > 0) {
            const ws4 = XLSX.utils.json_to_sheet(topData);
            XLSX.utils.book_append_sheet(wb, ws4, 'Top Artículos'); // Traduit le nom de la feuille
        }

        if (categoriesData.length > 0) {
            const ws5 = XLSX.utils.json_to_sheet(categoriesData);
            XLSX.utils.book_append_sheet(wb, ws5, 'Categorías'); // Traduit le nom de la feuille
        }

        // Ajouter une feuille de résumé
        const summaryData = [{
            'Estadística': 'Valor total del stock', // Traduit "Statistique" et "Valeur totale du stock"
            'Valor': state.reports.stockValue?.totalValue || 0
        }, {
            'Estadística': 'Número de artículos activos', // Traduit "Nombre d'articles actifs"
            'Valor': state.reports.stockValue?.activeArticles || 0
        }, {
            'Estadística': 'Alertas de stock mínimo', // Traduit "Alertes stock minimum"
            'Valor': state.reports.lowStock.length
        }, {
            'Estadística': 'Roturas de stock', // Traduit "Ruptures de stock"
            'Valor': state.reports.outOfStock.length
        }, {
            'Estadística': 'Período del informe', // Traduit "Période du rapport"
            'Valor': elements.periodInfo.textContent
        }, {
            'Estadística': 'Fecha de generación', // Traduit "Date de génération"
            'Valor': new Date().toLocaleString('es-ES') // Utilise le format espagnol
        }];

        const ws6 = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, ws6, 'Resumen'); // Traduit le nom de la feuille

        // Générer et télécharger
        XLSX.writeFile(wb, `datos_stock_${new Date().toISOString().split('T')[0]}.xlsx`); // Modifié le nom du fichier pour être en espagnol

        showAlert('Datos exportados a Excel con éxito', 'success'); // Traduit le message de succès

    } catch (error) {
        console.error('Error exportación Excel:', error); // Traduit le message d'erreur console
        showAlert('Error al exportar Excel', 'error'); // Traduit le message d'erreur
    } finally {
        hideLoading();
    }
}

// ===== FONCTIONS D'ACTION =====
// Ces fonctions peuvent être implémentées selon vos besoins
function orderArticle(articleId) {
    showAlert('Funcionalidad de pedido a implementar', 'info'); // Traduit "Fonctionnalité de commande à implémenter"
}

function viewArticleHistory(articleId) {
    showAlert('Funcionalidad de historial a implementar', 'info'); // Traduit "Fonctionnalité historique à implémenter"
}

function editMinStock(articleId) {
    showAlert('Funcionalidad de modificación de stock mínimo a implementar', 'info'); // Traduit "Fonctionnalité modification stock min à implémenter"
}

function orderArticleUrgent(articleId) {
    showAlert('Funcionalidad de pedido urgente a implementar', 'info'); // Traduit "Fonctionnalité commande urgente à implémenter"
}

function reorderArticle(articleId) {
    showAlert('Funcionalidad de reordenar a implementar', 'info'); // Traduit "Fonctionnalité réapprovisionnement à implémenter"
}

function markObsolete(articleId) {
    if (confirm('¿Marcar este artículo como obsoleto?')) { // Traduit la confirmation
        showAlert('Artículo marcado como obsoleto', 'success'); // Traduit le message de succès
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

        showAlert('Filtros aplicados con éxito', 'success'); // Traduit le message de succès
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
        showAlert('Filtros reiniciados', 'info'); // Traduit le message d'information
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
        showAlert('Tabla exportada a Excel', 'success'); // Traduit le message de succès
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
        console.error('Error de inicialización:', error); // Traduit le message d'erreur console
        showAlert('Error al cargar la aplicación', 'error'); // Traduit le message d'erreur
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