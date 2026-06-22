-- ============================================================
--   BUNGA BEAUTÉ - DATABASE SETUP SCRIPT
--   Run this entire script in SQL Server Management Studio (SSMS)
--   or Azure Data Studio to set up the database from scratch.
-- ============================================================


-- ============================================================
-- STEP 1: Create the Database
-- ============================================================
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'BungaBeauteDB')
BEGIN
    CREATE DATABASE BungaBeauteDB;
    PRINT 'Database BungaBeauteDB berhasil dibuat.';
END
ELSE
BEGIN
    PRINT 'Database BungaBeauteDB sudah ada, melewati pembuatan.';
END
GO

USE BungaBeauteDB;
GO


-- ============================================================
-- STEP 2: Create Tables
-- ============================================================

-- Table: klien
-- Menyimpan data pemesan / klien utama
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='klien' AND xtype='U')
BEGIN
    CREATE TABLE klien (
        id_klien      INT IDENTITY(1,1) PRIMARY KEY,
        nama_lengkap  VARCHAR(100)  NOT NULL,
        no_whatsapp   VARCHAR(20)   NOT NULL,
        created_at    DATETIME      DEFAULT GETDATE()
    );
    PRINT 'Tabel klien berhasil dibuat.';
END
GO

-- Table: layanan
-- Katalog layanan makeup beserta harga
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='layanan' AND xtype='U')
BEGIN
    CREATE TABLE layanan (
        id_layanan      INT IDENTITY(1,1) PRIMARY KEY,
        nama_layanan    VARCHAR(100)    NOT NULL,
        kategori        VARCHAR(50),
        harga_katalog   DECIMAL(10,2)   NOT NULL
    );
    PRINT 'Tabel layanan berhasil dibuat.';
END
GO

-- Table: booking
-- Menyimpan header/data utama setiap transaksi booking
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='booking' AND xtype='U')
BEGIN
    CREATE TABLE booking (
        id_booking          INT IDENTITY(1,1) PRIMARY KEY,
        id_klien            INT             NOT NULL,
        tgl_acara           DATE            NOT NULL,
        waktu_acara         TIME            NOT NULL,
        lokasi_acara        VARCHAR(255),
        dp_dibayar          DECIMAL(10,2)   DEFAULT 0,
        status_bayar        VARCHAR(50)     DEFAULT 'Menunggu DP',
        metode_pembayaran   VARCHAR(50),
        created_at          DATETIME        DEFAULT GETDATE(),

        CONSTRAINT FK_booking_klien FOREIGN KEY (id_klien)
            REFERENCES klien(id_klien)
    );
    PRINT 'Tabel booking berhasil dibuat.';
END
GO

-- Table: detail_booking
-- Menyimpan detail setiap orang / layanan dalam satu booking
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='detail_booking' AND xtype='U')
BEGIN
    CREATE TABLE detail_booking (
        id_detail           INT IDENTITY(1,1) PRIMARY KEY,
        id_booking          INT             NOT NULL,
        nama_klien_detail   VARCHAR(100),
        id_layanan          INT             NOT NULL,
        harga_deal          DECIMAL(10,2)   NOT NULL,

        CONSTRAINT FK_detail_booking    FOREIGN KEY (id_booking)
            REFERENCES booking(id_booking),
        CONSTRAINT FK_detail_layanan    FOREIGN KEY (id_layanan)
            REFERENCES layanan(id_layanan)
    );
    PRINT 'Tabel detail_booking berhasil dibuat.';
END
GO


-- ============================================================
-- STEP 3: Seed Data Layanan (Price List)
-- Hapus dan isi ulang agar tidak duplikat saat re-run
-- ============================================================
IF NOT EXISTS (SELECT TOP 1 1 FROM layanan)
BEGIN
    INSERT INTO layanan (nama_layanan, kategori, harga_katalog) VALUES
    -- Bridal
    ('Makeup Pengantin Adat Jawa',       'Bridal',       3500000),
    ('Makeup Pengantin Modern',           'Bridal',       2800000),
    ('Makeup Pengantin Muslimah',         'Bridal',       3000000),
    ('Makeup Prewedding',                 'Bridal',        900000),

    -- Graduation
    ('Makeup Wisuda',                     'Graduation',    450000),
    ('Makeup Wisuda + Hijab Styling',     'Graduation',    550000),

    -- Party & Event
    ('Makeup Kondangan / Pesta',          'Party',         350000),
    ('Makeup Ulang Tahun',                'Party',         300000),
    ('Makeup Artis / Panggung',           'Special',       700000),
    ('Makeup Foto / Konten Kreator',      'Special',       400000),

    -- Additional Services
    ('Hijab Styling (tanpa makeup)',      'Add-on',        150000),
    ('Touch Up (per sesi)',               'Add-on',        100000);

    PRINT 'Data layanan berhasil di-seed.';
END
ELSE
BEGIN
    PRINT 'Data layanan sudah ada, melewati seed.';
END
GO


-- ============================================================
-- STEP 4: Verification — show all tables and row counts
-- ============================================================
SELECT
    t.name          AS nama_tabel,
    p.rows          AS jumlah_baris
FROM
    sys.tables t
    INNER JOIN sys.partitions p ON t.object_id = p.object_id
WHERE
    p.index_id IN (0, 1)
ORDER BY
    t.name;
GO

PRINT '============================================================';
PRINT 'Setup selesai! Database BungaBeauteDB siap digunakan.';
PRINT 'Jangan lupa update file .env dengan kredensial SQL Server Anda.';
PRINT '============================================================';
GO
