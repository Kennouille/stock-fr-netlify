// ===== IMPORTS =====
import { supabase } from './supabaseClient.js';

// ===== ÉTATS GLOBAUX =====
let state = {
    user: null,
    alerts: [],
    alertHistory: [],
    articles: [],
    alertSettings: {
        enabled: true,
        checkFrequency: 'daily',
        checkTime: '08:00',
        lowStockThreshold: 10,
        criticalStockThreshold: 3,
        email: {
            enabled: true,
            subject: '[Stock] Alerte niveau bas',
            recipients: [],
            template: `Bonjour,

Les articles suivants ont un stock bas :

{{articles_list}}

Merci de réapprovisionner au plus vite.

Cordialement,
Système de gestion de stock`
        },
        sms: {
            enabled: false,
            recipients: [],
            provider: '',
            template: 'Alerte stock : {{count}} article(s) en stock bas. Consulter le système.'
        }
    },
    currentTab: 'configuration',
    filters: {
        type: '',
        status: '',
        dateFrom: '',
        dateTo: ''
    },
    selections: new Set(),
    historyPagination: {
        currentPage: 1,
        totalPages: 1,
        pageSize: 20,
        totalItems: 0
    }
};

// ===== ÉLÉMENTS DOM =====
const elements = {
    // Overlay de chargement
    loadingOverlay: document.getElementById('loadingOverlay'),

    // Header
    usernameDisplay: document.getElementById('usernameDisplay'),
    logoutBtn: document.getElementById('logoutBtn'),

    // Statistiques
    activeAlerts: document.getElementById('activeAlerts'),
    emailsSent: document.getElementById('emailsSent'),
    smsSent: document.getElementById('smsSent'),
    nextCheck: document.getElementById('nextCheck'),

    // Boutons header
    testEmailBtn: document.getElementById('testEmailBtn'),
    testSmsBtn: document.getElementById('testSmsBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),

    // Onglets
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    historyTabCount: document.getElementById('historyTabCount'),
    activeTabCount: document.getElementById('activeTabCount'),

    // Recherche
    searchAlerts: document.getElementById('searchAlerts'),
    searchBtn: document.getElementById('searchBtn'),

    // Onglet configuration
    alertEnabled: document.getElementById('alertEnabled'),
    checkFrequency: document.getElementById('checkFrequency'),
    checkTime: document.getElementById('checkTime'),
    lowStockThreshold: document.getElementById('lowStockThreshold'),
    criticalStockThreshold: document.getElementById('criticalStockThreshold'),
    emailEnabled: document.getElementById('emailEnabled'),
    emailSubject: document.getElementById('emailSubject'),
    emailTags: document.getElementById('emailTags'),
    emailInput: document.getElementById('emailInput'),
    addEmailBtn: document.getElementById('addEmailBtn'),
    emailTemplate: document.getElementById('emailTemplate'),
    smsEnabled: document.getElementById('smsEnabled'),
    smsTags: document.getElementById('smsTags'),
    smsInput: document.getElementById('smsInput'),
    addSmsBtn: document.getElementById('addSmsBtn'),
    smsProvider: document.getElementById('smsProvider'),
    smsTemplate: document.getElementById('smsTemplate'),
    smsCharCount: document.getElementById('smsCharCount'),

    // Onglet historique
    historyTypeFilter: document.getElementById('historyTypeFilter'),
    historyStatusFilter: document.getElementById('historyStatusFilter'),
    historyDateFrom: document.getElementById('historyDateFrom'),
    historyDateTo: document.getElementById('historyDateTo'),
    applyHistoryFiltersBtn: document.getElementById('applyHistoryFiltersBtn'),
    clearHistoryFiltersBtn: document.getElementById('clearHistoryFiltersBtn'),
    historyTableBody: document.getElementById('historyTableBody'),
    historyPaginationInfo: document.getElementById('historyPaginationInfo'),
    historyCurrentPage: document.getElementById('historyCurrentPage'),
    historyTotalPages: document.getElementById('historyTotalPages'),
    historyFirstPageBtn: document.getElementById('historyFirstPageBtn'),
    historyPrevPageBtn: document.getElementById('historyPrevPageBtn'),
    historyNextPageBtn: document.getElementById('historyNextPageBtn'),
    historyLastPageBtn: document.getElementById('historyLastPageBtn'),

    // Onglet alertes actives
    lowStockCount: document.getElementById('lowStockCount'),
    criticalStockCount: document.getElementById('criticalStockCount'),
    expiredReservationsCount: document.getElementById('expiredReservationsCount'),
    sendAlertsNowBtn: document.getElementById('sendAlertsNowBtn'),
    alertTypeTabs: document.querySelectorAll('.alert-tab-btn'),
    lowStockBadge: document.getElementById('lowStockBadge'),
    criticalStockBadge: document.getElementById('criticalStockBadge'),
    expiredReservationsBadge: document.getElementById('expiredReservationsBadge'),
    activeAlertsBody: document.getElementById('activeAlertsBody'),
    alertsSelectionInfo: document.getElementById('alertsSelectionInfo'),
    alertsSelectedCount: document.getElementById('alertsSelectedCount'),
    sendSelectedAlertsBtn: document.getElementById('sendSelectedAlertsBtn'),
    ignoreSelectedAlertsBtn: document.getElementById('ignoreSelectedAlertsBtn'),
    exportAlertsBtn: document.getElementById('exportAlertsBtn'),

    // Modals
    testEmailModal: document.getElementById('testEmailModal'),
    testSmsModal: document.getElementById('testSmsModal'),
    alertDetailsModal: document.getElementById('alertDetailsModal'),
    closeModalBtns: document.querySelectorAll('.close-modal'),

    // Modal test email
    testEmailRecipient: document.getElementById('testEmailRecipient'),
    testEmailMessage: document.getElementById('testEmailMessage'),
    testEmailResult: document.getElementById('testEmailResult'),
    sendTestEmailBtn: document.getElementById('sendTestEmailBtn'),

    // Modal test SMS
    testSmsRecipient: document.getElementById('testSmsRecipient'),
    testSmsMessage: document.getElementById('testSmsMessage'),
    testSmsResult: document.getElementById('testSmsResult'),
    testSmsCharCount: document.getElementById('testSmsCharCount'),
    sendTestSmsBtn: document.getElementById('sendTestSmsBtn'),

    // Modal détails alerte
    alertFullDetails: document.getElementById('alertFullDetails'),
    sendAlertNowBtn: document.getElementById('sendAlertNowBtn'),
    ignoreAlertBtn: document.getElementById('ignoreAlertBtn')
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

        // Vérifier les permissions (admin seulement)
        if (!state.user.permissions?.admin) {
            alert('Accès réservé aux administrateurs');
            window.location.href = 'accueil.html';
            return false;
        }

        // Mettre à jour l'interface
        elements.usernameDisplay.textContent = state.user.username || state.user.email;

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

function calculateNextCheckTime() {
    const now = new Date();
    const [hours, minutes] = state.alertSettings.checkTime.split(':').map(Number);

    let nextCheck = new Date(now);
    nextCheck.setHours(hours, minutes, 0, 0);

    // Si l'heure est déjà passée aujourd'hui, passer à demain
    if (nextCheck < now) {
        nextCheck.setDate(nextCheck.getDate() + 1);
    }

    return nextCheck;
}

function updateNextCheckDisplay() {
    const nextCheck = calculateNextCheckTime();
    elements.nextCheck.textContent = nextCheck.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ===== FONCTIONS SUPABASE =====
async function fetchAlertSettings() {
    try {
        const { data, error } = await supabase
            .from('w_alertes_config')
            .select('*')
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            throw error;
        }

        if (data) {
            state.alertSettings = { ...state.alertSettings, ...data.config };
        }

        loadSettingsToUI();
        updateNextCheckDisplay();

    } catch (error) {
        console.error('Erreur chargement configuration:', error);
        showAlert('Erreur lors du chargement de la configuration', 'error');
    }
}

async function saveAlertSettings() {
    try {
        showLoading();

        const configData = {
            config: state.alertSettings,
            updated_at: new Date().toISOString(),
            updated_by: state.user.id
        };

        // Vérifier si une configuration existe déjà
        const { data: existing } = await supabase
            .from('w_alertes_config')
            .select('id')
            .single();

        let result;
        if (existing) {
            // Mettre à jour
            result = await supabase
                .from('w_alertes_config')
                .update(configData)
                .eq('id', existing.id);
        } else {
            // Créer
            result = await supabase
                .from('w_alertes_config')
                .insert([configData]);
        }

        if (result.error) throw result.error;

        showAlert('Configuration sauvegardée avec succès', 'success');

    } catch (error) {
        console.error('Erreur sauvegarde configuration:', error);
        showAlert('Erreur lors de la sauvegarde', 'error');
    } finally {
        hideLoading();
    }
}

async function fetchArticlesWithLowStock() {
    try {
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('*')
            .order('nom');

        if (error) throw error;

        state.articles = articles || [];

        // Filtrer les articles avec stock bas
        const lowStockArticles = articles.filter(article => {
            const stock = article.stock_actuel || 0;
            return stock <= state.alertSettings.lowStockThreshold;
        });

        return lowStockArticles;

    } catch (error) {
        console.error('Erreur chargement articles:', error);
        return [];
    }
}

async function fetchAlertHistory() {
    try {
        const pageSize = state.historyPagination.pageSize;
        const start = (state.historyPagination.currentPage - 1) * pageSize;
        const end = start + pageSize - 1;

        let query = supabase
            .from('w_alertes_history')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false });

        // Appliquer les filtres
        if (state.filters.type) {
            query = query.eq('type', state.filters.type);
        }

        if (state.filters.status) {
            query = query.eq('status', state.filters.status);
        }

        if (state.filters.dateFrom) {
            query = query.gte('created_at', state.filters.dateFrom);
        }

        if (state.filters.dateTo) {
            const nextDay = new Date(state.filters.dateTo);
            nextDay.setDate(nextDay.getDate() + 1);
            query = query.lt('created_at', nextDay.toISOString());
        }

        const { data, error, count } = await query.range(start, end);

        if (error) throw error;

        state.alertHistory = data || [];
        state.historyPagination.totalItems = count || 0;
        state.historyPagination.totalPages = Math.ceil((count || 0) / pageSize);

        updateHistoryDisplay();
        updateHistoryPagination();

    } catch (error) {
        console.error('Erreur chargement historique:', error);
        showAlert('Erreur lors du chargement de l\'historique', 'error');
    }
}

