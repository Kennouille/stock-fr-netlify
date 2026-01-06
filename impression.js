import { supabase } from './supabaseClient.js';

// Éléments DOM et variables
let currentUser = null;
let printQueue = [];
let currentPreviewIndex = 0;
let printSettings = {
    format: 'medium',
    showPrice: true,
    showStock: true,
    showDate: false,
    showLocation: false,
    copiesPerLabel: 1,
    orientation: 'portrait',
    barcodeHeight: 25,
    fontSize: 'medium',
    margin: 2
};
let scanStream = null;

// ===== NOTIFICATIONS =====
function showNotification(message, type = 'info') {
    // Supprimer les notifications existantes
    const existingNotifications = document.querySelectorAll('.custom-notification');
    existingNotifications.forEach(notif => {
        if (notif.parentNode) {
            notif.parentNode.removeChild(notif);
        }
    });

    const notification = document.createElement('div');
    notification.className = `custom-notification notification-${type}`;

    const icons = {
        info: 'info-circle',
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle'
    };

    const colors = {
        info: '#2196F3',
        success: '#4CAF50',
        error: '#f44336',
        warning: '#FF9800'
    };

    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        color: ${colors[type]};
        padding: 15px 20px;
        border-radius: 8px;
        border-left: 4px solid ${colors[type]};
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease;
        max-width: 300px;
        font-family: Arial, sans-serif;
    `;

    notification.innerHTML = `
        <i class="fas fa-${icons[type]}" style="font-size: 1.2rem;"></i>
        <div style="flex: 1;">
            <div style="font-weight: bold; margin-bottom: 4px;">
                ${type === 'info' ? 'Information' :
                  type === 'success' ? 'Succès' :
                  type === 'error' ? 'Erreur' : 'Attention'}
            </div>
            <div style="font-size: 0.9rem; color: #333;">${message}</div>
        </div>
        <button class="close-notification" style="background: none; border: none; color: #666; cursor: pointer;">
            <i class="fas fa-times"></i>
        </button>
    `;

    document.body.appendChild(notification);

    // Fermer au clic
    notification.querySelector('.close-notification').addEventListener('click', () => {
        if (notification.parentNode) {
            document.body.removeChild(notification);
        }
    });

    // Fermer automatiquement après 5 secondes
    setTimeout(() => {
        if (notification.parentNode) {
            document.body.removeChild(notification);
        }
    }, 5000);
}

// Ajouter l'animation CSS pour les notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', async function() {
    // Vérifier l'authentification
    await checkAuth();

    // Initialiser les événements
    setupEventListeners();

    // Initialiser les paramètres
    initializeSettings();

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
        if (!currentUser.permissions?.impression) {
            alert('Vous n\'avez pas la permission d\'imprimer des étiquettes');
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
function initializeSettings() {
    // Charger les paramètres sauvegardés
    const savedSettings = localStorage.getItem('labelSettings');
    if (savedSettings) {
        printSettings = { ...printSettings, ...JSON.parse(savedSettings) };
        applySavedSettings();
    }

    // Mettre à jour les sliders
    updateSliderValues();
}

function applySavedSettings() {
    // Format
    document.querySelector(`input[name="labelFormat"][value="${printSettings.format}"]`).checked = true;

    // Options
    document.getElementById('optionShowPrice').checked = printSettings.showPrice;
    document.getElementById('optionShowStock').checked = printSettings.showStock;
    document.getElementById('optionShowDate').checked = printSettings.showDate;
    document.getElementById('optionShowLocation').checked = printSettings.showLocation;

    // Copies
    document.getElementById('copiesPerLabel').value = printSettings.copiesPerLabel;

    // Orientation
    document.getElementById('labelOrientation').value = printSettings.orientation;

    // Sliders
    document.getElementById('barcodeHeight').value = printSettings.barcodeHeight;
    document.getElementById('marginSize').value = printSettings.margin;

    // Taille police
    document.getElementById('fontSize').value = printSettings.fontSize;
}

function updateSliderValues() {
    document.getElementById('barcodeHeightValue').textContent =
        `${document.getElementById('barcodeHeight').value} mm`;

    document.getElementById('marginSizeValue').textContent =
        `${document.getElementById('marginSize').value} mm`;
}

// ===== GESTION DES ÉVÉNEMENTS =====
function setupEventListeners() {
    // Déconnexion
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Onglets
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchTab(tab);
        });
    });

    // Recherche unique
    document.getElementById('searchNumberBtn').addEventListener('click', () => {
        searchByNumber('single');
    });

    document.getElementById('searchNameBtn').addEventListener('click', () => {
        searchByName('single');
    });

    document.getElementById('barcodeSearch').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchByBarcode('single');
    });

    // Recherche multiple
    document.getElementById('multipleSearch').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchForMultiple();
    });

    document.getElementById('addToPrintListBtn').addEventListener('click', () => {
        searchForMultiple();
    });

    // Actions liste
    document.getElementById('clearListBtn').addEventListener('click', clearPrintList);

    // Paramètres
    document.querySelectorAll('input[name="labelFormat"]').forEach(radio => {
        radio.addEventListener('change', updatePrintFormat);
    });

    document.getElementById('copiesPerLabel').addEventListener('change', updateCopies);
    document.getElementById('labelOrientation').addEventListener('change', updateOrientation);
    document.getElementById('fontSize').addEventListener('change', updateFontSize);

    document.querySelectorAll('.print-options input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', updatePrintOptions);
    });

    document.getElementById('barcodeHeight').addEventListener('input', updateBarcodeHeight);
    document.getElementById('marginSize').addEventListener('input', updateMargin);
    document.getElementById('resetSettingsBtn').addEventListener('click', resetSettings);

    // Aperçu
    document.getElementById('togglePreviewBtn').addEventListener('click', togglePreview);
    document.getElementById('previousLabelBtn').addEventListener('click', showPreviousLabel);
    document.getElementById('nextLabelBtn').addEventListener('click', showNextLabel);

    // Actions d'impression
    document.getElementById('generatePdfBtn').addEventListener('click', generatePDF);

    // Scan modal
    document.getElementById('scanBarcodeBtn').addEventListener('click', () => {
        openScanModal('single');
    });

    // Modal scan
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            closeScanModal();
        });
    });

    document.getElementById('startCameraBtn').addEventListener('click', startCamera);
    document.getElementById('stopCameraBtn').addEventListener('click', stopCamera);
    document.getElementById('toggleFlashBtn').addEventListener('click', toggleFlash);
    document.getElementById('confirmManualBarcodeBtn').addEventListener('click', confirmManualBarcode);

    // Impression multiple
    document.getElementById('printListBtn').addEventListener('click', printMultipleList);
}

// ===== GESTION DES ONGLETS =====
function switchTab(tab) {
    // Désactiver tous les onglets
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Activer l'onglet sélectionné
    document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}Tab`).classList.add('active');

    // Réinitialiser si on change d'onglet
    if (tab === 'multiple' || tab === 'mass') {
        document.getElementById('searchResults').style.display = 'none';
    }
}

// ===== RECHERCHE D'ARTICLES =====
async function searchByNumber(context) {
    const number = document.getElementById('articleNumberSearch').value.trim();

    if (!number) {
        alert('Veuillez saisir un numéro d\'article');
        return;
    }

    try {
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('*')
            .ilike('numero', `%${number}%`)
            .limit(10);

        if (error) throw error;

        displaySearchResults(articles, context);

    } catch (error) {
        console.error('Erreur recherche par numéro:', error);
        alert('Erreur lors de la recherche');
    }
}

async function searchByName(context) {
    const name = document.getElementById('articleNameSearch').value.trim();

    if (!name) {
        alert('Veuillez saisir un nom d\'article');
        return;
    }

    try {
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('*')
            .ilike('nom', `%${name}%`)
            .limit(10);

        if (error) throw error;

        displaySearchResults(articles, context);

    } catch (error) {
        console.error('Erreur recherche par nom:', error);
        alert('Erreur lors de la recherche');
    }
}

async function searchByBarcode(context) {
    const barcode = document.getElementById('barcodeSearch').value.trim();

    if (!barcode) {
        alert('Veuillez saisir ou scanner un code-barre');
        return;
    }

    try {
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('*')
            .eq('code_barre', barcode)
            .limit(5);

        if (error) throw error;

        displaySearchResults(articles, context);

    } catch (error) {
        console.error('Erreur recherche par code-barre:', error);
        alert('Erreur lors de la recherche');
    }
}

async function searchForMultiple() {
    const searchTerm = document.getElementById('multipleSearch').value.trim();

    if (!searchTerm) {
        alert('Veuillez saisir un terme de recherche');
        return;
    }

    try {
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('*')
            .or(`nom.ilike.%${searchTerm}%,numero.ilike.%${searchTerm}%,code_barre.ilike.%${searchTerm}%`)
            .limit(20);

        if (error) throw error;

        displayMultipleResults(articles);

    } catch (error) {
        console.error('Erreur recherche multiple:', error);
        alert('Erreur lors de la recherche');
    }
}

