// ============================================
// VUESTOCK API - Endpoints pour la vue 3D
// ============================================

const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// ==================== ENDPOINTS 3D ====================

/**
 * GET /api/vuestock/3d-data
 * Récupère toutes les données formatées pour la vue 3D
 */
router.get('/3d-data', async (req, res) => {
    try {
        console.log('📦 Chargement des données 3D...');

        const query = `
            WITH rack_levels AS (
                SELECT
                    r.id as rack_id,
                    r.rack_code,
                    r.display_name,
                    r.position_x,
                    r.position_y,
                    r.rotation,
                    r.width,
                    r.depth,
                    r.color,
                    json_agg(
                        json_build_object(
                            'id', l.id,
                            'level_code', l.level_code,
                            'display_order', l.display_order,
                            'height', l.height,
                            'is_active', l.is_active,
                            'created_at', l.created_at
                        ) ORDER BY l.display_order
                    ) as levels
                FROM w_vuestock_racks r
                LEFT JOIN w_vuestock_levels l ON l.rack_id = r.id AND l.is_active = true
                GROUP BY r.id
            ),
            level_slots AS (
                SELECT
                    l.id as level_id,
                    json_agg(
                        json_build_object(
                            'id', s.id,
                            'slot_code', s.slot_code,
                            'full_code', s.full_code,
                            'capacity', s.capacity,
                            'status', s.status,
                            'dimensions', COALESCE(s.dimensions, '{}'::jsonb),
                            'display_order', s.display_order,
                            'articles', COALESCE(
                                (SELECT json_agg(
                                    json_build_object(
                                        'id', a.id,
                                        'name', a.name,
                                        'code', a.code,
                                        'quantity', sa.quantity,
                                        'unit', a.unit,
                                        'barcode', a.barcode,
                                        'photo_url', a.photo_url
                                    )
                                )
                                FROM stock_articles sa
                                JOIN articles a ON a.id = sa.article_id
                                WHERE sa.slot_id = s.id
                                AND sa.quantity > 0),
                                '[]'::json
                            )
                        ) ORDER BY s.display_order
                    ) as slots
                FROM w_vuestock_levels l
                LEFT JOIN w_vuestock_slots s ON s.level_id = l.id
                WHERE l.is_active = true
                GROUP BY l.id
            )
            SELECT
                rl.*,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', rl_levels->>'id',
                            'level_code', rl_levels->>'level_code',
                            'display_order', (rl_levels->>'display_order')::int,
                            'height', (rl_levels->>'height')::int,
                            'is_active', (rl_levels->>'is_active')::boolean,
                            'slots', COALESCE(ls.slots, '[]'::json)
                        )
                    ) FILTER (WHERE rl_levels IS NOT NULL),
                    '[]'::json
                ) as levels_with_slots
            FROM rack_levels rl
            LEFT JOIN LATERAL json_array_elements(rl.levels) AS rl_levels ON true
            LEFT JOIN level_slots ls ON ls.level_id = (rl_levels->>'id')::int
            GROUP BY
                rl.rack_id, rl.rack_code, rl.display_name,
                rl.position_x, rl.position_y, rl.rotation,
                rl.width, rl.depth, rl.color, rl.levels
            ORDER BY rl.position_x, rl.position_y;
        `;

        const result = await pool.query(query);

        // Formater la réponse
        const racks = result.rows.map(row => {
            return {
                id: row.rack_id,
                rack_code: row.rack_code,
                display_name: row.display_name,
                position_x: row.position_x,
                position_y: row.position_y,
                rotation: row.rotation,
                width: row.width,
                depth: row.depth,
                color: row.color,
                levels: row.levels_with_slots
            };
        });

        console.log(`✅ ${racks.length} racks chargés pour la vue 3D`);

        res.json({
            success: true,
            data: racks,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Erreur API 3D:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            code: '3D_DATA_ERROR'
        });
    }
});

/**
 * GET /api/vuestock/level/:id
 * Récupère un niveau spécifique avec détails complets
 */
