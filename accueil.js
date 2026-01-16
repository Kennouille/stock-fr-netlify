import { supabase } from './supabaseClient.js';

// Éléments DOM
let currentUser = null;

const now = new Date();
const dateFr = now.toISOString().split('T')[0]; // Format YYYY-MM-DD
const timeFr = now.toTimeString().split(' ')[0]; // Format HH:MM:SS

document.addEventListener('DOMContentLoaded', async function() {
    // Vérifier l'authentification
    await checkAuth();

    // Charger les données
    await loadPageData();

    // Configurer les événements
    setupEventListeners();
});

// ===== FONCTIONS D'AUTHENTIFICATION =====
async function checkAuth() {
    const loadingOverlay = document.getElementById('loadingOverlay');

    try {
        // Récupérer l'utilisateur depuis sessionStorage
        const userJson = sessionStorage.getItem('current_user');

        if (!userJson) {
            // Pas connecté, rediriger vers login
            window.location.href = 'connexion.html';
            return;
        }

        currentUser = JSON.parse(userJson);

        // Mettre à jour l'interface avec les infos utilisateur
        updateUserInterface();

        // Afficher/cacher la section admin
        toggleAdminSection();

        // Cacher le loading
        loadingOverlay.style.display = 'none';

    } catch (error) {
        console.error('Erreur d\'authentification:', error);
        sessionStorage.removeItem('current_user');
        window.location.href = 'connexion.html';
    }
}

function updateUserInterface() {
    // Mettre à jour le nom d'utilisateur
    document.getElementById('usernameDisplay').textContent = currentUser.username;

    // Mettre à jour le badge de rôle
    const roleBadge = document.getElementById('userRoleBadge');
    const roleText = document.getElementById('roleText');

    if (currentUser.isAdmin) {
        roleBadge.classList.add('admin');
        roleText.textContent = 'Administrateur';
    } else {
        roleBadge.classList.add('user');
        roleText.textContent = 'Utilisateur';
    }
}

function toggleAdminSection() {
    const adminSection = document.getElementById('adminSection');

    if (currentUser.isAdmin) {
        adminSection.style.display = 'block';
        loadAdminData();
        setupAdminButtons();
    } else {
        adminSection.style.display = 'none';
    }
}

// ===== CHARGEMENT DES DONNÉES =====
async function loadPageData() {
    await Promise.all([
        loadStats(),
        loadAdminData()
    ]);

    // Mettre à jour la dernière synchronisation
    updateLastSync();

    // Ajoute ces lignes où tu initialises les événements
    document.getElementById('exportStockBasBtn')?.addEventListener('click', exportStockBasPDF);
    document.getElementById('exportRuptureBtn')?.addEventListener('click', exportRupturePDF);
}

async function loadStats() {
    try {
        // Compter le nombre total d'articles
        const { count: totalArticles, error: countError } = await supabase
            .from('w_articles')
            .select('*', { count: 'exact', head: true });

        if (!countError) {
            document.getElementById('totalArticles').textContent = totalArticles;
        }

        // Calculer les articles en stock
        const { data: articles, error: articlesError } = await supabase
            .from('w_articles')
            .select('stock_actuel, stock_reserve, prix_unitaire');

        if (!articlesError && articles) {
            let totalEnStock = 0;
            let totalReserves = 0;
            let valeurTotale = 0;

            articles.forEach(article => {
                totalEnStock += article.stock_actuel || 0;
                totalReserves += article.stock_reserve || 0;
                valeurTotale += (article.stock_actuel || 0) * (article.prix_unitaire || 0);
            });

            document.getElementById('articlesEnStock').textContent = totalEnStock;
            document.getElementById('articlesReserves').textContent = totalReserves;
            document.getElementById('valeurStock').textContent = valeurTotale.toFixed(2) + ' €';
        }

    } catch (error) {
        console.error('Erreur lors du chargement des stats:', error);
    }
}

async function loadAdminData() {
    if (!currentUser.isAdmin) return;

    await Promise.all([
        loadStockBas(),
        loadRuptures()
    ]);
}

async function loadStockBas() {
    try {
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('nom, stock_actuel, stock_minimum, stock_reserve')
            .gt('stock_minimum', 0)
            .order('stock_actuel', { ascending: true });

        const tbody = document.getElementById('tbodyStockBas');
        const table = document.getElementById('tableStockBas');
        const loading = document.getElementById('stockBasLoading');
        const empty = document.getElementById('noStockBas');

        if (error) throw error;

        // Cacher le loading
        loading.style.display = 'none';

        if (!articles || articles.length === 0) {
            empty.style.display = 'block';
            table.style.display = 'none';
            return;
        }

        // Afficher le tableau
        table.style.display = 'table';

        // Filtrer les articles en stock bas (en tenant compte des réservations)
        // ET exclure ceux qui sont en rupture (disponible ≤ 0)
        const stockBas = articles.filter(article => {
            const disponible = article.stock_actuel - article.stock_reserve;
            return disponible > 0 && // EXCLURE les ruptures
                   disponible <= article.stock_minimum;
        });

        if (stockBas.length === 0) {
            empty.style.display = 'block';
            table.style.display = 'none';
            return;
        }

        // Remplir le tableau
        tbody.innerHTML = '';
        stockBas.forEach(article => {
            const disponible = article.stock_actuel - article.stock_reserve;
            const diff = disponible - article.stock_minimum;
            const row = document.createElement('tr');

            row.innerHTML = `
                <td>${article.nom}</td>
                <td>${disponible} (Stock: ${article.stock_actuel}, Réservé: ${article.stock_reserve})</td>
                <td>${article.stock_minimum}</td>
                <td class="${diff < 0 ? 'text-danger' : diff === 0 ? 'text-warning' : ''}">
                    ${diff}
                </td>
            `;

            tbody.appendChild(row);
        });

    } catch (error) {
        console.error('Erreur lors du chargement du stock bas:', error);
    }
}

async function loadRuptures() {
    try {
        // Chercher les articles en rupture (disponible ≤ 0)
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('nom, stock_actuel, stock_reserve')
            .order('nom');

        const tbody = document.getElementById('tbodyRupture');
        const table = document.getElementById('tableRupture');
        const loading = document.getElementById('ruptureLoading');
        const empty = document.getElementById('noRupture');

        if (error) throw error;

        // Cacher le loading
        loading.style.display = 'none';

        if (!articles || articles.length === 0) {
            empty.style.display = 'block';
            table.style.display = 'none';
            return;
        }

        // Filtrer les articles en rupture (disponible ≤ 0)
        const ruptures = articles.filter(article => {
            const disponible = article.stock_actuel - article.stock_reserve;
            return disponible <= 0; // Rupture = disponible ≤ 0
        });

        if (ruptures.length === 0) {
            empty.style.display = 'block';
            table.style.display = 'none';
            return;
        }

        // Afficher le tableau
        table.style.display = 'table';

        // Remplir le tableau
        tbody.innerHTML = '';
        ruptures.forEach(article => {
            const disponible = article.stock_actuel - article.stock_reserve;
            const row = document.createElement('tr');

            row.innerHTML = `
                <td>${article.nom}</td>
                <td>Stock: ${article.stock_actuel}, Réservé: ${article.stock_reserve}</td>
                <td class="text-danger">${disponible} unité(s) disponible(s)</td>
            `;

            tbody.appendChild(row);
        });

    } catch (error) {
        console.error('Erreur lors du chargement des ruptures:', error);
    }
}

// ===== CONFIGURATION DES BOUTONS ADMIN =====
function setupAdminButtons() {
    const adminButtons = document.getElementById('adminButtons');
    const permissions = currentUser.permissions || {};

    // Boutons avec leurs permissions correspondantes
    const buttons = [
        { id: 'statistiques', icon: 'fas fa-chart-bar', text: 'Statistiques', perm: 'stats' },
        { id: 'creation', icon: 'fas fa-plus-circle', text: 'Créer article', perm: 'creation' },
        { id: 'historique', icon: 'fas fa-history', text: 'Historique', perm: 'historique' },
        { id: 'impression', icon: 'fas fa-print', text: 'Impression', perm: 'impression' },
        { id: 'configuration', icon: 'fas fa-cog', text: 'Configuration', perm: 'config' },
        { id: 'gestion', icon: 'fas fa-box-open', text: 'Gestion articles', perm: 'gestion' },
        { id: 'projet', icon: 'fas fa-project-diagram', text: 'Gestion projets', perm: 'projets' },
        { id: 'reservations', icon: 'fas fa-clipboard-list', text: 'Réservations', perm: 'reservations' }
    ];

    // Filtrer les boutons selon les permissions
    const allowedButtons = buttons.filter(btn => permissions[btn.perm]);

    // Mettre à jour le compteur de permissions
    document.getElementById('permissionsCount').textContent =
        `${allowedButtons.length} permissions`;

    // Créer les boutons
    adminButtons.innerHTML = '';
    allowedButtons.forEach(btn => {
        const button = document.createElement('button');
        button.className = 'admin-btn';
        button.id = `${btn.id}Btn`;
        button.innerHTML = `
            <i class="${btn.icon}"></i>
            <span>${btn.text}</span>
        `;

        // Ajouter l'événement de clic
        button.addEventListener('click', () => {
            window.location.href = `${btn.id}.html`;
        });

        adminButtons.appendChild(button);
    });

    // Si aucun bouton, afficher un message
    if (allowedButtons.length === 0) {
        adminButtons.innerHTML = `
            <div class="alert-empty">
                <i class="fas fa-info-circle"></i>
                <p>Aucune permission d'administration</p>
            </div>
        `;
    }
}

// ===== CONFIGURATION DES ÉVÉNEMENTS =====
function setupEventListeners() {
    // Déconnexion
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Actions rapides
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', handleQuickAction);
    });

    // Recherche
    document.getElementById('searchNomBtn').addEventListener('click', searchByName);
    document.getElementById('searchCodebarreBtn').addEventListener('click', searchByCodebarre);

    // Recherche avec Entrée
    document.getElementById('searchNomInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchByName();
    });

    document.getElementById('searchCodebarreInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchByCodebarre();
    });

    // Export PDF (admin seulement)
    if (currentUser.isAdmin) {
        document.getElementById('exportStockBasBtn').addEventListener('click', exportStockBasPDF);
        document.getElementById('exportRuptureBtn').addEventListener('click', exportRupturePDF);
    }
}

// ===== POPUP DE RECHERCHE =====
function openSearchPopup(results, searchType) {
    // Créer le popup
    const popup = document.createElement('div');
    popup.className = 'search-popup-overlay';
    popup.innerHTML = `
        <div class="search-popup">
            <div class="popup-header">
                <h3>Résultats de recherche (${results.length})</h3>
                <button class="close-popup">&times;</button>
            </div>
            <div class="popup-content">
                <div class="results-list">
                    ${results.map((article, index) => `
                        <div class="result-item" data-id="${article.id}">
                            <div class="result-main">
                                <h4>${article.nom}</h4>
                                <div class="result-details">
                                    <span>${article.numero}</span>
                                    <span>${article.code_barre || 'Pas de code-barre'}</span>
                                    <span>Stock: ${article.stock_actuel || 0}</span>
                                    <span>${article.prix_unitaire ? article.prix_unitaire + '€' : ''}</span>
                                </div>
                            </div>
                            <div class="result-actions">
                                <button class="btn-action view-details" data-index="${index}">
                                    <i class="fas fa-eye"></i> Détails
                                </button>
                                <button class="btn-action quick-edit" data-id="${article.id}">
                                    <i class="fas fa-edit"></i> Modifier
                                </button>
                                <button class="btn-action print-label" data-id="${article.id}">
                                    <i class="fas fa-print"></i> Étiquette
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="popup-footer">
                <button class="btn btn-secondary close-popup-btn">Fermer</button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Ajouter les événements
    popup.querySelector('.close-popup').addEventListener('click', () => {
        document.body.removeChild(popup);
    });

    popup.querySelector('.close-popup-btn').addEventListener('click', () => {
        document.body.removeChild(popup);
    });

    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            document.body.removeChild(popup);
        }
    });

    // Événements pour les boutons d'action
    popup.querySelectorAll('.view-details').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = this.dataset.index;
            openArticleDetailsPopup(results[index]);
        });
    });

    popup.querySelectorAll('.quick-edit').forEach(btn => {
        btn.addEventListener('click', function() {
            const articleId = this.dataset.id;
            openEditArticlePopup(articleId);
        });
    });

    popup.querySelectorAll('.print-label').forEach(btn => {
        btn.addEventListener('click', function() {
            const articleId = this.dataset.id;
            openPrintLabelPopup(results.find(a => a.id === articleId));
        });
    });
}