// ===== AFFICHAGE DES RÉSULTATS =====
function displaySearchResults(articles, context) {
    const resultsContainer = document.getElementById('resultsContainer');
    const searchResults = document.getElementById('searchResults');

    if (!articles || articles.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <p>Aucun article trouvé</p>
            </div>
        `;
        searchResults.style.display = 'block';
        return;
    }

    resultsContainer.innerHTML = '';

    articles.forEach(article => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';

        resultItem.innerHTML = `
            <div class="result-info">
                <h4>${article.nom}</h4>
                <div class="result-details">
                    <span>${article.numero}</span>
                    <span>${article.code_barre || 'Pas de code-barre'}</span>
                    <span>Stock: ${article.stock_actuel || 0}</span>
                </div>
            </div>
            <div class="result-actions">
                <button class="btn-action add-to-print" data-id="${article.id}" data-name="${article.nom}" data-number="${article.numero}" data-barcode="${article.code_barre}" data-stock="${article.stock_actuel}" data-price="${article.prix_unitaire}">
                    <i class="fas fa-plus"></i> Ajouter
                </button>
            </div>
        `;

        resultsContainer.appendChild(resultItem);
    });

    // Ajouter les événements aux boutons
    document.querySelectorAll('.add-to-print').forEach(btn => {
        btn.addEventListener('click', function() {
            const articleData = {
                id: this.dataset.id,
                name: this.dataset.name,
                number: this.dataset.number,
                barcode: this.dataset.barcode,
                stock: parseInt(this.dataset.stock) || 0,
                price: parseFloat(this.dataset.price) || 0,
                quantity: 1
            };

            if (context === 'single') {
                addToPrintQueue([articleData]);
                document.getElementById('searchResults').style.display = 'none';
                updatePrintButtons();
            } else {
                addToPrintList(articleData);
            }
        });
    });

    searchResults.style.display = 'block';
}

function displayMultipleResults(articles) {
    // Créer un modal ou overlay pour sélection multiple
    // Pour l'instant, on ajoute directement à la liste
    if (articles && articles.length > 0) {
        articles.forEach(article => {
            const articleData = {
                id: article.id,
                name: article.nom,
                number: article.numero,
                barcode: article.code_barre,
                stock: article.stock_actuel || 0,
                price: article.prix_unitaire || 0,
                quantity: 1
            };

            addToPrintList(articleData);
        });

        document.getElementById('multipleSearch').value = '';
    }
}

function displayMassArticle(article) {
    const detailsDiv = document.getElementById('massArticleDetails');

    document.getElementById('massArticleName').textContent = article.nom;
    document.getElementById('massArticleNumber').textContent = article.numero;
    document.getElementById('massArticleBarcode').textContent = article.code_barre || 'Pas de code-barre';

    detailsDiv.style.display = 'block';
}

// ===== GESTION DE LA LISTE D'IMPRESSION =====
function addToPrintList(articleData) {
    const printList = document.getElementById('printList');
    const emptyList = printList.querySelector('.empty-list');

    if (emptyList) {
        printList.removeChild(emptyList);
    }

    // Vérifier si l'article est déjà dans la liste
    const existingItem = printList.querySelector(`[data-id="${articleData.id}"]`);
    if (existingItem) {
        const quantityInput = existingItem.querySelector('.quantity-input');
        quantityInput.value = parseInt(quantityInput.value) + 1;
        updateListItemQuantity(existingItem, parseInt(quantityInput.value));
        return;
    }

    const listItem = document.createElement('div');
    listItem.className = 'list-item';
    listItem.dataset.id = articleData.id;

    listItem.innerHTML = `
        <div class="list-item-info">
            <div class="list-item-name">${articleData.name}</div>
            <div class="list-item-details">
                ${articleData.number} • ${articleData.barcode || 'Pas de code-barre'}
            </div>
        </div>
        <div class="list-item-quantity">
            <button class="btn-quantity minus" data-id="${articleData.id}">
                <i class="fas fa-minus"></i>
            </button>
            <input type="number"
                   class="quantity-input"
                   value="${articleData.quantity}"
                   min="1"
                   max="100"
                   data-id="${articleData.id}">
            <button class="btn-quantity plus" data-id="${articleData.id}">
                <i class="fas fa-plus"></i>
            </button>
        </div>
        <div class="list-item-actions">
            <button class="btn-remove" data-id="${articleData.id}" title="Supprimer">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    printList.appendChild(listItem);

    // Ajouter les événements
    listItem.querySelector('.minus').addEventListener('click', function() {
        const input = listItem.querySelector('.quantity-input');
        if (input.value > 1) {
            input.value = parseInt(input.value) - 1;
            updateListItemQuantity(listItem, input.value);
        }
    });

    listItem.querySelector('.plus').addEventListener('click', function() {
        const input = listItem.querySelector('.quantity-input');
        input.value = parseInt(input.value) + 1;
        updateListItemQuantity(listItem, input.value);
    });

    listItem.querySelector('.quantity-input').addEventListener('change', function() {
        const value = Math.max(1, Math.min(100, parseInt(this.value) || 1));
        this.value = value;
        updateListItemQuantity(listItem, value);
    });

    listItem.querySelector('.btn-remove').addEventListener('click', function() {
        printList.removeChild(listItem);
        updateListCount();

        if (printList.children.length === 0) {
            printList.innerHTML = `
                <div class="empty-list">
                    <i class="fas fa-tags"></i>
                    <p>Aucun article sélectionné</p>
                    <small>Ajoutez des articles à partir des résultats de recherche</small>
                </div>
            `;
        }
    });

    updateListCount();
}

function updateListItemQuantity(listItem, quantity) {
    // Mettre à jour la quantité dans l'objet articleData si stocké
    // Pour l'instant, on met juste à jour l'affichage
    updateListCount();
}

function updateListCount() {
    const items = document.querySelectorAll('#printList .list-item');
    let totalItems = 0;

    items.forEach(item => {
        const quantity = parseInt(item.querySelector('.quantity-input').value) || 1;
        totalItems += quantity;
    });

    document.getElementById('listCount').textContent = `${items.length} articles (${totalItems} étiquettes)`;
}

function clearPrintList() {
    const printList = document.getElementById('printList');
    printList.innerHTML = `
        <div class="empty-list">
            <i class="fas fa-tags"></i>
            <p>Aucun article sélectionné</p>
            <small>Ajoutez des articles à partir des résultats de recherche</small>
        </div>
    `;

    updateListCount();
}

function addMassToPrint() {
    const articleName = document.getElementById('massArticleName').textContent;
    const articleNumber = document.getElementById('massArticleNumber').textContent;
    const quantity = parseInt(document.getElementById('massQuantity').value) || 1;
    const startNumber = parseInt(document.getElementById('massStartNumber').value) || 1;

    if (!articleName || articleName === '') {
        alert('Veuillez d\'abord sélectionner un article');
        return;
    }

    // Pour l'instant, on ajoute simplement l'article avec la quantité
    // Dans une version complète, on pourrait gérer la numérotation séquentielle
    for (let i = 0; i < quantity; i++) {
        const articleData = {
            id: `mass-${Date.now()}-${i}`,
            name: `${articleName} ${startNumber + i > startNumber ? `#${startNumber + i}` : ''}`,
            number: articleNumber,
            barcode: '', // Générer ou utiliser un code-barre séquentiel
            stock: 0,
            price: 0,
            quantity: 1,
            sequentialNumber: startNumber + i
        };

        addToPrintList(articleData);
    }

    // Réinitialiser le formulaire
    document.getElementById('massQuantity').value = 1;
    document.getElementById('massStartNumber').value = 1;
    document.getElementById('massArticleDetails').style.display = 'none';
}

// ===== FILE D'ATTENTE D'IMPRESSION =====
function addToPrintQueue(articles) {
    articles.forEach(article => {
        // Ajouter le nombre de copies spécifié
        for (let i = 0; i < printSettings.copiesPerLabel; i++) {
            printQueue.push({ ...article });
        }
    });

    updatePrintQueue();
    updatePrintButtons();
}

function updatePrintQueue() {
    // Mettre à jour le récapitulatif
    const uniqueArticles = [...new Set(printQueue.map(item => item.id))];

    document.getElementById('summaryCount').textContent = printQueue.length;
    document.getElementById('summaryArticles').textContent = uniqueArticles.length;

    // Calculer les feuilles estimées (basé sur le format)
    const labelsPerSheet = calculateLabelsPerSheet();
    const estimatedSheets = Math.ceil(printQueue.length / labelsPerSheet);
    document.getElementById('summarySheets').textContent = estimatedSheets;

    // Coût estimé (exemple: 0.05€ par feuille)
    const estimatedCost = (estimatedSheets * 0.05).toFixed(2);
    document.getElementById('summaryCost').textContent = `${estimatedCost} €`;

    // Afficher le récapitulatif
    document.getElementById('printSummary').style.display = 'block';

    // Mettre à jour l'aperçu
    if (printQueue.length > 0) {
        currentPreviewIndex = 0;
        updatePreview();
        document.getElementById('previewSection').style.display = 'block';
    }
}

function calculateLabelsPerSheet() {
    // Selon le format d'étiquette
    switch(printSettings.format) {
        case 'small':
            return printSettings.orientation === 'portrait' ? 63 : 88; // A4
        case 'medium':
            return printSettings.orientation === 'portrait' ? 21 : 30; // A4
        case 'large':
            return printSettings.orientation === 'portrait' ? 8 : 12; // A4
        default:
            return 21;
    }
}

function updatePrintButtons() {
    const hasItems = printQueue.length > 0;
    document.getElementById('generatePdfBtn').disabled = !hasItems;
}

// ===== APERÇU =====
function togglePreview() {
    const previewSection = document.getElementById('previewSection');

    if (printQueue.length === 0) {
        alert('Veuillez d\'abord ajouter des articles à imprimer');
        return;
    }

    if (previewSection.style.display === 'none') {
        previewSection.style.display = 'block';
        updatePreview();
        document.getElementById('togglePreviewBtn').innerHTML = '<i class="fas fa-eye-slash"></i> Masquer';
    } else {
        previewSection.style.display = 'none';
        document.getElementById('togglePreviewBtn').innerHTML = '<i class="fas fa-eye"></i> Aperçu';
    }
}

function updatePreview() {
    if (printQueue.length === 0) return;

    const currentItem = printQueue[currentPreviewIndex];

    // Mettre à jour le compteur
    document.getElementById('currentPreview').textContent = currentPreviewIndex + 1;
    document.getElementById('totalPreviews').textContent = printQueue.length;

    // Activer/désactiver les boutons de navigation
    document.getElementById('previousLabelBtn').disabled = currentPreviewIndex === 0;
    document.getElementById('nextLabelBtn').disabled = currentPreviewIndex === printQueue.length - 1;

    // Mettre à jour l'étiquette
    updateLabelPreview(currentItem);

    // Mettre à jour les infos
    updatePreviewInfo();
}

function updateLabelPreview(item) {
    const label = document.getElementById('previewLabel');
    const barcodeContainer = document.getElementById('previewBarcode');

    // Appliquer le format
    applyLabelFormat(label);

    // Vérifier si c'est une étiquette d'inventaire
    const isInventory = item.inventoryData !== undefined;

    // Mettre à jour le texte
    document.getElementById('previewTitle').textContent = item.name;
    document.getElementById('previewNumber').textContent = item.number;

    // Gérer l'affichage du stock selon le type
    const stockElement = document.getElementById('previewStock');
    if (isInventory) {
        stockElement.textContent = `Avant: ${item.inventoryData.stock_avant} | Après: ${item.inventoryData.stock_inventaire}`;
        stockElement.style.fontWeight = 'bold';
    } else {
        stockElement.textContent = `Stock: ${item.stock}`;
        stockElement.style.fontWeight = 'normal';
    }

    document.getElementById('previewPrice').textContent = `${item.price.toFixed(2)}€`;

    // Date actuelle ou date d'inventaire
    const dateElement = document.getElementById('previewDate');
    if (isInventory) {
        dateElement.textContent = item.inventoryData.date_inventaire;
    } else {
        dateElement.textContent = new Date().toLocaleDateString('fr-FR');
    }

    // Générer le code-barre
    generateBarcodePreview(item.barcode || item.number, barcodeContainer);

    // Afficher/masquer les éléments selon les options
    togglePreviewElements();

    // Ajouter un indicateur pour l'inventaire
    const locationElement = document.getElementById('previewLocation');
    if (isInventory) {
        locationElement.textContent = 'INVENTAIRE';
        locationElement.style.color = '#4CAF50';
        locationElement.style.fontWeight = 'bold';
    } else {
        locationElement.textContent = 'Zone A';
        locationElement.style.color = '';
        locationElement.style.fontWeight = 'normal';
    }
}

function applyLabelFormat(label) {
    // Réinitialiser les styles
    label.style.width = '';
    label.style.height = '';
    label.style.padding = '';

    switch(printSettings.format) {
        case 'small':
            label.style.width = '120px'; // 40mm à 96dpi
            label.style.height = '60px'; // 20mm à 96dpi
            label.style.padding = '4px';
            break;
        case 'medium':
            label.style.width = '180px'; // 60mm à 96dpi
            label.style.height = '120px'; // 40mm à 96dpi
            label.style.padding = '8px';
            break;
        case 'large':
            label.style.width = '300px'; // 100mm à 96dpi
            label.style.height = '210px'; // 70mm à 96dpi
            label.style.padding = '12px';
            break;
    }

    // Appliquer l'orientation
    if (printSettings.orientation === 'landscape') {
        const temp = label.style.width;
        label.style.width = label.style.height;
        label.style.height = temp;
    }
}

function generateBarcodePreview(code, container) {
    container.innerHTML = '';

    if (!code) {
        container.innerHTML = '<div class="no-barcode">Pas de code-barre</div>';
        return;
    }

    try {
        // Créer un conteneur pour le code-barre
        const barcodeWrapper = document.createElement('div');
        barcodeWrapper.className = 'barcode-preview-wrapper';

        // Créer le SVG pour le code-barre
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'preview-barcode-svg';

        // Créer un div pour le numéro sous le code-barre
        const numberDiv = document.createElement('div');
        numberDiv.className = 'barcode-preview-number';
        numberDiv.textContent = code;

        // Ajouter au conteneur
        barcodeWrapper.appendChild(svg);
        barcodeWrapper.appendChild(numberDiv);
        container.appendChild(barcodeWrapper);

        // Générer le code-barre avec JsBarcode
        JsBarcode(svg, code, {
            format: "CODE128",
            width: 2,
            height: printSettings.barcodeHeight,
            displayValue: false,
            margin: 0
        });

        // Ajuster la taille du SVG
        svg.style.width = '100%';
        svg.style.height = 'auto';
        svg.style.maxHeight = '40px';

    } catch (error) {
        console.error('Erreur génération code-barre:', error);
        container.innerHTML = '<div class="no-barcode">Erreur code-barre</div>';
    }
}

function togglePreviewElements() {
    // Prix
    document.getElementById('previewPrice').style.display =
        printSettings.showPrice ? 'inline' : 'none';

    // Stock
    document.getElementById('previewStock').style.display =
        printSettings.showStock ? 'inline' : 'none';

    // Date
    document.getElementById('previewDate').style.display =
        printSettings.showDate ? 'inline' : 'none';

    // Emplacement
    document.getElementById('previewLocation').style.display =
        printSettings.showLocation ? 'inline' : 'none';

    // Ajuster la taille de police
    const labelText = document.querySelector('.label-text');
    labelText.style.fontSize = printSettings.fontSize === 'small' ? '10px' :
                              printSettings.fontSize === 'large' ? '14px' : '12px';
}

function updatePreviewInfo() {
    document.getElementById('previewFormat').textContent =
        `${printSettings.format === 'small' ? 'Petite' :
          printSettings.format === 'medium' ? 'Moyenne' : 'Grande'}`;

    document.getElementById('previewOrientation').textContent =
        printSettings.orientation === 'portrait' ? 'Portrait' : 'Paysage';

    const labelsPerSheet = calculateLabelsPerSheet();
    const sheets = Math.ceil(printQueue.length / labelsPerSheet);
    document.getElementById('previewPaper').textContent =
        `${sheets} feuille${sheets > 1 ? 's' : ''} A4`;
}

function showPreviousLabel() {
    if (currentPreviewIndex > 0) {
        currentPreviewIndex--;
        updatePreview();
    }
}

function showNextLabel() {
    if (currentPreviewIndex < printQueue.length - 1) {
        currentPreviewIndex++;
        updatePreview();
    }
}

// ===== GESTION DES PARAMÈTRES =====
function updatePrintFormat() {
    const selectedFormat = document.querySelector('input[name="labelFormat"]:checked').value;
    printSettings.format = selectedFormat;
    saveSettings();

    if (printQueue.length > 0) {
        updatePreview();
    }
}

function updateCopies() {
    printSettings.copiesPerLabel = parseInt(document.getElementById('copiesPerLabel').value) || 1;
    saveSettings();
}

function updateOrientation() {
    printSettings.orientation = document.getElementById('labelOrientation').value;
    saveSettings();

    if (printQueue.length > 0) {
        updatePreview();
    }
}

function updateFontSize() {
    printSettings.fontSize = document.getElementById('fontSize').value;
    saveSettings();

    if (printQueue.length > 0) {
        updatePreview();
    }
}

function updatePrintOptions() {
    printSettings.showPrice = document.getElementById('optionShowPrice').checked;
    printSettings.showStock = document.getElementById('optionShowStock').checked;
    printSettings.showDate = document.getElementById('optionShowDate').checked;
    printSettings.showLocation = document.getElementById('optionShowLocation').checked;
    saveSettings();

    if (printQueue.length > 0) {
        togglePreviewElements();
    }
}

function updateBarcodeHeight() {
    const value = document.getElementById('barcodeHeight').value;
    printSettings.barcodeHeight = parseInt(value);
    document.getElementById('barcodeHeightValue').textContent = `${value} mm`;
    saveSettings();

    if (printQueue.length > 0) {
        updatePreview();
    }
}

function updateMargin() {
    const value = document.getElementById('marginSize').value;
    printSettings.margin = parseInt(value);
    document.getElementById('marginSizeValue').textContent = `${value} mm`;
    saveSettings();
}

function resetSettings() {
    printSettings = {
        format: 'medium',
        showPrice: true,
        showStock: true,
        showDate: false,
        showLocation: false,
        copiesPerLabel: 1,
        orientation: 'portrait',
        barcodeHeight: 25,
        fontSize: 'medium',
        margin: 2
    };

    applySavedSettings();
    updateSliderValues();
    saveSettings();

    if (printQueue.length > 0) {
        updatePreview();
    }
}

function saveSettings() {
    localStorage.setItem('labelSettings', JSON.stringify(printSettings));
}

// ===== POPUP SCAN POUR IMPRESSION =====
async function openScanModal(context) {
    const popup = document.createElement('div');
    popup.className = 'scan-popup-overlay';

    const actionNames = {
        'single': 'Recherche',
        'etiquette': 'Étiquettes',
        'inventaire': 'Inventaire'
    };

    popup.innerHTML = `
        <div class="scan-popup">
            <div class="popup-header">
                <h3><i class="fas fa-camera"></i> Scanner pour ${actionNames[context] || 'Impression'}</h3>
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
                    </div>
                </div>

                <div class="manual-section">
                    <h4><i class="fas fa-keyboard"></i> Saisie manuelle</h4>
                    <div class="form-group">
                        <input type="text"
                               id="manualBarcodeInput"
                               placeholder="Saisir le code-barre manuellement"
                               class="scan-input">
                        <button id="confirmManualBtn" class="btn btn-success">
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

                <div id="scanStatus" class="scan-status">
                    <p><i class="fas fa-info-circle"></i> En attente de scan...</p>
                </div>
            </div>

            <div class="popup-footer">
                <button class="btn btn-secondary close-popup-btn">Annuler</button>
                <div class="scan-stats">
                    <span id="scanResult"></span>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Variables pour le scan
    let scanStream = null;
    let currentContext = context;

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
    popup.querySelector('#confirmManualBtn').addEventListener('click', () => processManualBarcode(currentContext));

    popup.querySelector('#manualBarcodeInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') processManualBarcode(currentContext);
    });

    // Démarrer automatiquement la caméra
    setTimeout(() => {
        startCameraScan();
    }, 500);

    async function startCameraScan() {
        try {
            // Démarrer la caméra
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
            popup.querySelector('#startCameraBtn').style.display = 'none';

            scanStream = stream;

            // Démarrer Quagga pour la détection
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
                frequency: 10
            }, function(err) {
                if (err) {
                    console.error('Erreur Quagga:', err);
                    updateScanStatus('Scanner incompatible. Utilisez la saisie manuelle.', 'error');
                    return;
                }

                Quagga.start();
                updateScanStatus('Scanner prêt. Centrez le code-barre.', 'success');
            });

            // Quand un code est détecté
            Quagga.onDetected(function(result) {
                const code = result.codeResult.code;

                // Arrêter Quagga et la caméra
                Quagga.stop();
                stream.getTracks().forEach(track => track.stop());

                updateScanStatus(`Code détecté: ${code}. Traitement...`, 'info');

                // Traiter selon le contexte
                handleScannedBarcode(code, currentContext);
            });

        } catch (error) {
            console.error('Erreur caméra:', error);
            updateScanStatus('Caméra inaccessible. Utilisez la saisie manuelle.', 'error');
            popup.querySelector('#manualBarcodeInput').focus();
        }
    }

    function processManualBarcode(context) {
        const input = popup.querySelector('#manualBarcodeInput');
        const barcode = input.value.trim();

        if (!barcode) {
            updateScanStatus('Veuillez entrer un code-barre', 'warning');
            return;
        }

        updateScanStatus(`Code saisi: ${barcode}. Traitement...`, 'info');
        handleScannedBarcode(barcode, context);
    }

    function stopCameraScan() {
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
        const placeholder = popup.querySelector('#cameraPlaceholder');

        if (video) {
            video.srcObject = null;
            video.style.display = 'none';
        }

        if (placeholder) {
            placeholder.style.display = 'block';
        }

        popup.querySelector('#stopCameraBtn').style.display = 'none';
        popup.querySelector('#startCameraBtn').style.display = 'inline-block';
    }

    function stopScan() {
        stopCameraScan();
    }

    function updateScanStatus(message, type = 'info') {
        const statusDiv = popup.querySelector('#scanStatus');
        const icons = {
            info: 'info-circle',
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle'
        };
        const colors = {
            info: '#2196F3',
            success: '#4CAF50',
            error: '#f44336',
            warning: '#FF9800'
        };

        statusDiv.innerHTML = `
            <p style="color: ${colors[type]}; margin: 0;">
                <i class="fas fa-${icons[type]}"></i> ${message}
            </p>
        `;
    }
}

async function handleScannedBarcode(barcode, context) {
    console.log(`Traitement du code ${barcode} pour contexte: ${context}`);

    // Fermer tous les popups de scan
    const popup = document.querySelector('.scan-popup-overlay');
    if (popup) {
        document.body.removeChild(popup);
    }

    // Selon le contexte, faire différentes actions
    switch(context) {
        case 'etiquette':
            // Recherche pour impression d'étiquette
            await searchArticleForPrint(barcode, 'etiquette');
            break;

        case 'inventaire':
            // Recherche pour inventaire
            await searchArticleForInventory(barcode);
            break;

        case 'single':
        default:
            // Recherche pour étiquette unique
            await searchArticleForPrint(barcode, 'single');
            break;
    }

    // Afficher notification
    showScanSuccess(barcode, context);
}

function addToInventoryList(barcode) {
    console.log('Ajout à l\'inventaire:', barcode);
    // Logique d'inventaire
}

function handleBarcodeForPrint(barcode) {
    console.log('Traitement pour impression:', barcode);
    // Action par défaut
    searchArticleForPrint(barcode);
}

async function searchArticleForPrint(barcode, context = 'single') {
    try {
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('*')
            .eq('code_barre', barcode)
            .limit(1);

        if (error) throw error;

        if (articles && articles.length > 0) {
            const article = articles[0];
            console.log('Article trouvé pour impression:', article.nom);

            // Créer l'objet article pour la liste d'impression
            const articleData = {
                id: article.id,
                name: article.nom,
                number: article.numero,
                barcode: article.code_barre,
                stock: article.stock_actuel || 0,
                price: article.prix_unitaire || 0,
                quantity: 1
            };

            // Ajouter à la file d'attente d'impression
            addToPrintQueue([articleData]);

            // Si c'était dans le contexte "single", passer à l'onglet paramètres
            if (context === 'single') {
                switchTab('single');
                document.getElementById('searchResults').style.display = 'none';
                document.getElementById('barcodeSearch').value = barcode;
            }

            // Afficher notification
            showNotification(`"${article.nom}" ajouté à l'impression`, 'success');

            return articleData;

        } else {
            // Si aucun article n'est trouvé, demander si on veut créer une étiquette manuelle
            const createManual = confirm(`Aucun article trouvé avec le code-barre ${barcode}. Voulez-vous créer une étiquette manuelle ?`);

            if (createManual) {
                // Créer un article temporaire
                const manualArticle = {
                    id: `manual-${Date.now()}`,
                    name: `Article scanné (${barcode})`,
                    number: `SCAN-${barcode.substring(0, 8)}`,
                    barcode: barcode,
                    stock: 0,
                    price: 0,
                    quantity: 1
                };

                addToPrintQueue([manualArticle]);
                showNotification('Étiquette créée manuellement', 'info');
            } else {
                showNotification('Aucun article trouvé', 'warning');
            }

            return null;
        }

    } catch (error) {
        console.error('Erreur recherche article:', error);
        showNotification('Erreur lors de la recherche de l\'article', 'error');
        return null;
    }
}

