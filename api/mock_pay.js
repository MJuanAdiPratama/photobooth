/**
 * Vercel Serverless Function: Dev Mode Instant Payment Simulation
 * Endpoint: POST /api/mock_pay
 * Fitur Keamanan: Hanya diizinkan jika ALLOW_DEMO_PAYMENT=true atau dalam mode development lokal.
 */

const { supabase, isSupabaseConfigured, saveLocalTx } = require('./supabase');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Metode harus POST.' });
    }

    // Proteksi Keamanan Produksi: Cegah eksploitasi bypass pembayaran di website live
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
    const isDemoAllowed = process.env.ALLOW_DEMO_PAYMENT === 'true' || (!isProd && process.env.ALLOW_DEMO_PAYMENT !== 'false');

    if (!isDemoAllowed) {
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak. Simulasi pembayaran dinonaktifkan di environment produksi demi keamanan.'
        });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const orderId = body.order_id || req.query.order_id;

    // Validasi format Order ID agar mencegah injeksi
    if (!orderId || !/^[A-Za-z0-9\-_]{10,64}$/.test(orderId)) {
        return res.status(400).json({ success: false, message: 'Format parameter order_id tidak valid.' });
    }

    const fakeTxId = `SIM-${Math.random().toString(36).substring(2, 12).toUpperCase()}`;

    // Update Local Cache
    saveLocalTx(orderId, {
        status: 'paid',
        transaction_id: fakeTxId,
        updated_at: new Date().toISOString()
    });

    // Update Supabase jika aktif
    if (isSupabaseConfigured()) {
        try {
            const { error } = await supabase
                .from('transactions')
                .update({
                    status: 'paid',
                    transaction_id: fakeTxId,
                    updated_at: new Date().toISOString()
                })
                .eq('order_id', orderId);

            if (error) {
                console.error('[Supabase Mock Pay Error]', error);
            }
        } catch (e) {
            console.error('[Supabase Mock Pay Exception]', e);
        }
    }

    return res.status(200).json({
        success: true,
        message: 'Simulasi pembayaran sukses berhasil diaktifkan!',
        data: {
            order_id: orderId,
            transaction_id: fakeTxId,
            status: 'paid'
        },
        timestamp: new Date().toISOString()
    });
};