async function logAlertHistory(alertData) {
    try {
        const { error } = await supabase
            .from('w_alertes_history')
            .insert([{
                ...alertData,
                created_at: new Date().toISOString(),
                created_by: state.user.id
            }]);

        if (error) throw error;

    } catch (error) {
        console.error('Erreur log historique:', error);
    }
}

// ===== GESTION DE LA CONFIGURATION =====
function loadSettingsToUI() {
    const settings = state.alertSettings;

    // Paramètres généraux
    elements.alertEnabled.checked = settings.enabled;
    elements.checkFrequency.value = settings.checkFrequency;
    elements.checkTime.value = settings.checkTime;
    elements.lowStockThreshold.value = settings.lowStockThreshold;
    elements.criticalStockThreshold.value = settings.criticalStockThreshold;

    // Email
    elements.emailEnabled.checked = settings.email.enabled;
    elements.emailSubject.value = settings.email.subject;
    elements.emailTemplate.value = settings.email.template;
    updateEmailTags(settings.email.recipients);

    // SMS
    elements.smsEnabled.checked = settings.sms.enabled;
    elements.smsProvider.value = settings.sms.provider;
    elements.smsTemplate.value = settings.sms.template;
    updateSmsTags(settings.sms.recipients);
    updateSmsCharCount();
}

