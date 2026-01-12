import { supabase } from './supabaseClient.js';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.module.js';

let scene, camera, renderer, raycaster, mouse;
let viewMode = 'overview';
let selectedRack = null;
let selectedLevel = null;
let selectedSlot = null;
let rackMeshes = [];
let levelMeshes = [];
let slotMeshes = [];
let isModalOpen = false;

function showLoading() {
  const el = document.getElementById('loading');
  if (el) el.classList.remove('hidden');
}

function hideLoading() {
  const el = document.getElementById('loading');
  if (el) el.classList.add('hidden');
}

function showInfoPanel(title, content) {
  const titleEl = document.getElementById('info-title');
  const contentEl = document.getElementById('info-content');
  const panelEl = document.getElementById('info-panel');

  if (titleEl && contentEl && panelEl) {
    titleEl.textContent = title;
    contentEl.innerHTML = content;
    panelEl.classList.remove('hidden');
  }
}

function hideInfoPanel() {
  const infoPanel = document.getElementById('info-panel');
  if (infoPanel) infoPanel.classList.add('hidden');
}

async function initWarehouse() {
  const container = document.getElementById('warehouse3DContainer');
  if (!container) {
    console.error('Conteneur 3D non trouvé');
    return;
  }

  // Nettoyer l'ancienne scène si elle existe
  if (renderer) {
    container.removeChild(renderer.domElement);
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);

  camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );

  camera.position.set(0, 20, 40);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Éclairage
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(20, 30, 20);
  scene.add(directionalLight);

  // Sol
  const floorGeometry = new THREE.PlaneGeometry(200, 200);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Événements
  renderer.domElement.addEventListener('click', onCanvasClick);
  renderer.domElement.addEventListener('wheel', onMouseWheel);
  window.addEventListener('resize', onWindowResize);
  document.addEventListener('keydown', onKeyDown);

  await loadRacks();
  animate();
}

async function loadRacks() {
  showLoading();

  try {
    const { data: racks, error } = await supabase
      .from('w_vuestock_racks')
      .select('*');

    if (error) throw error;

    console.log('Racks chargés:', racks);

    racks.forEach(rack => createRackMesh(rack));
  } catch (error) {
    console.error('Erreur chargement racks:', error);
  } finally {
    hideLoading();
  }
}

