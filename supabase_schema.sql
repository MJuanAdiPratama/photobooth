-- =====================================================================
-- Qxuan Photobooth - Supabase PostgreSQL Schema
-- Jalankan skrip ini langsung di menu: Supabase Dashboard > SQL Editor > New query
-- =====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABEL: transactions
-- Menyimpan metadata transaksi pembayaran Midtrans QRIS & link foto temporary
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(64) UNIQUE NOT NULL,
    transaction_id VARCHAR(64) NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 25000.00,
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'failed')),
    payment_type VARCHAR(32) NOT NULL DEFAULT 'qris',
    qris_url TEXT NULL,
    qr_string TEXT NULL,
    photo_url TEXT NULL,
    photo_metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indeks untuk pencarian cepat status transaksi
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON public.transactions (order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions (status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions (created_at DESC);

-- 3. TABEL: system_settings
-- Menyimpan tarif photobooth & mode studio
CREATE TABLE IF NOT EXISTS public.system_settings (
    setting_key VARCHAR(64) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    description VARCHAR(255) NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Data Default Tarif Photobooth (Rp 25.000)
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES 
    ('booth_name', 'Qxuan Photobooth', 'Nama brand studio photobooth'),
    ('price_per_session', '25000', 'Tarif per sesi foto dalam Rupiah'),
    ('currency', 'IDR', 'Mata uang pembayaran'),
    ('allow_demo_payment', '1', 'Izinkan tombol simulasi bayar sukses saat testing (1=Ya, 0=Tidak)')
ON CONFLICT (setting_key) DO UPDATE 
SET setting_value = EXCLUDED.setting_value, updated_at = now();

-- 4. TRIGGER OTOMATIS: updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_transactions_updated_at ON public.transactions;
CREATE TRIGGER set_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Izinkan API backend / client untuk membaca transaksi berdasarkan order_id
DROP POLICY IF EXISTS "Public can select transactions by order_id" ON public.transactions;
CREATE POLICY "Public can select transactions by order_id"
    ON public.transactions FOR SELECT
    USING (true);

-- Izinkan API backend memasukkan transaksi baru
DROP POLICY IF EXISTS "Allow insert transactions" ON public.transactions;
CREATE POLICY "Allow insert transactions"
    ON public.transactions FOR INSERT
    WITH CHECK (true);

-- Izinkan API backend memperbarui status transaksi
DROP POLICY IF EXISTS "Allow update transactions" ON public.transactions;
CREATE POLICY "Allow update transactions"
    ON public.transactions FOR UPDATE
    USING (true);

-- Pengaturan RLS system_settings (Publik read-only)
DROP POLICY IF EXISTS "Public can read settings" ON public.system_settings;
CREATE POLICY "Public can read settings"
    ON public.system_settings FOR SELECT
    USING (true);

-- =====================================================================
-- 6. SUPABASE STORAGE BUCKET: photobooth-temp (TTL 24 Jam)
-- =====================================================================
-- Mendaftarkan bucket penyimpanan foto sementara
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'photobooth-temp',
    'photobooth-temp',
    true,                     -- Public agar link download QR bisa diakses HP pelanggan
    20971520,                 -- Batas ukuran file 20 MB
    ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE 
SET public = true, file_size_limit = 20971520;

-- Kebijakan Akses Storage (RLS):
-- A. Izinkan publik membaca & mengunduh foto
DROP POLICY IF EXISTS "Public can view and download photos" ON storage.objects;
CREATE POLICY "Public can view and download photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'photobooth-temp');

-- B. Izinkan upload file foto baru
DROP POLICY IF EXISTS "Allow upload photobooth photos" ON storage.objects;
CREATE POLICY "Allow upload photobooth photos"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'photobooth-temp');

-- C. Izinkan penghapusan file foto kadaluarsa
DROP POLICY IF EXISTS "Allow delete expired photos" ON storage.objects;
CREATE POLICY "Allow delete expired photos"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'photobooth-temp');

-- =====================================================================
-- 7. FUNGSI DATABASE AUTO-PURGE TTL 24 JAM
-- =====================================================================
CREATE OR REPLACE FUNCTION public.delete_expired_photobooth_photos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count integer;
BEGIN
    -- Menghapus objek foto di storage yang umurnya sudah melebihi 24 jam
    DELETE FROM storage.objects
    WHERE bucket_id = 'photobooth-temp'
      AND created_at < (NOW() - INTERVAL '24 hours');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- (Opsional) Jika ekstensi pg_cron diaktifkan di Supabase:
-- SELECT cron.schedule('auto-purge-every-hour', '0 * * * *', 'SELECT public.delete_expired_photobooth_photos()');