async function searchArticleForInventory(barcode) {
    try {
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('*')
            .eq('code_barre', barcode)
            .limit(1);

        if (error) throw error;

        if (articles && articles.length > 0) {
            const article = articles[0];

            // Ouvrir un popup pour saisir l'inventaire
            openInventoryPopup(article);

        } else {
            showNotification(`Aucun article trouvé avec le code-barre ${barcode}`, 'warning');

            // Demander si on veut créer un article temporaire pour l'inventaire
            const createTemp = confirm(`Aucun article trouvé. Voulez-vous créer un enregistrement temporaire pour l'inventaire ?`);

            if (createTemp) {
                const tempArticle = {
                    id: `temp-${Date.now()}`,
                    nom: `Article inconnu (${barcode})`,
                    numero: `TEMP-${barcode.substring(0, 8)}`,
                    code_barre: barcode,
                    stock_actuel: 0,
                    prix_unitaire: 0
                };

                openInventoryPopup(tempArticle, true);
            }
        }

    } catch (error) {
        console.error('Erreur recherche inventaire:', error);
        showNotification('Erreur lors de la recherche pour l\'inventaire', 'error');
    }
}

function openInventoryPopup(article, isTemporary = false) {
    const popup = document.createElement('div');
    popup.className = 'inventory-popup-overlay';

    popup.innerHTML = `
        <div class="inventory-popup">
            <div class="popup-header">
                <h3><i class="fas fa-clipboard-check"></i> Saisie d'inventaire</h3>
                <button class="close-inventory-popup">&times;</button>
            </div>

            <div class="popup-content">
                <div class="inventory-article-info">
                    <h4>Article</h4>
                    <div class="article-details">
                        <div class="detail-row">
                            <span class="detail-label">Nom :</span>
                            <span class="detail-value">${article.nom}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Numéro :</span>
                            <span class="detail-value">${article.numero}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Code-barre :</span>
                            <span class="detail-value">${article.code_barre || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Stock actuel :</span>
                            <span class="detail-value" id="currentStockValue">${article.stock_actuel || 0}</span>
                        </div>
                    </div>
                </div>

                <div class="inventory-form">
                    <h4>Quantités</h4>
                    <div class="form-group">
                        <label for="inventoryQuantity">
                            <i class="fas fa-calculator"></i> Quantité réelle (inventaire)
                        </label>
                        <input type="number"
                               id="inventoryQuantity"
                               value="${article.stock_actuel || 0}"
                               min="0"
                               class="form-input-large">
                    </div>

                    <div class="quantity-comparison">
                        <div class="comparison-item">
                            <span class="comparison-label">Avant inventaire :</span>
                            <span class="comparison-value stock-before">${article.stock_actuel || 0}</span>
                        </div>
                        <div class="comparison-item">
                            <span class="comparison-label">Après inventaire :</span>
                            <span class="comparison-value stock-after" id="stockAfterValue">${article.stock_actuel || 0}</span>
                        </div>
                        <div class="comparison-item">
                            <span class="comparison-label">Différence :</span>
                            <span class="comparison-value stock-diff" id="stockDiffValue">0</span>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="inventoryNotes">
                            <i class="fas fa-sticky-note"></i> Remarques (optionnel)
                        </label>
                        <textarea id="inventoryNotes"
                                  placeholder="Notes sur l'inventaire..."
                                  class="form-textarea"
                                  rows="3"></textarea>
                    </div>
                </div>

                ${isTemporary ? `
                    <div class="temporary-warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Cet article n'existe pas dans la base de données. L'enregistrement sera temporaire.</p>
                    </div>
                ` : ''}
            </div>

            <div class="popup-footer">
                <button class="btn btn-secondary close-inventory-popup-btn">Annuler</button>
                <div class="footer-actions">
                    <button class="btn btn-primary save-inventory-btn">
                        <i class="fas fa-save"></i> Enregistrer
                    </button>
                    <button class="btn btn-success add-to-print-btn">
                        <i class="fas fa-print"></i> Ajouter à l'impression
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Événements
    const quantityInput = popup.querySelector('#inventoryQuantity');
    const saveBtn = popup.querySelector('.save-inventory-btn');
    const printBtn = popup.querySelector('.add-to-print-btn');

    // Calculer la différence en temps réel
    quantityInput.addEventListener('input', updateInventoryCalculations);

    // Bouton enregistrer
    saveBtn.addEventListener('click', () => {
        const notes = popup.querySelector('#inventoryNotes')?.value || '';
        saveInventory(article, quantityInput.value, isTemporary, notes);
    });

    // Bouton ajouter à l'impression
    printBtn.addEventListener('click', () => {
        addInventoryToPrint(article, quantityInput.value);
        document.body.removeChild(popup);
    });

    // Fermer le popup
    popup.querySelector('.close-inventory-popup').addEventListener('click', () => {
        document.body.removeChild(popup);
    });

    popup.querySelector('.close-inventory-popup-btn').addEventListener('click', () => {
        document.body.removeChild(popup);
    });

    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            document.body.removeChild(popup);
        }
    });

    // Initialiser les calculs
    updateInventoryCalculations();

    function updateInventoryCalculations() {
        const currentStock = parseInt(article.stock_actuel) || 0;
        const inventoryQty = parseInt(quantityInput.value) || 0;

        // Mettre à jour les valeurs
        popup.querySelector('#stockAfterValue').textContent = inventoryQty;

        const diff = inventoryQty - currentStock;
        const diffElement = popup.querySelector('#stockDiffValue');
        diffElement.textContent = diff;

        // Colorer la différence
        if (diff > 0) {
            diffElement.style.color = '#4CAF50';
        } else if (diff < 0) {
            diffElement.style.color = '#f44336';
        } else {
            diffElement.style.color = '#666';
        }
    }
}

async function saveInventory(article, inventoryQuantity, isTemporary = false, notes = '') {
    const currentStock = article.stock_actuel || 0;
    const newStock = parseInt(inventoryQuantity) || 0;

    console.log('=== DÉBUT saveInventory ===');
    console.log('Article:', {
        id: article.id,
        idType: typeof article.id,
        nom: article.nom,
        numero: article.numero,
        currentStock: currentStock,
        newStock: newStock
    });
    console.log('Paramètres:', { isTemporary, notes });

    try {
        if (isTemporary) {
            console.log('Sauvegarde temporaire dans w_inventaire_temporaire');

            const { data, error } = await supabase
                .from('w_inventaire_temporaire')
                .insert({
                    nom: article.nom,
                    numero: article.numero,
                    code_barre: article.code_barre,
                    stock_avant: currentStock,
                    stock_inventaire: newStock,
                    difference: newStock - currentStock,
                    notes: notes,
                    date_inventaire: new Date().toISOString(),
                    utilisateur: currentUser.username
                })
                .select();

            console.log('Résultat temporaire:', { data, error });

            if (error) {
                console.error('ERREUR temporaire:', error);
                throw error;
            }

            showNotification(`Inventaire temporaire enregistré pour ${article.nom}`, 'info');

        } else {
            console.log('Mise à jour de w_articles');

            // Vérifier que l'ID est valide
            if (!article.id || article.id === 'undefined') {
                throw new Error('ID article invalide: ' + article.id);
            }

            const updateData = {
                stock_actuel: newStock,
                date_maj_stock: new Date().toISOString()
            };

            console.log('Données de mise à jour:', updateData);
            console.log('Condition WHERE id =', article.id);

            const { data, error } = await supabase
                .from('w_articles')
                .update(updateData)
                .eq('id', article.id)
                .select('id, nom, stock_actuel, date_maj_stock');

            console.log('Résultat mise à jour w_articles:', { data, error });

            if (error) {
                console.error('ERREUR mise à jour w_articles:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code,
                    fullError: error
                });
                throw error;
            }

            console.log('Mise à jour réussie, données retournées:', data);

            // Historique
            console.log('Ajout historique dans w_historique_inventaire');

            const { data: histData, error: histError } = await supabase
                .from('w_historique_inventaire')
                .insert({
                    article_id: article.id,
                    nom_article: article.nom,
                    numero_article: article.numero,
                    code_barre: article.code_barre,
                    stock_avant: currentStock,
                    stock_inventaire: newStock,
                    difference: newStock - currentStock,
                    notes: notes,
                    date_inventaire: new Date().toISOString(),
                    utilisateur: currentUser.username
                })
                .select();

            console.log('Résultat historique:', { histData, histError });

            if (histError) {
                console.error('ERREUR historique:', histError);
                // On ne throw pas ici pour ne pas bloquer la mise à jour du stock
                showNotification('Stock mis à jour mais erreur historique', 'warning');
            } else {
                showNotification(`Stock mis à jour pour ${article.nom} (${currentStock} → ${newStock})`, 'success');
            }
        }

        // Fermer le popup
        const popup = document.querySelector('.inventory-popup-overlay');
        if (popup) {
            console.log('Fermeture du popup');
            document.body.removeChild(popup);
        }

        console.log('=== FIN saveInventory réussie ===');

    } catch (error) {
        console.error('=== ERREUR GLOBALE saveInventory ===', error);
        showNotification('Erreur lors de l\'enregistrement: ' + (error.message || 'Erreur inconnue'), 'error');
    }
}

async function addInventoryToPrint(article, inventoryQuantity) {
    const currentStock = article.stock_actuel || 0;
    const newStock = parseInt(inventoryQuantity) || 0;
    const difference = newStock - currentStock;

    console.log('addInventoryToPrint appelée:', {
        articleNom: article.nom,
        currentStock,
        newStock,
        difference
    });

    try {
        // 1. SAUVEGARDER la nouvelle quantité si c'est un article existant
        if (!article.id.toString().includes('temp-') && !article.id.toString().includes('manual-')) {
            console.log('Sauvegarde du stock avant impression');

            const { error: updateError } = await supabase
                .from('w_articles')
                .update({
                    stock_actuel: newStock,
                    date_maj_stock: new Date().toISOString()
                })
                .eq('id', article.id);

            if (updateError) {
                console.error('Erreur mise à jour stock:', updateError);
                // On continue quand même pour l'impression
                showNotification('Impression OK mais erreur mise à jour stock', 'warning');
            } else {
                console.log('Stock mis à jour avec succès');

                // 2. Ajouter à l'historique
                const notes = document.querySelector('#inventoryNotes')?.value || '';
                const { error: histError } = await supabase
                    .from('w_historique_inventaire')
                    .insert({
                        article_id: article.id,
                        nom_article: article.nom,
                        numero_article: article.numero,
                        code_barre: article.code_barre,
                        stock_avant: currentStock,
                        stock_inventaire: newStock,
                        difference: difference,
                        notes: notes,
                        date_inventaire: new Date().toISOString(),
                        utilisateur: currentUser.username
                    });

                if (histError) {
                    console.error('Erreur historique:', histError);
                }
            }
        }

        // 3. Créer l'article spécial pour l'impression d'inventaire
        const inventoryArticle = {
            id: article.id || `inventory-${Date.now()}`,
            name: article.nom,
            number: article.numero,
            barcode: article.code_barre,
            stock: currentStock, // Stock avant inventaire
            price: article.prix_unitaire || 0,
            quantity: 1,
            inventoryData: {
                stock_avant: currentStock,
                stock_inventaire: newStock,
                difference: difference,
                date_inventaire: new Date().toLocaleDateString('fr-FR')
            }
        };

        // 4. Ajouter à la file d'attente d'impression
        addToPrintQueue([inventoryArticle]);

        showNotification(`"${article.nom}" ajouté à l'impression (stock: ${currentStock} → ${newStock})`, 'success');

        // 5. Passer à l'onglet paramètres d'impression
        switchTab('single');

        // 6. Fermer le popup
        const popup = document.querySelector('.inventory-popup-overlay');
        if (popup) {
            document.body.removeChild(popup);
        }

    } catch (error) {
        console.error('Erreur dans addInventoryToPrint:', error);
        showNotification('Erreur lors de l\'ajout à l\'impression: ' + error.message, 'error');
    }
}

