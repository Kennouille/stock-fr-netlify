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
  if (!el) return;
  el.classList.remove('hidden');
}

function hideLoading() {
  const el = document.getElementById('loading');
  if (!el) return;
  el.classList.add('hidden');
}


function showInfoPanel(title, content) {
  document.getElementById('info-title').textContent = title;
  document.getElementById('info-content').innerHTML = content;
  document.getElementById('info-panel').classList.remove('hidden');
}

function hideInfoPanel() {
  document.getElementById('info-panel').classList.add('hidden');
}

async function initWarehouse() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);

  const container = document.getElementById('warehouse3DContainer');
    camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );


  camera.position.set(0, 20, 40);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.offsetWidth, container.offsetHeight);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);


  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(20, 30, 20);
  scene.add(directionalLight);

  const floorGeometry = new THREE.PlaneGeometry(200, 200);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  renderer.domElement.addEventListener('click', onCanvasClick);
  window.addEventListener('resize', onWindowResize);
  document.addEventListener('keydown', onKeyDown);

  await loadRacks();
  camera.position.set(0, 15, 25);
  camera.lookAt(0, 0, 0);
  animate();

}

async function loadRacks() {
  showLoading();
  const { data: racks, error } = await supabase
    .from('w_vuestock_racks')
    .select('*');

  hideLoading();

  if (error) {
    console.error('Erreur chargement racks:', error);
    return;
  }

  racks.forEach(rack => createRackMesh(rack));
}

