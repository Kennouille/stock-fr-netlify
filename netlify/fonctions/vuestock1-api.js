// vuestock1-api.js - Version avec API REST Supabase
exports.handler = async (event, context) => {
  // Variables d'environnement
  const supabaseUrl = 'https://mngggybayjooqkzbhvqy.supabase.co';
  const supabaseKey = process.env.SUPABASE_KEY;

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

  // Vérifier la clé Supabase
  if (!supabaseKey) {
    console.error('❌ SUPABASE_KEY manquante');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Supabase key not configured'
      })
    };
  }

  try {
    // Récupérer l'action depuis le query string
    const params = event.queryStringParameters || {};
    const action = params.action;

    console.log('📡 API Action:', action);

    switch (action) {
      case 'get-3d-data':
        return await get3DData(supabaseUrl, supabaseKey, headers);

      case 'update-quantity':
        if (event.httpMethod === 'PUT') {
          return await updateQuantity(event, supabaseUrl, supabaseKey, headers);
        }
        break;

      case 'level-interaction':
        if (event.httpMethod === 'POST') {
          return await logLevelInteraction(event, supabaseUrl, supabaseKey, headers);
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
        error: error.message
      })
    };
  }
};

// ==================== FONCTION GET 3D DATA ====================
async function get3DData(supabaseUrl, supabaseKey, headers) {
  console.log('📦 Chargement des données 3D...');

  try {
    // Récupérer tous les racks
    const racksResponse = await fetch(
      `${supabaseUrl}/rest/v1/w_vuestock_racks?select=*&order=position_x,position_y`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );

    if (!racksResponse.ok) {
      throw new Error(`Erreur racks: ${racksResponse.status}`);
    }

    const racks = await racksResponse.json();
    console.log(`✅ ${racks.length} racks récupérés`);

    // Pour chaque rack, récupérer ses niveaux et slots
    const racksWithData = await Promise.all(
      racks.map(async (rack) => {
        // Récupérer les niveaux du rack
        const levelsResponse = await fetch(
          `${supabaseUrl}/rest/v1/w_vuestock_levels?rack_id=eq.${rack.id}&is_active=eq.true&select=*&order=display_order`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          }
        );

        const levels = levelsResponse.ok ? await levelsResponse.json() : [];

        // Pour chaque niveau, récupérer ses slots
        const levelsWithSlots = await Promise.all(
          levels.map(async (level) => {
            const slotsResponse = await fetch(
              `${supabaseUrl}/rest/v1/w_vuestock_slots?level_id=eq.${level.id}&select=*&order=display_order`,
              {
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`
                }
              }
            );

            const slots = slotsResponse.ok ? await slotsResponse.json() : [];

            return {
              id: level.id,
              code: level.level_code,
              order: level.display_order,
              height: level.height,
              is_active: level.is_active,
              slots: slots.map(slot => ({
                id: slot.id,
                code: slot.slot_code,
                full_code: slot.full_code,
                capacity: slot.capacity,
                status: slot.status
              }))
            };
          })
        );

        return {
          id: rack.id,
          code: rack.rack_code,
          name: rack.display_name,
          position_x: rack.position_x,
          position_y: rack.position_y,
          rotation: rack.rotation,
          width: rack.width,
          depth: rack.depth,
          color: rack.color,
          levels: levelsWithSlots
        };
      })
    );

    console.log(`✅ Données 3D complètes chargées`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: racksWithData,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Erreur get3DData:', error);
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

// ==================== FONCTION UPDATE QUANTITY ====================
async function updateQuantity(event, supabaseUrl, supabaseKey, headers) {
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
    const checkResponse = await fetch(
      `${supabaseUrl}/rest/v1/stock_articles?slot_id=eq.${slotId}&article_id=eq.${articleId}&select=id,quantity`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );

    const existing = await checkResponse.json();

    if (existing.length > 0) {
      // Mise à jour ou suppression
      if (quantity === 0) {
        // Supprimer
        await fetch(
          `${supabaseUrl}/rest/v1/stock_articles?id=eq.${existing[0].id}`,
          {
            method: 'DELETE',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          }
        );
      } else {
        // Mettre à jour
        await fetch(
          `${supabaseUrl}/rest/v1/stock_articles?id=eq.${existing[0].id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              quantity: quantity,
              updated_at: new Date().toISOString()
            })
          }
        );
      }
    } else if (quantity > 0) {
      // Nouvelle entrée
      await fetch(
        `${supabaseUrl}/rest/v1/stock_articles`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            slot_id: slotId,
            article_id: articleId,
            quantity: quantity,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        }
      );
    }

    // Mettre à jour le statut du slot
    // (Simplifié - vous pouvez ajouter une logique plus complexe si nécessaire)
    const totalResponse = await fetch(
      `${supabaseUrl}/rest/v1/stock_articles?slot_id=eq.${slotId}&select=quantity`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );

    const allArticles = await totalResponse.json();
    const totalQty = allArticles.reduce((sum, a) => sum + a.quantity, 0);

    // Récupérer la capacité du slot
    const slotResponse = await fetch(
      `${supabaseUrl}/rest/v1/w_vuestock_slots?id=eq.${slotId}&select=capacity`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );

    const slotData = await slotResponse.json();
    const capacity = slotData[0]?.capacity || 100;

    let newStatus = 'free';
    if (totalQty > 0 && totalQty < capacity) newStatus = 'partial';
    if (totalQty >= capacity) newStatus = 'occupied';

    // Mettre à jour le statut
    await fetch(
      `${supabaseUrl}/rest/v1/w_vuestock_slots?id=eq.${slotId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
      }
    );

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

// ==================== FONCTION LOG INTERACTION ====================
async function logLevelInteraction(event, supabaseUrl, supabaseKey, headers) {
  const body = JSON.parse(event.body || '{}');
  const { level_id, action, duration_ms, user_id } = body;

  try {
    await fetch(
      `${supabaseUrl}/rest/v1/level_interactions`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          level_id,
          action,
          duration_ms,
          user_id,
          created_at: new Date().toISOString()
        })
      }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Interaction enregistrée'
      })
    };

  } catch (error) {
    console.error('❌ Erreur log interaction:', error);
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