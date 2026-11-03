/**
 * Vercel Serverless Function: Midtrans Webhook Callback Handler
 * Endpoint: POST /api/webhook_callback
 */

const crypto = require('crypto');
const { supabase, isSupabaseConfigured } = require('./supabase');

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || '';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Hanya menerima request POST webhook.' });
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const orderId = payload.order_id;
    const statusCode = payload.status_code;
    const grossAmount = payload.gross_amount;
    const signatureKey = payload.signature_key;
    const transactionStatus = payload.transaction_status;
    const fraudStatus = payload.fraud_status;
    const transactionId = payload.transaction_id;

    if (!orderId || !statusCode || !grossAmount) {
        return res.status(400).json({ success: false, message: 'Payload webhook tidak valid.' });
    }

    // Verifikasi Signature SHA512 jika Server Key terpasang
    if (MIDTRANS_SERVER_KEY && !MIDTRANS_SERVER_KEY.includes('YOUR_SERVER_KEY')) {
        const expectedSignature = crypto
            .createHash('sha512')
            .update(`${orderId}${statusCode}${grossAmount}${MIDTRANS_SERVER_KEY}`)
            .digest('hex');

        if (signatureKey !== expectedSignature) {
            console.warn(`[Webhook Alert] Invalid signature for Order ID: ${orderId}`);
            return res.status(403).json({ success: false, message: 'Signature key tidak valid.' });
        }
    }

    let newStatus = 'pending';
    if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
        newStatus = (fraudStatus === 'challenge') ? 'pending' : 'paid';
    } else if (['cancel', 'deny'].includes(transactionStatus)) {
        newStatus = 'failed';
    } else if (transactionStatus === 'expire') {
        newStatus = 'expired';
    }

    if (isSupabaseConfigured()) {
        try {
            await supabase
                .from('transactions')
                .update({
                    status: newStatus,
                    transaction_id: transactionId,
                    updated_at: new Date().toISOString()
                })
                .eq('order_id', orderId);
        } catch (dbErr) {
            console.error('[Supabase Webhook Update Error]', dbErr);
        }
    }

    return res.status(200).json({
        success: true,
        message: 'Webhook Midtrans berhasil diproses',
        data: {
            order_id: orderId,
            status: newStatus,
            midtrans_status: transactionStatus
        }
    });
};

