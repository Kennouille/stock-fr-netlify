// vuestock-api.js
exports.handler = async (event) => {
  console.log('🟢 FUNCTION CALLED:', event.queryStringParameters);
  const { action } = event.queryStringParameters || {};

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
    const body = JSON.parse(event.body || '{}');

    const supabaseUrl = 'https://mngggybayjooqkzbhvqy.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZ2dneWJheWpvb3FremJodnF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY2MTU3NDgsImV4cCI6MjA0MjE5MTc0OH0.lnOqnq1AwN41g4xJ5O9oNIPBQqXYJkSrRhJ3osXtcsk';

    const payload = {
      rack_code: body.code,
      display_name: body.name,
      position_x: body.position_x,
      position_y: body.position_y,
      rotation: body.rotation,
      width: body.width,
      depth: body.depth,
      color: body.color
    };

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_racks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation' // 🔹 renvoyer le rack créé
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      console.log('Supabase result:', result);

      if (!response.ok) {
        return { statusCode: 500, body: JSON.stringify({ success: false, result }) };
      }

      // 🔹 Renvoie le rack créé
      return { statusCode: 200, body: JSON.stringify({ success: true, data: result[0] }) };

    } catch (error) {
      console.error('Supabase error:', error);
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
}


  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, message: `Action ${action || 'undefined'} simulée` })
  };
};