// ===== POPUP DÉTAILS ARTICLE =====
function openArticleDetailsPopup(article) {
    const popup = document.createElement('div');
    popup.className = 'details-popup-overlay';
    popup.innerHTML = `
        <div class="details-popup">
            <div class="popup-header">
                <h3>${article.nom}</h3>
                <button class="close-popup">&times;</button>
            </div>
            <div class="popup-content">
                <div class="article-details-grid">
                    <div class="detail-item">
                        <label>Numéro:</label>
                        <span>${article.numero || 'Non renseigné'}</span>
                    </div>
                    <div class="detail-item">
                        <label>Code-barre:</label>
                        <span>${article.code_barre || 'Non renseigné'}</span>
                    </div>
                    <div class="detail-item">
                        <label>Stock actuel:</label>
                        <span class="${article.stock_actuel <= (article.stock_minimum || 0) ? 'text-danger' : ''}">
                            ${article.stock_actuel || 0}
                        </span>
                    </div>
                    <div class="detail-item">
                        <label>Stock minimum:</label>
                        <span>${article.stock_minimum || 0}</span>
                    </div>
                    <div class="detail-item">
                        <label>Stock réservé:</label>
                        <span>${article.stock_reserve || 0}</span>
                    </div>
                    <div class="detail-item">
                        <label>Prix unitaire:</label>
                        <span>${article.prix_unitaire ? article.prix_unitaire + '€' : 'Non renseigné'}</span>
                    </div>
                    <div class="detail-item full-width">
                        <label>Description:</label>
                        <p>${article.description || 'Aucune description'}</p>
                    </div>
                    <div class="detail-item full-width">
                        <label>Emplacement:</label>
                        <span>${article.emplacement || 'Non renseigné'}</span>
                    </div>
                </div>

                <div class="action-buttons">
                    <button class="btn btn-primary edit-article-btn" data-id="${article.id}">
                        <i class="fas fa-edit"></i> Modifier
                    </button>
                    <button class="btn btn-secondary print-single-btn" data-id="${article.id}">
                        <i class="fas fa-print"></i> Imprimer une étiquette
                    </button>
                    ${currentUser.permissions?.historique ? `
                        <button class="btn btn-info view-history-btn" data-id="${article.id}">
                            <i class="fas fa-history"></i> Historique
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Événements
    popup.querySelector('.close-popup').addEventListener('click', () => {
        document.body.removeChild(popup);
    });

    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            document.body.removeChild(popup);
        }
    });

    popup.querySelector('.edit-article-btn')?.addEventListener('click', () => {
        document.body.removeChild(popup);
        openEditArticlePopup(article.id);
    });

    popup.querySelector('.print-single-btn')?.addEventListener('click', () => {
        document.body.removeChild(popup);
        openPrintLabelPopup(article);
    });

    popup.querySelector('.view-history-btn')?.addEventListener('click', () => {
        document.body.removeChild(popup);
        openHistoryPopup(article.id);
    });
}

// ===== POPUP MODIFICATION ARTICLE =====
async function openEditArticlePopup(articleId) {
    try {
        // Charger l'article
        const { data: article, error } = await supabase
            .from('w_articles')
            .select('*')
            .eq('id', articleId)
            .single();

        if (error) throw error;

        const popup = document.createElement('div');
        popup.className = 'edit-popup-overlay';
        popup.innerHTML = `
            <div class="edit-popup">
                <div class="popup-header">
                    <h3>Modifier: ${article.nom}</h3>
                    <button class="close-popup">&times;</button>
                </div>
                <div class="popup-content">
                    <form id="editArticleForm">
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="editNom">Nom *</label>
                                <input type="text" id="editNom" value="${article.nom || ''}" required>
                            </div>
                            <div class="form-group">
                                <label for="editNumero">Numéro *</label>
                                <input type="text" id="editNumero" value="${article.numero || ''}" required>
                            </div>
                            <div class="form-group">
                                <label for="editCodeBarre">Code-barre</label>
                                <input type="text" id="editCodeBarre" value="${article.code_barre || ''}">
                            </div>
                            <div class="form-group">
                                <label for="editStockActuel">Stock actuel</label>
                                <input type="number" id="editStockActuel" value="${article.stock_actuel || 0}" min="0">
                            </div>
                            <div class="form-group">
                                <label for="editStockMinimum">Stock minimum</label>
                                <input type="number" id="editStockMinimum" value="${article.stock_minimum || 0}" min="0">
                            </div>
                            <div class="form-group">
                                <label for="editPrix">Prix unitaire (€)</label>
                                <input type="number" id="editPrix" step="0.01" value="${article.prix_unitaire || ''}">
                            </div>
                            <div class="form-group full-width">
                                <label for="editDescription">Description</label>
                                <textarea id="editDescription" rows="3">${article.description || ''}</textarea>
                            </div>
                            <div class="form-group">
                                <label for="editEmplacement">Emplacement</label>
                                <input type="text" id="editEmplacement" value="${article.emplacement || ''}">
                            </div>
                            <div class="form-group">
                                <label for="editCategorie">Catégorie</label>
                                <input type="text" id="editCategorie" value="${article.categorie || ''}">
                            </div>
                        </div>

                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary close-popup-btn">Annuler</button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save"></i> Enregistrer
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(popup);

        // Événements
        popup.querySelector('.close-popup').addEventListener('click', () => {
            document.body.removeChild(popup);
        });

        popup.querySelector('.close-popup-btn').addEventListener('click', () => {
            document.body.removeChild(popup);
        });

        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                document.body.removeChild(popup);
            }
        });

        // Soumission du formulaire
        popup.querySelector('#editArticleForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            try {
                const updatedData = {
                    nom: document.getElementById('editNom').value,
                    numero: document.getElementById('editNumero').value,
                    code_barre: document.getElementById('editCodeBarre').value || null,
                    stock_actuel: parseInt(document.getElementById('editStockActuel').value) || 0,
                    stock_minimum: parseInt(document.getElementById('editStockMinimum').value) || 0,
                    prix_unitaire: parseFloat(document.getElementById('editPrix').value) || null,
                    description: document.getElementById('editDescription').value || null,
                    emplacement: document.getElementById('editEmplacement').value || null,
                    categorie: document.getElementById('editCategorie').value || null,
                    updated_at: new Date().toISOString()
                };

                const { error } = await supabase
                    .from('w_articles')
                    .update(updatedData)
                    .eq('id', articleId);

                if (error) throw error;

                alert('Article modifié avec succès !');
                document.body.removeChild(popup);

                // Recharger les données
                await loadPageData();

            } catch (error) {
                console.error('Erreur modification article:', error);
                alert('Erreur lors de la modification');
            }
        });

    } catch (error) {
        console.error('Erreur chargement article:', error);
        alert('Erreur lors du chargement de l\'article');
    }
}

// ===== POPUP IMPRESSION ÉTIQUETTE =====
function openPrintLabelPopup(article) {
    const popup = document.createElement('div');
    popup.className = 'print-popup-overlay';
    popup.innerHTML = `
        <div class="print-popup">
            <div class="popup-header">
                <h3>Imprimer une étiquette</h3>
                <button class="close-popup">&times;</button>
            </div>
            <div class="popup-content">
                <div class="print-preview">
                    <div class="label-preview" id="singleLabelPreview">
                        <div class="label-title">${article.nom}</div>
                        <div class="label-details">
                            <div>${article.numero}</div>
                            <div>Stock: ${article.stock_actuel || 0}</div>
                            ${article.prix_unitaire ? `<div>${article.prix_unitaire}€</div>` : ''}
                        </div>
                        <div class="label-barcode">
                            ${article.code_barre || article.numero}
                        </div>
                    </div>
                </div>

                <div class="print-options">
                    <div class="form-group">
                        <label for="printCopies">Nombre de copies</label>
                        <input type="number" id="printCopies" value="1" min="1" max="100">
                    </div>

                    <div class="form-group">
                        <label for="printFormat">Format</label>
                        <select id="printFormat">
                            <option value="small">Petite (40x20mm)</option>
                            <option value="medium" selected>Moyenne (60x40mm)</option>
                            <option value="large">Grande (100x70mm)</option>
                        </select>
                    </div>

                    <div class="checkbox-group">
                        <label>
                            <input type="checkbox" id="showPrice" checked> Afficher le prix
                        </label>
                        <label>
                            <input type="checkbox" id="showStock" checked> Afficher le stock
                        </label>
                        <label>
                            <input type="checkbox" id="showDate"> Afficher la date
                        </label>
                    </div>
                </div>

                <div class="print-actions">
                    <button type="button" class="btn btn-secondary close-popup-btn">Annuler</button>
                    <button type="button" class="btn btn-primary" id="printLabelBtn">
                        <i class="fas fa-print"></i> Imprimer
                    </button>
                    <button type="button" class="btn btn-info" id="addToPrintQueueBtn">
                        <i class="fas fa-list"></i> Ajouter à la file
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Événements
    popup.querySelector('.close-popup').addEventListener('click', () => {
        document.body.removeChild(popup);
    });

    popup.querySelector('.close-popup-btn').addEventListener('click', () => {
        document.body.removeChild(popup);
    });

    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            document.body.removeChild(popup);
        }
    });

    // Bouton imprimer
    popup.querySelector('#printLabelBtn').addEventListener('click', () => {
        const copies = parseInt(popup.querySelector('#printCopies').value) || 1;
        alert(`Impression de ${copies} étiquette(s) pour: ${article.nom}\n(À intégrer avec le module d'impression)`);
        document.body.removeChild(popup);
    });

    // Bouton ajouter à la file
    popup.querySelector('#addToPrintQueueBtn').addEventListener('click', () => {
        const copies = parseInt(popup.querySelector('#printCopies').value) || 1;
        alert(`${copies} étiquette(s) ajoutée(s) à la file d'impression pour: ${article.nom}`);
        document.body.removeChild(popup);
    });
}

// ===== POPUP HISTORIQUE =====
async function openHistoryPopup(articleId) {
    try {
        const { data: mouvements, error } = await supabase
            .from('w_mouvements')
            .select(`
                *,
                w_articles:article_id (nom, numero, code_barre),
                w_projets:projet_id (nom, numero)
            `)
            .eq('article_id', articleId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        const popup = document.createElement('div');
        popup.className = 'history-popup-overlay';

        let tableHTML = '';
        if (mouvements && mouvements.length > 0) {
            tableHTML = `
                <div class="history-table-container">
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Quantité</th>
                                <th>Stock avant</th>
                                <th>Stock après</th>
                                <th>Projet</th>
                                <th>Utilisateur</th>
                                <th>Raison/Commentaire</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${mouvements.map(mvt => {
                                const article = mvt.w_articles;
                                const projet = mvt.w_projets;

                                // Déterminer le type avec icône
                                let typeIcon = '';
                                let typeText = '';
                                let typeClass = '';

                                switch(mvt.type) {
                                    case 'entree':
                                        typeIcon = 'fa-plus-circle';
                                        typeText = 'Entrée';
                                        typeClass = 'success';
                                        break;
                                    case 'sortie':
                                        typeIcon = 'fa-minus-circle';
                                        typeText = 'Sortie';
                                        typeClass = 'danger';
                                        break;
                                    case 'reservation':
                                        typeIcon = 'fa-calendar-check';
                                        typeText = 'Réservation';
                                        typeClass = 'warning';
                                        break;
                                    default:
                                        typeIcon = 'fa-exchange-alt';
                                        typeText = 'Ajustement';
                                        typeClass = 'info';
                                }

                                // Formatage date
                                const dateFormatted = mvt.date_mouvement ?
                                    mvt.date_mouvement.split('-').reverse().join('/') : // Convertir 2024-01-15 en 15/01/2024
                                    new Date(mvt.created_at).toLocaleDateString('fr-FR');

                                const timeFormatted = mvt.heure_mouvement ?
                                    mvt.heure_mouvement.substring(0, 5) : // Garder HH:MM seulement
                                    new Date(mvt.created_at).toLocaleTimeString('fr-FR', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    });

                                // Projet info
                                let projetInfo = '';
                                if (mvt.projet_nom || projet?.nom) {
                                    const projetNom = mvt.projet_nom || projet?.nom || '';
                                    const projetNumero = projet?.numero || '';
                                    projetInfo = `${projetNom} ${projetNumero ? `(${projetNumero})` : ''}`;
                                }

                                // Raison/Commentaire
                                let raisonComment = '';
                                if (mvt.raison) {
                                    raisonComment += `<div><strong>Raison:</strong> ${mvt.raison}</div>`;
                                }
                                if (mvt.commentaire) {
                                    raisonComment += `<div><strong>Commentaire:</strong> ${mvt.commentaire}</div>`;
                                }
                                if (mvt.motif) {
                                    raisonComment += `<div><strong>Motif:</strong> ${mvt.motif}</div>`;
                                }

                                return `
                                    <tr>
                                        <td>
                                            <div>${dateFormatted}</div>
                                            <small class="text-muted">${timeFormatted}</small>
                                        </td>
                                        <td>
                                            <span class="badge badge-${typeClass}">
                                                <i class="fas ${typeIcon}"></i> ${typeText}
                                            </span>
                                        </td>
                                        <td class="${mvt.type === 'entree' ? 'text-success' : 'text-danger'}">
                                            ${mvt.type === 'entree' ? '+' : '-'}${mvt.quantite}
                                        </td>
                                        <td>${mvt.stock_avant}</td>
                                        <td>${mvt.stock_apres}</td>
                                        <td>${projetInfo || '-'}</td>
                                        <td>
                                            <div>${mvt.utilisateur || '-'}</div>
                                            ${mvt.responsable ? `<small>Resp: ${mvt.responsable}</small>` : ''}
                                        </td>
                                        <td class="text-left">${raisonComment || '-'}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            tableHTML = `
                <div class="empty-history">
                    <i class="fas fa-history"></i>
                    <p>Aucun mouvement enregistré pour cet article</p>
                </div>
            `;
        }

        popup.innerHTML = `
            <div class="history-popup">
                <div class="popup-header">
                    <h3><i class="fas fa-history"></i> Historique des mouvements</h3>
                    <button class="close-popup">&times;</button>
                </div>
                <div class="popup-content">
                    ${tableHTML}
                </div>
                <div class="popup-footer">
                    <button class="btn btn-secondary close-popup-btn">Fermer</button>
                </div>
            </div>
        `;

        document.body.appendChild(popup);

        // Événements
        popup.querySelector('.close-popup').addEventListener('click', () => {
            document.body.removeChild(popup);
        });

        popup.querySelector('.close-popup-btn').addEventListener('click', () => {
            document.body.removeChild(popup);
        });

        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                document.body.removeChild(popup);
            }
        });

    } catch (error) {
        console.error('Erreur chargement historique:', error);
        alert('Erreur lors du chargement de l\'historique');
    }
}

