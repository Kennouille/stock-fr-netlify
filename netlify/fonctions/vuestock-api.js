// vuestock-api.js
exports.handler = async (event) => {
  // D'abord, initialiser toutes les variables
  const queryParams = event.queryStringParameters || {};
  const action = queryParams.action;

  console.log('🟢 FUNCTION CALLED - Action:', action);
  console.log('🟢 Query params:', queryParams);

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

  if (action === 'test') {
    try {
      const supabaseUrl = 'https://mngggybayjooqkzbhvqy.supabase.co';

      const testResponse = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_racks?limit=1`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });

      const text = await testResponse.text();

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          test: {
            supabaseKeyExists: true,
            supabaseKeyLength: supabaseKey.length,
            testRequestStatus: testResponse.status,
            testResponse: text.substring(0, 500)
          }
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
        body = JSON.parse(event.body);
      }

      console.log('📦 Body parsed:', body);

      const supabaseUrl = 'https://mngggybayjooqkzbhvqy.supabase.co';

      const payload = {
        rack_code: body.code,
        display_name: body.name || `Étagère ${body.code}`,
        position_x: body.position_x || body.x || 100,
        position_y: body.position_y || body.y || 100,
        rotation: body.rotation || 0,
        width: body.width || 3,
        depth: body.depth || 2,
        color: body.color || '#4a90e2'
      };

      console.log('📤 Payload for Supabase:', payload);

      const response = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_racks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(`Supabase error: ${response.status} - ${text}`);
      }

      const result = JSON.parse(text);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          data: result[0]
        })
      };

    } catch (error) {
      console.error('❌ Error in save-rack:', error);
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