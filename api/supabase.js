/**
 * Qxuan Photobooth - Supabase Client & Fallback Local Storage
 * Mengelola koneksi aman ke Supabase PostgreSQL & Supabase Storage,
 * dengan automatic local cache fallback agar pengujian offline/lokal selalu lancar.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase = null;

if (supabaseUrl && supabaseKey && !supabaseKey.includes('salin_dari')) {
    try {
        supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        });
    } catch (err) {
        console.error('[Supabase Init Error]', err);
    }
}

// Local Cache Fallback Helper
const cacheFile = path.join(__dirname, '..', 'storage', 'transactions_cache.json');

function readCache() {
    try {
        if (!fs.existsSync(cacheFile)) return {};
        const content = fs.readFileSync(cacheFile, 'utf8');
        return content ? JSON.parse(content) : {};
    } catch {
        return {};
    }
}

function writeCache(data) {
    try {
        fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.warn('[Cache Write Error]', e);
    }
}

function saveLocalTx(orderId, data) {
    const cache = readCache();
    cache[orderId] = { ...(cache[orderId] || {}), ...data };
    writeCache(cache);
}

function getLocalTx(orderId) {
    const cache = readCache();
    return cache[orderId] || null;
}

module.exports = {
    supabase,
    supabaseUrl,
    supabaseKey,
    isSupabaseConfigured: () => Boolean(supabase),
    saveLocalTx,
    getLocalTx
};
