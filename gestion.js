import { supabase } from './supabaseClient.js';

// Éléments DOM et variables
let currentUser = null;
let allArticles = [];
let filteredArticles = [];
let selectedArticles = new Set();
let currentPage = 1;
let rowsPerPage = 25;
let totalPages = 1;
let currentSort = 'nom_asc';
let currentFilter = '';
let currentArticleDetails = null;

// Configuration DataTable (optionnel)
let dataTable = null;

document.addEventListener('DOMContentLoaded', async function() {
    // Vérifier l'authentification
    await checkAuth();

    // Initialiser les événements
    setupEventListeners();

    // Charger les articles
    await loadArticles();

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
        if (!currentUser.permissions?.gestion) {
            alert('Vous n\'avez pas la permission de gérer les articles');
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

// ===== CHARGEMENT DES ARTICLES =====
async function loadArticles() {
    try {
        // Récupérer tous les articles
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allArticles = articles || [];

        // Appliquer les filtres et tris
        applyFiltersAndSort();

        // Mettre à jour l'interface
        updateArticlesTable();
        updatePagination();
        updateArticlesCount();

    } catch (error) {
        console.error('Erreur lors du chargement des articles:', error);
        alert('Erreur lors du chargement des articles');
    }
}

function applyFiltersAndSort() {
    // Appliquer le filtre
    filteredArticles = allArticles.filter(article => {
        // Filtre par recherche globale
        if (currentFilter) {
            const searchLower = currentFilter.toLowerCase();
            const matches =
                article.nom?.toLowerCase().includes(searchLower) ||
                article.numero?.toLowerCase().includes(searchLower) ||
                article.reference_interne?.toLowerCase().includes(searchLower) ||
                article.code_barre?.includes(searchLower);

            if (!matches) return false;
        }

        // Filtre par catégorie
        const categoryFilter = document.getElementById('filterCategory').value;
        switch(categoryFilter) {
            case 'actif':
                return article.actif === true;
            case 'inactif':
                return article.actif === false;
            case 'stock_bas':
                return article.stock_actuel <= article.stock_minimum;
            case 'rupture':
                return article.stock_actuel === 0;
            default:
                return true;
        }
    });

    // Appliquer le tri
    filteredArticles.sort((a, b) => {
        switch(currentSort) {
            case 'nom_asc':
                return (a.nom || '').localeCompare(b.nom || '');
            case 'nom_desc':
                return (b.nom || '').localeCompare(a.nom || '');
            case 'stock_asc':
                return (a.stock_actuel || 0) - (b.stock_actuel || 0);
            case 'stock_desc':
                return (b.stock_actuel || 0) - (a.stock_actuel || 0);
            case 'prix_asc':
                return (a.prix_unitaire || 0) - (b.prix_unitaire || 0);
            case 'prix_desc':
                return (b.prix_unitaire || 0) - (a.prix_unitaire || 0);
            case 'recent':
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            case 'ancien':
                return new Date(a.created_at || 0) - new Date(b.created_at || 0);
            default:
                return 0;
        }
    });

    // Calculer le nombre de pages
    totalPages = Math.ceil(filteredArticles.length / rowsPerPage);
    if (currentPage > totalPages) {
        currentPage = Math.max(1, totalPages);
    }
}

// ===== AFFICHAGE DU TABLEAU =====
function updateArticlesTable() {
    const tbody = document.getElementById('articlesTableBody');
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, filteredArticles.length);
    const pageArticles = filteredArticles.slice(startIndex, endIndex);

    tbody.innerHTML = '';

    if (pageArticles.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 3rem;">
                    <i class="fas fa-box-open" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                    <p>Aucun article trouvé</p>
                </td>
            </tr>
        `;
        return;
    }

    pageArticles.forEach(article => {
        const isSelected = selectedArticles.has(article.id);
        const row = document.createElement('tr');
        if (isSelected) row.classList.add('selected');

        // Calculer la valeur totale
        const totalValue = (article.stock_actuel || 0) * (article.prix_unitaire || 0);

        // Déterminer le statut
        let statusClass = 'status-active';
        let statusText = 'Actif';

        if (!article.actif) {
            statusClass = 'status-inactive';
            statusText = 'Inactif';
        } else if (article.stock_actuel === 0) {
            statusClass = 'status-out';
            statusText = 'Rupture';
        } else if (article.stock_actuel <= article.stock_minimum) {
            statusClass = 'status-low';
            statusText = 'Stock bas';
        }

        // Formater la date
        const lastUpdate = article.updated_at ?
            new Date(article.updated_at).toLocaleDateString('fr-FR') :
            new Date(article.created_at).toLocaleDateString('fr-FR');

        row.innerHTML = `
            <td class="select-column">
                <input type="checkbox" class="row-checkbox" data-id="${article.id}" ${isSelected ? 'checked' : ''}>
            </td>
            <td>
                <div class="article-photo">
                    ${article.photo_url ?
                        `<img src="${article.photo_url}" alt="${article.nom}" loading="lazy">` :
                        `<i class="fas fa-image"></i>`
                    }
                </div>
            </td>
            <td>
                <div class="article-info">
                    <div class="article-name">${article.nom || 'Sans nom'}</div>
                    <div class="article-details">
                        <span class="article-number">${article.numero || 'N/A'}</span>
                        ${article.reference_interne ? `<span>${article.reference_interne}</span>` : ''}
                    </div>
                </div>
            </td>
            <td class="stock-info">
                <div class="stock-quantity">${article.stock_actuel || 0}</div>
                <div class="stock-min">Min: ${article.stock_minimum || 1}</div>
            </td>
            <td class="price-info">
                <div class="price-amount">${(article.prix_unitaire || 0).toFixed(2)} €</div>
                <div class="price-unit">unité</div>
            </td>
            <td class="value-info">${totalValue.toFixed(2)} €</td>
            <td class="status-cell">
                <span class="status-badge ${statusClass}">${statusText}</span>
            </td>
            <td class="date-info">${lastUpdate}</td>
            <td class="actions-cell">
                <button class="btn-table-action view" data-id="${article.id}" title="Voir détails">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-table-action edit" data-id="${article.id}" title="Modifier">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-table-action delete" data-id="${article.id}" title="Supprimer">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });

    // Ajouter les événements aux nouvelles lignes
    setupTableRowEvents();
}

function setupTableRowEvents() {
    // Cases à cocher
    document.querySelectorAll('.row-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const articleId = this.dataset.id;
            if (this.checked) {
                selectedArticles.add(articleId);
                this.closest('tr').classList.add('selected');
            } else {
                selectedArticles.delete(articleId);
                this.closest('tr').classList.remove('selected');
            }
            updateSelectionInfo();
            updateMassActionButtons();
        });
    });

    // Boutons d'action
    document.querySelectorAll('.btn-table-action.view').forEach(btn => {
        btn.addEventListener('click', function() {
            const articleId = this.dataset.id;
            showArticleDetails(articleId);
        });
    });

    document.querySelectorAll('.btn-table-action.edit').forEach(btn => {
        btn.addEventListener('click', function() {
            const articleId = this.dataset.id;
            openEditModal(articleId);
        });
    });

    document.querySelectorAll('.btn-table-action.delete').forEach(btn => {
        btn.addEventListener('click', function() {
            const articleId = this.dataset.id;
            confirmDeleteArticle(articleId);
        });
    });

    // Clic sur une ligne (sauf sur les cases à cocher et boutons)
    document.querySelectorAll('#articlesTableBody tr').forEach(row => {
        row.addEventListener('click', function(e) {
            // Ne pas déclencher si on clique sur une case à cocher ou un bouton
            if (e.target.type === 'checkbox' ||
                e.target.closest('button') ||
                e.target.closest('input') ||
                e.target.closest('a')) {
                return;
            }

            const checkbox = this.querySelector('.row-checkbox');
            const articleId = checkbox?.dataset.id;

            if (articleId) {
                if (checkbox.checked) {
                    checkbox.checked = false;
                    selectedArticles.delete(articleId);
                    this.classList.remove('selected');
                } else {
                    checkbox.checked = true;
                    selectedArticles.add(articleId);
                    this.classList.add('selected');
                }
                updateSelectionInfo();
                updateMassActionButtons();
            }
        });
    });
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
    updateArticlesTable();
    updatePagination();
    scrollToTableTop();
}

