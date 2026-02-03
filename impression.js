import { supabase } from './supabaseClient.js';

// Elementos DOM y variables
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

// ===== NOTIFICACIONES =====
function showNotification(message, type = 'info') {
    // Eliminar las notificaciones existentes
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
                ${type === 'info' ? 'Información' :
                  type === 'success' ? 'Éxito' :
                  type === 'error' ? 'Error' : 'Atención'}
            </div>
            <div style="font-size: 0.9rem; color: #333;">${message}</div>
        </div>
        <button class="close-notification" style="background: none; border: none; color: #666; cursor: pointer;">
            <i class="fas fa-times"></i>
        </button>
    `;

    document.body.appendChild(notification);

    // Cerrar al hacer clic
    notification.querySelector('.close-notification').addEventListener('click', () => {
        if (notification.parentNode) {
            document.body.removeChild(notification);
        }
    });

    // Cerrar automáticamente después de 5 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            document.body.removeChild(notification);
        }
    }, 5000);
}

// Añadir la animación CSS para las notificaciones
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
    // Verificar la autenticación
    await checkAuth();

    // Inicializar los eventos
    setupEventListeners();

    // Inicializar los ajustes
    initializeSettings();

    // Ocultar la carga
    document.getElementById('loadingOverlay').style.display = 'none';
});

// ===== AUTENTICACIÓN =====
async function checkAuth() {
    try {
        const userJson = sessionStorage.getItem('current_user');

        if (!userJson) {
            window.location.href = 'connexion.html';
            return;
        }

        currentUser = JSON.parse(userJson);

        // Verificar los permisos
        if (!currentUser.permissions?.impression) {
            alert('No tiene permiso para imprimir etiquetas');
            window.location.href = 'accueil.html';
            return;
        }

        // Actualizar la interfaz
        document.getElementById('usernameDisplay').textContent = currentUser.username;

    } catch (error) {
        console.error('Error de autenticación:', error);
        sessionStorage.removeItem('current_user');
        window.location.href = 'connexion.html';
    }
}

// ===== INICIALIZACIÓN =====
function initializeSettings() {
    // Cargar los ajustes guardados
    const savedSettings = localStorage.getItem('labelSettings');
    if (savedSettings) {
        printSettings = { ...printSettings, ...JSON.parse(savedSettings) };
        applySavedSettings();
    }

    // Actualizar los sliders
    updateSliderValues();
}

function applySavedSettings() {
    // Formato
    document.querySelector(`input[name="labelFormat"][value="${printSettings.format}"]`).checked = true;

    // Opciones
    document.getElementById('optionShowPrice').checked = printSettings.showPrice;
    document.getElementById('optionShowStock').checked = printSettings.showStock;
    document.getElementById('optionShowDate').checked = printSettings.showDate;
    document.getElementById('optionShowLocation').checked = printSettings.showLocation;

    // Copias
    document.getElementById('copiesPerLabel').value = printSettings.copiesPerLabel;

    // Orientación
    document.getElementById('labelOrientation').value = printSettings.orientation;

    // Sliders
    document.getElementById('barcodeHeight').value = printSettings.barcodeHeight;
    document.getElementById('marginSize').value = printSettings.margin;

    // Tamaño de fuente
    document.getElementById('fontSize').value = printSettings.fontSize;
}

function updateSliderValues() {
    document.getElementById('barcodeHeightValue').textContent =
        `${document.getElementById('barcodeHeight').value} mm`;

    document.getElementById('marginSizeValue').textContent =
        `${document.getElementById('marginSize').value} mm`;
}

// ===== GESTIÓN DE EVENTOS =====
function setupEventListeners() {
    // Cerrar sesión
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Pestañas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchTab(tab);
        });
    });

    // Búsqueda única
    document.getElementById('searchNumberBtn').addEventListener('click', () => {
        searchByNumber('single');
    });

    document.getElementById('searchNameBtn').addEventListener('click', () => {
        searchByName('single');
    });

    document.getElementById('barcodeSearch').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchByBarcode('single');
    });

    // Búsqueda múltiple
    document.getElementById('multipleSearch').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchForMultiple();
    });

    document.getElementById('addToPrintListBtn').addEventListener('click', () => {
        searchForMultiple();
    });

    // Acciones de la lista
    document.getElementById('clearListBtn').addEventListener('click', clearPrintList);

    // Ajustes
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

    // Vista previa
    document.getElementById('togglePreviewBtn').addEventListener('click', togglePreview);
    document.getElementById('previousLabelBtn').addEventListener('click', showPreviousLabel);
    document.getElementById('nextLabelBtn').addEventListener('click', showNextLabel);

    // Acciones de impresión
    document.getElementById('generatePdfBtn').addEventListener('click', generatePDF);

    // Escanear modal
    document.getElementById('scanBarcodeBtn').addEventListener('click', () => {
        openScanModal('single');
    });

    // Modal de escaneo
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            closeScanModal();
        });
    });

    document.getElementById('startCameraBtn').addEventListener('click', startCamera);
    document.getElementById('stopCameraBtn').addEventListener('click', stopCamera);
    document.getElementById('toggleFlashBtn').addEventListener('click', toggleFlash);
    document.getElementById('confirmManualBarcodeBtn').addEventListener('click', confirmManualBarcode);

    // Impresión múltiple
    document.getElementById('printListBtn').addEventListener('click', printMultipleList);
}

// ===== GESTIÓN DE PESTAÑAS =====
function switchTab(tab) {
    // Desactivar todas las pestañas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Activar la pestaña seleccionada
    document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}Tab`).classList.add('active');

    // Reiniciar si se cambia de pestaña
    if (tab === 'multiple' || tab === 'mass') {
        document.getElementById('searchResults').style.display = 'none';
    }
}

// ===== BÚSQUEDA DE ARTÍCULOS =====
async function searchByNumber(context) {
    const number = document.getElementById('articleNumberSearch').value.trim();

    if (!number) {
        alert('Por favor, ingrese un número de artículo');
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
        console.error('Error en la búsqueda por número:', error);
        alert('Error durante la búsqueda');
    }
}

async function searchByName(context) {
    const name = document.getElementById('articleNameSearch').value.trim();

    if (!name) {
        alert('Por favor, ingrese un nombre de artículo');
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
        console.error('Error en la búsqueda por nombre:', error);
        alert('Error durante la búsqueda');
    }
}

async function searchByBarcode(context) {
    const barcode = document.getElementById('barcodeSearch').value.trim();

    if (!barcode) {
        alert('Por favor, ingrese o escanee un código de barras');
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
        console.error('Error en la búsqueda por código de barras:', error);
        alert('Error durante la búsqueda');
    }
}

