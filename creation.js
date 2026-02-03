import { supabase } from './supabaseClient.js';

// Elementos DOM y variables
let currentUser = null;
let currentPhoto = null;
let generatedBarcode = '';
let isManualBarcode = false;

// Constantes
const EAN13_PREFIX = '200'; // Prefijo para códigos de barras generados

document.addEventListener('DOMContentLoaded', async function() {
    // Verificar autenticación
    await checkAuth();

    // Inicializar eventos
    setupEventListeners();

    // Inicializar valores
    initializeForm();

    // Ocultar carga
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

        // Verificar permisos
        if (!currentUser.permissions?.creation) {
            alert('No tienes permiso para crear artículos');
            window.location.href = 'accueil.html';
            return;
        }

        // Actualizar interfaz
        document.getElementById('usernameDisplay').textContent = currentUser.username;

        // Verificar acceso al almacenamiento (en segundo plano)
        setTimeout(async () => {
            const storageAccess = await checkStorageBucket();
            if (!storageAccess) {
                console.warn('Atención: el almacenamiento de fotos no está disponible');
                // Podrías mostrar una advertencia discreta al usuario
            }
        }, 1000);

    } catch (error) {
        console.error('Error de autenticación:', error);
        sessionStorage.removeItem('current_user');
        window.location.href = 'connexion.html';
    }
}

// ===== INICIALIZACIÓN =====
function initializeForm() {
    // Generar número de artículo por defecto
    generateArticleNumber();

    // Generar código de barras por defecto
    generateBarcode();

    // Cargar datos de ubicaciones
    loadLocationData();

    // Actualizar resumen
    updateSummary();

    // Calcular valor total
    calculateTotalValue();
}

function generateArticleNumber() {
    // Generar un número del tipo ART-XXX
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.floor(Math.random() * 90 + 10); // 10-99
    const articleNumber = `ART-${timestamp}${random}`;

    document.getElementById('articleNumber').value = articleNumber;
    updateSummaryField('summaryNumber', articleNumber);
}

function generateBarcode() {
    // Generar un código de barras EAN-13 válido
    const prefix = EAN13_PREFIX;
    const random = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    const barcode = prefix + random;

    // Calcular el checksum EAN-13
    const checksum = calculateEAN13Checksum(barcode);
    const fullBarcode = barcode + checksum;

    generatedBarcode = fullBarcode;
    updateBarcodePreview(fullBarcode);
    updateSummaryField('summaryBarcode', fullBarcode);
}

function calculateEAN13Checksum(code) {
    // El código debe tener 12 dígitos
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        const digit = parseInt(code[i]);
        sum += (i % 2 === 0) ? digit : digit * 3;
    }
    const checksum = (10 - (sum % 10)) % 10;
    return checksum.toString();
}

// Cargar datos de ubicaciones
async function loadLocationData() {
    try {
        // Cargar los racks
        const { data: racks, error: racksError } = await supabase
            .from('w_vuestock_racks')
            .select('id, rack_code, display_name')
            .order('rack_code');

        if (racksError) throw racksError;

        const rackSelect = document.getElementById('rackSelect');
        racks.forEach(rack => {
            const option = document.createElement('option');
            option.value = rack.id;
            // Usar display_name si existe, si no rack_code
            option.textContent = rack.display_name || rack.rack_code;
            rackSelect.appendChild(option);
        });

        // Escuchar el cambio de rack para cargar los niveles
        rackSelect.addEventListener('change', async function() {
            const rackId = this.value;
            const levelSelect = document.getElementById('levelSelect');
            const slotSelect = document.getElementById('slotSelect');

            // Reiniciar
            levelSelect.innerHTML = '<option value="">-- Seleccionar nivel --</option>';
            slotSelect.innerHTML = '<option value="">-- Seleccionar emplazamiento --</option>';
            levelSelect.disabled = !rackId;
            slotSelect.disabled = true;

            if (rackId) {
                // Cargar los niveles para este rack
                const { data: levels, error: levelsError } = await supabase
                    .from('w_vuestock_levels') // NOTA: 's' al final
                    .select('id, level_code')
                    .eq('rack_id', rackId)
                    .order('display_order');

                if (!levelsError && levels) {
                    levels.forEach(level => {
                        const option = document.createElement('option');
                        option.value = level.id;
                        option.textContent = level.level_code;
                        levelSelect.appendChild(option);
                    });
                    levelSelect.disabled = false;
                }
            }
        });

        // Escuchar el cambio de nivel para cargar los emplazamientos
        document.getElementById('levelSelect').addEventListener('change', async function() {
            const levelId = this.value;
            const slotSelect = document.getElementById('slotSelect');

            // Reiniciar
            slotSelect.innerHTML = '<option value="">-- Seleccionar emplazamiento --</option>';
            slotSelect.disabled = !levelId;

            if (levelId) {
                // Cargar los emplazamientos para este nivel
                const { data: slots, error: slotsError } = await supabase
                    .from('w_vuestock_slots')
                    .select('id, slot_code, status')
                    .eq('level_id', levelId)
                    .order('display_order');

                if (!slotsError && slots) {
                    slots.forEach(slot => {
                        const option = document.createElement('option');
                        option.value = slot.id;
                        // Verificar el estado: 'occupied' en lugar de 'is_occupied'
                        const isOccupied = slot.status === 'occupied';
                        option.textContent = `${slot.slot_code} ${isOccupied ? '(Ocupado)' : ''}`;
                        option.disabled = isOccupied;
                        option.style.color = isOccupied ? '#999' : '';
                        slotSelect.appendChild(option);
                    });
                    slotSelect.disabled = false;
                }
            }
        });

    } catch (error) {
        console.error('Error carga ubicaciones:', error);
    }
}

