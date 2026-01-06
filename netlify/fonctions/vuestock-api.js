// vuestock-api.js
exports.handler = async (event) => {
  // vuestock-api.js - Ajoutez ce test en haut de la fonction handler
    if (action === 'test') {
      console.log('🔍 Testing Supabase connection...');
      console.log('SUPABASE_KEY exists:', !!process.env.SUPABASE_KEY);
      console.log('SUPABASE_KEY first chars:', process.env.SUPABASE_KEY ? process.env.SUPABASE_KEY.substring(0, 10) + '...' : 'null');

      try {
        const supabaseUrl = 'https://mngggybayjooqkzbhvqy.supabase.co';
        const supabaseKey = process.env.SUPABASE_KEY;

        const testResponse = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_racks?limit=1`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        });

        const text = await testResponse.text();

        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            test: {
              supabaseKeyExists: !!supabaseKey,
              testRequestStatus: testResponse.status,
              testResponse: text.substring(0, 200)
            }
          })
        };
      } catch (error) {
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: error.message
          })
        };
      }
    }

  console.log('🟢 FUNCTION CALLED:', event.queryStringParameters);
  const { action } = event.queryStringParameters || {};

  // Vérifiez que SUPABASE_KEY existe
  const supabaseKey = process.env.SUPABASE_KEY;
  if (!supabaseKey) {
    console.error('❌ SUPABASE_KEY is not set');
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Supabase key not configured'
      })
    };
  }

  if (action === 'ping') {
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Function works (no DB for now)' })
    };
  }

  if (action === 'get-config') {
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, data: [] })
    };
  }

  if (action === 'save-rack') {
    try {
      const body = JSON.parse(event.body || '{}');
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
      console.log('📥 Supabase response:', response.status, text);

      if (!response.ok) {
        console.error('❌ Supabase error:', text);
        return {
          statusCode: response.status || 500,
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
        body: JSON.stringify({
          success: true,
          data: Array.isArray(result) ? result[0] : result
        })
      };

    } catch (error) {
      console.error('❌ Server error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        })
      };
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      message: `Action ${action || 'undefined'} simulée`
    })
  };
};