function updateEmailTags(recipients) {
    elements.emailTags.innerHTML = '';

    recipients.forEach(email => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.innerHTML = `
            ${email}
            <button type="button" class="tag-remove" data-email="${email}">
                <i class="fas fa-times"></i>
            </button>
        `;
        elements.emailTags.appendChild(tag);
    });

    // Ajouter les événements de suppression
    elements.emailTags.querySelectorAll('.tag-remove').forEach(btn => {
        btn.addEventListener('click', function() {
            const email = this.dataset.email;
            removeEmailRecipient(email);
        });
    });
}

function updateSmsTags(recipients) {
    elements.smsTags.innerHTML = '';

    recipients.forEach(phone => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.innerHTML = `
            ${phone}
            <button type="button" class="tag-remove" data-phone="${phone}">
                <i class="fas fa-times"></i>
            </button>
        `;
        elements.smsTags.appendChild(tag);
    });

    // Ajouter les événements de suppression
    elements.smsTags.querySelectorAll('.tag-remove').forEach(btn => {
        btn.addEventListener('click', function() {
            const phone = this.dataset.phone;
            removeSmsRecipient(phone);
        });
    });
}

function addEmailRecipient(email) {
    if (!email || !isValidEmail(email)) {
        showAlert('Adresse email invalide', 'error');
        return;
    }

    if (!state.alertSettings.email.recipients.includes(email)) {
        state.alertSettings.email.recipients.push(email);
        updateEmailTags(state.alertSettings.email.recipients);
        elements.emailInput.value = '';
    }
}

function removeEmailRecipient(email) {
    state.alertSettings.email.recipients = state.alertSettings.email.recipients.filter(e => e !== email);
    updateEmailTags(state.alertSettings.email.recipients);
}

function addSmsRecipient(phone) {
    if (!phone || !isValidPhone(phone)) {
        showAlert('Numéro de téléphone invalide', 'error');
        return;
    }

    if (!state.alertSettings.sms.recipients.includes(phone)) {
        state.alertSettings.sms.recipients.push(phone);
        updateSmsTags(state.alertSettings.sms.recipients);
        elements.smsInput.value = '';
    }
}

function removeSmsRecipient(phone) {
    state.alertSettings.sms.recipients = state.alertSettings.sms.recipients.filter(p => p !== phone);
    updateSmsTags(state.alertSettings.sms.recipients);
}

function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function isValidPhone(phone) {
    const re = /^[0-9]{10}$/;
    return re.test(phone);
}

function updateSmsCharCount() {
    const text = elements.smsTemplate.value;
    const count = text.length;
    elements.smsCharCount.textContent = count;

    if (count > 160) {
        elements.smsCharCount.classList.add('danger');
    } else if (count > 140) {
        elements.smsCharCount.classList.add('warning');
    } else {
        elements.smsCharCount.classList.remove('warning', 'danger');
    }
}

// ===== GESTION DES ALERTES =====
async function checkAlerts() {
    try {
        showLoading();

        const lowStockArticles = await fetchArticlesWithLowStock();
        const criticalArticles = lowStockArticles.filter(article =>
            (article.stock_actuel || 0) <= state.alertSettings.criticalStockThreshold
        );

        // Mettre à jour les statistiques
        updateAlertsStatistics(lowStockArticles, criticalArticles);

        // Mettre à jour l'affichage
        updateActiveAlertsDisplay(lowStockArticles);

        // Si les alertes sont activées et qu'il y a des articles en stock bas
        if (state.alertSettings.enabled && lowStockArticles.length > 0) {
            await sendAlerts(lowStockArticles);
        }

    } catch (error) {
        console.error('Erreur vérification alertes:', error);
        showAlert('Erreur lors de la vérification des alertes', 'error');
    } finally {
        hideLoading();
    }
}

