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
      const supabaseKey = 'votre-cle';

      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_racks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify(body)
        });

        console.log('Supabase response status:', response.status);
        const result = await response.json();
        console.log('Supabase result:', result);

        return {
          statusCode: 200,
          body: JSON.stringify({
            success: response.ok,
            id: result.id || Date.now(),
            message: response.ok ? 'Sauvegardé' : 'Erreur Supabase'
          })
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