function updateBarcodePreview(barcode) {
    const canvas = document.getElementById('barcodeCanvas');
    const placeholder = document.querySelector('.barcode-placeholder');

    if (barcode && barcode.length === 13) {
        try {
            // Generar código de barras con JsBarcode
            JsBarcode(canvas, barcode, {
                format: "EAN13",
                width: 2,
                height: 100,
                displayValue: true,
                fontSize: 16,
                margin: 10
            });

            canvas.style.display = 'block';
            placeholder.style.display = 'none';
            document.getElementById('barcodeValue').textContent = barcode;

        } catch (error) {
            console.error('Error generación código de barras:', error);
            canvas.style.display = 'none';
            placeholder.style.display = 'flex';
            document.getElementById('barcodeValue').textContent = '-';
        }
    } else {
        canvas.style.display = 'none';
        placeholder.style.display = 'flex';
        document.getElementById('barcodeValue').textContent = '-';
    }
}

// ===== GESTIÓN DE EVENTOS =====
function setupEventListeners() {
    // Cierre de sesión
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Generación número de artículo
    document.getElementById('generateNumberBtn').addEventListener('click', generateArticleNumber);

    // Gestión de la foto
    document.getElementById('selectPhotoBtn').addEventListener('click', () => {
        document.getElementById('photoUpload').click();
    });

    document.getElementById('takePhotoBtn').addEventListener('click', takePhoto);
    document.getElementById('removePhotoBtn').addEventListener('click', removePhoto);
    document.getElementById('photoUpload').addEventListener('change', handlePhotoUpload);
    document.getElementById('photoPreview').addEventListener('click', () => {
        document.getElementById('photoUpload').click();
    });

    // Código de barras
    document.getElementById('generateBarcodeBtn').addEventListener('click', generateBarcode);
    document.getElementById('scanBarcodeBtn').addEventListener('click', simulateBarcodeScan);

    // Opciones de código de barras
    document.querySelectorAll('input[name="barcodeOption"]').forEach(radio => {
        radio.addEventListener('change', handleBarcodeOptionChange);
    });

    document.getElementById('manualBarcodeInput').addEventListener('input', handleManualBarcodeInput);

    // Cálculo automático del valor
    document.getElementById('initialQuantity').addEventListener('input', calculateTotalValue);
    document.getElementById('unitPrice').addEventListener('input', calculateTotalValue);

    // Actualización del resumen en tiempo real
    document.getElementById('articleName').addEventListener('input', updateSummary);
    document.getElementById('articleNumber').addEventListener('input', updateSummary);
    document.getElementById('initialQuantity').addEventListener('input', updateSummary);
    document.getElementById('unitPrice').addEventListener('input', updateSummary);

    // Envío del formulario
    document.getElementById('creationForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('creationForm').addEventListener('reset', handleFormReset);
}

// ===== GESTIÓN DE FOTOS =====
async function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Verificar tipo de archivo
    if (!file.type.match('image.*')) {
        alert('Por favor, selecciona una imagen (JPG, PNG, WebP)');
        return;
    }

    // Verificar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
        // Intentar optimizar la imagen si es demasiado grande
        if (!confirm('La imagen es demasiado pesada (máx 5MB). ¿Deseas optimizarla automáticamente?')) {
            return;
        }
    }

    // Mostrar mensaje de carga
    const previewImg = document.getElementById('photoPreviewImg');
    const placeholder = document.querySelector('.photo-placeholder');

    placeholder.innerHTML = '<i class="fas fa-spinner fa-spin"></i><p>Optimizando imagen...</p>';

    try {
        // Optimizar la imagen
        const optimized = await optimizeImage(file);

        currentPhoto = {
            file: optimized.file,
            dataUrl: optimized.dataUrl,
            originalFile: optimized.originalFile
        };

        // Mostrar vista previa
        previewImg.src = optimized.dataUrl;
        previewImg.style.display = 'block';
        placeholder.style.display = 'none';

        // Mostrar botón de eliminar
        document.getElementById('removePhotoBtn').style.display = 'flex';

        // Mostrar información de la imagen optimizada
        const sizeMB = (optimized.file.size / 1024 / 1024).toFixed(2);
        console.log(`Imagen optimizada: ${sizeMB}MB (original: ${(file.size / 1024 / 1024).toFixed(2)}MB)`);

    } catch (error) {
        console.error('Error optimizando imagen:', error);
        alert('Error al procesar la imagen');
        placeholder.innerHTML = '<i class="fas fa-image"></i><p>Ninguna foto seleccionada</p><small>Haz clic para añadir una foto</small>';
    }
}

