// vuestock-api.js - Version finale
exports.handler = async (event) => {
  // D'abord, initialiser toutes les variables
  const queryParams = event.queryStringParameters || {};
  const action = queryParams.action;

  console.log('🟢 FUNCTION CALLED - Action:', action);

  // Vérifier la clé Supabase
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseKey) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Supabase key not configured'
      })
    };
  }

  // Gérer les différentes actions
  if (action === 'ping') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Pong! Function is working',
        timestamp: new Date().toISOString()
      })
    };
  }

  if (action === 'get-config') {
    try {
      const supabaseUrl = 'https://mngggybayjooqkzbhvqy.supabase.co';

      const response = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_racks?select=*&order=rack_code.asc`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Supabase error: ${response.status}`);
      }

      const data = await response.json();

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          data: data,
          count: data.length
        })
      };

    } catch (error) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: error.message
        })
      };
    }
  }

  if (action === 'save-rack') {
    try {
      // Parser le body
      let body = {};
      if (event.body) {
        try {
          body = JSON.parse(event.body);
        } catch (e) {
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: false,
              error: 'Invalid JSON body'
            })
          };
        }
      }

      console.log('📦 Body parsed:', body);

      const supabaseUrl = 'https://mngggybayjooqkzbhvqy.supabase.co';

      // Préparer le payload
      const payload = {
        rack_code: body.code || `RACK_${Date.now()}`,
        display_name: body.name || `Étagère ${body.code}`,
        position_x: body.position_x || body.x || 100,
        position_y: body.position_y || body.y || 100,
        rotation: body.rotation || 0,
        width: body.width || 3,
        depth: body.depth || 2,
        color: body.color || '#4a90e2'
      };

      // Si l'étagère a un ID, c'est une mise à jour
      // Sinon, c'est une création
      const hasId = body.id && body.id !== undefined;

      let response;
      let url = `${supabaseUrl}/rest/v1/w_vuestock_racks`;

      if (hasId) {
        console.log(`📝 Mise à jour de l'étagère ID: ${body.id}`);
        url += `?id=eq.${body.id}`;

        response = await fetch(url, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(payload)
        });
      } else {
        console.log('➕ Création d\'une nouvelle étagère');

        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(payload)
        });
      }

      const text = await response.text();
      console.log('📥 Supabase response status:', response.status);

      if (!response.ok) {
        console.error('❌ Supabase error details:', text);
        throw new Error(`Supabase error: ${response.status}`);
      }

      let result;
      try {
        result = text ? JSON.parse(text) : null;
      } catch (e) {
        console.error('❌ Error parsing JSON:', e);
        result = { raw: text };
      }

      // Formater la réponse
      const responseData = Array.isArray(result) ? result[0] : result;

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          data: responseData,
          operation: hasId ? 'updated' : 'created'
        })
      };

    } catch (error) {
      console.error('❌ Server error in save-rack:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: error.message
        })
      };
    }
  }

  // Si aucune action reconnue
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      message: `Action '${action}' not implemented`
    })
  };
};