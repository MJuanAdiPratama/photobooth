<?php
/**
 * Qxuan Photobooth - Database Connector & Query Helper
 * Menggunakan PDO MySQL dengan fallback cache lokal jika DB sedang offline saat testing.
 */

require_once __DIR__ . '/config.php';

class Database {
    private static ?PDO $instance = null;
    private static bool $connectionFailed = false;
    private static string $cacheFile = __DIR__ . '/../storage/transactions_cache.json';

    public static function getConnection(): ?PDO {
        if (self::$connectionFailed) {
            return null;
        }

        if (self::$instance === null) {
            $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, DB_NAME);
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::ATTR_TIMEOUT            => 2, // Timeout cepat agar UI tidak menggantung jika DB mati
            ];

            try {
                self::$instance = new PDO($dsn, DB_USER, DB_PASS, $options);
            } catch (PDOException $e) {
                self::$connectionFailed = true;
                error_log('[DB Error] Koneksi MySQL gagal: ' . $e->getMessage());
                // Fallback graceful: kita catat log dan gunakan penyimpanan cache lokal
                return null;
            }
        }

        return self::$instance;
    }

    /**
     * Simpan transaksi baru
     */
    public static function createTransaction(string $orderId, float $amount, ?string $qrisUrl = null, array $metadata = []): bool {
        $db = self::getConnection();
        $metaJson = json_encode($metadata, JSON_UNESCAPED_SLASHES);

        if ($db) {
            try {
                $stmt = $db->prepare('
                    INSERT INTO transactions (order_id, amount, status, payment_type, qris_url, photo_metadata) 
                    VALUES (:order_id, :amount, "pending", "qris", :qris_url, :photo_metadata)
                    ON DUPLICATE KEY UPDATE 
                        amount = VALUES(amount), 
                        qris_url = VALUES(qris_url),
                        photo_metadata = VALUES(photo_metadata)
                ');
                return $stmt->execute([
                    ':order_id'       => $orderId,
                    ':amount'         => $amount,
                    ':qris_url'       => $qrisUrl,
                    ':photo_metadata' => $metaJson
                ]);
            } catch (Exception $e) {
                error_log('[DB Save Error]: ' . $e->getMessage());
            }
        }

        // Fallback file cache jika MySQL belum dinyalakan di local environment
        self::saveToLocalCache($orderId, [
            'order_id'       => $orderId,
            'transaction_id' => null,
            'amount'         => $amount,
            'status'         => 'pending',
            'payment_type'   => 'qris',
            'qris_url'       => $qrisUrl,
            'photo_metadata' => $metadata,
            'created_at'     => date('Y-m-d H:i:s'),
            'updated_at'     => date('Y-m-d H:i:s')
        ]);
        return true;
    }

    /**
     * Update status transaksi (misal: 'paid', 'expired', 'failed')
     */
    public static function updateStatus(string $orderId, string $status, ?string $transactionId = null): bool {
        $db = self::getConnection();

        if ($db) {
            try {
                $sql = 'UPDATE transactions SET status = :status, updated_at = NOW()';
                $params = [
                    ':status'   => $status,
                    ':order_id' => $orderId
                ];
                if ($transactionId) {
                    $sql .= ', transaction_id = :tx_id';
                    $params[':tx_id'] = $transactionId;
                }
                $sql .= ' WHERE order_id = :order_id';

                $stmt = $db->prepare($sql);
                return $stmt->execute($params);
            } catch (Exception $e) {
                error_log('[DB Update Error]: ' . $e->getMessage());
            }
        }

        // Update local cache
        $cache = self::readLocalCache();
        if (isset($cache[$orderId])) {
            $cache[$orderId]['status'] = $status;
            if ($transactionId) {
                $cache[$orderId]['transaction_id'] = $transactionId;
            }
            $cache[$orderId]['updated_at'] = date('Y-m-d H:i:s');
            self::writeLocalCache($cache);
            return true;
        }
        return false;
    }

    /**
     * Ambil data transaksi berdasarkan order_id
     */
    public static function getTransaction(string $orderId): ?array {
        $db = self::getConnection();

        if ($db) {
            try {
                $stmt = $db->prepare('SELECT * FROM transactions WHERE order_id = :order_id LIMIT 1');
                $stmt->execute([':order_id' => $orderId]);
                $row = $stmt->fetch();
                if ($row) {
                    return $row;
                }
            } catch (Exception $e) {
                error_log('[DB Fetch Error]: ' . $e->getMessage());
            }
        }

        // Cek local cache
        $cache = self::readLocalCache();
        return $cache[$orderId] ?? null;
    }

    /**
     * Update link photo URL temporary setelah upload
     */
    public static function updatePhotoUrl(string $orderId, string $photoUrl): bool {
        $db = self::getConnection();
        if ($db) {
            try {
                $stmt = $db->prepare('UPDATE transactions SET photo_url = :url WHERE order_id = :order_id');
                return $stmt->execute([':url' => $photoUrl, ':order_id' => $orderId]);
            } catch (Exception $e) {
                error_log('[DB Photo Update Error]: ' . $e->getMessage());
            }
        }

        $cache = self::readLocalCache();
        if (isset($cache[$orderId])) {
            $cache[$orderId]['photo_url'] = $photoUrl;
            self::writeLocalCache($cache);
            return true;
        }
        return false;
    }

    // Helper file cache lokal (agar testing offline lancar tanpa hambatan DB)
    private static function readLocalCache(): array {
        if (!file_exists(self::$cacheFile)) {
            return [];
        }
        $data = @file_get_contents(self::$cacheFile);
        return $data ? (json_decode($data, true) ?: []) : [];
    }

    private static function writeLocalCache(array $data): void {
        @file_put_contents(self::$cacheFile, json_encode($data, JSON_PRETTY_PRINT));
    }

    private static function saveToLocalCache(string $orderId, array $record): void {
        $cache = self::readLocalCache();
        $cache[$orderId] = $record;
        self::writeLocalCache($cache);
    }
}