function takePhoto() {
    // Por ahora, simulación
    // En la versión real, usarías la API MediaDevices
    alert('Funcionalidad de tomar foto a implementar\n(Por ahora, usa "Seleccionar foto")');
}

function removePhoto() {
    currentPhoto = null;

    const previewImg = document.getElementById('photoPreviewImg');
    const placeholder = document.querySelector('.photo-placeholder');

    previewImg.style.display = 'none';
    placeholder.style.display = 'flex';
    document.getElementById('removePhotoBtn').style.display = 'none';
    document.getElementById('photoUpload').value = '';
}

// ===== GESTIÓN DE CÓDIGO DE BARRAS =====
function handleBarcodeOptionChange(event) {
    const option = event.target.value;
    const manualInput = document.getElementById('manualBarcodeInput');
    const generateBtn = document.getElementById('generateBarcodeBtn');

    isManualBarcode = option === 'manual';

    if (isManualBarcode) {
        manualInput.disabled = false;
        manualInput.focus();
        generateBtn.disabled = true;

        // Usar el valor manual si existe
        if (manualInput.value) {
            updateBarcodePreview(manualInput.value);
            updateSummaryField('summaryBarcode', manualInput.value);
        }
    } else {
        manualInput.disabled = true;
        generateBtn.disabled = false;

        // Volver al código de barras generado
        updateBarcodePreview(generatedBarcode);
        updateSummaryField('summaryBarcode', generatedBarcode);
    }
}

function handleManualBarcodeInput(event) {
    let value = event.target.value.replace(/\D/g, ''); // Mantener solo dígitos
    value = value.substring(0, 13); // Máximo 13 dígitos
    event.target.value = value;

    if (value.length === 13) {
        // Verificar checksum EAN-13
        const checksum = calculateEAN13Checksum(value.substring(0, 12));
        if (checksum !== value[12]) {
            alert('Código de barras EAN-13 inválido. El último dígito debería ser ' + checksum);
        }
    }

    updateBarcodePreview(value);
    updateSummaryField('summaryBarcode', value || '-');
}

// ===== FUNCIÓN DE ESCANEO REAL =====
function simulateBarcodeScan() {
    // Abrir popup de escaneo
    openBarcodeScannerPopup();
}