router.get('/level/:id', async (req, res) => {
    try {
        const levelId = req.params.id;

        const query = `
            SELECT
                l.*,
                r.rack_code,
                r.position_x,
                r.position_y,
                json_agg(
                    json_build_object(
                        'id', s.id,
                        'slot_code', s.slot_code,
                        'full_code', s.full_code,
                        'capacity', s.capacity,
                        'status', s.status,
                        'dimensions', COALESCE(s.dimensions, '{}'::jsonb),
                        'articles', COALESCE(
                            (SELECT json_agg(
                                json_build_object(
                                    'id', a.id,
                                    'name', a.name,
                                    'code', a.code,
                                    'quantity', sa.quantity,
                                    'unit', a.unit,
                                    'barcode', a.barcode,
                                    'min_stock', a.min_stock,
                                    'max_stock', a.max_stock,
                                    'last_movement', sa.updated_at
                                )
                            )
                            FROM stock_articles sa
                            JOIN articles a ON a.id = sa.article_id
                            WHERE sa.slot_id = s.id
                            AND sa.quantity > 0),
                            '[]'::json
                        )
                    ) ORDER BY s.display_order
                ) as slots
            FROM w_vuestock_levels l
            JOIN w_vuestock_racks r ON r.id = l.rack_id
            LEFT JOIN w_vuestock_slots s ON s.level_id = l.id
            WHERE l.id = $1
            AND l.is_active = true
            GROUP BY l.id, r.id;
        `;

        const result = await pool.query(query, [levelId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Niveau non trouvé'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('❌ Erreur récupération niveau:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/vuestock/slot/:slotId/article/:articleId
 * Met à jour la quantité d'un article dans un slot
 */
router.put('/slot/:slotId/article/:articleId', async (req, res) => {
    const { slotId, articleId } = req.params;
    const { quantity, user_id, notes } = req.body;

    if (quantity === undefined || quantity < 0) {
        return res.status(400).json({
            success: false,
            error: 'Quantité invalide'
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Vérifier si l'entrée existe
        const checkQuery = `
            SELECT id, quantity as old_quantity
            FROM stock_articles
            WHERE slot_id = $1 AND article_id = $2
        `;

        const checkResult = await client.query(checkQuery, [slotId, articleId]);

        let stockEntryId;
        let oldQuantity = 0;

        if (checkResult.rows.length > 0) {
            // Mise à jour existante
            stockEntryId = checkResult.rows[0].id;
            oldQuantity = checkResult.rows[0].old_quantity;

            if (quantity === 0) {
                // Supprimer si quantité = 0
                await client.query(
                    'DELETE FROM stock_articles WHERE id = $1',
                    [stockEntryId]
                );
            } else {
                // Mettre à jour
                await client.query(
                    `UPDATE stock_articles
                     SET quantity = $1, updated_at = NOW()
                     WHERE id = $2`,
                    [quantity, stockEntryId]
                );
            }
        } else if (quantity > 0) {
            // Nouvelle entrée
            const insertResult = await client.query(
                `INSERT INTO stock_articles
                 (slot_id, article_id, quantity, created_at, updated_at)
                 VALUES ($1, $2, $3, NOW(), NOW())
                 RETURNING id`,
                [slotId, articleId, quantity]
            );

            stockEntryId = insertResult.rows[0].id;
        }

        // 2. Enregistrer l'historique
        if (stockEntryId && oldQuantity !== quantity) {
            await client.query(
                `INSERT INTO stock_movements
                 (stock_article_id, old_quantity, new_quantity, user_id, notes, movement_type)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    stockEntryId,
                    oldQuantity,
                    quantity,
                    user_id || null,
                    notes || `Mise à jour depuis interface 3D`,
                    'MANUAL_ADJUSTMENT'
                ]
            );
        }

        // 3. Mettre à jour le statut du slot
        const slotStatusQuery = `
            UPDATE w_vuestock_slots s
            SET
                status = CASE
                    WHEN total_qty = 0 THEN 'free'
                    WHEN total_qty >= s.capacity THEN 'occupied'
                    ELSE 'partial'
                END,
                updated_at = NOW()
            FROM (
                SELECT
                    s2.id,
                    COALESCE(SUM(sa.quantity), 0) as total_qty,
                    s2.capacity
                FROM w_vuestock_slots s2
                LEFT JOIN stock_articles sa ON sa.slot_id = s2.id
                WHERE s2.id = $1
                GROUP BY s2.id, s2.capacity
            ) stats
            WHERE s.id = stats.id;
        `;

        await client.query(slotStatusQuery, [slotId]);

        await client.query('COMMIT');

        // 4. Récupérer les données mises à jour
        const updatedQuery = `
            SELECT
                s.*,
                COALESCE(
                    (SELECT json_agg(
                        json_build_object(
                            'id', a.id,
                            'name', a.name,
                            'quantity', sa.quantity
                        )
                    )
                    FROM stock_articles sa
                    JOIN articles a ON a.id = sa.article_id
                    WHERE sa.slot_id = s.id),
                    '[]'::json
                ) as articles
            FROM w_vuestock_slots s
            WHERE s.id = $1;
        `;

        const updatedResult = await client.query(updatedQuery, [slotId]);

        res.json({
            success: true,
            data: updatedResult.rows[0],
            message: 'Quantité mise à jour avec succès'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erreur mise à jour quantité:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
});

/**
 * POST /api/vuestock/level-interaction
 * Enregistre une interaction avec un niveau (ouverture/fermeture)
 */
router.post('/level-interaction', async (req, res) => {
    const { level_id, action, duration_ms, user_id } = req.body;

    try {
        await pool.query(
            `INSERT INTO level_interactions
             (level_id, action, duration_ms, user_id, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [level_id, action, duration_ms, user_id]
        );

        res.json({
            success: true,
            message: 'Interaction enregistrée'
        });

    } catch (error) {
        console.error('❌ Erreur enregistrement interaction:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/vuestock/search-article
 * Recherche un article dans tout le stock
 */
router.get('/search-article', async (req, res) => {
    const { q } = req.query;

    if (!q || q.length < 2) {
        return res.status(400).json({
            success: false,
            error: 'Terme de recherche trop court'
        });
    }

    try {
        const query = `
            SELECT
                a.id,
                a.name,
                a.code,
                a.barcode,
                s.slot_code,
                s.full_code,
                l.level_code,
                r.rack_code,
                r.position_x,
                r.position_y,
                sa.quantity,
                s.capacity,
                ROUND((sa.quantity::float / s.capacity::float) * 100) as fill_percentage
            FROM articles a
            JOIN stock_articles sa ON sa.article_id = a.id
            JOIN w_vuestock_slots s ON s.id = sa.slot_id
            JOIN w_vuestock_levels l ON l.id = s.level_id
            JOIN w_vuestock_racks r ON r.id = l.rack_id
            WHERE (
                a.name ILIKE $1 OR
                a.code ILIKE $1 OR
                a.barcode ILIKE $1
            )
            AND sa.quantity > 0
            ORDER BY sa.quantity DESC
            LIMIT 50;
        `;

        const searchTerm = `%${q}%`;
        const result = await pool.query(query, [searchTerm]);

        res.json({
            success: true,
            data: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error('❌ Erreur recherche article:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/vuestock/stats
 * Statistiques pour le dashboard 3D
 */
router.get('/stats', async (req, res) => {
    try {
        const query = `
            SELECT
                (SELECT COUNT(*) FROM w_vuestock_racks) as total_racks,
                (SELECT COUNT(*) FROM w_vuestock_levels WHERE is_active = true) as total_levels,
                (SELECT COUNT(*) FROM w_vuestock_slots) as total_slots,
                (SELECT COUNT(*) FROM w_vuestock_slots WHERE status = 'occupied') as occupied_slots,
                (SELECT COUNT(*) FROM w_vuestock_slots WHERE status = 'partial') as partial_slots,
                (SELECT COUNT(*) FROM w_vuestock_slots WHERE status = 'free') as free_slots,
                (SELECT COALESCE(SUM(quantity), 0) FROM stock_articles) as total_items,
                (SELECT COUNT(DISTINCT article_id) FROM stock_articles) as unique_articles;
        `;

        const result = await pool.query(query);

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('❌ Erreur statistiques:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;