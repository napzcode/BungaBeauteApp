require('dotenv').config();
const express = require('express');
const sql = require('mssql');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const dbConfig = {
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        // Use Windows Authentication if DB_USER is not set
        ...(process.env.DB_USER
            ? {}
            : { trustedConnection: true }
        )
    },
    ...(process.env.DB_USER
        ? { user: process.env.DB_USER, password: process.env.DB_PASSWORD }
        : {}
    )
};

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'bunga123') res.json({ success: true });
    else res.status(401).json({ success: false, message: 'Username/Password salah!' });
});

app.get('/api/layanan', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query("SELECT * FROM layanan");
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

//  Perhitungan Keuangan Dipisah agar tidak Minus / Duplikat
app.get('/api/dashboard', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        
        let total = await pool.request().query(`
            SELECT COUNT(*) as jml FROM booking 
            WHERE MONTH(tgl_acara) = MONTH(GETDATE()) 
            AND YEAR(tgl_acara) = YEAR(GETDATE())
        `);
        
        let todayBookings = await pool.request().query(`
            SELECT k.nama_lengkap, l.nama_layanan, b.waktu_acara, b.status_bayar
            FROM booking b
            JOIN klien k ON b.id_klien = k.id_klien
            JOIN detail_booking db ON b.id_booking = db.id_booking
            JOIN layanan l ON db.id_layanan = l.id_layanan
            WHERE b.tgl_acara = CAST(GETDATE() AS DATE)
        `);
        
        let recent = await pool.request().query(`
            SELECT TOP 5 k.nama_lengkap, l.nama_layanan, b.waktu_acara, b.tgl_acara
            FROM booking b 
            JOIN klien k ON b.id_klien = k.id_klien 
            JOIN detail_booking db ON b.id_booking = db.id_booking 
            JOIN layanan l ON db.id_layanan = l.id_layanan 
            ORDER BY b.id_booking DESC
        `);
        
        //  Hitung DP dari tabel utama (tanpa JOIN layanan)
        let totalDpQuery = await pool.request().query(`
            SELECT ISNULL(SUM(dp_dibayar), 0) as total_dp 
            FROM booking 
            WHERE MONTH(tgl_acara) = MONTH(GETDATE()) 
            AND YEAR(tgl_acara) = YEAR(GETDATE())
        `);

        // PERBAIKAN: Hitung Omset dari tabel detail
        let totalOmsetQuery = await pool.request().query(`
            SELECT ISNULL(SUM(db.harga_deal), 0) as total_omset 
            FROM booking b 
            JOIN detail_booking db ON b.id_booking = db.id_booking
            WHERE MONTH(b.tgl_acara) = MONTH(GETDATE()) 
            AND YEAR(b.tgl_acara) = YEAR(GETDATE())
        `);

        let dpMasuk = totalDpQuery.recordset[0].total_dp;
        let omset = totalOmsetQuery.recordset[0].total_omset;
        let sisa = omset - dpMasuk;

        res.json({
            total_booking: total.recordset[0].jml,
            today_bookings: todayBookings.recordset,
            recent_booking: recent.recordset,
            dp_masuk: dpMasuk,
            sisa_pelunasan: sisa < 0 ? 0 : sisa // Mencegah minus jika ada klien bayar lebih
        });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/klien', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query("SELECT * FROM klien ORDER BY id_klien DESC");
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/laporan', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query(`
            SELECT b.id_booking, k.nama_lengkap, b.tgl_acara, b.dp_dibayar, b.status_bayar, b.metode_pembayaran,
                   SUM(db.harga_deal) as total_tagihan
            FROM booking b 
            JOIN klien k ON b.id_klien = k.id_klien 
            JOIN detail_booking db ON b.id_booking = db.id_booking 
            GROUP BY b.id_booking, k.nama_lengkap, b.tgl_acara, b.dp_dibayar, b.status_bayar, b.metode_pembayaran
            ORDER BY b.tgl_acara DESC
        `);
        res.json(result.recordset);
    } catch (err) { res.status(500).send(err.message); }
});

app.put('/api/transaksi/:id', async (req, res) => {
    const { dp_baru, status_baru } = req.body;
    try {
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('dp', sql.Decimal(10,2), parseFloat(dp_baru))
            .input('status', sql.VarChar, status_baru)
            .query("UPDATE booking SET dp_dibayar = @dp, status_bayar = @status WHERE id_booking = @id");
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/booking', async (req, res) => {
    const { nama_lengkap, no_whatsapp, tgl_acara, waktu_acara, lokasi_acara, rombongan, metode_pembayaran } = req.body;
    try {
        let pool = await sql.connect(dbConfig);
        let insertKlien = await pool.request().input('nama', sql.VarChar, nama_lengkap).input('wa', sql.VarChar, no_whatsapp).query("INSERT INTO klien (nama_lengkap, no_whatsapp) OUTPUT INSERTED.id_klien VALUES (@nama, @wa)");
        let id_klien = insertKlien.recordset[0].id_klien;
        let insertBooking = await pool.request().input('idK', sql.Int, id_klien).input('tgl', sql.VarChar, tgl_acara).input('wkt', sql.VarChar, waktu_acara).input('lok', sql.VarChar, lokasi_acara).input('metode', sql.VarChar, metode_pembayaran).query("INSERT INTO booking (id_klien, tgl_acara, waktu_acara, lokasi_acara, dp_dibayar, status_bayar, metode_pembayaran) OUTPUT INSERTED.id_booking VALUES (@idK, CAST(@tgl AS DATE), CAST(@wkt AS TIME), @lok, 0, 'Menunggu DP', @metode)");
        let id_booking = insertBooking.recordset[0].id_booking;
        for (let orang of rombongan) {
            await pool.request().input('idB', sql.Int, id_booking).input('nm', sql.VarChar, orang.nama).input('idL', sql.Int, orang.id_layanan).input('hrg', sql.Decimal(10,2), parseFloat(orang.harga)).query("INSERT INTO detail_booking (id_booking, nama_klien_detail, id_layanan, harga_deal) VALUES (@idB, @nm, @idL, @hrg)");
        }
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ success: false }); }
});

app.listen(process.env.PORT || 3000, () => console.log('Server berjalan di port 3000'));