function updateAlertsStatistics(lowStockArticles, criticalArticles) {
    const lowStockCount = lowStockArticles.length;
    const criticalCount = criticalArticles.length;

    elements.activeAlerts.textContent = lowStockCount;
    elements.lowStockCount.textContent = lowStockCount;
    elements.criticalStockCount.textContent = criticalCount;
    elements.lowStockBadge.textContent = lowStockCount;
    elements.criticalStockBadge.textContent = criticalCount;
    elements.activeTabCount.textContent = lowStockCount;

    // Mettre à jour le compteur d'emails/sms (à implémenter avec l'historique)
    // Pour l'instant, valeurs fictives
    elements.emailsSent.textContent = '42';
    elements.smsSent.textContent = '15';
}

function updateActiveAlertsDisplay(articles) {
    if (articles.length === 0) {
        elements.activeAlertsBody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-row">
                    <i class="fas fa-check-circle"></i> Aucune alerte active
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    articles.forEach(article => {
        const stock = article.stock_actuel || 0;
        const isCritical = stock <= state.alertSettings.criticalStockThreshold;
        const alertType = isCritical ? 'critique' : 'bas';
        const threshold = isCritical ?
            state.alertSettings.criticalStockThreshold :
            state.alertSettings.lowStockThreshold;

        html += `
            <tr data-id="${article.id}">
                <td>
                    <div class="article-info">
                        <strong>${article.nom}</strong>
                    </div>
                </td>
                <td>${article.numero || article.code || ''}</td>
                <td>
                    <span class="badge ${isCritical ? 'danger' : 'warning'}">
                        ${stock}
                    </span>
                </td>
                <td>${threshold}</td>
                <td>
                    <span class="badge ${isCritical ? 'danger' : 'warning'}">
                        Stock ${alertType}
                    </span>
                </td>
                <td>${formatDateTime(article.last_alert_date) || 'Jamais'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-small view-alert-details" data-id="${article.id}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-action btn-small send-alert-now" data-id="${article.id}">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    elements.activeAlertsBody.innerHTML = html;
}

async function sendAlerts(articles) {
    if (!state.alertSettings.email.enabled && !state.alertSettings.sms.enabled) {
        return;
    }

    const criticalArticles = articles.filter(article =>
        (article.stock_actuel || 0) <= state.alertSettings.criticalStockThreshold
    );

    // Préparer le contenu des alertes
    const alertContent = generateAlertContent(articles, criticalArticles);

    // Envoyer les emails
    if (state.alertSettings.email.enabled && state.alertSettings.email.recipients.length > 0) {
        await sendEmailAlerts(alertContent);
    }

    // Envoyer les SMS (seulement pour les alertes critiques si configuré)
    if (state.alertSettings.sms.enabled &&
        state.alertSettings.sms.recipients.length > 0 &&
        criticalArticles.length > 0) {
        await sendSmsAlerts(criticalArticles.length);
    }
}

function generateAlertContent(articles, criticalArticles) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR');
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    // Générer la liste des articles
    let articlesList = '';
    articles.forEach(article => {
        const stock = article.stock_actuel || 0;
        const isCritical = criticalArticles.includes(article);
        articlesList += `- ${article.nom} (${article.numero || article.code}) : ${stock} unité${stock > 1 ? 's' : ''} ${isCritical ? '⚠️ CRITIQUE' : ''}\n`;
    });

    // Remplacer les variables dans les templates
    const emailContent = state.alertSettings.email.template
        .replace('{{articles_list}}', articlesList)
        .replace('{{date}}', dateStr)
        .replace('{{time}}', timeStr)
        .replace('{{count}}', articles.length)
        .replace('{{critical_count}}', criticalArticles.length);

    const smsContent = state.alertSettings.sms.template
        .replace('{{count}}', articles.length)
        .replace('{{critical_count}}', criticalArticles.length)
        .replace('{{date}}', dateStr)
        .replace('{{time}}', timeStr);

    return {
        email: {
            subject: state.alertSettings.email.subject,
            body: emailContent
        },
        sms: smsContent,
        articlesCount: articles.length,
        criticalCount: criticalArticles.length
    };
}

async function sendEmailAlerts(content) {
    // Simuler l'envoi d'emails
    // Dans une vraie implémentation, on utiliserait un service d'email (SendGrid, SMTP, etc.)

    state.alertSettings.email.recipients.forEach(async recipient => {
        try {
            console.log(`Email envoyé à ${recipient}:`, content.email);

            // Log dans l'historique
            await logAlertHistory({
                type: 'email',
                recipient: recipient,
                subject: content.email.subject,
                content: content.email.body,
                status: 'sent',
                metadata: {
                    articles_count: content.articlesCount,
                    critical_count: content.criticalCount
                }
            });

        } catch (error) {
            console.error(`Erreur envoi email à ${recipient}:`, error);

            await logAlertHistory({
                type: 'email',
                recipient: recipient,
                subject: content.email.subject,
                content: content.email.body,
                status: 'failed',
                error: error.message
            });
        }
    });

    showAlert(`${state.alertSettings.email.recipients.length} email(s) envoyé(s)`, 'success');
}

async function sendSmsAlerts(criticalCount) {
    // Simuler l'envoi de SMS
    // Dans une vraie implémentation, on utiliserait un service SMS (Twilio, OVH, etc.)

    state.alertSettings.sms.recipients.forEach(async recipient => {
        try {
            const smsContent = state.alertSettings.sms.template
                .replace('{{count}}', criticalCount)
                .replace('{{critical_count}}', criticalCount);

            console.log(`SMS envoyé à ${recipient}:`, smsContent);

            await logAlertHistory({
                type: 'sms',
                recipient: recipient,
                content: smsContent,
                status: 'sent',
                metadata: {
                    critical_count: criticalCount
                }
            });

        } catch (error) {
            console.error(`Erreur envoi SMS à ${recipient}:`, error);

            await logAlertHistory({
                type: 'sms',
                recipient: recipient,
                content: state.alertSettings.sms.template,
                status: 'failed',
                error: error.message
            });
        }
    });

    showAlert(`${state.alertSettings.sms.recipients.length} SMS envoyé(s)`, 'success');
}

// ===== GESTION DE L'HISTORIQUE =====
function updateHistoryDisplay() {
    if (state.alertHistory.length === 0) {
        elements.historyTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="loading-row">
                    <i class="fas fa-info-circle"></i> Aucune alerte dans l'historique
                </td>
            </tr>
        `;
        elements.historyTabCount.textContent = '0';
        return;
    }

    let html = '';
    state.alertHistory.forEach(alert => {
        const metadata = alert.metadata ? JSON.parse(alert.metadata) : {};

        html += `
            <tr>
                <td>${formatDateTime(alert.created_at)}</td>
                <td>
                    <span class="badge ${alert.type === 'email' ? 'info' : 'success'}">
                        ${alert.type === 'email' ? 'Email' : 'SMS'}
                    </span>
                </td>
                <td>${alert.recipient || 'N/A'}</td>
                <td>
                    <div class="alert-content-preview">
                        ${alert.subject ? `<strong>${alert.subject}</strong><br>` : ''}
                        ${truncateText(alert.content || '', 50)}
                    </div>
                </td>
                <td>
                    <span class="badge ${alert.status}">
                        ${alert.status === 'sent' ? 'Envoyé' :
                          alert.status === 'failed' ? 'Échec' : 'En attente'}
                    </span>
                </td>
                <td>
                    <button class="btn-action btn-small view-alert-history" data-id="${alert.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    elements.historyTableBody.innerHTML = html;
    elements.historyTabCount.textContent = state.historyPagination.totalItems;
}

function updateHistoryPagination() {
    elements.historyCurrentPage.textContent = state.historyPagination.currentPage;
    elements.historyTotalPages.textContent = state.historyPagination.totalPages;

    const start = ((state.historyPagination.currentPage - 1) * state.historyPagination.pageSize) + 1;
    const end = Math.min(state.historyPagination.currentPage * state.historyPagination.pageSize,
                        state.historyPagination.totalItems);

    elements.historyPaginationInfo.textContent = `Affichage ${start}-${end} sur ${state.historyPagination.totalItems}`;

    // Désactiver les boutons si nécessaire
    elements.historyFirstPageBtn.disabled = state.historyPagination.currentPage === 1;
    elements.historyPrevPageBtn.disabled = state.historyPagination.currentPage === 1;
    elements.historyNextPageBtn.disabled = state.historyPagination.currentPage === state.historyPagination.totalPages;
    elements.historyLastPageBtn.disabled = state.historyPagination.currentPage === state.historyPagination.totalPages;
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// ===== GESTION DES MODALS =====
function showModal(modalElement) {
    hideModal();
    modalElement.style.display = 'flex';
}

function hideModal() {
    [elements.testEmailModal, elements.testSmsModal, elements.alertDetailsModal].forEach(modal => {
        modal.style.display = 'none';
    });
}

// ===== TESTS D'ENVOI =====
async function sendTestEmail() {
    const recipient = elements.testEmailRecipient.value;
    const message = elements.testEmailMessage.value;

    if (!recipient || !isValidEmail(recipient)) {
        showResult(elements.testEmailResult, 'Adresse email invalide', 'error');
        return;
    }

    try {
        showLoading();

        // Simuler l'envoi d'email
        console.log('Test email envoyé à:', recipient, 'Message:', message);

        // Log dans l'historique
        await logAlertHistory({
            type: 'email',
            recipient: recipient,
            subject: 'Test système d\'alertes',
            content: message,
            status: 'sent',
            is_test: true
        });

        showResult(elements.testEmailResult, 'Email de test envoyé avec succès à ' + recipient, 'success');

        // Rafraîchir l'historique
        await fetchAlertHistory();

    } catch (error) {
        console.error('Erreur envoi test email:', error);
        showResult(elements.testEmailResult, 'Erreur lors de l\'envoi: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function sendTestSms() {
    const recipient = elements.testSmsRecipient.value;
    const message = elements.testSmsMessage.value;

    if (!recipient || !isValidPhone(recipient)) {
        showResult(elements.testSmsResult, 'Numéro de téléphone invalide', 'error');
        return;
    }

    if (message.length > 160) {
        showResult(elements.testSmsResult, 'Message trop long (max 160 caractères)', 'error');
        return;
    }

    try {
        showLoading();

        // Simuler l'envoi de SMS
        console.log('Test SMS envoyé à:', recipient, 'Message:', message);

        // Log dans l'historique
        await logAlertHistory({
            type: 'sms',
            recipient: recipient,
            content: message,
            status: 'sent',
            is_test: true
        });

        showResult(elements.testSmsResult, 'SMS de test envoyé avec succès à ' + recipient, 'success');

        // Rafraîchir l'historique
        await fetchAlertHistory();

    } catch (error) {
        console.error('Erreur envoi test SMS:', error);
        showResult(elements.testSmsResult, 'Erreur lors de l\'envoi: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function showResult(element, message, type) {
    element.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    element.className = `alert-message ${type}`;
    element.style.display = 'flex';
}

// ===== ÉVÉNEMENTS =====
function setupEventListeners() {
    // Déconnexion
    elements.logoutBtn.addEventListener('click', logout);

    // Onglets principaux
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;

            // Mettre à jour les onglets actifs
            elements.tabBtns.forEach(b => b.classList.remove('active'));
            elements.tabContents.forEach(content => content.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`${tabName}Tab`).classList.add('active');
            state.currentTab = tabName;

            // Charger les données spécifiques à l'onglet
            if (tabName === 'history') {
                fetchAlertHistory();
            } else if (tabName === 'active') {
                checkAlerts();
            }
        });
    });

    // Onglets alertes
    elements.alertTypeTabs.forEach(btn => {
        btn.addEventListener('click', function() {
            const type = this.dataset.type;

            // Mettre à jour les onglets actifs
            elements.alertTypeTabs.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // Filtrer les alertes par type
            // (À implémenter si nécessaire)
        });
    });

    // Boutons header
    elements.testEmailBtn.addEventListener('click', () => {
        elements.testEmailRecipient.value = state.user.email || '';
        showModal(elements.testEmailModal);
    });

    elements.testSmsBtn.addEventListener('click', () => {
        showModal(elements.testSmsModal);
    });

    elements.saveSettingsBtn.addEventListener('click', saveSettings);

    // Configuration
    elements.alertEnabled.addEventListener('change', (e) => {
        state.alertSettings.enabled = e.target.checked;
    });

    elements.checkFrequency.addEventListener('change', (e) => {
        state.alertSettings.checkFrequency = e.target.value;
        updateNextCheckDisplay();
    });

    elements.checkTime.addEventListener('change', (e) => {
        state.alertSettings.checkTime = e.target.value;
        updateNextCheckDisplay();
    });

    elements.lowStockThreshold.addEventListener('change', (e) => {
        state.alertSettings.lowStockThreshold = parseInt(e.target.value) || 10;
    });

    elements.criticalStockThreshold.addEventListener('change', (e) => {
        state.alertSettings.criticalStockThreshold = parseInt(e.target.value) || 3;
    });

    elements.emailEnabled.addEventListener('change', (e) => {
        state.alertSettings.email.enabled = e.target.checked;
    });

    elements.emailSubject.addEventListener('change', (e) => {
        state.alertSettings.email.subject = e.target.value;
    });

    elements.emailTemplate.addEventListener('change', (e) => {
        state.alertSettings.email.template = e.target.value;
    });

    elements.addEmailBtn.addEventListener('click', () => {
        addEmailRecipient(elements.emailInput.value.trim());
    });

    elements.emailInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addEmailRecipient(elements.emailInput.value.trim());
        }
    });

    elements.smsEnabled.addEventListener('change', (e) => {
        state.alertSettings.sms.enabled = e.target.checked;
    });

    elements.smsProvider.addEventListener('change', (e) => {
        state.alertSettings.sms.provider = e.target.value;
    });

    elements.smsTemplate.addEventListener('input', (e) => {
        state.alertSettings.sms.template = e.target.value;
        updateSmsCharCount();
        updateTestSmsCharCount();
    });

    elements.addSmsBtn.addEventListener('click', () => {
        addSmsRecipient(elements.smsInput.value.trim());
    });

    elements.smsInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addSmsRecipient(elements.smsInput.value.trim());
        }
    });

    // Historique
    elements.applyHistoryFiltersBtn.addEventListener('click', () => {
        state.filters.type = elements.historyTypeFilter.value;
        state.filters.status = elements.historyStatusFilter.value;
        state.filters.dateFrom = elements.historyDateFrom.value;
        state.filters.dateTo = elements.historyDateTo.value;
        state.historyPagination.currentPage = 1;

        fetchAlertHistory();
    });

    elements.clearHistoryFiltersBtn.addEventListener('click', () => {
        elements.historyTypeFilter.value = '';
        elements.historyStatusFilter.value = '';
        elements.historyDateFrom.value = '';
        elements.historyDateTo.value = '';

        state.filters.type = '';
        state.filters.status = '';
        state.filters.dateFrom = '';
        state.filters.dateTo = '';
        state.historyPagination.currentPage = 1;

        fetchAlertHistory();
    });

    // Pagination historique
    elements.historyFirstPageBtn.addEventListener('click', () => {
        state.historyPagination.currentPage = 1;
        fetchAlertHistory();
    });

    elements.historyPrevPageBtn.addEventListener('click', () => {
        if (state.historyPagination.currentPage > 1) {
            state.historyPagination.currentPage--;
            fetchAlertHistory();
        }
    });

    elements.historyNextPageBtn.addEventListener('click', () => {
        if (state.historyPagination.currentPage < state.historyPagination.totalPages) {
            state.historyPagination.currentPage++;
            fetchAlertHistory();
        }
    });

    elements.historyLastPageBtn.addEventListener('click', () => {
        state.historyPagination.currentPage = state.historyPagination.totalPages;
        fetchAlertHistory();
    });

    // Alertes actives
    elements.sendAlertsNowBtn.addEventListener('click', () => {
        if (confirm('Envoyer toutes les alertes maintenant ?')) {
            checkAlerts();
        }
    });

    elements.sendSelectedAlertsBtn.addEventListener('click', () => {
        if (state.selections.size === 0) return;
        alert(`Envoyer ${state.selections.size} alerte(s) sélectionnée(s) - À implémenter`);
    });

    elements.ignoreSelectedAlertsBtn.addEventListener('click', () => {
        if (state.selections.size === 0) return;
        alert(`Ignorer ${state.selections.size} alerte(s) sélectionnée(s) - À implémenter`);
    });

    // Délégation d'événements
    document.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        // Détails alerte
        if (target.classList.contains('view-alert-details')) {
            const articleId = target.dataset.id;
            showAlertDetails(articleId);
        }

        // Envoyer alerte maintenant
        if (target.classList.contains('send-alert-now')) {
            const articleId = target.dataset.id;
            sendSingleAlert(articleId);
        }

        // Voir historique alerte
        if (target.classList.contains('view-alert-history')) {
            const alertId = target.dataset.id;
            showAlertHistoryDetails(alertId);
        }
    });

    // Modal test email
    elements.sendTestEmailBtn.addEventListener('click', sendTestEmail);

    // Modal test SMS
    elements.sendTestSmsBtn.addEventListener('click', sendTestSms);
    elements.testSmsMessage.addEventListener('input', updateTestSmsCharCount);

    // Fermer les modals
    elements.closeModalBtns.forEach(btn => {
        btn.addEventListener('click', hideModal);
    });

    // Fermer les modals en cliquant à l'extérieur
    [elements.testEmailModal, elements.testSmsModal, elements.alertDetailsModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal();
            }
        });
    });
}

function updateTestSmsCharCount() {
    const text = elements.testSmsMessage.value;
    const count = text.length;
    elements.testSmsCharCount.textContent = count;

    if (count > 160) {
        elements.testSmsCharCount.classList.add('danger');
    } else if (count > 140) {
        elements.testSmsCharCount.classList.add('warning');
    } else {
        elements.testSmsCharCount.classList.remove('warning', 'danger');
    }
}

function saveSettings() {
    // Récupérer les valeurs des champs
    state.alertSettings.enabled = elements.alertEnabled.checked;
    state.alertSettings.checkFrequency = elements.checkFrequency.value;
    state.alertSettings.checkTime = elements.checkTime.value;
    state.alertSettings.lowStockThreshold = parseInt(elements.lowStockThreshold.value) || 10;
    state.alertSettings.criticalStockThreshold = parseInt(elements.criticalStockThreshold.value) || 3;

    state.alertSettings.email.enabled = elements.emailEnabled.checked;
    state.alertSettings.email.subject = elements.emailSubject.value;
    state.alertSettings.email.template = elements.emailTemplate.value;
    // Les destinataires sont déjà dans state.alertSettings.email.recipients

    state.alertSettings.sms.enabled = elements.smsEnabled.checked;
    state.alertSettings.sms.provider = elements.smsProvider.value;
    state.alertSettings.sms.template = elements.smsTemplate.value;
    // Les destinataires sont déjà dans state.alertSettings.sms.recipients

    // Sauvegarder
    saveAlertSettings();
}

async function showAlertDetails(articleId) {
    const article = state.articles.find(a => a.id === articleId);
    if (!article) return;

    const stock = article.stock_actuel || 0;
    const isCritical = stock <= state.alertSettings.criticalStockThreshold;
    const alertType = isCritical ? 'Stock critique' : 'Stock bas';
    const threshold = isCritical ?
        state.alertSettings.criticalStockThreshold :
        state.alertSettings.lowStockThreshold;

    elements.alertFullDetails.innerHTML = `
        <div class="alert-details-section">
            <h4><i class="fas fa-box"></i> Article</h4>
            <div class="alert-detail-item">
                <span class="label">Nom:</span>
                <span class="value">${article.nom}</span>
            </div>
            <div class="alert-detail-item">
                <span class="label">Code:</span>
                <span class="value">${article.numero || article.code || 'N/A'}</span>
            </div>
            <div class="alert-detail-item">
                <span class="label">Description:</span>
                <span class="value">${article.description || 'Non disponible'}</span>
            </div>
        </div>

        <div class="alert-details-section">
            <h4><i class="fas fa-chart-bar"></i> Stock</h4>
            <div class="alert-detail-item">
                <span class="label">Stock actuel:</span>
                <span class="value badge ${isCritical ? 'danger' : 'warning'}">${stock} unités</span>
            </div>
            <div class="alert-detail-item">
                <span class="label">Seuil d'alerte:</span>
                <span class="value">${threshold} unités</span>
            </div>
            <div class="alert-detail-item">
                <span class="label">Type d'alerte:</span>
                <span class="value badge ${isCritical ? 'danger' : 'warning'}">${alertType}</span>
            </div>
        </div>

        <div class="alert-details-section">
            <h4><i class="fas fa-bell"></i> Dernières notifications</h4>
            <div class="alert-detail-item">
                <span class="label">Dernière alerte:</span>
                <span class="value">${formatDateTime(article.last_alert_date) || 'Jamais'}</span>
            </div>
            <div class="alert-detail-item">
                <span class="label">Alertes ce mois:</span>
                <span class="value">${article.alert_count || 0}</span>
            </div>
        </div>
    `;

    // Stocker l'ID d'article pour les actions
    elements.sendAlertNowBtn.dataset.id = articleId;
    elements.ignoreAlertBtn.dataset.id = articleId;

    showModal(elements.alertDetailsModal);
}

async function showAlertHistoryDetails(alertId) {
    const alert = state.alertHistory.find(a => a.id === alertId);
    if (!alert) return;

    const metadata = alert.metadata ? JSON.parse(alert.metadata) : {};

    elements.alertFullDetails.innerHTML = `
        <div class="alert-details-section">
            <h4><i class="fas ${alert.type === 'email' ? 'fa-envelope' : 'fa-sms'}"></i> Notification</h4>
            <div class="alert-detail-item">
                <span class="label">Type:</span>
                <span class="value badge ${alert.type === 'email' ? 'info' : 'success'}">
                    ${alert.type === 'email' ? 'Email' : 'SMS'}
                </span>
            </div>
            <div class="alert-detail-item">
                <span class="label">Destinataire:</span>
                <span class="value">${alert.recipient}</span>
            </div>
            <div class="alert-detail-item">
                <span class="label">Date:</span>
                <span class="value">${formatDateTime(alert.created_at)}</span>
            </div>
            <div class="alert-detail-item">
                <span class="label">Statut:</span>
                <span class="value badge ${alert.status}">
                    ${alert.status === 'sent' ? 'Envoyé' :
                      alert.status === 'failed' ? 'Échec' : 'En attente'}
                </span>
            </div>
        </div>

        <div class="alert-details-section">
            <h4><i class="fas fa-file-alt"></i> Contenu</h4>
            ${alert.subject ? `
            <div class="alert-detail-item">
                <span class="label">Sujet:</span>
                <span class="value">${alert.subject}</span>
            </div>
            ` : ''}
            <div class="alert-detail-item">
                <span class="label">Message:</span>
                <span class="value">
                    <pre style="white-space: pre-wrap; background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 0;">${alert.content}</pre>
                </span>
            </div>
        </div>

        ${Object.keys(metadata).length > 0 ? `
        <div class="alert-details-section">
            <h4><i class="fas fa-info-circle"></i> Métadonnées</h4>
            ${Object.entries(metadata).map(([key, value]) => `
                <div class="alert-detail-item">
                    <span class="label">${key}:</span>
                    <span class="value">${value}</span>
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${alert.error ? `
        <div class="alert-details-section">
            <h4><i class="fas fa-exclamation-triangle"></i> Erreur</h4>
            <div class="alert-detail-item">
                <span class="label">Message:</span>
                <span class="value" style="color: #dc3545;">${alert.error}</span>
            </div>
        </div>
        ` : ''}
    `;

    showModal(elements.alertDetailsModal);
}

async function sendSingleAlert(articleId) {
    const article = state.articles.find(a => a.id === articleId);
    if (!article) return;

    try {
        showLoading();

        // Simuler l'envoi d'une alerte pour cet article
        const stock = article.stock_actuel || 0;
        const isCritical = stock <= state.alertSettings.criticalStockThreshold;

        // Envoyer l'email
        if (state.alertSettings.email.enabled) {
            const content = `Alerte stock pour l'article ${article.nom} (${article.numero || article.code}) : ${stock} unités restantes`;

            state.alertSettings.email.recipients.forEach(async recipient => {
                await logAlertHistory({
                    type: 'email',
                    recipient: recipient,
                    subject: `[Stock] Alerte pour ${article.nom}`,
                    content: content,
                    status: 'sent',
                    metadata: {
                        article_id: article.id,
                        article_name: article.nom,
                        stock: stock,
                        is_critical: isCritical
                    }
                });
            });
        }

        // Envoyer le SMS si critique
        if (isCritical && state.alertSettings.sms.enabled) {
            const content = `Alerte critique: ${article.nom} - ${stock} unités`;

            state.alertSettings.sms.recipients.forEach(async recipient => {
                await logAlertHistory({
                    type: 'sms',
                    recipient: recipient,
                    content: content,
                    status: 'sent',
                    metadata: {
                        article_id: article.id,
                        article_name: article.nom,
                        stock: stock
                    }
                });
            });
        }

        showAlert(`Alerte envoyée pour ${article.nom}`, 'success');

        // Rafraîchir l'historique
        await fetchAlertHistory();

    } catch (error) {
        console.error('Erreur envoi alerte unique:', error);
        showAlert('Erreur lors de l\'envoi de l\'alerte', 'error');
    } finally {
        hideLoading();
    }
}

// ===== INITIALISATION =====
async function init() {
    try {
        showLoading();

        // Vérifier l'authentification
        const isLoggedIn = await checkAuth();
        if (!isLoggedIn) {
            return;
        }

        // Charger la configuration
        await fetchAlertSettings();

        // Configurer les événements
        setupEventListeners();

        // Configurer les dates par défaut
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        elements.historyDateFrom.value = weekAgo.toISOString().split('T')[0];
        elements.historyDateTo.value = today;

        // Charger les données initiales
        await Promise.all([
            fetchAlertHistory(),
            fetchArticlesWithLowStock()
        ]);

        // Vérifier les alertes
        await checkAlerts();

        hideLoading();

    } catch (error) {
        console.error('Erreur initialisation:', error);
        showAlert('Erreur lors de l\'initialisation de l\'application', 'error');
        hideLoading();
    }
}

// Démarrer l'application
document.addEventListener('DOMContentLoaded', init);