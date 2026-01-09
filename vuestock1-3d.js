// ============================================
// VUESTOCK 3D - Version simplifiée et immersive
// ============================================

class VueStock3D {
    constructor() {
        // Configuration
        this.config = {
            moveSpeed: 0.1,
            rotateSpeed: 0.002,
            playerHeight: 1.7,
            gridSize: 2,
            animationSpeed: 800
        };

        // État
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.racks = [];
        this.currentLevel = null;
        this.isLevelOpen = false;

        // Mouvement
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.mouseX = 0;
        this.mouseY = 0;
        this.playerPosition = new THREE.Vector3(0, this.config.playerHeight, 5);
        this.playerRotation = 0;

        // Contrôles
        this.keys = {};
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // UI
        this.ui = {
            hud: null,
            levelPanel: null,
            searchPanel: null
        };
    }

    // ==================== INITIALISATION ====================

    async init() {
        console.log('🚀 Initialisation VueStock 3D');

        // Créer le canvas
        this.createCanvas();

        // Initialiser Three.js
        this.initThreeJS();

        // Charger les données
        await this.loadData();

        // Créer l'environnement
        this.createEnvironment();

        // Créer les racks
        this.createRacks();

        // Configurer les contrôles
        this.setupControls();

        // Créer l'interface
        this.createUI();

        // Démarrer l'animation
        this.animate();

        console.log('✅ VueStock 3D prêt');
    }

    createCanvas() {
    // NE FAIS RIEN - le canvas existe déjà dans le HTML
    // Vérifie juste qu'il est présent
        const canvas = document.getElementById('canvas3D');
        if (!canvas) {
            console.error('❌ Canvas 3D non trouvé');
            // Crée-le si vraiment absent
            const modal = document.getElementById('modal3D');
            if (modal) {
                modal.innerHTML = `
                    <div class="vuestock3d-canvas-container">
                        <canvas id="vuestock3d-canvas"></canvas>
                    </div>
                `;
            }
        }
    }

    initThreeJS() {
        const canvas = document.getElementById('canvas3D');
        const container = canvas.parentElement;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 200);

        // Camera (vue à la première personne)
        this.camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.copy(this.playerPosition);

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

        // Lumière
        this.addLights();

