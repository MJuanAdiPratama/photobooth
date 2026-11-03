<?php
/**
 * Qxuan Photobooth - Polling Status Pembayaran
 * Endpoint GET untuk memeriksa apakah pembayaran QRIS sudah sukses ('paid').
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

$orderId = $_GET['order_id'] ?? '';

if (empty($orderId)) {
    jsonResponse(false, 'Parameter order_id wajib disertakan.', [], 400);
}

$transaction = Database::getTransaction($orderId);

if (!$transaction) {
    jsonResponse(false, 'Transaksi tidak ditemukan.', [
        'order_id' => $orderId,
        'status'   => 'not_found'
    ], 404);
}

$isPaid = ($transaction['status'] === 'paid');

jsonResponse(true, 'Status transaksi berhasil diambil', [
    'order_id'       => $transaction['order_id'],
    'status'         => $transaction['status'],
    'is_paid'        => $isPaid,
    'amount'         => (float)$transaction['amount'],
    'photo_url'      => $transaction['photo_url'] ?? null,
    'updated_at'     => $transaction['updated_at'] ?? $transaction['created_at']
]);

