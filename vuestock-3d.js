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
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Lights
        this.addLights();

        // Grid
        this.addGrid();

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
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Directional light (sun)
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(50, 50, 50);
        dirLight.castShadow = true;
        dirLight.shadow.camera.left = -50;
        dirLight.shadow.camera.right = 50;
        dirLight.shadow.camera.top = 50;
        dirLight.shadow.camera.bottom = -50;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);

        // Hemisphere light
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
        this.scene.add(hemiLight);
    }

    addGrid() {
        // Floor
        const floorGeometry = new THREE.PlaneGeometry(200, 200);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a3e,
            roughness: 0.8,
            metalness: 0.2
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Grid helper
        const gridHelper = new THREE.GridHelper(200, 50, 0x4a4a6e, 0x2a2a3e);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);
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

        // Structure principale
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const color = new THREE.Color(rack.color || '#4a90e2');
        const material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.7,
            metalness: 0.3
        });
        const mesh = new THREE.Mesh(geometry, material);
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

        const geometry = new THREE.BoxGeometry(slotWidth * 0.8, 0.1, rackDepth * 0.8);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.2
        });
        const mesh = new THREE.Mesh(geometry, material);
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

        // Reset previous highlight
        if (this.hoveredObject) {
            if (this.hoveredObject.material) {
                this.hoveredObject.material.emissiveIntensity = 0.2;
            }
        }

        const tooltip = document.getElementById('tooltip3D');

        if (intersects.length > 0) {
            const object = intersects[0].object;

            if (object.userData && (object.userData.type === 'slot' || object.userData.type === 'rack')) {
                this.hoveredObject = object;

                if (object.material) {
                    object.material.emissiveIntensity = 0.5;
                }

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
                // TODO: Ouvrir un modal détaillé
            }
        }
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
});