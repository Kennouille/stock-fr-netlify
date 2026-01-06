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
    // Simulation de sauvegarde
    const body = JSON.parse(event.body || '{}');
    console.log('Saving rack:', body);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        id: Date.now(),
        message: 'Étagère sauvegardée (simulation)'
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