async function searchForMultiple() {
    const searchTerm = document.getElementById('multipleSearch').value.trim();

    if (!searchTerm) {
        alert('Por favor, ingrese un término de búsqueda');
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
        console.error('Error en la búsqueda múltiple:', error);
        alert('Error durante la búsqueda');
    }
}

// ===== VISUALIZACIÓN DE RESULTADOS =====
function displaySearchResults(articles, context) {
    const resultsContainer = document.getElementById('resultsContainer');
    const searchResults = document.getElementById('searchResults');

    if (!articles || articles.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <p>No se encontró ningún artículo</p>
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
                    <span>${article.code_barre || 'Sin código de barras'}</span>
                    <span>Stock: ${article.stock_actuel || 0}</span>
                </div>
            </div>
            <div class="result-actions">
                <button class="btn-action add-to-print" data-id="${article.id}" data-name="${article.nom}" data-number="${article.numero}" data-barcode="${article.code_barre}" data-stock="${article.stock_actuel}" data-price="${article.prix_unitaire}">
                    <i class="fas fa-plus"></i> Añadir
                </button>
            </div>
        `;

        resultsContainer.appendChild(resultItem);
    });

    // Añadir eventos a los botones
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
    // Crear un modal o superposición para selección múltiple
    // Por ahora, se añade directamente a la lista
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
    document.getElementById('massArticleBarcode').textContent = article.code_barre || 'Sin código de barras';

    detailsDiv.style.display = 'block';
}

// ===== GESTIÓN DE LA LISTA DE IMPRESIÓN =====
function addToPrintList(articleData) {
    const printList = document.getElementById('printList');
    const emptyList = printList.querySelector('.empty-list');

    if (emptyList) {
        printList.removeChild(emptyList);
    }

    // Verificar si el artículo ya está en la lista
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
                ${articleData.number} • ${articleData.barcode || 'Sin código de barras'}
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
            <button class="btn-remove" data-id="${articleData.id}" title="Eliminar">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    printList.appendChild(listItem);

    // Añadir los eventos
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
                    <p>Ningún artículo seleccionado</p>
                    <small>Añada artículos desde los resultados de búsqueda</small>
                </div>
            `;
        }
    });

    updateListCount();
}

function updateListItemQuantity(listItem, quantity) {
    // Actualizar la cantidad en el objeto articleData si está almacenado
    // Por ahora, solo se actualiza la visualización
    updateListCount();
}

function updateListCount() {
    const items = document.querySelectorAll('#printList .list-item');
    let totalItems = 0;

    items.forEach(item => {
        const quantity = parseInt(item.querySelector('.quantity-input').value) || 1;
        totalItems += quantity;
    });

    document.getElementById('listCount').textContent = `${items.length} artículos (${totalItems} etiquetas)`;
}