function addArticleToPrintQueue(article) {
    // Vérifier si une liste d'impression existe
    if (!window.printQueue) {
        window.printQueue = [];
    }

    // Ajouter l'article à la queue
    window.printQueue.push(article);

    // Mettre à jour l'affichage
    updatePrintQueueDisplay();

    console.log('Article ajouté à la queue:', article.nom);
}

function updatePrintQueueDisplay() {
    // Mettez à jour l'UI avec la liste d'articles à imprimer
    const queueContainer = document.getElementById('printQueue');
    if (queueContainer) {
        const items = window.printQueue || [];
        queueContainer.innerHTML = items.map(article =>
            `<div class="print-item">${article.nom} (${article.code_barre})</div>`
        ).join('');
    }
}

function showScanSuccess(barcode, context) {
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
            <div style="font-weight: bold; margin-bottom: 4px;">Scan réussi</div>
            <div style="font-size: 0.9rem; opacity: 0.9;">Code: ${barcode}</div>
        </div>
    `;

    document.body.appendChild(successDiv);

    setTimeout(() => {
        if (successDiv.parentNode) {
            document.body.removeChild(successDiv);
        }
    }, 3000);
}

function closeScanModal() {
    document.getElementById('scanModal').style.display = 'none';
    stopCamera();
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

        const video = document.getElementById('cameraPreview');
        video.srcObject = stream;
        video.style.display = 'block';

        document.querySelector('.camera-placeholder').style.display = 'none';
        document.getElementById('startCameraBtn').style.display = 'none';
        document.getElementById('stopCameraBtn').style.display = 'flex';

        scanStream = stream;

        // Démarrer la détection de code-barre
        startBarcodeDetection(video);

    } catch (error) {
        console.error('Erreur caméra:', error);
        alert('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
    }
}

function stopCamera() {
    if (scanStream) {
        scanStream.getTracks().forEach(track => track.stop());
        scanStream = null;
    }

    const video = document.getElementById('cameraPreview');
    video.srcObject = null;
    video.style.display = 'none';

    document.querySelector('.camera-placeholder').style.display = 'flex';
    document.getElementById('startCameraBtn').style.display = 'flex';
    document.getElementById('stopCameraBtn').style.display = 'none';
}

function toggleFlash() {
    // Pour l'instant, simulation
    // Dans la vraie version, on utiliserait les contraintes de la caméra
    alert('Fonctionnalité flash à implémenter');
}

function startBarcodeDetection(video) {
    // Dans une version complète, on intégrerait une librairie de scan
    // Pour l'instant, simulation
    console.log('Détection de code-barre activée');

    // Simuler un scan après 3 secondes
    setTimeout(() => {
        simulateBarcodeScan();
    }, 3000);
}

function simulateBarcodeScan() {
    // Code-barre de test
    const testBarcode = '1234567890123';

    if (currentScanContext === 'single') {
        document.getElementById('barcodeSearch').value = testBarcode;
        searchByBarcode('single');
    }

    closeScanModal();
    alert(`Code-barre scanné: ${testBarcode}\n(Simulation - dans la vraie version, cela détecterait automatiquement)`);
}

function confirmManualBarcode() {
    const barcode = document.getElementById('manualBarcodeInput').value.trim();

    if (!barcode) {
        alert('Veuillez saisir un code-barre');
        return;
    }

    if (currentScanContext === 'single') {
        document.getElementById('barcodeSearch').value = barcode;
        searchByBarcode('single');
    }

    closeScanModal();
}

// ===== IMPRESSION =====
function printNow() {
    if (printQueue.length === 0) {
        alert('Aucune étiquette à imprimer');
        return;
    }

    // Créer une page d'impression
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Impression étiquettes</title>
            <style>
                @media print {
                    @page {
                        margin: ${printSettings.margin}mm;
                        size: A4 ${printSettings.orientation};
                    }

                    body {
                        margin: 0;
                        padding: 0;
                        font-family: Arial, sans-serif;
                    }

                    .labels-container {
                        display: grid;
                        grid-template-columns: ${printSettings.orientation === 'portrait' ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)'};
                        gap: 2mm;
                        width: 100%;
                        height: 100%;
                    }

                    .label {
                        border: 1px dashed #ccc;
                        padding: 2mm;
                        box-sizing: border-box;
                        page-break-inside: avoid;
                    }

                    .barcode {
                        text-align: center;
                        margin-bottom: 1mm;
                    }

                    .label-text {
                        text-align: center;
                    }

                    .label-title {
                        font-weight: bold;
                        font-size: ${printSettings.fontSize === 'small' ? '8pt' :
                                  printSettings.fontSize === 'large' ? '12pt' : '10pt'};
                        margin-bottom: 1mm;
                    }

                    .label-details {
                        font-size: ${printSettings.fontSize === 'small' ? '6pt' :
                                  printSettings.fontSize === 'large' ? '9pt' : '7pt'};
                        color: #666;
                        margin-bottom: 1mm;
                    }

                    .label-footer {
                        font-size: 6pt;
                        color: #999;
                        border-top: 1px dashed #ccc;
                        padding-top: 1mm;
                        display: flex;
                        justify-content: space-between;
                    }
                }
            </style>
        </head>
        <body>
            <div class="labels-container">
                ${generatePrintLabelsHTML()}
            </div>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(() => window.close(), 1000);
                }
            </script>
        </body>
        </html>
    `);

    printWindow.document.close();
}

