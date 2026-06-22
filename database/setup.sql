-- ============================================================
--   BUNGA BEAUTÉ - PostgreSQL DATABASE SETUP SCRIPT
--   Run this in Railway's PostgreSQL query editor or psql
-- ============================================================

-- Table: klien
CREATE TABLE IF NOT EXISTS klien (
    id_klien      SERIAL PRIMARY KEY,
    nama_lengkap  VARCHAR(100)  NOT NULL,
    no_whatsapp   VARCHAR(20)   NOT NULL,
    created_at    TIMESTAMP     DEFAULT NOW()
);

-- Table: layanan
CREATE TABLE IF NOT EXISTS layanan (
    id_layanan      SERIAL PRIMARY KEY,
    nama_layanan    VARCHAR(100)    NOT NULL,
    kategori        VARCHAR(50),
    harga_katalog   DECIMAL(10,2)   NOT NULL
);

-- Table: booking
CREATE TABLE IF NOT EXISTS booking (
    id_booking          SERIAL PRIMARY KEY,
    id_klien            INT             NOT NULL REFERENCES klien(id_klien),
    tgl_acara           DATE            NOT NULL,
    waktu_acara         TIME            NOT NULL,
    lokasi_acara        VARCHAR(255),
    dp_dibayar          DECIMAL(10,2)   DEFAULT 0,
    status_bayar        VARCHAR(50)     DEFAULT 'Menunggu DP',
    metode_pembayaran   VARCHAR(50),
    created_at          TIMESTAMP       DEFAULT NOW()
);

-- Table: detail_booking
CREATE TABLE IF NOT EXISTS detail_booking (
    id_detail           SERIAL PRIMARY KEY,
    id_booking          INT             NOT NULL REFERENCES booking(id_booking),
    nama_klien_detail   VARCHAR(100),
    id_layanan          INT             NOT NULL REFERENCES layanan(id_layanan),
    harga_deal          DECIMAL(10,2)   NOT NULL
);

-- Seed layanan (only if empty)
INSERT INTO layanan (nama_layanan, kategori, harga_katalog)
SELECT * FROM (VALUES
    ('Makeup Pengantin Adat Jawa',    'Bridal',      3500000),
    ('Makeup Pengantin Modern',        'Bridal',      2800000),
    ('Makeup Pengantin Muslimah',      'Bridal',      3000000),
    ('Makeup Prewedding',              'Bridal',       900000),
    ('Makeup Wisuda',                  'Graduation',   450000),
    ('Makeup Wisuda + Hijab Styling',  'Graduation',   550000),
    ('Makeup Kondangan / Pesta',       'Party',        350000),
    ('Makeup Ulang Tahun',             'Party',        300000),
    ('Makeup Artis / Panggung',        'Special',      700000),
    ('Makeup Foto / Konten Kreator',   'Special',      400000),
    ('Hijab Styling (tanpa makeup)',   'Add-on',       150000),
    ('Touch Up (per sesi)',            'Add-on',       100000)
) AS v(nama_layanan, kategori, harga_katalog)
WHERE NOT EXISTS (SELECT 1 FROM layanan);
