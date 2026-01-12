// ===== DÉBOGAGE =====
console.log('vuestock.js chargé');

// Vérifier que tous les éléments DOM existent
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM chargé');

    const requiredElements = [
        'btnAddRack', 'canvasPlan', 'planOverlay',
        'rackModal', 'modalOverlay'
    ];

    requiredElements.forEach(id => {
        const el = document.getElementById(id);
        console.log(`${id}:`, el ? 'OK' : 'MANQUANT');
    });
});

// ===== CLASSE API MANAGER POUR NETLIFY =====
class ApiManager {
    constructor() {
        this.baseUrl = window.location.origin;
        this.endpoints = {
            getConfig: '/.netlify/functions/vuestock-api?action=get-config',
            saveRack: '/.netlify/functions/vuestock-api?action=save-rack',
            deleteRack: '/.netlify/functions/vuestock-api?action=delete-rack',
            saveLevel: '/.netlify/functions/vuestock-api?action=save-level',
            saveSlot: '/.netlify/functions/vuestock-api?action=save-slot',
            searchArticle: '/.netlify/functions/vuestock-api?action=search-article',
            updateStock: '/.netlify/functions/vuestock-api?action=update-stock'
        };
    }


    async request(endpoint, method = 'GET', data = null) {
        const url = `${this.baseUrl}${endpoint}`;
        console.log('📡 API Call:', url, method, data);

        console.log('Testez cette URL:', url);

        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);

            console.log('📡 Response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('📡 Response data:', result);

            if (result.error) {
                throw new Error(result.error);
            }

            return result;

        } catch (error) {
            console.error('❌ API Request failed:', error);
            throw error;
        }
    }

    // Méthodes spécifiques
    async getFullConfig() {
        return await this.request(this.endpoints.getConfig);
    }

    async saveRack(rackData) {
        return await this.request(this.endpoints.saveRack, 'POST', rackData);
    }

    async deleteRack(rackId) {
        // ✅ L'ID doit être dans l'URL, pas dans le body
        return await this.request(`${this.endpoints.deleteRack}&rackId=${rackId}`, 'DELETE');
    }

    async saveLevel(levelData) {
        return await this.request(this.endpoints.saveLevel, 'POST', levelData);
    }

    async saveSlot(slotData) {
        return await this.request(this.endpoints.saveSlot, 'POST', slotData);
    }

    async searchArticles(searchTerm) {
        return await this.request(`${this.endpoints.searchArticle}&q=${encodeURIComponent(searchTerm)}`);
    }

    async updateStock(stockData) {
        return await this.request(this.endpoints.updateStock, 'POST', stockData);
    }
}


// ===== CLASSE CANVAS MANAGER =====
class CanvasManager {
    constructor(canvasId, overlayId) {
        // Bind explicite de TOUTES les méthodes
        this.drawGrid = this.drawGrid.bind(this);
        this.updateCoordinatesDisplay = this.updateCoordinatesDisplay.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.cleanupEvents = this.cleanupEvents.bind(this);
        this.startRackDrag = this.startRackDrag.bind(this);
        this.dragRack = this.dragRack.bind(this);
        this.selectRack = this.selectRack.bind(this);
        this.startResize = this.startResize.bind(this);
        this.startRotation = this.startRotation.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleRotation = this.handleRotation.bind(this);
        this.saveAutoPosition = this.saveAutoPosition.bind(this);
        this._clickInProgress = false;

        // Initialiser les propriétés
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById(overlayId);

        // Configuration
        this.gridSize = 40;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;
        this.selectedRack = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.currentTool = 'select';

        // État de la souris
        this.mouseX = 0;
        this.mouseY = 0;
        this.gridX = 0;
        this.gridY = 0;

        // Variables pour le drag/resize/rotate
        this.currentRack = null;
        this.currentElement = null;
        this.resizeHandle = null;
        this.resizeStartData = null;
        this.rotateStartData = null;

        // Sauvegarde automatique
        this.saveTimeout = null;
        this.racks = [];

        // Initialisation
        this.initCanvas();
        this.drawGrid();
        this.initEvents();
    }

    // === MÉTHODES ===
    drawGrid() {
        if (!this.ctx || !this.canvas) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const width = this.canvas.width;
        const height = this.canvas.height;
        const gridSize = this.gridSize * this.scale;

        // Calculer les positions de départ avec l'offset
        const startX = -this.offsetX % gridSize;
        const startY = -this.offsetY % gridSize;

        // Dessiner la grille
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.lineWidth = 1;

        // Lignes verticales
        for (let x = startX; x < width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }

        // Lignes horizontales
        for (let y = startY; y < height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }

        // Points de grille tous les 4 carreaux
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        for (let x = startX; x < width; x += gridSize * 4) {
            for (let y = startY; y < height; y += gridSize * 4) {
                this.ctx.beginPath();
                this.ctx.arc(x, y, 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        // Mettre à jour les coordonnées affichées
        this.updateCoordinatesDisplay();
    }

    updateCoordinatesDisplay() {
        const coordsElement = document.getElementById('mouseCoords');
        const scaleElement = document.getElementById('scaleDisplay');

        if (coordsElement) {
            const gridX = Math.round(this.gridX / this.gridSize);
            const gridY = Math.round(this.gridY / this.gridSize);
            coordsElement.textContent = `X: ${gridX}, Y: ${gridY}`;
        }

        if (scaleElement) {
            scaleElement.textContent = `${Math.round(this.scale * 100)}%`;
        }
    }

    initCanvas() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
    }

    cleanupEvents() {
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        document.removeEventListener('mousemove', this.handleResize);
        document.removeEventListener('mousemove', this.handleRotation);
    }

    handleMouseMove(e) {
        if (this.isDragging && this.currentRack && this.currentElement) {
            this.dragRack(e);
        }
    }

    handleMouseUp() {
        this.cleanupEvents();

        if (this.isDragging) {
            this.isDragging = false;
            this.currentRack = null;
            this.currentElement = null;

            if (this.selectedRack) {
                this.saveAutoPosition();
            }
        }

        if (this.isResizing) {
            this.isResizing = false;
            this.resizeHandle = null;
            this.resizeStartData = null;

            if (this.selectedRack) {
                this.saveAutoPosition();
            }
        }

        if (this.isRotating) {
            this.isRotating = false;
            this.rotateStartData = null;

            if (this.selectedRack) {
                this.saveAutoPosition();
            }
        }
    }

    // === MÉTHODES POUR LES ÉTAGÈRES ===
    addRackToCanvas(rack) {
        console.log('🟢 [CanvasManager] addRackToCanvas called for rack:', rack.id, rack.code);

        // Vérifier si l'étagère existe déjà
        const existingElement = this.overlay.querySelector(`[data-rack-id="${rack.id}"]`);
        if (existingElement) {
            existingElement.remove();
            this.racks = this.racks.filter(item => item.rack.id !== rack.id);
        }

        // Créer l'élément DOM
        const rackElement = document.createElement('div');
        rackElement.className = 'rack-on-plan';
        rackElement.dataset.rackId = rack.id;
        rackElement.style.position = 'absolute';
        rackElement.style.left = `${rack.position_x}px`;
        rackElement.style.top = `${rack.position_y}px`;
        rackElement.style.width = `${rack.width * this.gridSize}px`;
        rackElement.style.height = `${rack.depth * this.gridSize}px`;
        rackElement.style.backgroundColor = rack.color || '#4a90e2';
        rackElement.style.border = '2px solid #333';
        rackElement.style.borderRadius = '4px';
        rackElement.style.transform = rack.rotation ? `rotate(${rack.rotation}deg)` : '';
        rackElement.style.transformOrigin = 'center center';
        rackElement.style.cursor = 'move';
        rackElement.style.zIndex = '10';
        rackElement.textContent = rack.code;
        rackElement.style.display = 'flex';
        rackElement.style.alignItems = 'center';
        rackElement.style.justifyContent = 'center';
        rackElement.style.color = '#fff';
        rackElement.style.fontWeight = 'bold';
        rackElement.style.userSelect = 'none';

        // Ajouter les poignées
        this.addRackHandles(rackElement, rack);

        // Événements
        rackElement.addEventListener('mousedown', (e) => {
            this.startRackDrag(e, rack, rackElement);
        });

        rackElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectRack(rack, rackElement);
        });

        this.overlay.appendChild(rackElement);
        this.racks.push({ rack, element: rackElement });

        // Auto-sélection pour les nouvelles étagères
        if (!rack.id || rack.id.toString().includes('new')) {
            setTimeout(() => {
                this.selectRack(rack, rackElement);
            }, 100);
        }
    }

