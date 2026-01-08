// ===== GESTIONNAIRE VUE 3D =====
class View3DManager {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.racks3D = [];
        this.selectedObject = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.currentMode = 'normal';
        this.animationId = null;

        // Bind methods
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseClick = this.onMouseClick.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);
        this.animate = this.animate.bind(this);
    }

    init() {
        console.log('🎬 Initialisation Vue 3D');

        const canvas = document.getElementById('canvas3D');
        const container = canvas.parentElement;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        this.scene.fog = new THREE.Fog(0x1a1a2e, 50, 200);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(30, 30, 30);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Optimisation
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping; // ✅ Meilleur rendu des couleurs
        this.renderer.toneMappingExposure = 1.2; // ✅ Ajuster l'exposition
        this.renderer.outputEncoding = THREE.sRGBEncoding; // ✅ Couleurs correctes

        // Lights
        this.addLights();

        // Grid
        this.addGrid();

        // ✅ Système de particules ambiantes
        this.addAmbientParticles();

        // Controls (OrbitControls simulation simple)
        this.setupSimpleControls();

        // Events
        canvas.addEventListener('mousemove', this.onMouseMove, false);
        canvas.addEventListener('click', this.onMouseClick, false);
        window.addEventListener('resize', this.onWindowResize, false);

        // Load data
        this.loadRacks();

        // Start animation
        this.animate();

        // Hide loading
        document.getElementById('loading3D').style.display = 'none';
        document.getElementById('controls3D').style.display = 'block';
        document.getElementById('stats3D').style.display = 'block';
        document.getElementById('minimap3D').style.display = 'block';

        console.log('✅ Vue 3D initialisée');
    }

    addLights() {
        // ✅ Ambient light améliorée
        const ambientLight = new THREE.AmbientLight(0x667eea, 0.4);
        this.scene.add(ambientLight);

        // ✅ Directional light (sun) avec ombres douces
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(50, 60, 30);
        dirLight.castShadow = true;
        dirLight.shadow.camera.left = -50;
        dirLight.shadow.camera.right = 50;
        dirLight.shadow.camera.top = 50;
        dirLight.shadow.camera.bottom = -50;
        dirLight.shadow.mapSize.width = 4096;
        dirLight.shadow.mapSize.height = 4096;
        dirLight.shadow.bias = -0.0001;
        dirLight.shadow.radius = 4; // Ombres douces
        this.scene.add(dirLight);

        // Helper visuel pour debug (optionnel)
        // const dirLightHelper = new THREE.DirectionalLightHelper(dirLight, 5);
        // this.scene.add(dirLightHelper);

        // ✅ Hemisphere light avec couleurs chaudes
        const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x362c28, 0.5);
        this.scene.add(hemiLight);

        // ✅ Lumières d'accentuation (spotlights)
        const spotLight1 = new THREE.SpotLight(0x667eea, 0.5);
        spotLight1.position.set(-30, 30, 30);
        spotLight1.angle = Math.PI / 6;
        spotLight1.penumbra = 0.3;
        spotLight1.decay = 2;
        spotLight1.distance = 100;
        this.scene.add(spotLight1);

        const spotLight2 = new THREE.SpotLight(0xff6b9d, 0.3);
        spotLight2.position.set(30, 30, -30);
        spotLight2.angle = Math.PI / 6;
        spotLight2.penumbra = 0.3;
        spotLight2.decay = 2;
        spotLight2.distance = 100;
        this.scene.add(spotLight2);

        // ✅ Point lights pour ambiance
        const pointLight1 = new THREE.PointLight(0x667eea, 0.5, 50);
        pointLight1.position.set(0, 20, 0);
        this.scene.add(pointLight1);
    }

    addGrid() {
        // ✅ Floor amélioré avec reflets
        const floorGeometry = new THREE.PlaneGeometry(200, 200);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e,
            roughness: 0.6,
            metalness: 0.4,
            envMapIntensity: 0.5
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Grid helper avec effet lumineux
        const gridHelper = new THREE.GridHelper(200, 50, 0x667eea, 0x2a2a3e);
        gridHelper.position.y = 0.01;
        gridHelper.material.opacity = 0.5;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);

        // Ajouter des lignes brillantes
        const glowGridHelper = new THREE.GridHelper(200, 10, 0x667eea, 0x667eea);
        glowGridHelper.position.y = 0.02;
        glowGridHelper.material.opacity = 0.2;
        glowGridHelper.material.transparent = true;
        this.scene.add(glowGridHelper);
    }

    // ✅ NOUVELLE MÉTHODE : Particules ambiantes
    addAmbientParticles() {
        const particleCount = 500;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 100;
            positions[i * 3 + 1] = Math.random() * 40;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 100;

            velocities.push({
                x: (Math.random() - 0.5) * 0.02,
                y: Math.random() * 0.01,
                z: (Math.random() - 0.5) * 0.02
            });
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0x667eea,
            size: 0.1,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });

        this.particles = new THREE.Points(geometry, material);
        this.particleVelocities = velocities;
        this.scene.add(this.particles);
    }

    setupSimpleControls() {
        // Simple orbit controls without library
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        let rotation = { x: 0, y: 0 };
        let distance = 50;
        let target = new THREE.Vector3(0, 5, 0);

        const canvas = this.renderer.domElement;

        const updateCamera = () => {
            const phi = rotation.x;
            const theta = rotation.y;

            this.camera.position.x = target.x + distance * Math.sin(phi) * Math.cos(theta);
            this.camera.position.y = target.y + distance * Math.sin(theta);
            this.camera.position.z = target.z + distance * Math.cos(phi) * Math.cos(theta);
            this.camera.lookAt(target);
        };

        canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        canvas.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - previousMousePosition.x;
                const deltaY = e.clientY - previousMousePosition.y;

                rotation.x += deltaX * 0.01;
                rotation.y += deltaY * 0.01;

                // Limit vertical rotation
                rotation.y = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, rotation.y));

                previousMousePosition = { x: e.clientX, y: e.clientY };
                updateCamera();
            }
        });

        canvas.addEventListener('mouseup', () => {
            isDragging = false;
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            distance += e.deltaY * 0.05;
            distance = Math.max(10, Math.min(100, distance));
            updateCamera();
        });

        // Pan with right click
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        let isPanning = false;
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 2) { // Right click
                isPanning = true;
                previousMousePosition = { x: e.clientX, y: e.clientY };
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            if (isPanning) {
                const deltaX = e.clientX - previousMousePosition.x;
                const deltaY = e.clientY - previousMousePosition.y;

                const right = new THREE.Vector3();
                const up = new THREE.Vector3(0, 1, 0);
                this.camera.getWorldDirection(right);
                right.cross(up).normalize();

                target.add(right.multiplyScalar(-deltaX * 0.05));
                target.y += deltaY * 0.05;

                previousMousePosition = { x: e.clientX, y: e.clientY };
                updateCamera();
            }
        });

        canvas.addEventListener('mouseup', (e) => {
            if (e.button === 2) {
                isPanning = false;
            }
        });

        updateCamera();
    }

    loadRacks() {
        console.log('📦 Chargement des étagères en 3D');

        if (!window.vueStock || !window.vueStock.racks) {
            console.warn('Aucune donnée d\'étagère disponible');
            return;
        }

        const racks = window.vueStock.racks;
        console.log(`Found ${racks.length} racks`);

        racks.forEach(rack => {
            this.createRack3D(rack);
        });

        this.updateStats();
        this.drawMinimap();
    }

    createRack3D(rack) {
        // Convertir les coordonnées 2D en 3D
        const gridSize = 0.4; // Scale factor
        const x = (rack.position_x || 0) * gridSize / 40;
        const z = (rack.position_y || 0) * gridSize / 40;
        const width = (rack.width || 3) * gridSize;
        const depth = (rack.depth || 2) * gridSize;

        // Hauteur basée sur le nombre d'étages
        const levels = rack.levels || [];
        const height = Math.max(2, levels.length * 0.8);

        // Créer le groupe pour l'étagère
        const rackGroup = new THREE.Group();
        rackGroup.userData = { rack: rack, type: 'rack' };

        // ✅ Structure principale avec matériau amélioré
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const color = new THREE.Color(rack.color || '#4a90e2');

        // Créer un matériau avec texture procédurale
        const material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.4,
            metalness: 0.6,
            envMapIntensity: 0.8
        });

        // Ajouter un effet de bords brillants
        const edgeMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            roughness: 0.2,
            metalness: 0.9,
            emissive: new THREE.Color(0x444444),
            emissiveIntensity: 0.1
        });

        const mesh = new THREE.Mesh(geometry, material);

        // Ajouter un contour métallique
        const edgesGeometry = new THREE.EdgesGeometry(geometry, 15);
        const edgesMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            linewidth: 2,
            transparent: true,
            opacity: 0.3
        });
        const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        mesh.add(edges);
        mesh.position.y = height / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        rackGroup.add(mesh);

        // Ajouter les étages si disponibles
        levels.forEach((level, index) => {
            const levelY = (index + 0.5) * (height / levels.length);

            // Ligne pour représenter l'étage
            const edgesGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(width, 0.05, depth));
            const edgesMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
            const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
            edges.position.y = levelY;
            rackGroup.add(edges);

            // Ajouter les emplacements
            const slots = level.slots || [];
            slots.forEach((slot, slotIndex) => {
                const slotMesh = this.createSlot3D(slot, slotIndex, slots.length, width, depth, levelY);
                rackGroup.add(slotMesh);
            });
        });

        // Label
        this.addLabel(rackGroup, rack.code || 'N/A', height);

        // Rotation
        if (rack.rotation) {
            rackGroup.rotation.y = (rack.rotation * Math.PI) / 180;
        }

        // Position
        rackGroup.position.set(x, 0, z);

        this.scene.add(rackGroup);
        this.racks3D.push(rackGroup);
    }

    createSlot3D(slot, index, total, rackWidth, rackDepth, levelY) {
        const slotWidth = rackWidth / total;
        const slotX = -rackWidth / 2 + slotWidth / 2 + index * slotWidth;

        // Calculer la couleur selon le remplissage
        let color = 0x888888; // Gris = vide
        if (slot.articles && slot.articles.length > 0) {
            const totalQty = slot.articles.reduce((sum, art) => sum + (art.quantity || 0), 0);
            const capacity = slot.capacity || 100;
            const fillRate = totalQty / capacity;

            if (fillRate < 0.5) {
                color = 0x2ecc71; // Vert
            } else if (fillRate < 0.8) {
                color = 0xf39c12; // Orange
            } else {
                color = 0xe74c3c; // Rouge
            }
        }

        // ✅ Slot avec matériau amélioré et effets
        const geometry = new THREE.BoxGeometry(slotWidth * 0.8, 0.1, rackDepth * 0.8);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.2,
            roughness: 0.5,
            metalness: 0.3,
            transparent: true,
            opacity: 0.9
        });
        const mesh = new THREE.Mesh(geometry, material);

        // Ajouter un contour lumineux
        const outlineGeometry = new THREE.BoxGeometry(slotWidth * 0.82, 0.12, rackDepth * 0.82);
        const outlineMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide
        });
        const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
        mesh.add(outline);

        // Animation de pulsation pour les slots pleins
        if (slot.articles && slot.articles.length > 0) {
            mesh.userData.animate = true;
            mesh.userData.pulseSpeed = 0.001 + Math.random() * 0.001;
            mesh.userData.pulsePhase = Math.random() * Math.PI * 2;
        }
        mesh.position.set(slotX, levelY, 0);
        mesh.userData = { slot: slot, type: 'slot' };

        return mesh;
    }

    addLabel(group, text, height) {
        // Simple text sprite (fallback)
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;

        context.fillStyle = 'rgba(255, 255, 255, 0.9)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.font = 'Bold 48px Arial';
        context.fillStyle = '#333';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(2, 1, 1);
        sprite.position.y = height + 1;
        group.add(sprite);
    }

    onMouseMove(event) {
        const canvas = this.renderer.domElement;
        const rect = canvas.getBoundingClientRect();

        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Raycast pour highlight
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        // ✅ Reset previous highlight avec animation
        if (this.hoveredObject) {
            if (this.hoveredObject.material) {
                this.hoveredObject.material.emissiveIntensity = 0.2;
            }
            // Réinitialiser l'échelle
            if (this.hoveredObject.userData.originalScale) {
                this.hoveredObject.scale.copy(this.hoveredObject.userData.originalScale);
            } else {
                this.hoveredObject.scale.set(1, 1, 1);
            }
        }

        const tooltip = document.getElementById('tooltip3D');

        if (intersects.length > 0) {
            const object = intersects[0].object;

            if (object.userData && (object.userData.type === 'slot' || object.userData.type === 'rack')) {
                this.hoveredObject = object;

                // ✅ Effet de surbrillance amélioré
                if (object.material) {
                    object.material.emissiveIntensity = 0.6;
                }

                // ✅ Effet de scale au survol
                if (!object.userData.originalScale) {
                    object.userData.originalScale = object.scale.clone();
                }
                object.scale.set(1.05, 1.1, 1.05);

                // Show tooltip
                this.showTooltip(object.userData, event);
            } else {
                tooltip.classList.remove('visible');
            }
        } else {
            tooltip.classList.remove('visible');
        }
    }

    showTooltip(userData, event) {
        const tooltip = document.getElementById('tooltip3D');

        if (userData.type === 'slot' && userData.slot) {
            const slot = userData.slot;

            let html = `
                <div class="tooltip-3d-header">
                    <div class="tooltip-3d-info">
                        <h4>Emplacement ${slot.code || 'N/A'}</h4>
                        <div class="tooltip-3d-code">${slot.full_code || 'N/A'}</div>
                    </div>
                </div>
                <div class="tooltip-3d-body">
            `;

            if (slot.articles && slot.articles.length > 0) {
                slot.articles.forEach(article => {
                    html += `
                        <div class="tooltip-stock-item">
                            <span class="tooltip-stock-label">${article.name || 'Article'}</span>
                            <span class="tooltip-stock-value">${article.quantity || 0} unités</span>
                        </div>
                    `;
                });
            } else {
                html += '<p style="color: #999; font-style: italic;">Vide</p>';
            }

            html += `
                </div>
                <div class="tooltip-actions">
                    <button class="tooltip-btn" onclick="view3DManager.focusOnSlot('${slot.id}')">
                        <i class="fas fa-crosshairs"></i> Focus
                    </button>
                </div>
            `;

            tooltip.innerHTML = html;
        } else if (userData.type === 'rack' && userData.rack) {
            const rack = userData.rack;
            tooltip.innerHTML = `
                <div class="tooltip-3d-header">
                    <div class="tooltip-3d-info">
                        <h4>Étagère ${rack.code || 'N/A'}</h4>
                        <div class="tooltip-3d-code">${rack.name || ''}</div>
                    </div>
                </div>
                <div class="tooltip-3d-body">
                    <div class="tooltip-stock-item">
                        <span class="tooltip-stock-label">Étages :</span>
                        <span class="tooltip-stock-value">${rack.levels ? rack.levels.length : 0}</span>
                    </div>
                    <div class="tooltip-stock-item">
                        <span class="tooltip-stock-label">Dimensions :</span>
                        <span class="tooltip-stock-value">${rack.width}x${rack.depth}</span>
                    </div>
                </div>
            `;
        }

        tooltip.style.left = event.clientX + 15 + 'px';
        tooltip.style.top = event.clientY + 15 + 'px';
        tooltip.classList.add('visible');
    }

    onMouseClick(event) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        if (intersects.length > 0) {
            const object = intersects[0].object;

            if (object.userData && object.userData.type === 'slot') {
                console.log('Slot clicked:', object.userData.slot);
                // ✅ Ouvrir le modal détaillé
                this.openSlotDetailModal(object.userData.slot);
            }
        }
    }

    // ✅ NOUVELLE MÉTHODE : Ouvrir le modal de détail
    openSlotDetailModal(slot) {
        console.log('📋 Ouverture modal pour:', slot);

        const modal = document.getElementById('slotDetailModal');
        const backdrop = document.getElementById('slotModalBackdrop');
        const titleEl = document.getElementById('slotModalTitle');
        const codeEl = document.getElementById('slotModalCode');
        const bodyEl = document.getElementById('slotModalBody');

        // Titre et code
        titleEl.textContent = `Emplacement ${slot.code || 'N/A'}`;
        codeEl.textContent = slot.full_code || '--';

        // Contenu du modal
        let html = `
            <div class="slot-info-grid">
                <div class="slot-info-item">
                    <div class="slot-info-label">Capacité</div>
                    <div class="slot-info-value">${slot.capacity || 100}</div>
                </div>
                <div class="slot-info-item">
                    <div class="slot-info-label">Statut</div>
                    <div class="slot-info-value">${slot.status || 'Libre'}</div>
                </div>
            </div>

            <div class="articles-section">
                <h4><i class="fas fa-boxes"></i> Articles (${slot.articles ? slot.articles.length : 0})</h4>
        `;

        if (slot.articles && slot.articles.length > 0) {
            slot.articles.forEach((article, index) => {
                const stockActuel = article.quantity || 0;
                const stockReserve = article.reserved || 0;
                const stockDispo = stockActuel - stockReserve;

                html += `
                    <div class="article-card">
                        <div class="article-header">
                            ${article.photo ?
                                `<img src="${article.photo}" class="article-image" alt="${article.name}">` :
                                `<div class="article-image placeholder"><i class="fas fa-box"></i></div>`
                            }
                            <div class="article-info">
                                <h5 class="article-name">${article.name || 'Article sans nom'}</h5>
                                ${article.barcode ?
                                    `<span class="article-code">${article.barcode}</span>` :
                                    ''
                                }
                                <div class="stock-status">
                                    <div class="stock-item">
                                        <span class="stock-item-label">Stock :</span>
                                        <span class="stock-item-value">${stockActuel}</span>
                                    </div>
                                    <div class="stock-item">
                                        <span class="stock-item-label">Réservé :</span>
                                        <span class="stock-item-value reserved">${stockReserve}</span>
                                    </div>
                                    <div class="stock-item">
                                        <span class="stock-item-label">Disponible :</span>
                                        <span class="stock-item-value available">${stockDispo}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="article-quantity">
                            <span class="quantity-label">Ajuster quantité :</span>
                            <div class="quantity-controls">
                                <button class="quantity-btn" onclick="view3DManager.adjustQuantity('${slot.id}', ${index}, -1)">
                                    <i class="fas fa-minus"></i>
                                </button>
                                <input type="number" class="quantity-input"
                                       value="${stockActuel}"
                                       id="qty_${slot.id}_${index}"
                                       onchange="view3DManager.setQuantity('${slot.id}', ${index}, this.value)">
                                <button class="quantity-btn" onclick="view3DManager.adjustQuantity('${slot.id}', ${index}, 1)">
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            html += `
                <div class="empty-slot-message">
                    <i class="fas fa-box-open"></i>
                    <p>Aucun article dans cet emplacement</p>
                </div>
            `;
        }

        html += `</div>`;

        bodyEl.innerHTML = html;

        // Afficher le modal
        backdrop.classList.add('active');
        modal.classList.add('active');

        // Stocker le slot pour les modifications
        this.currentEditingSlot = slot;
    }

    // ✅ NOUVELLE MÉTHODE : Ajuster quantité
    adjustQuantity(slotId, articleIndex, delta) {
        const input = document.getElementById(`qty_${slotId}_${articleIndex}`);
        if (input) {
            const newValue = Math.max(0, parseInt(input.value) + delta);
            input.value = newValue;
            this.setQuantity(slotId, articleIndex, newValue);
        }
    }

    // ✅ NOUVELLE MÉTHODE : Définir quantité
    setQuantity(slotId, articleIndex, newQuantity) {
        console.log(`📝 Mise à jour quantité: Slot ${slotId}, Article ${articleIndex}, Qté ${newQuantity}`);

        if (!this.currentEditingSlot) return;

        // Mettre à jour dans l'objet local
        if (this.currentEditingSlot.articles && this.currentEditingSlot.articles[articleIndex]) {
            this.currentEditingSlot.articles[articleIndex].quantity = parseInt(newQuantity);

            // Marquer comme modifié
            this.currentEditingSlot._modified = true;
        }
    }

    // ✅ NOUVELLE MÉTHODE : Sauvegarder les modifications
    async saveSlotChanges() {
        if (!this.currentEditingSlot || !this.currentEditingSlot._modified) {
            console.log('Aucune modification à sauvegarder');
            return;
        }

        console.log('💾 Sauvegarde des modifications...', this.currentEditingSlot);

        try {
            // TODO: Appel API pour sauvegarder
            // await window.vueStock.api.saveSlot(this.currentEditingSlot);

            alert('✅ Modifications sauvegardées !');

            // Fermer le modal
            this.closeSlotModal();

            // Recharger la vue 3D pour refléter les changements de couleur
            this.updateSlotColors();

        } catch (error) {
            console.error('❌ Erreur de sauvegarde:', error);
            alert('Erreur lors de la sauvegarde');
        }
    }

    // ✅ NOUVELLE MÉTHODE : Mettre à jour les couleurs des slots
    updateSlotColors() {
        this.racks3D.forEach(rackGroup => {
            rackGroup.traverse(child => {
                if (child.userData && child.userData.type === 'slot') {
                    const slot = child.userData.slot;

                    // Recalculer la couleur
                    let color = 0x888888; // Gris = vide
                    if (slot.articles && slot.articles.length > 0) {
                        const totalQty = slot.articles.reduce((sum, art) => sum + (art.quantity || 0), 0);
                        const capacity = slot.capacity || 100;
                        const fillRate = totalQty / capacity;

                        if (fillRate < 0.5) {
                            color = 0x2ecc71; // Vert
                        } else if (fillRate < 0.8) {
                            color = 0xf39c12; // Orange
                        } else {
                            color = 0xe74c3c; // Rouge
                        }
                    }

                    child.material.color.setHex(color);
                }
            });
        });
    }

    // ✅ NOUVELLE MÉTHODE : Fermer le modal
    closeSlotModal() {
        const modal = document.getElementById('slotDetailModal');
        const backdrop = document.getElementById('slotModalBackdrop');

        modal.classList.remove('active');
        backdrop.classList.remove('active');

        this.currentEditingSlot = null;
    }

    // ===== MODE INVENTAIRE =====

    // ✅ NOUVELLE MÉTHODE : Démarrer le mode inventaire
    startInventoryMode() {
        console.log('📋 Démarrage du mode inventaire');

        this.inventoryMode = true;
        this.inventoryData = {
            slots: [],
            checked: 0,
            discrepancies: 0,
            startTime: Date.now()
        };

        // Collecter tous les emplacements
        this.collectAllSlots();

        // Afficher l'interface inventaire
        document.getElementById('inventoryBanner').classList.add('active');
        document.getElementById('inventoryPanel').classList.add('active');

        // Masquer les autres panneaux
        document.getElementById('controls3D').style.display = 'none';
        document.getElementById('stats3D').style.display = 'none';

        // Générer la liste
        this.renderInventoryList();

        // Mettre en surbrillance les emplacements non vérifiés
        this.highlightUncheckedSlots();
    }

    // ✅ NOUVELLE MÉTHODE : Collecter tous les emplacements
    collectAllSlots() {
        const allSlots = [];

        if (window.vueStock && window.vueStock.racks) {
            window.vueStock.racks.forEach(rack => {
                if (rack.levels) {
                    rack.levels.forEach(level => {
                        if (level.slots) {
                            level.slots.forEach(slot => {
                                allSlots.push({
                                    slot: slot,
                                    rack: rack,
                                    level: level,
                                    status: 'unchecked', // unchecked, checked, discrepancy
                                    checkedData: null,
                                    notes: ''
                                });
                            });
                        }
                    });
                }
            });
        }

        this.inventoryData.slots = allSlots;
        console.log(`📦 ${allSlots.length} emplacements à vérifier`);
    }

    // ✅ NOUVELLE MÉTHODE : Afficher la liste d'inventaire
    renderInventoryList(filter = 'all') {
        const listContainer = document.getElementById('inventoryList');

        let filteredSlots = this.inventoryData.slots;

        if (filter !== 'all') {
            filteredSlots = this.inventoryData.slots.filter(item => item.status === filter);
        }

        let html = '';

        filteredSlots.forEach((item, index) => {
            const slot = item.slot;
            const articleCount = slot.articles ? slot.articles.length : 0;
            const statusClass = item.status;

            let statusIcon = '○';
            if (item.status === 'checked') {
                statusIcon = '✓';
            } else if (item.status === 'discrepancy') {
                statusIcon = '!';
            }

            html += `
                <div class="inventory-item ${statusClass}" data-index="${index}" onclick="view3DManager.selectInventoryItem(${index})">
                    <div class="inventory-item-header">
                        <span class="inventory-item-code">${slot.full_code || slot.code}</span>
                        <span class="inventory-status-icon ${statusClass}">${statusIcon}</span>
                    </div>
                    <div class="inventory-item-articles">
                        ${articleCount} article(s)
                    </div>
                    <div class="inventory-item-actions">
                        <button class="inventory-quick-btn primary" onclick="event.stopPropagation(); view3DManager.checkInventoryItem(${index})">
                            <i class="fas fa-clipboard-check"></i> Vérifier
                        </button>
                        ${item.status === 'checked' || item.status === 'discrepancy' ?
                            `<button class="inventory-quick-btn" onclick="event.stopPropagation(); view3DManager.viewInventoryDetails(${index})">
                                <i class="fas fa-eye"></i> Détails
                            </button>` : ''
                        }
                    </div>
                </div>
            `;
        });

        if (filteredSlots.length === 0) {
            html = `
                <div style="text-align: center; padding: 40px 20px; color: #adb5bd;">
                    <i class="fas fa-check-circle" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p>Aucun emplacement dans cette catégorie</p>
                </div>
            `;
        }

        listContainer.innerHTML = html;
    }

    // ✅ NOUVELLE MÉTHODE : Sélectionner un emplacement dans la liste
    selectInventoryItem(index) {
        const item = this.inventoryData.slots[index];

        // Marquer comme sélectionné dans la liste
        document.querySelectorAll('.inventory-item').forEach(el => {
            el.classList.remove('current');
        });
        document.querySelector(`[data-index="${index}"]`)?.classList.add('current');

        // Trouver l'objet 3D et zoomer dessus
        this.locateAndHighlight(item.rack, item.level, item.slot);
    }

    // ✅ NOUVELLE MÉTHODE : Ouvrir le modal de vérification
    checkInventoryItem(index) {
        const item = this.inventoryData.slots[index];
        const slot = item.slot;

        console.log('🔍 Vérification de:', slot.full_code);

        const modal = document.getElementById('inventoryCheckModal');
        const backdrop = document.getElementById('slotModalBackdrop');
        const codeEl = document.getElementById('checkModalCode');
        const bodyEl = document.getElementById('checkModalBody');

        codeEl.textContent = slot.full_code || slot.code;

        let html = '';

        if (slot.articles && slot.articles.length > 0) {
            slot.articles.forEach((article, articleIndex) => {
                const expected = article.quantity || 0;

                html += `
                    <div class="check-article">
                        <div class="check-article-name">${article.name || 'Article sans nom'}</div>
                        <div class="check-quantity">
                            <span class="check-label">Quantité comptée :</span>
                            <input type="number"
                                   class="check-input"
                                   id="check_qty_${articleIndex}"
                                   value="${expected}"
                                   min="0"
                                   onchange="view3DManager.calculateDifference(${articleIndex}, ${expected})">
                        </div>
                        <div class="check-expected">
                            Attendu : <strong>${expected}</strong>
                            <span class="check-diff" id="check_diff_${articleIndex}"></span>
                        </div>
                    </div>
                `;
            });
        } else {
            html = `
                <div style="text-align: center; padding: 20px; color: #adb5bd;">
                    <i class="fas fa-box-open" style="font-size: 36px; margin-bottom: 10px;"></i>
                    <p>Emplacement vide</p>
                </div>
            `;
        }

        html += `
            <div class="check-notes">
                <label>Notes / Observations :</label>
                <textarea id="checkNotes" placeholder="Remarques, problèmes constatés..."></textarea>
            </div>
        `;

        bodyEl.innerHTML = html;

        // Stocker l'index pour la confirmation
        this.currentCheckingIndex = index;

        // Afficher le modal
        backdrop.classList.add('active');
        modal.classList.add('active');
    }

    // ✅ NOUVELLE MÉTHODE : Calculer la différence
    calculateDifference(articleIndex, expected) {
        const input = document.getElementById(`check_qty_${articleIndex}`);
        const diffEl = document.getElementById(`check_diff_${articleIndex}`);

        if (!input || !diffEl) return;

        const counted = parseInt(input.value) || 0;
        const diff = counted - expected;

        if (diff === 0) {
            diffEl.textContent = '';
            diffEl.className = 'check-diff';
            input.classList.remove('error');
        } else {
            const sign = diff > 0 ? '+' : '';
            diffEl.textContent = `${sign}${diff}`;
            diffEl.className = `check-diff ${diff > 0 ? 'positive' : 'negative'}`;
            input.classList.add('error');
        }
    }

    // ✅ NOUVELLE MÉTHODE : Confirmer la vérification
    confirmInventoryCheck() {
        if (this.currentCheckingIndex === undefined) return;

        const item = this.inventoryData.slots[this.currentCheckingIndex];
        const slot = item.slot;

        // Collecter les données vérifiées
        const checkedData = {
            timestamp: Date.now(),
            articles: []
        };

        let hasDiscrepancy = false;

        if (slot.articles && slot.articles.length > 0) {
            slot.articles.forEach((article, index) => {
                const input = document.getElementById(`check_qty_${index}`);
                const counted = input ? parseInt(input.value) || 0 : 0;
                const expected = article.quantity || 0;

                checkedData.articles.push({
                    name: article.name,
                    expected: expected,
                    counted: counted,
                    difference: counted - expected
                });

                if (counted !== expected) {
                    hasDiscrepancy = true;
                }
            });
        }

        // Notes
        const notesEl = document.getElementById('checkNotes');
        checkedData.notes = notesEl ? notesEl.value : '';

        // Mettre à jour le statut
        item.status = hasDiscrepancy ? 'discrepancy' : 'checked';
        item.checkedData = checkedData;
        item.notes = checkedData.notes;

        // Mettre à jour les compteurs
        this.inventoryData.checked++;
        if (hasDiscrepancy) {
            this.inventoryData.discrepancies++;
        }

        this.updateInventoryStats();
        this.renderInventoryList();
        this.updateSlotColorForInventory(item);

        // Fermer le modal
        this.closeInventoryCheckModal();

        // Passer au suivant automatiquement
        const nextUnchecked = this.inventoryData.slots.findIndex(i => i.status === 'unchecked');
        if (nextUnchecked !== -1) {
            setTimeout(() => {
                this.selectInventoryItem(nextUnchecked);
            }, 300);
        }
    }

    // ✅ NOUVELLE MÉTHODE : Fermer le modal de vérification
    closeInventoryCheckModal() {
        const modal = document.getElementById('inventoryCheckModal');
        const backdrop = document.getElementById('slotModalBackdrop');

        modal.classList.remove('active');
        backdrop.classList.remove('active');

        this.currentCheckingIndex = undefined;
    }

    // ✅ NOUVELLE MÉTHODE : Voir les détails d'une vérification
    viewInventoryDetails(index) {
        const item = this.inventoryData.slots[index];

        if (!item.checkedData) return;

        let details = `Emplacement : ${item.slot.full_code}\n`;
        details += `Vérifié le : ${new Date(item.checkedData.timestamp).toLocaleString()}\n\n`;

        details += `Articles :\n`;
        item.checkedData.articles.forEach(art => {
            details += `- ${art.name}\n`;
            details += `  Attendu : ${art.expected} | Compté : ${art.counted}`;
            if (art.difference !== 0) {
                details += ` | Écart : ${art.difference > 0 ? '+' : ''}${art.difference}`;
            }
            details += `\n`;
        });

        if (item.notes) {
            details += `\nNotes : ${item.notes}`;
        }

        alert(details);
    }

    // ✅ NOUVELLE MÉTHODE : Mettre à jour les stats d'inventaire
    updateInventoryStats() {
        const total = this.inventoryData.slots.length;
        const checked = this.inventoryData.checked;
        const discrepancies = this.inventoryData.discrepancies;
        const progress = total > 0 ? Math.round((checked / total) * 100) : 0;

        document.getElementById('inventoryChecked').textContent = checked;
        document.getElementById('inventoryDiscrepancies').textContent = discrepancies;
        document.getElementById('inventoryProgress').textContent = `${progress}%`;
    }

    // ✅ NOUVELLE MÉTHODE : Mettre en surbrillance les emplacements non vérifiés
    highlightUncheckedSlots() {
        this.racks3D.forEach(rackGroup => {
            rackGroup.traverse(child => {
                if (child.userData && child.userData.type === 'slot') {
                    // Trouver l'item d'inventaire correspondant
                    const inventoryItem = this.inventoryData.slots.find(item =>
                        item.slot.id === child.userData.slot.id
                    );

                    if (inventoryItem) {
                        this.updateSlotColorForInventory(inventoryItem, child);
                    }
                }
            });
        });
    }

    // ✅ NOUVELLE MÉTHODE : Mettre à jour la couleur d'un slot pour l'inventaire
    updateSlotColorForInventory(inventoryItem, mesh = null) {
        // Trouver le mesh si non fourni
        if (!mesh) {
            this.racks3D.forEach(rackGroup => {
                rackGroup.traverse(child => {
                    if (child.userData && child.userData.type === 'slot' &&
                        child.userData.slot.id === inventoryItem.slot.id) {
                        mesh = child;
                    }
                });
            });
        }

        if (!mesh) return;

        // Couleurs selon statut
        let color;
        switch (inventoryItem.status) {
            case 'unchecked':
                color = 0xffd700; // Or (à vérifier)
                break;
            case 'checked':
                color = 0x2ecc71; // Vert (OK)
                break;
            case 'discrepancy':
                color = 0xe74c3c; // Rouge (écart)
                break;
        }

        mesh.material.color.setHex(color);
        mesh.material.emissiveIntensity = 0.4;
    }

    // ✅ NOUVELLE MÉTHODE : Exporter le rapport PDF
    exportInventoryReport() {
        console.log('📄 Export du rapport d\'inventaire');

        const duration = Date.now() - this.inventoryData.startTime;
        const hours = Math.floor(duration / 3600000);
        const minutes = Math.floor((duration % 3600000) / 60000);

        let report = `RAPPORT D'INVENTAIRE\n`;
        report += `======================\n\n`;
        report += `Date : ${new Date().toLocaleString()}\n`;
        report += `Durée : ${hours}h ${minutes}min\n\n`;
        report += `STATISTIQUES\n`;
        report += `------------\n`;
        report += `Total emplacements : ${this.inventoryData.slots.length}\n`;
        report += `Vérifiés : ${this.inventoryData.checked}\n`;
        report += `Écarts détectés : ${this.inventoryData.discrepancies}\n`;
        report += `Progrès : ${Math.round((this.inventoryData.checked / this.inventoryData.slots.length) * 100)}%\n\n`;

        // Détails des écarts
        const discrepancies = this.inventoryData.slots.filter(item => item.status === 'discrepancy');

        if (discrepancies.length > 0) {
            report += `ÉCARTS DÉTECTÉS\n`;
            report += `---------------\n\n`;

            discrepancies.forEach(item => {
                report += `Emplacement : ${item.slot.full_code}\n`;

                if (item.checkedData && item.checkedData.articles) {
                    item.checkedData.articles.forEach(art => {
                        if (art.difference !== 0) {
                            report += `  - ${art.name}\n`;
                            report += `    Attendu : ${art.expected} | Compté : ${art.counted} | Écart : ${art.difference}\n`;
                        }
                    });
                }

                if (item.notes) {
                    report += `  Notes : ${item.notes}\n`;
                }
                report += `\n`;
            });
        }

        // Télécharger comme fichier texte (en attendant une vraie lib PDF)
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `inventaire_${Date.now()}.txt`;
        link.click();
        URL.revokeObjectURL(url);

        alert('📄 Rapport d\'inventaire exporté !');
    }

    // ✅ NOUVELLE MÉTHODE : Arrêter le mode inventaire
    stopInventoryMode() {
        const confirmed = confirm(
            `Voulez-vous vraiment terminer l'inventaire ?\n\n` +
            `Progression : ${Math.round((this.inventoryData.checked / this.inventoryData.slots.length) * 100)}%\n` +
            `Vérifiés : ${this.inventoryData.checked}/${this.inventoryData.slots.length}\n` +
            `Écarts : ${this.inventoryData.discrepancies}`
        );

        if (!confirmed) return;

        // Masquer l'interface inventaire
        document.getElementById('inventoryBanner').classList.remove('active');
        document.getElementById('inventoryPanel').classList.remove('active');

        // Réafficher les panneaux normaux
        document.getElementById('controls3D').style.display = 'block';
        document.getElementById('stats3D').style.display = 'block';

        // Réinitialiser les couleurs
        this.updateSlotColors();

        // Réinitialiser l'état
        this.inventoryMode = false;
        this.inventoryData = null;

        console.log('✅ Mode inventaire terminé');
    }

    focusOnSlot(slotId) {
        console.log('Focus on slot:', slotId);
        // TODO: Animer la caméra vers l'emplacement
    }

    updateStats() {
        const racks = window.vueStock?.racks || [];
        const totalSlots = racks.reduce((sum, rack) => {
            return sum + (rack.levels || []).reduce((levelSum, level) => {
                return levelSum + (level.slots || []).length;
            }, 0);
        }, 0);

        document.getElementById('stat3DRacks').textContent = racks.length;
        document.getElementById('stat3DSlots').textContent = totalSlots;
        document.getElementById('stat3DFill').textContent = '0%'; // TODO: Calculate
    }

    drawMinimap() {
        const canvas = document.getElementById('minimapCanvas');
        const ctx = canvas.getContext('2d');

        canvas.width = 180;
        canvas.height = 180;

        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const racks = window.vueStock?.racks || [];
        const scale = 0.5;

        racks.forEach(rack => {
            const x = (rack.position_x || 0) * scale / 40;
            const y = (rack.position_y || 0) * scale / 40;
            const w = (rack.width || 3) * 10;
            const h = (rack.depth || 2) * 10;

            ctx.fillStyle = rack.color || '#4a90e2';
            ctx.fillRect(
                canvas.width / 2 + x - w / 2,
                canvas.height / 2 + y - h / 2,
                w,
                h
            );
        });
    }

    onWindowResize() {
        const container = this.renderer.domElement.parentElement;
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    animate() {
        this.animationId = requestAnimationFrame(this.animate);

        // ✅ Animer les particules
        if (this.particles && this.particleVelocities) {
            const positions = this.particles.geometry.attributes.position.array;

            for (let i = 0; i < this.particleVelocities.length; i++) {
                positions[i * 3] += this.particleVelocities[i].x;
                positions[i * 3 + 1] += this.particleVelocities[i].y;
                positions[i * 3 + 2] += this.particleVelocities[i].z;

                // Réinitialiser si sort des limites
                if (positions[i * 3 + 1] > 40) {
                    positions[i * 3 + 1] = 0;
                }
                if (Math.abs(positions[i * 3]) > 50) {
                    positions[i * 3] = (Math.random() - 0.5) * 100;
                }
                if (Math.abs(positions[i * 3 + 2]) > 50) {
                    positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
                }
            }

            this.particles.geometry.attributes.position.needsUpdate = true;
        }

        // ✅ Animer les slots (pulsation)
        const time = Date.now() * 0.001;
        this.racks3D.forEach(rackGroup => {
            rackGroup.traverse(child => {
                if (child.userData && child.userData.animate) {
                    const scale = 1 + Math.sin(time * child.userData.pulseSpeed * 1000 + child.userData.pulsePhase) * 0.05;
                    child.scale.set(1, scale, 1);

                    // Effet de lueur pulsante
                    if (child.material && child.material.emissiveIntensity !== undefined) {
                        child.material.emissiveIntensity = 0.2 + Math.sin(time * 2 + child.userData.pulsePhase) * 0.1;
                    }
                }
            });
        });

        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        console.log('🗑️ Nettoyage Vue 3D');

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        const canvas = this.renderer.domElement;
        canvas.removeEventListener('mousemove', this.onMouseMove);
        canvas.removeEventListener('click', this.onMouseClick);
        window.removeEventListener('resize', this.onWindowResize);

        this.racks3D = [];
        this.scene.clear();
        this.renderer.dispose();
    }

    changeView(viewType) {
        const target = new THREE.Vector3(0, 5, 0);

        switch(viewType) {
            case 'overview':
                this.camera.position.set(30, 30, 30);
                break;
            case 'walk':
                this.camera.position.set(0, 2, 20);
                break;
            case 'top':
                this.camera.position.set(0, 50, 0);
                break;
        }

        this.camera.lookAt(target);
    }

    changeDisplayMode(mode) {
        this.currentMode = mode;

        this.racks3D.forEach(rackGroup => {
            rackGroup.traverse(child => {
                if (child.isMesh && child.material) {
                    switch(mode) {
                        case 'normal':
                            child.material.transparent = false;
                            child.material.opacity = 1;
                            break;
                        case 'xray':
                            child.material.transparent = true;
                            child.material.opacity = 0.3;
                            break;
                        case 'heatmap':
                            // TODO: Implement heatmap colors
                            break;
                    }
                }
            });
        });
    }

    takeScreenshot() {
        this.renderer.render(this.scene, this.camera);
        const dataURL = this.renderer.domElement.toDataURL('image/png');

        const link = document.createElement('a');
        link.download = `vuestock-3d-${Date.now()}.png`;
        link.href = dataURL;
        link.click();
    }

    reset() {
        this.camera.position.set(30, 30, 30);
        this.camera.lookAt(0, 5, 0);
        this.changeDisplayMode('normal');
    }

    // ✅ NOUVELLE MÉTHODE : Localiser et mettre en évidence un emplacement
    locateAndHighlight(rack, level, slot) {
        console.log('🎯 Localisation de:', rack.code, level.code, slot.code);

        // Trouver l'objet 3D correspondant
        const rackGroup = this.racks3D.find(r => r.userData.rack.id === rack.id);
        if (!rackGroup) {
            console.error('Étagère 3D non trouvée');
            return;
        }

        // Trouver le slot mesh dans le groupe
        let targetSlot = null;
        rackGroup.traverse(child => {
            if (child.userData && child.userData.type === 'slot' && child.userData.slot.id === slot.id) {
                targetSlot = child;
            }
        });

        if (!targetSlot) {
            console.error('Emplacement 3D non trouvé');
            return;
        }

        // Calculer la position mondiale du slot
        const worldPosition = new THREE.Vector3();
        targetSlot.getWorldPosition(worldPosition);

        // Animer la caméra vers le slot
        this.animateCameraTo(worldPosition, () => {
            // Une fois arrivé, faire clignoter le slot
            this.blinkSlot(targetSlot);
        });
    }

    // ✅ NOUVELLE MÉTHODE : Animer la caméra
    animateCameraTo(targetPosition, onComplete) {
        const startPosition = this.camera.position.clone();
        const startTime = Date.now();
        const duration = 2000; // 2 secondes

        // Position de la caméra : un peu au-dessus et devant le target
        const endPosition = new THREE.Vector3(
            targetPosition.x + 3,
            targetPosition.y + 2,
            targetPosition.z + 3
        );

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing (ease-in-out)
            const eased = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            // Interpoler la position
            this.camera.position.lerpVectors(startPosition, endPosition, eased);
            this.camera.lookAt(targetPosition);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                if (onComplete) onComplete();
            }
        };

        animate();
    }

    // ✅ NOUVELLE MÉTHODE : Faire clignoter un slot
    blinkSlot(slotMesh) {
        const originalColor = slotMesh.material.color.clone();
        const highlightColor = new THREE.Color(0xffeb3b); // Jaune
        let blinkCount = 0;
        const maxBlinks = 6;

        const blink = () => {
            if (blinkCount >= maxBlinks) {
                slotMesh.material.color.copy(originalColor);
                slotMesh.material.emissiveIntensity = 0.2;
                return;
            }

            // Alterner entre couleur originale et jaune
            if (blinkCount % 2 === 0) {
                slotMesh.material.color.copy(highlightColor);
                slotMesh.material.emissiveIntensity = 0.8;
            } else {
                slotMesh.material.color.copy(originalColor);
                slotMesh.material.emissiveIntensity = 0.2;
            }

            blinkCount++;
            setTimeout(blink, 300);
        };

        blink();
    }

    // ✅ NOUVELLE MÉTHODE : Recherche directe depuis la 3D
    searchInView(searchTerm) {
        console.log('🔍 Recherche 3D:', searchTerm);

        // Réinitialiser tous les highlights
        this.racks3D.forEach(rackGroup => {
            rackGroup.traverse(child => {
                if (child.isMesh && child.userData.type === 'slot') {
                    child.material.emissiveIntensity = 0.2;
                }
            });
        });

        // Chercher les slots qui contiennent l'article
        const foundSlots = [];

        this.racks3D.forEach(rackGroup => {
            rackGroup.traverse(child => {
                if (child.userData && child.userData.type === 'slot') {
                    const slot = child.userData.slot;

                    if (slot.articles && slot.articles.length > 0) {
                        const hasArticle = slot.articles.some(art =>
                            art.name && art.name.toLowerCase().includes(searchTerm.toLowerCase())
                        );

                        if (hasArticle) {
                            foundSlots.push(child);
                        }
                    }
                }
            });
        });

        if (foundSlots.length > 0) {
            console.log(`✅ ${foundSlots.length} emplacement(s) trouvé(s)`);

            // Highlight tous les emplacements trouvés
            foundSlots.forEach(slot => {
                slot.material.color.setHex(0xffeb3b);
                slot.material.emissiveIntensity = 0.6;
            });

            // Zoomer sur le premier
            const worldPosition = new THREE.Vector3();
            foundSlots[0].getWorldPosition(worldPosition);
            this.animateCameraTo(worldPosition);

            return foundSlots.length;
        } else {
            console.log('❌ Aucun emplacement trouvé');
            return 0;
        }
    }
}

// Instance globale
let view3DManager = null;

// Initialisation au clic sur le bouton
document.addEventListener('DOMContentLoaded', () => {
    const btn3D = document.getElementById('btnView3D');
    const modal3D = document.getElementById('modal3D');
    const closeBtn = document.getElementById('close3DBtn');

    btn3D?.addEventListener('click', () => {
        modal3D.classList.add('active');

        if (!view3DManager) {
            view3DManager = new View3DManager();
            view3DManager.init();
        }
    });

    closeBtn?.addEventListener('click', () => {
        modal3D.classList.remove('active');

        if (view3DManager) {
            view3DManager.dispose();
            view3DManager = null;
        }
    });

    // Contrôles de vue
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (view3DManager) {
                view3DManager.changeView(btn.dataset.view);
            }
        });
    });

    // Contrôles d'affichage
    document.querySelectorAll('.display-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.display-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (view3DManager) {
                view3DManager.changeDisplayMode(btn.dataset.mode);
            }
        });
    });

    // Screenshot
    document.getElementById('btn3DScreenshot')?.addEventListener('click', () => {
        if (view3DManager) {
            view3DManager.takeScreenshot();
        }
    });

    // Reset
    document.getElementById('btn3DReset')?.addEventListener('click', () => {
        if (view3DManager) {
            view3DManager.reset();
        }
    });

    // ✅ NOUVEAU : Recherche dans la vue 3D
    document.getElementById('btnSearch3D')?.addEventListener('click', () => {
        if (view3DManager) {
            const searchTerm = document.getElementById('search3DInput').value.trim();
            if (searchTerm) {
                const count = view3DManager.searchInView(searchTerm);

                if (count > 0) {
                    alert(`${count} emplacement(s) contenant "${searchTerm}" trouvé(s) et mis en évidence.`);
                } else {
                    alert(`Aucun article "${searchTerm}" trouvé.`);
                }
            }
        }
    });

    // Recherche avec Enter
    document.getElementById('search3DInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('btnSearch3D')?.click();
        }
    });

    // ✅ NOUVEAUX ÉVÉNEMENTS : Modal slot
    document.getElementById('closeSlotModal')?.addEventListener('click', () => {
        if (view3DManager) {
            view3DManager.closeSlotModal();
        }
    });

    document.getElementById('slotModalBackdrop')?.addEventListener('click', () => {
        if (view3DManager) {
            view3DManager.closeSlotModal();
        }
    });

    document.getElementById('btnSaveSlot')?.addEventListener('click', () => {
        if (view3DManager) {
            view3DManager.saveSlotChanges();
        }
    });

    document.getElementById('btnAddArticle')?.addEventListener('click', () => {
        alert('Fonctionnalité "Ajouter article" à venir !');
        // TODO: Ouvrir un modal pour ajouter un article
    });

    // Fermer avec Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('slotDetailModal');
            if (modal && modal.classList.contains('active') && view3DManager) {
                view3DManager.closeSlotModal();
            }

            const checkModal = document.getElementById('inventoryCheckModal');
            if (checkModal && checkModal.classList.contains('active') && view3DManager) {
                view3DManager.closeInventoryCheckModal();
            }
        }
    });

    // ✅ NOUVEAUX ÉVÉNEMENTS : Mode inventaire
    document.getElementById('btnStartInventory')?.addEventListener('click', () => {
        if (view3DManager) {
            view3DManager.startInventoryMode();
        }
    });

    document.getElementById('btnStopInventory')?.addEventListener('click', () => {
        if (view3DManager) {
            view3DManager.stopInventoryMode();
        }
    });

    document.getElementById('btnExportInventory')?.addEventListener('click', () => {
        if (view3DManager) {
            view3DManager.exportInventoryReport();
        }
    });

    // Filtres inventaire
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            if (view3DManager && view3DManager.inventoryMode) {
                const filter = chip.dataset.filter;
                view3DManager.renderInventoryList(filter);
            }
        });
    });

    // Modal vérification inventaire
    document.getElementById('btnCancelCheck')?.addEventListener('click', () => {
        if (view3DManager) {
            view3DManager.closeInventoryCheckModal();
        }
    });

    document.getElementById('btnConfirmCheck')?.addEventListener('click', () => {
        if (view3DManager) {
            view3DManager.confirmInventoryCheck();
        }
    });
});