function scrollToTableTop() {
    const tableSection = document.querySelector('.table-section');
    if (tableSection) {
        tableSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ===== SÉLECTION =====
function updateSelectionInfo() {
    const selectionInfo = document.getElementById('selectionInfo');
    const selectedCount = document.getElementById('selectedCount');

    if (selectedArticles.size > 0) {
        selectedCount.textContent = selectedArticles.size;
        selectionInfo.style.display = 'inline-flex';
    } else {
        selectionInfo.style.display = 'none';
    }
}

function updateMassActionButtons() {
    const hasSelection = selectedArticles.size > 0;
    document.getElementById('massEditBtn').disabled = !hasSelection;
    document.getElementById('massArchiveBtn').disabled = !hasSelection;
}

function selectAll() {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, filteredArticles.length);
    const pageArticles = filteredArticles.slice(startIndex, endIndex);

    pageArticles.forEach(article => {
        selectedArticles.add(article.id);
    });

    updateArticlesTable();
    updateSelectionInfo();
    updateMassActionButtons();
}

function deselectAll() {
    selectedArticles.clear();
    updateArticlesTable();
    updateSelectionInfo();
    updateMassActionButtons();
}

// ===== DÉTAILS DE L'ARTICLE =====
async function showArticleDetails(articleId) {
    try {
        console.log("Chargement détails pour ID:", articleId);

        const { data: article, error } = await supabase
            .from('w_articles')
            .select(`
                *,
                w_vuestock_racks (
                    rack_code,
                    display_name
                ),
                w_vuestock_levels (
                    level_code
                ),
                w_vuestock_slots (
                    full_code
                )
            `)
            .eq('id', articleId)
            .single();


        if (error) throw error;

        console.log("Article chargé:", article);

        currentArticleDetails = article;
        displayArticleDetails(article);

        // Ouvrir le sidebar sur mobile
        if (window.innerWidth <= 1400) {
            document.getElementById('detailsSidebar').classList.add('open');
        }

    } catch (error) {
        console.error('Erreur lors du chargement des détails:', error);
        alert('Erreur lors du chargement des détails de l\'article');
    }
}

function displayArticleDetails(article) {
    const detailsContainer = document.getElementById('articleDetails');

    if (!detailsContainer) {
        console.error("Le conteneur 'articleDetails' n'existe pas dans le DOM");
        return;
    }

    console.log("Affichage des détails pour:", article.nom);

    // VIDER COMPLÈTEMENT LE CONTENEUR
    detailsContainer.innerHTML = '';

    // AJOUTER DES STYLES DE FORÇAGE DIRECTEMENT
    detailsContainer.style.display = 'block';
    detailsContainer.style.visibility = 'visible';
    detailsContainer.style.opacity = '1';
    detailsContainer.style.height = 'auto';
    detailsContainer.style.overflow = 'visible';

    const totalValue = (article.stock_actuel || 0) * (article.prix_unitaire || 0);

    // Formater les dates
    const createdDate = new Date(article.created_at).toLocaleDateString('fr-FR');
    const updatedDate = article.updated_at ?
        new Date(article.updated_at).toLocaleDateString('fr-FR') :
        createdDate;

    // Déterminer le statut
    let statusClass = 'status-active';
    let statusIcon = 'fa-check-circle';
    let statusText = 'Actif';

    if (!article.actif) {
        statusClass = 'status-inactive';
        statusIcon = 'fa-ban';
        statusText = 'Inactif';
    } else if (article.stock_actuel === 0) {
        statusClass = 'status-out';
        statusIcon = 'fa-times-circle';
        statusText = 'Rupture';
    } else if (article.stock_actuel <= article.stock_minimum) {
        statusClass = 'status-low';
        statusIcon = 'fa-exclamation-triangle';
        statusText = 'Stock bas';
    }

    // Formater l'emplacement
    const locationParts = [];

    if (article.w_vuestock_racks) {
        locationParts.push(
            article.w_vuestock_racks.display_name
            || article.w_vuestock_racks.rack_code
        );
    }

    if (article.w_vuestock_levels) {
        locationParts.push(`Niveau ${article.w_vuestock_levels.level_code}`);
    }

    if (article.w_vuestock_slots) {
        locationParts.push(article.w_vuestock_slots.full_code);
    }

    const locationString = locationParts.length > 0
        ? locationParts.join(' → ')
        : 'Non spécifié';


    // GÉNÉRER LE HTML complet
    const htmlContent = `
        <div class="article-details-content">
            <!-- Photo avec bouton de changement -->
            <div class="detail-photo-container">
                <div class="detail-photo" id="detailPhotoContainer">
                    ${article.photo_url ?
                        `<img src="${article.photo_url}" alt="${article.nom}" loading="lazy" id="detailPhotoImg">` :
                        `<div class="detail-photo-placeholder" id="detailPhotoPlaceholder">
                            <i class="fas fa-image"></i>
                        </div>`
                    }
                    <div class="photo-overlay">
                        <button id="changePhotoBtn" class="btn-change-photo" title="Changer la photo">
                            <i class="fas fa-camera"></i> Changer
                        </button>
                    </div>
                </div>
                <input type="file" id="photoUploadInput" accept="image/*" style="display: none;">
            </div>

            <!-- Informations de base -->
            <div class="detail-section">
                <h4><i class="fas fa-info-circle"></i> Informations</h4>
                <div class="detail-item">
                    <span class="detail-label">Nom :</span>
                    <span class="detail-value">${article.nom || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Numéro :</span>
                    <span class="detail-value code">${article.numero || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Référence interne :</span>
                    <span class="detail-value">${article.reference_interne || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Code-barre :</span>
                    <span class="detail-value code">${article.code_barre || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Statut :</span>
                    <span class="detail-value">
                        <span class="status-badge ${statusClass}">
                            <i class="fas ${statusIcon}"></i> ${statusText}
                        </span>
                    </span>
                </div>
            </div>

            <!-- Emplacement -->
            <div class="detail-section">
                <h4><i class="fas fa-map-marker-alt"></i> Emplacement</h4>
                <div class="detail-item">
                    <span class="detail-label">Localisation :</span>
                    <span class="detail-value">${locationString}</span>
                </div>
            </div>

            <!-- Stock et prix -->
            <div class="detail-section">
                <h4><i class="fas fa-chart-line"></i> Stock et prix</h4>
                <div class="detail-item">
                    <span class="detail-label">Stock actuel :</span>
                    <span class="detail-value">${article.stock_actuel || 0}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Stock minimum :</span>
                    <span class="detail-value">${article.stock_minimum || 1}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Prix unitaire :</span>
                    <span class="detail-value">${(article.prix_unitaire || 0).toFixed(2)} €</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Valeur totale :</span>
                    <span class="detail-value" style="color: var(--success-color); font-size: 1.1rem;">
                        ${totalValue.toFixed(2)} €
                    </span>
                </div>
            </div>

            <!-- Caractéristiques -->
            <div class="detail-section">
                <h4><i class="fas fa-align-left"></i> Caractéristiques</h4>
                <div class="detail-description">
                    ${article.caracteristiques || 'Aucune description'}
                </div>
            </div>

            <!-- Métadonnées -->
            <div class="detail-section">
                <h4><i class="fas fa-database"></i> Métadonnées</h4>
                <div class="detail-item">
                    <span class="detail-label">Créé le :</span>
                    <span class="detail-value">${createdDate}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Modifié le :</span>
                    <span class="detail-value">${updatedDate}</span>
                </div>
            </div>

            <!-- Actions -->
            <div class="detail-actions">
                <button id="editFromDetailsBtn" class="btn-primary">
                    <i class="fas fa-edit"></i> Modifier
                </button>
                <button id="viewHistoryBtn" class="btn-secondary">
                    <i class="fas fa-history"></i> Historique
                </button>
            </div>
        </div>
    `;

    // Injecter le HTML
    detailsContainer.innerHTML = htmlContent;

    // FORCER L'AFFICHAGE DU SIDEBAR
    const sidebar = document.getElementById('detailsSidebar');
    if (sidebar) {
        sidebar.classList.add('open');
        sidebar.style.display = 'flex'; // Changé de 'block' à 'flex'
        sidebar.style.visibility = 'visible';
        sidebar.style.opacity = '1';
        sidebar.style.zIndex = '1000';
        sidebar.style.position = 'relative';
    }

    setTimeout(() => {
        // Événements existants
        const editBtn = document.getElementById('editFromDetailsBtn');
        const historyBtn = document.getElementById('viewHistoryBtn');

        if (editBtn) {
            editBtn.addEventListener('click', () => {
                openEditModal(article.id);
            });
        }

        if (historyBtn) {
            historyBtn.addEventListener('click', () => {
                window.location.href = `historique.html?article=${article.id}`;
            });
        }

        // NOUVEAU : Événement pour changer la photo
        const changePhotoBtn = document.getElementById('changePhotoBtn');
        const photoUploadInput = document.getElementById('photoUploadInput');

        if (changePhotoBtn) {
            changePhotoBtn.addEventListener('click', () => {
                photoUploadInput.click();
            });
        }

        if (photoUploadInput) {
            photoUploadInput.addEventListener('change', async (event) => {
                // PASSER l'objet article complet
                await handlePhotoChange(event, article.id, article.nom);
            });
        }
    }, 100);

    console.log("Détails injectés avec succès");
    console.log("Conteneur display:", window.getComputedStyle(detailsContainer).display);
    console.log("Conteneur height:", window.getComputedStyle(detailsContainer).height);
}

// ===== CHANGEMENT DE PHOTO =====
async function handlePhotoChange(event, articleId, articleName = 'Article') {
    const file = event.target.files[0];
    if (!file) return;

    // Vérifier le type de fichier
    if (!file.type.match('image.*')) {
        alert('Veuillez sélectionner une image (JPG, PNG, WebP)');
        return;
    }

    // Vérifier la taille (5MB max)
    if (file.size > 5 * 1024 * 1024) {
        if (!confirm('L\'image est trop lourde (max 5MB). Voulez-vous l\'optimiser automatiquement ?')) {
            return;
        }
    }

    // SAUVEGARDER LE CONTENU ORIGINAL AVANT
    const photoContainer = document.getElementById('detailPhotoContainer');
    const originalContent = photoContainer ? photoContainer.innerHTML : null;



    try {
        // Afficher un indicateur de chargement
        if (photoContainer) {
            photoContainer.innerHTML = `
                <div class="photo-uploading">
                    <i class="fas fa-spinner fa-spin fa-2x"></i>
                    <p>Traitement de l'image...</p>
                </div>
            `;
        }

        // Optimiser l'image
        const optimizedImage = await optimizeImage(file);

        // Upload vers Supabase Storage
        const photoUrl = await uploadPhotoToSupabase(optimizedImage, articleId);

        // Mettre à jour l'article dans la base de données
        await updateArticlePhoto(articleId, photoUrl);

        // Mettre à jour l'affichage
        updatePhotoDisplay(photoUrl, articleName);

        // Afficher un message de succès
        showPhotoUploadSuccess();

        // Mettre à jour currentArticleDetails
        if (currentArticleDetails && currentArticleDetails.id === articleId) {
            currentArticleDetails.photo_url = photoUrl;
        }

        // Recharger la liste des articles
        await loadArticles();

    } catch (error) {
        console.error('Erreur lors du changement de photo:', error);
        alert('Erreur lors du changement de photo : ' + error.message);

        // Restaurer l'affichage original
        if (photoContainer && originalContent) {
            photoContainer.innerHTML = originalContent;

            // Réattacher l'événement
            setTimeout(() => {
                const changePhotoBtn = document.getElementById('changePhotoBtn');
                const photoUploadInput = document.getElementById('photoUploadInput');

                if (changePhotoBtn && photoUploadInput) {
                    changePhotoBtn.addEventListener('click', () => {
                        photoUploadInput.click();
                    });
                }
            }, 100);
        }
    } finally {
        // Réinitialiser l'input file
        event.target.value = '';
    }
}

async function optimizeImage(file, maxWidth = 800, maxHeight = 800, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Redimensionner si nécessaire
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convertir en format WebP pour meilleure compression
                canvas.toBlob(function(blob) {
                    const optimizedFile = new File([blob], `article_${Date.now()}.webp`, {
                        type: 'image/webp',
                        lastModified: Date.now()
                    });

                    const optimizedDataUrl = canvas.toDataURL('image/webp', quality);

                    resolve({
                        file: optimizedFile,
                        dataUrl: optimizedDataUrl,
                        originalFile: file
                    });
                }, 'image/webp', quality);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function uploadPhotoToSupabase(photo, articleId) {
    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const fileName = `article_${articleId}_${timestamp}_${random}.webp`;
    const filePath = `articles/${fileName}`;

    // Convertir DataURL en Blob
    const response = await fetch(photo.dataUrl);
    const blob = await response.blob();

    // Upload vers Supabase Storage
    const { data, error } = await supabase.storage
        .from('Stockfr')
        .upload(filePath, blob, {
            cacheControl: '3600',
            upsert: true
        });

    if (error) throw error;

    // Récupérer l'URL publique
    const { data: { publicUrl } } = supabase.storage
        .from('Stockfr')
        .getPublicUrl(filePath);

    console.log('Nouvelle photo uploadée:', publicUrl);
    return publicUrl;
}

async function updateArticlePhoto(articleId, photoUrl) {
    const { error } = await supabase
        .from('w_articles')
        .update({
            photo_url: photoUrl,
            updated_at: new Date().toISOString()
        })
        .eq('id', articleId);

    if (error) throw error;

    console.log('Photo mise à jour pour l\'article:', articleId);
}

function updatePhotoDisplay(photoUrl, articleName) {
    const photoContainer = document.getElementById('detailPhotoContainer');

    photoContainer.innerHTML = `
        <img src="${photoUrl}" alt="${articleName}" loading="lazy" id="detailPhotoImg">
        <div class="photo-overlay">
            <button id="changePhotoBtn" class="btn-change-photo" title="Changer la photo">
                <i class="fas fa-camera"></i> Changer
            </button>
        </div>
    `;

    // Réattacher l'événement
    const changePhotoBtn = document.getElementById('changePhotoBtn');
    const photoUploadInput = document.getElementById('photoUploadInput');

    if (changePhotoBtn && photoUploadInput) {
        changePhotoBtn.addEventListener('click', () => {
            photoUploadInput.click();
        });
    }
}

function showPhotoUploadSuccess() {
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease;
        max-width: 300px;
    `;

    successDiv.innerHTML = `
        <i class="fas fa-check-circle" style="font-size: 1.2rem;"></i>
        <div>
            <div style="font-weight: bold; margin-bottom: 4px;">Photo mise à jour</div>
            <div style="font-size: 0.9rem; opacity: 0.9;">L'image a été modifiée avec succès</div>
        </div>
    `;

    document.body.appendChild(successDiv);

    // Supprimer après 3 secondes
    setTimeout(() => {
        if (successDiv.parentNode) {
            document.body.removeChild(successDiv);
        }
    }, 3000);
}

// ===== MODAL D'ÉDITION =====
async function openEditModal(articleId) {
    try {
        const { data: article, error } = await supabase
            .from('w_articles')
            .select('*')
            .eq('id', articleId)
            .single();

        if (error) throw error;

        // Remplir le formulaire
        document.getElementById('editArticleId').value = article.id;

        const formContent = document.getElementById('editFormContent');
        formContent.innerHTML = `
            <div class="form-group">
                <label for="editName">Nom *</label>
                <input type="text" id="editName" class="form-input" value="${article.nom || ''}" required>
            </div>

            <div class="form-group">
                <label for="editNumber">Numéro *</label>
                <input type="text" id="editNumber" class="form-input" value="${article.numero || ''}" required>
            </div>

            <div class="form-group">
                <label for="editBarcode">Code-barre</label>
                <input type="text" id="editBarcode" class="form-input" value="${article.code_barre || ''}">
            </div>

            <div class="form-group">
                <label for="editReference">Référence interne</label>
                <input type="text" id="editReference" class="form-input" value="${article.reference_interne || ''}">
            </div>

            <div class="form-group">
                <label for="editStock">Stock actuel</label>
                <input type="number" id="editStock" class="form-input" value="${article.stock_actuel || 0}" min="0">
            </div>

            <div class="form-group">
                <label for="editMinStock">Stock minimum</label>
                <input type="number" id="editMinStock" class="form-input" value="${article.stock_minimum || 1}" min="1">
            </div>

            <div class="form-group">
                <label for="editPrice">Prix unitaire (€)</label>
                <input type="number" id="editPrice" class="form-input" value="${article.prix_unitaire || 0}" min="0" step="0.01">
            </div>

            <div class="form-group">
                <label for="editActive">Statut</label>
                <select id="editActive" class="form-select">
                    <option value="true" ${article.actif ? 'selected' : ''}>Actif</option>
                    <option value="false" ${!article.actif ? 'selected' : ''}>Inactif</option>
                </select>
            </div>

            <!-- EMPLACEMENT -->
            <div class="form-group">
                <label for="editRack">Rack</label>
                <select id="editRack" class="form-select"></select>
            </div>

            <div class="form-group">
                <label for="editLevel">Niveau</label>
                <select id="editLevel" class="form-select" disabled></select>
            </div>

            <div class="form-group">
                <label for="editSlot">Slot</label>
                <select id="editSlot" class="form-select" disabled></select>
            </div>


            <div class="form-group" style="grid-column: 1 / -1;">
                <label for="editDescription">Caractéristiques</label>
                <textarea id="editDescription" class="form-textarea" rows="4">${article.caracteristiques || ''}</textarea>
            </div>
        `;

        // AJOUTEZ CES 2 LIGNES POUR DEBUG
        console.log("Zone:", article.zone);
        console.log("Rayon:", article.rayon);
        console.log("Étagère:", article.etagere);
        console.log("Position:", article.position);

        // Afficher le modal
        document.getElementById('editModal').style.display = 'flex';

    } catch (error) {
        console.error('Erreur lors du chargement de l\'article:', error);
        alert('Erreur lors du chargement de l\'article');
    }
}

// ===== SUPPRESSION =====
async function confirmDeleteArticle(articleId) {
    try {
        const { data: article, error: fetchError } = await supabase
            .from('w_articles')
            .select('nom')
            .eq('id', articleId)
            .single();

        if (fetchError) throw fetchError;

        const articleName = article.nom || 'cet article';

        showConfirmModal(
            `Supprimer l'article "${articleName}" ?`,
            async () => {
                await deleteArticle(articleId);
            }
        );

    } catch (error) {
        console.error('Erreur lors de la confirmation:', error);
        alert('Erreur lors de la suppression');
    }
}