function clearPrintList() {
    const printList = document.getElementById('printList');
    printList.innerHTML = `
        <div class="empty-list">
            <i class="fas fa-tags"></i>
            <p>Ningún artículo seleccionado</p>
            <small>Añada artículos desde los resultados de búsqueda</small>
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
        alert('Por favor, seleccione primero un artículo');
        return;
    }

    // Por ahora, simplemente añadimos el artículo con la cantidad
    // En una versión completa, se podría gestionar la numeración secuencial
    for (let i = 0; i < quantity; i++) {
        const articleData = {
            id: `mass-${Date.now()}-${i}`,
            name: `${articleName} ${startNumber + i > startNumber ? `#${startNumber + i}` : ''}`,
            number: articleNumber,
            barcode: '', // Generar o usar un código de barras secuencial
            stock: 0,
            price: 0,
            quantity: 1,
            sequentialNumber: startNumber + i
        };

        addToPrintList(articleData);
    }

    // Reiniciar el formulario
    document.getElementById('massQuantity').value = 1;
    document.getElementById('massStartNumber').value = 1;
    document.getElementById('massArticleDetails').style.display = 'none';
}

// ===== COLA DE IMPRESIÓN =====
function addToPrintQueue(articles) {
    articles.forEach(article => {
        // Añadir el número de copias especificado
        for (let i = 0; i < printSettings.copiesPerLabel; i++) {
            printQueue.push({ ...article });
        }
    });

    updatePrintQueue();
    updatePrintButtons();
}

function updatePrintQueue() {
    // Actualizar el resumen
    const uniqueArticles = [...new Set(printQueue.map(item => item.id))];

    document.getElementById('summaryCount').textContent = printQueue.length;
    document.getElementById('summaryArticles').textContent = uniqueArticles.length;

    // Calcular las hojas estimadas (basado en el formato)
    const labelsPerSheet = calculateLabelsPerSheet();
    const estimatedSheets = Math.ceil(printQueue.length / labelsPerSheet);
    document.getElementById('summarySheets').textContent = estimatedSheets;

    // Coste estimado (ejemplo: 0.05€ por hoja)
    const estimatedCost = (estimatedSheets * 0.05).toFixed(2);
    document.getElementById('summaryCost').textContent = `${estimatedCost} €`;

    // Mostrar el resumen
    document.getElementById('printSummary').style.display = 'block';

    // Actualizar la vista previa
    if (printQueue.length > 0) {
        currentPreviewIndex = 0;
        updatePreview();
        document.getElementById('previewSection').style.display = 'block';
    }
}

function calculateLabelsPerSheet() {
    // Según el formato de etiqueta
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

// ===== VISTA PREVIA =====
function togglePreview() {
    const previewSection = document.getElementById('previewSection');

    if (printQueue.length === 0) {
        alert('Por favor, añada primero artículos para imprimir');
        return;
    }

    if (previewSection.style.display === 'none') {
        previewSection.style.display = 'block';
        updatePreview();
        document.getElementById('togglePreviewBtn').innerHTML = '<i class="fas fa-eye-slash"></i> Ocultar';
    } else {
        previewSection.style.display = 'none';
        document.getElementById('togglePreviewBtn').innerHTML = '<i class="fas fa-eye"></i> Vista previa';
    }
}

function updatePreview() {
    if (printQueue.length === 0) return;

    const currentItem = printQueue[currentPreviewIndex];

    // Actualizar el contador
    document.getElementById('currentPreview').textContent = currentPreviewIndex + 1;
    document.getElementById('totalPreviews').textContent = printQueue.length;

    // Activar/desactivar los botones de navegación
    document.getElementById('previousLabelBtn').disabled = currentPreviewIndex === 0;
    document.getElementById('nextLabelBtn').disabled = currentPreviewIndex === printQueue.length - 1;

    // Actualizar la etiqueta
    updateLabelPreview(currentItem);

    // Actualizar la info
    updatePreviewInfo();
}

function updateLabelPreview(item) {
    const label = document.getElementById('previewLabel');
    const barcodeContainer = document.getElementById('previewBarcode');

    // Aplicar el formato
    applyLabelFormat(label);

    // Verificar si es una etiqueta de inventario
    const isInventory = item.inventoryData !== undefined;

    // Actualizar el texto
    document.getElementById('previewTitle').textContent = item.name;
    document.getElementById('previewNumber').textContent = item.number;

    // Gestionar la visualización del stock según el tipo
    const stockElement = document.getElementById('previewStock');
    if (isInventory) {
        stockElement.textContent = `Antes: ${item.inventoryData.stock_avant} | Después: ${item.inventoryData.stock_inventaire}`;
        stockElement.style.fontWeight = 'bold';
    } else {
        stockElement.textContent = `Stock: ${item.stock}`;
        stockElement.style.fontWeight = 'normal';
    }

    document.getElementById('previewPrice').textContent = `${item.price.toFixed(2)}€`;

    // Fecha actual o fecha de inventario
    const dateElement = document.getElementById('previewDate');
    if (isInventory) {
        dateElement.textContent = item.inventoryData.date_inventaire;
    } else {
        dateElement.textContent = new Date().toLocaleDateString('es-ES');
    }

    // Generar el código de barras
    generateBarcodePreview(item.barcode || item.number, barcodeContainer);

    // Mostrar/ocultar los elementos según las opciones
    togglePreviewElements();

    // Añadir un indicador para el inventario
    const locationElement = document.getElementById('previewLocation');
    if (isInventory) {
        locationElement.textContent = 'INVENTARIO';
        locationElement.style.color = '#4CAF50';
        locationElement.style.fontWeight = 'bold';
    } else {
        locationElement.textContent = 'Zona A';
        locationElement.style.color = '';
        locationElement.style.fontWeight = 'normal';
    }
}

function applyLabelFormat(label) {
    // Reiniciar los estilos
    label.style.width = '';
    label.style.height = '';
    label.style.padding = '';

    switch(printSettings.format) {
        case 'small':
            label.style.width = '120px'; // 40mm a 96dpi
            label.style.height = '60px'; // 20mm a 96dpi
            label.style.padding = '4px';
            break;
        case 'medium':
            label.style.width = '180px'; // 60mm a 96dpi
            label.style.height = '120px'; // 40mm a 96dpi
            label.style.padding = '8px';
            break;
        case 'large':
            label.style.width = '300px'; // 100mm a 96dpi
            label.style.height = '210px'; // 70mm a 96dpi
            label.style.padding = '12px';
            break;
    }

    // Aplicar la orientación
    if (printSettings.orientation === 'landscape') {
        const temp = label.style.width;
        label.style.width = label.style.height;
        label.style.height = temp;
    }
}

function generateBarcodePreview(code, container) {
    container.innerHTML = '';

    if (!code) {
        container.innerHTML = '<div class="no-barcode">Sin código de barras</div>';
        return;
    }

    try {
        // Crear un contenedor para el código de barras
        const barcodeWrapper = document.createElement('div');
        barcodeWrapper.className = 'barcode-preview-wrapper';

        // Crear el SVG para el código de barras
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'preview-barcode-svg';

        // Crear un div para el número debajo del código de barras
        const numberDiv = document.createElement('div');
        numberDiv.className = 'barcode-preview-number';
        numberDiv.textContent = code;

        // Añadir al contenedor
        barcodeWrapper.appendChild(svg);
        barcodeWrapper.appendChild(numberDiv);
        container.appendChild(barcodeWrapper);

        // Generar el código de barras con JsBarcode
        JsBarcode(svg, code, {
            format: "CODE128",
            width: 2,
            height: printSettings.barcodeHeight,
            displayValue: false,
            margin: 0
        });

        // Ajustar el tamaño del SVG
        svg.style.width = '100%';
        svg.style.height = 'auto';
        svg.style.maxHeight = '40px';

    } catch (error) {
        console.error('Error en la generación del código de barras:', error);
        container.innerHTML = '<div class="no-barcode">Error en código de barras</div>';
    }
}

function togglePreviewElements() {
    // Precio
    document.getElementById('previewPrice').style.display =
        printSettings.showPrice ? 'inline' : 'none';

    // Stock
    document.getElementById('previewStock').style.display =
        printSettings.showStock ? 'inline' : 'none';

    // Fecha
    document.getElementById('previewDate').style.display =
        printSettings.showDate ? 'inline' : 'none';

    // Ubicación
    document.getElementById('previewLocation').style.display =
        printSettings.showLocation ? 'inline' : 'none';

    // Ajustar el tamaño de fuente
    const labelText = document.querySelector('.label-text');
    labelText.style.fontSize = printSettings.fontSize === 'small' ? '10px' :
                              printSettings.fontSize === 'large' ? '14px' : '12px';
}

function updatePreviewInfo() {
    document.getElementById('previewFormat').textContent =
        `${printSettings.format === 'small' ? 'Pequeña' :
          printSettings.format === 'medium' ? 'Mediana' : 'Grande'}`;

    document.getElementById('previewOrientation').textContent =
        printSettings.orientation === 'portrait' ? 'Vertical' : 'Horizontal';

    const labelsPerSheet = calculateLabelsPerSheet();
    const sheets = Math.ceil(printQueue.length / labelsPerSheet);
    document.getElementById('previewPaper').textContent =
        `${sheets} hoja${sheets > 1 ? 's' : ''} A4`;
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

// ===== GESTIÓN DE PARÁMETROS =====
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

// ===== POPUP DE ESCANEO PARA IMPRESIÓN =====
async function openScanModal(context) {
    const popup = document.createElement('div');
    popup.className = 'scan-popup-overlay';

    const actionNames = {
        'single': 'Búsqueda',
        'etiquette': 'Etiquetas',
        'inventaire': 'Inventario'
    };

    popup.innerHTML = `
        <div class="scan-popup">
            <div class="popup-header">
                <h3><i class="fas fa-camera"></i> Escanear para ${actionNames[context] || 'Impresión'}</h3>
                <button class="close-popup">&times;</button>
            </div>
            <div class="popup-content">
                <div class="scan-section">
                    <div class="camera-placeholder" id="cameraPlaceholder">
                        <i class="fas fa-camera"></i>
                        <p>Cámara no activada</p>
                    </div>
                    <video id="cameraPreview" autoplay playsinline style="display: none;"></video>

                    <div class="scan-controls">
                        <button id="startCameraBtn" class="btn btn-primary">
                            <i class="fas fa-video"></i> Activar cámara
                        </button>
                        <button id="stopCameraBtn" class="btn btn-secondary" style="display: none;">
                            <i class="fas fa-stop"></i> Detener
                        </button>
                    </div>
                </div>

                <div class="manual-section">
                    <h4><i class="fas fa-keyboard"></i> Entrada manual</h4>
                    <div class="form-group">
                        <input type="text"
                               id="manualBarcodeInput"
                               placeholder="Ingrese el código de barras manualmente"
                               class="scan-input">
                        <button id="confirmManualBtn" class="btn btn-success">
                            <i class="fas fa-check"></i> Validar
                        </button>
                    </div>
                </div>

                <div class="scan-instructions">
                    <div class="instruction">
                        <i class="fas fa-lightbulb"></i>
                        <p>Coloque el código de barras en el marco. El escaneo es automático.</p>
                    </div>
                    <div class="instruction">
                        <i class="fas fa-bolt"></i>
                        <p>Asegúrese de tener una buena iluminación.</p>
                    </div>
                </div>

                <div id="scanStatus" class="scan-status">
                    <p><i class="fas fa-info-circle"></i> Esperando escaneo...</p>
                </div>
            </div>

            <div class="popup-footer">
                <button class="btn btn-secondary close-popup-btn">Cancelar</button>
                <div class="scan-stats">
                    <span id="scanResult"></span>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Variables para el escaneo
    let scanStream = null;
    let currentContext = context;

    // Eventos generales del popup
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

    // Eventos específicos del escaneo
    popup.querySelector('#startCameraBtn').addEventListener('click', startCameraScan);
    popup.querySelector('#stopCameraBtn').addEventListener('click', stopCameraScan);
    popup.querySelector('#confirmManualBtn').addEventListener('click', () => processManualBarcode(currentContext));

    popup.querySelector('#manualBarcodeInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') processManualBarcode(currentContext);
    });

    // Iniciar automáticamente la cámara
    setTimeout(() => {
        startCameraScan();
    }, 500);

    async function startCameraScan() {
        try {
            // Iniciar la cámara
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

            // Iniciar Quagga para la detección
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
                    console.error('Error Quagga:', err);
                    updateScanStatus('Escáner incompatible. Use la entrada manual.', 'error');
                    return;
                }

                Quagga.start();
                updateScanStatus('Escáner listo. Centre el código de barras.', 'success');
            });

            // Cuando se detecta un código
            Quagga.onDetected(function(result) {
                const code = result.codeResult.code;

                // Detener Quagga y la cámara
                Quagga.stop();
                stream.getTracks().forEach(track => track.stop());

                updateScanStatus(`Código detectado: ${code}. Procesando...`, 'info');

                // Procesar según el contexto
                handleScannedBarcode(code, currentContext);
            });

        } catch (error) {
            console.error('Error de cámara:', error);
            updateScanStatus('Cámara inaccesible. Use la entrada manual.', 'error');
            popup.querySelector('#manualBarcodeInput').focus();
        }
    }

    function processManualBarcode(context) {
        const input = popup.querySelector('#manualBarcodeInput');
        const barcode = input.value.trim();

        if (!barcode) {
            updateScanStatus('Por favor, ingrese un código de barras', 'warning');
            return;
        }

        updateScanStatus(`Código ingresado: ${barcode}. Procesando...`, 'info');
        handleScannedBarcode(barcode, context);
    }

    function stopCameraScan() {
        // Detener Quagga
        try {
            if (typeof Quagga !== 'undefined' && Quagga.stop) {
                Quagga.stop();
            }
        } catch (e) {
            console.warn('Error al detener Quagga:', e);
        }

        // Detener la cámara
        if (scanStream) {
            scanStream.getTracks().forEach(track => track.stop());
            scanStream = null;
        }

        // Reiniciar la interfaz
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
    console.log(`Procesando el código ${barcode} para el contexto: ${context}`);

    // Cerrar todos los popups de escaneo
    const popup = document.querySelector('.scan-popup-overlay');
    if (popup) {
        document.body.removeChild(popup);
    }

    // Según el contexto, realizar diferentes acciones
    switch(context) {
        case 'etiquette':
            // Búsqueda para impresión de etiquetas
            await searchArticleForPrint(barcode, 'etiquette');
            break;

        case 'inventaire':
            // Búsqueda para inventario
            await searchArticleForInventory(barcode);
            break;

        case 'single':
        default:
            // Búsqueda para etiqueta única
            await searchArticleForPrint(barcode, 'single');
            break;
    }

    // Mostrar notificación
    showScanSuccess(barcode, context);
}