// ===== GESTION DES ACTIONS =====
function handleQuickAction(e) {
    const action = e.target.closest('.option-btn').dataset.action;
    const type = e.target.closest('.option-btn').dataset.type;

    // Selon le type (scan ou saisie), ouvrir le bon popup
    if (type === 'scan') {
        openScanPopup(action, 'scan');
    } else {
        // Ouvrir directement le popup de saisie
        switch(action) {
            case 'sortie':
                openStockOutPopup();
                break;
            case 'entree':
                openStockInPopup();
                break;
            case 'reservation':
                openProjectReservationPopup();
                break;
        }
    }
}

async function searchByName() {
    const searchTerm = document.getElementById('searchNomInput').value.trim();

    if (!searchTerm) {
        alert('Veuillez entrer un terme de recherche');
        return;
    }

    try {
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('*')
            .or(`nom.ilike.%${searchTerm}%,numero.ilike.%${searchTerm}%`)
            .limit(10);

        if (error) throw error;

        if (!articles || articles.length === 0) {
            alert('Aucun article trouvé');
            return;
        }

        openSearchPopup(articles, 'nom');

        // ========== AJOUTER CES 3 LIGNES ==========
        // Mettre à jour la vue Quad avec le premier article trouvé
        if (articles[0] && window.accueilQuadManager) {
            window.accueilQuadManager.highlightArticleLocationFromArticle(articles[0]);
        }
        // ========== FIN AJOUT ==========

    } catch (error) {
        console.error('Erreur de recherche:', error);
        alert('Erreur lors de la recherche');
    }
}

async function searchByCodebarre() {
    const codebarre = document.getElementById('searchCodebarreInput').value.trim();

    if (!codebarre) {
        alert('Veuillez entrer ou scanner un code-barre');
        return;
    }

    try {
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('*')
            .ilike('code_barre', `%${codebarre}%`)
            .limit(10);

        if (error) throw error;

        if (!articles || articles.length === 0) {
            alert('Code-barre non trouvé');
            return;
        }

        openSearchPopup(articles, 'codebarre');

    } catch (error) {
        console.error('Erreur de recherche par code-barre:', error);
        alert('Erreur lors de la recherche');
    }
}

// ===== POPUP SORTIE DE STOCK =====
async function openStockOutPopup(article = null, scanMode = false) {
    const popup = document.createElement('div');
    popup.className = 'stock-popup-overlay';

    const initialData = article ? {
        articleId: article.id,
        articleName: article.nom,
        articleNumber: article.numero,
        currentStock: article.stock_actuel || 0,
        barcode: article.code_barre,
        unitPrice: article.prix_unitaire || 0,
        locationZone: article.zone || '',
        locationRack: article.rayon || '',
        locationShelf: article.etagere || '',
        locationPosition: article.position || ''
    } : null;

    // Construire l'emplacement complet
    const buildLocationString = (article) => {
        const parts = [];
        if (article.zone) parts.push(`Zone: ${article.zone}`);
        if (article.rayon) parts.push(`Rayon: ${article.rayon}`);
        if (article.etagere) parts.push(`Étagère: ${article.etagere}`);
        if (article.position) parts.push(`Position: ${article.position}`);
        return parts.join(' - ') || 'Non spécifié';
    };

    const locationString = initialData ? buildLocationString(article) : '';

    popup.innerHTML = `
        <div class="stock-popup">
            <div class="popup-header">
                <h3><i class="fas fa-arrow-up"></i> Sortie de stock</h3>
                <button class="close-popup">&times;</button>
            </div>
            <div class="popup-content">
                <div class="popup-section">
                    <h4><i class="fas fa-search"></i> Sélection de l'article</h4>
                    <div class="form-group">
                        <label>Recherche rapide</label>
                        <div class="search-combo">
                            <input type="text"
                                   id="outSearchInput"
                                   placeholder="Nom, numéro ou code-barre"
                                   class="search-input">
                            <button id="outSearchBtn" class="search-btn-sm">
                                <i class="fas fa-search"></i>
                            </button>
                            <button id="outScanBtn" class="scan-btn-sm">
                                <i class="fas fa-camera"></i> Scanner
                            </button>
                        </div>
                    </div>

                    ${initialData ? `
                        <div class="selected-article">
                            <div class="article-summary">
                                <strong>${initialData.articleName}</strong>
                                <div class="article-details">
                                    <span>${initialData.articleNumber}</span>
                                    <span>Stock: ${initialData.currentStock}</span>
                                    ${initialData.barcode ? `<span>CB: ${initialData.barcode}</span>` : ''}
                                </div>
                                ${initialData.unitPrice > 0 ? `<div class="article-price">Prix: ${initialData.unitPrice} €</div>` : ''}
                                ${locationString ? `<div class="article-location"><i class="fas fa-map-marker-alt"></i> ${locationString}</div>` : ''}
                            </div>
                        </div>
                    ` : `
                        <div id="outSearchResults" class="search-results" style="display: none;">
                            <div class="results-list"></div>
                        </div>
                    `}
                </div>

                <div class="popup-section">
                    <h4><i class="fas fa-edit"></i> Détails de la sortie</h4>
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="outQuantity">Quantité *</label>
                            <input type="number"
                                   id="outQuantity"
                                   value="1"
                                   min="1"
                                   ${initialData ? `max="${initialData.currentStock}"` : ''}
                                   required>
                            <small id="outStockInfo">${initialData ? `Stock disponible: ${initialData.currentStock}` : ''}</small>
                        </div>

                        <div class="form-group">
                            <label for="outProject">Projet / Destination *</label>
                            <select id="outProject" required>
                                <option value="">Sélectionner...</option>
                                <!-- Les options seront chargées dynamiquement -->
                                <option value="vente_simple">Vente simple</option>
                            </select>
                        </div>

                        <div class="form-group full-width">
                            <label for="outReason">Raison de la sortie *</label>
                            <select id="outReason" required>
                                <option value="">Sélectionner une raison</option>
                                <option value="utilisation_projet">Utilisation pour projet</option>
                                <option value="vente_simple">Vente simple</option>
                                <option value="retour_fournisseur">Retour fournisseur</option>
                                <option value="don">Don</option>
                                <option value="perte">Perte/détérioration</option>
                                <option value="autre">Autre</option>
                            </select>
                        </div>

                        <div class="form-group full-width">
                            <label for="outNotes">Notes supplémentaires</label>
                            <textarea id="outNotes"
                                      rows="3"
                                      placeholder="Détails complémentaires..."></textarea>
                        </div>
                    </div>
                </div>

                <div class="popup-section">
                    <h4><i class="fas fa-info-circle"></i> Informations de localisation</h4>
                    <div class="location-display">
                        <div class="location-header">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>Emplacement de l'article</span>
                        </div>
                        <div class="location-details" id="outLocationDetails">
                            ${locationString || 'Non spécifié'}
                        </div>
                        <div class="location-note">
                            <small><i class="fas fa-lightbulb"></i> Consultez cette localisation pour retrouver l'article en stock</small>
                        </div>
                    </div>

                    <div class="form-group" style="margin-top: 15px;">
                        <label for="outUnitPrice">Prix unitaire de sortie (€)</label>
                        <input type="number"
                               id="outUnitPrice"
                               step="0.01"
                               placeholder="0.00"
                               value="${initialData ? initialData.unitPrice : ''}">
                        <small>Prix de vente ou de sortie</small>
                    </div>
                </div>

                <div class="popup-section">
                    <h4><i class="fas fa-user"></i> Responsable</h4>
                    <div class="form-group">
                        <div class="user-badge current-user">
                            <i class="fas fa-user"></i>
                            <span>${currentUser.username} (${currentUser.isAdmin ? 'Administrateur' : 'Utilisateur'})</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="popup-footer">
                <button class="btn btn-secondary close-popup-btn">Annuler</button>
                <button class="btn btn-danger" id="confirmStockOutBtn">
                    <i class="fas fa-check-circle"></i> Confirmer la sortie
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Initialisation
    if (initialData) {
        document.getElementById('outQuantity').addEventListener('input', function() {
            const stock = initialData.currentStock;
            const quantity = parseInt(this.value) || 0;
            const stockInfo = document.getElementById('outStockInfo');

            if (quantity > stock) {
                stockInfo.style.color = 'var(--danger-color)';
                stockInfo.textContent = `⚠️ Dépasse le stock disponible (${stock})`;
            } else {
                stockInfo.style.color = '';
                stockInfo.textContent = `Stock disponible: ${stock}`;
            }
        });

        // Synchroniser les selects projet et raison pour "Vente simple"
        const projectSelect = document.getElementById('outProject');
        const reasonSelect = document.getElementById('outReason');

        projectSelect.addEventListener('change', function() {
            if (this.value === 'vente_simple') {
                reasonSelect.value = 'vente_simple';
            }
        });

        reasonSelect.addEventListener('change', function() {
            if (this.value === 'vente_simple') {
                projectSelect.value = 'vente_simple';
            }
        });
    }

    // Charger les projets
    loadProjectsForSelect('outProject');

    // Événements
    setupStockPopupEvents(popup, 'out', initialData);
}

// ===== POPUP ENTREE DE STOCK =====
async function openStockInPopup(article = null, scanMode = false) {
    const popup = document.createElement('div');
    popup.className = 'stock-popup-overlay';

    const initialData = article ? {
        articleId: article.id,
        articleName: article.nom,
        articleNumber: article.numero,
        barcode: article.code_barre,
        unitPrice: article.prix_unitaire || 0,
        locationZone: article.zone || '',
        locationRack: article.rayon || '',
        locationShelf: article.etagere || '',
        locationPosition: article.position || '',
        currentStock: article.stock_actuel || 0
    } : null;

    // Construire l'emplacement complet
    const buildLocationString = (article) => {
        const parts = [];
        if (article.zone) parts.push(`Zone: ${article.zone}`);
        if (article.rayon) parts.push(`Rayon: ${article.rayon}`);
        if (article.etagere) parts.push(`Étagère: ${article.etagere}`);
        if (article.position) parts.push(`Position: ${article.position}`);
        return parts.join(' - ') || 'Non spécifié';
    };

    const locationString = initialData ? buildLocationString(article) : '';

    popup.innerHTML = `
        <div class="stock-popup">
            <div class="popup-header">
                <h3><i class="fas fa-arrow-down"></i> Entrée de stock</h3>
                <button class="close-popup">&times;</button>
            </div>
            <div class="popup-content">
                <div class="popup-section">
                    <h4><i class="fas fa-search"></i> Sélection de l'article</h4>
                    <div class="form-group">
                        <label>Recherche rapide</label>
                        <div class="search-combo">
                            <input type="text"
                                   id="inSearchInput"
                                   placeholder="Nom, numéro ou code-barre"
                                   class="search-input">
                            <button id="inSearchBtn" class="search-btn-sm">
                                <i class="fas fa-search"></i>
                            </button>
                            <button id="inScanBtn" class="scan-btn-sm">
                                <i class="fas fa-camera"></i> Scanner
                            </button>
                        </div>
                    </div>

                    ${initialData ? `
                        <div class="selected-article">
                            <div class="article-summary">
                                <strong>${initialData.articleName}</strong>
                                <div class="article-details">
                                    <span>${initialData.articleNumber}</span>
                                    ${initialData.barcode ? `<span>CB: ${initialData.barcode}</span>` : ''}
                                    <span>Stock actuel: ${initialData.currentStock}</span>
                                </div>
                                ${initialData.unitPrice > 0 ? `<div class="article-price">Prix unitaire: ${initialData.unitPrice} €</div>` : ''}
                                ${locationString ? `<div class="article-location"><i class="fas fa-map-marker-alt"></i> ${locationString}</div>` : ''}
                            </div>
                        </div>
                    ` : `
                        <div id="inSearchResults" class="search-results" style="display: none;">
                            <div class="results-list"></div>
                        </div>
                    `}
                </div>

                <div class="popup-section">
                    <h4><i class="fas fa-plus-circle"></i> Détails de l'entrée</h4>
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="inQuantity">Quantité *</label>
                            <input type="number"
                                   id="inQuantity"
                                   value="1"
                                   min="1"
                                   max="1000"
                                   required>
                        </div>

                        <div class="form-group">
                            <label for="inSupplier">Fournisseur</label>
                            <input type="text"
                                   id="inSupplier"
                                   placeholder="Nom du fournisseur">
                        </div>

                        <div class="form-group">
                            <label for="inPurchaseOrder">Bon de commande</label>
                            <input type="text"
                                   id="inPurchaseOrder"
                                   placeholder="N° commande">
                        </div>

                        <div class="form-group full-width">
                            <label for="inReason">Type d'entrée *</label>
                            <select id="inReason" required>
                                <option value="">Sélectionner un type</option>
                                <option value="achat">Achat nouveau</option>
                                <option value="reappro">Réapprovisionnement</option>
                                <option value="retour_projet">Retour de projet</option>
                                <option value="inventaire">Correction inventaire</option>
                                <option value="don">Don</option>
                                <option value="vente_simple">Retour vente simple</option>
                                <option value="autre">Autre</option>
                            </select>
                        </div>

                        <div class="form-group full-width">
                            <label for="inNotes">Notes</label>
                            <textarea id="inNotes"
                                      rows="3"
                                      placeholder="Détails complémentaires..."></textarea>
                        </div>
                    </div>
                </div>

                <div class="popup-section">
                    <h4><i class="fas fa-tags"></i> Informations de l'article</h4>
                    <div class="info-grid">
                        <div class="info-item">
                            <label>Prix unitaire actuel:</label>
                            <div class="info-value" id="inCurrentPrice">
                                ${initialData ? `${initialData.unitPrice} €` : 'Non défini'}
                            </div>
                        </div>
                        <div class="info-item">
                            <label>Emplacement habituel:</label>
                            <div class="info-value" id="inCurrentLocation">
                                ${locationString || 'Non spécifié'}
                            </div>
                        </div>
                    </div>

                    <div class="form-grid" style="margin-top: 15px;">
                        <div class="form-group">
                            <label for="inUnitPrice">Nouveau prix unitaire (€)</label>
                            <input type="number"
                                   id="inUnitPrice"
                                   step="0.01"
                                   placeholder="0.00"
                                   value="${initialData ? initialData.unitPrice : ''}">
                            <small>Laissez vide pour conserver le prix actuel</small>
                        </div>

                        <div class="form-group">
                            <label for="inLocationZone">Zone de rangement</label>
                            <input type="text"
                                   id="inLocationZone"
                                   placeholder="Zone"
                                   value="${initialData ? initialData.locationZone : ''}">
                        </div>

                        <div class="form-group">
                            <label for="inLocationRack">Rayon</label>
                            <input type="text"
                                   id="inLocationRack"
                                   placeholder="Rayon"
                                   value="${initialData ? initialData.locationRack : ''}">
                        </div>

                        <div class="form-group">
                            <label for="inLocationShelf">Étagère</label>
                            <input type="text"
                                   id="inLocationShelf"
                                   placeholder="Étagère"
                                   value="${initialData ? initialData.locationShelf : ''}">
                        </div>

                        <div class="form-group">
                            <label for="inLocationPosition">Position</label>
                            <input type="text"
                                   id="inLocationPosition"
                                   placeholder="Position"
                                   value="${initialData ? initialData.locationPosition : ''}">
                        </div>
                    </div>
                </div>
            </div>

            <div class="popup-footer">
                <button class="btn btn-secondary close-popup-btn">Annuler</button>
                <button class="btn btn-success" id="confirmStockInBtn">
                    <i class="fas fa-check-circle"></i> Confirmer l'entrée
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Événements
    setupStockPopupEvents(popup, 'in', initialData);
}