async function deleteArticle(articleId) {
    try {
        const { error } = await supabase
            .from('w_articles')
            .delete()
            .eq('id', articleId);

        if (error) throw error;

        // Supprimer de la sélection si présent
        selectedArticles.delete(articleId);

        // Recharger les articles
        await loadArticles();

        // Fermer les modaux/sidebars ouverts
        if (currentArticleDetails?.id === articleId) {
            document.getElementById('articleDetails').innerHTML = `
                <div class="details-placeholder">
                    <i class="fas fa-box"></i>
                    <p>Sélectionnez un article pour voir ses détails</p>
                </div>
            `;
            currentArticleDetails = null;
        }

        // Fermer le modal d'édition si ouvert
        document.getElementById('editModal').style.display = 'none';

        alert('Article supprimé avec succès');

    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression de l\'article');
    }
}

// ===== MODAL DE CONFIRMATION =====
function showConfirmModal(message, onConfirm) {
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmModal').style.display = 'flex';

    // Nettoyer les anciens événements
    const yesBtn = document.getElementById('confirmYesBtn');
    const noBtn = document.getElementById('confirmNoBtn');

    const newYesBtn = yesBtn.cloneNode(true);
    const newNoBtn = noBtn.cloneNode(true);

    yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
    noBtn.parentNode.replaceChild(newNoBtn, noBtn);

    // Ajouter les nouveaux événements
    document.getElementById('confirmYesBtn').addEventListener('click', async () => {
        document.getElementById('confirmModal').style.display = 'none';
        await onConfirm();
    });

    document.getElementById('confirmNoBtn').addEventListener('click', () => {
        document.getElementById('confirmModal').style.display = 'none';
    });
}