function addToInventoryList(barcode) {
    console.log('Añadido al inventario:', barcode);
    // Lógica de inventario
}

function handleBarcodeForPrint(barcode) {
    console.log('Procesando para impresión:', barcode);
    // Acción por defecto
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
            console.log('Artículo encontrado para impresión:', article.nom);

            // Crear el objeto de artículo para la lista de impresión
            const articleData = {
                id: article.id,
                name: article.nom,
                number: article.numero,
                barcode: article.code_barre,
                stock: article.stock_actuel || 0,
                price: article.prix_unitaire || 0,
                quantity: 1
            };

            // Añadir a la cola de impresión
            addToPrintQueue([articleData]);

            // Si era en el contexto "single", pasar a la pestaña de parámetros
            if (context === 'single') {
                switchTab('single');
                document.getElementById('searchResults').style.display = 'none';
                document.getElementById('barcodeSearch').value = barcode;
            }

            // Mostrar notificación
            showNotification(`"${article.nom}" añadido a la impresión`, 'success');

            return articleData;

        } else {
            // Si no se encuentra ningún artículo, preguntar si se desea crear una etiqueta manual
            const createManual = confirm(`No se encontró ningún artículo con el código de barras ${barcode}. ¿Desea crear una etiqueta manual?`);

            if (createManual) {
                // Crear un artículo temporal
                const manualArticle = {
                    id: `manual-${Date.now()}`,
                    name: `Artículo escaneado (${barcode})`,
                    number: `SCAN-${barcode.substring(0, 8)}`,
                    barcode: barcode,
                    stock: 0,
                    price: 0,
                    quantity: 1
                };

                addToPrintQueue([manualArticle]);
                showNotification('Etiqueta creada manualmente', 'info');
            } else {
                showNotification('Ningún artículo encontrado', 'warning');
            }

            return null;
        }

    } catch (error) {
        console.error('Error en la búsqueda del artículo:', error);
        showNotification('Error durante la búsqueda del artículo', 'error');
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

            // Abrir un popup para ingresar el inventario
            openInventoryPopup(article);

        } else {
            showNotification(`No se encontró ningún artículo con el código de barras ${barcode}`, 'warning');

            // Preguntar si se desea crear un artículo temporal para el inventario
            const createTemp = confirm(`No se encontró ningún artículo. ¿Desea crear un registro temporal para el inventario?`);

            if (createTemp) {
                const tempArticle = {
                    id: `temp-${Date.now()}`,
                    nom: `Artículo desconocido (${barcode})`,
                    numero: `TEMP-${barcode.substring(0, 8)}`,
                    code_barre: barcode,
                    stock_actuel: 0,
                    prix_unitaire: 0
                };

                openInventoryPopup(tempArticle, true);
            }
        }

    } catch (error) {
        console.error('Error en búsqueda de inventario:', error);
        showNotification('Error durante la búsqueda para el inventario', 'error');
    }
}

