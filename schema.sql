-- =====================================================================
-- Qxuan Photobooth Database Schema
-- MySQL Schema untuk Metadata Transaksi & Log Pembayaran QRIS
-- =====================================================================
-- Catatan Privasi: Sesuai spesifikasi, file foto mentah TIDAK disimpan
-- di database ini. Database hanya mencatat log/metadata transaksi.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `qxuan_photobooth` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `qxuan_photobooth`;

-- Tabel: transactions
-- Menyimpan status dan metadata pembayaran Midtrans QRIS
CREATE TABLE IF NOT EXISTS `transactions` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `order_id` VARCHAR(64) NOT NULL UNIQUE,
    `transaction_id` VARCHAR(64) NULL,
    `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `status` ENUM('pending', 'paid', 'expired', 'failed') NOT NULL DEFAULT 'pending',
    `payment_type` VARCHAR(32) NOT NULL DEFAULT 'qris',
    `qris_url` TEXT NULL,
    `photo_url` VARCHAR(500) NULL COMMENT 'URL temporary file di Supabase/Local Storage (TTL 24h)',
    `photo_metadata` JSON NULL COMMENT 'Layout mode, ratio, filter info',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_order_id` (`order_id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabel opsional: system_settings
-- Menyimpan konfigurasi tarif photobooth & mode studio
CREATE TABLE IF NOT EXISTS `system_settings` (
    `setting_key` VARCHAR(64) PRIMARY KEY,
    `setting_value` TEXT NOT NULL,
    `description` VARCHAR(255) NULL,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data default tarif photobooth (Rp 25.000)
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `description`) 
VALUES 
    ('booth_name', 'Qxuan Photobooth', 'Nama brand studio photobooth'),
    ('price_per_session', '25000', 'Tarif per sesi foto dalam Rupiah'),
    ('currency', 'IDR', 'Mata uang pembayaran'),
    ('allow_demo_payment', '1', 'Izinkan tombol simulasi bayar sukses saat testing (1=Ya, 0=Tidak)')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);

