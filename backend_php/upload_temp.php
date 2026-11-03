<?php
/**
 * Qxuan Photobooth - Temporary Photo Uploader with 24-Hour TTL Auto-Delete
 * Menangani penyimpanan sementara foto kolase HD (Supabase Storage ready / Local Temp Fallback)
 * Sesuai prinsip privasi: File otomatis dimusnahkan setelah 24 jam dan TIDAK disimpan sebagai BLOB di MySQL.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Hanya menerima request POST.', [], 405);
}

// -------------------------------------------------------------
// 1. ROUTINE AUTO-DELETE FILE LOKAL YANG SUDAH LEBIH DARI 24 JAM
// -------------------------------------------------------------
$storageDir = LOCAL_STORAGE_DIR;
if (!is_dir($storageDir)) {
    @mkdir($storageDir, 0755, true);
}

$ttlSeconds = STORAGE_TTL_HOURS * 3600;
$now = time();

if (is_dir($storageDir)) {
    $files = scandir($storageDir);
    foreach ($files as $file) {
        if ($file === '.' || $file === '..' || $file === '.gitkeep') {
            continue;
        }
        $filePath = $storageDir . DIRECTORY_SEPARATOR . $file;
        if (is_file($filePath)) {
            $fileAge = $now - filemtime($filePath);
            if ($fileAge > $ttlSeconds) {
                @unlink($filePath); // Otomatis hapus file kadaluarsa
            }
        }
    }
}

// -------------------------------------------------------------
// 2. PARSE DATA GAMBAR DARI PAYLOAD
// -------------------------------------------------------------
$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput, true) ?: [];

$imageData = $payload['image_data'] ?? '';
$orderId   = $payload['order_id'] ?? '';
$format    = strtolower($payload['format'] ?? 'png');

if (empty($imageData)) {
    jsonResponse(false, 'Data gambar (base64) tidak ditemukan.', [], 400);
}

// Ekstrak base64 binary data
if (preg_match('/^data:image\/(\w+);base64,/', $imageData, $matches)) {
    $detectedFormat = strtolower($matches[1]);
    if (in_array($detectedFormat, ['png', 'jpeg', 'jpg', 'webp'])) {
        $format = ($detectedFormat === 'jpeg') ? 'jpg' : $detectedFormat;
    }
    $imageData = substr($imageData, strpos($imageData, ',') + 1);
}

$binaryData = base64_decode($imageData);
if (!$binaryData) {
    jsonResponse(false, 'Gagal mendekode gambar base64.', [], 400);
}

// Buat nama file unik yang aman
$uniqueToken = bin2hex(random_bytes(8));
$fileName = sprintf('QXUAN_%s_%d.%s', $uniqueToken, $now, $format);
$localFilePath = $storageDir . DIRECTORY_SEPARATOR . $fileName;

// Simpan file sementara ke local storage
if (file_put_contents($localFilePath, $binaryData) === false) {
    jsonResponse(false, 'Gagal menyimpan file sementara ke disk.', [], 500);
}

// Tentukan skema protokol & host untuk URL download
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
$host = $_SERVER['HTTP_HOST'] ?? 'localhost:8000';
$scriptDir = dirname($_SERVER['SCRIPT_NAME']);
$baseDownloadUrl = $protocol . $host . rtrim($scriptDir, '/\\') . '/download.php?file=' . urlencode($fileName);

$finalPublicUrl = $baseDownloadUrl;
$storageDriver = 'local_temp';

// -------------------------------------------------------------
// 3. OPSIONAL: SUPABASE STORAGE UPLOAD (Jika sudah diatur)
// -------------------------------------------------------------
$supabaseUrl = rtrim(SUPABASE_URL, '/');
$supabaseKey = SUPABASE_SERVICE_ROLE_KEY;
$supabaseBucket = SUPABASE_BUCKET;

if (!empty($supabaseUrl) && !empty($supabaseKey)) {
    $mimeType = ($format === 'jpg') ? 'image/jpeg' : 'image/' . $format;
    $uploadEndpoint = "{$supabaseUrl}/storage/v1/object/{$supabaseBucket}/{$fileName}";

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $uploadEndpoint,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $binaryData,
        CURLOPT_HTTPHEADER     => [
            "Authorization: Bearer {$supabaseKey}",
            "apiKey: {$supabaseKey}",
            "Content-Type: {$mimeType}",
            "x-upsert: true"
        ],
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => false
    ]);

    $sbResponse = curl_exec($ch);
    $sbCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($sbCode >= 200 && $sbCode < 300) {
        $storageDriver = 'supabase';
        $finalPublicUrl = "{$supabaseUrl}/storage/v1/object/public/{$supabaseBucket}/{$fileName}";
    }
}

// Update link foto di metadata order
if (!empty($orderId)) {
    Database::updatePhotoUrl($orderId, $finalPublicUrl);
}

// Kembalikan respon URL download dan waktu kadaluarsa TTL
$expiresAt = $now + $ttlSeconds;

jsonResponse(true, 'Foto berhasil diunggah ke penyimpanan sementara (TTL 24 jam)', [
    'file_name'        => $fileName,
    'download_url'     => $finalPublicUrl,
    'storage_driver'   => $storageDriver,
    'ttl_hours'        => STORAGE_TTL_HOURS,
    'expires_at'       => date('c', $expiresAt),
    'expires_timestamp'=> $expiresAt
]);

