/**
 * Vercel Serverless Function / Cron Job: Purge Expired Photos (24h TTL)
 * Endpoint: GET /api/cron_cleanup
 */

const { supabase, isSupabaseConfigured } = require('./supabase');

const BUCKET_NAME = process.env.SUPABASE_BUCKET || 'photobooth-temp';

module.exports = async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.status(500).json({ success: false, message: 'Supabase tidak terkonfigurasi.' });
    }

    try {
        // 1. Coba panggil Stored Procedure SQL Supabase jika tersedia
        const { data: rpcCount, error: rpcErr } = await supabase.rpc('delete_expired_photobooth_photos');

        if (!rpcErr && rpcCount !== null) {
            return res.status(200).json({
                success: true,
                message: `Pembersihan berhasil via RPC. ${rpcCount} foto dihapus.`,
                purged_count: rpcCount
            });
        }

        // 2. Fallback: iterasi file via Supabase Storage API
        const { data: files, error: listErr } = await supabase.storage
            .from(BUCKET_NAME)
            .list('', { limit: 100, sortBy: { column: 'created_at', order: 'asc' } });

        if (listErr) throw listErr;

        const now = Date.now();
        const ttlMs = 24 * 60 * 60 * 1000;
        const expiredFiles = [];

        (files || []).forEach(f => {
            if (f.created_at && (now - new Date(f.created_at).getTime() > ttlMs)) {
                expiredFiles.push(f.name);
            }
        });

        if (expiredFiles.length > 0) {
            await supabase.storage.from(BUCKET_NAME).remove(expiredFiles);
        }

        return res.status(200).json({
            success: true,
            message: `Pembersihan otomatis selesai. ${expiredFiles.length} file kadaluarsa dihapus.`,
            purged_count: expiredFiles.length
        });
    } catch (err) {
        console.error('[Cleanup Error]', err);
        return res.status(500).json({ success: false, error: err.message });
    }
};

