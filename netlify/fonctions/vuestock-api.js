const { Pool } = require('pg');

exports.handler = async (event) => {
  const { action } = event.queryStringParameters || {};

  console.log('Function called with action:', action);

  // Connexion à Supabase
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    switch (action) {
      case 'get-config':
        const result = await pool.query(`
          SELECT * FROM w_vuestock_racks
          ORDER BY rack_code
        `);

        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            data: result.rows,
            count: result.rowCount
          })
        };

      case 'ping':
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            message: 'Netlify Function + PostgreSQL connected',
            timestamp: new Date().toISOString()
          })
        };

      default:
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'Action non reconnue',
            available_actions: ['get-config', 'ping']
          })
        };
    }

  } catch (error) {
    console.error('Database error:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
        hint: 'Vérifiez DATABASE_URL et les tables PostgreSQL'
      })
    };

  } finally {
    await pool.end();
  }
};