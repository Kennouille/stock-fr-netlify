// Nouvelle approche sans pg
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

  return {
    statusCode: 400,
    body: JSON.stringify({ error: 'Action non reconnue' })
  };
};