// ===== POPUP RESERVATION PROJET =====
async function openProjectReservationPopup(article = null) {
    const popup = document.createElement('div');
    popup.className = 'stock-popup-overlay';

    const initialData = article ? {
        articleId: article.id,
        articleName: article.nom,
        articleNumber: article.numero,
        currentStock: article.stock_actuel || 0,
        reservedStock: article.stock_reserve || 0,
        barcode: article.code_barre,
        unitPrice: article.prix_unitaire || 0,
        locationZone: article.zone || '',
        locationRack: article.rayon || '',
        locationShelf: article.etagere || '',
        locationPosition: article.position || ''
    } : null;

    // Construire l'emplacement complet
    const buildLocationString = (article) => {
        const parts = [];
        if (article.zone) parts.push(`Zone: ${article.zone}`);
        if (article.rayon) parts.push(`Rayon: ${article.rayon}`);
        if (article.etagere) parts.push(`Étagère: ${article.etagere}`);
        if (article.position) parts.push(`Position: ${article.position}`);
        return parts.join(' - ') || 'Non spécifié';
    };

    const locationString = initialData ? buildLocationString(article) : '';

    popup.innerHTML = `
        <div class="stock-popup">
            <div class="popup-header">
                <h3><i class="fas fa-calendar-check"></i> Réservation pour projet</h3>
                <button class="close-popup">&times;</button>
            </div>
            <div class="popup-content">
                <div class="popup-section">
                    <h4><i class="fas fa-search"></i> Article à réserver</h4>
                    <div class="form-group">
                        <label>Recherche rapide</label>
                        <div class="search-combo">
                            <input type="text"
                                   id="resSearchInput"
                                   placeholder="Nom, numéro ou code-barre"
                                   class="search-input">
                            <button id="resSearchBtn" class="search-btn-sm">
                                <i class="fas fa-search"></i>
                            </button>
                            <button id="resScanBtn" class="scan-btn-sm">
                                <i class="fas fa-camera"></i> Scanner
                            </button>
                        </div>
                    </div>

                    ${initialData ? `
                        <div class="selected-article">
                            <div class="article-summary">
                                <strong>${initialData.articleName}</strong>
                                <div class="article-details">
                                    <span>${initialData.articleNumber}</span>
                                    <span>Stock disponible: ${initialData.currentStock - initialData.reservedStock}</span>
                                    ${initialData.barcode ? `<span>CB: ${initialData.barcode}</span>` : ''}
                                </div>
                                ${initialData.unitPrice > 0 ? `<div class="article-price">Prix: ${initialData.unitPrice} €</div>` : ''}
                                ${locationString ? `<div class="article-location"><i class="fas fa-map-marker-alt"></i> ${locationString}</div>` : ''}
                            </div>
                        </div>
                    ` : `
                        <div id="resSearchResults" class="search-results" style="display: none;">
                            <div class="results-list"></div>
                        </div>
                    `}
                </div>

                <div class="popup-section">
                    <h4><i class="fas fa-project-diagram"></i> Détails de la réservation</h4>
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="resQuantity">Quantité à réserver *</label>
                            <input type="number"
                                   id="resQuantity"
                                   value="1"
                                   min="1"
                                   ${initialData ? `max="${initialData.currentStock - initialData.reservedStock}"` : ''}
                                   required>
                            <small id="resStockInfo">
                                ${initialData ?
                                    `Disponible: ${initialData.currentStock - initialData.reservedStock}
                                     (Stock: ${initialData.currentStock}, Déjà réservé: ${initialData.reservedStock})`
                                    : ''}
                            </small>
                        </div>

                        <div class="form-group">
                            <label for="resProject">Projet *</label>
                            <select id="resProject" required>
                                <option value="">Sélectionner un projet</option>
                                <!-- Les options seront chargées dynamiquement -->
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="resStartDate">Date de début</label>
                            <input type="date"
                                   id="resStartDate"
                                   value="${new Date().toISOString().split('T')[0]}">
                        </div>

                        <div class="form-group">
                            <label for="resEndDate">Date de fin prévue</label>
                            <input type="date"
                                   id="resEndDate"
                                   value="${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}">
                        </div>

                        <div class="form-group full-width">
                            <label for="resPurpose">Motif de la réservation *</label>
                            <select id="resPurpose" required>
                                <option value="" disabled selected>Pourquoi réserver cet article?</option>
                                <option value="utilisation_projet">Utilisation pour projet</option>
                                <option value="mise_de_cote">Mise de côté temporaire</option>
                                <option value="demonstration">Démonstration</option>
                                <option value="exposition">Exposition</option>
                                <option value="autre">Autre</option>
                            </select>
                        </div>

                        <div class="form-group full-width">
                            <label for="resNotes">Notes</label>
                            <textarea id="resNotes"
                                      rows="2"
                                      placeholder="Détails complémentaires..."></textarea>
                        </div>
                    </div>
                </div>

                <div class="popup-section">
                    <h4><i class="fas fa-map-marker-alt"></i> Localisation de l'article</h4>
                    <div class="location-info">
                        <div class="location-display">
                            <strong>Emplacement actuel:</strong>
                            <div class="location-details">
                                ${locationString || 'Non spécifié'}
                            </div>
                        </div>
                        <div class="location-note">
                            <small><i class="fas fa-info-circle"></i> Cet article se trouve actuellement à cet emplacement dans le stock</small>
                        </div>
                    </div>

                    <div class="form-group" style="margin-top: 15px;">
                        <label for="resUnitPrice">Prix unitaire (€)</label>
                        <input type="text"
                               id="resUnitPrice"
                               value="${initialData ? initialData.unitPrice : ''}"
                               readonly
                               class="readonly-input">
                        <small>Prix unitaire de référence</small>
                    </div>
                </div>

                <div class="popup-section">
                    <h4><i class="fas fa-user-check"></i> Informations du responsable</h4>
                    <div class="form-group">
                        <div class="user-badge current-user">
                            <i class="fas fa-user"></i>
                            <span>${currentUser.username}</span>
                            <small>Effectue la réservation</small>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="resResponsible">Responsable projet *</label>
                        <select id="resResponsible" required>
                            <option value="">Sélectionner un responsable...</option>
                            <!-- Les options seront chargées dynamiquement -->
                        </select>
                    </div>
                </div>
            </div>

            <div class="popup-footer">
                <button class="btn btn-secondary close-popup-btn">Annuler</button>
                    <button class="btn btn-warning" id="confirmStockReservationBtn">
                    <i class="fas fa-calendar-plus"></i> Créer la réservation
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Initialisation
    if (initialData) {
        document.getElementById('resQuantity').addEventListener('input', function() {
            const available = initialData.currentStock - initialData.reservedStock;
            const quantity = parseInt(this.value) || 0;
            const stockInfo = document.getElementById('resStockInfo');

            if (quantity > available) {
                stockInfo.style.color = 'var(--danger-color)';
                stockInfo.textContent = `⚠️ Dépasse le stock disponible (${available})`;
            } else {
                stockInfo.style.color = '';
                stockInfo.textContent = `Disponible: ${available} (Stock: ${initialData.currentStock}, Déjà réservé: ${initialData.reservedStock})`;
            }
        });
    }

    // Charger les projets
    loadProjectsForSelect('resProject');
    loadEmployeesForSelect('resResponsible', currentUser.username);

    // Événements
    setupStockPopupEvents(popup, 'res', initialData);
}

// ===== POPUP SCAN =====
async function openScanPopup(actionType, scanType) {
    const popup = document.createElement('div');
    popup.className = 'scan-popup-overlay';

    const actionNames = {
        'sortie': 'Sortie de stock',
        'entree': 'Entrée de stock',
        'reservation': 'Réservation projet'
    };

    popup.innerHTML = `
        <div class="scan-popup">
            <div class="popup-header">
                <h3><i class="fas fa-camera"></i> Scanner pour ${actionNames[actionType]}</h3>
                <button class="close-popup">&times;</button>
            </div>
            <div class="popup-content">
                <div class="scan-section">
                    <div class="camera-placeholder" id="cameraPlaceholder">
                        <i class="fas fa-camera"></i>
                        <p>Caméra non activée</p>
                    </div>
                    <video id="cameraPreview" autoplay playsinline style="display: none;"></video>

                    <div class="scan-controls">
                        <button id="startCameraBtn" class="btn btn-primary">
                            <i class="fas fa-video"></i> Activer la caméra
                        </button>
                        <button id="stopCameraBtn" class="btn btn-secondary" style="display: none;">
                            <i class="fas fa-stop"></i> Arrêter
                        </button>
                        <button id="toggleFlashBtn" class="btn btn-info" style="display: none;">
                            <i class="fas fa-lightbulb"></i> Flash
                        </button>
                    </div>
                </div>

                <div class="manual-section">
                    <h4><i class="fas fa-keyboard"></i> Saisie manuelle</h4>
                    <div class="form-group">
                        <input type="text"
                               id="manualBarcodeInput"
                               placeholder="Saisir le code-barre manuellement"
                               class="scan-input">
                        <button id="confirmManualBtn" class="btn">
                            <i class="fas fa-check"></i> Valider
                        </button>
                    </div>
                </div>

                <div class="scan-instructions">
                    <div class="instruction">
                        <i class="fas fa-lightbulb"></i>
                        <p>Placez le code-barre dans le cadre. Le scan est automatique.</p>
                    </div>
                    <div class="instruction">
                        <i class="fas fa-bolt"></i>
                        <p>Assurez-vous d'avoir une bonne luminosité.</p>
                    </div>
                </div>
            </div>

            <div class="popup-footer">
                <button class="btn btn-secondary close-popup-btn">Annuler</button>
                <div class="scan-stats">
                    <span id="scanStatus">En attente de scan...</span>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Variables pour le scan
    let scanStream = null;
    let scanInterval = null;
    let currentAction = actionType;
    let lastScannedCode = '';

    // DÉMARRER AUTOMATIQUEMENT LA CAMÉRA
    setTimeout(() => {
        startCameraScan();
    }, 500); // Petit délai pour laisser le popup s'afficher

    // Événements généraux du popup
    popup.querySelector('.close-popup').addEventListener('click', () => {
        stopScan();
        document.body.removeChild(popup);
    });

    popup.querySelector('.close-popup-btn').addEventListener('click', () => {
        stopScan();
        document.body.removeChild(popup);
    });

    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            stopScan();
            document.body.removeChild(popup);
        }
    });

    // Événements spécifiques au scan
    popup.querySelector('#startCameraBtn').addEventListener('click', startCameraScan);
    popup.querySelector('#stopCameraBtn').addEventListener('click', stopCameraScan);
    popup.querySelector('#toggleFlashBtn').addEventListener('click', toggleFlash);
    popup.querySelector('#confirmManualBtn').addEventListener('click', processManualBarcode);


    async function startCameraScan() {
        try {
            console.log('Démarrage scanner...');

            // 1. DÉMARRER LA CAMÉRA
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            const video = popup.querySelector('#cameraPreview');
            const placeholder = popup.querySelector('#cameraPlaceholder');

            video.srcObject = stream;
            video.style.display = 'block';
            placeholder.style.display = 'none';

            popup.querySelector('#stopCameraBtn').style.display = 'inline-block';

            scanStream = stream;

            // 2. UTILISER QUAGGA UNIQUEMENT (plus fiable)
            if (typeof Quagga === 'undefined') {
                throw new Error('Bibliothèque scanner non chargée');
            }

            Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: video,
                    constraints: {
                        facingMode: "environment"
                    }
                },
                decoder: {
                    readers: ["ean_reader", "code_128_reader", "upc_reader", "ean_8_reader"]
                },
                locate: true,
                frequency: 10,
                numOfWorkers: 2
            }, function(err) {
                if (err) {
                    console.error('ERREUR QUAGGA:', err);
                    popup.querySelector('#scanStatus').innerHTML = `
                        <div style="background: #f44336; color: white; padding: 10px; border-radius: 5px;">
                            <i class="fas fa-exclamation-triangle"></i>
                            Scanner incompatible<br>
                            <small>Utilisez la saisie manuelle</small>
                        </div>
                    `;
                    popup.querySelector('#manualBarcodeInput').focus();
                    return;
                }

                console.log('Quagga démarré avec succès');
                Quagga.start();

                popup.querySelector('#scanStatus').innerHTML = `
                    <div style="background: #4CAF50; color: white; padding: 10px; border-radius: 5px;">
                        <i class="fas fa-check-circle"></i>
                        Scanner prêt<br>
                        <small>Centrez le code-barre</small>
                    </div>
                `;
            });

            // 3. QUAND UN CODE EST DÉTECTÉ
            Quagga.onDetected(function(result) {
                const code = result.codeResult.code;
                const format = result.codeResult.format;

                console.log('Code détecté:', code, 'Format:', format);

                // Arrêter Quagga et la caméra
                Quagga.stop();
                stream.getTracks().forEach(track => track.stop());

                // Afficher confirmation
                popup.querySelector('#scanStatus').innerHTML = `
                    <div style="background: #2196F3; color: white; padding: 10px; border-radius: 5px;">
                        <i class="fas fa-barcode"></i>
                        Code détecté: <strong>${code}</strong><br>
                        <small>Recherche en cours...</small>
                    </div>
                `;

                // Rechercher l'article
                searchArticleByBarcode(code);
            });

        } catch (error) {
            console.error('ERREUR CAMÉRA:', error);
            popup.querySelector('#scanStatus').innerHTML = `
                <div style="background: #FF9800; color: white; padding: 10px; border-radius: 5px;">
                    <i class="fas fa-video-slash"></i>
                    Caméra inaccessible<br>
                    <small>${error.message || 'Permission refusée'}</small>
                </div>
            `;
            popup.querySelector('#manualBarcodeInput').focus();
        }
    }

    // FONCTION DE RECHERCHE D'ARTICLE
    async function searchArticleByBarcode(barcode) {
        try {
            console.log('Recherche code-barre:', barcode);

            // Recherche EXACTE
            const { data: articles, error } = await supabase
                .from('w_articles')
                .select('*')
                .eq('code_barre', barcode)  // Égalité exacte
                .limit(1);

            if (error) {
                console.error('Erreur Supabase:', error);
                throw error;
            }

            console.log('Résultat recherche:', articles);

            if (!articles || articles.length === 0) {
                popup.querySelector('#scanStatus').innerHTML = `
                    <div style="background: #f44336; color: white; padding: 10px; border-radius: 5px;">
                        <i class="fas fa-times-circle"></i>
                        Code-barre non trouvé: <strong>${barcode}</strong><br>
                        <small>Vérifiez dans la base de données</small>
                    </div>
                `;

                // Réafficher le scanner après 3 secondes
                setTimeout(() => {
                    popup.querySelector('#scanStatus').innerHTML = `
                        <div style="background: #4CAF50; color: white; padding: 10px; border-radius: 5px;">
                            <i class="fas fa-redo"></i>
                            Scanner réactivé<br>
                            <small>Scannez à nouveau</small>
                        </div>
                    `;
                    if (scanStream) {
                        scanStream.getTracks().forEach(track => track.stop());
                    }
                    startCameraScan();
                }, 3000);

                return;
            }

            const article = articles[0];
            console.log('Article trouvé:', article.nom);

            // SUCCÈS - Fermer le popup de scan
            stopScan();
            document.body.removeChild(popup);

            // Ouvrir le bon popup selon l'action
            switch(currentAction) {
                case 'sortie':
                    openStockOutPopup(article, true);
                    break;
                case 'entree':
                    openStockInPopup(article, true);
                    break;
                case 'reservation':
                    openProjectReservationPopup(article);
                    break;
            }

        } catch (error) {
            console.error('ERREUR RECHERCHE:', error);
            popup.querySelector('#scanStatus').innerHTML = `
                <div style="background: #9C27B0; color: white; padding: 10px; border-radius: 5px;">
                    <i class="fas fa-exclamation-circle"></i>
                    Erreur de connexion<br>
                    <small>${error.message || 'Vérifiez votre connexion'}</small>
                </div>
            `;
        }
    }

    function stopCameraScan() {
        console.log('Arrêt du scanner...');

        // Arrêter Quagga
        try {
            if (typeof Quagga !== 'undefined' && Quagga.stop) {
                Quagga.stop();
            }
        } catch (e) {
            console.warn('Erreur arrêt Quagga:', e);
        }

        // Arrêter la caméra
        if (scanStream) {
            scanStream.getTracks().forEach(track => track.stop());
            scanStream = null;
        }

        // Réinitialiser l'interface
        const video = popup.querySelector('#cameraPreview');
        if (video) {
            video.srcObject = null;
            video.style.display = 'none';
        }

        const placeholder = popup.querySelector('#cameraPlaceholder');
        if (placeholder) {
            placeholder.style.display = 'block';
        }

        const stopBtn = popup.querySelector('#stopCameraBtn');
        if (stopBtn) {
            stopBtn.style.display = 'none';
        }
    }

    function stopScan() {
        stopCameraScan();

        if (scanInterval) {
            clearInterval(scanInterval);
            scanInterval = null;
        }
    }
}

