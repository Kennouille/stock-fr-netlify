// netlify/functions/vuestock-api.js
exports.handler = async (event) => {
  const { action } = event.queryStringParameters || {};

  if (action === 'ping') {
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Netlify Function works',
        timestamp: new Date().toISOString()
      })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      data: [],
      message: 'Mode simulation - PHP non disponible sur Netlify'
    })
  };
};