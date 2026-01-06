exports.handler = async (event) => {
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

      // Envoyer à Supabase REST API
      const supabaseUrl = 'https://mngggybayjooqkzbhvqy.supabase.co';
      const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZ2dneWJheWpvb3FremJodnF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY2MTU3NDgsImV4cCI6MjA0MjE5MTc0OH0.lnOqnq1AwN41g4xJ5O9oNIPBQqXYJkSrRhJ3osXtcsk'; // Trouvez dans Supabase → Settings → API

      const response = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_racks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          id: result.id,
          message: 'Étagère sauvegardée dans Supabase'
        })
      };
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