function openInventoryPopup(article, isTemporary = false) {
    const popup = document.createElement('div');
    popup.className = 'inventory-popup-overlay';

    popup.innerHTML = `
        <div class="inventory-popup">
            <div class="popup-header">
                <h3><i class="fas fa-clipboard-check"></i> Registro de Inventario</h3>
                <button class="close-inventory-popup">&times;</button>
            </div>

            <div class="popup-content">
                <div class="inventory-article-info">
                    <h4>Artículo</h4>
                    <div class="article-details">
                        <div class="detail-row">
                            <span class="detail-label">Nombre:</span>
                            <span class="detail-value">${article.nom}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Número:</span>
                            <span class="detail-value">${article.numero}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Código de barras:</span>
                            <span class="detail-value">${article.code_barre || 'N/D'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Stock actual:</span>
                            <span class="detail-value" id="currentStockValue">${article.stock_actuel || 0}</span>
                        </div>
                    </div>
                </div>

                <div class="inventory-form">
                    <h4>Cantidades</h4>
                    <div class="form-group">
                        <label for="inventoryQuantity">
                            <i class="fas fa-calculator"></i> Cantidad real (inventario)
                        </label>
                        <input type="number"
                               id="inventoryQuantity"
                               value="${article.stock_actuel || 0}"
                               min="0"
                               class="form-input-large">
                    </div>

                    <div class="quantity-comparison">
                        <div class="comparison-item">
                            <span class="comparison-label">Antes del inventario:</span>
                            <span class="comparison-value stock-before">${article.stock_actuel || 0}</span>
                        </div>
                        <div class="comparison-item">
                            <span class="comparison-label">Después del inventario:</span>
                            <span class="comparison-value stock-after" id="stockAfterValue">${article.stock_actuel || 0}</span>
                        </div>
                        <div class="comparison-item">
                            <span class="comparison-label">Diferencia:</span>
                            <span class="comparison-value stock-diff" id="stockDiffValue">0</span>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="inventoryNotes">
                            <i class="fas fa-sticky-note"></i> Observaciones (opcional)
                        </label>
                        <textarea id="inventoryNotes"
                                  placeholder="Notas sobre el inventario..."
                                  class="form-textarea"
                                  rows="3"></textarea>
                    </div>
                </div>

                ${isTemporary ? `
                    <div class="temporary-warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Este artículo no existe en la base de datos. El registro será temporal.</p>
                    </div>
                ` : ''}
            </div>

            <div class="popup-footer">
                <button class="btn btn-secondary close-inventory-popup-btn">Cancelar</button>
                <div class="footer-actions">
                    <button class="btn btn-primary save-inventory-btn">
                        <i class="fas fa-save"></i> Guardar
                    </button>
                    <button class="btn btn-success add-to-print-btn">
                        <i class="fas fa-print"></i> Añadir a impresión
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Eventos
    const quantityInput = popup.querySelector('#inventoryQuantity');
    const saveBtn = popup.querySelector('.save-inventory-btn');
    const printBtn = popup.querySelector('.add-to-print-btn');

    // Calcular la diferencia en tiempo real
    quantityInput.addEventListener('input', updateInventoryCalculations);

    // Botón guardar
    saveBtn.addEventListener('click', () => {
        const notes = popup.querySelector('#inventoryNotes')?.value || '';
        saveInventory(article, quantityInput.value, isTemporary, notes);
    });

    // Botón añadir a la impresión
    printBtn.addEventListener('click', () => {
        addInventoryToPrint(article, quantityInput.value);
        document.body.removeChild(popup);
    });

    // Cerrar el popup
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

    // Inicializar los cálculos
    updateInventoryCalculations();

    function updateInventoryCalculations() {
        const currentStock = parseInt(article.stock_actuel) || 0;
        const inventoryQty = parseInt(quantityInput.value) || 0;

        // Actualizar los valores
        popup.querySelector('#stockAfterValue').textContent = inventoryQty;

        const diff = inventoryQty - currentStock;
        const diffElement = popup.querySelector('#stockDiffValue');
        diffElement.textContent = diff;

        // Colorear la diferencia
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

    console.log('=== INICIO saveInventory ===');
    console.log('Artículo:', {
        id: article.id,
        idType: typeof article.id,
        nom: article.nom,
        numero: article.numero,
        currentStock: currentStock,
        newStock: newStock
    });
    console.log('Parámetros:', { isTemporary, notes });

    try {
        if (isTemporary) {
            console.log('Guardado temporal en w_inventaire_temporaire');

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

            console.log('Resultado temporal:', { data, error });

            if (error) {
                console.error('ERROR temporal:', error);
                throw error;
            }

            showNotification(`Inventario temporal registrado para ${article.nom}`, 'info');

                } else {
            console.log('Actualización de w_articles');

            // Verificar que el ID sea válido
            if (!article.id || article.id === 'undefined') {
                throw new Error('ID de artículo no válido: ' + article.id);
            }

            const updateData = {
                stock_actuel: newStock,
                date_maj_stock: new Date().toISOString()
            };

            console.log('Datos de actualización:', updateData);
            console.log('Condición WHERE id =', article.id);

            const { data, error } = await supabase
                .from('w_articles')
                .update(updateData)
                .eq('id', article.id)
                .select('id, nom, stock_actuel, date_maj_stock');

            console.log('Resultado de actualización w_articles:', { data, error });

            if (error) {
                console.error('ERROR en actualización w_articles:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code,
                    fullError: error
                });
                throw error;
            }

            console.log('Actualización exitosa, datos devueltos:', data);

            // Historial
            console.log('Añadiendo historial en w_historique_inventaire');

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

            console.log('Resultado historial:', { histData, histError });

            if (histError) {
                console.error('ERROR historial:', histError);
                // No lanzamos error aquí para no bloquear la actualización del stock
                showNotification('Stock actualizado pero hubo un error en el historial', 'warning');
            } else {
                showNotification(`Stock actualizado para ${article.nom} (${currentStock} → ${newStock})`, 'success');
            }
        }

        // Cerrar el popup
        const popup = document.querySelector('.inventory-popup-overlay');
        if (popup) {
            console.log('Cierre del popup');
            document.body.removeChild(popup);
        }

        console.log('=== FIN de saveInventory exitoso ===');

    } catch (error) {
        console.error('=== ERROR GLOBAL saveInventory ===', error);
        showNotification('Error al guardar: ' + (error.message || 'Error desconocido'), 'error');
    }
}

async function addInventoryToPrint(article, inventoryQuantity) {
    const currentStock = article.stock_actuel || 0;
    const newStock = parseInt(inventoryQuantity) || 0;
    const difference = newStock - currentStock;

    console.log('addInventoryToPrint llamada:', {
        articleNom: article.nom,
        currentStock,
        newStock,
        difference
    });

    try {
        // 1. GUARDAR la nueva cantidad si es un artículo existente
        if (!article.id.toString().includes('temp-') && !article.id.toString().includes('manual-')) {
            console.log('Guardando el stock antes de la impresión');

            const { error: updateError } = await supabase
                .from('w_articles')
                .update({
                    stock_actuel: newStock,
                    date_maj_stock: new Date().toISOString()
                })
                .eq('id', article.id);

            if (updateError) {
                console.error('Error al actualizar stock:', updateError);
                // Continuamos de todos modos para la impresión
                showNotification('Impresión OK pero error al actualizar stock', 'warning');
            } else {
                console.log('Stock actualizado con éxito');

                // 2. Añadir al historial
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
                    console.error('Error en historial:', histError);
                }
            }
        }

        // 3. Crear el artículo especial para la impresión de inventario
        const inventoryArticle = {
            id: article.id || `inventory-${Date.now()}`,
            name: article.nom,
            number: article.numero,
            barcode: article.code_barre,
            stock: currentStock, // Stock antes del inventario
            price: article.prix_unitaire || 0,
            quantity: 1,
            inventoryData: {
                stock_avant: currentStock,
                stock_inventaire: newStock,
                difference: difference,
                date_inventaire: new Date().toLocaleDateString('es-ES')
            }
        };

        // 4. Añadir a la cola de impresión
        addToPrintQueue([inventoryArticle]);

        showNotification(`"${article.nom}" añadido a la impresión (stock: ${currentStock} → ${newStock})`, 'success');

        // 5. Pasar a la pestaña de parámetros de impresión
        switchTab('single');

        // 6. Cerrar el popup
        const popup = document.querySelector('.inventory-popup-overlay');
        if (popup) {
            document.body.removeChild(popup);
        }

    } catch (error) {
        console.error('Error en addInventoryToPrint:', error);
        showNotification('Error al añadir a la impresión: ' + error.message, 'error');
    }
}

function addArticleToPrintQueue(article) {
    // Verificar si existe una cola de impresión
    if (!window.printQueue) {
        window.printQueue = [];
    }

    // Añadir el artículo a la cola
    window.printQueue.push(article);

    // Actualizar la vista
    updatePrintQueueDisplay();

    console.log('Artículo añadido a la cola:', article.nom);
}

function updatePrintQueueDisplay() {
    // Actualizar la UI con la lista de artículos a imprimir
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
            <div style="font-weight: bold; margin-bottom: 4px;">Escaneo exitoso</div>
            <div style="font-size: 0.9rem; opacity: 0.9;">Código: ${barcode}</div>
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

        // Iniciar la detección de código de barras
        startBarcodeDetection(video);

    } catch (error) {
        console.error('Error de cámara:', error);
        alert('No se pudo acceder a la cámara. Verifique los permisos.');
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
    // Por ahora, simulación
    // En la versión real, se utilizarían los constraints de la cámara
    alert('Funcionalidad de flash por implementar');
}

function startBarcodeDetection(video) {
    // En una versión completa, integraríamos una librería de escaneo (como Quagga o ZXing)
    // Por ahora, simulación
    console.log('Detección de código de barras activada');

    // Simular un escaneo después de 3 segundos
    setTimeout(() => {
        simulateBarcodeScan();
    }, 3000);
}

function simulateBarcodeScan() {
    // Código de barras de prueba
    const testBarcode = '1234567890123';

    if (currentScanContext === 'single') {
        document.getElementById('barcodeSearch').value = testBarcode;
        searchByBarcode('single');
    }

    closeScanModal();
    alert(`Código de barras escaneado: ${testBarcode}\n(Simulación - en la versión real, esto se detectaría automáticamente)`);
}

function confirmManualBarcode() {
    const barcode = document.getElementById('manualBarcodeInput').value.trim();

    if (!barcode) {
        alert('Por favor, introduzca un código de barras');
        return;
    }

    if (currentScanContext === 'single') {
        document.getElementById('barcodeSearch').value = barcode;
        searchByBarcode('single');
    }

    closeScanModal();
}

// ===== IMPRESIÓN =====
function printNow() {
    if (printQueue.length === 0) {
        alert('No hay etiquetas para imprimir');
        return;
    }

    // Crear una página de impresión
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Impresión de etiquetas</title>
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
        // Verificar si es una etiqueta de inventario
        const isInventory = item.inventoryData !== undefined;
        const barcodeText = item.barcode || item.number;

        html += `
            <div class="label">
                <div class="barcode">
                    <!-- El código de barras será generado por JsBarcode -->
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
                                    `Stock anterior: ${item.inventoryData.stock_avant}` :
                                    `Stock: ${item.stock}`
                                }
                            </div>
                        ` : ''}
                        ${isInventory ? `
                            <div>Stock inventario: ${item.inventoryData.stock_inventaire}</div>
                            <div>Diferencia: ${item.inventoryData.difference > 0 ? '+' : ''}${item.inventoryData.difference}</div>
                        ` : ''}
                        ${printSettings.showPrice ? `<div>${item.price.toFixed(2)}€</div>` : ''}
                    </div>
                    <div class="label-footer">
                        ${printSettings.showDate ? `
                            <span>${isInventory ? item.inventoryData.date_inventaire : new Date().toLocaleDateString('es-ES')}</span>
                        ` : ''}
                        ${isInventory ? '<span>INVENTARIO</span>' : ''}
                        ${printSettings.showLocation ? '<span>Zona</span>' : ''}
                    </div>
                </div>
            </div>
        `;
    });

    // Añadir el script para generar los códigos de barras después de la carga
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
        showNotification('No hay etiquetas para exportar', 'warning');
        return;
    }

    showNotification('Generando PDF... Esto puede tardar unos segundos.', 'info');

    try {
        const { jsPDF } = window.jspdf;

        // Crear un contenedor temporal para capturar los códigos de barras
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

        // Generar todos los códigos de barras primero
        const barcodeImages = [];

        for (let i = 0; i < printQueue.length; i++) {
            const item = printQueue[i];
            const barcodeText = item.barcode || item.number;

            if (barcodeText) {
                // Crear un canvas para el código de barras
                const canvas = document.createElement('canvas');
                tempContainer.appendChild(canvas);

                // Generar el código de barras
                JsBarcode(canvas, barcodeText, {
                    format: "CODE128",
                    width: 2,
                    height: printSettings.barcodeHeight,
                    displayValue: false,
                    margin: 0
                });

                // Esperar a que se genere el código de barras
                await new Promise(resolve => setTimeout(resolve, 50));

                // Capturar la imagen
                const barcodeDataUrl = canvas.toDataURL('image/png');
                barcodeImages.push({
                    dataUrl: barcodeDataUrl,
                    text: barcodeText,
                    item: item
                });
            }
        }

                // Limpiar el contenedor temporal
        document.body.removeChild(tempContainer);

        // Crear el PDF
        const doc = new jsPDF({
            orientation: printSettings.orientation,
            unit: 'mm',
            format: 'a4'
        });

        // Parámetros de página
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = printSettings.margin;

        // Calcular la disposición
        const labelWidth = printSettings.format === 'small' ? 40 :
                          printSettings.format === 'medium' ? 60 : 100;
        const labelHeight = printSettings.format === 'small' ? 20 :
                           printSettings.format === 'medium' ? 40 : 70;

        const cols = Math.floor((pageWidth - margin * 2) / labelWidth);
        const rows = Math.floor((pageHeight - margin * 2) / labelHeight);
        const labelsPerPage = cols * rows;

        let currentPage = 0;
        let currentLabel = 0;

        // Para cada etiqueta
        for (let i = 0; i < printQueue.length; i++) {
            const item = printQueue[i];
            const isInventory = item.inventoryData !== undefined;
            const barcodeText = item.barcode || item.number;
            const barcodeImage = barcodeImages.find(img => img.text === barcodeText);

            // Nueva página si es necesario
            if (currentLabel >= labelsPerPage) {
                doc.addPage();
                currentPage++;
                currentLabel = 0;
            }

            // Posición
            const col = currentLabel % cols;
            const row = Math.floor(currentLabel / cols);
            const x = margin + col * labelWidth;
            const y = margin + row * labelHeight;

            // Marco
            if (printSettings.margin > 0) {
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(0.1);
                doc.rect(x, y, labelWidth, labelHeight);
            }

            // Código de barras (si está disponible)
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

                    // Número bajo el código de barras
                    doc.setFontSize(6);
                    doc.setTextColor(100, 100, 100);
                    doc.text(barcodeText, x + labelWidth / 2, barcodeY + barcodeHeight + 2, { align: 'center' });

                    textY = barcodeY + barcodeHeight + 6;
                } catch (e) {
                    // Si la imagen falla, usar texto
                    console.warn('Error en la imagen del código de barras, usando texto alternativo', e);
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
                // Sin código de barras
                doc.setFontSize(6);
                doc.setTextColor(150, 150, 150);
                doc.text("Sin código de barras", x + labelWidth / 2, barcodeY + 5, { align: 'center' });
                textY = barcodeY + 10;
            }

            // Nombre del artículo
            doc.setFontSize(printSettings.fontSize === 'small' ? 8 :
                           printSettings.fontSize === 'large' ? 12 : 10);
            doc.setTextColor(0, 0, 0);
            doc.text(item.name, x + labelWidth / 2, textY, { align: 'center', maxWidth: labelWidth - 4 });
            textY += 5;

            // Número de artículo
            doc.setFontSize(printSettings.fontSize === 'small' ? 6 :
                           printSettings.fontSize === 'large' ? 9 : 7);
            doc.setTextColor(100, 100, 100);
            doc.text(item.number, x + labelWidth / 2, textY, { align: 'center' });
            textY += 4;

            // Stock
            if (printSettings.showStock) {
                if (isInventory) {
                    doc.text(`Antes: ${item.inventoryData.stock_avant}`, x + labelWidth / 2, textY, { align: 'center' });
                    textY += 4;
                    doc.text(`Después: ${item.inventoryData.stock_inventaire}`, x + labelWidth / 2, textY, { align: 'center' });
                    textY += 4;
                    const diffColor = item.inventoryData.difference > 0 ? [76, 175, 80] :
                                     item.inventoryData.difference < 0 ? [244, 67, 54] : [100, 100, 100];
                    doc.setTextColor(...diffColor);
                    doc.text(`Dif: ${item.inventoryData.difference > 0 ? '+' : ''}${item.inventoryData.difference}`,
                            x + labelWidth / 2, textY, { align: 'center' });
                    doc.setTextColor(100, 100, 100);
                    textY += 4;
                } else {
                    doc.text(`Stock: ${item.stock}`, x + labelWidth / 2, textY, { align: 'center' });
                    textY += 4;
                }
            }

            // Precio
            if (printSettings.showPrice && !isInventory) {
                doc.text(`${item.price.toFixed(2)}€`, x + labelWidth / 2, textY, { align: 'center' });
                textY += 4;
            }

            // Pie de página (Footer)
            doc.setFontSize(5);
            doc.setTextColor(150, 150, 150);

            const footerY = y + labelHeight - 3;
            let footerText = '';

            if (printSettings.showDate) {
                footerText += isInventory ? item.inventoryData.date_inventaire : new Date().toLocaleDateString('es-ES');
            }

            if (isInventory) {
                if (footerText) footerText += ' | ';
                footerText += 'INVENTARIO';
            }

            if (printSettings.showLocation && !isInventory) {
                if (footerText) footerText += ' | ';
                footerText += 'Zona A';
            }

            if (footerText) {
                doc.text(footerText, x + labelWidth / 2, footerY, { align: 'center' });
            }

            currentLabel++;
        }

        // Descargar
        const fileName = `etiquetas-${new Date().toISOString().split('T')[0]}-${Date.now()}.pdf`;
        doc.save(fileName);

        showNotification('¡PDF generado con éxito!', 'success');

    } catch (error) {
        console.error('Error al generar el PDF:', error);
        showNotification('Error durante la generación del PDF: ' + error.message, 'error');
    }
}