    addRackHandles(rackElement, rack) {
        // Poignées de redimensionnement
        const handles = [
            { class: 'handle-nw', cursor: 'nw-resize', top: '0', left: '0' },
            { class: 'handle-ne', cursor: 'ne-resize', top: '0', right: '0' },
            { class: 'handle-sw', cursor: 'sw-resize', bottom: '0', left: '0' },
            { class: 'handle-se', cursor: 'se-resize', bottom: '0', right: '0' }
        ];

        handles.forEach(handle => {
            const handleEl = document.createElement('div');
            handleEl.className = `rack-handle ${handle.class}`;
            handleEl.style.position = 'absolute';
            handleEl.style.width = '12px';
            handleEl.style.height = '12px';
            handleEl.style.backgroundColor = '#fff';
            handleEl.style.border = '2px solid #007bff';
            handleEl.style.borderRadius = '2px';
            handleEl.style.cursor = handle.cursor;
            handleEl.style.zIndex = '20';

            if (handle.top) handleEl.style.top = handle.top;
            if (handle.bottom) handleEl.style.bottom = handle.bottom;
            if (handle.left) handleEl.style.left = handle.left;
            if (handle.right) handleEl.style.right = handle.right;

            handleEl.style.display = 'none';

            handleEl.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.startResize(e, rack, rackElement, handleEl);
            });

            rackElement.appendChild(handleEl);
        });

        // Poignée de rotation
        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'rotate-handle';
        rotateHandle.innerHTML = '⟳';
        rotateHandle.style.position = 'absolute';
        rotateHandle.style.top = '-25px';
        rotateHandle.style.left = '50%';
        rotateHandle.style.transform = 'translateX(-50%)';
        rotateHandle.style.width = '20px';
        rotateHandle.style.height = '20px';
        rotateHandle.style.backgroundColor = '#fff';
        rotateHandle.style.border = '2px solid #007bff';
        rotateHandle.style.borderRadius = '50%';
        rotateHandle.style.cursor = 'grab';
        rotateHandle.style.display = 'flex';
        rotateHandle.style.alignItems = 'center';
        rotateHandle.style.justifyContent = 'center';
        rotateHandle.style.fontSize = '12px';
        rotateHandle.style.zIndex = '20';
        rotateHandle.style.display = 'none';

        rotateHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.startRotation(e, rack, rackElement);
        });

        rackElement.appendChild(rotateHandle);

        // Dimensions
        const dimensions = document.createElement('div');
        dimensions.className = 'rack-dimensions';
        dimensions.style.position = 'absolute';
        dimensions.style.bottom = '-25px';
        dimensions.style.left = '50%';
        dimensions.style.transform = 'translateX(-50%)';
        dimensions.style.fontSize = '12px';
        dimensions.style.color = '#666';
        dimensions.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        dimensions.style.padding = '2px 6px';
        dimensions.style.borderRadius = '3px';
        dimensions.style.zIndex = '15';
        dimensions.style.display = 'none';

        const width = rack.width;
        const depth = rack.depth;
        dimensions.textContent = `${width}×${depth}`;
        rackElement.appendChild(dimensions);
    }

    startRackDrag(e, rack, element) {
        // ✅ AJOUTEZ CECI EN PREMIER
        // Si l'outil delete est actif, supprimer directement
        if (this.currentTool === 'delete') {
            if (confirm('Supprimer cette étagère et tous ses étages/emplacements ?')) {
                this.deleteRack(rack.id);
            }
            return; // Ne pas continuer
        }

        // Vérifier si on clique sur une poignée
        const handle = e.target.closest('.rack-handle, .rotate-handle');
        if (handle) {
            if (handle.classList.contains('rotate-handle')) {
                this.startRotation(e, rack, element);
            } else {
                this.startResize(e, rack, element, handle);
            }
            return;
        }

        // Autoriser le déplacement avec les outils "move" et "select"
        if (this.currentTool !== 'move' && this.currentTool !== 'select') {
            return;
        }

        // Sinon, déplacement normal
        this.isDragging = true; // ← Première fois
        this.currentRack = rack;
        this.currentElement = element;
        this.dragStartX = e.clientX - rack.position_x;
        this.dragStartY = e.clientY - rack.position_y;

        // Sélectionner l'étagère
        this.selectRack(rack, element);
        // this.isDragging = true; ← ❌ SUPPRIMEZ CETTE LIGNE (doublon)

        // Ajouter les événements globaux
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
    }

    dragRack(e) {
        if (!this.isDragging || !this.currentRack || !this.currentElement) return;

        let newX = e.clientX - this.dragStartX;
        let newY = e.clientY - this.dragStartY;

        // Snap to grid
        newX = Math.round(newX / this.gridSize) * this.gridSize;
        newY = Math.round(newY / this.gridSize) * this.gridSize;

        // Limites du canvas
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const rackWidth = this.currentRack.width * this.gridSize;
        const rackHeight = this.currentRack.depth * this.gridSize;

        newX = Math.max(0, Math.min(newX, canvasWidth - rackWidth));
        newY = Math.max(0, Math.min(newY, canvasHeight - rackHeight));

        // Mettre à jour
        this.currentRack.position_x = newX;
        this.currentRack.position_y = newY;
        this.currentElement.style.left = `${newX}px`;
        this.currentElement.style.top = `${newY}px`;

        this.updatePropertiesPanel(this.currentRack);
    }

    selectRack(rack, element) {
        // Désélectionner toutes les autres
        document.querySelectorAll('.rack-on-plan').forEach(el => {
            el.classList.remove('selected');
            el.style.zIndex = '10';
            el.querySelectorAll('.rack-handle, .rotate-handle, .rack-dimensions').forEach(h => {
                h.style.display = 'none';
            });
        });

        // Sélectionner celle-ci
        element.classList.add('selected');
        element.style.zIndex = '20';
        this.selectedRack = rack;

        // Montrer les poignées
        element.querySelectorAll('.rack-handle, .rotate-handle, .rack-dimensions').forEach(h => {
            h.style.display = 'block';
        });

        this.updatePropertiesPanel(rack);
    }

    startResize(e, rack, element, handle) {
        e.stopPropagation();
        this.isResizing = true;
        this.currentRack = rack;
        this.currentElement = element;
        this.resizeHandle = handle;

        this.resizeStartData = {
            width: rack.width,
            height: rack.depth,
            x: rack.position_x,
            y: rack.position_y,
            mouseX: e.clientX,
            mouseY: e.clientY
        };

        // Ajouter les événements globaux
        document.addEventListener('mousemove', this.handleResize);
        document.addEventListener('mouseup', this.handleMouseUp);
    }

    handleResize(e) {
        if (!this.isResizing || !this.resizeStartData || !this.currentRack || !this.currentElement) return;

        const deltaX = e.clientX - this.resizeStartData.mouseX;
        const deltaY = e.clientY - this.resizeStartData.mouseY;

        let newWidth = this.resizeStartData.width;
        let newHeight = this.resizeStartData.height;
        let newX = this.resizeStartData.x;
        let newY = this.resizeStartData.y;

        // Calcul selon la poignée utilisée
        const gridDeltaX = Math.round(deltaX / this.gridSize);
        const gridDeltaY = Math.round(deltaY / this.gridSize);

        const handleType = this.resizeHandle.className.replace('rack-handle ', '');

        switch(handleType) {
            case 'handle-se':
                newWidth = Math.max(1, this.resizeStartData.width + gridDeltaX);
                newHeight = Math.max(1, this.resizeStartData.height + gridDeltaY);
                break;
            case 'handle-sw':
                newWidth = Math.max(1, this.resizeStartData.width - gridDeltaX);
                newHeight = Math.max(1, this.resizeStartData.height + gridDeltaY);
                newX = this.resizeStartData.x + (gridDeltaX * this.gridSize);
                break;
            case 'handle-ne':
                newWidth = Math.max(1, this.resizeStartData.width + gridDeltaX);
                newHeight = Math.max(1, this.resizeStartData.height - gridDeltaY);
                newY = this.resizeStartData.y + (gridDeltaY * this.gridSize);
                break;
            case 'handle-nw':
                newWidth = Math.max(1, this.resizeStartData.width - gridDeltaX);
                newHeight = Math.max(1, this.resizeStartData.height - gridDeltaY);
                newX = this.resizeStartData.x + (gridDeltaX * this.gridSize);
                newY = this.resizeStartData.y + (gridDeltaY * this.gridSize);
                break;
        }

        // Limites
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const rackWidth = newWidth * this.gridSize;
        const rackHeight = newHeight * this.gridSize;

        if (newX < 0) newX = 0;
        if (newY < 0) newY = 0;
        if (newX + rackWidth > canvasWidth) newX = canvasWidth - rackWidth;
        if (newY + rackHeight > canvasHeight) newY = canvasHeight - rackHeight;

        // Mettre à jour
        this.currentRack.width = newWidth;
        this.currentRack.depth = newHeight;
        this.currentRack.position_x = newX;
        this.currentRack.position_y = newY;

        this.currentElement.style.width = `${newWidth * this.gridSize}px`;
        this.currentElement.style.height = `${newHeight * this.gridSize}px`;
        this.currentElement.style.left = `${newX}px`;
        this.currentElement.style.top = `${newY}px`;

        // Mettre à jour l'affichage des dimensions
        const dims = this.currentElement.querySelector('.rack-dimensions');
        if (dims) {
            dims.textContent = `${newWidth}×${newHeight}`;
        }

        this.updatePropertiesPanel(this.currentRack);
    }

    startRotation(e, rack, element) {
        e.stopPropagation();
        this.isRotating = true;
        this.currentRack = rack;
        this.currentElement = element;

        const rect = element.getBoundingClientRect();
        this.rotateStartData = {
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2,
            startAngle: Math.atan2(e.clientY - (rect.top + rect.height / 2), e.clientX - (rect.left + rect.width / 2)),
            startRotation: rack.rotation || 0
        };

        // Ajouter les événements globaux
        document.addEventListener('mousemove', this.handleRotation);
        document.addEventListener('mouseup', this.handleMouseUp);
    }

    handleRotation(e) {
        if (!this.isRotating || !this.rotateStartData || !this.currentRack || !this.currentElement) return;

        const currentAngle = Math.atan2(
            e.clientY - this.rotateStartData.centerY,
            e.clientX - this.rotateStartData.centerX
        );
        const deltaAngle = (currentAngle - this.rotateStartData.startAngle) * (180 / Math.PI);
        let newRotation = (this.rotateStartData.startRotation + deltaAngle) % 360;

        if (newRotation < 0) newRotation += 360;

        // Snap à 15 degrés
        newRotation = Math.round(newRotation / 15) * 15;

        this.currentRack.rotation = newRotation;
        this.currentElement.style.transform = `rotate(${newRotation}deg)`;

        this.updatePropertiesPanel(this.currentRack);
    }

    saveAutoPosition() {
        if (!this.selectedRack || !window.vueStock) return;

        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            // CORRECTION : Toujours envoyer l'ID pour une mise à jour
            const payload = {
                id: this.selectedRack.id, // <-- AJOUTER CE LÀ !
                position_x: this.selectedRack.position_x,
                position_y: this.selectedRack.position_y,
                rotation: this.selectedRack.rotation || 0,
                width: this.selectedRack.width,
                depth: this.selectedRack.depth,
                color: this.selectedRack.color
            };

            // Si l'étagère a un code/nom, les inclure aussi
            if (this.selectedRack.code) {
                payload.code = this.selectedRack.code;
            }
            if (this.selectedRack.name) {
                payload.name = this.selectedRack.name;
            }

            console.log('💾 Auto-saving rack with ID:', this.selectedRack.id);

            window.vueStock.api.saveRack(payload)
                .then((result) => {
                    console.log('✅ Auto-save successful:', result);
                })
                .catch(err => {
                    console.error('❌ Erreur auto-save:', err);
                });
        }, 1000); // 1 seconde après la dernière modification
    }

    updatePropertiesPanel(rack) {
        const panel = document.getElementById('propertiesPanel');
        if (!panel || !rack) return;

        panel.innerHTML = `
            <h4>Étagère ${rack.code}</h4>
            <div class="property-group">
                <div class="property">
                    <span class="property-label">Position:</span>
                    <span class="property-value">${Math.round(rack.position_x / this.gridSize)}, ${Math.round(rack.position_y / this.gridSize)}</span>
                </div>
                <div class="property">
                    <span class="property-label">Dimensions:</span>
                    <span class="property-value">${rack.width} × ${rack.depth} cases</span>
                </div>
                <div class="property">
                    <span class="property-label">Rotation:</span>
                    <span class="property-value">${rack.rotation || 0}°</span>
                </div>
                <div class="property">
                    <span class="property-label">Couleur:</span>
                    <input type="color" value="${rack.color || '#4a90e2'}" class="property-color" data-rack-id="${rack.id}">
                </div>
            </div>
            <button class="btn btn-sm btn-block view-rack-btn" data-rack-id="${rack.id}">
                <i class="fas fa-eye"></i> Voir les étages
            </button>
            <button class="btn btn-sm btn-danger btn-block delete-rack-btn" data-rack-id="${rack.id}">
                <i class="fas fa-trash"></i> Supprimer
            </button>
        `;

        // ✅ Événements directs (pas de délégation empilée)
        const colorInput = panel.querySelector('.property-color');
        if (colorInput) {
            colorInput.addEventListener('change', (e) => {
                rack.color = e.target.value;
                const element = this.overlay.querySelector(`[data-rack-id="${rack.id}"]`);
                if (element) {
                    element.style.backgroundColor = rack.color;
                    this.saveAutoPosition();
                }
            });
        }

        const viewBtn = panel.querySelector('.view-rack-btn');
        if (viewBtn) {
            viewBtn.addEventListener('click', () => {
                if (window.vueStock) {
                    window.vueStock.goToRackView(rack);
                }
            });
        }

        // ✅ Événement direct pour le bouton supprimer (une seule fois)
        const deleteBtn = panel.querySelector('.delete-rack-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm('Supprimer cette étagère et tous ses étages/emplacements ?')) {
                    this.deleteRack(rack.id);
                }
            });
        }
    }


    async deleteRack(rackId) {
        try {
            // ✅ CORRECTION : Passer l'ID dans l'URL, pas dans le body
            if (window.vueStock?.api) {
                await window.vueStock.api.deleteRack(rackId);
            }

            // Supprimer du DOM
            const element = this.overlay.querySelector(`[data-rack-id="${rackId}"]`);
            if (element) {
                element.remove();
            }

            // Supprimer du tableau
            this.racks = this.racks.filter(item => item.rack.id !== rackId);

            // Supprimer aussi du tableau de VueStock
            if (window.vueStock) {
                window.vueStock.racks = window.vueStock.racks.filter(r => r.id !== rackId);
            }

            // Réinitialiser la sélection
            this.selectedRack = null;

            // Mettre à jour le panneau
            const panel = document.getElementById('propertiesPanel');
            if (panel) {
                panel.innerHTML = '<p class="no-selection">Sélectionnez un élément pour voir ses propriétés</p>';
            }

            // Mettre à jour les statistiques
            if (window.vueStock) {
                window.vueStock.updateStats();
            }

            console.log('🗑️ Étagère supprimée:', rackId);

        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
            alert('Erreur: ' + error.message);
        }
    }

    getRackById(rackId) {
        const item = this.racks.find(item => item.rack.id === rackId);
        return item ? item.rack : null;
    }

    initEvents() {
        // Suivi de la souris
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;

            // Convertir en coordonnées grille
            this.gridX = this.mouseX + this.offsetX;
            this.gridY = this.mouseY + this.offsetY;

            this.updateCoordinatesDisplay();
        });

        // Zoom avec molette
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();

            const zoomIntensity = 0.1;
            const oldScale = this.scale;

            if (e.deltaY < 0) {
                // Zoom in
                this.scale = Math.min(3, this.scale * (1 + zoomIntensity));
            } else {
                // Zoom out
                this.scale = Math.max(0.2, this.scale * (1 - zoomIntensity));
            }

            // Ajuster l'offset pour zoomer vers la souris
            const scaleRatio = this.scale / oldScale;
            this.offsetX = this.mouseX * (1 - scaleRatio) + this.offsetX * scaleRatio;
            this.offsetY = this.mouseY * (1 - scaleRatio) + this.offsetY * scaleRatio;

            this.drawGrid();
            this.updateCoordinatesDisplay();
        });

        // Outils - ATTENTION AUX ID
        const toolButtons = document.querySelectorAll('.tool-btn');
        toolButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                toolButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.dataset.tool;

                // Si outil "rack", créer une nouvelle étagère au clic
                if (this.currentTool === 'rack') {
                    this.canvas.style.cursor = 'crosshair';
                } else {
                    this.canvas.style.cursor = 'default';
                }
            });
        });

        // Clic sur le canvas pour créer une étagère
        this.canvas.addEventListener('click', async (e) => {
            // ✅ Protection contre double clic
            if (this._clickInProgress) return;

            if (this.currentTool === 'rack') {
                this._clickInProgress = true;

                try {
                    const rect = this.canvas.getBoundingClientRect();
                    const x = e.clientX - rect.left - this.offsetX;
                    const y = e.clientY - rect.top - this.offsetY;

                    const gridX = Math.round(x / this.gridSize) * this.gridSize;
                    const gridY = Math.round(y / this.gridSize) * this.gridSize;

                    if (window.vueStock) {
                        // Trouver le prochain code disponible
                        const existingCodes = window.vueStock.racks.map(r => r.code);
                        let nextCode = 'A';
                        let charCode = 65;

                        while (existingCodes.includes(nextCode)) {
                            charCode++;
                            nextCode = String.fromCharCode(charCode);
                            if (charCode > 90) break; // Sécurité
                        }

                        await window.vueStock.addRack({
                            code: nextCode,
                            x: gridX,
                            y: gridY,
                            width: 3,
                            depth: 2,
                            color: this.getRandomColor()
                        });

                        const selectTool = document.querySelector('[data-tool="select"]');
                        if (selectTool) {
                            selectTool.click();
                        }
                    }
                } finally {
                    // ✅ Débloquer après 500ms (sécurité)
                    setTimeout(() => {
                        this._clickInProgress = false;
                    }, 500);
                }
            }
        }, { once: false }); // Vérifier qu'il n'y a qu'UN seul addEventListener pour 'click'

        // Boutons de zoom - VÉRIFIER LES ID
        const zoomInBtn = document.getElementById('btnZoomIn');
        const zoomOutBtn = document.getElementById('btnZoomOut');
        const zoomResetBtn = document.getElementById('btnZoomReset');
        const gridToggleBtn = document.getElementById('btnGridToggle');

        zoomInBtn?.addEventListener('click', () => {
            this.scale = Math.min(3, this.scale * 1.2);
            this.drawGrid();
        });

        zoomOutBtn?.addEventListener('click', () => {
            this.scale = Math.max(0.2, this.scale / 1.2);
            this.drawGrid();
        });

        zoomResetBtn?.addEventListener('click', () => {
            this.scale = 1;
            this.offsetX = 0;
            this.offsetY = 0;
            this.drawGrid();
        });

        // Grille magnétique toggle
        gridToggleBtn?.addEventListener('click', () => {
            const isActive = gridToggleBtn.classList.contains('active');

            if (isActive) {
                gridToggleBtn.classList.remove('active');
                gridToggleBtn.innerHTML = '<i class="fas fa-th"></i> Grille';
                // Cacher la grille
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            } else {
                gridToggleBtn.classList.add('active');
                gridToggleBtn.innerHTML = '<i class="fas fa-th"></i> Grille ON';
                // Afficher la grille
                this.drawGrid();
            }
        });
    }

    getRandomColor() {
        const colors = [
            '#4a90e2', '#7b68ee', '#2ecc71', '#f39c12',
            '#e74c3c', '#9b59b6', '#1abc9c', '#34495e'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
}

// vuestock.js - AJOUTEZ après la classe CanvasManager

class QuadViewManager {
    constructor() {
        this.currentView = 'quad'; // 'quad' ou 'single'
        this.selectedRack = null;
        this.selectedLevel = null;

        // Canvases
        this.canvasTop = document.getElementById('canvasTop');
        this.canvasFront = document.getElementById('canvasFront');
        this.canvas3D = document.getElementById('canvas3D');

        // Contexts
        this.ctxTop = this.canvasTop?.getContext('2d');
        this.ctxFront = this.canvasFront?.getContext('2d');
        this.ctx3D = this.canvas3D?.getContext('2d');

        // Dimensions par défaut (seront ajustées)
        this.rackHeightPerLevel = 40; // px par niveau
        this.slotSize = 60; // px par emplacement

        this.init();
    }

    init() {
        console.log('QuadViewManager initialisé');

        // Ajuster les dimensions des canvas
        this.resizeCanvases();

        // Événements de redimensionnement
        window.addEventListener('resize', () => this.resizeCanvases());

        // Basculement de vue
        document.querySelectorAll('.view-switch-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.switchView(view);
            });
        });

        // Contrôles 3D
        document.querySelectorAll('.quad-3d-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const angle = parseInt(e.target.dataset.angle);
                this.set3DAngle(angle);
            });
        });

        // Réinitialisation 3D
        document.getElementById('quad3DReset')?.addEventListener('click', () => {
            this.reset3DView();
        });

        // Démarrer avec la vue quad
        this.switchView('quad');
    }

    resizeCanvases() {
        const quadViews = document.querySelectorAll('.quad-view-content');

        quadViews.forEach(container => {
            const canvas = container.querySelector('canvas');
            if (canvas) {
                const rect = container.getBoundingClientRect();
                canvas.width = rect.width;
                canvas.height = rect.height;
            }
        });
    }

    switchView(viewType) {
        this.currentView = viewType;

        // Mettre à jour les boutons
        document.querySelectorAll('.view-switch-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewType);
        });

        // Afficher/masquer les vues
        const quadView = document.getElementById('quadView');
        const simpleView = document.getElementById('simpleView');

        if (viewType === 'quad') {
            quadView.style.display = 'grid';
            simpleView.style.display = 'none';
            document.getElementById('viewMode').textContent = 'Quad';

            // Redessiner toutes les vues
            setTimeout(() => {
                this.resizeCanvases();
                if (window.vueStock) {
                    this.updateAllViews(window.vueStock.racks);
                }
            }, 100);
        } else {
            quadView.style.display = 'none';
            simpleView.style.display = 'block';
            document.getElementById('viewMode').textContent = 'Simple';
        }
    }

    // Mettre à jour toutes les vues avec les racks
    updateAllViews(racks) {
        if (!racks || !racks.length) return;

        // 1. Vue du dessus
        this.drawTopView(racks);

        // 2. Vue de face (si un rack est sélectionné)
        if (this.selectedRack) {
            this.drawFrontView(this.selectedRack);
        } else {
            this.drawFrontView(racks[0]); // Premier rack par défaut
        }

        // 3. Vue 3D isométrique
        this.draw3DView(racks);

        // 4. Vue étage (si un niveau est sélectionné)
        if (this.selectedLevel) {
            this.updateLevelView(this.selectedLevel);
        }

        // Mettre à jour les infos
        this.updateInfoPanel(racks);
    }

    drawTopView(racks) {
        if (!this.ctxTop || !this.canvasTop) return;

        const ctx = this.ctxTop;
        const width = this.canvasTop.width;
        const height = this.canvasTop.height;

        // Effacer
        ctx.clearRect(0, 0, width, height);

        // Grille légère
        this.drawGrid(ctx, width, height, 20);

        // Dessiner chaque rack
        racks.forEach(rack => {
            const scale = 0.8; // Réduire pour la vue quad
            const x = (rack.position_x * scale) % width;
            const y = (rack.position_y * scale) % height;
            const w = rack.width * 20; // 20px par case
            const d = rack.depth * 20;

            // Rectangle du rack
            ctx.fillStyle = rack.color || '#4a90e2';
            ctx.fillRect(x, y, w, d);

            // Bordure
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, w, d);

            // Code du rack
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(rack.code, x + w/2, y + d/2);

            // Si sélectionné, mettre en surbrillance
            if (this.selectedRack && rack.id === this.selectedRack.id) {
                ctx.strokeStyle = '#ffeb3b';
                ctx.lineWidth = 3;
                ctx.strokeRect(x - 2, y - 2, w + 4, d + 4);
            }
        });

        // Mettre à jour le compteur
        document.getElementById('quadRackCount').textContent = `${racks.length} racks`;
    }

    drawFrontView(rack) {
        if (!this.ctxFront || !this.canvasFront || !rack) return;

        const ctx = this.ctxFront;
        const width = this.canvasFront.width;
        const height = this.canvasFront.height;

        // Effacer
        ctx.clearRect(0, 0, width, height);

        // Dessiner le rack en élévation
        const rackWidth = rack.width * 30; // 30px par case en largeur
        const startX = (width - rackWidth) / 2;
        const startY = height - 20; // Bas du canvas

        // Base du rack
        ctx.fillStyle = '#8b7355';
        ctx.fillRect(startX, startY - 10, rackWidth, 10);

        // Niveaux (du bas vers le haut)
        if (rack.levels && rack.levels.length) {
            const levels = [...rack.levels].sort((a, b) => a.display_order - b.display_order);

            let currentY = startY - 10;

            levels.forEach(level => {
                // Étage
                ctx.fillStyle = level.code % 20 === 0 ? '#6c757d' : '#adb5bd';
                const levelHeight = 40; // Hauteur fixe par niveau

                ctx.fillRect(startX, currentY - levelHeight, rackWidth, levelHeight);

                // Séparateur
                ctx.strokeStyle = '#495057';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(startX, currentY - levelHeight);
                ctx.lineTo(startX + rackWidth, currentY - levelHeight);
                ctx.stroke();

                // Code de l'étage
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(level.code, startX + rackWidth/2, currentY - levelHeight/2);

                currentY -= levelHeight;
            });

            // Hauteur totale
            const totalHeight = startY - currentY;
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(startX - 30, currentY, 25, totalHeight);

            // Étiquette de hauteur
            ctx.fillStyle = '#333';
            ctx.font = '10px Arial';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${levels.length} étages`, startX - 35, currentY + totalHeight/2);
        }

        // Code du rack en bas
        ctx.fillStyle = '#333';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Rack ${rack.code}`, width/2, height - 5);

        // Mettre à jour l'info
        document.getElementById('quadSelectedRack').textContent = `Rack ${rack.code} - ${rack.levels?.length || 0} étages`;
    }

    draw3DView(racks) {
        if (!this.ctx3D || !this.canvas3D) return;

        const ctx = this.ctx3D;
        const width = this.canvas3D.width;
        const height = this.canvas3D.height;

        // Effacer
        ctx.clearRect(0, 0, width, height);

        // Fond gradient
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Dessiner les racks en perspective isométrique
        const centerX = width / 2;
        const centerY = height / 2;

        racks.forEach((rack, index) => {
            // Position isométrique
            const isoX = centerX + (rack.position_x * 0.5 - rack.position_y * 0.5) * 0.3;
            const isoY = centerY + (rack.position_x * 0.25 + rack.position_y * 0.25 - (rack.levels?.length || 0) * 5) * 0.3;

            // Dimensions projetées
            const isoWidth = rack.width * 15;
            const isoDepth = rack.depth * 15;
            const isoHeight = (rack.levels?.length || 1) * 8;

            // Couleur avec transparence
            ctx.fillStyle = rack.color + 'CC';

            // Dessiner le prisme 3D simple
            this.drawIsoPrism(ctx, isoX, isoY, isoWidth, isoDepth, isoHeight);

            // Code du rack (si assez grand)
            if (isoWidth > 30) {
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(rack.code, isoX, isoY - isoHeight/2);
            }
        });

        // Légende
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Vue 3D - ${racks.length} racks`, 10, 20);
    }

    drawIsoPrism(ctx, x, y, w, d, h) {
        // Faces avant et droite simplifiées
        const isoAngle = 0.5; // Ratio isométrique

        // Face avant
        ctx.beginPath();
        ctx.moveTo(x - w/2, y + d/2);
        ctx.lineTo(x - w/2, y - d/2);
        ctx.lineTo(x - w/2 + h * isoAngle, y - d/2 - h * isoAngle);
        ctx.lineTo(x - w/2 + h * isoAngle, y + d/2 - h * isoAngle);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fill();

        // Face droite
        ctx.beginPath();
        ctx.moveTo(x + w/2, y + d/2);
        ctx.lineTo(x + w/2, y - d/2);
        ctx.lineTo(x + w/2 - h * isoAngle, y - d/2 - h * isoAngle);
        ctx.lineTo(x + w/2 - h * isoAngle, y + d/2 - h * isoAngle);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();

        // Face du dessus
        ctx.beginPath();
        ctx.moveTo(x - w/2, y - d/2);
        ctx.lineTo(x + w/2, y - d/2);
        ctx.lineTo(x + w/2 - h * isoAngle, y - d/2 - h * isoAngle);
        ctx.lineTo(x - w/2 + h * isoAngle, y - d/2 - h * isoAngle);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fill();
    }

    updateLevelView(level) {
        const container = document.getElementById('quadLevelSlots');
        if (!container || !level) return;

        container.innerHTML = '';

        if (!level.slots || level.slots.length === 0) {
            container.innerHTML = `
                <div class="empty-quad">
                    <i class="fas fa-box-open fa-2x"></i>
                    <p>Aucun emplacement</p>
                </div>
            `;
            return;
        }

        // Trier les emplacements par code
        const sortedSlots = [...level.slots].sort((a, b) => {
            return parseInt(a.code) - parseInt(b.code);
        });

        // Créer les éléments d'emplacement
        sortedSlots.forEach(slot => {
            const slotEl = document.createElement('div');
            slotEl.className = `quad-slot ${slot.status !== 'free' ? 'occupied' : ''}`;
            slotEl.title = `Emplacement ${slot.code} - ${slot.status}`;

            slotEl.innerHTML = `
                <div class="quad-slot-code">${slot.code}</div>
                <div class="quad-slot-status">${slot.status === 'free' ? 'Libre' : 'Occupé'}</div>
            `;

            // Événement clic
            slotEl.addEventListener('click', () => {
                console.log('Emplacement sélectionné:', slot.full_code);

                // Mettre en surbrillance
                container.querySelectorAll('.quad-slot').forEach(s => {
                    s.classList.remove('selected');
                });
                slotEl.classList.add('selected');

                // Afficher les articles si besoin
                if (slot.articles && slot.articles.length > 0) {
                    this.showSlotArticles(slot);
                }
            });

            container.appendChild(slotEl);
        });

        // Mettre à jour l'info
        document.getElementById('quadLevelInfo').textContent =
            `Étage ${level.code} - ${level.slots.length} emplacements`;
    }

    showSlotArticles(slot) {
        // Pourrait ouvrir un popup ou mettre à jour la sidebar
        console.log('Articles dans l\'emplacement:', slot.articles);

        // Exemple: mettre à jour la sidebar existante
        const sidebar = document.getElementById('slotContents');
        if (sidebar) {
            let html = `<h4>${slot.full_code}</h4>`;

            slot.articles.forEach(article => {
                html += `
                    <div class="article-item">
                        <div>${article.nom}</div>
                        <div>${article.stock_actuel} unités</div>
                    </div>
                `;
            });

            sidebar.innerHTML = html;
        }
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

    set3DAngle(angle) {
        // Implémentation pour changer l'angle de vue 3D
        console.log('Angle 3D changé à:', angle);
        // À implémenter selon vos besoins
    }

    reset3DView() {
        console.log('Vue 3D réinitialisée');
        if (window.vueStock) {
            this.draw3DView(window.vueStock.racks);
        }
    }

    updateInfoPanel(racks) {
        document.getElementById('racksCount').textContent = racks.length;

        if (this.selectedRack) {
            document.getElementById('selectedElement').textContent =
                `Rack ${this.selectedRack.code}`;
        } else if (this.selectedLevel) {
            document.getElementById('selectedElement').textContent =
                `Étage ${this.selectedLevel.code}`;
        }
    }

    // Méthodes pour la sélection
    selectRack(rack) {
        this.selectedRack = rack;
        this.selectedLevel = null;

        // Mettre à jour les vues
        if (window.vueStock) {
            this.drawFrontView(rack);
            this.updateAllViews(window.vueStock.racks);
        }

        // Si le rack a des niveaux, sélectionner le premier
        if (rack.levels && rack.levels.length > 0) {
            this.selectLevel(rack.levels[0]);
        }
    }

    selectLevel(level) {
        this.selectedLevel = level;
        this.updateLevelView(level);
    }
}


// vuestock.js - Version 1.0 - Structure de base
class VueStock {
    constructor() {
        this.currentView = 'plan'; // plan, rack, level
        this.selectedRack = null;
        this.selectedLevel = null;
        this.racks = []; // Stockage temporaire des étagères
        this.levels = []; // Stockage temporaire des étages
        this.slots = []; // Stockage temporaire des emplacements
        this.canvasManager = null;
        this.api = new ApiManager();

        // AJOUT pour QuadView
        this.quadViewManager = null;

        this.init();
    }

    init() {
        console.log('VueStock initialisé');

        // Initialisation des événements
        this.initEvents();

        // Chargement initial des données
        this.loadData();

        // Afficher la vue par défaut
        this.showView('plan');

        // Mettre à jour les statistiques
        this.updateStats();
    }

    // ===== GESTION DES VUES =====
    showView(viewName) {
        // Mettre à jour la vue courante
        this.currentView = viewName;

        // Masquer toutes les vues
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        // Afficher la vue demandée
        const viewElement = document.getElementById(`view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`);
        if (viewElement) {
            viewElement.classList.add('active');
        }

        // Mettre à jour le breadcrumb
        this.updateBreadcrumb();

        if (viewName === 'plan' && !this.canvasManager) {
            setTimeout(() => {
                this.initCanvas();
            }, 100);
        }

        // AJOUT : Initialiser la vue quad si on est en vue plan
        if (viewName === 'plan') {
            setTimeout(() => {
                this.initQuadView();
            }, 100);
        }
    }

    // AJOUT : Méthode pour initialiser la vue quad
    initQuadView() {
        // Initialiser le QuadViewManager seulement si on est en vue plan
        if (this.currentView === 'plan' && !this.quadViewManager) {
            setTimeout(() => {
                this.quadViewManager = new QuadViewManager();

                // Connecter les événements de sélection
                if (this.canvasManager) {
                    // Quand une étagère est sélectionnée dans le canvas
                    // (vous devrez peut-être ajouter un événement personnalisé)
                }

                // Mettre à jour les vues avec les données actuelles
                this.quadViewManager.updateAllViews(this.racks);
            }, 500);
        }
    }

    initCanvas() {
        // Initialiser le canvas manager
        window.canvasManager = new CanvasManager('canvasPlan', 'planOverlay');
        this.canvasManager = window.canvasManager;

        // Redessiner la grille
        setTimeout(() => {
            this.canvasManager.drawGrid();

            // Ajouter les racks déjà chargés
            this.racks.forEach(rack => {
                this.canvasManager.addRackToCanvas(rack);
            });
        }, 50);
    }

    // ===== GESTION DES VUES =====
    showView(viewName) {
        // Mettre à jour la vue courante
        this.currentView = viewName;

        // Masquer toutes les vues
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        // Afficher la vue demandée
        const viewElement = document.getElementById(`view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`);
        if (viewElement) {
            viewElement.classList.add('active');
        }

        // Mettre à jour le breadcrumb
        this.updateBreadcrumb();

        if (viewName === 'plan' && !this.canvasManager) {
            setTimeout(() => {
                this.initCanvas();
            }, 100);
        }
    }

    updateBreadcrumb() {
        const breadcrumb = document.getElementById('breadcrumb');
        breadcrumb.innerHTML = '';

        // Toujours le plan en premier
        const planItem = this.createBreadcrumbItem('Plan du stock', 'plan');
        breadcrumb.appendChild(planItem);

        // Si on est sur une étagère
        if (this.currentView === 'rack' && this.selectedRack) {
            breadcrumb.appendChild(this.createBreadcrumbSeparator());
            const rackItem = this.createBreadcrumbItem(
                `Étagère ${this.selectedRack.code}`,
                'rack',
                false // pas cliquable car on y est déjà
            );
            breadcrumb.appendChild(rackItem);
        }

        // Si on est sur un étage
        if (this.currentView === 'level' && this.selectedRack && this.selectedLevel) {
            breadcrumb.appendChild(this.createBreadcrumbSeparator());
            const rackItem = this.createBreadcrumbItem(
                `Étagère ${this.selectedRack.code}`,
                'rack',
                true // cliquable pour revenir
            );
            breadcrumb.appendChild(rackItem);

            breadcrumb.appendChild(this.createBreadcrumbSeparator());
            const levelItem = this.createBreadcrumbItem(
                `Étage ${this.selectedLevel.code}`,
                'level',
                false
            );
            breadcrumb.appendChild(levelItem);
        }
    }

    createBreadcrumbItem(text, view, clickable = true) {
        const span = document.createElement('span');
        span.className = `breadcrumb-item ${!clickable ? 'active' : ''}`;
        span.textContent = text;
        span.dataset.view = view;

        if (clickable) {
            span.style.cursor = 'pointer';
            span.addEventListener('click', () => {
                if (view === 'rack') {
                    this.showView('rack');
                } else if (view === 'plan') {
                    this.showView('plan');
                }
            });
        }

        return span;
    }

    createBreadcrumbSeparator() {
        const span = document.createElement('span');
        span.className = 'breadcrumb-separator';
        span.textContent = '›';
        return span;
    }

    // ===== NAVIGATION ENTRE VUES =====
    goToRackView(rack) {
        this.selectedRack = rack;
        this.selectedLevel = null;

        // Mettre à jour le titre
        document.getElementById('rackTitle').textContent = rack.code;
        document.getElementById('rackCodeInput').value = rack.code;

        // Charger les étages de cette étagère
        this.loadLevelsForRack(rack.id);

        // Afficher la vue
        this.showView('rack');
    }

    goToLevelView(level) {
        this.selectedLevel = level;

        // Mettre à jour les titres
        document.getElementById('levelTitle').textContent = level.code;
        document.getElementById('levelRackTitle').textContent = this.selectedRack.code;
        document.getElementById('levelCodeInput').value = level.code;

        // Charger les emplacements de cet étage
        this.loadSlotsForLevel(level.id);

        // Afficher la vue
        this.showView('level');
    }

    // ===== GESTION DES ÉTAGÈRES =====
    async addRack(rackData) {
        console.log('🟢 [VueStock.addRack] Called with:', rackData);

        try {
            const payload = {
                code: rackData.code,
                name: rackData.name || `Étagère ${rackData.code}`,
                position_x: rackData.x || rackData.position_x,
                position_y: rackData.y || rackData.position_y,
                rotation: rackData.rotation || 0,
                width: rackData.width,
                depth: rackData.depth,
                color: rackData.color
            };

            console.log('🟢 Payload pour API:', payload);

            const result = await this.api.saveRack(payload);

            if (result.success && result.data) {
                const newRack = {
                    id: result.data.id,
                    code: result.data.rack_code || result.data.code,
                    name: result.data.display_name || result.data.name,
                    position_x: result.data.position_x,
                    position_y: result.data.position_y,
                    rotation: result.data.rotation,
                    width: result.data.width,
                    depth: result.data.depth,
                    color: result.data.color,
                    levels: []
                };

                // CORRECTION : Vérifier si l'étagère existe déjà
                const existingIndex = this.racks.findIndex(r => r.id === newRack.id);
                if (existingIndex === -1) {
                    // Nouvelle étagère
                    this.racks.push(newRack);
                } else {
                    // Mise à jour
                    this.racks[existingIndex] = newRack;
                }

                // Dessiner sur le canvas UNE SEULE FOIS
                if (this.currentView === 'plan' && this.canvasManager) {
                    // Supprimer l'ancien élément si existe
                    const oldElement = document.querySelector(`[data-rack-id="${newRack.id}"]`);
                    if (oldElement) {
                        oldElement.remove();
                    }

                    // Ajouter le nouvel élément UNE FOIS
                    this.canvasManager.addRackToCanvas(newRack);
                }

                this.updateStats();
                this.showNotification(`Étagère ${newRack.code} créée`);

                return newRack;
            }

        } catch (error) {
            console.error('❌ Erreur lors de la sauvegarde:', error);
            this.showNotification('Erreur: ' + error.message, 'error');
        }
    }

    drawRackOnCanvas(rack) {
        // Au lieu de créer manuellement l'élément, utiliser CanvasManager
        if (this.canvasManager) {
            this.canvasManager.addRackToCanvas(rack);
        } else {
            // Fallback si canvasManager pas encore initialisé
            console.log('CanvasManager non initialisé, étagère mise en attente:', rack);
        }
    }

    // ===== GESTION DES ÉTAGES (incréments de 10) =====
    async addLevelToRack(rackId, levelCode = null) {
        // Vérifier si une opération est déjà en cours
        if (this._addingLevel) {
            console.log('⚠️ Opération d\'ajout d\'étage déjà en cours');
            return;
        }

        this._addingLevel = true;

        try {
            const rack = this.racks.find(r => r.id === rackId);
            if (!rack) return;

            // Si pas de code spécifié, trouver le prochain multiple de 10
            if (!levelCode) {
                const existingCodes = rack.levels.map(l => parseInt(l.code)).filter(n => !isNaN(n));
                const maxCode = existingCodes.length > 0 ? Math.max(...existingCodes) : 0;
                levelCode = (Math.floor(maxCode / 10) * 10) + 10;
            }

            // Vérifier si ce niveau existe déjà (avant l'appel API)
            const levelExists = rack.levels.some(l => l.code === levelCode.toString());
            if (levelExists) {
                this.showNotification(`L'étage ${levelCode} existe déjà`, 'warning');
                return;
            }

            // Appeler l'API UNE SEULE FOIS
            console.log('📤 Appel API save-level avec:', { rack_id: rackId, level_code: levelCode });

            const result = await this.api.saveLevel({
                rack_id: rackId,
                level_code: levelCode.toString(),
                display_order: rack.levels.length + 1
            });

            if (result.success && result.data) {
                const newLevel = {
                    id: result.data.id,
                    code: result.data.level_code,
                    rack_id: rackId,
                    display_order: result.data.display_order,
                    slots: []
                };

                rack.levels.push(newLevel);

                // Afficher dans la vue étagère
                this.displayLevelInRackView(newLevel);

                this.updateStats();
                this.showNotification(`Étage ${levelCode} ajouté à l'étagère ${rack.code}`);

                return newLevel;
            }
        } catch (error) {
            console.error('Erreur lors de l\'ajout de l\'étage:', error);
            this.showNotification('Erreur: ' + error.message, 'error');

            // Afficher l'erreur spécifique dupliquée
            if (error.message.includes('duplicate') || error.message.includes('409')) {
                this.showNotification(`L'étage ${levelCode} existe déjà dans cette étagère`, 'error');
            }
        } finally {
            // Toujours débloquer à la fin
            this._addingLevel = false;
        }
    }

    displayLevelInRackView(level) {
        const rackContainer = document.getElementById('rackContainer');

        // Retirer l'état vide s'il existe
        const emptyState = rackContainer.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }

        // Créer l'élément d'étage
        const levelElement = document.createElement('div');
        levelElement.className = 'rack-level';
        levelElement.dataset.levelId = level.id;

        levelElement.innerHTML = `
            <div class="rack-level-header">
                <div class="level-number">${level.code}</div>
                <div class="level-info">
                    <h4>Étage ${level.code}</h4>
                    <div class="level-slots">
                        ${level.slots.length} emplacement(s)
                    </div>
                </div>
            </div>
            <div class="level-actions">
                <button class="btn btn-sm" title="Configurer">
                    <i class="fas fa-cog"></i>
                </button>
                <button class="btn btn-sm btn-primary" title="Voir les emplacements">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        `;

        // Ajouter l'événement pour aller à la vue étage
        const viewBtn = levelElement.querySelector('.btn-primary');
        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.goToLevelView(level);
        });

        rackContainer.appendChild(levelElement);
    }

    async addSlotToLevel(levelId, slotCode = null, count = 1) {
        // Protection contre les clics multiples
        if (this._addingSlot) {
            console.log('⚠️ Opération d\'ajout d\'emplacement déjà en cours');
            return;
        }

        this._addingSlot = true;

        try {
            const rack = this.racks.find(r => r.levels.some(l => l.id === levelId));
            const level = rack?.levels.find(l => l.id === levelId);
            if (!level) return;

            const slots = [];

            for (let i = 0; i < count; i++) {
                // Si pas de code spécifié, trouver le prochain multiple de 10
                let currentSlotCode;
                if (!slotCode) {
                    const existingCodes = level.slots.map(s => parseInt(s.code)).filter(n => !isNaN(n));
                    const maxCode = existingCodes.length > 0 ? Math.max(...existingCodes) : 0;
                    currentSlotCode = (Math.floor(maxCode / 10) * 10) + 10 + (i * 10);
                } else {
                    currentSlotCode = parseInt(slotCode) + (i * 10);
                }

                // Vérifier si cet emplacement existe déjà
                const slotExists = level.slots.some(s => s.code === currentSlotCode.toString());
                if (slotExists) {
                    console.log(`⚠️ Emplacement ${currentSlotCode} existe déjà`);
                    continue; // Passer au suivant
                }

                try {
                    // Appeler l'API pour sauvegarder l'emplacement
                    console.log(`📤 Appel save-slot pour: ${currentSlotCode}`);

                    const result = await this.api.saveSlot({
                        level_id: levelId,
                        slot_code: currentSlotCode.toString(),
                        display_order: level.slots.length + i + 1,
                        status: 'free'
                    });

                    if (result.success && result.data) {
                        const newSlot = {
                            id: result.data.id,
                            code: currentSlotCode.toString(),
                            level_id: levelId,
                            display_order: result.data.display_order,
                            full_code: `${rack.code}-${level.code}-${currentSlotCode}`,
                            status: 'free',
                            articles: []
                        };

                        level.slots.push(newSlot);
                        slots.push(newSlot);
                    }
                } catch (error) {
                    console.error(`Erreur pour l'emplacement ${currentSlotCode}:`, error);
                    // Continuer avec les autres emplacements
                    if (error.message.includes('duplicate') || error.message.includes('409')) {
                        console.log(`L'emplacement ${currentSlotCode} existe déjà`);
                    }
                }
            }

            // Afficher dans la vue étage
            if (slots.length > 0) {
                this.displaySlotsInLevelView(slots);
                this.updateStats();
                this.showNotification(`${slots.length} emplacement(s) ajouté(s) à l'étage ${level.code}`);
            }

            return slots;
        } finally {
            this._addingSlot = false;
        }
    }

    displaySlotsInLevelView(slots) {
        const levelContainer = document.getElementById('levelContainer');

        // Retirer l'état vide s'il existe
        const emptyState = levelContainer.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }

        // Ajouter chaque emplacement
        slots.forEach(slot => {
            const slotElement = document.createElement('div');
            slotElement.className = 'slot-item';
            slotElement.dataset.slotId = slot.id;

            // Déterminer la classe en fonction du statut
            if (slot.articles && slot.articles.length > 0) {
                const totalQty = slot.articles.reduce((sum, art) => sum + art.quantity, 0);
                slotElement.classList.add(totalQty >= 10 ? 'full' : 'occupied');
            }

            slotElement.innerHTML = `
                <div class="slot-code">${slot.code}</div>
                <div class="slot-status">
                    ${slot.articles && slot.articles.length > 0 ? 'Occupé' : 'Libre'}
                </div>
            `;

            // Au clic, afficher les articles dans la sidebar
            slotElement.addEventListener('click', () => {
                this.displaySlotContents(slot);

                // Animation de sélection
                document.querySelectorAll('.slot-item').forEach(s => {
                    s.classList.remove('selected');
                });
                slotElement.classList.add('selected');
            });

            levelContainer.appendChild(slotElement);
        });
    }

    // ===== AFFICHAGE DU CONTENU D'UN EMPLACEMENT =====
    displaySlotContents(slot) {
        const contentsDiv = document.getElementById('slotContents');

        if (!slot.articles || slot.articles.length === 0) {
            contentsDiv.innerHTML = `
                <div class="empty-slot">
                    <i class="fas fa-box-open fa-2x"></i>
                    <p>Emplacement vide</p>
                    <button class="btn btn-sm btn-success">
                        <i class="fas fa-plus"></i> Ajouter un article
                    </button>
                </div>
            `;
            return;
        }

        let html = `<h4>Emplacement ${slot.full_code}</h4>`;

        slot.articles.forEach(article => {
            html += `
                <div class="article-item">
                    <div class="article-header">
                        <span class="article-name">${article.name}</span>
                        <span class="article-qty">${article.quantity} unités</span>
                    </div>
                    <div class="article-actions">
                        <button class="btn btn-xs" title="Augmenter">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="btn btn-xs" title="Diminuer">
                            <i class="fas fa-minus"></i>
                        </button>
                        <button class="btn btn-xs btn-danger" title="Supprimer">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        contentsDiv.innerHTML = html;
    }

    // ===== STATISTIQUES =====
    updateStats() {
        // Compter les étagères
        const rackCount = this.racks.length;

        // Compter les étages totaux
        const levelCount = this.racks.reduce((sum, rack) => sum + rack.levels.length, 0);

        // Compter les emplacements totaux
        const slotCount = this.racks.reduce((sum, rack) =>
            sum + rack.levels.reduce((levelSum, level) => levelSum + level.slots.length, 0), 0);

        // Mettre à jour l'interface
        document.getElementById('statRacks').textContent = rackCount;
        document.getElementById('statLevels').textContent = levelCount;
        document.getElementById('statSlots').textContent = slotCount;

        // Pour l'occupation, on ferait une requête API
        document.getElementById('statOccupation').textContent = '0%';
    }

    // ===== NOTIFICATIONS =====
    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        const text = document.getElementById('notificationText');

        // Changer la couleur selon le type
        if (type === 'error') {
            notification.style.background = 'var(--danger-color)';
        } else if (type === 'warning') {
            notification.style.background = 'var(--warning-color)';
        } else {
            notification.style.background = 'var(--success-color)';
        }

        text.textContent = message;
        notification.classList.add('show');

        // Masquer après 3 secondes
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // ===== CHARGEMENT DES DONNÉES =====
    async loadData() {
        this.showLoader(true);

        try {
            // Attendre 2 secondes pour laisser Netlify répondre
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Essayer l'API
            const result = await this.api.getFullConfig();

            if (result.success && result.data) {
                // Charger les étagères avec leurs niveaux et emplacements
                this.racks = result.data.racks || result.data;

                // Si l'API retourne directement les étagères avec leurs niveaux
                if (result.data.levels) {
                    // Associer les niveaux aux étagères
                    this.racks.forEach(rack => {
                        rack.levels = result.data.levels
                            .filter(level => level.rack_id === rack.id)
                            .map(level => ({
                                ...level,
                                code: level.level_code,
                                slots: result.data.slots
                                    ?.filter(slot => slot.level_id === level.id)
                                    .map(slot => ({
                                        ...slot,
                                        code: slot.slot_code
                                    })) || []
                            }));
                    });
                }

                this.displayRacksFromAPI();
                this.showNotification('Données chargées depuis Netlify Function');
            }

        } catch (error) {
            console.log('API non disponible (déploiement en cours)');
            // Ne pas afficher d'erreur, juste continuer
            this.updateStats();
        } finally {
            this.showLoader(false);
        }
    }

    displayRacksFromAPI() {
    // Nettoyer le canvas
        const overlay = document.getElementById('planOverlay');
        if (overlay) overlay.innerHTML = '';

        // Tableau temporaire pour éviter doublons
        const racksMap = {};

        this.racks.forEach(rack => {
            // Normaliser les données API
            const rackData = {
                id: rack.id,
                code: rack.rack_code || rack.code,
                name: rack.display_name || rack.name,
                position_x: rack.position_x || 100,
                position_y: rack.position_y || 100,
                rotation: rack.rotation || 0,
                width: rack.width || 3,
                depth: rack.depth || 2,
                color: rack.color || '#4a90e2',
                levels: rack.levels || []
            };

            // Éviter les doublons via id
            if (!racksMap[rackData.id]) {
                racksMap[rackData.id] = rackData;

                // Ajouter au canvas
                if (this.canvasManager) {
                    this.canvasManager.addRackToCanvas(rackData);
                }
            }
        });

        // Remplacer le tableau interne par la version unique
        this.racks = Object.values(racksMap);

        // Mettre à jour les stats
        this.updateStats();
    }


    showLoader(show) {
        const loader = document.getElementById('loaderOverlay');
        if (show) {
            loader.classList.add('active');
        } else {
            loader.classList.remove('active');
        }
    }

    // ===== GESTION DES ÉVÉNEMENTS =====
    initEvents() {
        // Navigation entre vues
        document.getElementById('backToPlan')?.addEventListener('click', () => {
            this.showView('plan');
        });

        document.getElementById('backToRack')?.addEventListener('click', () => {
            this.showView('rack');
        });

        // Bouton Ajouter étagère - CORRIGÉ
        document.getElementById('btnAddRack').addEventListener('click', () => {
            this.openRackModal(); // Appel direct, pas via window
        });

        // Bouton Ajouter étage
        document.getElementById('btnAddLevel')?.addEventListener('click', () => {
            if (this.selectedRack) {
                this.addLevelToRack(this.selectedRack.id);
            }
        });

        document.getElementById('btnAddFirstLevel')?.addEventListener('click', () => {
            if (this.selectedRack) {
                this.addLevelToRack(this.selectedRack.id);
            }
        });

        // Bouton Ajouter emplacement
        document.getElementById('btnAddSlot')?.addEventListener('click', () => {
            if (this.selectedLevel) {
                this.addSlotToLevel(this.selectedLevel.id);
            }
        });

        document.getElementById('btnAddFirstSlot')?.addEventListener('click', () => {
            if (this.selectedLevel) {
                this.addSlotToLevel(this.selectedLevel.id);
            }
        });

        // Génération automatique d'étages
        document.getElementById('btnAutoLevels')?.addEventListener('click', () => {
            if (this.selectedRack) {
                // Générer les étages 10, 20, 30, 40, 50
                for (let i = 1; i <= 5; i++) {
                    this.addLevelToRack(this.selectedRack.id, (i * 10).toString());
                }
            }
        });

        // Génération automatique d'emplacements
        document.getElementById('btnAutoSlots')?.addEventListener('click', () => {
            if (this.selectedLevel) {
                // Générer les emplacements 10 à 100 par pas de 10
                for (let i = 1; i <= 10; i++) {
                    this.addSlotToLevel(this.selectedLevel.id, (i * 10).toString());
                }
            }
        });

        // Recherche d'article
        document.getElementById('btnSearch')?.addEventListener('click', () => {
            this.searchArticle();
        });

        document.getElementById('searchArticle')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchArticle();
            }
        });

        // Sauvegarde
        document.getElementById('btnSave')?.addEventListener('click', () => {
            this.saveData();
        });

        // Modal étagère
        this.initModalEvents();
    }

    initModalEvents() {
        const modal = document.getElementById('rackModal');
        const overlay = document.getElementById('modalOverlay');

        // CORRECTION : Définir openRackModal comme méthode de VueStock
        this.openRackModal = (rack = null) => {
            if (rack) {
                // Mode édition
                document.getElementById('modalRackCode').value = rack.code;
                document.getElementById('modalRackName').value = rack.name;
                document.getElementById('modalRackWidth').value = rack.width;
                document.getElementById('modalRackDepth').value = rack.depth;
                document.getElementById('modalRackColor').value = rack.color;
            } else {
                // Mode création
                document.getElementById('rackForm').reset();
                // Suggérer un code d'étagère
                const nextCode = String.fromCharCode(65 + this.racks.length); // A, B, C...
                document.getElementById('modalRackCode').value = nextCode;
            }

            overlay.classList.add('active');
        };

        // Exposer aussi sur window pour les boutons dans CanvasManager
        window.openRackModal = (rack = null) => {
            this.openRackModal(rack);
        };

        // Fermer modal
        document.getElementById('closeRackModal')?.addEventListener('click', () => {
            overlay.classList.remove('active');
        });

        document.getElementById('cancelRackModal')?.addEventListener('click', () => {
            overlay.classList.remove('active');
        });

        overlay?.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });

        // Sauvegarder
        document.getElementById('saveRackModal')?.addEventListener('click', async () => {
            const code = document.getElementById('modalRackCode').value.trim();
            const name = document.getElementById('modalRackName').value.trim();
            const width = parseInt(document.getElementById('modalRackWidth').value);
            const depth = parseInt(document.getElementById('modalRackDepth').value);
            const color = document.getElementById('modalRackColor').value;

            if (!code) {
                this.showNotification('Le code étagère est requis', 'error');
                return;
            }

            const codeExists = this.racks.some(r => r.code === code);
            if (codeExists) {
                this.showNotification(`Le code ${code} existe déjà`, 'error');
                return;
            }

            // Création de l'étagère
            const newRack = await this.addRack({
                code,
                name: name || `Étagère ${code}`,
                x: 100 + (this.racks.length * 150),
                y: 100,
                width: width || 3,
                depth: depth || 2,
                color: color || '#4a90e2'
            });

            // Fermer le modal
            document.getElementById('modalOverlay').classList.remove('active');

            // Ajouter au canvas si on est en vue plan
            if (this.currentView === 'plan' && this.canvasManager && newRack) {
                this.canvasManager.addRackToCanvas(newRack);
            }
        });
    }

    // ===== VUE 3D =====
    open3DView = async () => {
        console.log('Ouverture de la vue 3D');
        const modal3D = document.getElementById('modal3D');

        modal3D.classList.add('active');
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!window.vueStock3D) {
            window.vueStock3D = new VueStock3D();
            await window.vueStock3D.init();
        }
    }

    // ===== RECHERCHE D'ARTICLE =====
    async searchArticle() {
        const searchTerm = document.getElementById('searchArticle').value.trim();
        if (!searchTerm) return;

        this.showLoader(true);

        try {
            // Rechercher via l'API
            const results = await this.api.searchArticles(searchTerm);

            if (results.length > 0) {
                // Prendre le premier résultat pour la démonstration
                const article = results[0];

                if (article.full_code) {
                    // ✅ NOUVEAU : Proposer d'ouvrir la vue 3D
                    const open3D = confirm(`Article trouvé dans ${article.full_code}\n\nOuvrir la vue 3D pour localiser l'article ?`);

                    if (open3D) {
                        // Ouvrir la vue 3D (fonction globale)
                        await open3DView();

                        // Si vous voulez localiser l'article, ajoutez ceci :
                        // if (window.vueStock3D?.locateArticle) {
                        //     window.vueStock3D.locateArticle(article.full_code);
                        // }
                    } else {
                        // Comportement classique (2D)
                        this.highlightSlotByFullCode(article.full_code);
                    }

                    this.showNotification(`Article trouvé dans ${article.full_code}`);
                } else {
                    this.showNotification('Article trouvé mais non stocké', 'warning');
                }
            } else {
                this.showNotification('Aucun article trouvé', 'warning');
            }

        } catch (error) {
            console.error('Erreur de recherche:', error);
            this.showNotification('Erreur de recherche: ' + error.message, 'error');
        } finally {
            this.showLoader(false);
        }
    }

    // ✅ NOUVELLE MÉTHODE : Ouvrir la 3D et localiser
    open3DAndLocate(fullCode) {
        console.log('🎯 Localisation 3D pour:', fullCode);

        // Extraire rack, level, slot du code (ex: "A-10-20")
        const parts = fullCode.split('-');
        if (parts.length !== 3) {
            console.error('Format de code invalide:', fullCode);
            return;
        }

        const [rackCode, levelCode, slotCode] = parts;

        // Trouver l'étagère
        const rack = this.racks.find(r => r.code === rackCode);
        if (!rack) {
            console.error('Étagère non trouvée:', rackCode);
            return;
        }

        // Trouver l'étage
        const level = rack.levels?.find(l => l.code === levelCode);
        if (!level) {
            console.error('Étage non trouvé:', levelCode);
            return;
        }

        // Trouver l'emplacement
        const slot = level.slots?.find(s => s.code === slotCode);
        if (!slot) {
            console.error('Emplacement non trouvé:', slotCode);
            return;
        }

        // Ouvrir le modal 3D
        const modal3D = document.getElementById('modal3D');
        modal3D.classList.add('active');

        // Initialiser la vue 3D si nécessaire
        if (!window.view3DManager) {
            window.view3DManager = new View3DManager();
            window.view3DManager.init();

            // Attendre que la 3D soit chargée
            setTimeout(() => {
                window.view3DManager.locateAndHighlight(rack, level, slot);
            }, 500);
        } else {
            window.view3DManager.locateAndHighlight(rack, level, slot);
        }
    }

    highlightSlotByFullCode(fullCode) {
        // Extraire les parties du code: A-10-20
        const parts = fullCode.split('-');
        if (parts.length !== 3) return;

        const [rackCode, levelCode, slotCode] = parts;

        // Trouver l'étagère
        const rack = this.racks.find(r => r.code === rackCode);
        if (!rack) return;

        // Aller à la vue étagère
        this.goToRackView(rack);

        // Trouver l'étage
        const level = rack.levels?.find(l => l.level_code === levelCode);
        if (!level) return;

        // Aller à la vue étage
        setTimeout(() => {
            this.goToLevelView(level);

            // Mettre en surbrillance l'emplacement
            setTimeout(() => {
                const slotElement = document.querySelector(`[data-slot-code="${slotCode}"]`);
                if (slotElement) {
                    slotElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    slotElement.classList.add('highlight', 'pulse');

                    setTimeout(() => {
                        slotElement.classList.remove('highlight', 'pulse');
                    }, 2000);
                }
            }, 500);
        }, 500);
    }

    // ===== SAUVEGARDE DES DONNÉES =====
    async saveData() {
        this.showLoader(true);

        try {
            // Sauvegarder uniquement si nécessaire
            // Ici, vous pouvez décider de sauvegarder les modifications
            // ou simplement ne rien faire car chaque étagère est sauvegardée individuellement

            // Option : Sauvegarder toutes les étagères modifiées
            let savedCount = 0;

            for (const rack of this.racks) {
                // Vérifier si l'étagère a été modifiée
                // Pour simplifier, on sauvegarde tout
                try {
                    await this.api.saveRack({
                        id: rack.id, // Inclure l'ID pour mise à jour
                        code: rack.code,
                        name: rack.name,
                        position_x: rack.position_x,
                        position_y: rack.position_y,
                        rotation: rack.rotation || 0,
                        width: rack.width,
                        depth: rack.depth,
                        color: rack.color
                    });
                    savedCount++;
                } catch (error) {
                    console.error(`Erreur pour étagère ${rack.code}:`, error);
                }
            }

            this.showNotification(`${savedCount} étagère(s) sauvegardée(s)`);

        } catch (error) {
            console.error('Erreur de sauvegarde:', error);
            this.showNotification('Erreur lors de la sauvegarde: ' + error.message, 'error');
        } finally {
            this.showLoader(false);
        }
    }

    // ===== CHARGEMENT DES NIVEAUX POUR UNE ÉTAGÈRE =====
    loadLevelsForRack(rackId) {
        const rack = this.racks.find(r => r.id === rackId);
        if (!rack) return;

        const rackContainer = document.getElementById('rackContainer');
        rackContainer.innerHTML = '';

        if (rack.levels.length === 0) {
            rackContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-th-large fa-3x"></i>
                    <p>Aucun étage configuré</p>
                    <button class="btn btn-primary" id="btnAddFirstLevel">
                        Ajouter le premier étage
                    </button>
                </div>
            `;

            // Re-binder l'événement
            document.getElementById('btnAddFirstLevel').addEventListener('click', () => {
                this.addLevelToRack(rackId);
            });
        } else {
            rack.levels.forEach(level => {
                this.displayLevelInRackView(level);
            });
        }
    }

    // ===== CHARGEMENT DES EMPLACEMENTS POUR UN ÉTAGE =====
    loadSlotsForLevel(levelId) {
        const rack = this.racks.find(r => r.levels.some(l => l.id === levelId));
        const level = rack?.levels.find(l => l.id === levelId);
        if (!level) return;

        const levelContainer = document.getElementById('levelContainer');
        levelContainer.innerHTML = '';

        if (level.slots.length === 0) {
            levelContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box-open fa-3x"></i>
                    <p>Aucun emplacement configuré</p>
                    <button class="btn btn-primary" id="btnAddFirstSlot">
                        Ajouter le premier emplacement
                    </button>
                </div>
            `;

            // Re-binder l'événement
            document.getElementById('btnAddFirstSlot').addEventListener('click', () => {
                this.addSlotToLevel(levelId);
            });
        } else {
            this.displaySlotsInLevelView(level.slots);
        }
    }

    refreshEventListeners() {
        // Cette méthode peut être appelée si les événements ne fonctionnent pas
        console.log('Rafraîchissement des événements...');

        // Réinitialiser les événements du canvas
        if (this.canvasManager) {
            // Recréer le canvas manager
            this.canvasManager = new CanvasManager('canvasPlan', 'planOverlay');
            window.canvasManager = this.canvasManager;

            // Redessiner tout
            setTimeout(() => {
                this.canvasManager.drawGrid();
                this.racks.forEach(rack => {
                    this.canvasManager.addRackToCanvas(rack);
                });
            }, 100);
        }
    }

    loadTestData() {
        console.log('Chargement des données de test');

        // Données de test
        const testRack = {
            id: 1,
            code: 'A',
            name: 'Étagère principale A',
            position_x: 200,
            position_y: 200,
            width: 3,
            depth: 2,
            color: '#4a90e2',
            levels: [
                {
                    id: 1,
                    level_code: '10',
                    display_order: 1,
                    slots: [
                        {
                            id: 1,
                            slot_code: '10',
                            full_code: 'A-10-10',
                            status: 'occupied',
                            capacity: 100
                        },
                        {
                            id: 2,
                            slot_code: '20',
                            full_code: 'A-10-20',
                            status: 'free',
                            capacity: 100
                        }
                    ]
                }
            ]
        };

        this.racks = [testRack];

        // Afficher sur le canvas
        if (this.canvasManager) {
            this.canvasManager.addRackToCanvas(testRack);
        }

        this.updateStats();
        this.showNotification('Données de test chargées', 'warning');
    }
}

// ===== INITIALISATION AU CHARGEMENT =====
document.addEventListener('DOMContentLoaded', () => {
    window.vueStock = new VueStock();
});

document.addEventListener('DOMContentLoaded', () => {
    window.vueStock = new VueStock();

    // Initialiser la vue quad après un délai
    setTimeout(() => {
        if (window.vueStock.quadViewManager) {
            window.vueStock.quadViewManager.updateAllViews(window.vueStock.racks);
        }
    }, 1000);
});