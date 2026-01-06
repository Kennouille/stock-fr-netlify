// vuestock-api.js
exports.handler = async (event) => {
  console.log('🟢 FUNCTION CALLED - Event:', JSON.stringify(event, null, 2));

  // Récupérer les paramètres de requête
  const queryParams = event.queryStringParameters || {};
  const { action } = queryParams;

  console.log('🟢 Action demandée:', action);

  // Vérifiez que SUPABASE_KEY existe
  const supabaseKey = process.env.SUPABASE_KEY;
  console.log('🟢 SUPABASE_KEY existe:', !!supabaseKey);

  if (!supabaseKey) {
    console.error('❌ SUPABASE_KEY is not set');
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
    console.log('🟢 Ping action');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Function works (no DB for now)',
        timestamp: new Date().toISOString()
      })
    };
  }

  if (action === 'test') {
    console.log('🔍 Testing Supabase connection...');
    console.log('SUPABASE_KEY length:', supabaseKey ? supabaseKey.length : 0);

    try {
      const supabaseUrl = 'https://mngggybayjooqkzbhvqy.supabase.co';

      // Tester une requête simple à Supabase
      const testResponse = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_racks?limit=1`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });

      const text = await testResponse.text();
      console.log('Test response status:', testResponse.status);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          test: {
            supabaseKeyExists: !!supabaseKey,
            supabaseKeyLength: supabaseKey ? supabaseKey.length : 0,
            testRequestStatus: testResponse.status,
            testResponse: text.substring(0, 500)
          }
        })
      };
    } catch (error) {
      console.error('Test error:', error);
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
    console.log('🟢 get-config action');
    try {
      const supabaseUrl = 'https://mngggybayjooqkzbhvqy.supabase.co';

      const response = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_racks?select=*`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Supabase error in get-config:', response.status, errorText);
        throw new Error(`Supabase error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`🟢 Retrieved ${data.length} racks from Supabase`);

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
      console.error('❌ Error in get-config:', error);
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
    console.log('🟢 save-rack action');

    try {
      // Parser le body
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch (parseError) {
        console.error('❌ Error parsing body:', parseError);
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

      console.log('📦 Received rack data:', body);

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

      console.log('📤 Sending to Supabase:', payload);

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
      console.log('📥 Supabase response status:', response.status);
      console.log('📥 Supabase response text:', text);

      if (!response.ok) {
        console.error('❌ Supabase error:', text);
        return {
          statusCode: response.status || 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            error: `Supabase error: ${text}`
          })
        };
      }

      let result;
      try {
        result = text ? JSON.parse(text) : null;
      } catch (e) {
        console.error('❌ JSON parse error:', e);
        result = text;
      }

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          data: Array.isArray(result) ? result[0] : result
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
          error: error.message,
          stack: error.stack
        })
      };
    }
  }

  // Si aucune action reconnue
  console.log('⚠️ Unknown action:', action);
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      message: `Action ${action || 'undefined'} not implemented yet`
    })
  };
};