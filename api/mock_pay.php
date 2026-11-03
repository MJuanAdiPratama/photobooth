<?php
/**
 * Qxuan Photobooth - Sandbox/Dev Mock Payment Settlement
 * Digunakan saat pengujian lokal/sandbox agar tombol unduh & cetak bisa dibuka
 * tanpa harus memasang webhook tunnel publik (ngrok) di mesin lokal.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

if (!ALLOW_DEMO_PAYMENT) {
    jsonResponse(false, 'Mode simulasi pembayaran dinonaktifkan di environment ini.', [], 403);
}

$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput, true) ?: [];

$orderId = $payload['order_id'] ?? $_GET['order_id'] ?? '';

if (empty($orderId)) {
    jsonResponse(false, 'Parameter order_id wajib disertakan.', [], 400);
}

$fakeTxId = 'SIM-' . strtoupper(substr(md5($orderId . time()), 0, 16));
$updated = Database::updateStatus($orderId, 'paid', $fakeTxId);

if ($updated) {
    jsonResponse(true, 'Simulasi pembayaran sukses berhasil diaktifkan!', [
        'order_id'       => $orderId,
        'transaction_id' => $fakeTxId,
        'status'         => 'paid'
    ]);
} else {
    jsonResponse(false, 'Gagal memperbarui status transaksi.', [], 500);
}

