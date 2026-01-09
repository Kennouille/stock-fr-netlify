// netlify/fonctions/vuestock1-api.js
const { Pool } = require('pg');

// Connexion à PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Gérer les requêtes OPTIONS (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS OK' })
    };
  }

  try {
    // Récupérer l'action depuis le query string
    const params = new URLSearchParams(event.queryStringParameters || '');
    const action = params.get('action');

    console.log('📡 API Action:', action);

    switch (action) {
      case 'get-3d-data':
        return await get3DData(event, headers);

      case 'update-quantity':
        if (event.httpMethod === 'PUT') {
          return await updateQuantity(event, headers);
        }
        break;

      case 'level-interaction':
        if (event.httpMethod === 'POST') {
          return await logLevelInteraction(event, headers);
        }
        break;

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Action non reconnue'
          })
        };
    }

  } catch (error) {
    console.error('❌ Erreur API:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};

// Fonction pour récupérer les données 3D
async function get3DData(event, headers) {
  console.log('📦 Chargement des données 3D...');

  const query = `
    SELECT
      r.id,
      r.rack_code as code,
      r.display_name as name,
      r.position_x,
      r.position_y,
      r.rotation,
      r.width,
      r.depth,
      r.color,
      COALESCE(
        json_agg(
          json_build_object(
            'id', l.id,
            'code', l.level_code,
            'order', l.display_order,
            'height', l.height,
            'is_active', l.is_active,
            'slots', COALESCE(
              (SELECT json_agg(
                json_build_object(
                  'id', s.id,
                  'code', s.slot_code,
                  'full_code', s.full_code,
                  'capacity', s.capacity,
                  'status', s.status
                )
                ORDER BY s.display_order
              )
              FROM w_vuestock_slots s
              WHERE s.level_id = l.id),
              '[]'::json
            )
          )
          ORDER BY l.display_order
        ) FILTER (WHERE l.id IS NOT NULL),
        '[]'::json
      ) as levels
    FROM w_vuestock_racks r
    LEFT JOIN w_vuestock_levels l ON l.rack_id = r.id AND l.is_active = true
    GROUP BY r.id
    ORDER BY r.position_x, r.position_y;
  `;

  const result = await pool.query(query);

  console.log(`✅ ${result.rows.length} racks chargés pour la vue 3D`);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      data: result.rows,
      timestamp: new Date().toISOString()
    })
  };
}

// Fonction pour mettre à jour une quantité
async function updateQuantity(event, headers) {
  const body = JSON.parse(event.body || '{}');
  const { slotId, articleId, quantity } = body;

  if (quantity === undefined || quantity < 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Quantité invalide'
      })
    };
  }

  try {
    // Vérifier si l'entrée existe
    const checkQuery = `
      SELECT id, quantity as old_quantity
      FROM stock_articles
      WHERE slot_id = $1 AND article_id = $2
    `;

    const checkResult = await pool.query(checkQuery, [slotId, articleId]);

    if (checkResult.rows.length > 0) {
      // Mise à jour existante
      if (quantity === 0) {
        // Supprimer si quantité = 0
        await pool.query(
          'DELETE FROM stock_articles WHERE id = $1',
          [checkResult.rows[0].id]
        );
      } else {
        // Mettre à jour
        await pool.query(
          `UPDATE stock_articles
           SET quantity = $1, updated_at = NOW()
           WHERE id = $2`,
          [quantity, checkResult.rows[0].id]
        );
      }
    } else if (quantity > 0) {
      // Nouvelle entrée
      await pool.query(
        `INSERT INTO stock_articles
         (slot_id, article_id, quantity, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [slotId, articleId, quantity]
      );
    }

    // Mettre à jour le statut du slot
    await pool.query(`
      UPDATE w_vuestock_slots s
      SET
        status = CASE
          WHEN total_qty = 0 THEN 'free'
          WHEN total_qty >= s.capacity THEN 'occupied'
          ELSE 'partial'
        END,
        updated_at = NOW()
      FROM (
        SELECT
          s2.id,
          COALESCE(SUM(sa.quantity), 0) as total_qty,
          s2.capacity
        FROM w_vuestock_slots s2
        LEFT JOIN stock_articles sa ON sa.slot_id = s2.id
        WHERE s2.id = $1
        GROUP BY s2.id, s2.capacity
      ) stats
      WHERE s.id = stats.id;
    `, [slotId]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Quantité mise à jour avec succès'
      })
    };

  } catch (error) {
    console.error('❌ Erreur mise à jour quantité:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
}

// Fonction pour logger les interactions
async function logLevelInteraction(event, headers) {
  const body = JSON.parse(event.body || '{}');
  const { level_id, action, duration_ms, user_id } = body;

  await pool.query(
    `INSERT INTO level_interactions
     (level_id, action, duration_ms, user_id, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [level_id, action, duration_ms, user_id]
  );

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: 'Interaction enregistrée'
    })
  };
}