function generatePrintLabelsHTML() {
    let html = '';

    printQueue.forEach((item, index) => {
        // Vérifier si c'est une étiquette d'inventaire
        const isInventory = item.inventoryData !== undefined;
        const barcodeText = item.barcode || item.number;

        html += `
            <div class="label">
                <div class="barcode">
                    <!-- Le code-barre sera généré par JsBarcode -->
                    <svg id="barcode-${index}" class="barcode-svg"></svg>
                    <div class="barcode-number">${barcodeText}</div>
                </div>
                <div class="label-text">
                    <div class="label-title">${item.name}</div>
                    <div class="label-details">
                        <div>${item.number}</div>
                        ${printSettings.showStock ? `
                            <div>
                                ${isInventory ?
                                    `Stock avant: ${item.inventoryData.stock_avant}` :
                                    `Stock: ${item.stock}`
                                }
                            </div>
                        ` : ''}
                        ${isInventory ? `
                            <div>Stock inventaire: ${item.inventoryData.stock_inventaire}</div>
                            <div>Différence: ${item.inventoryData.difference > 0 ? '+' : ''}${item.inventoryData.difference}</div>
                        ` : ''}
                        ${printSettings.showPrice ? `<div>${item.price.toFixed(2)}€</div>` : ''}
                    </div>
                    <div class="label-footer">
                        ${printSettings.showDate ? `
                            <span>${isInventory ? item.inventoryData.date_inventaire : new Date().toLocaleDateString('fr-FR')}</span>
                        ` : ''}
                        ${isInventory ? '<span>INVENTAIRE</span>' : ''}
                        ${printSettings.showLocation ? '<span>Zone</span>' : ''}
                    </div>
                </div>
            </div>
        `;
    });

    // Ajouter le script pour générer les codes-barres après le chargement
    html += `
        <script>
            window.onload = function() {
                ${printQueue.map((item, index) => {
                    const barcodeText = item.barcode || item.number;
                    return `
                        if (typeof JsBarcode !== 'undefined' && document.getElementById('barcode-${index}')) {
                            JsBarcode('#barcode-${index}', '${barcodeText}', {
                                format: "CODE128",
                                width: 2,
                                height: ${printSettings.barcodeHeight},
                                displayValue: false,
                                margin: 0
                            });
                        }
                    `;
                }).join('\n')}
                window.print();
                setTimeout(() => window.close(), 1000);
            }
        </script>
    `;

    return html;
}