// ===== GESTIÓN DE PLANTILLAS (MODÈLES) =====
function saveTemplate() {
    const templateName = prompt('Nombre de la plantilla:');

    if (!templateName) {
        return;
    }

    try {
        // Recuperar las plantillas existentes
        const existingTemplates = JSON.parse(localStorage.getItem('labelTemplates') || '{}');

        // Guardar la plantilla actual
        existingTemplates[templateName] = {
            name: templateName,
            settings: { ...printSettings },
            date: new Date().toISOString()
        };

        localStorage.setItem('labelTemplates', JSON.stringify(existingTemplates));

        alert(`¡Plantilla "${templateName}" guardada con éxito!`);

    } catch (error) {
        console.error('Error al guardar la plantilla:', error);
        alert('Error durante el guardado de la plantilla');
    }
}

function loadTemplate() {
    try {
        // Recuperar las plantillas existentes
        const existingTemplates = JSON.parse(localStorage.getItem('labelTemplates') || '{}');

        if (Object.keys(existingTemplates).length === 0) {
            alert('No hay plantillas guardadas');
            return;
        }

        // Crear una lista de plantillas
        const templateNames = Object.keys(existingTemplates);
        const templateList = templateNames.map(name =>
            `${name} (${new Date(existingTemplates[name].date).toLocaleDateString('es-ES')})`
        ).join('\n');

        const selectedName = prompt(
            `Plantillas disponibles:\n\n${templateList}\n\nIntroduzca el nombre exacto de la plantilla a cargar:`
        );

        if (!selectedName || !existingTemplates[selectedName]) {
            return;
        }

        // Cargar los parámetros
        const template = existingTemplates[selectedName];
        printSettings = { ...printSettings, ...template.settings };

        // Aplicar los parámetros
        applySavedSettings();
        updateSliderValues();
        saveSettings();

        if (printQueue.length > 0) {
            updatePreview();
        }

        alert(`¡Plantilla "${selectedName}" cargada con éxito!`);

    } catch (error) {
        console.error('Error al cargar la plantilla:', error);
        alert('Error durante la carga de la plantilla');
    }
}