// ===== ÉVÉNEMENTS =====
function setupEventListeners() {
    // Déconnexion
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Recherche
    document.getElementById('searchGlobal').addEventListener('input', function() {
        currentFilter = this.value;
        currentPage = 1;
        applyFiltersAndSort();
        updateArticlesTable();
        updatePagination();
    });

    // Filtres
    document.getElementById('filterCategory').addEventListener('change', function() {
        currentPage = 1;
        applyFiltersAndSort();
        updateArticlesTable();
        updatePagination();
    });

    document.getElementById('filterSort').addEventListener('change', function() {
        currentSort = this.value;
        applyFiltersAndSort();
        updateArticlesTable();
    });

    // Rows per page
    document.getElementById('rowsPerPage').addEventListener('change', function() {
        rowsPerPage = parseInt(this.value);
        currentPage = 1;
        applyFiltersAndSort();
        updateArticlesTable();
        updatePagination();
    });

    // Actualiser
    document.getElementById('refreshBtn').addEventListener('click', loadArticles);

    // Sélection
    document.getElementById('selectAllCheckbox').addEventListener('change', function() {
        if (this.checked) {
            selectAll();
        } else {
            deselectAll();
        }
    });

    document.getElementById('selectAllBtn').addEventListener('click', selectAll);
    document.getElementById('deselectAllBtn').addEventListener('click', deselectAll);

    // Pagination
    document.getElementById('firstPageBtn').addEventListener('click', () => goToPage(1));
    document.getElementById('prevPageBtn').addEventListener('click', () => goToPage(currentPage - 1));
    document.getElementById('nextPageBtn').addEventListener('click', () => goToPage(currentPage + 1));
    document.getElementById('lastPageBtn').addEventListener('click', () => goToPage(totalPages));

    // Actions rapides
    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    document.getElementById('exportPdfBtn').addEventListener('click', exportToPDF);
    document.getElementById('printListBtn').addEventListener('click', printList);
    document.getElementById('massEditBtn').addEventListener('click', massEdit);
    document.getElementById('massArchiveBtn').addEventListener('click', massArchive);

    // Sidebar
    document.getElementById('closeSidebarBtn').addEventListener('click', () => {
        document.getElementById('detailsSidebar').classList.remove('open');
    });

    // Modals
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

    // Formulaire d'édition
    document.getElementById('editArticleForm').addEventListener('submit', handleEditSubmit);
    document.getElementById('deleteArticleBtn').addEventListener('click', handleDeleteFromModal);
}