async function generatePDF() {
    if (printQueue.length === 0) {
        showNotification('Aucune étiquette à exporter', 'warning');
        return;
    }

    showNotification('Génération du PDF en cours... Cela peut prendre quelques secondes.', 'info');

    try {
        const { jsPDF } = window.jspdf;

        // Créer un conteneur temporaire pour capturer les codes-barres
        const tempContainer = document.createElement('div');
        tempContainer.style.cssText = `
            position: fixed;
            top: -10000px;
            left: -10000px;
            width: 100mm;
            height: 100mm;
            z-index: -1000;
            opacity: 0;
        `;
        document.body.appendChild(tempContainer);

        // Générer tous les codes-barres d'abord
        const barcodeImages = [];

        for (let i = 0; i < printQueue.length; i++) {
            const item = printQueue[i];
            const barcodeText = item.barcode || item.number;

            if (barcodeText) {
                // Créer un canvas pour le code-barre
                const canvas = document.createElement('canvas');
                tempContainer.appendChild(canvas);

                // Générer le code-barre
                JsBarcode(canvas, barcodeText, {
                    format: "CODE128",
                    width: 2,
                    height: printSettings.barcodeHeight,
                    displayValue: false,
                    margin: 0
                });

                // Attendre que le code-barre soit généré
                await new Promise(resolve => setTimeout(resolve, 50));

                // Capturer l'image
                const barcodeDataUrl = canvas.toDataURL('image/png');
                barcodeImages.push({
                    dataUrl: barcodeDataUrl,
                    text: barcodeText,
                    item: item
                });
            }
        }

        // Nettoyer le conteneur temporaire
        document.body.removeChild(tempContainer);

        // Créer le PDF
        const doc = new jsPDF({
            orientation: printSettings.orientation,
            unit: 'mm',
            format: 'a4'
        });

        // Paramètres de page
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = printSettings.margin;

        // Calculer la disposition
        const labelWidth = printSettings.format === 'small' ? 40 :
                          printSettings.format === 'medium' ? 60 : 100;
        const labelHeight = printSettings.format === 'small' ? 20 :
                           printSettings.format === 'medium' ? 40 : 70;

        const cols = Math.floor((pageWidth - margin * 2) / labelWidth);
        const rows = Math.floor((pageHeight - margin * 2) / labelHeight);
        const labelsPerPage = cols * rows;

        let currentPage = 0;
        let currentLabel = 0;

        // Pour chaque étiquette
        for (let i = 0; i < printQueue.length; i++) {
            const item = printQueue[i];
            const isInventory = item.inventoryData !== undefined;
            const barcodeText = item.barcode || item.number;
            const barcodeImage = barcodeImages.find(img => img.text === barcodeText);

            // Nouvelle page si nécessaire
            if (currentLabel >= labelsPerPage) {
                doc.addPage();
                currentPage++;
                currentLabel = 0;
            }

            // Position
            const col = currentLabel % cols;
            const row = Math.floor(currentLabel / cols);
            const x = margin + col * labelWidth;
            const y = margin + row * labelHeight;

            // Cadre
            if (printSettings.margin > 0) {
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(0.1);
                doc.rect(x, y, labelWidth, labelHeight);
            }

            // Code-barre (si disponible)
            const barcodeY = y + 5;
            let textY;

            if (barcodeImage && barcodeImage.dataUrl) {
                try {
                    const barcodeWidth = labelWidth * 0.8;
                    const barcodeHeight = printSettings.barcodeHeight / 4;
                    const barcodeX = x + (labelWidth - barcodeWidth) / 2;

                    doc.addImage(
                        barcodeImage.dataUrl,
                        'PNG',
                        barcodeX,
                        barcodeY,
                        barcodeWidth,
                        barcodeHeight
                    );

                    // Numéro sous le code-barre
                    doc.setFontSize(6);
                    doc.setTextColor(100, 100, 100);
                    doc.text(barcodeText, x + labelWidth / 2, barcodeY + barcodeHeight + 2, { align: 'center' });

                    textY = barcodeY + barcodeHeight + 6;
                } catch (e) {
                    // Si l'image échoue, utiliser du texte
                    console.warn('Erreur image code-barre, utilisation texte', e);
                    doc.setFontSize(8);
                    doc.setTextColor(0, 0, 0);
                    doc.text("┌" + "─".repeat(barcodeText.length + 2) + "┐", x + labelWidth / 2, barcodeY, { align: 'center' });
                    doc.text("│ " + barcodeText + " │", x + labelWidth / 2, barcodeY + 3, { align: 'center' });
                    doc.text("└" + "─".repeat(barcodeText.length + 2) + "┘", x + labelWidth / 2, barcodeY + 6, { align: 'center' });
                    doc.setFontSize(6);
                    doc.setTextColor(100, 100, 100);
                    doc.text(barcodeText, x + labelWidth / 2, barcodeY + 10, { align: 'center' });
                    textY = barcodeY + 14;
                }
            } else {
                // Pas de code-barre
                doc.setFontSize(6);
                doc.setTextColor(150, 150, 150);
                doc.text("Pas de code-barre", x + labelWidth / 2, barcodeY + 5, { align: 'center' });
                textY = barcodeY + 10;
            }

            // Nom de l'article
            doc.setFontSize(printSettings.fontSize === 'small' ? 8 :
                           printSettings.fontSize === 'large' ? 12 : 10);
            doc.setTextColor(0, 0, 0);
            doc.text(item.name, x + labelWidth / 2, textY, { align: 'center', maxWidth: labelWidth - 4 });
            textY += 5;

            // Numéro d'article
            doc.setFontSize(printSettings.fontSize === 'small' ? 6 :
                           printSettings.fontSize === 'large' ? 9 : 7);
            doc.setTextColor(100, 100, 100);
            doc.text(item.number, x + labelWidth / 2, textY, { align: 'center' });
            textY += 4;

            // Stock
            if (printSettings.showStock) {
                if (isInventory) {
                    doc.text(`Avant: ${item.inventoryData.stock_avant}`, x + labelWidth / 2, textY, { align: 'center' });
                    textY += 4;
                    doc.text(`Après: ${item.inventoryData.stock_inventaire}`, x + labelWidth / 2, textY, { align: 'center' });
                    textY += 4;
                    const diffColor = item.inventoryData.difference > 0 ? [76, 175, 80] :
                                     item.inventoryData.difference < 0 ? [244, 67, 54] : [100, 100, 100];
                    doc.setTextColor(...diffColor);
                    doc.text(`Diff: ${item.inventoryData.difference > 0 ? '+' : ''}${item.inventoryData.difference}`,
                            x + labelWidth / 2, textY, { align: 'center' });
                    doc.setTextColor(100, 100, 100);
                    textY += 4;
                } else {
                    doc.text(`Stock: ${item.stock}`, x + labelWidth / 2, textY, { align: 'center' });
                    textY += 4;
                }
            }

            // Prix
            if (printSettings.showPrice && !isInventory) {
                doc.text(`${item.price.toFixed(2)}€`, x + labelWidth / 2, textY, { align: 'center' });
                textY += 4;
            }

            // Footer
            doc.setFontSize(5);
            doc.setTextColor(150, 150, 150);

            const footerY = y + labelHeight - 3;
            let footerText = '';

            if (printSettings.showDate) {
                footerText += isInventory ? item.inventoryData.date_inventaire : new Date().toLocaleDateString('fr-FR');
            }

            if (isInventory) {
                if (footerText) footerText += ' | ';
                footerText += 'INVENTAIRE';
            }

            if (printSettings.showLocation && !isInventory) {
                if (footerText) footerText += ' | ';
                footerText += 'Zone A';
            }

            if (footerText) {
                doc.text(footerText, x + labelWidth / 2, footerY, { align: 'center' });
            }

            currentLabel++;
        }

        // Télécharger
        const fileName = `etiquettes-${new Date().toISOString().split('T')[0]}-${Date.now()}.pdf`;
        doc.save(fileName);

        showNotification('PDF généré avec succès !', 'success');

    } catch (error) {
        console.error('Erreur génération PDF:', error);
        showNotification('Erreur lors de la génération du PDF : ' + error.message, 'error');
    }
}