function openBarcodeScannerPopup() {
    const popup = document.createElement('div');
    popup.className = 'scan-popup-overlay';

    popup.innerHTML = `
        <div class="scan-popup">
            <div class="popup-header">
                <h3><i class="fas fa-camera"></i> Escanear código de barras</h3>
                <button class="close-popup">&times;</button>
            </div>
            <div class="popup-content">
                <div class="scan-section">
                    <div class="camera-placeholder" id="cameraPlaceholder">
                        <i class="fas fa-camera"></i>
                        <p>Listo para escanear</p>
                    </div>
                    <video id="cameraPreview" autoplay playsinline style="display: none;"></video>
                    <canvas id="scanCanvas" style="display: none;"></canvas>

                    <div class="scan-controls">
                        <button id="startCameraBtn" class="btn btn-primary">
                            <i class="fas fa-video"></i> Activar escáner
                        </button>
                        <button id="stopCameraBtn" class="btn btn-secondary" style="display: none;">
                            <i class="fas fa-stop"></i> Detener
                        </button>
                    </div>
                </div>

                <div class="manual-section">
                    <h4><i class="fas fa-keyboard"></i> Ingreso manual</h4>
                    <div class="form-group">
                        <input type="text"
                               id="manualBarcodeInput"
                               placeholder="Introduce el código de barras manualmente"
                               class="scan-input">
                        <button id="confirmManualBtn" class="btn btn-success">
                            <i class="fas fa-check"></i> Validar
                        </button>
                    </div>
                </div>

                <div class="scan-instructions">
                    <p><i class="fas fa-lightbulb"></i> Coloca el código de barras en el marco. El escaneo es automático.</p>
                    <p><i class="fas fa-bolt"></i> Asegúrate de tener buena iluminación.</p>
                </div>

                <div id="scanStatus" class="scan-status">
                    <p><i class="fas fa-info-circle"></i> Esperando escaneo...</p>
                </div>
            </div>

            <div class="popup-footer">
                <button class="btn btn-secondary close-popup-btn">Cancelar</button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Variables
    let stream = null;
    let barcodeDetector = null;
    let animationFrameId = null;

    // Iniciar escáner automáticamente
    setTimeout(startScanner, 500);

    // Eventos de cierre
    popup.querySelector('.close-popup').addEventListener('click', cleanupAndClose);
    popup.querySelector('.close-popup-btn').addEventListener('click', cleanupAndClose);
    popup.addEventListener('click', function(e) {
        if (e.target === popup) cleanupAndClose();
    });

    // Eventos escáner
    popup.querySelector('#startCameraBtn').addEventListener('click', startScanner);
    popup.querySelector('#stopCameraBtn').addEventListener('click', stopScanner);
    popup.querySelector('#confirmManualBtn').addEventListener('click', handleManualInput);
    popup.querySelector('#manualBarcodeInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') handleManualInput();
    });

    // Función de limpieza y cierre
    function cleanupAndClose() {
        stopScanner();
        if (popup.parentNode) {
            document.body.removeChild(popup);
        }
    }

    // Iniciar escáner
    async function startScanner() {
        try {
            updateStatus('Inicializando escáner...', 'info');

            // Verificar si la API BarcodeDetector está disponible
            if (!('BarcodeDetector' in window)) {
                throw new Error('Escáner no soportado por tu navegador');
            }

            // Crear el detector
            const supportedFormats = await BarcodeDetector.getSupportedFormats();
            if (supportedFormats.length === 0) {
                throw new Error('Ningún formato de código de barras soportado');
            }

            barcodeDetector = new BarcodeDetector({
                formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']
            });

            // Iniciar cámara
            stream = await navigator.mediaDevices.getUserMedia({
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

            // Actualizar botones
            popup.querySelector('#startCameraBtn').style.display = 'none';
            popup.querySelector('#stopCameraBtn').style.display = 'inline-block';

            // Iniciar detección
            detectBarcodes();

            updateStatus('Escáner activo. Centra el código de barras...', 'success');

        } catch (error) {
            console.error('Error escáner:', error);
            updateStatus(`Error: ${error.message}. Usa la entrada manual.`, 'error');
            popup.querySelector('#manualBarcodeInput').focus();
        }
    }

    // Detener escáner
    function stopScanner() {
        // Detener animación
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        // Detener cámara
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }

        // Reiniciar interfaz
        const video = popup.querySelector('#cameraPreview');
        if (video) {
            video.srcObject = null;
            video.style.display = 'none';
        }

        const placeholder = popup.querySelector('#cameraPlaceholder');
        if (placeholder) {
            placeholder.style.display = 'block';
        }

        popup.querySelector('#startCameraBtn').style.display = 'inline-block';
        popup.querySelector('#stopCameraBtn').style.display = 'none';

        updateStatus('Escáner detenido', 'warning');
    }

    // Detectar códigos de barras
    function detectBarcodes() {
        if (!stream || !barcodeDetector) return;

        const video = popup.querySelector('#cameraPreview');
        const canvas = popup.querySelector('#scanCanvas');
        const context = canvas.getContext('2d');

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            // Actualizar tamaño del canvas
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Dibujar imagen de video en el canvas
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Detectar códigos de barras
            barcodeDetector.detect(canvas)
                .then(barcodes => {
                    if (barcodes.length > 0) {
                        const barcode = barcodes[0];
                        console.log('Código detectado:', barcode.rawValue);
                        processBarcode(barcode.rawValue);
                    } else {
                        // Continuar detección
                        animationFrameId = requestAnimationFrame(detectBarcodes);
                    }
                })
                .catch(error => {
                    console.error('Error detección:', error);
                    animationFrameId = requestAnimationFrame(detectBarcodes);
                });
        } else {
            animationFrameId = requestAnimationFrame(detectBarcodes);
        }
    }

    // Procesar código de barras detectado
    function processBarcode(barcode) {
        console.log('Código de barras escaneado:', barcode);

        updateStatus(`Código detectado: ${barcode}. Procesando...`, 'success');

        // Cerrar popup
        cleanupAndClose();

        // Actualizar campo manual en el formulario principal
        const manualInput = document.getElementById('manualBarcodeInput');
        if (manualInput) {
            manualInput.value = barcode;
            handleManualBarcodeInput({ target: manualInput });
        }

        // Mostrar notificación
        showScanSuccess(barcode);
    }

    // Manejar entrada manual
    function handleManualInput() {
        const manualInput = popup.querySelector('#manualBarcodeInput');
        const barcode = manualInput.value.trim();

        if (!barcode) {
            updateStatus('Por favor, introduce un código de barras', 'error');
            return;
        }

        if (barcode.length < 8) {
            updateStatus('Código de barras demasiado corto', 'error');
            return;
        }

        processBarcode(barcode);
    }

    // Actualizar estado
    function updateStatus(message, type = 'info') {
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

    // Mostrar mensaje de éxito
    function showScanSuccess(barcode) {
        const successDiv = document.createElement('div');
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px;
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

        // Animación CSS
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        // Eliminar después de 3 segundos
        setTimeout(() => {
            if (successDiv.parentNode) {
                document.body.removeChild(successDiv);
            }
            if (style.parentNode) {
                document.head.removeChild(style);
            }
        }, 3000);
    }
}

// ===== CÁLCULOS =====
function calculateTotalValue() {
    const quantity = parseFloat(document.getElementById('initialQuantity').value) || 0;
    const price = parseFloat(document.getElementById('unitPrice').value) || 0;
    const total = quantity * price;

    document.getElementById('totalValueDisplay').textContent = total.toFixed(2) + ' €';
    updateSummaryField('summaryValue', total.toFixed(2) + ' €');
    updateSummaryField('summaryQuantity', quantity);
}

// ===== ACTUALIZACIÓN DEL RESUMEN =====
function updateSummary() {
    updateSummaryField('summaryName', document.getElementById('articleName').value || '-');
    updateSummaryField('summaryNumber', document.getElementById('articleNumber').value || '-');
    updateSummaryField('summaryQuantity', document.getElementById('initialQuantity').value || '0');

    const quantity = parseFloat(document.getElementById('initialQuantity').value) || 0;
    const price = parseFloat(document.getElementById('unitPrice').value) || 0;
    const total = quantity * price;
    updateSummaryField('summaryValue', total.toFixed(2) + ' €');
}

function updateSummaryField(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

// ===== ENVÍO DEL FORMULARIO =====
async function handleFormSubmit(event) {
    event.preventDefault();

    // Obtener datos del formulario
    const formData = getFormData();

    // Validar datos
    const validation = validateFormData(formData);
    if (!validation.isValid) {
        showFormError(validation.message);
        return;
    }

    // Desactivar botón de envío
    const submitBtn = document.querySelector('.btn-primary[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando artículo...';
    submitBtn.disabled = true;

    try {
        // Verificar si el número de artículo ya existe
        const { data: existingArticle, error: checkError } = await supabase
            .from('w_articles')
            .select('id')
            .eq('numero', formData.numero)
            .maybeSingle();

        if (existingArticle && !checkError) {
            showFormError('Este número de artículo ya existe. Por favor, elige otro.');
            return;
        }

        // Verificar si el código de barras ya existe (si se proporciona)
        if (formData.code_barre) {
            const { data: existingBarcode, error: barcodeError } = await supabase
                .from('w_articles')
                .select('id')
                .eq('code_barre', formData.code_barre)
                .maybeSingle();

            if (existingBarcode && !barcodeError) {
                showFormError('Este código de barras ya está en uso por otro artículo.');
                return;
            }
        }

        // Subir foto si existe
        let photoUrl = null;
        if (currentPhoto) {
            photoUrl = await uploadPhoto(currentPhoto);
        }

                // Preparar datos para Supabase
        const articleData = {
            nom: formData.nom,
            numero: formData.numero,
            code_barre: formData.code_barre,
            photo_url: photoUrl,
            caracteristiques: formData.caracteristiques,
            prix_unitaire: formData.prix_unitaire,
            stock_actuel: formData.stock_actuel,
            stock_reserve: 0, // AGREGADO AQUÍ
            stock_minimum: formData.stock_minimum,
            reference_interne: formData.reference_interne,

            rack_id: formData.rack_id,
            level_id: formData.level_id,
            slot_id: formData.slot_id,

            actif: true
        };

        // Insertar artículo en la base de datos
        const { data: newArticle, error: insertError } = await supabase
            .from('w_articles')
            .insert([articleData])
            .select()
            .single();

        if (insertError) throw insertError;

        // ACTUALIZACIÓN DEL SLOT - AGREGADO AQUÍ
        if (formData.slot_id) {
            const { error: slotError } = await supabase
                .from('w_vuestock_slots')
                .update({
                    status: 'occupied',
                    updated_at: new Date().toISOString()  // Opcional pero recomendado
                })
                .eq('id', formData.slot_id);

            if (slotError) {
                console.error('Error actualizando estado del slot:', slotError);
                // Puedes decidir manejar este error de otra manera
                // Por ejemplo: revertir la creación del artículo
                // o simplemente registrar el error
            }
        }

        // Registrar movimiento de entrada inicial
        if (formData.stock_actuel > 0) {
            await supabase
                .from('w_mouvements')
                .insert([
                    {
                        article_id: newArticle.id,
                        type: 'entree',
                        quantite: formData.stock_actuel,
                        projet: 'Stock inicial',
                        commentaire: 'Creación del artículo',
                        utilisateur_id: currentUser.id
                    }
                ]);
        }

        // Mostrar mensaje de éxito
        showFormSuccess(`¡Artículo "${formData.nom}" creado con éxito!`);

        // Reiniciar formulario después de un tiempo
        setTimeout(() => {
            handleFormReset();
            generateArticleNumber();
            generateBarcode();
            removePhoto();
        }, 3000);

    } catch (error) {
        console.error('Error al crear el artículo:', error);
        showFormError('Error al crear el artículo: ' + error.message);

    } finally {
        // Reactivar botón
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function getFormData() {
    // Recuperar código de barras según opción seleccionada
    let barcode = '';
    if (isManualBarcode) {
        barcode = document.getElementById('manualBarcodeInput').value.trim();
    } else {
        barcode = generatedBarcode;
    }

    return {
        nom: document.getElementById('articleName').value.trim(),
        numero: document.getElementById('articleNumber').value.trim(),
        code_barre: barcode,
        caracteristiques: document.getElementById('articleDescription').value.trim(),
        reference_interne: document.getElementById('internalReference').value.trim(),
        stock_actuel: parseInt(document.getElementById('initialQuantity').value) || 0,
        stock_minimum: parseInt(document.getElementById('minimumStock').value) || 1,
        prix_unitaire: parseFloat(document.getElementById('unitPrice').value) || 0,

        rack_id: document.getElementById('rackSelect').value ? parseInt(document.getElementById('rackSelect').value) : null,
        level_id: document.getElementById('levelSelect').value ? parseInt(document.getElementById('levelSelect').value) : null,
        slot_id: document.getElementById('slotSelect').value ? parseInt(document.getElementById('slotSelect').value) : null
    };
}

function validateFormData(data) {
    // Verificar campos obligatorios
    if (!data.nom) {
        return { isValid: false, message: 'El nombre del artículo es obligatorio' };
    }

    if (!data.numero) {
        return { isValid: false, message: 'El número de artículo es obligatorio' };
    }

    if (!data.code_barre) {
        return { isValid: false, message: 'El código de barras es obligatorio' };
    }

    if (data.code_barre.length !== 13) {
        return { isValid: false, message: 'El código de barras debe contener 13 dígitos' };
    }

    if (data.stock_actuel < 0) { // CAMBIADO AQUÍ
        return { isValid: false, message: 'La cantidad inicial no puede ser negativa' };
    }

    if (data.stock_minimum < 1) {
        return { isValid: false, message: 'El stock mínimo debe ser de al menos 1' };
    }

    if (data.prix_unitaire < 0) {
        return { isValid: false, message: 'El precio unitario no puede ser negativo' };
    }

    return { isValid: true, message: '' };
}

async function uploadPhoto(photo) {
    try {
        // Generar nombre de archivo único
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        const fileName = `${timestamp}_${random}.${photo.file.type.split('/')[1] || 'jpg'}`;
        const filePath = `articles/${fileName}`;

        // Convertir DataURL a Blob
        const response = await fetch(photo.dataUrl);
        const blob = await response.blob();

        // Subir a Supabase Storage
        const { data, error } = await supabase.storage
            .from('Stockfr')
            .upload(filePath, blob, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        // Obtener URL pública
        const { data: { publicUrl } } = supabase.storage
            .from('Stockfr')
            .getPublicUrl(filePath);

        console.log('Foto subida:', publicUrl);
        return publicUrl;

    } catch (error) {
        console.error('Error al subir la foto:', error);

        // En caso de error, usar la URL de datos como fallback
        // (pero no es ideal a largo plazo)
        return photo.dataUrl;
    }
}

// Verificar si el bucket existe y es accesible
async function checkStorageBucket() {
    try {
        const { data, error } = await supabase.storage
            .from('Stockfr')
            .list('articles', { limit: 1 });

        if (error && error.message.includes('bucket')) {
            console.warn('Bucket no encontrado, intentando crear...');
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error verificando bucket:', error);
        return false;
    }
}

// Optimizar imagen antes de subir
function optimizeImage(file, maxWidth = 800, maxHeight = 800, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Redimensionar si es necesario
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convertir a formato WebP para mejor compresión
                canvas.toBlob(function(blob) {
                    const optimizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + '.webp', {
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

function handleFormReset() {
    // Mantener número y código de barras generados
    const currentNumber = document.getElementById('articleNumber').value;
    const currentBarcode = isManualBarcode ?
        document.getElementById('manualBarcodeInput').value :
        generatedBarcode;

    // Reiniciar formulario (excepto algunos campos)
    document.getElementById('creationForm').reset();

    // Restaurar valores generados
    if (!currentNumber.includes('ART-')) {
        generateArticleNumber();
    } else {
        document.getElementById('articleNumber').value = currentNumber;
    }

    if (isManualBarcode) {
        document.getElementById('manualBarcodeInput').value = currentBarcode;
        updateBarcodePreview(currentBarcode);
    } else {
        generateBarcode();
    }

    // Reiniciar foto
    removePhoto();

    // Reiniciar mensajes
    hideFormMessages();

    // Actualizar resumen
    updateSummary();
    calculateTotalValue();
}

// ===== GESTIÓN DE MENSAJES =====
function showFormError(message) {
    const errorDiv = document.getElementById('formError');
    const errorText = document.getElementById('formErrorText');
    const successDiv = document.getElementById('formSuccess');

    errorText.textContent = message;
    errorDiv.style.display = 'flex';
    successDiv.style.display = 'none';

    // Desplazar hacia el error
    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showFormSuccess(message) {
    const successDiv = document.getElementById('formSuccess');
    const successText = document.getElementById('formSuccessText');
    const errorDiv = document.getElementById('formError');

    successText.textContent = message;
    successDiv.style.display = 'flex';
    errorDiv.style.display = 'none';

    // Desplazar hacia el éxito
    successDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideFormMessages() {
    document.getElementById('formError').style.display = 'none';
    document.getElementById('formSuccess').style.display = 'none';
}

// ===== UTILITARIOS =====
function logout() {
    if (!confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        return;
    }

    sessionStorage.removeItem('current_user');
    sessionStorage.removeItem('supabase_token');
    window.location.href = 'connexion.html';
}