// ===== FONCTIONS UTILITAIRES POUR LES POPUPS =====
async function setupStockPopupEvents(popup, type, initialData) {
    // Fermeture
    popup.querySelector('.close-popup').addEventListener('click', () => {
        document.body.removeChild(popup);
    });

    popup.querySelector('.close-popup-btn').addEventListener('click', () => {
        document.body.removeChild(popup);
    });

    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            document.body.removeChild(popup);
        }
    });

    // Recherche dans le popup
    const searchBtn = popup.querySelector(`#${type}SearchBtn`);
    const searchInput = popup.querySelector(`#${type}SearchInput`);
    const scanBtn = popup.querySelector(`#${type}ScanBtn`);

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => {
            searchArticleInPopup(searchInput.value, type);
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchArticleInPopup(searchInput.value, type);
            }
        });
    }

    if (scanBtn) {
        scanBtn.addEventListener('click', () => {
            document.body.removeChild(popup);
            openScanPopup(type, 'saisie');
        });
    }

    // Confirmation
    const confirmBtn = popup.querySelector(`#confirmStock${type === 'res' ? 'Reservation' : type === 'out' ? 'Out' : 'In'}Btn`);

    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            await handleStockAction(type, popup, initialData);
        });
    }
}

async function searchArticleInPopup(searchTerm, type) {
    if (!searchTerm.trim()) {
        alert('Veuillez saisir un terme de recherche');
        return;
    }

    try {
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('*')
            .or(`nom.ilike.%${searchTerm}%,numero.ilike.%${searchTerm}%,code_barre.ilike.%${searchTerm}%`)
            .limit(5);

        if (error) throw error;

        const resultsDiv = document.querySelector(`#${type}SearchResults .results-list`);
        const container = document.getElementById(`${type}SearchResults`);

        if (!articles || articles.length === 0) {
            resultsDiv.innerHTML = '<div class="no-results">Aucun article trouvé</div>';
            container.style.display = 'block';
            return;
        }

        resultsDiv.innerHTML = articles.map(article => `
            <div class="result-item" data-id="${article.id}">
                <div class="result-info">
                    <h5>${article.nom}</h5>
                    <div class="result-details">
                        <span>${article.numero}</span>
                        <span>Stock: ${article.stock_actuel || 0}</span>
                        ${article.code_barre ? `<span>${article.code_barre}</span>` : ''}
                    </div>
                </div>
                <button class="btn-select-article" data-id="${article.id}">
                    <i class="fas fa-check"></i> Sélectionner
                </button>
            </div>
        `).join('');

        container.style.display = 'block';

        // Ajouter les événements de sélection
        document.querySelectorAll(`#${type}SearchResults .btn-select-article`).forEach(btn => {
            btn.addEventListener('click', function() {
                const articleId = this.dataset.id;
                const article = articles.find(a => a.id === articleId);

                // Fermer ce popup et ouvrir le popup correspondant avec l'article sélectionné
                const popup = document.querySelector('.stock-popup-overlay');
                if (popup) {
                    document.body.removeChild(popup);
                }

                switch(type) {
                    case 'out':
                        openStockOutPopup(article);
                        break;
                    case 'in':
                        openStockInPopup(article);
                        break;
                    case 'res':
                        openProjectReservationPopup(article);
                        break;
                }
            });
        });

    } catch (error) {
        console.error('Erreur recherche:', error);
        alert('Erreur lors de la recherche');
    }
}

async function loadProjectsForSelect(selectId) {
    try {
        const today = new Date().toISOString().split('T')[0];

        const { data: projets, error } = await supabase
            .from('w_projets')
            .select('id, nom, numero, date_fin_prevue, archived')
            .eq('archived', false)
            .or(`date_fin_prevue.is.null,date_fin_prevue.gte.${today}`) // Projets non terminés
            .order('nom');

        if (error) throw error;

        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = '<option value="">Sélectionner un projet</option>';

            if (projets && projets.length > 0) {
                projets.forEach(projet => {
                    const option = document.createElement('option');
                    option.value = projet.id;

                    // Ajouter un indicateur si le projet est bientôt terminé
                    let statusInfo = '';
                    if (projet.date_fin_prevue) {
                        const daysLeft = calculateDaysLeft(projet.date_fin_prevue);
                        if (daysLeft <= 7) {
                            statusInfo = ` (${daysLeft}j restants)`;
                        }
                    }

                    option.textContent = `${projet.nom} ${projet.numero ? `(${projet.numero})` : ''}${statusInfo}`;
                    select.appendChild(option);
                });
            } else {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'Aucun projet actif disponible';
                option.disabled = true;
                select.appendChild(option);
            }
        }

    } catch (error) {
        console.error('Erreur chargement projets:', error);
        const select = document.getElementById(selectId);
        if (select) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Erreur lors du chargement des projets';
            option.disabled = true;
            select.innerHTML = '';
            select.appendChild(option);
        }
    }
}