async function printMultipleList() {
    const printList = document.getElementById('printList');
    const items = printList.querySelectorAll('.list-item');

    if (items.length === 0) {
        showNotification('La lista de impresión está vacía', 'warning');
        return;
    }

    showNotification(`Preparando ${items.length} artículos para la impresión...`, 'info');

    const articlesToPrint = [];

    // Recorrer todos los artículos de la lista
    for (const item of items) {
        const articleId = item.dataset.id;
        const quantity = parseInt(item.querySelector('.quantity-input').value) || 1;

        // Si es un ID válido (no un ID temporal)
        if (articleId && !articleId.includes('temp-') && !articleId.includes('manual-')) {
            try {
                // Recuperar el artículo de la base de datos
                const { data: article, error } = await supabase
                    .from('w_articles')
                    .select('*')
                    .eq('id', articleId)
                    .single();

                if (error) throw error;

                // Añadir el número de ejemplares especificado
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
                console.error('Error al recuperar el artículo:', error);
                // Para artículos temporales, usar los datos mostrados
                const name = item.querySelector('.list-item-name').textContent;
                const details = item.querySelector('.list-item-details').textContent;

                for (let i = 0; i < quantity; i++) {
                    articlesToPrint.push({
                        id: articleId,
                        name: name,
                        number: details.split(' • ')[0] || 'N/D',
                        barcode: details.split(' • ')[1] || '',
                        stock: 0,
                        price: 0,
                        quantity: 1
                    });
                }
            }
        } else {
            // Artículo temporal
            const name = item.querySelector('.list-item-name').textContent;
            const details = item.querySelector('.list-item-details').textContent;

            for (let i = 0; i < quantity; i++) {
                articlesToPrint.push({
                    id: articleId,
                    name: name,
                    number: details.split(' • ')[0] || 'N/D',
                    barcode: details.split(' • ')[1] || '',
                    stock: 0,
                    price: 0,
                    quantity: 1
                });
            }
        }
    }

    // Añadir a la cola de impresión
    addToPrintQueue(articlesToPrint);

    // Cambiar a la pestaña de parámetros y mostrar la vista previa
    switchTab('single');

    // Mostrar la vista previa
    if (printQueue.length > 0) {
        document.getElementById('previewSection').style.display = 'block';
        updatePreview();
    }

    showNotification(`${articlesToPrint.length} etiquetas añadidas a la impresión`, 'success');

    // Opcional: Vaciar la lista después de añadir a impresión
    if (confirm('¿Desea vaciar la lista después de añadirla a la impresión?')) {
        clearPrintList();
    }
}

