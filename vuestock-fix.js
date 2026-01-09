// vuestock-fix.js
window.fix3DView = function() {
    // 1. S'assurer que le canvas existe
    const modal3D = document.getElementById('modal3D');
    if (!modal3D.querySelector('#canvas3D')) {
        modal3D.innerHTML = `
            <button class="close-3d-btn" id="close3DBtn">&times;</button>
            <div class="view-3d-container">
                <canvas id="canvas3D"></canvas>
                <div class="loading-3d" id="loading3D">
                    <div class="spinner-3d"></div>
                    <p>Chargement...</p>
                </div>
                <div class="instructions-3d">
                    <i class="fas fa-mouse"></i> Clic gauche : Rotation
                </div>
            </div>
        `;
    }

    // 2. Override createCanvas pour ne rien faire
    if (window.VueStock3D) {
        const originalCreateCanvas = VueStock3D.prototype.createCanvas;
        VueStock3D.prototype.createCanvas = function() {
            // Ne fait rien - le canvas existe déjà
            console.log('✅ Canvas 3D prêt');
            return document.getElementById('canvas3D');
        };
    }

    // 3. Override loadData pour utiliser des données test
    if (window.VueStock3D) {
        const originalLoadData = VueStock3D.prototype.loadData;
        VueStock3D.prototype.loadData = async function() {
            console.log('📦 Utilisation de données de test pour la 3D');
            this.stockData = this.getTestData();
            return this.stockData;
        };
    }
};

// Appeler au chargement
document.addEventListener('DOMContentLoaded', window.fix3DView);