// ===== GESTION DES MODÈLES =====
function saveTemplate() {
    const templateName = prompt('Nom du modèle :');

    if (!templateName) {
        return;
    }

    try {
        // Récupérer les modèles existants
        const existingTemplates = JSON.parse(localStorage.getItem('labelTemplates') || '{}');

        // Sauvegarder le modèle actuel
        existingTemplates[templateName] = {
            name: templateName,
            settings: { ...printSettings },
            date: new Date().toISOString()
        };

        localStorage.setItem('labelTemplates', JSON.stringify(existingTemplates));

        alert(`Modèle "${templateName}" sauvegardé avec succès !`);

    } catch (error) {
        console.error('Erreur sauvegarde modèle:', error);
        alert('Erreur lors de la sauvegarde du modèle');
    }
}

function loadTemplate() {
    try {
        // Récupérer les modèles existants
        const existingTemplates = JSON.parse(localStorage.getItem('labelTemplates') || '{}');

        if (Object.keys(existingTemplates).length === 0) {
            alert('Aucun modèle sauvegardé');
            return;
        }

        // Créer une liste de modèles
        const templateNames = Object.keys(existingTemplates);
        const templateList = templateNames.map(name =>
            `${name} (${new Date(existingTemplates[name].date).toLocaleDateString('fr-FR')})`
        ).join('\n');

        const selectedName = prompt(
            `Modèles disponibles :\n\n${templateList}\n\nEntrez le nom exact du modèle à charger :`
        );

        if (!selectedName || !existingTemplates[selectedName]) {
            return;
        }

        // Charger les paramètres
        const template = existingTemplates[selectedName];
        printSettings = { ...printSettings, ...template.settings };

        // Appliquer les paramètres
        applySavedSettings();
        updateSliderValues();
        saveSettings();

        if (printQueue.length > 0) {
            updatePreview();
        }

        alert(`Modèle "${selectedName}" chargé avec succès !`);

    } catch (error) {
        console.error('Erreur chargement modèle:', error);
        alert('Erreur lors du chargement du modèle');
    }
}