// ===== GESTION DES FORMULAIRES =====
async function handleEditSubmit(e) {
    e.preventDefault();

    const articleId = document.getElementById('editArticleId').value;
    const formData = {
        nom: document.getElementById('editName').value.trim(),
        numero: document.getElementById('editNumber').value.trim(),
        code_barre: document.getElementById('editBarcode').value.trim(),
        reference_interne: document.getElementById('editReference').value.trim(),
        stock_actuel: parseInt(document.getElementById('editStock').value) || 0,
        stock_minimum: parseInt(document.getElementById('editMinStock').value) || 1,
        prix_unitaire: parseFloat(document.getElementById('editPrice').value) || 0,
        actif: document.getElementById('editActive').value === 'true',
        caracteristiques: document.getElementById('editDescription').value.trim(),
        rack_id: parseInt(document.getElementById('editRack').value) || null,
        level_id: parseInt(document.getElementById('editLevel').value) || null,
        slot_id: parseInt(document.getElementById('editSlot').value) || null,
        updated_at: new Date().toISOString()
    };

    // Validation
    if (!formData.nom || !formData.numero) {
        showEditError('Le nom et le numéro sont obligatoires');
        return;
    }

    try {
        const { error } = await supabase
            .from('w_articles')
            .update(formData)
            .eq('id', articleId);

        if (error) throw error;

        // Fermer le modal
        document.getElementById('editModal').style.display = 'none';

        // Recharger les articles
        await loadArticles();

        // Mettre à jour les détails si l'article est actuellement affiché
        if (currentArticleDetails?.id === articleId) {
            await showArticleDetails(articleId);
        }

        alert('Article modifié avec succès');

    } catch (error) {
        console.error('Erreur lors de la modification:', error);
        showEditError('Erreur lors de la modification : ' + error.message);
    }
}