// ===== CHARGEMENT DES EMPLOYÉS =====
async function loadEmployeesForSelect(selectId, defaultValue = null) {
    try {
        const select = document.getElementById(selectId);
        if (!select) return;

        // REQUÊTE SIMPLE ET DIRECTE
        const { data: users, error } = await supabase
            .from('w_users')
            .select('username')  // Juste le username
            .order('username');  // Tri alphabétique

        if (error) {
            console.error('Erreur chargement employés:', error);
            // Option de secours : met l'utilisateur courant
            select.innerHTML = `
                <option value="">Sélectionner un responsable...</option>
                <option value="${currentUser.username}" selected>${currentUser.username} (actuel)</option>
            `;
            return;
        }

        // CONSTRUIRE LE SELECT
        select.innerHTML = '<option value="">Sélectionner un responsable...</option>';

        if (users && users.length > 0) {
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.username;
                option.textContent = user.username;

                // Sélectionner par défaut l'utilisateur courant
                if (defaultValue && user.username === defaultValue) {
                    option.selected = true;
                }

                select.appendChild(option);
            });

            // Si aucune option n'a été sélectionnée, sélectionner l'utilisateur courant
            if (defaultValue && !select.value) {
                const currentUserOption = Array.from(select.options)
                    .find(opt => opt.value === defaultValue);
                if (currentUserOption) {
                    currentUserOption.selected = true;
                }
            }
        }

    } catch (error) {
        console.error('Exception chargement employés:', error);
        // En cas d'erreur, au moins avoir une option
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = `
                <option value="${currentUser.username}" selected>${currentUser.username}</option>
            `;
        }
    }
}