// ===== UTILIDADES =====
function logout() {
    if (!confirm('¿Está seguro de que desea cerrar sesión?')) {
        return;
    }

    sessionStorage.removeItem('current_user');
    sessionStorage.removeItem('supabase_token');
    window.location.href = 'connexion.html';
}

// ===== FUNCIÓN DE RESTABLECIMIENTO =====
function resetApplication() {
    if (confirm('¿Realmente desea restablecer todo? Esto eliminará la lista de impresión y restablecerá los parámetros.')) {
        // Restablecer la cola de impresión
        printQueue = [];
        currentPreviewIndex = 0;

        // Restablecer los parámetros por defecto
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

        // Restablecer la interfaz
        document.getElementById('printList').innerHTML = `
            <div class="empty-list">
                <i class="fas fa-tags"></i>
                <p>Ningún artículo seleccionado</p>
                <small>Añada artículos desde los resultados de búsqueda</small>
            </div>
        `;

        // Restablecer los campos de búsqueda
        document.getElementById('articleNumberSearch').value = '';
        document.getElementById('articleNameSearch').value = '';
        document.getElementById('barcodeSearch').value = '';
        document.getElementById('multipleSearch').value = '';


        // Ocultar las secciones
        document.getElementById('searchResults').style.display = 'none';
        document.getElementById('previewSection').style.display = 'none';
        document.getElementById('printSummary').style.display = 'none';


        // Volver a aplicar los parámetros
        applySavedSettings();
        updateSliderValues();
        updateListCount();
        updatePrintButtons();

        // Mostrar notificación
        showNotification('Aplicación restablecida con éxito', 'success');
    }
}

// Añadir un botón de restablecimiento en la interfaz
// En la función setupEventListeners, añade este escuchador:
document.getElementById('resetAppBtn')?.addEventListener('click', resetApplication);

window.openScanModal = openScanModal;
