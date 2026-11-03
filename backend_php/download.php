<?php
/**
 * Qxuan Photobooth - Secure Photo Download with TTL Verification
 * Menjamin file foto hanya dapat diakses dalam kurun waktu 24 jam.
 */

require_once __DIR__ . '/config.php';

$fileName = $_GET['file'] ?? '';

// Validasi nama file agar mencegah Path Traversal attack
if (empty($fileName) || !preg_match('/^QXUAN_[a-f0-9]{16}_\d+\.(png|jpg|webp)$/i', $fileName)) {
    http_response_code(400);
    die('Nama file tidak valid.');
}

$filePath = LOCAL_STORAGE_DIR . DIRECTORY_SEPARATOR . $fileName;

if (!file_exists($filePath)) {
    http_response_code(404);
    die('Foto tidak ditemukan atau sudah dibersihkan dari server.');
}

// Cek apakah file sudah melampaui TTL 24 jam
$fileAge = time() - filemtime($filePath);
$ttlLimit = STORAGE_TTL_HOURS * 3600;

if ($fileAge > $ttlLimit) {
    @unlink($filePath); // Hapus seketika
    http_response_code(410);
    ?>
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tautan Kadaluarsa - Qxuan Photobooth</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-stone-50 text-stone-800 min-h-screen flex items-center justify-center p-6">
        <div class="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-stone-200 text-center">
            <div class="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-500">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <h1 class="text-xl font-medium tracking-tight mb-2">Tautan Telah Kadaluarsa</h1>
            <p class="text-sm text-stone-500 leading-relaxed mb-6">
                Demi menjaga privasi Anda, Qxuan Photobooth menerapkan kebijakan Auto-Delete 24 jam. File foto ini telah dimusnahkan secara permanen dari server.
            </p>
            <p class="text-xs text-stone-400">Qxuan Photobooth • Privacy First</p>
        </div>
    </body>
    </html>
    <?php
    exit;
}

// Deteksi MIME type
$extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
$mimeTypes = [
    'png'  => 'image/png',
    'jpg'  => 'image/jpeg',
    'webp' => 'image/webp'
];
$mime = $mimeTypes[$extension] ?? 'application/octet-stream';

// Sajikan file untuk ditampilkan atau diunduh
header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($filePath));
header('Cache-Control: private, max-age=3600');
header('Content-Disposition: inline; filename="' . $fileName . '"');
readfile($filePath);
exit;

