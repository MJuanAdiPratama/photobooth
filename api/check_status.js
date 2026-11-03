/**
 * Vercel Serverless Function: Check Payment Status
 * Endpoint: GET /api/check_status?order_id=...
 * Hardened with Input Validation & Security Sanitation
 */

const { supabase, isSupabaseConfigured, getLocalTx } = require('./supabase');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const orderId = req.query.order_id || (req.body && req.body.order_id);

    // Validasi regex order_id untuk mencegah eksploitasi
    if (!orderId || !/^[A-Za-z0-9\-_]{10,64}$/.test(orderId)) {
        return res.status(400).json({
            success: false,
            message: 'Parameter order_id tidak valid atau tidak disertakan.'
        });
    }

    let transaction = null;

    // Prioritas 1: Supabase Database jika sudah terhubung
    if (isSupabaseConfigured()) {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('order_id', orderId)
                .single();

            if (!error && data) {
                transaction = data;
            }
        } catch (e) {
            console.error('[Supabase Check Status Error]', e);
        }
    }

    // Prioritas 2: Local cache fallback
    if (!transaction) {
        transaction = getLocalTx(orderId);
    }

    if (!transaction) {
        return res.status(404).json({
            success: false,
            message: 'Transaksi belum ditemukan.',
            data: { order_id: orderId, status: 'not_found' }
        });
    }

    const isPaid = (transaction.status === 'paid');

    return res.status(200).json({
        success: true,
        message: 'Status transaksi berhasil diambil',
        data: {
            order_id: transaction.order_id,
            status: transaction.status,
            is_paid: isPaid,
            amount: Number(transaction.amount),
            photo_url: transaction.photo_url || null,
            updated_at: transaction.updated_at || transaction.created_at
        },
        timestamp: new Date().toISOString()
    });
};
