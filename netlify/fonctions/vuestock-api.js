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
    const supabaseKey = process.env.SUPABASE_KEY;

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
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      });

      const text = await response.text(); // <- texte brut
      console.log('Supabase raw response:', response.status, text);

      const result = text ? JSON.parse(text) : null;

      if (!response.ok) {
        return { statusCode: 500, body: JSON.stringify({ success: false, result: text }) };
      }

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
