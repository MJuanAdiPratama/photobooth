<?php
/**
 * Qxuan Photobooth - Configuration Settings
 * File ini memuat pengaturan Database MySQL, Midtrans Gateway, & Temporary Storage TTL.
 */

// Laporkan error saat development (ubah ke 0 di production)
error_reporting(E_ALL);
ini_set('display_errors', '0');

// Header CORS standar untuk komunikasi AJAX frontend
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ---------------------------------------------------------------------
// 1. DATABASE MYSQL CONFIGURATION
// ---------------------------------------------------------------------
define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'qxuan_photobooth');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: ''); // Default Laragon / XAMPP kosong

// ---------------------------------------------------------------------
// 2. MIDTRANS PAYMENT GATEWAY CONFIGURATION
// ---------------------------------------------------------------------
// Set true jika sudah live production, false jika masih sandbox testing
define('MIDTRANS_IS_PRODUCTION', false);

// Masukkan Server Key & Client Key dari Dashboard Midtrans Anda
// Sandbox key biasanya diawali "SB-Mid-server-..."
define('MIDTRANS_SERVER_KEY', getenv('MIDTRANS_SERVER_KEY') ?: 'SB-Mid-server-YOUR_SERVER_KEY_HERE');
define('MIDTRANS_CLIENT_KEY', getenv('MIDTRANS_CLIENT_KEY') ?: 'SB-Mid-client-YOUR_CLIENT_KEY_HERE');

// Base URL Endpoint Midtrans
define('MIDTRANS_API_URL', MIDTRANS_IS_PRODUCTION 
    ? 'https://api.midtrans.com/v2' 
    : 'https://api.sandbox.midtrans.com/v2');

// Harga per sesi photobooth (Rp 25.000)
define('PHOTOBOOTH_PRICE', 25000);

// Mode Demo: Jika true, mengizinkan tombol simulasi bayar sukses di UI (sangat berguna untuk testing lokal tanpa ngrok)
define('ALLOW_DEMO_PAYMENT', true);

// ---------------------------------------------------------------------
// 3. TEMPORARY STORAGE CONFIGURATION (TTL 24 JAM)
// ---------------------------------------------------------------------
// Driver: 'local' atau 'supabase'
// Jika supabase credentials belum diisi, otomatis fallback ke 'local'
define('STORAGE_TTL_HOURS', 24); // Otomatis hapus setelah 24 jam demi privasi
define('LOCAL_STORAGE_DIR', realpath(__DIR__ . '/../storage/temp_photos') ?: __DIR__ . '/../storage/temp_photos');

// Supabase Storage Configuration (Opsional / Integration-ready)
define('SUPABASE_URL', getenv('SUPABASE_URL') ?: ''); 
define('SUPABASE_SERVICE_ROLE_KEY', getenv('SUPABASE_SERVICE_ROLE_KEY') ?: '');
define('SUPABASE_BUCKET', getenv('SUPABASE_BUCKET') ?: 'photobooth-temp');

// Helper function untuk mengirim respon JSON
function jsonResponse(bool $success, string $message, array $data = [], int $httpCode = 200): void {
    http_response_code($httpCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success'   => $success,
        'message'   => $message,
        'data'      => $data,
        'timestamp' => date('c')
    ], JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

