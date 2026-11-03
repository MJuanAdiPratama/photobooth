<?php
/**
 * Qxuan Photobooth - Midtrans Webhook Callback Handler
 * Menerima notifikasi HTTP POST dari Midtrans saat status pembayaran berubah (Settlement/Expire/Cancel).
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// Pastikan request adalah POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Hanya menerima request POST webhook.', [], 405);
}

$rawInput = file_get_contents('php://input');
$notification = json_decode($rawInput, true);

if (!$notification || !isset($notification['order_id'], $notification['status_code'], $notification['gross_amount'])) {
    jsonResponse(false, 'Payload webhook tidak valid.', [], 400);
}

$orderId           = $notification['order_id'];
$statusCode        = $notification['status_code'];
$grossAmount       = $notification['gross_amount'];
$signatureKey      = $notification['signature_key'] ?? '';
$transactionStatus = $notification['transaction_status'] ?? '';
$fraudStatus       = $notification['fraud_status'] ?? '';
$transactionId     = $notification['transaction_id'] ?? null;

// Verifikasi SHA512 Signature Hash dari Midtrans
// Format: SHA512(order_id + status_code + gross_amount + ServerKey)
$expectedSignature = hash('sha512', $orderId . $statusCode . $grossAmount . MIDTRANS_SERVER_KEY);

$serverKey = MIDTRANS_SERVER_KEY;
$isKeyConfigured = !empty($serverKey) && strpos($serverKey, 'YOUR_SERVER_KEY') === false;

if ($isKeyConfigured && $signatureKey !== $expectedSignature) {
    error_log("[Webhook Alert] Invalid signature for Order ID: {$orderId}");
    jsonResponse(false, 'Signature key tidak valid.', [], 403);
}

// Tentukan status pembayaran internal photobooth
$newStatus = 'pending';

if ($transactionStatus === 'settlement' || $transactionStatus === 'capture') {
    if ($fraudStatus === 'challenge') {
        $newStatus = 'pending';
    } else {
        $newStatus = 'paid';
    }
} elseif (in_array($transactionStatus, ['cancel', 'deny'])) {
    $newStatus = 'failed';
} elseif ($transactionStatus === 'expire') {
    $newStatus = 'expired';
}

// Update status di database MySQL / Local Cache
Database::updateStatus($orderId, $newStatus, $transactionId);

// Kirim respon sukses ke Midtrans
jsonResponse(true, 'Webhook berhasil diproses', [
    'order_id'       => $orderId,
    'status'         => $newStatus,
    'midtrans_status'=> $transactionStatus
], 200);

