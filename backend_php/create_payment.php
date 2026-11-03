<?php
/**
 * Qxuan Photobooth - Create Midtrans QRIS Payment
 * Endpoint POST untuk men-generate transaksi QRIS dinamis via Midtrans Core API.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// Pastikan request adalah POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Metode HTTP tidak diizinkan. Gunakan POST.', [], 405);
}

// Ambil input JSON dari frontend
$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput, true) ?: [];

// Parameter opsional dari frontend (layout, aspect ratio, filter yang dipilih)
$layoutMode = $payload['layout_mode'] ?? 'single';
$aspectRatio = $payload['aspect_ratio'] ?? '4:3';
$filterName = $payload['filter'] ?? 'normal';
$customAmount = isset($payload['amount']) ? (float)$payload['amount'] : (float)PHOTOBOOTH_PRICE;

// Generate Order ID Unik (Format: QXUAN-YYYYMMDD-HHMMSS-RAND)
$orderId = sprintf('QXUAN-%s-%04d', date('Ymd-His'), mt_rand(1000, 9999));
$amount = $customAmount > 0 ? $customAmount : PHOTOBOOTH_PRICE;

$qrisUrl = null;
$qrString = null;
$transactionId = null;
$isLiveMidtrans = false;

// Periksa apakah Server Key Midtrans sudah diisi (bukan default placeholder)
$serverKey = MIDTRANS_SERVER_KEY;
$hasValidMidtransKey = !empty($serverKey) && strpos($serverKey, 'YOUR_SERVER_KEY') === false;

if ($hasValidMidtransKey) {
    // Siapkan payload request ke Midtrans Core API
    $midtransBody = [
        'payment_type' => 'qris',
        'transaction_details' => [
            'order_id'     => $orderId,
            'gross_amount' => (int)$amount
        ],
        'qris' => [
            'acquirer' => 'gopay'
        ],
        'item_details' => [
            [
                'id'       => 'photobooth-session',
                'price'    => (int)$amount,
                'quantity' => 1,
                'name'     => 'Qxuan Photobooth Session (' . strtoupper($layoutMode) . ')'
            ]
        ]
    ];

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => MIDTRANS_API_URL . '/charge',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($midtransBody),
        CURLOPT_HTTPHEADER     => [
            'Accept: application/json',
            'Content-Type: application/json',
            'Authorization: Basic ' . base64_encode($serverKey . ':')
        ],
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_SSL_VERIFYPEER => false // Untuk kemudahan development di Windows/Laragon
    ]);

    $response = curl_exec($ch);
    $curlErr = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (!$curlErr && $httpCode >= 200 && $httpCode < 300) {
        $result = json_decode($response, true);
        if (isset($result['status_code']) && in_array($result['status_code'], ['201', '200'])) {
            $transactionId = $result['transaction_id'] ?? null;
            $qrString = $result['qr_string'] ?? null;

            // Ambil URL QR Code jika disediakan oleh Midtrans
            if (isset($result['actions']) && is_array($result['actions'])) {
                foreach ($result['actions'] as $action) {
                    if (isset($action['name']) && $action['name'] === 'generate-qr-code') {
                        $qrisUrl = $action['url'];
                        break;
                    }
                }
            }
            $isLiveMidtrans = true;
        }
    }
}

// Fallback Sandbox / Mock QRIS jika Server Key belum dikonfigurasi
// Ini memastikan photobooth bisa langsung dicoba dan ditest seketika oleh pengguna!
if (!$isLiveMidtrans) {
    // Generate QRIS string simulasi standar EMVCo dummy
    $qrString = sprintf('00020101021226680016ID.CO.QXUAN.WWW011893600999%08d520458125303360540%d5802ID5916QXUAN PHOTOBOOTH6007JAKARTA62070703A016304%04X', 
        time(), (int)$amount, mt_rand(1000, 9999));
    
    // QR Code visual generator fallback
    $qrisUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=' . urlencode($qrString);
}

// Simpan transaksi ke Database MySQL (atau Local Cache fallback)
$metadata = [
    'layout_mode'  => $layoutMode,
    'aspect_ratio' => $aspectRatio,
    'filter'       => $filterName,
    'is_mock'      => !$isLiveMidtrans
];

Database::createTransaction($orderId, $amount, $qrisUrl, $metadata);

// Kembalikan respon ke frontend
jsonResponse(true, 'Tagihan QRIS berhasil dibuat', [
    'order_id'       => $orderId,
    'transaction_id' => $transactionId,
    'amount'         => $amount,
    'currency'       => 'IDR',
    'status'         => 'pending',
    'qris_url'       => $qrisUrl,
    'qr_string'      => $qrString,
    'is_live'        => $isLiveMidtrans,
    'expires_in_sec' => 900 // 15 menit
]);

