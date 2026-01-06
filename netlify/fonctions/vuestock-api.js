exports.handler = async (event) => {
  console.log('🟢 FUNCTION CALLED:', event.queryStringParameters);

  const { action } = event.queryStringParameters || {};

  if (action === 'ping') {
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Function works (no DB for now)'
      })
    };
  }

  if (action === 'get-config') {
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: [] // Vide pour l'instant
      })
    };
  }

  if (action === 'save-rack') {
    const body = JSON.parse(event.body || '{}');
    console.log('Saving to Supabase:', body);

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
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify(payload)
      });

      console.log('Supabase response status:', response.status);
      const result = await response.json();
      console.log('Supabase result:', result);

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, result })
      };

    } catch (error) {
      console.error('Supabase error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message })
      };
    }
  }

  // Pour toutes les autres actions
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      message: `Action ${action} simulée`
    })
  };
};