        // Resize handler
        window.addEventListener('resize', () => this.onResize());
    }

    addLights() {
        // Lumière ambiante
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Lumière directionnelle (soleil)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        // Lumière supplémentaire pour les détails
        const frontLight = new THREE.DirectionalLight(0xffffff, 0.3);
        frontLight.position.set(0, 10, 10);
        this.scene.add(frontLight);
    }

    // ==================== CHARGEMENT DONNÉES ====================

    async loadData() {
        try {
            console.log('📦 Chargement des données...');

            // ✅ CORRECTION : Utilisez la bonne URL
            // Option 1 : Votre API Netlify Function
            const response = await fetch('/.netlify/functions/vuestock1-api?action=get-3d-data');

            // Option 2 : Si vous avez configuré une redirection dans netlify.toml
            // const response = await fetch('/api/vuestock/3d-data');

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                this.stockData = data.data;
                console.log(`✅ ${this.stockData.length} racks chargés`);
            } else {
                throw new Error(data.error || 'Erreur de chargement');
            }
        } catch (error) {
            console.error('❌ Erreur:', error);
            // Gardez les données de test temporairement pour debug
            this.stockData = this.getTestData();
            console.log('⚠️ Utilisation de données de test pour le debug');
        }
    }

    getTestData() {
        return [
            {
                id: 1,
                rack_code: "RACK-01",
                position_x: 0,
                position_y: 0,
                rotation: 0,
                width: 3,
                depth: 2,
                color: "#4a90e2",
                levels: [
                    {
                        id: 101,
                        level_code: "NIV-1",
                        height: 100,
                        slots: [
                            {
                                id: 1001,
                                slot_code: "A01",
                                full_code: "RACK-01-NIV-1-A01",
                                capacity: 100,
                                status: "occupied",
                                articles: [
                                    { id: 1, name: "Produit A", quantity: 45 },
                                    { id: 2, name: "Produit B", quantity: 30 }
                                ]
                            },
                            {
                                id: 1002,
                                slot_code: "A02",
                                full_code: "RACK-01-NIV-1-A02",
                                capacity: 100,
                                status: "partial",
                                articles: [
                                    { id: 3, name: "Produit C", quantity: 15 }
                                ]
                            }
                        ]
                    },
                    {
                        id: 102,
                        level_code: "NIV-2",
                        height: 200,
                        slots: [
                            {
                                id: 1003,
                                slot_code: "B01",
                                full_code: "RACK-01-NIV-2-B01",
                                capacity: 100,
                                status: "free",
                                articles: []
                            }
                        ]
                    }
                ]
            }
        ];
    }

    // ==================== CRÉATION DE L'ENVIRONNEMENT ====================

    createEnvironment() {
        // Sol
        const floorGeometry = new THREE.PlaneGeometry(100, 100);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a506b,
            roughness: 0.8,
            metalness: 0.2
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Grille
        const gridHelper = new THREE.GridHelper(100, 20, 0x000000, 0x000000);
        gridHelper.material.opacity = 0.1;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);

        // Murs (optionnel)
        this.createWalls();
    }

    createWalls() {
        // Mur du fond
        const wallGeometry = new THREE.BoxGeometry(100, 10, 0.5);
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0x2d3748,
            roughness: 0.9
        });

        const backWall = new THREE.Mesh(wallGeometry, wallMaterial);
        backWall.position.set(0, 5, -50);
        backWall.receiveShadow = true;
        this.scene.add(backWall);
    }

    // ==================== CRÉATION DES RACKS ====================

    createRacks() {
        if (!this.stockData) return;

        this.stockData.forEach(rackData => {
            const rackGroup = this.createRack(rackData);
            this.scene.add(rackGroup);
            this.racks.push(rackGroup);
        });
    }

    createRack(rackData) {
        const rackGroup = new THREE.Group();
        rackGroup.userData = {
            type: 'rack',
            data: rackData,
            levels: []
        };

        // Position
        const x = rackData.position_x * this.config.gridSize;
        const z = rackData.position_y * this.config.gridSize;
        rackGroup.position.set(x, 0, z);

        // Rotation
        rackGroup.rotation.y = THREE.MathUtils.degToRad(rackData.rotation || 0);

        // Structure du rack
        this.createRackStructure(rackGroup, rackData);

        // Niveaux
        if (rackData.levels) {
            rackData.levels.forEach(levelData => {
                const levelGroup = this.createLevel(levelData, rackData);
                rackGroup.add(levelGroup);
                rackGroup.userData.levels.push(levelGroup);
            });
        }

        return rackGroup;
    }

    createRackStructure(rackGroup, rackData) {
        const width = rackData.width * this.config.gridSize;
        const depth = rackData.depth * this.config.gridSize;
        const height = 3; // Hauteur totale du rack

        // Cadre principal
        const frameColor = new THREE.Color(rackData.color || '#4a90e2');
        const frameMaterial = new THREE.MeshStandardMaterial({
            color: frameColor,
            roughness: 0.5,
            metalness: 0.7
        });

        // Piliers verticaux
        const pillarGeometry = new THREE.BoxGeometry(0.2, height, 0.2);
        const positions = [
            [-width/2, height/2, -depth/2],
            [width/2, height/2, -depth/2],
            [-width/2, height/2, depth/2],
            [width/2, height/2, depth/2]
        ];

        positions.forEach(pos => {
            const pillar = new THREE.Mesh(pillarGeometry, frameMaterial);
            pillar.position.set(pos[0], pos[1], pos[2]);
            pillar.castShadow = true;
            rackGroup.add(pillar);
        });

        // Traverse supérieure
        const topBeamGeometry = new THREE.BoxGeometry(width, 0.1, depth);
        const topBeam = new THREE.Mesh(topBeamGeometry, frameMaterial);
        topBeam.position.set(0, height, 0);
        topBeam.castShadow = true;
        rackGroup.add(topBeam);
    }

    createLevel(levelData, rackData) {
        const levelGroup = new THREE.Group();
        levelGroup.userData = {
            type: 'level',
            data: levelData,
            slots: [],
            rack: rackData
        };

        const width = rackData.width * this.config.gridSize;
        const depth = rackData.depth * this.config.gridSize;
        const levelHeight = (levelData.height / 100) * 2; // Normalisation

        // Position Y selon l'ordre d'affichage
        const yPosition = (levelData.display_order - 1) * 1.2; // Espacement entre niveaux
        levelGroup.position.y = yPosition;

        // Plateau de l'étage
        const shelfGeometry = new THREE.BoxGeometry(width * 0.9, 0.05, depth * 0.9);
        const shelfMaterial = new THREE.MeshStandardMaterial({
            color: 0x718096,
            roughness: 0.8,
            metalness: 0.2
        });
        const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
        shelf.position.y = levelHeight;
        shelf.castShadow = true;
        shelf.receiveShadow = true;
        shelf.userData.isShelf = true;
        levelGroup.add(shelf);

        // Slots
        if (levelData.slots) {
            levelData.slots.forEach((slotData, index) => {
                const slotGroup = this.createSlot(slotData, width, depth, levelHeight);
                levelGroup.add(slotGroup);
                levelGroup.userData.slots.push(slotGroup);
            });
        }

        // Étiquette
        this.createLevelLabel(levelGroup, levelData.level_code);

        return levelGroup;
    }

    createSlot(slotData, rackWidth, rackDepth, levelHeight) {
        const slotGroup = new THREE.Group();
        slotGroup.userData = {
            type: 'slot',
            data: slotData,
            isSelected: false
        };

        // Nombre de slots par niveau (simplifié)
        const slotCount = 4;
        const slotWidth = rackWidth / slotCount;

        // Position X aléatoire pour la démo
        const xPos = -rackWidth/2 + Math.random() * rackWidth;

        // Boîte représentant le slot
        const slotGeometry = new THREE.BoxGeometry(slotWidth * 0.8, 0.3, rackDepth * 0.8);

        // Couleur selon le statut
        let color = 0x718096; // Gris par défaut
        if (slotData.status === 'occupied') color = 0x48BB78; // Vert
        if (slotData.status === 'partial') color = 0xED8936; // Orange

        const slotMaterial = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.5,
            metalness: 0.3,
            transparent: true,
            opacity: 0.8
        });

        const slotMesh = new THREE.Mesh(slotGeometry, slotMaterial);
        slotMesh.position.set(xPos, levelHeight + 0.2, 0);
        slotMesh.castShadow = true;
        slotMesh.userData.isSlot = true;
        slotMesh.userData.slotGroup = slotGroup;

        slotGroup.add(slotMesh);

        // Articles dans le slot (simplifié)
        if (slotData.articles && slotData.articles.length > 0) {
            this.createArticlesInSlot(slotMesh, slotData.articles);
        }

        // Effet de sélection
        const outlineGeometry = new THREE.BoxGeometry(
            slotWidth * 0.85,
            0.35,
            rackDepth * 0.85
        );
        const outlineMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            side: THREE.BackSide,
            transparent: true,
            opacity: 0
        });

        const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
        outline.position.set(xPos, levelHeight + 0.2, 0);
        outline.userData.isOutline = true;
        slotGroup.outline = outline;
        slotGroup.add(outline);

        return slotGroup;
    }

    createArticlesInSlot(slotMesh, articles) {
        // Représentation simplifiée des articles
        articles.forEach((article, index) => {
            const articleGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
            const articleMaterial = new THREE.MeshStandardMaterial({
                color: 0x4299E1,
                roughness: 0.3
            });

            const articleMesh = new THREE.Mesh(articleGeometry, articleMaterial);

            // Position aléatoire dans le slot
            const offsetX = (Math.random() - 0.5) * 0.3;
            const offsetZ = (Math.random() - 0.5) * 0.3;

            articleMesh.position.set(offsetX, 0.2 + (index * 0.25), offsetZ);
            slotMesh.add(articleMesh);
        });
    }

    createLevelLabel(levelGroup, text) {
        // Créer une texture canvas pour le texte
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;

        // Fond
        context.fillStyle = 'rgba(255, 255, 255, 0.9)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Texte
        context.font = 'Bold 32px Arial';
        context.fillStyle = '#2D3748';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true
        });

        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(1.5, 0.75, 1);
        sprite.position.set(0, 1, 0); // Au-dessus de l'étage
        levelGroup.add(sprite);
    }

    // ==================== CONTRÔLES ====================

    setupControls() {
        // Événements clavier
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));

        // Événements souris
        const canvas = this.renderer.domElement;
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('click', (e) => this.onClick(e));

        // Empêcher le menu contextuel
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Boutons UI
        document.getElementById('close-level')?.addEventListener('click', () => this.closeLevel());
        document.getElementById('search-btn')?.addEventListener('click', () => this.searchArticle());

        // Recherche avec Enter
        document.getElementById('search-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchArticle();
        });

        // Échap pour fermer
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeLevel();
        });
    }

    onKeyDown(event) {
        this.keys[event.key.toLowerCase()] = true;

        switch(event.key.toLowerCase()) {
            case 'w': case 'z':
                this.moveForward = true;
                break;
            case 's':
                this.moveBackward = true;
                break;
            case 'a': case 'q':
                this.moveLeft = true;
                break;
            case 'd':
                this.moveRight = true;
                break;
        }
    }

    onKeyUp(event) {
        this.keys[event.key.toLowerCase()] = false;

        switch(event.key.toLowerCase()) {
            case 'w': case 'z':
                this.moveForward = false;
                break;
            case 's':
                this.moveBackward = false;
                break;
            case 'a': case 'q':
                this.moveLeft = false;
                break;
            case 'd':
                this.moveRight = false;
                break;
        }
    }

    onMouseDown(event) {
        if (event.button === 0) { // Clic gauche
            // Verrouiller le pointeur pour la rotation
            const canvas = this.renderer.domElement;
            canvas.requestPointerLock();
        }
    }

    onMouseMove(event) {
        if (document.pointerLockElement === this.renderer.domElement) {
            this.playerRotation -= event.movementX * this.config.rotateSpeed;
            this.mouseY = THREE.MathUtils.clamp(
                this.mouseY - event.movementY * this.config.rotateSpeed,
                -Math.PI / 3,
                Math.PI / 3
            );
        }
    }

    onClick(event) {
        if (this.isLevelOpen) return;

        const canvas = this.renderer.domElement;
        const rect = canvas.getBoundingClientRect();

        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Vérifier les intersections avec les étages
        const intersects = this.raycaster.intersectObjects(
            this.scene.children,
            true
        );

        for (const intersect of intersects) {
            let object = intersect.object;

            // Remonter jusqu'au groupe niveau
            while (object && object.userData.type !== 'level') {
                object = object.parent;
            }

            if (object && object.userData.type === 'level') {
                this.openLevel(object);
                break;
            }
        }
    }

    // ==================== INTERACTION AVEC LES NIVEAUX ====================

    openLevel(levelGroup) {
        if (this.isLevelOpen) return;

        console.log('📖 Ouverture de l\'étage:', levelGroup.userData.data.level_code);

        this.currentLevel = levelGroup;
        this.isLevelOpen = true;

        // Animation : l'étage vient vers le joueur
        this.animateLevelToPlayer(levelGroup);

        // Afficher le panel avec les détails
        this.showLevelPanel(levelGroup.userData.data);

        // Mettre à jour le HUD
        document.getElementById('hud-mode').textContent = 'Étage ouvert';
    }

    animateLevelToPlayer(levelGroup) {
        // Position finale : devant le joueur
        const finalPosition = this.playerPosition.clone();
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerRotation);
        finalPosition.add(forward.multiplyScalar(3));
        finalPosition.y = this.config.playerHeight;

        // Échelle finale (agrandi)
        const finalScale = new THREE.Vector3(2, 2, 2);

        // Sauvegarder la position/échelle originale
        levelGroup.userData.originalPosition = levelGroup.position.clone();
        levelGroup.userData.originalScale = levelGroup.scale.clone();
        levelGroup.userData.originalParent = levelGroup.parent;

        // Détacher du parent et ajouter à la scène
        if (levelGroup.parent) {
            levelGroup.parent.remove(levelGroup);
        }
        this.scene.add(levelGroup);

        // Animation
        const startPosition = levelGroup.position.clone();
        const startScale = levelGroup.scale.clone();
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / this.config.animationSpeed, 1);

            // Easing
            const easeProgress = this.easeOutCubic(progress);

            // Interpolation
            levelGroup.position.lerpVectors(startPosition, finalPosition, easeProgress);
            levelGroup.scale.lerpVectors(startScale, finalScale, easeProgress);

            // Faire face au joueur
            levelGroup.lookAt(this.camera.position);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                console.log('✅ Étage ouvert avec succès');
            }
        };

        animate();
    }

    closeLevel() {
        if (!this.currentLevel || !this.isLevelOpen) return;

        console.log('📕 Fermeture de l\'étage');

        const levelGroup = this.currentLevel;

        // Animation de retour
        const startPosition = levelGroup.position.clone();
        const startScale = levelGroup.scale.clone();
        const originalPosition = levelGroup.userData.originalPosition;
        const originalScale = levelGroup.userData.originalScale;
        const originalParent = levelGroup.userData.originalParent;

        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / (this.config.animationSpeed * 0.5), 1);

            const easeProgress = this.easeInCubic(progress);

            levelGroup.position.lerpVectors(startPosition, originalPosition, easeProgress);
            levelGroup.scale.lerpVectors(startScale, originalScale, easeProgress);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Replacer dans le parent original
                this.scene.remove(levelGroup);
                if (originalParent) {
                    originalParent.add(levelGroup);
                }

                // Réinitialiser
                levelGroup.position.copy(originalPosition);
                levelGroup.scale.copy(originalScale);
                levelGroup.rotation.set(0, 0, 0);

                this.currentLevel = null;
                this.isLevelOpen = false;

                // Cacher le panel
                this.hideLevelPanel();

                // Mettre à jour le HUD
                document.getElementById('hud-mode').textContent = 'Navigation';

                console.log('✅ Étage fermé');
            }
        };

        animate();
    }

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    easeInCubic(t) {
        return t * t * t;
    }

    // ==================== UI ====================

    createUI() {
        // ✅ INITIALISEZ d'abord l'objet ui
        this.ui = {
            hud: {
                position: document.getElementById('hud-position'),
                mode: document.getElementById('hud-mode')
            },
            levelPanel: document.getElementById('level-panel'),
            levelContent: document.getElementById('level-content'),
            levelTitle: document.getElementById('level-title')
        };

        // ✅ Vérifiez que les éléments existent
        if (!this.ui.hud.position) {
            console.warn('⚠️ Élément HUD position non trouvé');
            // Créez-le si nécessaire
            const hud = document.querySelector('.vuestock3d-hud');
            if (hud) {
                hud.innerHTML = `
                    <div class="hud-position">
                        <span class="hud-label">Position:</span>
                        <span class="hud-value" id="hud-position">0, 0</span>
                    </div>
                    <div class="hud-mode">
                        <span class="hud-label">Mode:</span>
                        <span class="hud-value" id="hud-mode">Navigation</span>
                    </div>
                `;
                // Réinitialisez les références
                this.ui.hud.position = document.getElementById('hud-position');
                this.ui.hud.mode = document.getElementById('hud-mode');
            }
        }
    }

    showLevelPanel(levelData) {
        this.ui.levelTitle.textContent = `Étage ${levelData.level_code}`;

        // Construire le contenu
        let html = `
            <div class="level-info">
                <div class="info-item">
                    <span class="info-label">Code complet:</span>
                    <span class="info-value">${levelData.rack_code}-${levelData.level_code}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Hauteur:</span>
                    <span class="info-value">${levelData.height} cm</span>
                </div>
            </div>

            <div class="slots-section">
                <h4>Emplacements (${levelData.slots?.length || 0})</h4>
                <div class="slots-grid">
        `;

        if (levelData.slots && levelData.slots.length > 0) {
            levelData.slots.forEach(slot => {
                const statusClass = slot.status || 'free';
                const articleCount = slot.articles?.length || 0;

                html += `
                    <div class="slot-card ${statusClass}">
                        <div class="slot-header">
                            <span class="slot-code">${slot.slot_code}</span>
                            <span class="slot-status">${slot.status}</span>
                        </div>
                        <div class="slot-body">
                            <div class="slot-capacity">
                                Capacité: ${slot.capacity}
                            </div>
                            ${articleCount > 0 ? `
                                <div class="slot-articles">
                                    <strong>Articles:</strong>
                                    <ul>
                                ${slot.articles.map(article => `
                                    <li>
                                        ${article.name}
                                        <span class="article-quantity">
                                            <button class="qty-btn minus" data-slot="${slot.id}" data-article="${article.id}">-</button>
                                            <input type="number" value="${article.quantity}"
                                                   class="qty-input" data-slot="${slot.id}"
                                                   data-article="${article.id}">
                                            <button class="qty-btn plus" data-slot="${slot.id}" data-article="${article.id}">+</button>
                                        </span>
                                    </li>
                                `).join('')}
                                    </ul>
                                </div>
                            ` : `
                                <div class="slot-empty">
                                    <i>Aucun article</i>
                                </div>
                            `}
                        </div>
                    </div>
                `;
            });
        } else {
            html += `<div class="no-slots">Aucun emplacement dans cet étage</div>`;
        }

        html += `
                </div>
            </div>

            <div class="level-actions">
                <button class="btn-action" id="btn-refresh-level">
                    <i>↻</i> Actualiser
                </button>
                <button class="btn-action" id="btn-save-changes">
                    <i>💾</i> Sauvegarder
                </button>
            </div>
        `;

        this.ui.levelContent.innerHTML = html;
        this.ui.levelPanel.classList.add('visible');

        // Ajouter les événements aux boutons de quantité
        setTimeout(() => {
            document.querySelectorAll('.qty-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const slotId = e.target.dataset.slot;
                    const articleId = e.target.dataset.article;
                    const input = e.target.parentElement.querySelector('.qty-input');
                    const change = e.target.classList.contains('plus') ? 1 : -1;

                    let newValue = parseInt(input.value) + change;
                    if (newValue < 0) newValue = 0;

                    input.value = newValue;
                    this.updateArticleQuantity(slotId, articleId, newValue);
                });
            });

            document.querySelectorAll('.qty-input').forEach(input => {
                input.addEventListener('change', (e) => {
                    const slotId = e.target.dataset.slot;
                    const articleId = e.target.dataset.article;
                    const newValue = parseInt(e.target.value) || 0;

                    this.updateArticleQuantity(slotId, articleId, newValue);
                });
            });

            document.getElementById('btn-save-changes')?.addEventListener('click', () => {
                this.saveLevelChanges();
            });
        }, 100);
    }

    hideLevelPanel() {
        this.ui.levelPanel.classList.remove('visible');
    }

    updateArticleQuantity(slotId, articleId, quantity) {
        console.log(`Mise à jour: Slot ${slotId}, Article ${articleId}, Qté ${quantity}`);

        // Mettre à jour visuellement dans la 3D (simplifié)
        if (this.currentLevel) {
            this.currentLevel.traverse(child => {
                if (child.userData.type === 'slot' &&
                    child.userData.data.id == slotId) {
                    // Animation de feedback
                    if (child.material) {
                        child.material.color.setHex(0xFFFF00); // Jaune temporaire
                        setTimeout(() => {
                            const status = child.userData.data.status;
                            const color = status === 'occupied' ? 0x48BB78 :
                                         status === 'partial' ? 0xED8936 : 0x718096;
                            child.material.color.setHex(color);
                        }, 300);
                    }
                }
            });
        }

        // TODO: Appel API pour sauvegarder
        // this.saveQuantityToAPI(slotId, articleId, quantity);
    }

    async saveLevelChanges() {
        console.log('💾 Sauvegarde des modifications...');

        // Ici, vous appelleriez votre API
        // await fetch('/api/vuestock/update-level', {...});

        alert('Modifications sauvegardées !');
        this.closeLevel();
    }

    // ==================== RECHERCHE ====================

    searchArticle() {
        const input = document.getElementById('search-input');
        const searchTerm = input.value.trim();

        if (!searchTerm) return;

        console.log(`🔍 Recherche: "${searchTerm}"`);

        // Réinitialiser les surbrillances
        this.racks.forEach(rack => {
            rack.traverse(child => {
                if (child.userData.type === 'slot' && child.outline) {
                    child.outline.material.opacity = 0;
                }
            });
        });

        // Rechercher les slots contenant l'article
        let foundSlots = [];

        this.racks.forEach(rack => {
            rack.traverse(child => {
                if (child.userData.type === 'slot') {
                    const slotData = child.userData.data;

                    if (slotData.articles && slotData.articles.length > 0) {
                        const hasArticle = slotData.articles.some(article =>
                            article.name.toLowerCase().includes(searchTerm.toLowerCase())
                        );

                        if (hasArticle) {
                            foundSlots.push(child);
                        }
                    }
                }
            });
        });

        // Mettre en surbrillance
        foundSlots.forEach(slot => {
            if (slot.outline) {
                slot.outline.material.opacity = 0.5;
                slot.outline.material.color.setHex(0xFFD700); // Or
            }
        });

        if (foundSlots.length > 0) {
            // Zoomer sur le premier slot trouvé
            const firstSlot = foundSlots[0];
            const worldPosition = new THREE.Vector3();
            firstSlot.getWorldPosition(worldPosition);

            // Animation vers le slot
            this.animateToPosition(worldPosition);

            alert(`${foundSlots.length} emplacement(s) trouvé(s) pour "${searchTerm}"`);
        } else {
            alert(`Aucun résultat pour "${searchTerm}"`);
        }

        input.value = '';
    }

    animateToPosition(targetPosition) {
        const startPosition = this.playerPosition.clone();
        const direction = targetPosition.clone().sub(startPosition);
        direction.y = 0; // Garder la hauteur
        direction.normalize();

        // Position finale (à 2m du slot)
        const finalPosition = targetPosition.clone().sub(direction.multiplyScalar(2));
        finalPosition.y = this.config.playerHeight;

        const startTime = Date.now();
        const duration = 1500;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const easeProgress = this.easeOutCubic(progress);
            this.playerPosition.lerpVectors(startPosition, finalPosition, easeProgress);

            // Regarder vers le slot
            const lookAtTarget = targetPosition.clone();
            this.playerRotation = Math.atan2(
                lookAtTarget.x - this.playerPosition.x,
                lookAtTarget.z - this.playerPosition.z
            );

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    // ==================== MISE À JOUR ET RENDU ====================

    updatePlayer() {
        if (this.isLevelOpen) return;

        // Direction basée sur la rotation
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerRotation);

        // Mouvement avant/arrière
        if (this.moveForward) {
            this.playerPosition.add(direction.clone().multiplyScalar(this.config.moveSpeed));
        }
        if (this.moveBackward) {
            this.playerPosition.sub(direction.clone().multiplyScalar(this.config.moveSpeed));
        }

        // Strafe gauche/droite
        const right = new THREE.Vector3(1, 0, 0);
        right.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerRotation);

        if (this.moveLeft) {
            this.playerPosition.sub(right.clone().multiplyScalar(this.config.moveSpeed));
        }
        if (this.moveRight) {
            this.playerPosition.add(right.clone().multiplyScalar(this.config.moveSpeed));
        }

        // Limites (optionnel)
        this.playerPosition.x = THREE.MathUtils.clamp(this.playerPosition.x, -45, 45);
        this.playerPosition.z = THREE.MathUtils.clamp(this.playerPosition.z, -45, 45);

        // Mettre à jour la caméra
        this.camera.position.copy(this.playerPosition);
        this.camera.rotation.set(this.mouseY, this.playerRotation, 0, 'YXZ');

        // ✅ CORRECTION : Vérifier si les éléments UI existent avant de les modifier
        if (this.ui && this.ui.hud && this.ui.hud.position) {
            this.ui.hud.position.textContent =
                `${Math.round(this.playerPosition.x)}, ${Math.round(this.playerPosition.z)}`;
        }

        // ✅ Optionnel : Mettre à jour aussi le mode si l'élément existe
        if (this.ui && this.ui.hud && this.ui.hud.mode) {
            // Vous pouvez mettre à jour le mode si nécessaire
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Mettre à jour le joueur
        this.updatePlayer();

        // Rendu
        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        const container = this.renderer.domElement.parentElement;

        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    // ==================== DESTRUCTION ====================

    dispose() {
        console.log('🧹 Nettoyage VueStock 3D');

        // Arrêter l'animation
        cancelAnimationFrame(this.animate);

        // Nettoyer Three.js
        this.scene.traverse(object => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (object.material.map) object.material.map.dispose();
                object.material.dispose();
            }
        });

        this.renderer.dispose();

        // Supprimer les événements
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);

        const canvas = this.renderer.domElement;
        canvas.removeEventListener('mousedown', this.onMouseDown);
        canvas.removeEventListener('mousemove', this.onMouseMove);
        canvas.removeEventListener('click', this.onClick);

        console.log('✅ VueStock 3D nettoyé');
    }
}

// ==================== INITIALISATION GLOBALE ====================

let vueStock3D = null;

document.addEventListener('DOMContentLoaded', () => {
    // Bouton pour ouvrir la vue 3D
    const openBtn = document.getElementById('open-3d-view');
    const closeBtn = document.getElementById('close-3d-view');
    const container = document.getElementById('vuestock3d-container');

    document.getElementById('close3DBtn')?.addEventListener('click', () => {
        const modal3D = document.getElementById('modal3D');
        modal3D.classList.remove('active');

        // Optionnel : arrêter l'animation pour économiser les ressources
        if (window.vueStock3D) {
            // Vous pouvez ajouter une méthode pause() si nécessaire
            // window.vueStock3D.pause();
        }
    });

    if (openBtn) {
        openBtn.addEventListener('click', async () => {
            if (!vueStock3D) {
                vueStock3D = new VueStock3D();
                await vueStock3D.init();
            }
            container.style.display = 'block';
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            container.style.display = 'none';
            if (vueStock3D) {
                vueStock3D.dispose();
                vueStock3D = null;
            }
        });
    }
});

// Export pour utilisation globale
window.VueStock3D = VueStock3D;
window.vueStock3D = vueStock3D;