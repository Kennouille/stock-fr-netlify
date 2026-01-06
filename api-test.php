<?php
// api-test.php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Test simple pour vérifier que PHP fonctionne
if ($_GET['action'] === 'ping') {
    echo json_encode([
        'success' => true,
        'message' => 'API is working',
        'time' => date('Y-m-d H:i:s'),
        'server' => $_SERVER['SERVER_SOFTWARE']
    ]);
    exit;
}

// Test de connexion à la base
if ($_GET['action'] === 'test-db') {
    try {
        $host = 'localhost';
        $dbname = 'votre_base';
        $username = 'votre_utilisateur';
        $password = 'votre_mdp';

        $pdo = new PDO("pgsql:host=$host;dbname=$dbname", $username, $password);

        echo json_encode([
            'success' => true,
            'message' => 'Database connected',
            'driver' => $pdo->getAttribute(PDO::ATTR_DRIVER_NAME)
        ]);
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
    }
    exit;
}