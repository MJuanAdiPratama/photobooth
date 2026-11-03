/**
 * Vercel Serverless Function: Upload Photo to Supabase Storage (TTL 24 Jam)
 * Endpoint: POST /api/upload_temp
 * Hardened with Input Validation, Size Limits, and Path Sanitation
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { supabase, isSupabaseConfigured, saveLocalTx } = require('./supabase');

const BUCKET_NAME = process.env.SUPABASE_BUCKET || 'photobooth-temp';
const LOCAL_STORAGE_DIR = path.join(__dirname, '..', 'storage', 'temp_photos');
const MAX_BASE64_LENGTH = 28 * 1024 * 1024; // Maksimum 28MB base64 (~20MB binary)
const ALLOWED_EXTS = ['png', 'jpg', 'jpeg', 'webp'];

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Gunakan metode POST.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const imageData = body.image_data;
    const orderId = body.order_id;
    let format = String(body.format || 'png').toLowerCase();

    // 1. Validasi Keberadaan Data
    if (!imageData || typeof imageData !== 'string') {
        return res.status(400).json({ success: false, message: 'Data gambar (base64) wajib disertakan.' });
    }

    // 2. Proteksi DoS Ukuran Berkas
    if (imageData.length > MAX_BASE64_LENGTH) {
        return res.status(413).json({ success: false, message: 'Ukuran file gambar melampaui batas maksimum (20 MB).' });
    }

    // 3. Validasi Order ID
    if (orderId && !/^[A-Za-z0-9\-_]{10,64}$/.test(orderId)) {
        return res.status(400).json({ success: false, message: 'Format order_id tidak valid.' });
    }

    // 4. Ekstrak dan Sanitasi Binary Data
    let base64Clean = imageData;
    const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (matches) {
        format = matches[1] === 'jpeg' ? 'jpg' : matches[1].toLowerCase();
        base64Clean = matches[2];
    }

    if (!ALLOWED_EXTS.includes(format)) {
        format = 'png';
    }

    let buffer;
    try {
        buffer = Buffer.from(base64Clean, 'base64');
    } catch {
        return res.status(400).json({ success: false, message: 'Gagal mendekode gambar base64.' });
    }

    const token = crypto.randomBytes(8).toString('hex');
    const nowSec = Math.floor(Date.now() / 1000);
    const fileName = `QXUAN_${token}_${nowSec}.${format}`;
    const mimeType = format === 'jpg' ? 'image/jpeg' : `image/${format}`;

    let publicUrl = '';
    let storageDriver = 'local_temp';

    // Prioritas 1: Unggah ke Supabase Storage
    if (isSupabaseConfigured()) {
        try {
            supabase.rpc('delete_expired_photobooth_photos').catch(() => {});

            const { data: uploadData, error: uploadErr } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(fileName, buffer, {
                    contentType: mimeType,
                    cacheControl: '3600',
                    upsert: true
                });

            if (!uploadErr) {
                const { data: urlData } = supabase.storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(fileName);

                publicUrl = urlData.publicUrl;
                storageDriver = 'supabase';

                if (orderId) {
                    await supabase
                        .from('transactions')
                        .update({
                            photo_url: publicUrl,
                            updated_at: new Date().toISOString()
                        })
                        .eq('order_id', orderId);
                }
            } else {
                console.warn('[Supabase Storage Upload Warning, fallback ke lokal]', uploadErr);
            }
        } catch (storageErr) {
            console.warn('[Storage Exception, fallback ke lokal]', storageErr);
        }
    }

    // Prioritas 2: Fallback Lokal untuk testing lokal
    if (!publicUrl) {
        try {
            if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
                fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
            }
            const localFilePath = path.join(LOCAL_STORAGE_DIR, fileName);
            fs.writeFileSync(localFilePath, buffer);

            const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
            const host = req.get('host') || 'localhost:8000';
            publicUrl = `${protocol}://${host}/storage/temp_photos/${fileName}`;
            storageDriver = 'local_disk';
        } catch (localErr) {
            console.error('[Local Storage Error]', localErr);
        }
    }

    if (orderId) {
        saveLocalTx(orderId, { photo_url: publicUrl });
    }

    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    return res.status(200).json({
        success: true,
        message: 'Foto berhasil disimpan sementara (Auto-delete TTL 24 jam)',
        data: {
            file_name: fileName,
            download_url: publicUrl,
            storage_driver: storageDriver,
            ttl_hours: 24,
            expires_at: expiresAt
        },
        timestamp: new Date().toISOString()
    });
};
