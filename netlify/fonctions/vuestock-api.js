// vuestock-api.js - Version finale
exports.handler = async (event) => {
  // D'abord, initialiser toutes les variables
  const queryParams = event.queryStringParameters || {};
  const action = queryParams.action;

  console.log('🟢 FUNCTION CALLED - Action:', action);

  // Vérifier la clé Supabase
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseKey) {
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
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Pong! Function is working',
        timestamp: new Date().toISOString()
      })
    };
  }

  if (action === 'get-config') {
    try {
      const supabaseUrl = 'https://mngggybayjooqkzbhvqy.supabase.co';

      const response = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_racks?select=*&order=rack_code.asc`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Supabase error: ${response.status}`);
      }

      const data = await response.json();

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

  // Dans vuestock-api.js - fonction save-rack
    if (action === 'save-rack') {
        try {
            let body = {};
            if (event.body) {
                body = JSON.parse(event.body);
            }

            console.log('📦 Body parsed for save-rack:', body);
            console.log('🆔 ID présent?:', !!body.id);

            const supabaseUrl = 'https://mngggybayjooqkzbhvqy.supabase.co';

            const payload = {
                rack_code: body.code || body.rack_code || `RACK_${Date.now()}`,
                display_name: body.name || body.display_name || `Étagère ${body.code}`,
                position_x: body.position_x || body.x || 100,
                position_y: body.position_y || body.y || 100,
                rotation: body.rotation || 0,
                width: body.width || 3,
                depth: body.depth || 2,
                color: body.color || '#4a90e2'
            };

            // Nettoyer le payload (enlever les undefined)
            Object.keys(payload).forEach(key => {
                if (payload[key] === undefined) {
                    delete payload[key];
                }
            });

            let response;
            let method;

            // DÉCISION : création ou mise à jour ?
            if (body.id) {
                // Mise à jour avec PATCH
                console.log(`📝 Mise à jour PATCH pour ID: ${body.id}`);
                method = 'PATCH';
                response = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_racks?id=eq.${body.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(payload)
                });
            } else {
                // Création avec POST
                console.log('➕ Création POST nouvelle étagère');
                method = 'POST';
                response = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_racks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(payload)
                });
            }

            const text = await response.text();
            console.log(`📥 Supabase ${method} response:`, response.status, text);

            if (!response.ok) {
                throw new Error(`Supabase ${method} error: ${response.status} - ${text}`);
            }

            let result;
            try {
                result = text ? JSON.parse(text) : null;
            } catch (e) {
                console.error('❌ Error parsing JSON:', e);
                result = { raw: text };
            }

            // Pour PATCH, Supabase peut retourner un tableau vide
            const responseData = Array.isArray(result) && result.length > 0 ? result[0] : result;

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: true,
                    data: responseData || { id: body.id, ...payload },
                    operation: body.id ? 'updated' : 'created',
                    method: method
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
                    error: error.message
                })
            };
        }
    }

  if (action === 'delete-rack') {
    try {
        let body = {};
        if (event.body) {
            body = JSON.parse(event.body);
        }

        if (!body.id) {
            throw new Error('ID is required for deletion');
        }

        const supabaseUrl = 'https://mngggybayjooqkzbhvqy.supabase.co';

        console.log('🗑️ Deleting rack with ID:', body.id);

        const response = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_racks?id=eq.${body.id}`, {
            method: 'DELETE',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        const text = await response.text();

        if (!response.ok) {
            throw new Error(`Supabase error: ${response.status} - ${text}`);
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                message: 'Rack deleted successfully'
            })
        };

    } catch (error) {
        console.error('❌ Error in delete-rack:', error);
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

  // Si aucune action reconnue
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      message: `Action '${action}' not implemented`
    })
  };
};