async function printMultipleList() {
    const printList = document.getElementById('printList');
    const items = printList.querySelectorAll('.list-item');

    if (items.length === 0) {
        showNotification('La liste d\'impression est vide', 'warning');
        return;
    }

    showNotification(`Préparation de ${items.length} articles pour l'impression...`, 'info');

    const articlesToPrint = [];

    // Parcourir tous les articles de la liste
    for (const item of items) {
        const articleId = item.dataset.id;
        const quantity = parseInt(item.querySelector('.quantity-input').value) || 1;

        // Si c'est un ID valide (pas un ID temporaire)
        if (articleId && !articleId.includes('temp-') && !articleId.includes('manual-')) {
            try {
                // Récupérer l'article depuis la base de données
                const { data: article, error } = await supabase
                    .from('w_articles')
                    .select('*')
                    .eq('id', articleId)
                    .single();

                if (error) throw error;

                // Ajouter le nombre d'exemplaires spécifié
                for (let i = 0; i < quantity; i++) {
                    articlesToPrint.push({
                        id: article.id,
                        name: article.nom,
                        number: article.numero,
                        barcode: article.code_barre,
                        stock: article.stock_actuel || 0,
                        price: article.prix_unitaire || 0,
                        quantity: 1
                    });
                }

            } catch (error) {
                console.error('Erreur récupération article:', error);
                // Pour les articles temporaires, utiliser les données affichées
                const name = item.querySelector('.list-item-name').textContent;
                const details = item.querySelector('.list-item-details').textContent;

                for (let i = 0; i < quantity; i++) {
                    articlesToPrint.push({
                        id: articleId,
                        name: name,
                        number: details.split(' • ')[0] || 'N/A',
                        barcode: details.split(' • ')[1] || '',
                        stock: 0,
                        price: 0,
                        quantity: 1
                    });
                }
            }
        } else {
            // Article temporaire
            const name = item.querySelector('.list-item-name').textContent;
            const details = item.querySelector('.list-item-details').textContent;

            for (let i = 0; i < quantity; i++) {
                articlesToPrint.push({
                    id: articleId,
                    name: name,
                    number: details.split(' • ')[0] || 'N/A',
                    barcode: details.split(' • ')[1] || '',
                    stock: 0,
                    price: 0,
                    quantity: 1
                });
            }
        }
    }

    // Ajouter à la file d'attente
    addToPrintQueue(articlesToPrint);

    // Passer à l'onglet paramètres et afficher l'aperçu
    switchTab('single');

    // Afficher l'aperçu
    if (printQueue.length > 0) {
        document.getElementById('previewSection').style.display = 'block';
        updatePreview();
    }

    showNotification(`${articlesToPrint.length} étiquettes ajoutées à l'impression`, 'success');

    // Optionnel: Vider la liste après impression
    if (confirm('Voulez-vous vider la liste après l\'ajout à l\'impression ?')) {
        clearPrintList();
    }
}

// ===== UTILITAIRES =====
function logout() {
    if (!confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
        return;
    }

    sessionStorage.removeItem('current_user');
    sessionStorage.removeItem('supabase_token');
    window.location.href = 'connexion.html';
}

// ===== FONCTION DE RÉINITIALISATION =====
function resetApplication() {
    if (confirm('Voulez-vous vraiment tout réinitialiser ? Cela supprimera la liste d\'impression et réinitialisera les paramètres.')) {
        // Réinitialiser la file d'attente
        printQueue = [];
        currentPreviewIndex = 0;

        // Réinitialiser les paramètres par défaut
        printSettings = {
            format: 'medium',
            showPrice: true,
            showStock: true,
            showDate: false,
            showLocation: false,
            copiesPerLabel: 1,
            orientation: 'portrait',
            barcodeHeight: 25,
            fontSize: 'medium',
            margin: 2
        };

        // Réinitialiser l'interface
        document.getElementById('printList').innerHTML = `
            <div class="empty-list">
                <i class="fas fa-tags"></i>
                <p>Aucun article sélectionné</p>
                <small>Ajoutez des articles à partir des résultats de recherche</small>
            </div>
        `;

        // Réinitialiser les champs de recherche
        document.getElementById('articleNumberSearch').value = '';
        document.getElementById('articleNameSearch').value = '';
        document.getElementById('barcodeSearch').value = '';
        document.getElementById('multipleSearch').value = '';


        // Cacher les sections
        document.getElementById('searchResults').style.display = 'none';
        document.getElementById('previewSection').style.display = 'none';
        document.getElementById('printSummary').style.display = 'none';


        // Réappliquer les paramètres
        applySavedSettings();
        updateSliderValues();
        updateListCount();
        updatePrintButtons();

        // Afficher notification
        showNotification('Application réinitialisée avec succès', 'success');
    }
}

// Ajouter un bouton de réinitialisation dans l'interface
// Dans la fonction setupEventListeners, ajoute cet écouteur :
document.getElementById('resetAppBtn')?.addEventListener('click', resetApplication);

window.openScanModal = openScanModal;