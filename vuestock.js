// ===== CONFIGURACIÓN DEBUG =====
const DEBUG = {
    enabled: true,
    quadView: false,    // Cambiar a false para desactivar logs QuadView
    canvas: false,      // Cambiar a false para desactivar logs Canvas
    api: true,          // Mantener true para errores API
    clics: false        // Cambiar a false para desactivar logs clics
};

// Función auxiliar para logs
function debugLog(category, ...args) {
    if (DEBUG.enabled && DEBUG[category]) {
        console.log(`[${category}]`, ...args);
    }
}

// ===== DEPURACIÓN =====
console.log('vuestock.js cargado');

// Verificar que todos los elementos DOM existen
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM cargado');

    const requiredElements = [
        'btnAddRack', 'canvasPlan', 'planOverlay',
        'rackModal', 'modalOverlay'
    ];

    requiredElements.forEach(id => {
        const el = document.getElementById(id);
        console.log(`${id}:`, el ? 'OK' : 'FALTANTE');
    });
});

// ===== CLASE API MANAGER PARA NETLIFY =====
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
        // Con Netlify Functions, el endpoint ya incluye '/.netlify/functions/'
        const url = `${this.baseUrl}${endpoint}`;
        console.log('📡 Llamada API (Netlify):', url, method, data);

        console.log('Prueba esta URL:', url);

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

            console.log('📡 Estado respuesta:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('📡 Datos respuesta:', result);

            if (result.error) {
                throw new Error(result.error);
            }

            return result;

        } catch (error) {
            console.error('❌ Solicitud API fallida:', error);
            throw error;
        }
    }

    // Métodos específicos
    async getFullConfig() {
        return await this.request(this.endpoints.getConfig);
    }

    async saveRack(rackData) {
        return await this.request(this.endpoints.saveRack, 'POST', rackData);
    }

    async deleteRack(rackId) {
        // ✅ El ID debe estar en la URL, no en el body
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


// ===== CLASE CANVAS MANAGER =====
class CanvasManager {
    constructor(canvasId, overlayId) {
        // Bind explícito de TODOS los métodos
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

        // Inicializar propiedades
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById(overlayId);

        // Configuración
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

        // Estado del ratón
        this.mouseX = 0;
        this.mouseY = 0;
        this.gridX = 0;
        this.gridY = 0;

        // Variables para drag/resize/rotate
        this.currentRack = null;
        this.currentElement = null;
        this.resizeHandle = null;
        this.resizeStartData = null;
        this.rotateStartData = null;

        // Guardado automático
        this.saveTimeout = null;
        this.racks = [];

        // Inicialización
        this.initCanvas();
        this.drawGrid();
        this.initEvents();
    }

    // === MÉTODOS ===
    drawGrid() {
        if (!this.ctx || !this.canvas) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const width = this.canvas.width;
        const height = this.canvas.height;
        const gridSize = this.gridSize * this.scale;

        // Calcular posiciones de inicio con el offset
        const startX = -this.offsetX % gridSize;
        const startY = -this.offsetY % gridSize;

        // Dibujar la cuadrícula
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.lineWidth = 1;

        // Líneas verticales
        for (let x = startX; x < width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }

        // Líneas horizontales
        for (let y = startY; y < height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }

        // Puntos de cuadrícula cada 4 casillas
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        for (let x = startX; x < width; x += gridSize * 4) {
            for (let y = startY; y < height; y += gridSize * 4) {
                this.ctx.beginPath();
                this.ctx.arc(x, y, 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        // Actualizar coordenadas mostradas
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

    // === MÉTODOS PARA LAS ESTANTERÍAS ===
    addRackToCanvas(rack) {
        debugLog('canvas', 'addRackToCanvas llamado para estantería:', rack.id, rack.code);

        // Verificar si la estantería ya existe
        const existingElement = this.overlay.querySelector(`[data-rack-id="${rack.id}"]`);
        if (existingElement) {
            existingElement.remove();
            this.racks = this.racks.filter(item => item.rack.id !== rack.id);
        }

        // Crear elemento DOM
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

        // Añadir asas
        this.addRackHandles(rackElement, rack);

        // Eventos
        rackElement.addEventListener('mousedown', (e) => {
            this.startRackDrag(e, rack, rackElement);
        });

        rackElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectRack(rack, rackElement);
        });

        this.overlay.appendChild(rackElement);
        this.racks.push({ rack, element: rackElement });

        // Auto-selección para nuevas estanterías
        if (!rack.id || rack.id.toString().includes('new')) {
            setTimeout(() => {
                this.selectRack(rack, rackElement);
            }, 100);
        }
    }

    addRackHandles(rackElement, rack) {
        // Asas de redimensionamiento
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

        // Asa de rotación
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

        // Dimensiones
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
        // ✅ AÑADA ESTO PRIMERO
        // Si la herramienta delete está activa, eliminar directamente
        if (this.currentTool === 'delete') {
            if (confirm('¿Eliminar esta estantería y todos sus niveles/huecos?')) {
                this.deleteRack(rack.id);
            }
            return; // No continuar
        }

        // Verificar si se hace clic en un asa
        const handle = e.target.closest('.rack-handle, .rotate-handle');
        if (handle) {
            if (handle.classList.contains('rotate-handle')) {
                this.startRotation(e, rack, element);
            } else {
                this.startResize(e, rack, element, handle);
            }
            return;
        }

        // Permitir movimiento con herramientas "move" y "select"
        if (this.currentTool !== 'move' && this.currentTool !== 'select') {
            return;
        }

        // Si no, movimiento normal
        this.isDragging = true; // ← Primera vez
        this.currentRack = rack;
        this.currentElement = element;
        this.dragStartX = e.clientX - rack.position_x;
        this.dragStartY = e.clientY - rack.position_y;

        // Seleccionar la estantería
        this.selectRack(rack, element);
        // this.isDragging = true; ← ❌ ELIMINE ESTA LÍNEA (duplicado)

        // Añadir eventos globales
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
    }

    dragRack(e) {
        if (!this.isDragging || !this.currentRack || !this.currentElement) return;

        let newX = e.clientX - this.dragStartX;
        let newY = e.clientY - this.dragStartY;

        // ✅ CORRECCIÓN: Usar tamaño de cuadrícula Quad (20px) en lugar de Canvas (40px)
        const gridSize = 20; // Tamaño de cuadrícula en QuadView
        newX = Math.round(newX / gridSize) * gridSize;
        newY = Math.round(newY / gridSize) * gridSize;

        // ✅ CORRECCIÓN: Calcular límites CON el scale
        const scale = this.topViewScale || 1;
        const canvasWidth = this.canvasTop.width / scale;  // Ancho real con scale
        const canvasHeight = this.canvasTop.height / scale; // Alto real con scale

        const rackWidth = this.currentRack.displayWidth;
        const rackHeight = this.currentRack.displayHeight;

        // ✅ Permitir movimiento en TODO el ancho
        newX = Math.max(0, Math.min(newX, canvasWidth - rackWidth));
        newY = Math.max(0, Math.min(newY, canvasHeight - rackHeight));

        // Actualizar
        this.currentRack.position_x = newX;
        this.currentRack.position_y = newY;
        this.currentElement.style.left = `${newX}px`;
        this.currentElement.style.top = `${newY}px`;

        this.updatePropertiesPanel(this.currentRack);
    }

    selectRack(rack, element) {
        // Deseleccionar todas las demás
        document.querySelectorAll('.rack-on-plan').forEach(el => {
            el.classList.remove('selected');
            el.style.zIndex = '10';
            el.querySelectorAll('.rack-handle, .rotate-handle, .rack-dimensions').forEach(h => {
                h.style.display = 'none';
            });
        });

        // Seleccionar esta
        element.classList.add('selected');
        element.style.zIndex = '20';
        this.selectedRack = rack;

        // Mostrar asas
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

        // Añadir eventos globales
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

        // Cálculo según el asa utilizada
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

        // Límites
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const rackWidth = newWidth * this.gridSize;
        const rackHeight = newHeight * this.gridSize;

        if (newX < 0) newX = 0;
        if (newY < 0) newY = 0;
        if (newX + rackWidth > canvasWidth) newX = canvasWidth - rackWidth;
        if (newY + rackHeight > canvasHeight) newY = canvasHeight - rackHeight;

        // Actualizar
        this.currentRack.width = newWidth;
        this.currentRack.depth = newHeight;
        this.currentRack.position_x = newX;
        this.currentRack.position_y = newY;

        this.currentElement.style.width = `${newWidth * this.gridSize}px`;
        this.currentElement.style.height = `${newHeight * this.gridSize}px`;
        this.currentElement.style.left = `${newX}px`;
        this.currentElement.style.top = `${newY}px`;

        // Actualizar visualización de dimensiones
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

        // Añadir eventos globales
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

        // Snap a 15 grados
        newRotation = Math.round(newRotation / 15) * 15;

        this.currentRack.rotation = newRotation;
        this.currentElement.style.transform = `rotate(${newRotation}deg)`;

        this.updatePropertiesPanel(this.currentRack);
    }

    saveAutoPosition() {
        if (!this.selectedRack || !window.vueStock) return;

        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            // CORRECCIÓN: Siempre enviar el ID para una actualización
            const payload = {
                id: this.selectedRack.id, // <-- ¡AÑADIR ESTO AQUÍ!
                position_x: this.selectedRack.position_x,
                position_y: this.selectedRack.position_y,
                rotation: this.selectedRack.rotation || 0,
                width: this.selectedRack.width,
                depth: this.selectedRack.depth,
                color: this.selectedRack.color
            };

            // Si la estantería tiene código/nombre, incluirlos también
            if (this.selectedRack.code) {
                payload.code = this.selectedRack.code;
            }
            if (this.selectedRack.name) {
                payload.name = this.selectedRack.name;
            }

            console.log('💾 Auto-guardando estantería con ID:', this.selectedRack.id);

            window.vueStock.api.saveRack(payload)
                .then((result) => {
                    console.log('✅ Auto-guardado exitoso:', result);
                })
                .catch(err => {
                    console.error('❌ Error auto-guardado:', err);
                });
        }, 1000); // 1 segundo después de la última modificación
    }

    updatePropertiesPanel(rack) {
        const panel = document.getElementById('propertiesPanel');
        if (!panel || !rack) return;

        panel.innerHTML = `
            <h4>Estantería ${rack.code}</h4>
            <div class="property-group">
                <div class="property">
                    <span class="property-label">Posición:</span>
                    <span class="property-value">${Math.round(rack.position_x / this.gridSize)}, ${Math.round(rack.position_y / this.gridSize)}</span>
                </div>
                <div class="property">
                    <span class="property-label">Dimensiones:</span>
                    <span class="property-value">${rack.width} × ${rack.depth} casillas</span>
                </div>
                <div class="property">
                    <span class="property-label">Rotación:</span>
                    <span class="property-value">${rack.rotation || 0}°</span>
                </div>
                <div class="property">
                    <span class="property-label">Color:</span>
                    <input type="color" value="${rack.color || '#4a90e2'}" class="property-color" data-rack-id="${rack.id}">
                </div>
            </div>
            <button class="btn btn-sm btn-block view-rack-btn" data-rack-id="${rack.id}">
                <i class="fas fa-eye"></i> Ver niveles
            </button>
            <button class="btn btn-sm btn-danger btn-block delete-rack-btn" data-rack-id="${rack.id}">
                <i class="fas fa-trash"></i> Eliminar
            </button>
        `;

        // ✅ Eventos directos (sin delegación apilada)
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

        // ✅ Evento directo para el botón eliminar (una sola vez)
        const deleteBtn = panel.querySelector('.delete-rack-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm('¿Eliminar esta estantería y todos sus niveles/huecos?')) {
                    this.deleteRack(rack.id);
                }
            });
        }
    }

    async deleteRack(rackId) {
        try {
            // ✅ CORRECCIÓN: Pasar el ID en la URL, no en el body
            if (window.vueStock?.api) {
                await window.vueStock.api.deleteRack(rackId);
            }

            // Eliminar del DOM
            const element = this.overlay.querySelector(`[data-rack-id="${rackId}"]`);
            if (element) {
                element.remove();
            }

            // Eliminar del array
            this.racks = this.racks.filter(item => item.rack.id !== rackId);

            // Eliminar también del array de VueStock
            if (window.vueStock) {
                window.vueStock.racks = window.vueStock.racks.filter(r => r.id !== rackId);
            }

            // Reiniciar selección
            this.selectedRack = null;

            // Actualizar panel
            const panel = document.getElementById('propertiesPanel');
            if (panel) {
                panel.innerHTML = '<p class="no-selection">Seleccione un elemento para ver sus propiedades</p>';
            }

            // Actualizar estadísticas
            if (window.vueStock) {
                window.vueStock.updateStats();
            }

            console.log('🗑️ Estantería eliminada:', rackId);

        } catch (error) {
            console.error('Error al eliminar:', error);
            alert('Error: ' + error.message);
        }
    }

    getRackById(rackId) {
        const item = this.racks.find(item => item.rack.id === rackId);
        return item ? item.rack : null;
    }

    initEvents() {
        // Seguimiento del ratón
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;

            // Convertir a coordenadas cuadrícula
            this.gridX = this.mouseX + this.offsetX;
            this.gridY = this.mouseY + this.offsetY;

            this.updateCoordinatesDisplay();
        });

        // Zoom con rueda
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

            // Ajustar offset para hacer zoom hacia el ratón
            const scaleRatio = this.scale / oldScale;
            this.offsetX = this.mouseX * (1 - scaleRatio) + this.offsetX * scaleRatio;
            this.offsetY = this.mouseY * (1 - scaleRatio) + this.offsetY * scaleRatio;

            this.drawGrid();
            this.updateCoordinatesDisplay();
        });

        // Herramientas - ATENCIÓN A LOS ID
        const toolButtons = document.querySelectorAll('.tool-btn');
        toolButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                toolButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.dataset.tool;

                // Si herramienta "rack", crear una nueva estantería al clic
                if (this.currentTool === 'rack') {
                    this.canvas.style.cursor = 'crosshair';
                } else {
                    this.canvas.style.cursor = 'default';
                }
            });
        });

        // Clic en el canvas para crear una estantería
        this.canvas.addEventListener('click', async (e) => {
            // ✅ Protección contra doble clic
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
                        // Encontrar el próximo código disponible
                        const existingCodes = window.vueStock.racks.map(r => r.code);
                        let nextCode = 'A';
                        let charCode = 65;

                        while (existingCodes.includes(nextCode)) {
                            charCode++;
                            nextCode = String.fromCharCode(charCode);
                            if (charCode > 90) break; // Seguridad
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
                    // ✅ Desbloquear después de 500ms (seguridad)
                    setTimeout(() => {
                        this._clickInProgress = false;
                    }, 500);
                }
            }
        }, { once: false }); // Verificar que solo haya UN addEventListener para 'click'

        // Botones de zoom - VERIFICAR LOS ID
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

        // Toggle de cuadrícula magnética
        gridToggleBtn?.addEventListener('click', () => {
            const isActive = gridToggleBtn.classList.contains('active');

            if (isActive) {
                gridToggleBtn.classList.remove('active');
                gridToggleBtn.innerHTML = '<i class="fas fa-th"></i> Cuadrícula';
                // Ocultar cuadrícula
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            } else {
                gridToggleBtn.classList.add('active');
                gridToggleBtn.innerHTML = '<i class="fas fa-th"></i> Cuadrícula ON';
                // Mostrar cuadrícula
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

// vuestock.js - AÑADIR después de la clase CanvasManager

class QuadViewManager {
    constructor() {
        if (window.quadViewManagerInstance) {
            return window.quadViewManagerInstance; // Retorna la instancia existente
        }
        window.quadViewManagerInstance = this;

        this.currentView = 'quad'; // 'quad' o 'single'
        this.selectedRack = null;
        this.selectedLevel = null;
        this.slotAnimationTimeout = null;
        this.isSlotAnimating = false;

        // Propiedades para la vista 3D isométrica rotativa
        this.rotation3D = 0; // Ángulo de rotación actual (0-360°)
        this.isDragging3D = false; // ¿Estamos girando la vista?
        this.drag3DStartX = 0; // Posición X de inicio del drag
        this.isometric = {
            angle: 30, // Ángulo isométrico (30° por defecto)
            scale: 0.8, // Escala de renderizado
            offsetX: 0, // Desplazamiento horizontal
            offsetY: 0  // Desplazamiento vertical
        };

        // Propiedades para Visión Rayos X
        this.hoveredRack = null; // Estantería actualmente sobrevolada
        this.xrayProgress = 0; // Progresión del efecto rayos X (0 a 1)
        this.xrayAnimFrame = null; // Frame de animación rayos X

        // Propiedades para Zoom al clic
        this.focusedRack = null; // Estantería actualmente en foco (zoom)
        this.zoomProgress = 0; // Progresión del zoom (0 a 1)
        this.zoomAnimFrame = null; // Frame de animación zoom
        this.camera = {
            targetRotation: 0, // Rotación objetivo de la cámara
            targetScale: 1, // Escala objetivo (1 = normal, 2 = zoom x2)
            currentScale: 1 // Escala actual
        };

        this.initStockModal();

        this.cameraFocusIndex = 0; // Índice de la estantería centrada
        this.currentOffset = 0;    // Posición actual de la cámara (para animación)
        this.draggedRack = null;
        this.selectedRackZOffset = 0; // Desplazamiento en Z para la estantería seleccionada
        this.selectedRackAnimProgress = 0; // Progresión de la animación


        // Canvases
        this.canvasTop = document.getElementById('canvasTop');
        this.canvasFront = document.getElementById('canvasFront');
        this.canvas3D = document.getElementById('canvas3D');

        // Contexts
        this.ctxTop = this.canvasTop?.getContext('2d');
        this.ctxFront = this.canvasFront?.getContext('2d');
        this.ctx3D = this.canvas3D?.getContext('2d');

        // Dimensiones por defecto (serán ajustadas)
        this.rackHeightPerLevel = 40; // px por nivel
        this.slotSize = 60; // px por hueco

        this.init();
    }

    init() {
        console.log('QuadViewManager inicializado');

        // DEBUG: Verificar estado de los canvas
        console.log('Canvas Top:', this.canvasTop, 'Context:', this.ctxTop);
        console.log('Canvas Front:', this.canvasFront, 'Context:', this.ctxFront);
        console.log('Canvas 3D:', this.canvas3D, 'Context:', this.ctx3D);

        // Dibujar un estado inicial vacío
        this.drawEmptyState();

        // Ajustar dimensiones de los canvas
        this.resizeCanvases();

        // Eventos de redimensionamiento
        window.addEventListener('resize', () => this.resizeCanvases());

        // AÑADIDO IMPORTANTE: Evento clic en el canvas superior-izquierdo
        if (this.canvasTop) {
            // Mousedown para iniciar el drag
            this.canvasTop.addEventListener('mousedown', (e) => {
                this.isDragging = false;
                this.isResizing = false;
                this.isRotating = false;
                this.draggedRack = null;

                const rect = this.canvasTop.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const clickedRack = this.findRackAtPosition(x, y);

                if (!clickedRack) {
                    return;
                }

                // ✅ Si es una estantería DIFERENTE, seleccionarla
                if (!this.selectedRack || clickedRack.id !== this.selectedRack.id) {
                    // Cerrar el cajón
                    const container = document.getElementById('quadLevelSlots');
                    if (container) {
                        const currentDrawer = container.querySelector('.quad-drawer-container');
                        if (currentDrawer && currentDrawer.classList.contains('open')) {
                            currentDrawer.classList.remove('open');
                            setTimeout(() => {
                                container.innerHTML = '';
                                this.selectedLevel = null;
                            }, 700);
                        } else {
                            container.innerHTML = '';
                            this.selectedLevel = null;
                        }
                    }

                    // Seleccionar la nueva estantería
                    console.log(`📌 Selección de la estantería ${clickedRack.code}`);
                    this.selectedRack = clickedRack;

                    // Actualizar todas las vistas
                    this.drawTopView(this.currentRacks);
                    this.drawFrontView(clickedRack);
                    this.updatePropertiesPanel(clickedRack);

                    if (clickedRack.rotation && clickedRack.rotation !== 0) {
                        const targetRotation = -clickedRack.rotation;
                        this.animate3DRotation(targetRotation);
                    } else {
                        this.animate3DRotation(0);
                    }

                    // Centrar esta estantería en la vista 3D
                    if (this.currentRacks) {
                        const rackIndex = this.currentRacks.findIndex(r => r.id === clickedRack.id);
                        if (rackIndex !== -1) {
                            this.cameraFocusIndex = rackIndex;
                            this.draw3DView(this.currentRacks);
                            console.log(`🎯 Estantería ${clickedRack.code} centrada en 3D (índice: ${rackIndex})`);
                        }
                    }

                    return;
                }

                // ✅ Si es la MISMA estantería, manejar drag/resize/rotate
                const handle = this.getClickedHandle(x, y);
                if (handle) {
                    if (handle === 'rotate') {
                        this.isRotating = true;
                        this.rotateStartX = x;
                        this.rotateStartY = y;
                        this.rotateStartAngle = this.selectedRack.rotation || 0;
                        this.canvasTop.style.cursor = 'grab';
                        console.log('🔄 Rotación iniciada para', this.selectedRack.code);
                    } else {
                        this.isResizing = true;
                        this.resizeHandle = handle;
                        this.resizeStartX = x;
                        this.resizeStartY = y;
                        this.resizeStartWidth = this.selectedRack.displayWidth;
                        this.resizeStartHeight = this.selectedRack.displayHeight;
                        this.resizeStartPosX = this.selectedRack.displayX;
                        this.resizeStartPosY = this.selectedRack.displayY;
                        console.log('📏 Redimensionamiento iniciado para', this.selectedRack.code, 'asa:', handle);
                    }
                    return;
                }

                // ✅ Iniciar drag de la estantería
                this.isDragging = true;
                this.draggedRack = clickedRack;
                this.dragStartX = x - clickedRack.displayX;
                this.dragStartY = y - clickedRack.displayY;
                this.canvasTop.style.cursor = 'grabbing';
                console.log('🚀 Drag iniciado para', clickedRack.code);
            });

            // Mousemove para el drag
            // Mousemove para el drag, resize y rotación
            this.canvasTop.addEventListener('mousemove', (e) => {
                const rect = this.canvasTop.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                // === DRAG ===
                if (this.isDragging && this.draggedRack) {  // ✅ CAMBIADO: usar draggedRack en lugar de selectedRack
                    let newDisplayX = x - this.dragStartX;
                    let newDisplayY = y - this.dragStartY;

                    const gridSize = 20;
                    newDisplayX = Math.round(newDisplayX / gridSize) * gridSize;
                    newDisplayY = Math.round(newDisplayY / gridSize) * gridSize;

                    const viewScale = this.topViewScale || 1;
                    const canvasWidth = this.canvasTop.width / viewScale;
                    const canvasHeight = this.canvasTop.height / viewScale;

                    newDisplayX = Math.max(0, Math.min(newDisplayX, canvasWidth - this.draggedRack.displayWidth));  // ✅ CAMBIADO
                    newDisplayY = Math.max(0, Math.min(newDisplayY, canvasHeight - this.draggedRack.displayHeight)); // ✅ CAMBIADO

                    this.draggedRack.displayX = newDisplayX;  // ✅ CAMBIADO
                    this.draggedRack.displayY = newDisplayY;  // ✅ CAMBIADO

                    const scale = 1;
                    this.draggedRack.position_x = newDisplayX / scale;  // ✅ CAMBIADO
                    this.draggedRack.position_y = newDisplayY / scale;  // ✅ CAMBIADO

                    const xInput = document.getElementById('quadRackX');
                    const yInput = document.getElementById('quadRackY');
                    if (xInput) xInput.value = Math.round(this.draggedRack.position_x / 40);  // ✅ CAMBIADO
                    if (yInput) yInput.value = Math.round(this.draggedRack.position_y / 40);  // ✅ CAMBIADO

                    this.drawTopView(this.currentRacks);
                }

                // === RESIZE ===
                else if (this.isResizing && this.selectedRack) {
                    const deltaX = x - this.resizeStartX;
                    const deltaY = y - this.resizeStartY;

                    const gridSize = 20;
                    let newWidth = this.resizeStartWidth;
                    let newHeight = this.resizeStartHeight;
                    let newX = this.resizeStartPosX;
                    let newY = this.resizeStartPosY;

                    // Según el asa, calcular nuevas dimensiones
                    switch(this.resizeHandle) {
                        case 'se': // Esquina inferior-derecha
                            newWidth = Math.max(20, this.resizeStartWidth + deltaX);
                            newHeight = Math.max(20, this.resizeStartHeight + deltaY);
                            break;
                        case 'sw': // Esquina inferior-izquierda
                            newWidth = Math.max(20, this.resizeStartWidth - deltaX);
                            newHeight = Math.max(20, this.resizeStartHeight + deltaY);
                            newX = this.resizeStartPosX + (this.resizeStartWidth - newWidth);
                            break;
                        case 'ne': // Esquina superior-derecha
                            newWidth = Math.max(20, this.resizeStartWidth + deltaX);
                            newHeight = Math.max(20, this.resizeStartHeight - deltaY);
                            newY = this.resizeStartPosY + (this.resizeStartHeight - newHeight);
                            break;
                        case 'nw': // Esquina superior-izquierda
                            newWidth = Math.max(20, this.resizeStartWidth - deltaX);
                            newHeight = Math.max(20, this.resizeStartHeight - deltaY);
                            newX = this.resizeStartPosX + (this.resizeStartWidth - newWidth);
                            newY = this.resizeStartPosY + (this.resizeStartHeight - newHeight);
                            break;
                    }

                    // Snap to grid
                    newWidth = Math.round(newWidth / gridSize) * gridSize;
                    newHeight = Math.round(newHeight / gridSize) * gridSize;

                    // Aplicar
                    this.selectedRack.displayWidth = newWidth;
                    this.selectedRack.displayHeight = newHeight;
                    this.selectedRack.displayX = newX;
                    this.selectedRack.displayY = newY;

                    // Actualizar width/depth reales (en casillas)
                    this.selectedRack.width = Math.round(newWidth / 20);
                    this.selectedRack.depth = Math.round(newHeight / 20);

                    // Actualizar los inputs
                    const widthInput = document.getElementById('quadRackWidth');
                    const depthInput = document.getElementById('quadRackDepth');
                    if (widthInput) widthInput.value = this.selectedRack.width;
                    if (depthInput) depthInput.value = this.selectedRack.depth;

                    this.drawTopView(this.currentRacks);
                }

                // === ROTACIÓN ===
                else if (this.isRotating && this.selectedRack) {
                    // Calcular el ángulo desde el centro del rack
                    const centerX = this.selectedRack.displayX + this.selectedRack.displayWidth / 2;
                    const centerY = this.selectedRack.displayY + this.selectedRack.displayHeight / 2;

                    const angle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);

                    // Snap a 15 grados
                    let newRotation = Math.round(angle / 15) * 15;
                    if (newRotation < 0) newRotation += 360;

                    this.selectedRack.rotation = newRotation;

                    // Actualizar el slider
                    const rotationSlider = document.getElementById('quadRackRotation');
                    const rotationValue = document.querySelector('.rotation-value');
                    if (rotationSlider) rotationSlider.value = newRotation;
                    if (rotationValue) rotationValue.textContent = newRotation + '°';

                    this.drawTopView(this.currentRacks);
                }
            });

            // Mouseup para terminar el drag, resize y rotación
            this.canvasTop.addEventListener('mouseup', (e) => {
                // ✅ Limpiar TODOS los estados
                if (this.isDragging) {
                    this.isDragging = false;

                    // ✅ AÑADIDO: Guardar la posición final
                    if (this.draggedRack) {
                        const scale = 1;
                        this.draggedRack.position_x = this.draggedRack.displayX / scale;
                        this.draggedRack.position_y = this.draggedRack.displayY / scale;
                    }

                    this.draggedRack = null;
                    this.dragStartX = null;
                    this.dragStartY = null;
                    this.canvasTop.style.cursor = 'default';
                    console.log('⏹️ Drag terminado');
                }

                if (this.isResizing && this.selectedRack) {
                    this.isResizing = false;
                    this.resizeHandle = null;
                    this.canvasTop.style.cursor = 'default';

                    // Actualizar position_x/y desde displayX/Y
                    const scale = 1;
                    this.selectedRack.position_x = this.selectedRack.displayX / scale;
                    this.selectedRack.position_y = this.selectedRack.displayY / scale;

                    // Redibujar una última vez
                    this.drawTopView(this.currentRacks);

                    console.log('⏹️ Resize terminado:', this.selectedRack.width, 'x', this.selectedRack.depth);
                }

                if (this.isRotating && this.selectedRack) {
                    this.isRotating = false;
                    this.canvasTop.style.cursor = 'default';

                    // Redibujar una última vez
                    this.drawTopView(this.currentRacks);

                    console.log('⏹️ Rotación terminada:', this.selectedRack.rotation, '°');
                }
            });

            // Click para seleccionar
            this.canvasTop.addEventListener('click', (e) => {
                if (!this.isDragging) {
                    this.handleCanvasClick(e);
                }
            });

            this.canvasTop.style.cursor = 'default';

            // Evento clic en el canvas de frente
            if (this.canvasFront) {
                this.canvasFront.addEventListener('click', (e) => {
                    this.handleFrontViewClick(e);
                });
            }

            // NUEVO: Eventos para la rotación 3D interactiva
            if (this.canvas3D) {
                // Iniciar la rotación al mousedown
                this.canvas3D.addEventListener('mousedown', (e) => {
                    this.drag3DStartX = e.clientX;
                    this.drag3DStartTime = Date.now();
                    this.drag3DTotalDistance = 0;
                    this.canvas3D.style.cursor = 'grabbing';
                });

                // Continuar la rotación durante el mousemove
                this.canvas3D.addEventListener('mousemove', (e) => {
                    // Iniciar el drag solo si se mueve más de 5px
                    if (this.drag3DStartX !== undefined) {
                        const distance = Math.abs(e.clientX - this.drag3DStartX);
                        this.drag3DTotalDistance += distance;

                        if (this.drag3DTotalDistance > 5) {
                            this.isDragging3D = true;
                        }
                    }

                    if (!this.isDragging3D) return;

                    const deltaX = e.clientX - this.drag3DStartX;
                    this.rotation3D += deltaX * 0.5; // Sensibilidad de rotación
                    this.drag3DStartX = e.clientX;

                    // Mantener el ángulo entre 0 y 360
                    this.rotation3D = this.rotation3D % 360;
                    if (this.rotation3D < 0) this.rotation3D += 360;

                    // Redibujar la escena 3D
                    if (this.currentRacks) {
                        this.draw3DView(this.currentRacks);
                    }
                });

                // Detener la rotación al mouseup
                this.canvas3D.addEventListener('mouseup', () => {
                    this.isDragging3D = false;
                    this.drag3DStartX = undefined;
                    this.canvas3D.style.cursor = 'grab';
                });

                // Detener también si el ratón sale del canvas
                this.canvas3D.addEventListener('mouseleave', () => {
                    this.isDragging3D = false;
                    this.canvas3D.style.cursor = 'grab';
                });

                // Cursor inicial
                this.canvas3D.style.cursor = 'grab';

                // === NAVEGACIÓN POR FLECHAS (CAMBIO ÚNICO) ===
                document.addEventListener('keydown', (e) => {
                    // Verificar que estamos en la vista quad
                    if (this.currentView !== 'quad') return;

                    // Verificar que tenemos estanterías
                    if (!this.currentRacks || this.currentRacks.length === 0) return;

                    // Ordenar las estanterías como en draw3DView
                    const sortedRacks = [...this.currentRacks].sort((a, b) => {
                        return (a.position_x || 0) - (b.position_x || 0);
                    });

                    let currentIndex = sortedRacks.findIndex(r =>
                        this.selectedRack && r.id === this.selectedRack.id
                    );

                    if (currentIndex === -1) currentIndex = 0;

                    if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        // Ir a la estantería anterior (o la última)
                        const newIndex = currentIndex <= 0 ? sortedRacks.length - 1 : currentIndex - 1;
                        this.selectedRack = sortedRacks[newIndex];
                        this.draw3DView(this.currentRacks);
                        console.log(`⬅️ Estantería anterior: ${sortedRacks[newIndex].code}`);
                    }

                    if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        // Ir a la estantería siguiente (o la primera)
                        const newIndex = currentIndex >= sortedRacks.length - 1 ? 0 : currentIndex + 1;
                        this.selectedRack = sortedRacks[newIndex];
                        this.draw3DView(this.currentRacks);
                        console.log(`➡️ Estantería siguiente: ${sortedRacks[newIndex].code}`);
                    }
                });

                // NUEVO: Detección de hover para Visión Rayos X
                this.canvas3D.addEventListener('mousemove', (e) => {
                    if (this.isDragging3D) return; // No detectar si estamos girando

                    const rect = this.canvas3D.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const mouseY = e.clientY - rect.top;

                    // Encontrar qué estantería está bajo el ratón
                    const hoveredRack = this.findRackAt3DPosition(mouseX, mouseY);

                    // Si cambiamos de estantería sobrevolada
                    if (hoveredRack !== this.hoveredRack) {
                        this.hoveredRack = hoveredRack;

                        // Iniciar/detener la animación rayos X
                        if (hoveredRack) {
                            this.startXRayEffect();
                        } else {
                            this.stopXRayEffect();
                        }
                    }
                });

                // === BUCLE DE ANIMACIÓN PARA MOVIMIENTO FLUIDO ===
                const animate = () => {
                    // Redibujar la vista 3D solo si necesita animación
                    if (this.currentRacks && this.currentOffset !== undefined) {
                        // Siempre redibujar para la animación fluida
                        this.draw3DView(this.currentRacks);
                    }
                    requestAnimationFrame(animate);
                };
                animate();

                // Clic para hacer zoom en una estantería
                this.canvas3D.addEventListener('click', (e) => {
                    // Ignorar si fue un drag (distancia > 5px o duración > 200ms)
                    const clickDuration = Date.now() - this.drag3DStartTime;
                    if (this.drag3DTotalDistance > 5 || clickDuration > 200) {
                        return;
                    }

                    const rect = this.canvas3D.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const mouseY = e.clientY - rect.top;

                    const clickedRack = this.findRackAt3DPosition(mouseX, mouseY);

                    if (clickedRack) {
                        // Hacer zoom en esta estantería
                        this.zoomOnRack(clickedRack);
                    } else if (this.focusedRack) {
                        // Deshacer zoom si se clica fuera
                        this.resetZoom();
                    }
                });
            }
        }

        // Reinicialización 3D
        document.getElementById('quad3DReset')?.addEventListener('click', () => {
            this.reset3DView();
        });

        // Comenzar con la vista quad
        this.switchView('quad');
        this.selectedRack = null;
        this.selectedLevel = null;
        this.clearFrontView();

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

        // Mostrar/ocultar vistas
        const quadView = document.getElementById('quadView');
        const simpleView = document.getElementById('simpleView');

        if (viewType === 'quad') {
            quadView.style.display = 'grid';
            simpleView.style.display = 'none';
            document.getElementById('viewMode').textContent = 'Quad';

            // Redibujar todas las vistas
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

    clearFrontView() {
        const ctx = this.canvasFront.getContext('2d');
        ctx.clearRect(0, 0, this.canvasFront.width, this.canvasFront.height);
    }


    // Actualizar todas las vistas con las estanterías
    updateAllViews(racks) {
        console.log('QuadView.updateAllViews llamado con', racks ? racks.length : 0, 'estanterías');

        this.currentRacks = racks;

        if (!racks || !racks.length) {
            debugLog('quadView', 'Sin datos, dibujando estado vacío');
            this.drawEmptyState();
            return;
        }

        debugLog('quadView', 'Dibujando', racks.length, 'estanterías');

        try {
            // 1. Vista superior
            this.drawTopView(racks);

            // 2. Vista frontal (si una estantería está seleccionada)
            if (this.selectedRack) {
                this.drawFrontView(this.selectedRack);
            }


            // 3. Vista 3D isométrica
            this.draw3DView(racks);

            // 4. Vista nivel (si un nivel está seleccionado)
            if (this.selectedLevel) {
                this.updateLevelView(this.selectedLevel);
            }

            // Actualizar información
            this.updateInfoPanel(racks);

            debugLog('quadView', 'Todas las vistas actualizadas');
        } catch (error) {
            console.error('Error en updateAllViews:', error);
        }
    }

    drawEmptyState() {
        // Dibujar un estado vacío para la vista superior
        if (this.ctxTop && this.canvasTop) {
            const ctx = this.ctxTop;
            const width = this.canvasTop.width;
            const height = this.canvasTop.height;

            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = '#6c757d';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Cargando estanterías...', width/2, height/2);
        }

        // Vista frontal
        if (this.ctxFront && this.canvasFront) {
            const ctx = this.ctxFront;
            const width = this.canvasFront.width;
            const height = this.canvasFront.height;

            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = '#6c757d';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Seleccione primero una estantería', width/2, height/2);
        }

        // Vista 3D
        if (this.ctx3D && this.canvas3D) {
            const ctx = this.ctx3D;
            const width = this.canvas3D.width;
            const height = this.canvas3D.height;

            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#667eea';
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Vista 3D', width/2, height/2);
        }
    }

    // Método para manejar los clics en el canvas
     handleCanvasClick(e) {
        console.log('=== handleCanvasClick ===');

        e.preventDefault();
        e.stopPropagation();

        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;

        if (!this.currentRacks || this.currentRacks.length === 0) return;

        const rect = this.canvasTop.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // ✅ LOGS DE DEPURACIÓN
        console.log('🎯 COORDENADAS BRUTAS:');
        console.log('  e.clientX:', e.clientX, 'e.clientY:', e.clientY);
        console.log('  rect.left:', rect.left.toFixed(1), 'rect.top:', rect.top.toFixed(1));
        console.log('  rect.width:', rect.width, 'rect.height:', rect.height);
        console.log('  canvas.width:', this.canvasTop.width, 'canvas.height:', this.canvasTop.height);
        console.log('  x calculado:', x.toFixed(1), 'y calculado:', y.toFixed(1));

        console.log(`🎯 Clic en: ${x}, ${y}`);
        console.log(`📌 Estado actual: selectedRack = ${this.selectedRack ? this.selectedRack.code : 'null'}`);

        // 1. SIEMPRE verificar las asas si hay una estantería seleccionada
        if (this.selectedRack) {
            console.log(`🔄 Estantería ${this.selectedRack.code} seleccionada, verificando asas...`);
            const handle = this.getClickedHandle(x, y);
            console.log(`🔍 Resultado getClickedHandle: ${handle ? handle : 'null'}`);
            if (handle) {
                console.log(`🔄 Asa ${handle} clickeada`);

                switch(handle) {
                    case 'nw':
                    case 'ne':
                    case 'sw':
                    case 'se':
                        this.startResizeFromHandle(this.selectedRack, handle, x, y);
                        return; // NO CONTINUAR
                    case 'rotate':
                        this.startRotationFromHandle(this.selectedRack, x, y);
                        return; // NO CONTINUAR
                }
            } else {
                console.log(`❌ Ningún asa detectada`);
            }
        }

        // 2. Luego, verificar si se hace clic en una estantería normal
        const clickedRack = this.findRackAtPosition(x, y);

        if (clickedRack) {
            console.log(`✅ Estantería ${clickedRack.code} encontrada!`);

            // Si es la misma estantería ya seleccionada, no hacer nada (el mousedown manejará el drag)
            if (this.selectedRack && this.selectedRack.id === clickedRack.id) {
                console.log(`📌 Estantería ${clickedRack.code} ya seleccionada`);
                return; // No redibujar
            }

            // CERRAR EL CAJÓN ANTES DE CAMBIAR DE ESTANTERÍA
            const container = document.getElementById('quadLevelSlots');
            if (container) {
                const currentDrawer = container.querySelector('.quad-drawer-container');
                if (currentDrawer && currentDrawer.classList.contains('open')) {
                    currentDrawer.classList.remove('open');
                    setTimeout(() => {
                        container.innerHTML = '';
                        this.selectedLevel = null;
                    }, 700);
                } else {
                    container.innerHTML = '';
                    this.selectedLevel = null;
                }
            }

            // Seleccionar la nueva estantería
            console.log(`📌 Selección de la estantería ${clickedRack.code}`);
            this.selectedRack = clickedRack;

            // 1. Actualizar todas las vistas
            this.drawTopView(this.currentRacks);
            this.drawFrontView(clickedRack);
            this.updatePropertiesPanel(clickedRack);

            // ✅ NUEVO: Girar la vista 3D si la estantería está girada
            if (this.currentRacks) {
                const rackIndex = this.currentRacks.findIndex(r => r.id === clickedRack.id);
                if (rackIndex !== -1) {
                    this.cameraFocusIndex = rackIndex;

                    if (clickedRack.rotation && clickedRack.rotation !== 0) {
                        const targetRotation = -clickedRack.rotation;
                        this.animate3DRotation(targetRotation);
                    } else {
                        this.animate3DRotation(0);
                    }

                    this.draw3DView(this.currentRacks);
                    console.log(`🎯 Estantería ${clickedRack.code} centrada en 3D (índice: ${rackIndex})`);
                }
            }

            // 2. CENTRAR esta estantería en la vista 3D
            if (this.currentRacks) {
                // Calcular la posición para centrar esta estantería
                const rackIndex = this.currentRacks.findIndex(r => r.id === clickedRack.id);
                if (rackIndex !== -1) {
                    // Posicionar la cámara para que esta estantería esté en el centro
                    const totalRacks = this.currentRacks.length;
                    const spacing = 120;
                    this.cameraFocusIndex = rackIndex; // Nueva propiedad a añadir

                    // Redibujar la vista 3D con esta estantería centrada
                    this.draw3DView(this.currentRacks);

                    console.log(`🎯 Estantería ${clickedRack.code} centrada en 3D (índice: ${rackIndex})`);
                }
            }

        } else {
            console.log('❌ Ninguna estantería en esta posición');
        }
    }

    // Encontrar una estantería en una posición dada
    findRackAtPosition(x, y) {
        if (!this.currentRacks) {
            console.log('❌ currentRacks es null/undefined');
            return null;
        }

        // ✅ CORRECCIÓN: Aplicar el scale inverso a las coordenadas del ratón
        const scale = this.topViewScale || 1;
        const adjustedX = x / scale;
        const adjustedY = y / scale;

        console.log(`🔍 Buscando entre ${this.currentRacks.length} estanterías en: ${adjustedX},${adjustedY} (scale: ${scale})`);

        for (const rack of this.currentRacks) {
            if (!rack.displayX) {
                console.log(`  Estantería ${rack.code}: SIN displayX`);
                continue;
            }

            // Usar el tamaño real del rack (3x3, etc.)
            const logicalGridSize = 20;
            const w = rack.width * logicalGridSize;
            const d = rack.depth * logicalGridSize;

            const left = rack.displayX;
            const right = left + (w / scale);
            const top = rack.displayY;
            const bottom = top + (d / scale);

            console.log(`  Estantería ${rack.code}: ${left}-${right}, ${top}-${bottom}`);

            if (adjustedX >= left && adjustedX <= right && adjustedY >= top && adjustedY <= bottom) {
                console.log(`✅ ${rack.code} ENCONTRADA!`);
                return rack;
            }
        }

        console.log('❌ Ninguna estantería coincide');
        return null;
    }


    // Manejo del hover (para cambiar el cursor)
    handleCanvasHover(e) {
        if (!this.currentRacks || this.currentRacks.length === 0) return;

        const rect = this.canvasTop.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const rack = this.findRackAtPosition(x, y);

        if (rack) {
            this.canvasTop.style.cursor = 'pointer';
            // Opción: mostrar una información emergente
            this.showTooltip(rack, x, y);
        } else {
            this.canvasTop.style.cursor = 'default';
            this.hideTooltip();
        }
    }

    // Mostrar una información emergente
    showTooltip(rack, mouseX, mouseY) {
        // Crear o actualizar la información emergente
        let tooltip = document.getElementById('quadTooltip');

        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'quadTooltip';
            tooltip.style.cssText = `
                position: fixed;
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 12px;
                pointer-events: none;
                z-index: 1000;
                transform: translate(-50%, -100%);
            `;
            document.body.appendChild(tooltip);
        }

        tooltip.innerHTML = `
            <strong>${rack.code}</strong><br>
            ${rack.name || 'Estantería ' + rack.code}<br>
            ${rack.width} × ${rack.depth} casillas
        `;

        // Posicionar cerca del cursor del ratón
        tooltip.style.left = (mouseX + 10) + 'px'; // 10px a la derecha del cursor
        tooltip.style.top = (mouseY - 10) + 'px'; // 10px arriba del cursor
        tooltip.style.display = 'block';
    }

    // Ocultar la información emergente
    hideTooltip() {
        const tooltip = document.getElementById('quadTooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }

    // Abrir el modal de edición
    openEditModal(rack) {
        console.log('Abriendo modal para editar la estantería:', rack.code);

        // Usar su modal existente via VueStock
        if (window.vueStock && window.vueStock.openRackModal) {
            window.vueStock.openRackModal(rack);
        } else if (window.openRackModal) {
            window.openRackModal(rack);
        } else {
            console.warn('Función openRackModal no disponible');
            // Opción: crear un modal simple
            this.createSimpleEditModal(rack);
        }
    }

    // Modal simple si el modal principal no está disponible
    createSimpleEditModal(rack) {
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;">
                <div style="background:white;padding:20px;border-radius:8px;min-width:300px;">
                    <h3>Editar ${rack.code}</h3>
                    <div style="margin:10px 0;">
                        <label>Código: <input type="text" value="${rack.code}" id="editRackCode"></label>
                    </div>
                    <div style="margin:10px 0;">
                        <label>Ancho: <input type="number" value="${rack.width}" id="editRackWidth"></label>
                    </div>
                    <div style="margin:10px 0;">
                        <label>Profundidad: <input type="number" value="${rack.depth}" id="editRackDepth"></label>
                    </div>
                    <div style="margin:10px 0;">
                        <label>Color: <input type="color" value="${rack.color || '#4a90e2'}" id="editRackColor"></label>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-top:20px;">
                        <button id="cancelEdit">Cancelar</button>
                        <button id="saveEdit" style="background:#4a90e2;color:white;">Guardar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Eventos
        document.getElementById('cancelEdit').addEventListener('click', () => {
            modal.remove();
        });

        document.getElementById('saveEdit').addEventListener('click', async () => {
            const newCode = document.getElementById('editRackCode').value;
            const newWidth = parseInt(document.getElementById('editRackWidth').value);
            const newDepth = parseInt(document.getElementById('editRackDepth').value);
            const newColor = document.getElementById('editRackColor').value;

            // Actualizar localmente
            rack.code = newCode;
            rack.width = newWidth;
            rack.depth = newDepth;
            rack.color = newColor;

            // Redibujar
            this.drawTopView(this.currentRacks);

            // Cerrar el modal
            modal.remove();

            // Guardar via API (si disponible)
            if (window.vueStock && window.vueStock.api) {
                try {
                    await window.vueStock.api.saveRack({
                        id: rack.id,
                        code: newCode,
                        width: newWidth,
                        depth: newDepth,
                        color: newColor
                    });
                    console.log('Estantería actualizada via API');
                } catch (error) {
                    console.error('Error API:', error);
                }
            }
        });
    }

    drawTopView(racks) {
        if (!this.ctxTop || !this.canvasTop) return;

        const ctx = this.ctxTop;
        const width = this.canvasTop.width;
        const height = this.canvasTop.height;

        ctx.clearRect(0, 0, width, height);
        this.drawGrid(ctx, width, height, 20);

        // ✅ NUEVO: Cálculo del zoom automático
        if (racks.length > 0) {
            // Calcular el ancho total necesario para todas las estanterías
            const totalWidth = racks.reduce((sum, rack) => sum + (rack.width * 20) + 40, 0);

            // Si supera el ancho del canvas, calcular un factor de zoom
            if (totalWidth > width - 100) {
                const zoomFactor = (width - 100) / totalWidth;
                // Aplicar el zoom (entre 0.3 y 1)
                const scale = Math.max(0.3, Math.min(1, zoomFactor));

                // Guardar el contexto y aplicar el zoom
                ctx.save();
                ctx.scale(scale, scale);

                // Almacenar el scale para usarlo en otro lugar
                this.topViewScale = scale;
            } else {
                this.topViewScale = 1;
            }
        }

        // AJUSTE PARA UNA SOLA LÍNEA
        const startX = 50;
        const startY = height / 2 - 40;
        const spacing = 40;
        let currentX = startX;

        racks.forEach((rack) => {
            // Tamaño de un cuadrado en píxeles LÓGICOS (siempre 20)
            const logicalGridSize = 20;
            const scale = this.topViewScale || 1;

            // Dimensiones en píxeles lógicos (siempre proporcionales a la cuadrícula)
            const w = rack.width * logicalGridSize;
            const d = rack.depth * logicalGridSize;

            // Almacenar displayWidth y displayHeight UNA SOLA VEZ si no están definidos
            if (rack.displayWidth === undefined) {
                rack.displayWidth = w;
            }
            if (rack.displayHeight === undefined) {
                rack.displayHeight = d;
            }

            let x, y;

            // Si esta estantería está siendo arrastrada, usar displayX/Y existentes
            if (this.isDragging && this.draggedRack && rack.id === this.draggedRack.id) {
                // displayX/Y ya están en píxeles lógicos, no es necesario dividir
                x = rack.displayX;
                y = rack.displayY;
            }
            else if (rack.position_x !== undefined && rack.position_y !== undefined) {
                const positionScale = 1; // Conversión position_x → píxeles lógicos
                const viewScale = this.topViewScale || 1; // Zoom global

                // Posición en píxeles lógicos (antes de ctx.scale)
                x = rack.position_x * positionScale;
                y = rack.position_y * positionScale;

                // ✅ CORRECCIÓN: Ajustar a pantalla si está fuera de límites
                const maxX = (this.canvasTop.width / viewScale) - 100;
                const maxY = (this.canvasTop.height / viewScale) - 100;

                if (x > maxX) {
                    x = maxX;
                    rack.position_x = x; // Actualizar para guardar
                }

                if (y > maxY) {
                    y = maxY;
                    rack.position_y = y;
                }

                // Almacenar en píxeles físicos (después de ctx.scale)
                rack.displayX = x;
                rack.displayY = y;
            }
            // Si no, calcular automáticamente
            else {
                if (currentX + w > width - 50) {
                    currentX = Math.max(startX, width - 50 - w);
                }

                x = currentX;
                y = startY;

                rack.displayX = x;
                rack.displayY = y;

                currentX += w + spacing;
            }

            // ✅ AÑADIDO DE LA ROTACIÓN VISUAL
            ctx.save(); // Guardar el contexto

            // Si hay rotación, aplicar la transformación
            if (rack.rotation && rack.rotation !== 0) {
                // Trasladar al centro del rack
                const centerX = x + (w / scale) / 2;
                const centerY = y + (d / scale) / 2;
                ctx.translate(centerX, centerY);
                ctx.rotate((rack.rotation * Math.PI) / 180); // Convertir grados a radianes
                ctx.translate(-centerX, -centerY);
            }

            // Dibujo del rack (código original)
            ctx.fillStyle = rack.color || '#4a90e2';
            ctx.fillRect(x, y, w / scale, d / scale);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, w / scale, d / scale);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(rack.code, x + (w / scale) / 2, y + (d / scale) / 2);

            ctx.restore(); // Restaurar el contexto (anula la rotación)

            // Asas (DESPUÉS de la restauración para que no giren)
            if (this.selectedRack && rack.id === this.selectedRack.id) {
                // Resaltado
                ctx.save();
                if (rack.rotation && rack.rotation !== 0) {
                    const centerX = x + (w / scale) / 2;
                    const centerY = y + (d / scale) / 2;
                    ctx.translate(centerX, centerY);
                    ctx.rotate((rack.rotation * Math.PI) / 180);
                    ctx.translate(-centerX, -centerY);
                }

                ctx.strokeStyle = '#ffeb3b';
                ctx.lineWidth = 3;
                ctx.strokeRect(x - 2, y - 2, (w / scale) + 4, (d / scale) + 4);
                ctx.restore();

                // Las asas NO giran (siempre permanecen horizontales/verticales)
                const handleSize = 8;
                const handleColor = '#007bff';
                const handleBorder = '#ffffff';
                const rackVisualWidth = w / scale;
                const rackVisualHeight = d / scale;

                // Esquina superior izquierda
                ctx.fillStyle = handleBorder;
                ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
                ctx.fillStyle = handleColor;
                ctx.fillRect(x - handleSize/2 + 1, y - handleSize/2 + 1, handleSize - 2, handleSize - 2);

                // Esquina superior derecha
                ctx.fillStyle = handleBorder;
                ctx.fillRect(x + rackVisualWidth - handleSize/2, y - handleSize/2, handleSize, handleSize);
                ctx.fillStyle = handleColor;
                ctx.fillRect(x + rackVisualWidth - handleSize/2 + 1, y - handleSize/2 + 1, handleSize - 2, handleSize - 2);

                // Esquina inferior izquierda
                ctx.fillStyle = handleBorder;
                ctx.fillRect(x - handleSize/2, y + rackVisualHeight - handleSize/2, handleSize, handleSize);
                ctx.fillStyle = handleColor;
                ctx.fillRect(x - handleSize/2 + 1, y + rackVisualHeight - handleSize/2 + 1, handleSize - 2, handleSize - 2);

                // Esquina inferior derecha
                ctx.fillStyle = handleBorder;
                ctx.fillRect(x + rackVisualWidth - handleSize/2, y + rackVisualHeight - handleSize/2, handleSize, handleSize);
                ctx.fillStyle = handleColor;
                ctx.fillRect(x + rackVisualWidth - handleSize/2 + 1, y + rackVisualHeight - handleSize/2 + 1, handleSize - 2, handleSize - 2);

                // Asa de rotación
                const rotateHandleSize = 30;
                const rotateHandleCenterX = x + (rackVisualWidth / 2);
                const rotateHandleY = y - 25;

                ctx.beginPath();
                ctx.arc(rotateHandleCenterX, rotateHandleY, 10, 0, Math.PI * 2);
                ctx.fillStyle = handleBorder;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(rotateHandleCenterX, rotateHandleY, 8, 0, Math.PI * 2);
                ctx.fillStyle = handleColor;
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('⟳', rotateHandleCenterX, rotateHandleY);

                ctx.fillStyle = 'red';
                ctx.beginPath();
                ctx.arc(rotateHandleCenterX, rotateHandleY, 3, 0, Math.PI * 2);
                ctx.fill();

                console.log(`🎯 Estantería ${rack.code}: asa de rotación DIBUJADA en x=${rotateHandleCenterX.toFixed(1)}, y=${rotateHandleY.toFixed(1)}`);

                rack._debugRotateHandle = {
                    centerX: rotateHandleCenterX,
                    centerY: rotateHandleY,
                    left: rotateHandleCenterX - rotateHandleSize/2,
                    right: rotateHandleCenterX + rotateHandleSize/2,
                    top: rotateHandleY - rotateHandleSize/2,
                    bottom: rotateHandleY + rotateHandleSize/2
                };
            }

            currentX += w + spacing;
        });

        if (this.topViewScale && this.topViewScale !== 1) {
            ctx.restore();
        }

        document.getElementById('quadRackCount').textContent = `${racks.length} estanterías`;
    }

    drawFrontView(rack) {
        if (!this.ctxFront || !this.canvasFront || !rack) return;

        const ctx = this.ctxFront;
        const width = this.canvasFront.width;
        const height = this.canvasFront.height;

        // Limpiar
        ctx.clearRect(0, 0, width, height);

        // Dibujar la estantería en elevación
        const rackWidth = rack.width * 30;
        const startX = (width - rackWidth) / 2;
        const startY = height - 20;

        // Base de la estantería
        ctx.fillStyle = rack.color || '#4a90e2';
        ctx.fillRect(startX, startY - 10, rackWidth, 10);

        // Niveles (de abajo hacia arriba)
        if (rack.levels && rack.levels.length) {
            const levels = [...rack.levels].sort((a, b) => a.display_order - b.display_order);

            let currentY = startY - 10;
            const levelHeight = 40;

            levels.forEach(level => {
                const levelTop = currentY - levelHeight;

                // Nivel
                ctx.fillStyle = level.code % 20 === 0 ? '#6c757d' : '#adb5bd';
                ctx.fillRect(startX, levelTop, rackWidth, levelHeight);

                // ✅ NUEVO: Marco amarillo si nivel seleccionado
                if (this.selectedLevel && this.selectedLevel.id === level.id) {
                    ctx.strokeStyle = '#ffd700';
                    ctx.lineWidth = 4;
                    ctx.strokeRect(startX - 2, levelTop - 2, rackWidth + 4, levelHeight + 4);

                    // Efecto resplandor (solo si en animación)
                    if (this.isSlotAnimating) {
                        ctx.shadowColor = '#ffd700';
                        ctx.shadowBlur = 15;
                        ctx.strokeRect(startX - 2, levelTop - 2, rackWidth + 4, levelHeight + 4);
                        ctx.shadowBlur = 0;
                    }
                }


                // Separador
                ctx.strokeStyle = '#495057';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(startX, levelTop);
                ctx.lineTo(startX + rackWidth, levelTop);
                ctx.stroke();

                // Código del nivel
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(level.code, startX + rackWidth/2, levelTop + levelHeight/2);

                currentY -= levelHeight;
            });

            // Altura total
            const totalHeight = startY - currentY;
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(startX - 30, currentY, 25, totalHeight);

            ctx.fillStyle = '#333';
            ctx.font = '10px Arial';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${levels.length} niveles`, startX - 35, currentY + totalHeight/2);
        }

        // Código de la estantería abajo
        ctx.fillStyle = '#333';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Estantería ${rack.code}`, width/2, height - 5);

        document.getElementById('quadSelectedRack').textContent = `Estantería ${rack.code} - ${rack.levels?.length || 0} niveles`;
    }


    handleFrontViewClick(e) {
        if (!this.selectedRack || !this.selectedRack.levels?.length) return;

        const rect = this.canvasFront.getBoundingClientRect();
        const scaleY = this.canvasFront.height / rect.height;

        const clickX = e.clientX - rect.left;
        const clickY = (e.clientY - rect.top) * scaleY;

        const rackWidth = this.selectedRack.width * 30;
        const startX = (this.canvasFront.width - rackWidth) / 2;
        const baseHeight = 10; // altura de la base de la estantería (DEBE coincidir con el draw)
        const startY = this.canvasFront.height - 20 - baseHeight;

        const levelHeight = 40;
        let currentY = startY;


        // 🔑 MISMO ORDEN QUE EL DIBUJO
        const levels = [...this.selectedRack.levels]
            .sort((a, b) => a.display_order - b.display_order);

        for (const level of levels) {
            const levelTop = currentY - levelHeight;
            const levelBottom = currentY;

            if (
                clickX >= startX &&
                clickX <= startX + rackWidth &&
                clickY >= levelTop &&
                clickY <= levelBottom
            ) {
                console.log('✅ Nivel clicado:', level.code);
                this.selectedLevel = level;

                document.getElementById('quadLevelInfo').textContent =
                    `Nivel ${level.code} - ${level.slots?.length || 0} huecos`;

                this.updateLevelView(level);
                return;
            }

            currentY -= levelHeight;
        }
    }


    draw3DView(racks) {
        if (!this.ctx3D || !this.canvas3D) return;

        // ✅ AÑADIDO: Verificación si racks está vacío
        if (!racks || racks.length === 0) {
            const ctx = this.ctx3D;
            const width = this.canvas3D.width;
            const height = this.canvas3D.height;

            ctx.clearRect(0, 0, width, height);

            // Fondo simple
            ctx.fillStyle = '#667eea';
            ctx.fillRect(0, 0, width, height);

            // Mensaje
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No hay estanterías para mostrar', width/2, height/2);

            return; // ← IMPORTANTE: salir de la función
        }

        const ctx = this.ctx3D;
        const width = this.canvas3D.width;
        const height = this.canvas3D.height;


        // Limpiar
        ctx.clearRect(0, 0, width, height);

        // Fondo gradient animado según la rotación (CORREGIDO)
        const gradientAngle = (this.rotation3D % 360) * Math.PI / 180;
        const gx = Math.max(0, Math.min(width, width * 0.5 + Math.cos(gradientAngle) * width * 0.3));
        const gy = Math.max(0, Math.min(height, height * 0.5 + Math.sin(gradientAngle) * height * 0.3));

        const gradient = ctx.createLinearGradient(0, 0, gx, gy);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(0.5, '#764ba2');
        gradient.addColorStop(1, '#667eea');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Cuadrícula de suelo en perspectiva
        this.drawFloorGrid(ctx, width, height);

        // ✅ REEMPLAZAR TODO DESDE AQUÍ
        const centerX = width / 2;
        const centerY = height / 2 + 50;

        // Ordenar las estanterías
        const sortedRacks = [...racks].sort((a, b) => {
            const aRotated = a.rotation && a.rotation !== 0 ? 1 : 0;
            const bRotated = b.rotation && b.rotation !== 0 ? 1 : 0;

            if (aRotated !== bRotated) {
                return bRotated - aRotated;
            }

            return (a.position_x || 0) - (b.position_x || 0);
        });

        const selectedIndex = sortedRacks.findIndex(r =>
            this.selectedRack && r.id === this.selectedRack.id
        );
        const focusIndex = selectedIndex !== -1 ? selectedIndex : 0;
        this.cameraFocusIndex = focusIndex;

        // ✅ NUEVO: Calcular las posiciones teniendo en cuenta las dimensiones reales
        let currentX = 0;
        const racksWithDepth = sortedRacks.map((rack, index) => {
            // Calcular el ancho efectivo según la rotación
            let effectiveWidth = rack.width * 20;

            if (rack.rotation && rack.rotation !== 0) {
                const angle = rack.rotation % 360;
                if ((angle > 45 && angle < 135) || (angle > 225 && angle < 315)) {
                    effectiveWidth = rack.depth * 20;
                }
            }

            const x = currentX;

            let z = 0;
            if (rack.rotation && rack.rotation !== 0) {
                z = 0;
            }

            // ✅ CORRECCIÓN: Espaciado de 120px en lugar de effectiveWidth + 10
            currentX += 120; // Espaciado fijo como antes

            return { rack, x, z, effectiveWidth };
        });

        // ✅ NUEVO: Calcular el offset para centrar la estantería seleccionada
        let targetOffset = 0;
        if (focusIndex > 0) {
            for (let i = 0; i < focusIndex; i++) {
                targetOffset -= racksWithDepth[i].effectiveWidth + 10;
            }
            targetOffset -= racksWithDepth[focusIndex].effectiveWidth / 2;
        } else {
            targetOffset = -racksWithDepth[0].effectiveWidth / 2;
        }

        if (this.currentOffset === undefined) {
            this.currentOffset = targetOffset;
        }

        const animationSpeed = 0.1;
        this.currentOffset += (targetOffset - this.currentOffset) * animationSpeed;

        if (Math.abs(targetOffset - this.currentOffset) < 0.5) {
            this.currentOffset = targetOffset;
        }

        // Dibujar cada estantería
        racksWithDepth.forEach(({ rack, x, z, effectiveWidth }, index) => {
            const isSelected = this.selectedRack && rack.id === this.selectedRack.id;
            const isHovered = (rack === this.hoveredRack);
            const xrayAlpha = isHovered ? this.xrayProgress : 0;
            const zoomScale = this.camera.currentScale;

            // ELIMINAR la rotación orbital de las estanterías
            // const angle = (this.rotation3D || 0) * Math.PI / 180; // ← A ELIMINAR

            // Posición original SIN rotación
            const rotatedX = x + this.currentOffset; // ← Directamente, sin rotación
            const rotatedZ = z; // ← Directamente, sin rotación

            // Proyección isométrica SIN rotación orbital
            const isoX = centerX + rotatedX * this.isometric.scale * zoomScale;
            const isoY = centerY - rotatedZ * this.isometric.scale * 0.5 * zoomScale;

            const rackHeight = (rack.levels?.length || 1) * 12;
            const rackWidth = rack.width * 20;
            const rackDepth = rack.depth * 20;

            const depthScale = 1 - (index / sortedRacks.length) * 0.1;
            const scale = depthScale * zoomScale;

            let finalOpacity = 1;
            if (isSelected) {
                finalOpacity = 0.5;
            } else if (this.focusedRack && rack !== this.focusedRack) {
                finalOpacity = 0.3;
            }

            this.drawCabinetRack(
                ctx,
                isoX,
                isoY,
                rackWidth * scale * 1.5,
                rackHeight * scale * 2,
                rackDepth * scale,
                rack,
                finalOpacity
            );
        });

        // Indicador de rotación
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`🔄 ${Math.round(this.rotation3D)}°`, 10, 25);

        ctx.font = '12px Arial';
        ctx.fillText(`${racks.length} estanterías - Arrastre para girar`, 10, 45);
    }

    // Dibujar la cuadrícula del suelo en perspectiva
    drawFloorGrid(ctx, width, height) {
        ctx.save();

        const gridSize = 40;
        const centerX = width / 2;
        const centerY = height / 2 + 50;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;

        // Líneas radiales
        for (let i = 0; i < 12; i++) {
            const angle = (i * 30 + this.rotation3D) * Math.PI / 180;
            const x1 = centerX + Math.cos(angle) * 50;
            const y1 = centerY + Math.sin(angle) * 25;
            const x2 = centerX + Math.cos(angle) * 250;
            const y2 = centerY + Math.sin(angle) * 125;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        // Círculos concéntricos
        for (let r = 50; r <= 250; r += 50) {
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, r, r * 0.5, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    // Dibujar una estantería como un armario (perspectiva frontal)
    drawCabinetRack(ctx, x, y, width, height, depth, rack, opacity = 1) {
        ctx.save();
        ctx.globalAlpha = opacity;

        // ✅ CORRECCIÓN: Invertir ancho y profundidad si rotación cercana a 90° o 270°
        let effectiveWidth = width;
        let effectiveDepth = depth;
        let showSide = false; // true = vemos el lado en lugar de la cara

        if (rack.rotation && rack.rotation !== 0) {
            const angle = rack.rotation % 360;

            // Si rotación cercana a 90° o 270°, invertir las dimensiones
            if ((angle > 45 && angle < 135) || (angle > 225 && angle < 315)) {
                effectiveWidth = depth;
                effectiveDepth = width;
                showSide = true;
            }
        }

        const cabinetWidth = effectiveWidth;
        const cabinetHeight = height;
        const cabinetDepth = effectiveDepth * 0.3;

        // Cara frontal
        ctx.fillStyle = rack.color;
        ctx.fillRect(x - cabinetWidth/2, y - cabinetHeight, cabinetWidth, cabinetHeight);

        // Borde
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - cabinetWidth/2, y - cabinetHeight, cabinetWidth, cabinetHeight);

        // Código del rack - SIEMPRE en la cara frontal, incluso para estanterías giradas
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // ELIMINAR el if/else para showSide
        // SIEMPRE dibujar en la cara frontal
        ctx.fillText(rack.code, x, y - cabinetHeight/2);

        // Efecto de profundidad (lado derecho)
        ctx.fillStyle = this.adjustColor(rack.color, -20);
        ctx.beginPath();
        ctx.moveTo(x + cabinetWidth/2, y - cabinetHeight);
        ctx.lineTo(x + cabinetWidth/2 + cabinetDepth, y - cabinetHeight - cabinetDepth*0.5);
        ctx.lineTo(x + cabinetWidth/2 + cabinetDepth, y - cabinetDepth*0.5);
        ctx.lineTo(x + cabinetWidth/2, y);
        ctx.closePath();
        ctx.fill();

        // ✅ NUEVO: Si showSide, dibujar los cajones en la cara lateral derecha
        if (showSide && rack.levels && rack.levels.length > 0) {
            const lateralWidth = cabinetDepth;
            const lateralHeight = cabinetHeight;

            // Cara lateral con cajones
            ctx.fillStyle = rack.color;
            ctx.beginPath();
            ctx.moveTo(x + cabinetWidth/2, y - cabinetHeight);
            ctx.lineTo(x + cabinetWidth/2 + lateralWidth, y - cabinetHeight - lateralWidth*0.5);
            ctx.lineTo(x + cabinetWidth/2 + lateralWidth, y - lateralWidth*0.5);
            ctx.lineTo(x + cabinetWidth/2, y);
            ctx.closePath();
            ctx.fill();

            // Dibujar los niveles en esta cara lateral
            const levelHeight = lateralHeight / rack.levels.length;
            const sortedLevels = [...rack.levels].sort((a, b) => parseInt(a.code) - parseInt(b.code));

            sortedLevels.forEach((level, index) => {
                const levelYTop = y - cabinetHeight + (index * levelHeight);
                const levelYBottom = levelYTop + levelHeight;

                // Línea de separación en perspectiva
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x + cabinetWidth/2, levelYBottom);
                ctx.lineTo(x + cabinetWidth/2 + lateralWidth, levelYBottom - lateralWidth*0.5);
                ctx.stroke();

                // Código del nivel
                if (levelHeight > 15) {
                    ctx.fillStyle = 'rgba(255,255,255,0.8)';
                    ctx.font = '9px Arial';
                    const textX = x + cabinetWidth/2 + lateralWidth*0.3;
                    const textY = levelYTop + levelHeight/2 - lateralWidth*0.15;
                    ctx.fillText(level.code, textX, textY);
                }
            });


        }

        // Efecto de profundidad (parte superior) - PERMANECE IDÉNTICO
        ctx.fillStyle = this.adjustColor(rack.color, 10);
        ctx.beginPath();
        ctx.moveTo(x - cabinetWidth/2, y - cabinetHeight);
        ctx.lineTo(x + cabinetWidth/2, y - cabinetHeight);
        ctx.lineTo(x + cabinetWidth/2 + cabinetDepth, y - cabinetHeight - cabinetDepth*0.5);
        ctx.lineTo(x - cabinetWidth/2 + cabinetDepth, y - cabinetHeight - cabinetDepth*0.5);
        ctx.closePath();
        ctx.fill();

        // Resaltado si está seleccionado
        if (opacity < 1) {
            ctx.strokeStyle = '#ffeb3b';
            ctx.lineWidth = 3;
            ctx.strokeRect(x - cabinetWidth/2 - 2, y - cabinetHeight - 2, cabinetWidth + 4, cabinetHeight + 4);
        }

        ctx.restore();
    }

    // Dibujar una estantería en vista isométrica con efectos Rayos X y Opacidad
    drawIsoRack(ctx, x, y, width, depth, height, rack, angle, opacity = 1, xrayAlpha = 0) {
        ctx.save();
        // Aplicar la opacidad global
        ctx.globalAlpha = opacity;

        // Ángulo isométrico estándar (30°)
        const iso = Math.PI / 6; // 30 grados

        // Puntos base del rack (en el suelo)
        const basePoints = [
            { x: -width/2, z: -depth/2 },
            { x: width/2, z: -depth/2 },
            { x: width/2, z: depth/2 },
            { x: -width/2, z: depth/2 }
        ];

        // Convertir a coordenadas isométricas
        const isoPoints = basePoints.map(p => ({
            x: x + (p.x * Math.cos(iso) - p.z * Math.cos(iso)),
            y: y + (p.x * Math.sin(iso) + p.z * Math.sin(iso))
        }));

        // Calcular los colores con efecto Rayos X (más transparente = más claro)
        const faceOpacity = 1 - (xrayAlpha * 0.7); // Máx 70% de transparencia

        // Cara frontal (más oscura)
        ctx.fillStyle = this.adjustColor(rack.color, -30);
        ctx.globalAlpha = opacity * faceOpacity;
        ctx.beginPath();
        ctx.moveTo(isoPoints[0].x, isoPoints[0].y);
        ctx.lineTo(isoPoints[1].x, isoPoints[1].y);
        ctx.lineTo(isoPoints[1].x, isoPoints[1].y - height);
        ctx.lineTo(isoPoints[0].x, isoPoints[0].y - height);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.globalAlpha = opacity;
        ctx.stroke();

        // Cara derecha (aún más oscura)
        ctx.fillStyle = this.adjustColor(rack.color, -50);
        ctx.globalAlpha = opacity * faceOpacity;
        ctx.beginPath();
        ctx.moveTo(isoPoints[1].x, isoPoints[1].y);
        ctx.lineTo(isoPoints[2].x, isoPoints[2].y);
        ctx.lineTo(isoPoints[2].x, isoPoints[2].y - height);
        ctx.lineTo(isoPoints[1].x, isoPoints[1].y - height);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = opacity;
        ctx.stroke();

        // Cara superior (más clara)
        ctx.fillStyle = this.adjustColor(rack.color, 20);
        ctx.globalAlpha = opacity * faceOpacity;
        ctx.beginPath();
        ctx.moveTo(isoPoints[0].x, isoPoints[0].y - height);
        ctx.lineTo(isoPoints[1].x, isoPoints[1].y - height);
        ctx.lineTo(isoPoints[2].x, isoPoints[2].y - height);
        ctx.lineTo(isoPoints[3].x, isoPoints[3].y - height);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = opacity;
        ctx.stroke();

        // Dibujar los niveles (VISIBLES con Rayos X)
        if (rack.levels && rack.levels.length > 0) {
            const levelHeight = height / rack.levels.length;

            rack.levels.forEach((level, index) => {
                const levelY = y - (index + 1) * levelHeight;

                // Línea de separación (más visible con rayos X)
                const lineAlpha = 0.5 + (xrayAlpha * 0.5); // Más visible con rayos X
                ctx.strokeStyle = `rgba(0,0,0,${lineAlpha})`;
                ctx.lineWidth = 2;
                ctx.globalAlpha = opacity;
                ctx.beginPath();
                ctx.moveTo(isoPoints[0].x, levelY);
                ctx.lineTo(isoPoints[1].x, levelY);
                ctx.lineTo(isoPoints[2].x, levelY);
                ctx.stroke();

                // EFECTO RAYOS X: Mostrar el contenido del nivel
                if (xrayAlpha > 0.3) {
                    this.drawLevelContents(ctx, isoPoints, levelY, levelHeight, level, xrayAlpha, opacity);
                }
            });
        }

        // Código del rack
        ctx.globalAlpha = opacity;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(rack.code, x, y - height/2);
        ctx.shadowBlur = 0;

        // Indicador del número de niveles
        if (rack.levels && rack.levels.length > 0) {
            ctx.font = '10px Arial';
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillText(`${rack.levels.length} niveles`, x, y - height - 10);
        }

        // Efecto de resplandor si rayos X activo
        if (xrayAlpha > 0) {
            ctx.globalAlpha = xrayAlpha * 0.5;
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 10;

            // Contorno brillante
            ctx.beginPath();
            ctx.moveTo(isoPoints[0].x, isoPoints[0].y);
            ctx.lineTo(isoPoints[1].x, isoPoints[1].y);
            ctx.lineTo(isoPoints[1].x, isoPoints[1].y - height);
            ctx.lineTo(isoPoints[0].x, isoPoints[0].y - height);
            ctx.closePath();
            ctx.stroke();

            ctx.shadowBlur = 0;
        }

        ctx.restore();
    }

    // Dibujar el contenido de un nivel (visible en modo Rayos X)
    drawLevelContents(ctx, isoPoints, levelY, levelHeight, level, xrayAlpha, opacity) {
        if (!level.slots || level.slots.length === 0) return;

        ctx.save();

        // Calcular el ancho del nivel
        const levelWidth = Math.abs(isoPoints[1].x - isoPoints[0].x);
        const slotWidth = levelWidth / Math.max(level.slots.length, 1);

        // Recorrer los huecos
        level.slots.forEach((slot, index) => {
            const slotX = isoPoints[0].x + (index + 0.5) * slotWidth;
            const slotY = levelY - levelHeight / 2;

            // Verificar si el hueco contiene artículos
            const hasArticles = slot.articles && slot.articles.length > 0;

            if (hasArticles) {
                const article = slot.articles[0];
                const quantity = article.quantity || article.stock_actuel || 0;

                // Color según el stock
                let stockColor = '#2ecc71'; // Verde por defecto
                if (quantity === 0) {
                    stockColor = '#e74c3c'; // Rojo
                } else if (quantity <= (article.stock_minimum || 3)) {
                    stockColor = '#f39c12'; // Naranja
                }

                // Dibujar una pequeña caja para el artículo
                const boxSize = Math.min(slotWidth * 0.6, 8);

                ctx.globalAlpha = opacity * xrayAlpha;
                ctx.fillStyle = stockColor;
                ctx.beginPath();
                ctx.arc(slotX, slotY, boxSize / 2, 0, Math.PI * 2);
                ctx.fill();

                // Borde brillante
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.stroke();

                // Mostrar la cantidad si hay suficiente espacio
                if (boxSize > 5 && xrayAlpha > 0.7) {
                    ctx.globalAlpha = opacity * xrayAlpha;
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 7px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(quantity.toString(), slotX, slotY);
                }
            } else {
                // Hueco vacío - pequeño punto gris
                ctx.globalAlpha = opacity * xrayAlpha * 0.3;
                ctx.fillStyle = '#95a5a6';
                const emptySize = Math.min(slotWidth * 0.3, 4);
                ctx.beginPath();
                ctx.arc(slotX, slotY, emptySize / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        ctx.restore();
    }

    // Ajustar el brillo de un color
    adjustColor(color, amount) {
        // Convertir hex a RGB
        const hex = color.replace('#', '');
        let r = parseInt(hex.substr(0, 2), 16);
        let g = parseInt(hex.substr(2, 2), 16);
        let b = parseInt(hex.substr(4, 2), 16);

        // Ajustar
        r = Math.max(0, Math.min(255, r + amount));
        g = Math.max(0, Math.min(255, g + amount));
        b = Math.max(0, Math.min(255, b + amount));

        // Reconverter a hex
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    // En QuadViewManager

    updateLevelView(level) {
        const container = document.getElementById('quadLevelSlots');
        if (!container || !level) return;

        // Verificar si ya hay un cajón abierto
        const currentDrawer = container.querySelector('.quad-drawer-container');

        if (currentDrawer && currentDrawer.classList.contains('open')) {
            // Cerrar el cajón actual con animación
            currentDrawer.classList.remove('open');

            // Esperar AL FIN de la animación de cierre (700ms)
            setTimeout(() => {
                container.innerHTML = '';
                this.createDrawer(container, level);
            }, 700);
        } else {
            // Sin cajón abierto, crear directamente
            container.innerHTML = '';
            this.createDrawer(container, level);
        }
    }

    createDrawer(container, level) {
        // Crear la estructura del cajón
        const drawerContainer = document.createElement('div');
        drawerContainer.className = 'quad-drawer-container';

        // Título en una línea
        drawerContainer.innerHTML = `
            <div class="drawer-front">
                <div>Nivel ${level.code}</div>
                <div class="level-label">${level.slots?.length || 0} huecos</div>
                <div class="drawer-handle" title="Haga clic para abrir/cerrar"></div>
            </div>
            <div class="drawer-body">
                <div class="drawer-interior">
                    ${this.generateSlotElements(level.slots)}
                </div>
            </div>
        `;

        container.appendChild(drawerContainer);

        // Abrir el cajón después de un corto retraso
        setTimeout(() => {
            drawerContainer.classList.add('open');
        }, 100);

        // Evento en el asa
        const handle = drawerContainer.querySelector('.drawer-handle');
        handle.addEventListener('click', (e) => {
            e.stopPropagation();
            drawerContainer.classList.toggle('open');
        });

        document.getElementById('quadLevelInfo').textContent =
            `Nivel ${level.code} - ${level.slots?.length || 0} huecos`;
    }

    // En QuadViewManager - Modifique generateSlotElements() :

    generateSlotElements(slots) {
        if (!slots || slots.length === 0) {
            return `
                <div class="empty-drawer-message">
                    <i class="fas fa-box-open"></i>
                    <p>Cajón vacío</p>
                </div>
            `;
        }

        const sortedSlots = [...slots].sort((a, b) => {
            return parseInt(a.code) - parseInt(b.code);
        });

        let html = '';

        const slotCount = sortedSlots.length;
        let zoomClass = 'zoom-large';
        if (slotCount > 14) zoomClass = 'zoom-small';
        else if (slotCount > 9) zoomClass = 'zoom-medium';

        sortedSlots.forEach(slot => {
            const article = slot.articles && slot.articles.length > 0 ? slot.articles[0] : null;
            const stockLevel = article ? this.getStockLevel(article) : '';

            html += `
                <div class="quad-slot ${zoomClass} ${article ? 'occupied ' + stockLevel : ''} ${this.selectedSlot && this.selectedSlot.id === slot.id ? 'selected-slot animating' : ''}"
                     data-slot-id="${slot.id}"
                     data-slot-code="${slot.code}"
                     data-full-code="${slot.full_code}"
                     data-article-id="${article ? article.id : ''}"
                     title="${this.generateSlotTooltip(slot, article)}">
                    ${this.generateSlotContent(slot, article, zoomClass)}
                </div>
            `;
        });

        // DESPUÉS de crear el HTML, añadir los eventos con setTimeout
        setTimeout(() => {
            this.bindSlotEvents();
        }, 300);

        return html; // <-- AÑADIR ESTA LÍNEA
    } // <-- CIERRE DE LA FUNCIÓN AQUÍ

    // NUEVO MÉTODO - Eventos en los huecos
    bindSlotEvents() {
        const slots = document.querySelectorAll('.quad-slot.occupied');

        slots.forEach(slot => {
            slot.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openStockModal(slot);
            });
        });
    }

    // NUEVO MÉTODO - Abrir el modal
    openStockModal(slotElement) {
        // ✅ NUEVO: Quitar la selección anterior
        const previousSelected = document.querySelectorAll('.quad-slot.selected-slot');
        previousSelected.forEach(slot => {
            slot.classList.remove('selected-slot', 'animating');
        });

        // Limpiar el timeout de animación
        if (this.slotAnimationTimeout) {
            clearTimeout(this.slotAnimationTimeout);
            this.slotAnimationTimeout = null;
        }

        // ✅ NUEVO: Reinicializar la selección anterior
        this.selectedSlot = null;
        this.selectedLevel = null;
        this.isSlotAnimating = false;

        // ✅ NUEVO: Redibujar la vista Front para quitar el marco amarillo
        if (this.selectedRack) {
            this.drawFrontView(this.selectedRack);
        }

        const slotId = slotElement.dataset.slotId;
        const slotCode = slotElement.dataset.slotCode;
        const fullCode = slotElement.dataset.fullCode;
        const articleId = slotElement.dataset.articleId;

        if (!articleId) return;

        // Encontrar el artículo en los datos
        const article = this.findArticleById(articleId);
        if (!article) return;

        // Rellenar el modal
        document.getElementById('modalArticlePhoto').src =
            article.photo || article.photo_url || 'https://via.placeholder.com/150x150/cccccc/666666?text=📦';

        document.getElementById('modalArticleName').textContent =
            article.name || article.nom || 'Artículo';

        document.getElementById('modalSlotCode').textContent = fullCode;
        document.getElementById('modalBarcode').textContent =
            article.barcode || article.code_barre || 'N/A';

        const currentStock = article.quantity || article.stock_actuel || 0;
        document.getElementById('modalCurrentStock').textContent = currentStock;
        document.getElementById('modalCurrentStock').className =
            'detail-value ' + this.getStockLevel(article);

        const minStock = article.stock_minimum || 0;
        document.getElementById('modalMinStock').textContent = minStock;

        // Definir el valor del input
        const stockInput = document.getElementById('modalStockInput');
        stockInput.value = currentStock;
        stockInput.dataset.articleId = articleId;
        stockInput.dataset.currentStock = currentStock;

        // Abrir el modal
        document.getElementById('stockModalOverlay').classList.add('active');
    }

    // NUEVO MÉTODO - Encontrar un artículo por ID
    findArticleById(articleId) {
        // Recorrer todas las estanterías, niveles y huecos
        if (!window.vueStock || !window.vueStock.racks) return null;

        for (const rack of window.vueStock.racks) {
            if (!rack.levels) continue;

            for (const level of rack.levels) {
                if (!level.slots) continue;

                for (const slot of level.slots) {
                    if (!slot.articles || slot.articles.length === 0) continue;

                    const article = slot.articles[0];
                    if (article.id === articleId) {
                        return article;
                    }
                }
            }
        }

        return null;
    }

    // Inicializar los eventos del modal (llamar una vez al cargar)
    initStockModal() {
        const overlay = document.getElementById('stockModalOverlay');
        const modal = document.getElementById('stockModal');

        // Cerrar el modal
        document.getElementById('closeStockModal').addEventListener('click', () => {
            overlay.classList.remove('active');
        });

        document.getElementById('cancelStockModal').addEventListener('click', () => {
            overlay.classList.remove('active');
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });

        // Botones +/-
        document.getElementById('btnIncrease').addEventListener('click', () => {
            const input = document.getElementById('modalStockInput');
            input.value = parseInt(input.value || 0) + 1;
        });

        document.getElementById('btnDecrease').addEventListener('click', () => {
            const input = document.getElementById('modalStockInput');
            const current = parseInt(input.value || 0);
            if (current > 0) {
                input.value = current - 1;
            }
        });

        // Guardar
        document.getElementById('saveStockModal').addEventListener('click', async () => {
            await this.saveStockChanges();
        });
    }

    // NUEVO MÉTODO - Guardar los cambios
    async saveStockChanges() {
        const input = document.getElementById('modalStockInput');
        const articleId = input.dataset.articleId;
        const newQuantity = parseInt(input.value || 0);
        const oldQuantity = parseInt(input.dataset.currentStock || 0);

        if (newQuantity === oldQuantity) {
            alert('No se detectaron cambios');
            return;
        }

        if (newQuantity < 0) {
            alert('La cantidad no puede ser negativa');
            return;
        }

        // GUARDAR originalText ANTES del try
        const saveBtn = document.getElementById('saveStockModal');
        const originalText = saveBtn.innerHTML; // <-- MOVIDO AQUÍ

        try {
            // Desactivar el botón durante la guarda
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
            saveBtn.disabled = true;

            // Llamar a la API para actualizar
            if (window.vueStock && window.vueStock.api) {
                const result = await window.vueStock.api.updateStock({
                    article_id: articleId,
                    new_quantity: newQuantity
                });

                if (result.success) {
                    // Actualizar localmente
                    this.updateLocalStock(articleId, newQuantity);

                    // Actualizar la visualización
                    this.refreshSlotDisplay(articleId, newQuantity);

                    // AÑADIDO IMPORTANTE: Actualizar las estadísticas
                    if (window.vueStock.updateStats) {
                        window.vueStock.updateStats();
                    }

                    // Cerrar el modal
                    document.getElementById('stockModalOverlay').classList.remove('active');

                    // Notificación
                    if (window.vueStock.showNotification) {
                        window.vueStock.showNotification(`Stock actualizado: ${oldQuantity} → ${newQuantity}`);
                    }
                }
            }
        } catch (error) {
            console.error('Error actualizando stock:', error);
            alert('Error: ' + error.message);
        } finally {
            // Reactivar el botón - originalText ahora es accesible
            saveBtn.innerHTML = originalText; // <-- CORRECTO
            saveBtn.disabled = false;
        }
    }

    // NUEVO MÉTODO - Actualizar localmente
    updateLocalStock(articleId, newQuantity) {
        if (!window.vueStock || !window.vueStock.racks) return;

        for (const rack of window.vueStock.racks) {
            if (!rack.levels) continue;

            for (const level of rack.levels) {
                if (!level.slots) continue;

                for (const slot of level.slots) {
                    if (!slot.articles || slot.articles.length === 0) continue;

                    const article = slot.articles[0];
                    if (article.id === articleId) {
                        article.quantity = newQuantity;
                        article.stock_actuel = newQuantity;
                        break;
                    }
                }
            }
        }
    }

    // NUEVO MÉTODO - Actualizar la visualización
    refreshSlotDisplay(articleId, newQuantity) {
        // Encontrar el hueco correspondiente
        const slotElement = document.querySelector(`[data-article-id="${articleId}"]`);
        if (!slotElement) return;

        // Actualizar la cantidad mostrada
        const quantityElement = slotElement.querySelector('.article-quantity');
        if (quantityElement) {
            quantityElement.textContent = newQuantity;
        }

        // Actualizar el color según el nuevo stock
        const article = this.findArticleById(articleId);
        if (article) {
            const newStockLevel = this.getStockLevel(article);

            // Quitar las clases antiguas
            slotElement.classList.remove('stock-good', 'stock-low', 'stock-zero');

            // Añadir la nueva clase
            if (newStockLevel) {
                slotElement.classList.add(newStockLevel);
            }

            // Actualizar el tooltip
            const slotData = {
                code: slotElement.dataset.slotCode,
                full_code: slotElement.dataset.fullCode,
                articles: [article]
            };
            slotElement.title = this.generateSlotTooltip(slotData, article);
        }
    }

    getStockLevel(article) {
        if (!article) return '';

        const stockActuel = article.stock_actuel || 0;
        const stockMinimum = article.stock_minimum || 0;

        if (stockActuel === 0) {
            return 'stock-zero';
        } else if (stockActuel <= stockMinimum) {
            return 'stock-low';
        } else {
            return 'stock-good';
        }
    }

    generateSlotTooltip(slot, article) {
        const baseText = `Hueco ${slot.code}`;

        if (!article) {
            return `${baseText} - Libre`;
        }

        const stockActuel = article.stock_actuel || 0;
        const stockMinimum = article.stock_minimum || 0;
        const articleName = article.nom || 'Artículo';

        let status = '';
        if (stockActuel === 0) {
            status = 'Stock agotado';
        } else if (stockActuel <= stockMinimum) {
            status = `Stock bajo (mín: ${stockMinimum})`;
        } else {
            status = `Stock OK (mín: ${stockMinimum})`;
        }

        return `${baseText} - ${articleName}\n${stockActuel} unidades - ${status}`;
    }


    generateSlotContent(slot, article, zoomClass) {
        if (!article) {
            // Hueco vacío
            return `
                <div class="quad-slot-code">${slot.code}</div>
                <div class="quad-slot-status">Libre</div>
            `;
        }

        // CORRECCIÓN DE NOMBRES DE COLUMNAS:
        const imageUrl = article.photo || article.photo_url || 'https://via.placeholder.com/40x40/cccccc/666666?text=📦';
        const stock = article.quantity || article.stock_actuel || 0;
        const articleName = article.name || article.nom || 'Artículo';

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

    // Modifique getStockLevel():
    getStockLevel(article) {
        if (!article) return '';

        // CORRECCIÓN: sus columnas son 'quantity' y no 'stock_actuel'
        // Pero no veo 'stock_minimum' en sus datos...
        const stockActuel = article.quantity || article.stock_actuel || 0;

        // Usted debe tener 'stock_minimum' en sus datos Supabase
        // Si no, use un valor por defecto o añada la columna
        const stockMinimum = article.stock_minimum || 3; // 3 por defecto según su INSERT

        if (stockActuel === 0) {
            return 'stock-zero';
        } else if (stockActuel <= stockMinimum) {
            return 'stock-low';
        } else {
            return 'stock-good';
        }
    }

    // Modifique generateSlotTooltip():
    generateSlotTooltip(slot, article) {
        const baseText = `Hueco ${slot.code}`;

        if (!article) {
            return `${baseText} - Libre`;
        }

        const stockActuel = article.quantity || article.stock_actuel || 0;
        const stockMinimum = article.stock_minimum || 3; // Valor por defecto
        const articleName = article.name || article.nom || 'Artículo';

        let status = '';
        if (stockActuel === 0) {
            status = 'Stock agotado';
        } else if (stockActuel <= stockMinimum) {
            status = `Stock bajo (mín: ${stockMinimum})`;
        } else {
            status = `Stock OK (mín: ${stockMinimum})`;
        }

        return `${baseText} - ${articleName}\n${stockActuel} unidades - ${status}`;
    }

    drawGrid(ctx, width, height, size) {
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;

        // Líneas verticales
        for (let x = 0; x < width; x += size) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Líneas horizontales
        for (let y = 0; y < height; y += size) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }

    reset3DView() {
        console.log('Vista 3D reinicializada');

        // Cancelar cualquier animación en curso
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        // Animación de retorno a la posición inicial
        const targetRotation = 0;
        const currentRotation = this.rotation3D || 0;
        const diff = targetRotation - currentRotation;

        let step = 0;
        const steps = 40; // Animación más larga para el reset
        const animate = () => {
            step++;
            const newRotation = currentRotation + (diff * step / steps);

            // Verificar que el valor es válido
            if (!isNaN(newRotation) && isFinite(newRotation)) {
                this.rotation3D = newRotation;
            }

            // Reinicializar también el ángulo isométrico
            this.isometric.angle = 30;

            if (this.currentRacks) {
                this.draw3DView(this.currentRacks);
            }

            if (step < steps) {
                this.animationFrame = requestAnimationFrame(animate);
            } else {
                // Forzar exactamente 0 al final
                this.rotation3D = 0;
                if (this.currentRacks) {
                    this.draw3DView(this.currentRacks);
                }
                this.animationFrame = null;
            }
        };

        animate();
    }

    animate3DRotation(targetRotation) {
        if (this.rotation3DAnimFrame) {
            cancelAnimationFrame(this.rotation3DAnimFrame);
        }

        const startRotation = this.rotation3D || 0;

        // ELIMINAR esta inversión
        // const invertedTarget = -targetRotation; // ← A ELIMINAR
        const finalTarget = targetRotation; // ← USAR directamente targetRotation

        let diff = finalTarget - startRotation; // ← CAMBIADO: finalTarget en lugar de invertedTarget
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;

        const finalRotation = startRotation + diff;

        let step = 0;
        const steps = 40;

        const animate = () => {
            step++;
            const progress = step / steps;
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            this.rotation3D = startRotation + (finalRotation - startRotation) * easeProgress;

            if (this.currentRacks) {
                this.draw3DView(this.currentRacks);
            }

            if (step < steps) {
                this.rotation3DAnimFrame = requestAnimationFrame(animate);
            } else {
                this.rotation3D = finalTarget; // ← CAMBIADO: finalTarget en lugar de invertedTarget
                if (this.currentRacks) {
                    this.draw3DView(this.currentRacks);
                }
            }
        };

        animate();
    }

    // Encontrar qué estantería está bajo una posición del ratón
    findRackAt3DPosition(mouseX, mouseY) {
        if (!this.currentRacks || this.currentRacks.length === 0) return null;

        const width = this.canvas3D.width;
        const height = this.canvas3D.height;
        const centerX = width / 2;
        const centerY = height / 2 + 50;

        // Disposición lineal (DEBE COINCIDIR con draw3DView)
        const startX = -200;
        const spacingX = 120;

        // Ordenar como en draw3DView
        const sortedRacks = [...this.currentRacks].sort((a, b) => {
            return (a.position_x || 0) - (b.position_x || 0);
        });

        // Recorrer todas las estanterías
        for (let i = 0; i < sortedRacks.length; i++) {
            const rack = sortedRacks[i];

            // Posición lineal (idéntica a draw3DView)
            const x = startX + (i * spacingX);
            const z = 0; // Todas a la misma profundidad

            // Proyección isométrica
            const isoX = centerX + x * this.isometric.scale;
            const isoY = centerY - z * this.isometric.scale * 0.5;

            // Escala
            const depthScale = 1 - (i / sortedRacks.length) * 0.1;
            const scale = depthScale;
            const rackWidth = rack.width * 20 * scale;
            const rackHeight = (rack.levels?.length || 1) * 12 * scale;

            // Zona de detección (rectángulo)
            const left = isoX - rackWidth / 2;
            const right = isoX + rackWidth / 2;
            const top = isoY - rackHeight;
            const bottom = isoY;

            // Verificar si el ratón está en esta zona
            if (mouseX >= left && mouseX <= right && mouseY >= top && mouseY <= bottom) {
                return rack;
            }
        }

        return null;
    }

    // Iniciar el efecto Rayos X
    startXRayEffect() {
        // Cancelar la animación anterior si existe
        if (this.xrayAnimFrame) {
            cancelAnimationFrame(this.xrayAnimFrame);
        }

        // Animación progresiva
        const animate = () => {
            this.xrayProgress += 0.08; // Velocidad de aparición
            if (this.xrayProgress > 1) this.xrayProgress = 1;

            if (this.currentRacks) {
                this.draw3DView(this.currentRacks);
            }

            if (this.xrayProgress < 1) {
                this.xrayAnimFrame = requestAnimationFrame(animate);
            }
        };

        animate();
    }

    // Detener el efecto Rayos X
    stopXRayEffect() {
        // Cancelar la animación
        if (this.xrayAnimFrame) {
            cancelAnimationFrame(this.xrayAnimFrame);
        }

        // Animación de desaparición
        const animate = () => {
            this.xrayProgress -= 0.1; // Velocidad de desaparición
            if (this.xrayProgress < 0) this.xrayProgress = 0;

            if (this.currentRacks) {
                this.draw3DView(this.currentRacks);
            }

            if (this.xrayProgress > 0) {
                this.xrayAnimFrame = requestAnimationFrame(animate);
            }
        };

        animate();
    }

    // Hacer zoom en una estantería
    zoomOnRack(rack) {
        // Si ya es la estantería en foco, deshacer zoom
        if (this.focusedRack === rack) {
            this.resetZoom();
            return;
        }

        this.focusedRack = rack;

        // Cancelar animación anterior
        if (this.zoomAnimFrame) {
            cancelAnimationFrame(this.zoomAnimFrame);
        }

        // Encontrar el ángulo de la estantería para centrarla
        const rackIndex = this.currentRacks.indexOf(rack);
        const baseAngle = (rackIndex / this.currentRacks.length) * 360;

        // Calcular la rotación necesaria para centrar la estantería
        // Queremos que la estantería esté a 0° (de frente a nosotros)
        let targetRotation = -baseAngle;

        // Normalizar el ángulo para encontrar el camino más corto
        const currentRotation = this.rotation3D;
        let diff = targetRotation - currentRotation;

        // Tomar el camino más corto (evitar girar 350° en lugar de 10°)
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;

        targetRotation = currentRotation + diff;

        this.camera.targetRotation = targetRotation;
        this.camera.targetScale = 1.4; // Zoom más moderado (en lugar de 1.8)

        // Animación
        const startRotation = this.rotation3D;
        const startScale = this.camera.currentScale;
        let step = 0;
        const steps = 40;

        const animate = () => {
            step++;
            const progress = step / steps;
            const easeProgress = 1 - Math.pow(1 - progress, 3); // Easing

            // Rotación fluida
            this.rotation3D = startRotation + (targetRotation - startRotation) * easeProgress;

            // Zoom fluido
            this.camera.currentScale = startScale + (this.camera.targetScale - startScale) * easeProgress;
            this.zoomProgress = easeProgress;

            if (this.currentRacks) {
                this.draw3DView(this.currentRacks);
            }

            if (step < steps) {
                this.zoomAnimFrame = requestAnimationFrame(animate);
            }
        };

        animate();

        console.log(`🔍 Zoom en estantería ${rack.code} - Rotación: ${Math.round(targetRotation)}°, Escala: 1.4x`);
    }

    // Reinicializar el zoom
    resetZoom() {
        this.focusedRack = null;

        // Cancelar animación anterior
        if (this.zoomAnimFrame) {
            cancelAnimationFrame(this.zoomAnimFrame);
        }

        this.camera.targetScale = 1;
        const startScale = this.camera.currentScale;
        let step = 0;
        const steps = 30;

        const animate = () => {
            step++;
            const progress = step / steps;
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            this.camera.currentScale = startScale + (1 - startScale) * easeProgress;
            this.zoomProgress = 1 - easeProgress;

            if (this.currentRacks) {
                this.draw3DView(this.currentRacks);
            }

            if (step < steps) {
                this.zoomAnimFrame = requestAnimationFrame(animate);
            }
        };

        animate();
    }

    updateInfoPanel(racks) {
        document.getElementById('racksCount').textContent = racks.length;

        if (this.selectedRack) {
            document.getElementById('selectedElement').textContent =
                `Estantería ${this.selectedRack.code}`;
        } else if (this.selectedLevel) {
            document.getElementById('selectedElement').textContent =
                `Nivel ${this.selectedLevel.code}`;
        }
    }

    // Actualizar el panel Propiedades a la izquierda
    updatePropertiesPanel(rack) {
        const panel = document.getElementById('propertiesPanel');
        if (!panel) {
            console.warn('Panel Propiedades no encontrado');
            return;
        }

        // Verificar si la estantería tiene niveles
        const levelCount = rack.levels ? rack.levels.length : 0;
        const slotCount = rack.levels ? rack.levels.reduce((sum, level) =>
            sum + (level.slots ? level.slots.length : 0), 0) : 0;

        panel.innerHTML = `
            <h4><i class="fas fa-warehouse"></i> Estantería ${rack.code}</h4>
            <div class="property-group">
                <div class="property">
                    <span class="property-label">Nombre:</span>
                    <input type="text" class="property-input" id="quadRackName"
                           value="${rack.name || 'Estantería ' + rack.code}"
                           placeholder="Nombre de la estantería">
                </div>
                <div class="property">
                    <span class="property-label">Posición:</span>
                    <div class="property-coords">
                        <input type="number" class="coord-input" id="quadRackX"
                               value="${Math.round(rack.position_x / 40)}" min="0" title="Posición X">
                        <span>×</span>
                        <input type="number" class="coord-input" id="quadRackY"
                               value="${Math.round(rack.position_y / 40)}" min="0" title="Posición Y">
                    </div>
                </div>
                <div class="property">
                    <span class="property-label">Dimensiones:</span>
                    <div class="property-dimensions">
                        <input type="number" class="dim-input" id="quadRackWidth"
                               value="${rack.width}" min="1" max="10" title="Ancho en casillas">
                        <span>×</span>
                        <input type="number" class="dim-input" id="quadRackDepth"
                               value="${rack.depth}" min="1" max="10" title="Profundidad en casillas">
                    </div>
                </div>
                <div class="property">
                    <span class="property-label">Rotación:</span>
                    <div class="property-rotation">
                        <input type="range" class="rotation-slider" id="quadRackRotation"
                               value="${rack.rotation || 0}" min="0" max="360" step="15">
                        <span class="rotation-value">${rack.rotation || 0}°</span>
                    </div>
                </div>
                <div class="property">
                    <span class="property-label">Color:</span>
                    <input type="color" class="property-color" id="quadRackColor"
                           value="${rack.color || '#4a90e2'}">
                </div>
                <div class="property">
                    <span class="property-label">Contenido:</span>
                    <span class="property-value">
                        ${levelCount} nivel(es), ${slotCount} hueco(s)
                    </span>
                </div>
            </div>

            <div class="property-actions">
                <button class="btn btn-sm btn-primary btn-block" id="quadSaveRack">
                    <i class="fas fa-save"></i> Guardar
                </button>
                <button class="btn btn-sm btn-danger btn-block" id="quadDeleteRack">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
                <button class="btn btn-sm btn-secondary btn-block" id="quadViewRackDetails">
                    <i class="fas fa-eye"></i> Ver niveles
                </button>
            </div>
        `;

        // Añadir los eventos
        this.bindPropertiesEvents(rack);
    }

    // Vaciar el panel Propiedades
    clearPropertiesPanel() {
        const panel = document.getElementById('propertiesPanel');
        if (panel) {
            panel.innerHTML = '<p class="no-selection">Seleccione un elemento para ver sus propiedades</p>';
        }
    }

    // Enlazar los eventos del panel Propiedades
    bindPropertiesEvents(rack) {
        // Actualización en tiempo real de la rotación
        const rotationSlider = document.getElementById('quadRackRotation');
        const rotationValue = document.querySelector('.rotation-value');

        if (rotationSlider && rotationValue) {
            rotationSlider.addEventListener('input', (e) => {
                rotationValue.textContent = e.target.value + '°';
                rack.rotation = parseInt(e.target.value);
                this.drawTopView(this.currentRacks);
            });
        }

        // Actualización del color en tiempo real
        const colorInput = document.getElementById('quadRackColor');
        if (colorInput) {
            colorInput.addEventListener('input', (e) => {
                rack.color = e.target.value;
                this.drawTopView(this.currentRacks);
            });
        }

        // Botón Guardar
        const saveBtn = document.getElementById('quadSaveRack');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveRackChanges(rack);
            });
        }

        // Botón Eliminar
        const deleteBtn = document.getElementById('quadDeleteRack');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.deleteRack(rack);
            });
        }

        // Botón Ver niveles
        const viewBtn = document.getElementById('quadViewRackDetails');
        if (viewBtn) {
            viewBtn.addEventListener('click', () => {
                this.viewRackDetails(rack);
            });
        }
    }

    async saveRackChanges(rack) {
        if (!rack) return;

        // Recuperar los valores modificados
        const nameInput = document.getElementById('quadRackName');
        const xInput = document.getElementById('quadRackX');
        const yInput = document.getElementById('quadRackY');
        const widthInput = document.getElementById('quadRackWidth');
        const depthInput = document.getElementById('quadRackDepth');
        const rotationInput = document.getElementById('quadRackRotation');
        const colorInput = document.getElementById('quadRackColor');

        if (nameInput) rack.name = nameInput.value;
        if (xInput) rack.position_x = parseInt(xInput.value) * 40; // Convertir a píxeles
        if (yInput) rack.position_y = parseInt(yInput.value) * 40;
        if (widthInput) rack.width = parseInt(widthInput.value);
        if (depthInput) rack.depth = parseInt(depthInput.value);
        if (rotationInput) rack.rotation = parseInt(rotationInput.value);
        if (colorInput) rack.color = colorInput.value;

        // 🔴 AÑADA ESTA LÍNEA AQUÍ (justo antes de console.log):
        // Sincronizar position_x/y con displayX/Y antes de todo
        if (typeof rack.displayX !== 'undefined' && typeof rack.displayY !== 'undefined') {
            const scale = 1;
            rack.position_x = rack.displayX / scale;
            rack.position_y = rack.displayY / scale;
        }

        console.log('Guardando la estantería:', rack);

        // Redibujar
        this.drawFrontView(rack);

        // Actualizar solo el panel sin redibujar
        this.updatePropertiesPanel(rack);

        // Guardar via API
        if (window.vueStock && window.vueStock.api) {
            try {
                const result = await window.vueStock.api.saveRack({
                    id: rack.id,
                    code: rack.code,
                    name: rack.name,
                    position_x: rack.position_x, // ✅ Ahora sincronizado
                    position_y: rack.position_y,
                    rotation: rack.rotation || 0,
                    width: rack.width,
                    depth: rack.depth,
                    color: rack.color
                });

                console.log('Estantería guardada:', result);

                // 🟢 QUITE o COMENTE estas líneas (ahora son innecesarias):
                // const scale = 1;
                // rack.position_x = rack.displayX / scale;
                // rack.position_y = rack.displayY / scale;

                this.showQuadNotification('Estantería guardada', 'success');

            } catch (error) {
                console.error('Error guardando:', error);
                this.showQuadNotification('Error guardando: ' + error.message, 'error');
            }
        } else {
            this.showQuadNotification('Modificaciones locales guardadas', 'info');
        }
    }

    // Eliminar una estantería
    async deleteRack(rack) {
        if (!rack || !confirm(`¿Eliminar la estantería ${rack.code} y todos sus niveles/huecos?`)) {
            return;
        }

        console.log('Eliminando la estantería:', rack.code);

        try {
            // Eliminar via API
            if (window.vueStock && window.vueStock.api) {
                await window.vueStock.api.deleteRack(rack.id);
            }

            // Eliminar del array local
            if (this.currentRacks) {
                const index = this.currentRacks.findIndex(r => r.id === rack.id);
                if (index !== -1) {
                    this.currentRacks.splice(index, 1);
                }
            }

            // Eliminar también de VueStock
            if (window.vueStock && window.vueStock.racks) {
                window.vueStock.racks = window.vueStock.racks.filter(r => r.id !== rack.id);
            }

            // Actualizar la visualización
            this.selectedRack = null;
            this.clearPropertiesPanel();
            this.drawTopView(this.currentRacks);
            this.updateInfoPanel(this.currentRacks);

            this.showQuadNotification(`Estantería ${rack.code} eliminada`, 'success');

        } catch (error) {
            console.error('Error eliminando:', error);
            this.showQuadNotification('Error eliminando: ' + error.message, 'error');
        }
    }

    // Ver los detalles de la estantería (ir a la vista estantería)
    viewRackDetails(rack) {
        console.log('Ver detalles de la estantería:', rack.code);

        // Usar la navegación existente de VueStock
        if (window.vueStock && window.vueStock.goToRackView) {
            window.vueStock.goToRackView(rack);
        } else {
            this.showQuadNotification('Navegación no disponible', 'warning');
        }
    }

    // Mostrar una notificación en el contexto Quad
    showQuadNotification(message, type = 'info') {
        console.log(`Quad Notificación [${type}]:`, message);

        // Usar el sistema de notificación existente o crear un simple alert
        if (window.vueStock && window.vueStock.showNotification) {
            window.vueStock.showNotification(message, type);
        } else {
            // Notificación simple
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#2ecc71' : '#3498db'};
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                z-index: 10000;
                animation: fadeInOut 3s;
            `;
            notification.textContent = message;
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.remove();
            }, 3000);
        }
    }

    getClickedHandle(clickX, clickY) {
        if (!this.selectedRack) return null;

        const rack = this.selectedRack;

        // ✅ Aplicar el scale inverso
        const scale = this.topViewScale || 1;
        const adjustedClickX = clickX / scale;
        const adjustedClickY = clickY / scale;

        const rackX = rack.displayX;
        const rackY = rack.displayY;
        const rackWidth = rack.displayWidth;
        const rackHeight = rack.displayHeight;

        const handleSize = 8;
        const rotateHandleSize = 30;

        // ✅ USAR EXACTAMENTE LOS MISMOS CÁLCULOS QUE EN drawTopView
        const rackVisualWidth = rackWidth;  // Ya en píxeles lógicos
        const rackVisualHeight = rackHeight;

        const rotateHandleCenterX = rackX + (rackVisualWidth / 2);
        const rotateHandleCenterY = rackY - 25;

        const handles = {
            nw: {
                x: rackX - handleSize/2,
                y: rackY - handleSize/2,
                width: handleSize,
                height: handleSize
            },
            ne: {
                x: rackX + rackVisualWidth - handleSize/2,
                y: rackY - handleSize/2,
                width: handleSize,
                height: handleSize
            },
            sw: {
                x: rackX - handleSize/2,
                y: rackY + rackVisualHeight - handleSize/2,
                width: handleSize,
                height: handleSize
            },
            se: {
                x: rackX + rackVisualWidth - handleSize/2,
                y: rackY + rackVisualHeight - handleSize/2,
                width: handleSize,
                height: handleSize
            },
            rotate: {
                x: rotateHandleCenterX - rotateHandleSize/2,
                y: rotateHandleCenterY - rotateHandleSize/2,
                width: rotateHandleSize,
                height: rotateHandleSize
            }
        };

        console.log('🔍 Clic ajustado:', adjustedClickX.toFixed(1), adjustedClickY.toFixed(1), '(scale:', scale.toFixed(3) + ')');
        console.log('🎯 Rotate calculada:',
                    (rotateHandleCenterX - rotateHandleSize/2).toFixed(1), '-',
                    (rotateHandleCenterX + rotateHandleSize/2).toFixed(1), ',',
                    (rotateHandleCenterY - rotateHandleSize/2).toFixed(1), '-',
                    (rotateHandleCenterY + rotateHandleSize/2).toFixed(1));

        // ✅ VERIFICACIÓN con los valores almacenados
        if (rack._debugRotateHandle) {
            console.log('🎯 Rotate DIBUJADA:',
                        rack._debugRotateHandle.left.toFixed(1), '-',
                        rack._debugRotateHandle.right.toFixed(1), ',',
                        rack._debugRotateHandle.top.toFixed(1), '-',
                        rack._debugRotateHandle.bottom.toFixed(1));
        }

        for (const [handleName, handleRect] of Object.entries(handles)) {
            const inX = adjustedClickX >= handleRect.x && adjustedClickX <= handleRect.x + handleRect.width;
            const inY = adjustedClickY >= handleRect.y && adjustedClickY <= handleRect.y + handleRect.height;

            console.log(`  ${handleName}: ${handleRect.x.toFixed(1)}-${(handleRect.x + handleRect.width).toFixed(1)}, ${handleRect.y.toFixed(1)}-${(handleRect.y + handleRect.height).toFixed(1)} -> ${inX && inY ? '✅ GOLPE!' : 'fallo'}`);

            if (inX && inY) {
                console.log('✅✅✅ Asa detectada:', handleName);
                return handleName;
            }
        }

        console.log('❌ Ningún asa detectada');
        return null;
    }

    // Iniciar el redimensionamiento desde un asa
    startResizeFromHandle(rack, handle, startX, startY) {
        console.log('Redimensionamiento desde', handle, 'para la estantería', rack.code);

        this.currentMode = 'resize';
        this.currentRack = rack;
        this.resizeHandle = handle;
        this.resizeStart = {
            x: startX,
            y: startY,
            width: rack.width,
            depth: rack.depth,
            position_x: rack.position_x,
            position_y: rack.position_y
        };

        // Cambiar el cursor según el asa
        const cursorMap = {
            'nw': 'nw-resize',
            'ne': 'ne-resize',
            'sw': 'sw-resize',
            'se': 'se-resize'
        };

        if (this.canvasTop && cursorMap[handle]) {
            this.canvasTop.style.cursor = cursorMap[handle];
        }

        // Añadir los eventos
        this.canvasTop.addEventListener('mousemove', this.handleResize.bind(this));
        this.canvasTop.addEventListener('mouseup', this.stopResize.bind(this));

        this.showQuadNotification('Redimensionamiento activado. Arrastre para modificar el tamaño.', 'info');
    }

    // Manejar el redimensionamiento
    handleResize(e) {
        if (this.currentMode !== 'resize' || !this.currentRack || !this.resizeHandle) return;

        const rect = this.canvasTop.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const deltaX = mouseX - this.resizeStart.x;
        const deltaY = mouseY - this.resizeStart.y;

        // Calcular la diferencia en casillas (cada casilla = 20px en esta vista)
        const gridSize = 20;
        const scale = 1;
        const deltaGridX = Math.round(deltaX / gridSize);
        const deltaGridY = Math.round(deltaY / gridSize);

        let newWidth = this.resizeStart.width;
        let newDepth = this.resizeStart.depth;
        let newPosX = this.resizeStart.position_x;
        let newPosY = this.resizeStart.position_y;

        // Aplicar los cambios según el asa
        switch(this.resizeHandle) {
            case 'se': // Esquina inferior derecha
                newWidth = Math.max(1, this.resizeStart.width + deltaGridX);
                newDepth = Math.max(1, this.resizeStart.depth + deltaGridY);
                break;

            case 'sw': // Esquina inferior izquierda
                newWidth = Math.max(1, this.resizeStart.width - deltaGridX);
                newDepth = Math.max(1, this.resizeStart.depth + deltaGridY);
                newPosX = this.resizeStart.position_x + (deltaGridX * 40); // 40 = gridSize * 2 (scale inverso)
                break;

            case 'ne': // Esquina superior derecha
                newWidth = Math.max(1, this.resizeStart.width + deltaGridX);
                newDepth = Math.max(1, this.resizeStart.depth - deltaGridY);
                newPosY = this.resizeStart.position_y + (deltaGridY * 40);
                break;

            case 'nw': // Esquina superior izquierda
                newWidth = Math.max(1, this.resizeStart.width - deltaGridX);
                newDepth = Math.max(1, this.resizeStart.depth - deltaGridY);
                newPosX = this.resizeStart.position_x + (deltaGridX * 40);
                newPosY = this.resizeStart.position_y + (deltaGridY * 40);
                break;
        }

        // Aplicar los cambios
        this.currentRack.width = newWidth;
        this.currentRack.depth = newDepth;
        this.currentRack.position_x = newPosX;
        this.currentRack.position_y = newPosY;

        // Actualizar los campos en el panel
        const widthInput = document.getElementById('quadRackWidth');
        const depthInput = document.getElementById('quadRackDepth');
        const xInput = document.getElementById('quadRackX');
        const yInput = document.getElementById('quadRackY');

        if (widthInput) widthInput.value = newWidth;
        if (depthInput) depthInput.value = newDepth;
        if (xInput) xInput.value = Math.round(newPosX / 40);
        if (yInput) yInput.value = Math.round(newPosY / 40);

        // Redibujar
        this.drawTopView(this.currentRacks);
    }

    // Detener el redimensionamiento
    stopResize() {
        if (this.currentMode === 'resize') {
            this.currentMode = null;
            this.currentRack = null;
            this.resizeHandle = null;
            this.resizeStart = null;

            if (this.canvasTop) {
                this.canvasTop.style.cursor = 'pointer';
                this.canvasTop.removeEventListener('mousemove', this.handleResize);
                this.canvasTop.removeEventListener('mouseup', this.stopResize);
            }

            this.showQuadNotification('Redimensionamiento terminado', 'info');
        }
    }

    // Iniciar la rotación desde el asa
    startRotationFromHandle(rack, startX, startY) {
        console.log('Rotación desde asa para la estantería', rack.code);

        this.currentMode = 'rotate';
        this.currentRack = rack;
        this.rotateStart = {
            x: startX,
            y: startY,
            centerX: (rack.position_x * 1) % this.canvasTop.width + (rack.width * 20 / 2),
            centerY: (rack.position_y * 1) % this.canvasTop.height + (rack.depth * 20 / 2),
            startRotation: rack.rotation || 0
        };

        if (this.canvasTop) {
            this.canvasTop.style.cursor = 'grab';
        }

        // Añadir los eventos
        this.canvasTop.addEventListener('mousemove', this.handleRotationDrag.bind(this));
        this.canvasTop.addEventListener('mouseup', this.stopRotationDrag.bind(this));

        this.showQuadNotification('Rotación activada. Arrastre para girar la estantería.', 'info');
    }

    // Manejar la rotación por arrastre
    handleRotationDrag(e) {
        if (this.currentMode !== 'rotate' || !this.currentRack || !this.rotateStart) return;

        const rect = this.canvasTop.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calcular el ángulo
        const deltaX = mouseX - this.rotateStart.centerX;
        const deltaY = mouseY - this.rotateStart.centerY;
        const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

        // Snap a 15 grados
        let newRotation = Math.round(angle / 15) * 15;
        if (newRotation < 0) newRotation += 360;

        // Aplicar
        this.currentRack.rotation = newRotation;

        // Actualizar el slider
        const rotationSlider = document.getElementById('quadRackRotation');
        const rotationValue = document.querySelector('.rotation-value');
        if (rotationSlider) rotationSlider.value = newRotation;
        if (rotationValue) rotationValue.textContent = newRotation + '°';

        // Redibujar
        this.drawTopView(this.currentRacks);
    }

    // Detener la rotación
    stopRotationDrag() {
        if (this.currentMode === 'rotate') {
            this.currentMode = null;
            this.currentRack = null;
            this.rotateStart = null;

            if (this.canvasTop) {
                this.canvasTop.style.cursor = 'pointer';
                this.canvasTop.removeEventListener('mousemove', this.handleRotationDrag);
                this.canvasTop.removeEventListener('mouseup', this.stopRotationDrag);
            }

            this.showQuadNotification('Rotación terminada', 'info');
        }
    }

    // Métodos para la selección
    selectRack(rack) {
        this.selectedRack = rack;
        this.selectedLevel = null;

        // Actualizar las vistas
        if (window.vueStock) {
            this.drawFrontView(rack);
            this.updateAllViews(window.vueStock.racks);
        }

        // Si la estantería tiene niveles, seleccionar el primero
        if (rack.levels && rack.levels.length > 0) {
            this.selectLevel(rack.levels[0]);
        }
    }

    selectLevel(level) {
        this.selectedLevel = level;
        this.updateLevelView(level);
    }
}


// vuestock.js - Versión 1.0 - Estructura base
class VueStock {
    constructor() {
        // EVITAR LA INICIALIZACIÓN MÚLTIPLE
        if (window.vueStockInstance) {
            console.warn('⚠️ VueStock ya inicializado, retornando la instancia existente');
            return window.vueStockInstance;
        }
        window.vueStockInstance = this;

        this.currentView = 'plan'; // plan, rack, level
        this.selectedRack = null;
        this.selectedLevel = null;
        this.racks = []; // Almacenamiento temporal de las estanterías
        this.levels = []; // Almacenamiento temporal de los niveles
        this.slots = []; // Almacenamiento temporal de los huecos
        this.canvasManager = null;
        this.api = new ApiManager();

        // AÑADIDO para QuadView
        this.quadViewManager = null;

        this.init();
    }

    init() {
        // Protección anti-doble init
        if (this.initialized) {
            console.warn("⚠️ VueStock ya inicializado, retornando la instancia existente");
            return this;
        }
        this.initialized = true;

        console.log('VueStock inicializado (1ª vez)');

        // Recuperar los parámetros URL
        const urlParams = new URLSearchParams(window.location.search);
        this.rackCode = urlParams.get('rack');
        this.levelCode = urlParams.get('level');
        this.slotCode = urlParams.get('slot');

        this.initEvents();
        this.loadData();
        this.autoSelectTarget();
        this.showView('plan');
        this.updateStats();
    }


    // AÑADIR ESTE MÉTODO DESPUÉS de init()
    initQuadView() {
    // Verificar si QuadViewManager ya está inicializado
    if (this.quadViewManager) {
        console.log('QuadViewManager ya inicializado');
        return;
    }

    // Inicializar QuadViewManager solo si estamos en vista plan
    if (this.currentView === 'plan') {
        setTimeout(() => {
            console.log('Inicializando QuadViewManager...');
            this.quadViewManager = new QuadViewManager();

            // Recuperar los parámetros de la URL
            const params = new URLSearchParams(window.location.search);
            const rackCode = params.get('rack');
            const levelCode = params.get('level');
            const slotCode = params.get('slot');

            // Si hay parámetros presentes en la URL, usarlos
            if (rackCode || levelCode || slotCode) {
                // Encontrar la estantería correspondiente en this.racks
                const selectedRack = this.racks.find(rack => rack.code === rackCode);

                if (selectedRack) {
                    // Actualizar la vista con la estantería seleccionada
                    this.quadViewManager.updateAllViews([selectedRack]);

                    // Si se especifica un nivel
                    if (levelCode) {
                        const selectedLevel = selectedRack.levels.find(level => level.code === levelCode);
                        if (selectedLevel) {
                            // Actualizar la vista con el nivel seleccionado
                            this.quadViewManager.updateLevelView(selectedLevel);
                        }
                    }

                    // Si se especifica un hueco
                    if (slotCode) {
                        const selectedSlot = selectedRack.slots.find(slot => slot.code === slotCode);
                        if (selectedSlot) {
                            // Actualizar la vista con el hueco seleccionado
                            this.quadViewManager.updateSlotView(selectedSlot);
                        }
                    }
                }
            } else {
                // Si no hay parámetros en la URL, pasar todas las estanterías
                if (this.racks && this.racks.length > 0) {
                    debugLog('quadView', 'Pasando', this.racks.length, 'estanterías');
                    this.quadViewManager.updateAllViews(this.racks);
                }
            }
        }, 1500);
    }
}


    // ===== GESTIÓN DE VISTAS =====
    showView(viewName) {
        // Actualizar la vista actual
        this.currentView = viewName;

        // Ocultar todas las vistas
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        // Mostrar la vista solicitada
        const viewElement = document.getElementById(`view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`);
        if (viewElement) {
            viewElement.classList.add('active');
        }

        // Actualizar el breadcrumb
        this.updateBreadcrumb();

        if (viewName === 'plan' && !this.canvasManager) {
            setTimeout(() => {
                this.initCanvas();
            }, 100);
        }

        // AÑADIDO: Inicializar la vista quad si estamos en vista plan
        if (viewName === 'plan') {
            setTimeout(() => {
                this.initQuadView();
            }, 100);
        }
    }

    initCanvas() {
        // Inicializar el canvas manager
        window.canvasManager = new CanvasManager('canvasPlan', 'planOverlay');
        this.canvasManager = window.canvasManager;

        // Redibujar la cuadrícula
        setTimeout(() => {
            this.canvasManager.drawGrid();

            // Añadir las estanterías ya cargadas
            this.racks.forEach(rack => {
                this.canvasManager.addRackToCanvas(rack);
            });
        }, 50);
    }

    // ===== GESTIÓN DE VISTAS =====
    showView(viewName) {
        // Actualizar la vista actual
        this.currentView = viewName;

        // Ocultar todas las vistas
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        // Mostrar la vista solicitada
        const viewElement = document.getElementById(`view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`);
        if (viewElement) {
            viewElement.classList.add('active');
        }

        // Actualizar el breadcrumb
        this.updateBreadcrumb();

        if (viewName === 'plan' && !this.canvasManager) {
            setTimeout(() => {
                this.initCanvas();
            }, 100);
        }

        // AÑADIDO: Inicializar la vista quad si estamos en vista plan
        if (viewName === 'plan') {
            setTimeout(() => {
                this.initQuadView();
            }, 200);
        }
    }

    updateBreadcrumb() {
        const breadcrumb = document.getElementById('breadcrumb');
        breadcrumb.innerHTML = '';

        // Siempre el plan primero
        const planItem = this.createBreadcrumbItem('Plan del stock', 'plan');
        breadcrumb.appendChild(planItem);

        // Si estamos en una estantería
        if (this.currentView === 'rack' && this.selectedRack) {
            breadcrumb.appendChild(this.createBreadcrumbSeparator());
            const rackItem = this.createBreadcrumbItem(
                `Estantería ${this.selectedRack.code}`,
                'rack',
                false // no clicable porque ya estamos ahí
            );
            breadcrumb.appendChild(rackItem);
        }

        // Si estamos en un nivel
        if (this.currentView === 'level' && this.selectedRack && this.selectedLevel) {
            breadcrumb.appendChild(this.createBreadcrumbSeparator());
            const rackItem = this.createBreadcrumbItem(
                `Estantería ${this.selectedRack.code}`,
                'rack',
                true // clicable para volver
            );
            breadcrumb.appendChild(rackItem);

            breadcrumb.appendChild(this.createBreadcrumbSeparator());
            const levelItem = this.createBreadcrumbItem(
                `Nivel ${this.selectedLevel.code}`,
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

    // ===== NAVEGACIÓN ENTRE VISTAS =====
    goToRackView(rack) {
        this.selectedRack = rack;
        this.selectedLevel = null;

        // Actualizar el título
        document.getElementById('rackTitle').textContent = rack.code;
        document.getElementById('rackCodeInput').value = rack.code;

        // Cargar los niveles de esta estantería
        this.loadLevelsForRack(rack.id);

        // Mostrar la vista
        this.showView('rack');
    }

    goToLevelView(level) {
        this.selectedLevel = level;

        // Actualizar los títulos
        document.getElementById('levelTitle').textContent = level.code;
        document.getElementById('levelRackTitle').textContent = this.selectedRack.code;
        document.getElementById('levelCodeInput').value = level.code;

        // Cargar los huecos de este nivel
        this.loadSlotsForLevel(level.id);

        // Mostrar la vista
        this.showView('level');

        // Actualizar la URL con el nivel seleccionado
        const url = new URL(window.location);
        url.searchParams.set('level', level.code);
        window.history.pushState({}, '', url);
    }

    goToSlotView(slot) {
        this.selectedSlot = slot;
        document.getElementById('slotTitle').textContent = slot.code;
        document.getElementById('slotLevelTitle').textContent = this.selectedLevel.code;
        document.getElementById('slotCodeInput').value = slot.code;
        this.showView('slot');
        const url = new URL(window.location);
        url.searchParams.set('slot', slot.code);
        window.history.pushState({}, '', url);
    }


    // ===== GESTIÓN DE LAS ESTANTERÍAS =====
    async addRack(rackData) {
        // PROTECCIÓN CONTRA DOBLES CLICS
        if (this._addingRackInProgress) {
            console.log('⏳ Añadiendo estantería ya en curso, por favor espere...');
            this.showNotification('Añadiendo en curso, por favor espere...', 'warning');
            return null;
        }

        console.log('🟢 [VueStock.addRack] Llamado con:', rackData);

        // Bloquear nuevos clics
        this._addingRackInProgress = true;

        // Desactivar el botón visualmente
        const addButton = document.getElementById('btnAddRack');
        if (addButton) {
            const originalText = addButton.innerHTML;
            addButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando...';
            addButton.disabled = true;
        }

        try {
            const payload = {
                code: rackData.code,
                name: rackData.name || `Estantería ${rackData.code}`,
                position_x: rackData.x || rackData.position_x,
                position_y: rackData.y || rackData.position_y,
                rotation: rackData.rotation || 0,
                width: rackData.width,
                depth: rackData.depth,
                color: rackData.color
            };

            console.log('🟢 Payload para API:', payload);

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

                // CORRECCIÓN: Verificar si la estantería ya existe
                const existingIndex = this.racks.findIndex(r => r.id === newRack.id);
                if (existingIndex === -1) {
                    // Nueva estantería
                    this.racks.push(newRack);
                } else {
                    // Actualización
                    this.racks[existingIndex] = newRack;
                }

                // Dibujar en el canvas UNA SOLA VEZ
                if (this.currentView === 'plan' && this.canvasManager) {
                    // Eliminar el elemento antiguo si existe
                    const oldElement = document.querySelector(`[data-rack-id="${newRack.id}"]`);
                    if (oldElement) {
                        oldElement.remove();
                    }

                    // Añadir el nuevo elemento UNA VEZ
                    this.canvasManager.addRackToCanvas(newRack);
                }

                // AÑADIDO IMPORTANTE: Actualizar QuadView si está activo
                if (this.quadViewManager && this.currentView === 'plan') {
                    console.log('Actualizando QuadView después de añadir estantería');
                    this.quadViewManager.updateAllViews(this.racks);
                }

                this.updateStats();
                this.showNotification(`Estantería ${newRack.code} creada`);

                return newRack;
            }

        } catch (error) {
            console.error('❌ Error al guardar:', error);

            // Mensaje de error más informativo
            let errorMessage = 'Error al crear';
            if (error.message.includes('500')) {
                errorMessage = 'Error servidor (500). La estantería puede haberse creado de todos modos.';
            } else if (error.message.includes('409') || error.message.includes('duplicate')) {
                errorMessage = 'Ya existe una estantería con este código.';
            }

            this.showNotification(errorMessage, 'error');

        } finally {
            // SIEMPRE desbloquear al final
            this._addingRackInProgress = false;

            // Reactivar el botón
            if (addButton) {
                addButton.innerHTML = '<i class="fas fa-plus"></i> Añadir estantería';
                addButton.disabled = false;
            }
        }
    }

    drawRackOnCanvas(rack) {
        // En lugar de crear manualmente el elemento, usar CanvasManager
        if (this.canvasManager) {
            this.canvasManager.addRackToCanvas(rack);
        } else {
            // Fallback si canvasManager aún no inicializado
            console.log('CanvasManager no inicializado, estantería puesta en espera:', rack);
        }
    }

    // ===== GESTIÓN DE LOS NIVELES (incrementos de 10) =====
    async addLevelToRack(rackId, levelCode = null) {
        // Verificar si una operación ya está en curso
        if (this._addingLevel) {
            console.log('⚠️ Operación de añadir nivel ya en curso');
            return;
        }

        this._addingLevel = true;

        try {
            const rack = this.racks.find(r => r.id === rackId);
            if (!rack) return;

            // Si no se especifica código, encontrar el próximo múltiplo de 10
            if (!levelCode) {
                const existingCodes = rack.levels.map(l => parseInt(l.code)).filter(n => !isNaN(n));
                const maxCode = existingCodes.length > 0 ? Math.max(...existingCodes) : 0;
                levelCode = (Math.floor(maxCode / 10) * 10) + 10;
            }

            // Verificar si este nivel ya existe (antes de la llamada API)
            const levelExists = rack.levels.some(l => l.code === levelCode.toString());
            if (levelExists) {
                this.showNotification(`El nivel ${levelCode} ya existe`, 'warning');
                return;
            }

            // Llamar a la API UNA SOLA VEZ
            console.log('📤 Llamada API save-level con:', { rack_id: rackId, level_code: levelCode });

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

                // Mostrar en la vista estantería
                this.displayLevelInRackView(newLevel);

                this.updateStats();
                this.showNotification(`Nivel ${levelCode} añadido a la estantería ${rack.code}`);

                return newLevel;
            }
        } catch (error) {
            console.error('Error al añadir el nivel:', error);
            this.showNotification('Error: ' + error.message, 'error');

            // Mostrar el error específico duplicado
            if (error.message.includes('duplicate') || error.message.includes('409')) {
                this.showNotification(`El nivel ${levelCode} ya existe en esta estantería`, 'error');
            }
        } finally {
            // Siempre desbloquear al final
            this._addingLevel = false;
        }
    }

    displayLevelInRackView(level) {
        const rackContainer = document.getElementById('rackContainer');

        // Quitar el estado vacío si existe
        const emptyState = rackContainer.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }

        // Crear el elemento de nivel
        const levelElement = document.createElement('div');
        levelElement.className = 'rack-level';
        levelElement.dataset.levelId = level.id;

        levelElement.innerHTML = `
            <div class="rack-level-header">
                <div class="level-number">${level.code}</div>
                <div class="level-info">
                    <h4>Nivel ${level.code}</h4>
                    <div class="level-slots">
                        ${level.slots.length} hueco(s)
                    </div>
                </div>
            </div>
            <div class="level-actions">
                <button class="btn btn-sm" title="Configurar">
                    <i class="fas fa-cog"></i>
                </button>
                <button class="btn btn-sm btn-primary" title="Ver los huecos">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        `;

        // Añadir el evento para ir a la vista nivel
        const viewBtn = levelElement.querySelector('.btn-primary');
        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.goToLevelView(level);
        });

        rackContainer.appendChild(levelElement);
    }

    async addSlotToLevel(levelId, slotCode = null, count = 1) {
        // Protección contra clics múltiples
        if (this._addingSlot) {
            console.log('⚠️ Operación de añadir hueco ya en curso');
            return;
        }

        this._addingSlot = true;

        try {
            const rack = this.racks.find(r => r.levels.some(l => l.id === levelId));
            const level = rack?.levels.find(l => l.id === levelId);
            if (!level) return;

            const slots = [];

            for (let i = 0; i < count; i++) {
                // Si no se especifica código, encontrar el próximo múltiplo de 10
                let currentSlotCode;
                if (!slotCode) {
                    const existingCodes = level.slots.map(s => parseInt(s.code)).filter(n => !isNaN(n));
                    const maxCode = existingCodes.length > 0 ? Math.max(...existingCodes) : 0;
                    currentSlotCode = (Math.floor(maxCode / 10) * 10) + 10 + (i * 10);
                } else {
                    currentSlotCode = parseInt(slotCode) + (i * 10);
                }

                // Verificar si este hueco ya existe
                const slotExists = level.slots.some(s => s.code === currentSlotCode.toString());
                if (slotExists) {
                    console.log(`⚠️ Hueco ${currentSlotCode} ya existe`);
                    continue; // Pasar al siguiente
                }

                try {
                    // Llamar a la API para guardar el hueco
                    console.log(`📤 Llamada save-slot para: ${currentSlotCode}`);

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
                    console.error(`Error para el hueco ${currentSlotCode}:`, error);
                    // Continuar con los otros huecos
                    if (error.message.includes('duplicate') || error.message.includes('409')) {
                        console.log(`El hueco ${currentSlotCode} ya existe`);
                    }
                }
            }

            // Mostrar en la vista nivel
            if (slots.length > 0) {
                this.displaySlotsInLevelView(slots);
                this.updateStats();
                this.showNotification(`${slots.length} hueco(s) añadido(s) al nivel ${level.code}`);
            }

            return slots;
        } finally {
            this._addingSlot = false;
        }
    }

    displaySlotsInLevelView(slots) {
        const levelContainer = document.getElementById('levelContainer');

        // Quitar el estado vacío si existe
        const emptyState = levelContainer.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }

        // Añadir cada hueco
        slots.forEach(slot => {
            const slotElement = document.createElement('div');
            slotElement.className = 'slot-item';
            slotElement.dataset.slotId = slot.id;

            // Determinar la clase según el estado
            if (slot.articles && slot.articles.length > 0) {
                const totalQty = slot.articles.reduce((sum, art) => sum + art.quantity, 0);
                slotElement.classList.add(totalQty >= 10 ? 'full' : 'occupied');
            }

            slotElement.innerHTML = `
                <div class="slot-code">${slot.code}</div>
                <div class="slot-status">
                    ${slot.articles && slot.articles.length > 0 ? 'Ocupado' : 'Libre'}
                </div>
            `;

            // Al clic, mostrar los artículos en la barra lateral
            slotElement.addEventListener('click', () => {
                this.displaySlotContents(slot);

                // Animación de selección
                document.querySelectorAll('.slot-item').forEach(s => {
                    s.classList.remove('selected');
                });
                slotElement.classList.add('selected');
            });

            levelContainer.appendChild(slotElement);
        });
    }

    // ===== VISUALIZACIÓN DEL CONTENIDO DE UN HUECO =====
    displaySlotContents(slot) {
        const contentsDiv = document.getElementById('slotContents');

        if (!slot.articles || slot.articles.length === 0) {
            contentsDiv.innerHTML = `
                <div class="empty-slot">
                    <i class="fas fa-box-open fa-2x"></i>
                    <p>Hueco vacío</p>
                    <button class="btn btn-sm btn-success">
                        <i class="fas fa-plus"></i> Añadir un artículo
                    </button>
                </div>
            `;
            return;
        }

        let html = `<h4>Hueco ${slot.full_code}</h4>`;

        slot.articles.forEach(article => {
            html += `
                <div class="article-item">
                    <div class="article-header">
                        <span class="article-name">${article.name}</span>
                        <span class="article-qty">${article.quantity} unidades</span>
                    </div>
                    <div class="article-actions">
                        <button class="btn btn-xs" title="Aumentar">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="btn btn-xs" title="Disminuir">
                            <i class="fas fa-minus"></i>
                        </button>
                        <button class="btn btn-xs btn-danger" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        contentsDiv.innerHTML = html;
    }

    // ===== ESTADÍSTICAS =====
    updateStats() {
        // Contar las estanterías
        const rackCount = this.racks.length;

        // Contar los niveles totales
        const levelCount = this.racks.reduce((sum, rack) => sum + rack.levels.length, 0);

        // Contar los huecos totales
        const slotCount = this.racks.reduce((sum, rack) =>
            sum + rack.levels.reduce((levelSum, level) => levelSum + level.slots.length, 0), 0);

        // CORRECCIÓN: Contar los huecos OCUPADOS
        const occupiedSlotCount = this.racks.reduce((sum, rack) =>
            sum + rack.levels.reduce((levelSum, level) =>
                levelSum + level.slots.reduce((slotSum, slot) =>
                    slotSum + (slot.articles && slot.articles.length > 0 ? 1 : 0), 0), 0), 0);

        // Calcular el porcentaje de ocupación
        let occupationPercentage = '0%';
        if (slotCount > 0) {
            const percentage = Math.round((occupiedSlotCount / slotCount) * 100);
            occupationPercentage = `${percentage}%`;

            // Actualizar el estilo según la tasa
            const occupationElement = document.getElementById('statOccupation');
            occupationElement.classList.remove('occupation-low', 'occupation-medium', 'occupation-high');

            if (percentage >= 90) {
                occupationElement.classList.add('occupation-high');
            } else if (percentage >= 50) {
                occupationElement.classList.add('occupation-medium');
            } else if (percentage > 0) {
                occupationElement.classList.add('occupation-low');
            }
        }

        // Actualizar la interfaz
        document.getElementById('statRacks').textContent = rackCount;
        document.getElementById('statLevels').textContent = levelCount;
        document.getElementById('statSlots').textContent = slotCount;
        document.getElementById('statOccupation').textContent = occupationPercentage;

        // Añadir un tooltip con el detalle
        const occupationElement = document.getElementById('statOccupation');
        if (occupationElement) {
            occupationElement.title = `${occupiedSlotCount} huecos ocupados de ${slotCount}`;
        }
    }

    // ===== NOTIFICACIONES =====
    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        const text = document.getElementById('notificationText');

        // Cambiar el color según el tipo
        if (type === 'error') {
            notification.style.background = 'var(--danger-color)';
        } else if (type === 'warning') {
            notification.style.background = 'var(--warning-color)';
        } else {
            notification.style.background = 'var(--success-color)';
        }

        text.textContent = message;
        notification.classList.add('show');

        // Ocultar después de 3 segundos
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // ===== CARGA DE DATOS =====
    async loadData() {
        this.showLoader(true);

        try {
            // Esperar 2 segundos para dejar que Netlify responda
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Intentar la API
            const result = await this.api.getFullConfig();

            if (result.success && result.data) {
                // Cargar las estanterías con sus niveles y huecos
                this.racks = result.data.racks || result.data;

                // Si la API retorna directamente las estanterías con sus niveles
                if (result.data.levels) {
                    // Asociar los niveles a las estanterías
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
                this.showNotification('Datos cargados desde Netlify Function');

                // ✅ NUEVO: Buscar el artículo desde la URL
                this.searchArticleFromURL();

            }

        } catch (error) {
            console.log('API no disponible (despliegue en curso)');
            // No mostrar error, solo continuar
            this.updateStats();
        } finally {
            this.showLoader(false);
        }
    }

    autoSelectTarget() {
        // Gestión de parámetros URL
        if (this.rackCode) {
            const targetRack = this.racks.find(r => r.code === this.rackCode);
            if (targetRack) {
                this.goToRackView(targetRack);
                console.log('✅ Estantería seleccionada desde URL:', targetRack.code);

                // Gestión del nivel desde URL
                if (this.levelCode) {
                    setTimeout(() => {
                        const targetLevel = targetRack.levels?.find(l => l.code === this.levelCode);
                        if (targetLevel) {
                            this.goToLevelView(targetLevel);
                            console.log('✅ Nivel seleccionado desde URL:', targetLevel.code);

                            // Gestión del hueco desde URL
                            if (this.slotCode) {
                                setTimeout(() => {
                                    const slotElement = document.querySelector(`.slot-item[data-slot-code="${this.slotCode}"]`);
                                    if (slotElement) {
                                        slotElement.classList.add('pulse');
                                        slotElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        console.log('✅ Hueco resaltado desde URL:', this.slotCode);
                                    }
                                }, 500);
                            }
                        }
                    }, 500);
                }
            }
        }

        // Gestión del objetivo tradicional (si existe)
        if (window.vuestockTarget) {
            const { rack, level, slot } = window.vuestockTarget;
            console.log('🎯 Objetivo tradicional detectado:', { rack, level, slot });

            // 1. Seleccionar la estantería
            if (rack) {
                const targetRack = this.racks.find(r => r.code === rack);
                if (targetRack) {
                    this.goToRackView(targetRack);
                    console.log('✅ Estantería seleccionada (tradicional):', targetRack.code);

                    // 2. Seleccionar el nivel (después de un retraso para dejar tiempo al renderizado)
                    if (level) {
                        setTimeout(() => {
                            const targetLevel = targetRack.levels?.find(l => l.code === level);
                            if (targetLevel) {
                                this.goToLevelView(targetLevel);
                                console.log('✅ Nivel seleccionado (tradicional):', targetLevel.code);

                                // 3. Resaltar el hueco (después de un retraso)
                                if (slot) {
                                    setTimeout(() => {
                                        const slotElement = document.querySelector(`.slot-item[data-slot-code="${slot}"]`);
                                        if (slotElement) {
                                            slotElement.classList.add('pulse');
                                            slotElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            console.log('✅ Hueco resaltado (tradicional):', slot);
                                        }
                                    }, 500);
                                }
                            }
                        }, 500);
                    }
                }
            }
        }
    }

    searchArticleFromURL() {
        // Recuperar los parámetros URL
        const urlParams = new URLSearchParams(window.location.search);
        const articleId = urlParams.get('articleId');
        const articleName = urlParams.get('articleName');

        // Si no hay parámetros, no hacer nada
        if (!articleId && !articleName) {
            console.log('No hay parámetros artículo en la URL');
            return;
        }

        console.log('🔍 Buscando artículo desde URL:', { articleId, articleName });

        // Buscar el artículo en todas las estanterías/niveles/huecos
        let foundRack = null;
        let foundLevel = null;
        let foundSlot = null;

        for (const rack of this.racks) {
            if (!rack.levels) continue;

            for (const level of rack.levels) {
                if (!level.slots) continue;

                for (const slot of level.slots) {
                    if (!slot.articles || slot.articles.length === 0) continue;

                    const article = slot.articles.find(a =>
                        (articleId && a.id === articleId) ||
                        (articleName && a.name === articleName)
                    );

                    if (article) {
                        foundRack = rack;
                        foundLevel = level;
                        foundSlot = slot;
                        console.log('✅ Artículo encontrado:', {
                            rack: rack.code,
                            level: level.code,
                            slot: slot.code,
                            article: article.name
                        });
                        break;
                    }
                }
                if (foundSlot) break;
            }
            if (foundSlot) break;
        }

        // Si se encuentra, usar QuadView para seleccionar
        if (foundRack && foundLevel && foundSlot && this.quadViewManager) {
            setTimeout(() => {
                // ✅ Seleccionar la estantería en QuadView
                this.quadViewManager.selectedRack = foundRack;
                console.log('➡️ Estantería seleccionada en QuadView:', foundRack.code);

                setTimeout(() => {
                    // ✅ Seleccionar el nivel en QuadView
                    this.quadViewManager.selectedLevel = foundLevel;
                    console.log('➡️ Nivel seleccionado en QuadView:', foundLevel.code);

                    setTimeout(() => {
                        // ✅ Seleccionar el hueco en QuadView
                        this.quadViewManager.selectedSlot = foundSlot;
                        console.log('➡️ Hueco seleccionado en QuadView:', foundSlot.code);

                        // ✅ Redibujar la vista Front para mostrar el nivel seleccionado
                        this.quadViewManager.drawFrontView(foundRack);

                        // ✅ Recrear el cajón para mostrar el hueco seleccionado
                        this.quadViewManager.updateLevelView(foundLevel);

                        // ✅ Quitar la animación después de 3 segundos (mantiene el marco amarillo)
                        if (this.quadViewManager.slotAnimationTimeout) {
                            clearTimeout(this.quadViewManager.slotAnimationTimeout);
                        }

                        this.quadViewManager.isSlotAnimating = true;

                        this.quadViewManager.slotAnimationTimeout = setTimeout(() => {
                            // Quitar la clase "animating" pero mantener "selected-slot"
                            const animatingSlots = document.querySelectorAll('.quad-slot.animating');
                            animatingSlots.forEach(slot => {
                                slot.classList.remove('animating');
                            });

                            this.quadViewManager.isSlotAnimating = false;

                            // ✅ NUEVO: Redibujar el front view sin el resplandor
                            this.quadViewManager.drawFrontView(foundRack);

                            console.log('✅ Animación terminada, marco amarillo conservado');
                        }, 3200);



                        // ✅ Redibujar todas las vistas con las selecciones
                        this.quadViewManager.updateAllViews(this.racks);
                        console.log('✅ QuadView actualizado con las selecciones');

                        // ✅ Mostrar una notificación
                        this.showNotification(`Artículo encontrado: ${foundSlot.code} - ${foundRack.code}${foundLevel.code}`, 'success');
                    }, 300);
                }, 300);
            }, 300);
        } else if (!foundRack) {
            console.warn('❌ Artículo no encontrado en el stock');
            this.showNotification('Artículo no encontrado', 'warning');
        }
    }


    displayRacksFromAPI() {
        // Limpiar el canvas
        const overlay = document.getElementById('planOverlay');
        if (overlay) overlay.innerHTML = '';

        // Array temporal para evitar duplicados
        const racksMap = {};

        this.racks.forEach(rack => {
            // Normalizar los datos API
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

            // Evitar duplicados via id
            if (!racksMap[rackData.id]) {
                racksMap[rackData.id] = rackData;

                // Añadir al canvas
                if (this.canvasManager) {
                    this.canvasManager.addRackToCanvas(rackData);
                }
            }
        });

        // Reemplazar el array interno por la versión única
        this.racks = Object.values(racksMap);

        // Actualizar las estadísticas
        this.updateStats();

        // AÑADIDO IMPORTANTE: Actualizar QuadView si está activo
        if (this.quadViewManager && this.currentView === 'plan') {
            console.log('Actualizando QuadView desde displayRacksFromAPI()');
            this.quadViewManager.updateAllViews(this.racks);
        }
    }

    showLoader(show) {
        const loader = document.getElementById('loaderOverlay');
        if (show) {
            loader.classList.add('active');
        } else {
            loader.classList.remove('active');
        }
    }

    // ===== GESTIÓN DE EVENTOS =====
    initEvents() {
        // Navegación entre vistas
        document.getElementById('backToPlan')?.addEventListener('click', () => {
            this.showView('plan');
        });

        document.getElementById('backToRack')?.addEventListener('click', () => {
            this.showView('rack');
        });

        // Botón Añadir estantería - CORREGIDO
        document.getElementById('btnAddRack').addEventListener('click', () => {
            this.openRackModal(); // Llamada directa, no via window
        });

        // Botón Añadir nivel
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

        // Botón Añadir hueco
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

        // Generación automática de niveles
        document.getElementById('btnAutoLevels')?.addEventListener('click', () => {
            if (this.selectedRack) {
                // Generar los niveles 10, 20, 30, 40, 50
                for (let i = 1; i <= 5; i++) {
                    this.addLevelToRack(this.selectedRack.id, (i * 10).toString());
                }
            }
        });

        // Generación automática de huecos
        document.getElementById('btnAutoSlots')?.addEventListener('click', () => {
            if (this.selectedLevel) {
                // Generar los huecos 10 a 100 por paso de 10
                for (let i = 1; i <= 10; i++) {
                    this.addSlotToLevel(this.selectedLevel.id, (i * 10).toString());
                }
            }
        });

        // Búsqueda de artículo
        document.getElementById('btnSearch')?.addEventListener('click', () => {
            this.searchArticle();
        });

        document.getElementById('searchArticle')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchArticle();
            }
        });

        // Guardar
        document.getElementById('btnSave')?.addEventListener('click', () => {
            this.saveData();
        });

        // Modal estantería
        this.initModalEvents();
    }

    initModalEvents() {
        const modal = document.getElementById('rackModal');
        const overlay = document.getElementById('modalOverlay');

        // CORRECCIÓN: Definir openRackModal como método de VueStock
        this.openRackModal = (rack = null) => {
            if (rack) {
                // Modo edición
                document.getElementById('modalRackCode').value = rack.code;
                document.getElementById('modalRackName').value = rack.name;
                document.getElementById('modalRackWidth').value = rack.width;
                document.getElementById('modalRackDepth').value = rack.depth;
                document.getElementById('modalRackColor').value = rack.color;
            } else {
                // Modo creación
                document.getElementById('rackForm').reset();
                // Sugerir un código de estantería
                const nextCode = String.fromCharCode(65 + this.racks.length); // A, B, C...
                document.getElementById('modalRackCode').value = nextCode;
            }

            overlay.classList.add('active');
        };

        // Exponer también en window para los botones en CanvasManager
        window.openRackModal = (rack = null) => {
            this.openRackModal(rack);
        };

        // Cerrar modal
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

        // Guardar
        document.getElementById('saveRackModal')?.addEventListener('click', async () => {
            // Desactivar el botón durante el procesamiento
            const saveButton = document.getElementById('saveRackModal');
            if (saveButton) {
                const originalText = saveButton.innerHTML;
                saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando...';
                saveButton.disabled = true;
            }

            try {
                const code = document.getElementById('modalRackCode').value.trim();
                const name = document.getElementById('modalRackName').value.trim();
                const width = parseInt(document.getElementById('modalRackWidth').value);
                const depth = parseInt(document.getElementById('modalRackDepth').value);
                const color = document.getElementById('modalRackColor').value;

                if (!code) {
                    this.showNotification('El código de estantería es requerido', 'error');
                    return;
                }

                const codeExists = this.racks.some(r => r.code === code);
                if (codeExists) {
                    this.showNotification(`El código ${code} ya existe`, 'error');
                    return;
                }

                // Creación de la estantería
                const newRack = await this.addRack({
                    code,
                    name: name || `Estantería ${code}`,
                    x: 100 + (this.racks.length * 150),
                    y: 100,
                    width: width || 3,
                    depth: depth || 2,
                    color: color || '#4a90e2'
                });

                // Cerrar el modal solo si éxito
                if (newRack) {
                    document.getElementById('modalOverlay').classList.remove('active');

                    // Actualizar QuadView
                    if (this.quadViewManager && this.currentView === 'plan') {
                        this.quadViewManager.updateAllViews(this.racks);
                    }
                }

            } catch (error) {
                console.error('Error en saveRackModal:', error);

            } finally {
                // SIEMPRE reactivar el botón
                if (saveButton) {
                    saveButton.innerHTML = 'Guardar';
                    saveButton.disabled = false;
                }
            }
        });
    }

    // ===== VISTA 3D =====
    open3DView = async () => {
        console.log('Abriendo la vista 3D');
        const modal3D = document.getElementById('modal3D');

        modal3D.classList.add('active');
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!window.vueStock3D) {
            window.vueStock3D = new VueStock3D();
            await window.vueStock3D.init();
        }
    }

    // ===== BÚSQUEDA DE ARTÍCULO =====
    async searchArticle() {
        const searchTerm = document.getElementById('searchArticle').value.trim();
        if (!searchTerm) return;

        this.showLoader(true);

        try {
            // Buscar via la API
            const results = await this.api.searchArticles(searchTerm);

            if (results.length > 0) {
                // Tomar el primer resultado para la demostración
                const article = results[0];

                if (article.full_code) {
                    // ✅ NUEVO: Proponer abrir la vista 3D
                    const open3D = confirm(`Artículo encontrado en ${article.full_code}\n\n¿Abrir la vista 3D para localizar el artículo?`);

                    if (open3D) {
                        // Abrir la vista 3D (función global)
                        await open3DView();

                        // Si quieres localizar el artículo, añade esto:
                        // if (window.vueStock3D?.locateArticle) {
                        //     window.vueStock3D.locateArticle(article.full_code);
                        // }
                    } else {
                        // Comportamiento clásico (2D)
                        this.highlightSlotByFullCode(article.full_code);
                    }

                    this.showNotification(`Artículo encontrado en ${article.full_code}`);
                } else {
                    this.showNotification('Artículo encontrado pero no almacenado', 'warning');
                }
            } else {
                this.showNotification('Ningún artículo encontrado', 'warning');
            }

        } catch (error) {
            console.error('Error de búsqueda:', error);
            this.showNotification('Error de búsqueda: ' + error.message, 'error');
        } finally {
            this.showLoader(false);
        }
    }

    // ✅ NUEVO MÉTODO: Abrir la 3D y localizar
    open3DAndLocate(fullCode) {
        console.log('🎯 Localización 3D para:', fullCode);

        // Extraer estantería, nivel, hueco del código (ej: "A-10-20")
        const parts = fullCode.split('-');
        if (parts.length !== 3) {
            console.error('Formato de código inválido:', fullCode);
            return;
        }

        const [rackCode, levelCode, slotCode] = parts;

        // Encontrar la estantería
        const rack = this.racks.find(r => r.code === rackCode);
        if (!rack) {
            console.error('Estantería no encontrada:', rackCode);
            return;
        }

        // Encontrar el nivel
        const level = rack.levels?.find(l => l.code === levelCode);
        if (!level) {
            console.error('Nivel no encontrado:', levelCode);
            return;
        }

        // Encontrar el hueco
        const slot = level.slots?.find(s => s.code === slotCode);
        if (!slot) {
            console.error('Hueco no encontrado:', slotCode);
            return;
        }

        // Abrir el modal 3D
        const modal3D = document.getElementById('modal3D');
        modal3D.classList.add('active');

        // Inicializar la vista 3D si es necesario
        if (!window.view3DManager) {
            window.view3DManager = new View3DManager();
            window.view3DManager.init();

            // Esperar a que la 3D cargue
            setTimeout(() => {
                window.view3DManager.locateAndHighlight(rack, level, slot);
            }, 500);
        } else {
            window.view3DManager.locateAndHighlight(rack, level, slot);
        }
    }

    highlightSlotByFullCode(fullCode) {
        // Extraer las partes del código: A-10-20
        const parts = fullCode.split('-');
        if (parts.length !== 3) return;

        const [rackCode, levelCode, slotCode] = parts;

        // Encontrar la estantería
        const rack = this.racks.find(r => r.code === rackCode);
        if (!rack) return;

        // Ir a la vista estantería
        this.goToRackView(rack);

        // Encontrar el nivel
        const level = rack.levels?.find(l => l.level_code === levelCode);
        if (!level) return;

        // Ir a la vista nivel
        setTimeout(() => {
            this.goToLevelView(level);

            // Resaltar el hueco
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

    // ===== GUARDAR DATOS =====
    async saveData() {
        this.showLoader(true);

        try {
            // Guardar solo si es necesario
            // Aquí puedes decidir guardar las modificaciones
            // o simplemente no hacer nada porque cada estantería se guarda individualmente

            // Opción: Guardar todas las estanterías modificadas
            let savedCount = 0;

            for (const rack of this.racks) {
                // Verificar si la estantería ha sido modificada
                // Para simplificar, guardamos todo
                try {
                    await this.api.saveRack({
                        id: rack.id, // Incluir el ID para actualización
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
                    console.error(`Error para estantería ${rack.code}:`, error);
                }
            }

            this.showNotification(`${savedCount} estantería(s) guardada(s)`);

        } catch (error) {
            console.error('Error de guardado:', error);
            this.showNotification('Error al guardar: ' + error.message, 'error');
        } finally {
            this.showLoader(false);
        }
    }

    // ===== CARGA DE NIVELES PARA UNA ESTANTERÍA =====
    loadLevelsForRack(rackId) {
        const rack = this.racks.find(r => r.id === rackId);
        if (!rack) return;

        const rackContainer = document.getElementById('rackContainer');
        rackContainer.innerHTML = '';

        if (rack.levels.length === 0) {
            rackContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-th-large fa-3x"></i>
                    <p>Ningún nivel configurado</p>
                    <button class="btn btn-primary" id="btnAddFirstLevel">
                        Añadir el primer nivel
                    </button>
                </div>
            `;

            // Re-enlazar el evento
            document.getElementById('btnAddFirstLevel').addEventListener('click', () => {
                this.addLevelToRack(rackId);
            });
        } else {
            rack.levels.forEach(level => {
                this.displayLevelInRackView(level);
            });
        }
    }

    // ===== CARGA DE HUECOS PARA UN NIVEL =====
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
                    <p>Ningún hueco configurado</p>
                    <button class="btn btn-primary" id="btnAddFirstSlot">
                        Añadir el primer hueco
                    </button>
                </div>
            `;

            // Re-enlazar el evento
            document.getElementById('btnAddFirstSlot').addEventListener('click', () => {
                this.addSlotToLevel(levelId);
            });
        } else {
            this.displaySlotsInLevelView(level.slots);
        }
    }

    refreshEventListeners() {
        // Este método puede ser llamado si los eventos no funcionan
        console.log('Refrescando eventos...');

        // Reinicializar los eventos del canvas
        if (this.canvasManager) {
            // Recrear el canvas manager
            this.canvasManager = new CanvasManager('canvasPlan', 'planOverlay');
            window.canvasManager = this.canvasManager;

            // Redibujar todo
            setTimeout(() => {
                this.canvasManager.drawGrid();
                this.racks.forEach(rack => {
                    this.canvasManager.addRackToCanvas(rack);
                });
            }, 100);
        }
    }

    loadTestData() {
        console.log('Cargando datos de prueba');

        // Datos de prueba
        const testRack = {
            id: 1,
            code: 'A',
            name: 'Estantería principal A',
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

        // Mostrar en el canvas
        if (this.canvasManager) {
            this.canvasManager.addRackToCanvas(testRack);
        }

        this.updateStats();
        this.showNotification('Datos de prueba cargados', 'warning');
    }
}

// ===== INICIALIZACIÓN AL CARGAR =====
document.addEventListener('DOMContentLoaded', () => {
    // Recuperar los parámetros URL
    const urlParams = new URLSearchParams(window.location.search);
    const articleId = urlParams.get('articleId');
    const articleName = urlParams.get('articleName');

    window.vueStock = new VueStock();

    // Inicializar la vista quad después de un retraso
    setTimeout(() => {
        if (window.vueStock.quadViewManager) {
            window.vueStock.quadViewManager.updateAllViews(window.vueStock.racks);

            // Si tenemos un articleId en la URL, buscar y abrir su hueco
            if (articleId || articleName) {
                console.log('🔍 Buscando artículo desde URL:', { articleId, articleName });

                // Buscar el artículo en todas las estanterías/niveles/huecos
                let foundRack = null;
                let foundLevel = null;
                let foundSlot = null;

                for (const rack of window.vueStock.racks) {
                    if (!rack.levels) continue;

                    for (const level of rack.levels) {
                        if (!level.slots) continue;

                        for (const slot of level.slots) {
                            if (!slot.articles || slot.articles.length === 0) continue;

                            // Buscar el artículo en este hueco
                            const article = slot.articles.find(a =>
                                (articleId && a.id === articleId) ||
                                (articleName && a.name === articleName)
                            );

                            if (article) {
                                foundRack = rack;
                                foundLevel = level;
                                foundSlot = slot;
                                console.log('✅ Artículo encontrado:', { rack: rack.code, level: level.code, slot: slot.code });
                                break;
                            }
                        }
                        if (foundSlot) break;
                    }
                    if (foundSlot) break;
                }

                // Si se encuentra, abrir estantería → nivel → hueco
                if (foundRack && foundLevel && foundSlot) {
                    // Paso 1: Abrir la estantería
                    window.vueStock.goToRackView(foundRack);

                    // Paso 2: Abrir el nivel (después de 500ms)
                    setTimeout(() => {
                        window.vueStock.goToLevelView(foundLevel);

                        // Paso 3: Resaltar el hueco (después de 500ms adicionales)
                        setTimeout(() => {
                            const slotElement = document.querySelector(`.slot-item[data-slot-id="${foundSlot.id}"]`);
                            if (slotElement) {
                                slotElement.classList.add('pulse');
                                slotElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                console.log('✅ Hueco resaltado');
                            }
                        }, 500);
                    }, 500);
                } else {
                    console.warn('❌ Artículo no encontrado en el stock');
                }
            }
        }
    }, 1000);
});


// Botón de debug para probar QuadView
document.addEventListener('DOMContentLoaded', () => {
    // Añadir un botón de debug temporal
    const debugBtn = document.createElement('button');
    debugBtn.id = 'debugQuadBtn';
    debugBtn.innerHTML = '🔍 Debug Quad';
    debugBtn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:10000;padding:10px;background:#4a90e2;color:white;border:none;border-radius:5px;cursor:pointer;';

    debugBtn.addEventListener('click', () => {
        console.log('=== DEBUG QUAD ===');
        console.log('VueStock:', window.vueStock);
        console.log('Estanterías:', window.vueStock?.racks?.length, 'estanterías');
        console.log('QuadViewManager:', window.vueStock?.quadViewManager);

        if (window.vueStock?.quadViewManager) {
            console.log('Actualización forzada de QuadView...');
            window.vueStock.quadViewManager.updateAllViews(window.vueStock.racks);
            alert('QuadView actualizado con ' + window.vueStock.racks.length + ' estanterías');
        } else {
            alert('QuadViewManager no inicializado. Espere a la carga o cambie a vista Plan.');
        }
    });

    document.body.appendChild(debugBtn);

    // Inicializar VueStock
    window.vueStock = new VueStock();
});