function handleDeleteFromModal() {
    const articleId = document.getElementById('editArticleId').value;
    document.getElementById('editModal').style.display = 'none';

    setTimeout(() => {
        confirmDeleteArticle(articleId);
    }, 300);
}

function showEditError(message) {
    const errorDiv = document.getElementById('editError');
    const errorText = document.getElementById('editErrorText');

    errorText.textContent = message;
    errorDiv.style.display = 'flex';
}

// ===== ACTIONS RAPIDES =====
function exportToExcel() {
    alert('Export Excel à implémenter');
    // Tu pourrais utiliser une librairie comme SheetJS
}

function exportToPDF() {
    alert('Export PDF à implémenter');
    // Tu pourrais utiliser une librairie comme jsPDF
}

function printList() {
    window.print();
}

async function massEdit() {
    if (selectedArticles.size === 0) return;

    showConfirmModal(
        `Modifier ${selectedArticles.size} article(s) ?`,
        async () => {
            alert('Modification en masse à implémenter');
            // Ici tu pourrais ouvrir un modal pour modifier plusieurs champs à la fois
        }
    );
}

async function massArchive() {
    if (selectedArticles.size === 0) return;

    showConfirmModal(
        `Archiver ${selectedArticles.size} article(s) ?\n\nLes articles seront marqués comme inactifs.`,
        async () => {
            try {
                const { error } = await supabase
                    .from('w_articles')
                    .update({ actif: false, updated_at: new Date().toISOString() })
                    .in('id', Array.from(selectedArticles));

                if (error) throw error;

                // Recharger les articles
                await loadArticles();

                // Vider la sélection
                selectedArticles.clear();
                updateSelectionInfo();
                updateMassActionButtons();

                alert(`${selectedArticles.size} article(s) archivé(s) avec succès`);

            } catch (error) {
                console.error('Erreur lors de l\'archivage:', error);
                alert('Erreur lors de l\'archivage');
            }
        }
    );
}

// ===== UTILITAIRES =====
function updateArticlesCount() {
    document.getElementById('articlesCount').textContent = allArticles.length;
}

function logout() {
    if (!confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
        return;
    }

    sessionStorage.removeItem('current_user');
    sessionStorage.removeItem('supabase_token');
    window.location.href = 'connexion.html';
}