// Fonction helper pour calculer les jours restants
function calculateDaysLeft(endDate) {
    try {
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (end < today) return 0;

        const diffTime = end - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch (e) {
        return 0;
    }
}

async function handleStockAction(type, popup, initialData) {
    try {
        // Récupérer les données du formulaire
        const articleId = initialData?.articleId || null;
        const quantity = parseInt(document.getElementById(`${type}Quantity`).value) || 0;

        if (!articleId) {
            alert('Veuillez sélectionner un article');
            return;
        }

        if (quantity <= 0) {
            alert('La quantité doit être positive');
            return;
        }

        // 1. RÉCUPÉRER L'ARTICLE POUR AVOIR LES STOCKS
        const { data: article, error: articleError } = await supabase
            .from('w_articles')
            .select('stock_actuel, stock_reserve')
            .eq('id', articleId)
            .single();

        if (articleError) throw articleError;

        const stockAvant = article.stock_actuel || 0;
        const reserveAvant = article.stock_reserve || 0;
        let stockApres = stockAvant;
        let reserveApres = reserveAvant;

        // 2. CALCULER LES NOUVEAUX STOCKS
        switch(type) {
            case 'out':
                stockApres = Math.max(0, stockAvant - quantity);
                break;
            case 'in':
                stockApres = stockAvant + quantity;
                break;
            case 'res':
                reserveApres = reserveAvant + quantity;
                break;
        }

        // VARIABLES POUR RÉSERVATION (utilisées plus bas)
        let resProjectId = '';
        let resProjectName = '';
        let motif = '';
        let notes = '';
        let responsable = '';
        let dateDebut = null;
        let dateFin = null;

        // 3. PRÉPARER LES DONNÉES DU MOUVEMENT
        let mouvementData = {
            article_id: articleId,
            type: type === 'out' ? 'sortie' : type === 'in' ? 'entree' : 'reservation',
            quantite: quantity,
            stock_avant: stockAvant,
            stock_apres: stockApres,
            stock_reserve_avant: reserveAvant,
            stock_reserve_apres: reserveApres,
            utilisateur: currentUser.username || currentUser.email,
            utilisateur_id: currentUser.id,
            date_mouvement: dateFr,
            heure_mouvement: timeFr,
            created_at: new Date().toISOString()
        };

        // 4. AJOUTER LES CHAMPS SPÉCIFIQUES
        switch(type) {
            case 'out':
                const outProjectSelect = document.getElementById('outProject');
                const outProjectId = outProjectSelect?.value || '';
                const outProjectText = outProjectSelect?.options[outProjectSelect.selectedIndex]?.text || '';
                const outProjectName = outProjectText.split(' (')[0] || outProjectText;

                // CORRECTION : Convertir "" en null
                mouvementData.projet = outProjectName || null;
                mouvementData.projet_id = outProjectId || null; // ← "" devient null

                mouvementData.raison = document.getElementById('outReason').value || '';
                mouvementData.commentaire = document.getElementById('outNotes').value || '';
                mouvementData.notes = document.getElementById('outNotes').value || '';
                break;

            case 'in':
                mouvementData.raison = document.getElementById('inReason').value || '';
                mouvementData.commentaire = document.getElementById('inNotes').value || '';
                mouvementData.notes = document.getElementById('inNotes').value || '';

                // CHAMPS POUR ENTREES
                mouvementData.fournisseur = document.getElementById('inSupplier').value || null;
                mouvementData.bon_commande = document.getElementById('inPurchaseOrder').value || null;

                const prixUnitaireInput = document.getElementById('inUnitPrice');
                mouvementData.prix_unitaire = prixUnitaireInput?.value ? parseFloat(prixUnitaireInput.value) : null;

                mouvementData.emplacement = document.getElementById('inLocation').value || null;
                break;

            case 'res':
                const resProjectSelect = document.getElementById('resProject');
                resProjectId = resProjectSelect?.value || '';
                const resProjectText = resProjectSelect?.options[resProjectSelect.selectedIndex]?.text || '';
                resProjectName = resProjectText.split(' (')[0] || resProjectText;

                motif = document.getElementById('resPurpose').value || null;
                notes = document.getElementById('resNotes').value || '';
                responsable = document.getElementById('resResponsible').value || null;
                dateDebut = document.getElementById('resStartDate').value || null;
                dateFin = document.getElementById('resEndDate').value || null;

                mouvementData.projet = resProjectName;
                mouvementData.projet_id = resProjectId;
                mouvementData.commentaire = notes;
                mouvementData.notes = notes;
                mouvementData.date_debut = dateDebut;
                mouvementData.date_fin = dateFin;
                mouvementData.motif = motif;
                mouvementData.responsable = responsable;
                break;
        }

        // 5. VALIDATIONS SUPPLÉMENTAIRES
        if (type === 'out' && quantity > stockAvant) {
            alert(`Stock insuffisant ! Stock disponible: ${stockAvant}`);
            return;
        }

        // 6. ENREGISTRER LE MOUVEMENT
        const { data: mouvement, error: mouvementError } = await supabase
            .from('w_mouvements')
            .insert([mouvementData]);

        if (mouvementError) {
            console.error('Erreur insertion mouvement:', mouvementError);
            throw new Error(`Erreur enregistrement: ${mouvementError.message}`);
        }

        // 7. SI C'EST UNE RÉSERVATION, FAIRE UN UPSERT DANS w_reservations_actives
        if (type === 'res') {
            let existingReservation = null;

            // Vérifier d'abord si une réservation existe déjà pour cet article et ce projet
            try {
                const { data, error } = await supabase
                    .from('w_reservations_actives')
                    .select('id, quantite, notes, date_debut, date_fin, motif, responsable, created_at')
                    .eq('article_id', articleId)
                    .eq('projet_id', resProjectId);

                if (error) throw error;

                // Si on a des résultats, prendre le premier
                if (data && data.length > 0) {
                    existingReservation = data[0];
                }
            } catch (checkError) {
                console.error('Erreur vérification réservation existante:', checkError);
                // On continue quand même avec l'insertion
            }

            let nouvelleQuantite = quantity;
            let nouvellesNotes = notes;

            // Si une réservation existe déjà, additionner les quantités et fusionner les notes
            if (existingReservation) {
                nouvelleQuantite = existingReservation.quantite + quantity;

                // Fusionner les notes intelligemment
                const dateAjout = new Date().toLocaleDateString('fr-FR');
                const heureAjout = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

                if (existingReservation.notes && notes) {
                    nouvellesNotes = `${existingReservation.notes}\n\n--- Ajout le ${dateAjout} à ${heureAjout} ---\n${notes}`;
                } else if (existingReservation.notes) {
                    nouvellesNotes = existingReservation.notes;
                } else if (notes) {
                    nouvellesNotes = `--- Créé le ${dateAjout} à ${heureAjout} ---\n${notes}`;
                }

                // Garder les valeurs existantes si les nouvelles sont vides
                dateDebut = dateDebut || existingReservation.date_debut;
                dateFin = dateFin || existingReservation.date_fin;
                motif = motif || existingReservation.motif;
                responsable = responsable || existingReservation.responsable;

                console.log(`Réservation existante trouvée: ${existingReservation.quantite} → ${nouvelleQuantite} unités`);
            }

            const reservationData = {
                article_id: articleId,
                projet_id: resProjectId,
                quantite: nouvelleQuantite,
                date_debut: dateDebut,
                date_fin: dateFin,
                motif: motif,
                notes: nouvellesNotes,
                responsable: responsable,
                utilisateur_id: currentUser.id,
                statut: 'active',
                created_at: existingReservation ?
                    existingReservation.created_at || new Date().toISOString().split('T')[0] :
                    new Date().toISOString().split('T')[0],
                updated_at: new Date().toISOString() // Pour le tracking
            };

            let reservationError;

            if (existingReservation) {
                // MISE À JOUR de la réservation existante
                const { error } = await supabase
                    .from('w_reservations_actives')
                    .update(reservationData)
                    .eq('id', existingReservation.id);
                reservationError = error;
            } else {
                // INSERTION nouvelle réservation
                const { error } = await supabase
                    .from('w_reservations_actives')
                    .insert([reservationData]);
                reservationError = error;
            }

            if (reservationError) {
                console.error('Erreur upsert réservation:', reservationError);

                // Si c'est une erreur de contrainte d'unicité, essayer l'update
                if (reservationError.code === '23505') {
                    try {
                        // Récupérer l'ID de la réservation existante
                        const { data: reservation, error: fetchError } = await supabase
                            .from('w_reservations_actives')
                            .select('id, quantite, notes')
                            .eq('article_id', articleId)
                            .eq('projet_id', resProjectId);

                        if (!fetchError && reservation && reservation.length > 0) {
                            const existing = reservation[0];
                            const { error: updateError } = await supabase
                                .from('w_reservations_actives')
                                .update({
                                    quantite: existing.quantite + quantity,
                                    notes: nouvellesNotes,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', existing.id);

                            if (updateError) {
                                throw new Error(`Erreur mise à jour réservation: ${updateError.message}`);
                            }
                        } else {
                            throw new Error(`Erreur récupération réservation: ${fetchError?.message || 'Inconnue'}`);
                        }
                    } catch (fallbackError) {
                        console.error('Erreur fallback:', fallbackError);
                        throw new Error(`Erreur création réservation: ${reservationError.message}`);
                    }
                } else {
                    throw new Error(`Erreur création réservation: ${reservationError.message}`);
                }
            }

            // Informer l'utilisateur si on a mis à jour une réservation existante
            if (existingReservation) {
                console.log(`Réservation mise à jour: ${existingReservation.quantite} → ${nouvelleQuantite} unités`);
            }
        }

        // 8. METTRE À JOUR LE STOCK DE L'ARTICLE
        let updates = {};

        if (type === 'out') {
            updates.stock_actuel = stockApres;
        } else if (type === 'in') {
            updates.stock_actuel = stockApres;

            // Mettre à jour le prix unitaire si fourni
            const prixUnitaireInput = document.getElementById('inUnitPrice');
            if (prixUnitaireInput?.value) {
                updates.prix_unitaire = parseFloat(prixUnitaireInput.value);
            }
        } else if (type === 'res') {
            updates.stock_reserve = reserveApres;
        }

        const { error: updateError } = await supabase
            .from('w_articles')
            .update(updates)
            .eq('id', articleId);

        if (updateError) throw updateError;

        // 9. SUCCÈS
        showTemporarySuccess(`${type === 'out' ? 'Sortie' : type === 'in' ? 'Entrée' : 'Réservation'} enregistrée avec succès !`);
        document.body.removeChild(popup);

        // 10. RE-RAFRACHIR LES DONNÉES
        await loadPageData();

    } catch (error) {
        console.error(`Erreur ${type} stock:`, error);
        alert(`Erreur lors de l'enregistrement: ${error.message || 'Erreur inconnue'}`);
    }
}

function showTemporarySuccess(message, duration = 2000) {
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
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
    `;
    successDiv.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(successDiv);

    // Animation CSS
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

    // Supprimer après la durée
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
    }, duration);
}

async function exportStockBasPDF() {
    try {
        console.log('Début export PDF stock bas...');

        // Vérification jsPDF - NOTE: c'est window.jspdf (minuscule)
        if (!window.jspdf || typeof window.jspdf.jsPDF === 'undefined') {
            console.error('jsPDF non trouvé:', window.jspdf);
            alert('Erreur : Bibliothèque PDF non chargée. Veuillez rafraîchir la page et vérifier la connexion.');
            return;
        }

        // Récupérer les données du stock bas
        console.log('Récupération des données depuis Supabase...');
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('nom, numero, stock_actuel, stock_minimum, stock_reserve')
            .gt('stock_minimum', 0)
            .order('nom');

        if (error) throw error;

        console.log(`${articles?.length || 0} articles récupérés`);

        // Filtrer les articles en stock bas
        const stockBas = articles.filter(article => {
            const disponible = article.stock_actuel - article.stock_reserve;
            return disponible > 0 && disponible <= article.stock_minimum;
        });

        console.log(`${stockBas.length} articles en stock bas`);

        if (stockBas.length === 0) {
            alert('Aucun article en stock bas à exporter');
            return;
        }

        // Créer le PDF - IMPORTANT: utiliser window.jspdf.jsPDF
        console.log('Création du PDF...');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Vérifier autoTable
        if (typeof doc.autoTable === 'undefined') {
            throw new Error('Extension autoTable non disponible');
        }

        // Le reste de ton code reste identique...
        const pageWidth = doc.internal.pageSize.width;
        const margin = 20;
        let yPosition = margin;

        // En-tête
        doc.setFontSize(20);
        doc.setTextColor(230, 126, 34);
        doc.text('Rapport Stock Bas', pageWidth / 2, yPosition, { align: 'center' });

        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        yPosition += 10;
        doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, yPosition, { align: 'center' });

        doc.setTextColor(0, 0, 0);
        yPosition += 15;

        // Tableau
        const headers = [['Article', 'N°', 'Disponible', 'Minimum', 'Différence']];
        const data = stockBas.map(article => {
            const disponible = article.stock_actuel - article.stock_reserve;
            const diff = disponible - article.stock_minimum;

            return [
                article.nom,
                article.numero || '-',
                `${disponible} (Stock: ${article.stock_actuel}, Réservé: ${article.stock_reserve})`,
                article.stock_minimum,
                diff
            ];
        });

        // Enlève complètement columnStyles et laisse autoTable gérer :
        doc.autoTable({
            startY: yPosition,
            head: headers,
            body: data,
            theme: 'grid',
            headStyles: { fillColor: [231, 76, 60] },
            // Pas de columnStyles, autoTable s'adapte automatiquement
            margin: { left: 10, right: 10 }, // Marge réduite
            tableWidth: 'auto'
        });

        // Pied de page
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text(`Total: ${stockBas.length} article(s) en stock bas`, margin, finalY);

        // Sauvegarder le PDF
        console.log('Sauvegarde du PDF...');
        const filename = `stock_bas_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);

        console.log('Export PDF terminé avec succès:', filename);

    } catch (error) {
        console.error('Erreur export PDF stock bas:', error);
        alert(`Erreur lors de l'export PDF: ${error.message || 'Erreur inconnue'}`);
    }
}

async function exportRupturePDF() {
    try {
        console.log('Début export PDF ruptures...');

        // Vérification jsPDF - NOTE: c'est window.jspdf (minuscule)
        if (!window.jspdf || typeof window.jspdf.jsPDF === 'undefined') {
            console.error('jsPDF non trouvé:', window.jspdf);
            alert('Erreur : Bibliothèque PDF non chargée. Veuillez rafraîchir la page et vérifier la connexion.');
            return;
        }

        // Récupérer les articles
        console.log('Récupération des données depuis Supabase...');
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('nom, numero, stock_actuel, stock_reserve, updated_at')
            .order('nom');

        if (error) throw error;

        console.log(`${articles?.length || 0} articles récupérés`);

        // Filtrer les ruptures
        const ruptures = articles.filter(article => {
            const disponible = article.stock_actuel - article.stock_reserve;
            return disponible <= 0;
        });

        console.log(`${ruptures.length} articles en rupture`);

        if (ruptures.length === 0) {
            alert('Aucune rupture de stock à exporter');
            return;
        }

        // Créer le PDF - IMPORTANT: utiliser window.jspdf.jsPDF
        console.log('Création du PDF...');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Vérifier autoTable
        if (typeof doc.autoTable === 'undefined') {
            throw new Error('Extension autoTable non disponible');
        }

        const pageWidth = doc.internal.pageSize.width;
        const margin = 20;
        let yPosition = margin;

        // En-tête
        doc.setFontSize(20);
        doc.setTextColor(231, 76, 60); // Rouge
        doc.text('Rapport Ruptures de Stock', pageWidth / 2, yPosition, { align: 'center' });

        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        yPosition += 10;
        doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, yPosition, { align: 'center' });

        doc.setTextColor(0, 0, 0);
        yPosition += 15;

        // Tableau
        const headers = [['Article', 'N°', 'Stock', 'Réservé', 'Disponible']];
        const data = ruptures.map(article => {
            const disponible = article.stock_actuel - article.stock_reserve;
            const lastUpdate = article.updated_at ?
                new Date(article.updated_at).toLocaleDateString('fr-FR') : '-';

            return [
                article.nom,
                article.numero || '-',
                article.stock_actuel,
                article.stock_reserve,
                `${disponible} (${disponible < 0 ? 'Déficit' : 'Rupture'})`
            ];
        });

        // Enlève complètement columnStyles et laisse autoTable gérer :
        doc.autoTable({
            startY: yPosition,
            head: headers,
            body: data,
            theme: 'grid',
            headStyles: { fillColor: [231, 76, 60] },
            // Pas de columnStyles, autoTable s'adapte automatiquement
            margin: { left: 10, right: 10 }, // Marge réduite
            tableWidth: 'auto'
        });

        // Pied de page
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text(`Total: ${ruptures.length} article(s) en rupture`, margin, finalY);

        // Message d'urgence
        doc.setFontSize(12);
        doc.setTextColor(231, 76, 60);
        doc.text('⚠️ COMMANDE URGENTE REQUISE ⚠️', pageWidth / 2, finalY + 15, { align: 'center' });

        // Sauvegarder le PDF
        console.log('Sauvegarde du PDF...');
        const filename = `ruptures_stock_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);

        console.log('Export PDF terminé avec succès:', filename);

    } catch (error) {
        console.error('Erreur export PDF ruptures:', error);

        // Messages d'erreur plus clairs
        let message = 'Erreur lors de l\'export PDF';
        if (error.message.includes('jsPDF') || error.message.includes('Bibliothèque')) {
            message = 'Erreur : Bibliothèque PDF non chargée. Veuillez rafraîchir la page.';
        } else if (error.message.includes('Supabase') || error.code) {
            message = `Erreur de connexion : ${error.message || 'Impossible de récupérer les données'}`;
        }

        alert(message);
    }
}


// ===== UTILITAIRES =====
function updateLastSync() {
    const now = new Date();
    const options = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    };

    const formattedDate = now.toLocaleDateString('fr-FR', options);
    document.getElementById('lastSync').textContent = `Dernière synchro: ${formattedDate}`;
}

function logout() {
    // Demander confirmation
    if (!confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
        return;
    }

    // Nettoyer la session
    sessionStorage.removeItem('current_user');
    sessionStorage.removeItem('supabase_token');

    // Rediriger vers la page de connexion
    window.location.href = 'connexion.html';
}

// ===== STYLES DYNAMIQUES =====
// Ajouter le style pour le texte en rouge
const style = document.createElement('style');
style.textContent = `
    .text-danger { color: var(--danger-color); font-weight: 600; }
`;
document.head.appendChild(style);

// ============================================
// VUE QUAD POUR ACCUEIL - CODE DE PRODUCTION
// ============================================

// Utiliser exactement le même ApiManager que vuestock.js
class AccueilQuadManager {
    constructor() {
        console.log('🎯 Initialisation AccueilQuadManager');

        // Références aux éléments HTML
        this.canvasTop = document.getElementById('accueilCanvasTop');
        this.canvasFront = document.getElementById('accueilCanvasFront');
        this.drawerContainer = document.getElementById('accueilDrawer');

        if (!this.canvasTop || !this.canvasFront || !this.drawerContainer) {
            console.error('❌ Éléments QuadView non trouvés dans accueil.html');
            return;
        }

        // Contextes canvas
        this.ctxTop = this.canvasTop.getContext('2d');
        this.ctxFront = this.canvasFront.getContext('2d');

        // Données
        this.racks = [];
        this.selectedRack = null;
        this.selectedLevel = null;

        // Variables pour le dessin
        this.gridSize = 20;
        this.rackHeightPerLevel = 40;
        this.slotSize = 60;

        // Initialiser
        this.init();
    }

    async init() {
        console.log('🔧 Configuration AccueilQuadManager');

        // 1. Ajuster les dimensions des canvas
        this.resizeCanvases();
        window.addEventListener('resize', () => this.resizeCanvases());

        // 2. Charger les données RÉELLES depuis l'API
        await this.loadRealData();

        // 4. Dessiner l'état initial
        this.drawAllViews();

        console.log('✅ AccueilQuadManager prêt');
    }

    async loadRealData() {
        try {
            console.log('📡 Chargement des racks depuis Supabase...');

            // 1. Charger les racks avec leurs niveaux et emplacements
            const { data: racks, error: racksError } = await supabase
                .from('w_vuestock_racks')
                .select(`
                    *,
                    w_vuestock_levels (
                        id,
                        level_code,
                        display_order,
                        rack_id,
                        w_vuestock_slots (
                            id,
                            slot_code,
                            level_id,
                            display_order,
                            status,
                            full_code
                        )
                    )
                `)
                .order('rack_code');

            if (racksError) throw racksError;

            // 2. Charger TOUS les articles (pour les associer ensuite)
            const { data: allArticles, error: articlesError } = await supabase
                .from('w_articles')
                .select('*')
                .not('slot_id', 'is', null); // On ne prend que les articles placés

            if (articlesError) throw articlesError;

            // 3. Assembler manuellement : placer les articles dans leurs emplacements
            if (racks && allArticles) {
                this.racks = racks.map(rack => {
                    // Parcourir chaque niveau...
                    const levelsWithSlots = rack.w_vuestock_levels?.map(level => {
                        // Parcourir chaque emplacement de ce niveau...
                        const slotsWithArticles = level.w_vuestock_slots?.map(slot => {
                            // Trouver l'article qui correspond à cet emplacement
                            const articleInSlot = allArticles.find(article =>
                                article.slot_id === slot.id &&
                                article.level_id === level.id &&
                                article.rack_id === rack.id
                            );

                            return {
                                ...slot,
                                code: slot.slot_code,
                                articles: articleInSlot ? [articleInSlot] : []
                            };
                        }) || [];

                        return {
                            ...level,
                            code: level.level_code,
                            slots: slotsWithArticles
                        };
                    }) || [];

                    return {
                        ...rack,
                        code: rack.rack_code,
                        name: rack.display_name,
                        levels: levelsWithSlots
                    };
                });

                // AJOUTER CES LIGNES (manquantes dans votre code) :
                console.log(`✅ ${this.racks.length} racks chargés depuis Supabase`);
                this.normalizeRackData();
                this.updateRackCount();

                // Afficher la vue du dessus seulement (racks sans sélection)
                this.drawTopView();

                // Réinitialiser les autres vues
                if (this.ctxFront) {
                    const width = this.canvasFront.width;
                    const height = this.canvasFront.height;
                    this.ctxFront.clearRect(0, 0, width, height);
                    this.ctxFront.fillStyle = '#f8f9fa';
                    this.ctxFront.fillRect(0, 0, width, height);
                    this.ctxFront.fillStyle = '#6c757d';
                    this.ctxFront.font = '14px Arial';
                    this.ctxFront.textAlign = 'center';
                    this.ctxFront.fillText('Sélectionnez un rack dans la vue du dessus', width/2, height/2);
                }

                // Vider le tiroir
                if (this.drawerContainer) {
                    this.drawerContainer.innerHTML = `
                        <div class="empty-drawer-state">
                            <div class="drawer-front-placeholder">
                                <i class="fas fa-drawer fa-3x"></i>
                                <p>Sélectionnez un étage dans la vue de face</p>
                            </div>
                        </div>
                    `;
                }
            } else {
                console.warn('⚠️ Aucun rack trouvé dans Supabase');
                this.showNotification('Aucun rack configuré', 'warning');
            }

        } catch (error) {
            console.error('❌ Erreur chargement Supabase:', error);
            this.showError('Impossible de charger les racks. Erreur base de données.');
        }
    }

    normalizeRackData() {
        // Normaliser les données comme dans QuadViewManager
        this.racks.forEach(rack => {
            // S'assurer que les propriétés existent
            rack.displayX = rack.position_x || 0;
            rack.displayY = rack.position_y || 0;
            rack.displayWidth = (rack.width || 3) * this.gridSize;
            rack.displayHeight = (rack.depth || 2) * this.gridSize;
            rack.rotation = rack.rotation || 0;

            // Normaliser les niveaux
            if (rack.levels) {
                rack.levels.forEach(level => {
                    level.code = level.level_code || level.code;

                    // Normaliser les emplacements
                    if (level.slots) {
                        level.slots.forEach(slot => {
                            slot.code = slot.slot_code || slot.code;
                        });
                    }
                });
            }
        });
    }

    connectToRealSearchSystem() {
        console.log('🔗 Connexion au système de recherche...');

        // 1. Recherche par nom (votre système existant)
        const searchNomBtn = document.getElementById('searchNomBtn');
        const searchNomInput = document.getElementById('searchNomInput');

        if (searchNomBtn && searchNomInput) {
            searchNomBtn.addEventListener('click', async () => {
                await this.handleRealSearch(searchNomInput.value, 'nom');
            });

            searchNomInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    await this.handleRealSearch(searchNomInput.value, 'nom');
                }
            });
        }

        // 2. Recherche par code-barre (votre système existant)
        const searchCodebarreBtn = document.getElementById('searchCodebarreBtn');
        const searchCodebarreInput = document.getElementById('searchCodebarreInput');

        if (searchCodebarreBtn && searchCodebarreInput) {
            searchCodebarreBtn.addEventListener('click', async () => {
                await this.handleRealSearch(searchCodebarreInput.value, 'codebarre');
            });

            searchCodebarreInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    await this.handleRealSearch(searchCodebarreInput.value, 'codebarre');
                }
            });
        }
    }

    highlightArticleLocation(fullCode) {
        // Parser le code complet: A-10-20
        const parts = fullCode.split('-');
        if (parts.length !== 3) {
            console.error('Format de code invalide:', fullCode);
            return;
        }

        const [rackCode, levelCode, slotCode] = parts;

        // 1. Trouver le rack
        const rack = this.racks.find(r => r.code === rackCode);
        if (!rack) {
            console.error(`Rack ${rackCode} non trouvé`);
            this.showNotification(`Rack ${rackCode} non trouvé`, 'error');
            return;
        }

        // 2. Sélectionner le rack
        this.selectRack(rack);

        // 3. Trouver le niveau
        const level = rack.levels?.find(l => l.code === levelCode);
        if (!level) {
            console.error(`Étage ${levelCode} non trouvé dans rack ${rackCode}`);
            this.showNotification(`Étage ${levelCode} non trouvé`, 'error');
            return;
        }

        // 4. Sélectionner le niveau
        this.selectLevel(level);

        // 5. Mettre à jour le tiroir avec mise en évidence
        this.updateDrawerWithHighlight(level, slotCode);

        // 6. Ajouter effet visuel
        this.addHighlightEffect(rack, level, slotCode);
    }

    selectRack(rack) {
        this.selectedRack = rack;
        this.selectedLevel = null;

        // Mettre à jour l'affichage
        document.getElementById('accueilSelectedRack').textContent =
            `Rack ${rack.code}`;

        // Dessiner la vue de face
        this.drawFrontView(); // <-- IMPORTANT

        // Redessiner la vue du dessus pour la surbrillance
        this.drawTopView();
    }

    selectLevel(level) {
        this.selectedLevel = level;

        document.getElementById('accueilLevelInfo').textContent =
            `Étage ${level.code} - ${level.slots?.length || 0} emplacements`;

        // Mettre à jour le tiroir
        this.updateDrawer(level); // <-- IMPORTANT
    }

    drawAllViews() {
        this.drawTopView();

        if (this.selectedRack) {
            this.drawFrontView();
        }

        if (this.selectedLevel) {
            this.updateDrawer(this.selectedLevel);
        }
    }

    drawTopView() {
        if (!this.ctxTop) return;

        const ctx = this.ctxTop;
        const width = this.canvasTop.width;
        const height = this.canvasTop.height;

        // Effacer
        ctx.clearRect(0, 0, width, height);

        // Dessiner la grille
        this.drawGrid(ctx, width, height, this.gridSize);

        // Calculer la position de départ (centré)
        const totalRackWidth = this.racks.reduce((sum, rack) =>
            sum + rack.displayWidth + 40, 0);
        let currentX = Math.max(20, (width - totalRackWidth) / 2);
        const startY = height / 2 - 40;

        // Dessiner chaque rack
        this.racks.forEach(rack => {
            const x = currentX;
            const y = startY;
            const w = rack.displayWidth;
            const h = rack.displayHeight;

            // Mettre à jour les coordonnées d'affichage
            rack.displayX = x;
            rack.displayY = y;

            // Couleur
            ctx.fillStyle = rack === this.selectedRack ? '#ffc107' : (rack.color || '#4a90e2');
            ctx.fillRect(x, y, w, h);

            // Bordure
            ctx.strokeStyle = rack === this.selectedRack ? '#fd7e14' : '#333';
            ctx.lineWidth = rack === this.selectedRack ? 3 : 2;
            ctx.strokeRect(x, y, w, h);

            // Code du rack
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(rack.code, x + w/2, y + h/2);

            // Avancer pour le prochain rack
            currentX += w + 40;
        });
    }

    drawFrontView() {
        if (!this.ctxFront || !this.selectedRack) return;

        const ctx = this.ctxFront;
        const width = this.canvasFront.width;
        const height = this.canvasFront.height;

        // Effacer
        ctx.clearRect(0, 0, width, height);

        const rack = this.selectedRack;
        const rackWidth = (rack.width || 3) * 30;
        const startX = (width - rackWidth) / 2;
        const startY = height - 20;

        // Base du rack
        ctx.fillStyle = rack.color || '#4a90e2';
        ctx.fillRect(startX, startY - 10, rackWidth, 10);

        // Niveaux (du bas vers le haut)
        if (rack.levels && rack.levels.length) {
            const levels = [...rack.levels].sort((a, b) => a.display_order - b.display_order);
            let currentY = startY - 10;

            levels.forEach(level => {
                const levelHeight = this.rackHeightPerLevel;
                const isSelected = level === this.selectedLevel;

                // Étage
                ctx.fillStyle = isSelected ? '#ffc107' : '#adb5bd';
                ctx.fillRect(startX, currentY - levelHeight, rackWidth, levelHeight);

                // Séparateur
                ctx.strokeStyle = '#495057';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(startX, currentY - levelHeight);
                ctx.lineTo(startX + rackWidth, currentY - levelHeight);
                ctx.stroke();

                // Code de l'étage
                ctx.fillStyle = isSelected ? '#000' : '#fff';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(level.code, startX + rackWidth/2, currentY - levelHeight/2);

                currentY -= levelHeight;
            });
        }
    }

    updateDrawer(level) {
        if (!this.drawerContainer) return;

        let html = '';

        if (!level.slots || level.slots.length === 0) {
            html = `
                <div class="empty-drawer-message">
                    <i class="fas fa-box-open"></i>
                    <p>Aucun emplacement dans cet étage</p>
                </div>
            `;
        } else {
            // Trier les emplacements par code
            const sortedSlots = [...level.slots].sort((a, b) =>
                parseInt(a.code) - parseInt(b.code));

            // Calculer la classe de zoom
            const slotCount = sortedSlots.length;
            let zoomClass = 'zoom-large';
            if (slotCount > 14) zoomClass = 'zoom-small';
            else if (slotCount > 9) zoomClass = 'zoom-medium';

            html = '<div class="quad-slot-grid">';

            sortedSlots.forEach(slot => {
                const article = slot.articles && slot.articles.length > 0 ? slot.articles[0] : null;
                const hasArticle = !!article;
                const stockLevel = this.getStockLevel(article);

                html += `
                    <div class="quad-slot ${zoomClass} ${hasArticle ? 'occupied ' + stockLevel : ''}"
                         data-slot-code="${slot.code}"
                         title="${this.generateSlotTooltip(slot, article)}">
                        ${this.generateSlotContent(slot, article, zoomClass)}
                    </div>
                `;
            });

            html += '</div>';
        }

        this.drawerContainer.innerHTML = html;
    }

    updateDrawerWithHighlight(level, highlightedSlotCode) {
        this.updateDrawer(level);

        // Ajouter la mise en évidence sur le slot spécifique
        const highlightedSlot = this.drawerContainer.querySelector(
            `[data-slot-code="${highlightedSlotCode}"]`
        );

        if (highlightedSlot) {
            highlightedSlot.classList.add('highlighted', 'pulse');

            // Scroll vers le slot
            highlightedSlot.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }

    getStockLevel(article) {
        if (!article) return '';

        const stockActuel = article.stock_actuel || article.quantity || 0;
        const stockMinimum = article.stock_minimum || 3;

        if (stockActuel === 0) return 'stock-zero';
        if (stockActuel <= stockMinimum) return 'stock-low';
        return 'stock-good';
    }

    generateSlotTooltip(slot, article) {
        const baseText = `Emplacement ${slot.code}`;

        if (!article) return `${baseText} - Libre`;

        const stockActuel = article.stock_actuel || article.quantity || 0;
        const stockMinimum = article.stock_minimum || 3;
        const articleName = article.nom || article.name || 'Article';

        let status = '';
        if (stockActuel === 0) status = 'Stock épuisé';
        else if (stockActuel <= stockMinimum) status = `Stock faible (min: ${stockMinimum})`;
        else status = `Stock OK (min: ${stockMinimum})`;

        return `${baseText} - ${articleName}\n${stockActuel} unités - ${status}`;
    }

    generateSlotContent(slot, article, zoomClass) {
        if (!article) {
            return `
                <div class="quad-slot-code">${slot.code}</div>
                <div class="quad-slot-status">Libre</div>
            `;
        }

        const imageUrl = article.photo || article.photo_url ||
            'https://via.placeholder.com/40x40/cccccc/666666?text=📦';
        const stock = article.quantity || article.stock_actuel || 0;
        const articleName = article.name || article.nom || 'Article';

        return `
            <div class="slot-content">
                <div class="slot-article-image">
                    <img src="${imageUrl}" alt="${articleName}"
                         onerror="this.src='https://via.placeholder.com/40x40/cccccc/666666?text=📦'">
                </div>
                <div class="slot-article-info">
                    <div class="slot-code-small">${slot.code}</div>
                    <div class="article-quantity">${stock}</div>
                </div>
            </div>
        `;
    }

    addHighlightEffect(rack, level, slotCode) {
        // Animation sur le rack dans la vue du dessus
        const rackIndex = this.racks.indexOf(rack);
        if (rackIndex !== -1) {
            this.drawTopView(); // Redessiner avec mise en évidence
        }

        // Animation sur le niveau dans la vue de face
        if (level && this.selectedLevel === level) {
            this.drawFrontView(); // Redessiner avec mise en évidence
        }

        console.log(`🎯 Emplacement ${slotCode} mis en évidence`);
    }

    drawGrid(ctx, width, height, size) {
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;

        // Lignes verticales
        for (let x = 0; x < width; x += size) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Lignes horizontales
        for (let y = 0; y < height; y += size) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }

    resizeCanvases() {
        const containers = [
            { canvas: this.canvasTop, container: this.canvasTop?.parentElement },
            { canvas: this.canvasFront, container: this.canvasFront?.parentElement }
        ];

        containers.forEach(item => {
            if (item.canvas && item.container) {
                const rect = item.container.getBoundingClientRect();
                item.canvas.width = rect.width - 30; // Padding
                item.canvas.height = rect.height - 30;
            }
        });

        // Redessiner après redimensionnement
        this.drawAllViews();
    }

    updateRackCount() {
        const countElement = document.getElementById('accueilRackCount');
        if (countElement) {
            countElement.textContent = `${this.racks.length} racks`;
        }
    }

    showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);

        // Vous pouvez intégrer votre système de notification existant
        // ou utiliser alert() temporairement
        if (type === 'error') {
            console.error(message);
        }
    }

    showError(message) {
        console.error(`❌ ${message}`);
        // Afficher dans l'interface si nécessaire
    }

    // Ajouter cette méthode dans AccueilQuadManager
    highlightArticleLocationFromArticle(article) {
        // UN SEUL LOG IMPORTANT
        console.log('QUAD DEBUG - Article:', {
            id: article.id,
            nom: article.nom,
            emplacement: article.emplacement
        });

        if (!article.emplacement || article.emplacement.trim() === '') {
            return false;
        }

        // Essayez de parser différents formats
        const fullCode = article.emplacement;

        // Format 1: "A-10-20" (standard)
        if (fullCode.includes('-')) {
            return this.highlightArticleLocation(fullCode);
        }

        // Format 2: "A10-20" ou autres variantes
        console.log('QUAD DEBUG - Format d\'emplacement non standard:', fullCode);
        return false;
    }
}

// Initialiser quand la page est chargée
document.addEventListener('DOMContentLoaded', () => {
    // Vérifier si la section Quad existe
    const quadSection = document.querySelector('.quad-section');
    if (quadSection) {
        // Délai pour s'assurer que tout est chargé
        setTimeout(() => {
            window.accueilQuadManager = new AccueilQuadManager();
        }, 500);
    }
});