function createRackMesh(rack) {
  const group = new THREE.Group();
  group.userData = { type: 'rack', data: rack };

  const width = rack.width || 3;
  const depth = rack.depth || 2;
  const height = 8;

  // Boîte principale
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({
    color: rack.color || '#4a90e2',
    transparent: true,
    opacity: 0.7
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = height / 2;
  group.add(mesh);

  // Contours
  const edges = new THREE.EdgesGeometry(geometry);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
  const edgesMesh = new THREE.LineSegments(edges, edgeMaterial);
  edgesMesh.position.y = height / 2;
  group.add(edgesMesh);

  // Label
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 80px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(rack.display_name || rack.rack_code, 256, 150);

  const texture = new THREE.CanvasTexture(canvas);
  const labelMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const labelGeometry = new THREE.PlaneGeometry(4, 2);
  const label = new THREE.Mesh(labelGeometry, labelMaterial);
  label.position.set(0, height + 1.5, 0);
  group.add(label);

  // Position
  const posX = (rack.position_x || 0) / 50;
  const posY = (rack.position_y || 0) / 50;
  group.position.set(posX, 0, posY);

  if (rack.rotation) {
    group.rotation.y = (rack.rotation * Math.PI) / 180;
  }

  scene.add(group);
  rackMeshes.push(group);
}

async function zoomToRack(rackGroup) {
  selectedRack = rackGroup;
  viewMode = 'rack';
  clearLevelMeshes();
  clearSlotMeshes();
  hideInfoPanel();

  const rack = rackGroup.userData.data;
  const pos = rackGroup.position;

  camera.position.set(pos.x, 10, pos.z + 15);
  camera.lookAt(pos.x, 5, pos.z);

  showLoading();

  try {
    const { data: levels, error } = await supabase
      .from('w_vuestock_levels')
      .select('*')
      .eq('rack_id', rack.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    levels.forEach((level, index) => createLevelMesh(level, index, rack));

    let content = `<p><strong>Code:</strong> ${rack.rack_code}</p>`;
    content += `<p><strong>Niveaux:</strong> ${levels.length}</p>`;
    content += `<p><strong>Position:</strong> X:${rack.position_x} Y:${rack.position_y}</p>`;
    showInfoPanel(rack.display_name || rack.rack_code, content);
  } catch (error) {
    console.error('Erreur chargement levels:', error);
  } finally {
    hideLoading();
  }
}

function createLevelMesh(level, index, rack) {
  const group = new THREE.Group();
  group.userData = { type: 'level', data: level, rackData: rack };

  const width = (rack.width || 3) - 0.2;
  const height = (level.height || 100) / 100;
  const depth = (rack.depth || 2) - 0.2;

  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({
    color: 0x4CAF50,
    transparent: true,
    opacity: 0.6
  });
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);

  const edges = new THREE.EdgesGeometry(geometry);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
  const edgesMesh = new THREE.LineSegments(edges, edgeMaterial);
  group.add(edgesMesh);

  const yPos = index * 2 + 1;

  const rackMesh = rackMeshes.find(r => r.userData.data.id === rack.id);
  if (rackMesh) {
    group.position.set(rackMesh.position.x, yPos, rackMesh.position.z);
    group.rotation.y = rackMesh.rotation.y;
  }

  scene.add(group);
  levelMeshes.push(group);
}

// ... (les autres fonctions restent similaires, assurez-vous qu'elles utilisent le bon ID)

function clearLevelMeshes() {
  levelMeshes.forEach(mesh => scene.remove(mesh));
  levelMeshes = [];
}

function clearSlotMeshes() {
  slotMeshes.forEach(mesh => scene.remove(mesh));
  slotMeshes = [];
}

function cleanupScene() {
  if (scene) {
    while(scene.children.length > 0) {
      scene.remove(scene.children[0]);
    }
  }

  if (renderer) {
    renderer.dispose();
    renderer = null;
  }

  rackMeshes = [];
  levelMeshes = [];
  slotMeshes = [];
  selectedRack = null;
  selectedLevel = null;
  selectedSlot = null;
  viewMode = 'overview';
}

function onWindowResize() {
  if (!isModalOpen || !camera || !renderer) return;

  const container = document.getElementById('warehouse3DContainer');
  if (!container) return;

  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
  if (!isModalOpen || !renderer || !scene || !camera) return;

  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

export async function openWarehouseModal() {
  const modal = document.getElementById('warehouse-modal');
  if (!modal) {
    console.error('Modal non trouvé');
    return;
  }

  modal.classList.remove('hidden');
  modal.classList.add('active');
  isModalOpen = true;

  // Initialiser ou réinitialiser la scène
  if (!scene) {
    await initWarehouse();
  } else {
    // Si la scène existe déjà, s'assurer qu'elle est visible
    onWindowResize();
  }

  // Charger les niveaux pour tous les racks
  showLoading();

  for (let rackGroup of rackMeshes) {
    const rack = rackGroup.userData.data;

    try {
      const { data: levels, error } = await supabase
        .from('w_vuestock_levels')
        .select('*')
        .eq('rack_id', rack.id)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (!error && levels) {
        levels.forEach((level, index) => createLevelMesh(level, index, rack));
      }
    } catch (error) {
      console.error('Erreur chargement niveaux:', error);
    }
  }

  hideLoading();

  // Démarrer l'animation
  animate();
}

export function closeWarehouseModal() {
  const modal = document.getElementById('warehouse-modal');
  if (modal) {
    modal.classList.remove('active');
    modal.classList.add('hidden');
  }
  isModalOpen = false;
}

// Attacher l'événement de fermeture
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('closeWarehouseModal');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeWarehouseModal);
  }
});

// Rendre la fonction accessible globalement
window.openWarehouseModal = openWarehouseModal;

// Fonction pour nettoyer quand la page se ferme
window.addEventListener('beforeunload', () => {
  cleanupScene();
});