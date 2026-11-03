/**
 * Vercel Serverless Function: Create Midtrans QRIS Payment
 * Endpoint: POST /api/create_payment
 * Hardened with Input Validation & Security Sanitation
 */

const { supabase, isSupabaseConfigured, saveLocalTx } = require('./supabase');

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-YOUR_SERVER_KEY_HERE';
const MIDTRANS_IS_PROD = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const MIDTRANS_URL = MIDTRANS_IS_PROD ? 'https://api.midtrans.com/v2' : 'https://api.sandbox.midtrans.com/v2';
const DEFAULT_PRICE = 10000;

const ALLOWED_LAYOUTS = ['single', 'collage_2x1', 'collage_2x2', 'collage_3x1'];
const ALLOWED_RATIOS  = ['1:1', '4:3', '16:9', '3:4', '9:16'];

module.exports = async (req, res) => {
    // Security & CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Gunakan metode POST.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    
    // Sanitasi & Validasi Input
    let amount = Number(body.amount) || DEFAULT_PRICE;
    amount = Math.min(10000000, Math.max(1000, amount)); // Batasi rentang nominal wajar (Rp 1.000 - Rp 10.000.000)

    const rawLayout = String(body.layout_mode || 'single').toLowerCase();
    const layoutMode = ALLOWED_LAYOUTS.includes(rawLayout) ? rawLayout : 'single';

    const rawRatio = String(body.aspect_ratio || '4:3');
    const aspectRatio = ALLOWED_RATIOS.includes(rawRatio) ? rawRatio : '4:3';

    const filterName = String(body.filter || 'normal').substring(0, 32);

    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const orderId = `QXUAN-${timestamp}-${Math.floor(1000 + Math.random() * 9000)}`;

    let qrisUrl = null;
    let qrString = null;
    let transactionId = null;
    let isLive = false;

    // Cek koneksi ke Midtrans Core API
    const hasValidKey = MIDTRANS_SERVER_KEY && !MIDTRANS_SERVER_KEY.includes('YOUR_SERVER_KEY');
    if (hasValidKey) {
        try {
            const authHeader = Buffer.from(MIDTRANS_SERVER_KEY + ':').toString('base64');
            const mtResp = await fetch(`${MIDTRANS_URL}/charge`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${authHeader}`
                },
                body: JSON.stringify({
                    payment_type: 'qris',
                    transaction_details: {
                        order_id: orderId,
                        gross_amount: amount
                    },
                    qris: { acquirer: 'gopay' },
                    item_details: [{
                        id: 'photobooth-session',
                        price: amount,
                        quantity: 1,
                        name: `Qxuan Photobooth (${layoutMode.toUpperCase()})`
                    }]
                })
            });

            const mtData = await mtResp.json();
            if (mtResp.ok && (mtData.status_code === '201' || mtData.status_code === '200')) {
                transactionId = mtData.transaction_id || null;
                qrString = mtData.qr_string || null;

                if (Array.isArray(mtData.actions)) {
                    const qrAction = mtData.actions.find(a => a.name === 'generate-qr-code');
                    if (qrAction) qrisUrl = qrAction.url;
                }
                isLive = true;
            }
        } catch (err) {
            console.warn('[Midtrans Request Failed, menggunakan fallback QRIS]', err);
        }
    }

    // Fallback QRIS Dummy untuk keperluan Sandbox/Dev testing
    if (!isLive) {
        qrString = `00020101021226680016ID.CO.QXUAN.WWW011893600999${Date.now()}520458125303360540${amount}5802ID5916QXUAN PHOTOBOOTH6007JAKARTA62070703A016304ABCD`;
        qrisUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(qrString)}`;
    }

    // Simpan ke Cache Lokal
    saveLocalTx(orderId, {
        order_id: orderId,
        transaction_id: transactionId,
        amount: amount,
        status: 'pending',
        payment_type: 'qris',
        qris_url: qrisUrl,
        qr_string: qrString,
        layout_mode: layoutMode,
        aspect_ratio: aspectRatio,
        filter: filterName,
        created_at: new Date().toISOString()
    });

    // Simpan metadata ke Supabase Database jika sudah terhubung
    const metadata = { layout_mode: layoutMode, aspect_ratio: aspectRatio, filter: filterName, is_mock: !isLive };

    if (isSupabaseConfigured()) {
        try {
            const { error: dbError } = await supabase.from('transactions').insert({
                order_id: orderId,
                transaction_id: transactionId,
                amount: amount,
                status: 'pending',
                payment_type: 'qris',
                qris_url: qrisUrl,
                qr_string: qrString,
                photo_metadata: metadata
            });

            if (dbError) {
                console.error('[Supabase Insert Error]', dbError);
            }
        } catch (dbEx) {
            console.error('[Supabase Ex]', dbEx);
        }
    }

    return res.status(200).json({
        success: true,
        message: 'Tagihan QRIS berhasil dibuat',
        data: {
            order_id: orderId,
            transaction_id: transactionId,
            amount: amount,
            currency: 'IDR',
            status: 'pending',
            qris_url: qrisUrl,
            qr_string: qrString,
            is_live: isLive,
            expires_in_sec: 900
        },
        timestamp: new Date().toISOString()
    });
};