function createRackMesh(rack) {
  const group = new THREE.Group();
  group.userData = { type: 'rack', data: rack };

  const width = rack.width || 3;
  const depth = rack.depth || 2;
  const height = 8;

  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({
    color: rack.color || '#4a90e2',
    transparent: true,
    opacity: 0.7
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = height / 2;
  group.add(mesh);

  const edges = new THREE.EdgesGeometry(geometry);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
  const edgesMesh = new THREE.LineSegments(edges, edgeMaterial);
  edgesMesh.position.y = height / 2;
  group.add(edgesMesh);

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

  const posX = rack.position_x || 0;
  const posY = rack.position_y || 0;
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
  const { data: levels, error } = await supabase
    .from('w_vuestock_levels')
    .select('*')
    .eq('rack_id', rack.id)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  hideLoading();

  if (error) {
    console.error('Erreur chargement levels:', error);
    return;
  }

  levels.forEach((level, index) => createLevelMesh(level, index, rack));

  let content = `<p><strong>Code:</strong> ${rack.rack_code}</p>`;
  content += `<p><strong>Niveaux:</strong> ${levels.length}</p>`;
  content += `<p><strong>Position:</strong> X:${rack.position_x} Y:${rack.position_y}</p>`;
  showInfoPanel(rack.display_name || rack.rack_code, content);
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
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
  const edgesMesh = new THREE.LineSegments(edges, edgeMaterial);
  group.add(edgesMesh);

  const yPos = index * 2 + 1;
  group.position.set(rack.position_x || 0, yPos, rack.position_y || 0);

  if (rack.rotation) {
    group.rotation.y = (rack.rotation * Math.PI) / 180;
  }

  scene.add(group);
  levelMeshes.push(group);
}

async function zoomToLevel(levelGroup) {
  selectedLevel = levelGroup;
  viewMode = 'level';
  clearSlotMeshes();
  hideInfoPanel();

  const level = levelGroup.userData.data;
  const rack = levelGroup.userData.rackData;
  const pos = levelGroup.position;

  camera.position.set(pos.x, pos.y, pos.z + 10);
  camera.lookAt(pos.x, pos.y, pos.z);

  showLoading();
  const { data: slots, error } = await supabase
    .from('w_vuestock_slots')
    .select('*')
    .eq('level_id', level.id)
    .order('display_order', { ascending: true });

  hideLoading();

  if (error) {
    console.error('Erreur chargement slots:', error);
    return;
  }

  slots.forEach((slot, index) => createSlotMesh(slot, index, level, rack, pos.y));

  let content = `<p><strong>Rack:</strong> ${rack.display_name || rack.rack_code}</p>`;
  content += `<p><strong>Niveau:</strong> ${level.level_code}</p>`;
  content += `<p><strong>Emplacements:</strong> ${slots.length}</p>`;
  showInfoPanel(`Niveau ${level.level_code}`, content);
}

function createSlotMesh(slot, index, level, rack, yPos) {
  const group = new THREE.Group();
  group.userData = { type: 'slot', data: slot, levelData: level, rackData: rack };

  const slotWidth = 0.8;
  const slotHeight = 0.8;
  const slotDepth = 0.8;

  const totalSlots = 5;
  const startX = -(totalSlots - 1) * slotWidth / 2;

  const geometry = new THREE.BoxGeometry(slotWidth, slotHeight, slotDepth);
  let color = 0x2196F3;
  if (slot.status === 'occupied') color = 0xFF9800;
  if (slot.status === 'reserved') color = 0xF44336;

  const material = new THREE.MeshStandardMaterial({
    color: color,
    transparent: true,
    opacity: 0.8
  });
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);

  const edges = new THREE.EdgesGeometry(geometry);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
  const edgesMesh = new THREE.LineSegments(edges, edgeMaterial);
  group.add(edgesMesh);

  const xPos = (rack.position_x || 0) + startX + index * slotWidth;
  group.position.set(xPos, yPos, rack.position_y || 0);

  if (rack.rotation) {
    group.rotation.y = (rack.rotation * Math.PI) / 180;
  }

  scene.add(group);
  slotMeshes.push(group);
}

async function showSlotDetails(slotGroup) {
  selectedSlot = slotGroup;
  viewMode = 'slot';

  const slot = slotGroup.userData.data;
  const level = slotGroup.userData.levelData;
  const rack = slotGroup.userData.rackData;

  showLoading();
  const { data: articles, error } = await supabase
    .from('w_articles')
    .select('*')
    .eq('slot_id', slot.id)
    .eq('actif', true);

  hideLoading();

  if (error) {
    console.error('Erreur chargement articles:', error);
    return;
  }

  let content = `<p><strong>Rack:</strong> ${rack.display_name || rack.rack_code}</p>`;
  content += `<p><strong>Niveau:</strong> ${level.level_code}</p>`;
  content += `<p><strong>Emplacement:</strong> ${slot.slot_code}</p>`;
  content += `<p><strong>Code complet:</strong> ${slot.full_code}</p>`;
  content += `<p><strong>Capacité:</strong> ${slot.capacity}</p>`;
  content += `<p><strong>Statut:</strong> ${slot.status}</p>`;

  if (articles && articles.length > 0) {
    content += `<hr style="margin: 15px 0; border-color: #4CAF50;">`;
    articles.forEach(article => {
      content += `<p><strong>Article:</strong> ${article.nom}</p>`;
      content += `<p><strong>Numéro:</strong> ${article.numero}</p>`;
      content += `<p><strong>Stock actuel:</strong> ${article.stock_actuel}</p>`;

      const stockClass = article.stock_actuel <= article.stock_minimum ? 'stock-critical' :
                         article.stock_actuel <= article.stock_minimum * 1.5 ? 'stock-warning' : '';
      content += `<p class="${stockClass}"><strong>Stock minimum:</strong> ${article.stock_minimum}</p>`;

      if (article.photo_url) {
        content += `<img src="${article.photo_url}" alt="${article.nom}">`;
      }

      if (articles.indexOf(article) < articles.length - 1) {
        content += `<hr style="margin: 15px 0; border-color: #666;">`;
      }
    });
  } else {
    content += `<p style="color: #999; margin-top: 15px;">Aucun article dans cet emplacement</p>`;
  }

  showInfoPanel(`Détails ${slot.full_code}`, content);
}

function clearLevelMeshes() {
  levelMeshes.forEach(mesh => scene.remove(mesh));
  levelMeshes = [];
}

function clearSlotMeshes() {
  slotMeshes.forEach(mesh => scene.remove(mesh));
  slotMeshes = [];
}

function goBack() {
  if (viewMode === 'slot') {
    viewMode = 'level';
    hideInfoPanel();
    camera.position.set(selectedLevel.position.x, selectedLevel.position.y, selectedLevel.position.z + 10);
    camera.lookAt(selectedLevel.position.x, selectedLevel.position.y, selectedLevel.position.z);
    zoomToLevel(selectedLevel);
  } else if (viewMode === 'level') {
    viewMode = 'rack';
    clearSlotMeshes();
    hideInfoPanel();
    const pos = selectedRack.position;
    camera.position.set(pos.x, 10, pos.z + 15);
    camera.lookAt(pos.x, 5, pos.z);
    zoomToRack(selectedRack);
  } else if (viewMode === 'rack') {
    viewMode = 'overview';
    clearLevelMeshes();
    clearSlotMeshes();
    hideInfoPanel();
    selectedRack = null;
    selectedLevel = null;
    selectedSlot = null;
    camera.position.set(0, 20, 40);
    camera.lookAt(0, 0, 0);
  }
}

function onCanvasClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  let intersects = [];

  if (viewMode === 'overview') {
    intersects = raycaster.intersectObjects(rackMeshes, true);
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj.parent && !obj.userData.type) {
        obj = obj.parent;
      }
      if (obj.userData.type === 'rack') {
        zoomToRack(obj);
      }
    }
  } else if (viewMode === 'rack') {
    intersects = raycaster.intersectObjects(levelMeshes, true);
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj.parent && !obj.userData.type) {
        obj = obj.parent;
      }
      if (obj.userData.type === 'level') {
        zoomToLevel(obj);
      }
    }
  } else if (viewMode === 'level') {
    intersects = raycaster.intersectObjects(slotMeshes, true);
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj.parent && !obj.userData.type) {
        obj = obj.parent;
      }
      if (obj.userData.type === 'slot') {
        showSlotDetails(obj);
      }
    }
  }
}

function onKeyDown(event) {
  if (event.key === 'Escape') {
    if (viewMode !== 'overview') {
      goBack();
    }
  }
}

function onWindowResize() {
  if (!isModalOpen) return;
  const container = document.getElementById('canvas-container');
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
  if (!isModalOpen) return;
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

export function openWarehouseModal() {
  const modal = document.getElementById('warehouse-modal');
  modal.classList.add('active');
  isModalOpen = true;

  if (!scene) {
    initWarehouse();
  } else {
    animate();
  }
}


window.openWarehouseModal = openWarehouseModal;

export function closeWarehouseModal() {
  const modal = document.getElementById('warehouse-modal');
  modal.classList.add('hidden');
  isModalOpen = false;
  viewMode = 'overview';
  clearLevelMeshes();
  clearSlotMeshes();
  hideInfoPanel();
  selectedRack = null;
  selectedLevel = null;
  selectedSlot = null;

  if (camera) {
    camera.position.set(0, 20, 40);
    camera.lookAt(0, 0, 0);
  }
}

const closeBtn = document.getElementById('close-modal');
if (closeBtn) {
  closeBtn.addEventListener('click', closeWarehouseModal);
}
